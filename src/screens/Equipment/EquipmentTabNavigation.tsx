import { Sparkles } from "lucide-react";
import { useLayoutEffect, useRef } from "react";
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

  useLayoutEffect(() => {
    const navigation = navigationRef.current;
    if (navigation) {
      navigation.scrollLeft = scrollPositionByEquipment.get(equipmentId) ?? 0;
    }
  }, [equipmentId]);

  const rememberScrollPosition = (): void => {
    const navigation = navigationRef.current;
    if (navigation) {
      scrollPositionByEquipment.set(equipmentId, navigation.scrollLeft);
    }
  };

  return (
    <nav
      ref={navigationRef}
      onScroll={rememberScrollPosition}
      className="mt-4 flex gap-1 overflow-x-auto pb-1"
      aria-label="Equipment sections"
    >
      {EQUIPMENT_TABS.map((tab) => {
        const askVorta = dataMode === "live" && "actionInLive" in tab;
        const label = askVorta ? "Ask Vorta" : tab.label;
        const active = tab.route === activeTab;

        return (
          <button
            key={tab.route}
            type="button"
            aria-current={active ? "page" : undefined}
            data-vorta-equipment-action={askVorta ? "ask-vorta" : undefined}
            onClick={() => {
              rememberScrollPosition();
              navigate(`/equipment/${equipmentId}/${tab.route}`);
            }}
            className={`flex min-h-10 shrink-0 items-center gap-2 rounded-t-lg border-b-2 px-4 py-2.5 text-xs font-semibold transition-colors ${
              askVorta
                ? "ml-1 border-blue-500/40 bg-blue-500/10 text-blue-300 hover:bg-blue-500/15 hover:text-blue-200"
                : active
                  ? "border-blue-500 bg-blue-500/[0.06] text-blue-400"
                  : "border-transparent text-slate-500 hover:bg-white/[0.03] hover:text-slate-300"
            }`}
          >
            {askVorta ? <Sparkles className="h-3.5 w-3.5" aria-hidden="true" /> : null}
            {label}
          </button>
        );
      })}
    </nav>
  );
}
