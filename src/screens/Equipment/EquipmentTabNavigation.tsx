import { Sparkles } from "lucide-react";
import {
  useLayoutEffect,
  useRef,
  type KeyboardEvent,
} from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../lib/auth";
import { getEffectiveDataMode } from "../../lib/dataTrust";

const EQUIPMENT_TABS = [
  { label: "Overview", route: "overview" },
  { label: "Notifications", route: "notifications" },
  { label: "Work Orders", route: "work-orders" },
  { label: "Calibrations", route: "pms" },
  { label: "History", route: "history" },
  { label: "Skills & Engineers", route: "skills" },
  { label: "Spares", route: "spares" },
  { label: "Documents", route: "documents" },
  { label: "AI Insights", route: "ai-insights", actionInLive: true },
] as const;

export type EquipmentTabRoute = (typeof EQUIPMENT_TABS)[number]["route"];

const scrollPositionByEquipment = new Map<string, number>();

interface EquipmentTabNavigationProps {
  equipmentId: string;
  activeTab: EquipmentTabRoute;
}

export function EquipmentTabNavigation({
  equipmentId,
  activeTab,
}: EquipmentTabNavigationProps): JSX.Element {
  const navigate = useNavigate();
  const { siteContext } = useAuth();
  const dataMode = getEffectiveDataMode(Boolean(siteContext?.siteId));
  const navigationRef = useRef<HTMLElement>(null);
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const activeIndex = EQUIPMENT_TABS.findIndex((tab) => tab.route === activeTab);

  useLayoutEffect(() => {
    const navigation = navigationRef.current;
    if (!navigation) return;

    navigation.scrollLeft = scrollPositionByEquipment.get(equipmentId) ?? 0;

    const activeButton = tabRefs.current[activeIndex];
    if (!activeButton) return;

    const buttonStart = activeButton.offsetLeft;
    const buttonEnd = buttonStart + activeButton.offsetWidth;
    const visibleStart = navigation.scrollLeft;
    const visibleEnd = visibleStart + navigation.clientWidth;

    if (buttonStart < visibleStart) {
      navigation.scrollLeft = buttonStart;
    } else if (buttonEnd > visibleEnd) {
      navigation.scrollLeft = buttonEnd - navigation.clientWidth;
    }
  }, [activeIndex, equipmentId]);

  const rememberScrollPosition = (): void => {
    const navigation = navigationRef.current;
    if (navigation) {
      scrollPositionByEquipment.set(equipmentId, navigation.scrollLeft);
    }
  };

  const moveTabFocus = (
    event: KeyboardEvent<HTMLButtonElement>,
    currentIndex: number,
  ): void => {
    let nextIndex: number | null = null;

    if (event.key === "ArrowRight") {
      nextIndex = (currentIndex + 1) % EQUIPMENT_TABS.length;
    } else if (event.key === "ArrowLeft") {
      nextIndex =
        (currentIndex - 1 + EQUIPMENT_TABS.length) % EQUIPMENT_TABS.length;
    } else if (event.key === "Home") {
      nextIndex = 0;
    } else if (event.key === "End") {
      nextIndex = EQUIPMENT_TABS.length - 1;
    }

    if (nextIndex === null) return;

    event.preventDefault();
    tabRefs.current[nextIndex]?.focus();
  };

  return (
    <nav
      ref={navigationRef}
      onScroll={rememberScrollPosition}
      className="mt-4 flex gap-1 overflow-x-auto pb-1"
      aria-label="Equipment sections"
      role="tablist"
      aria-orientation="horizontal"
      data-vorta-equipment-tablist="true"
    >
      {EQUIPMENT_TABS.map((tab, index) => {
        const askVorta = dataMode === "live" && "actionInLive" in tab;
        const label = askVorta ? "Ask Vorta" : tab.label;
        const active = tab.route === activeTab;

        return (
          <button
            key={tab.route}
            ref={(element) => {
              tabRefs.current[index] = element;
            }}
            type="button"
            role="tab"
            aria-selected={active}
            aria-current={active ? "page" : undefined}
            tabIndex={active ? 0 : -1}
            data-vorta-equipment-tab={tab.route}
            data-vorta-equipment-action={askVorta ? "ask-vorta" : undefined}
            onKeyDown={(event) => moveTabFocus(event, index)}
            onClick={() => {
              rememberScrollPosition();
              navigate(`/equipment/${equipmentId}/${tab.route}`);
            }}
            className={`flex min-h-10 shrink-0 items-center gap-2 rounded-t-lg border-b-2 px-4 py-2.5 text-xs font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-blue-300 ${
              askVorta
                ? `ml-1 border-blue-500/40 bg-blue-500/10 text-blue-300 hover:bg-blue-500/15 hover:text-blue-200 ${
                    active ? "ring-1 ring-inset ring-blue-400/50" : ""
                  }`
                : active
                  ? "border-blue-500 bg-blue-500/[0.08] text-blue-300 shadow-[inset_0_-1px_0_rgba(96,165,250,0.65)]"
                  : "border-transparent text-slate-500 hover:bg-white/[0.03] hover:text-slate-300"
            }`}
          >
            {askVorta ? (
              <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
            ) : null}
            {label}
          </button>
        );
      })}
    </nav>
  );
}
