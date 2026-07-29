import { Sparkles } from "lucide-react";
import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  type KeyboardEvent,
  type PropsWithChildren,
} from "react";
import { useNavigate } from "react-router-dom";
import { useMediaQuery } from "../../hooks/useMediaQuery";
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
const verticalScrollByEquipmentRoute = new Map<string, number>();
const pendingKeyboardFocusByEquipment = new Map<string, EquipmentTabRoute>();
const EquipmentTabNavigationVisibilityContext = createContext(true);

interface EquipmentTabNavigationProps {
  equipmentId: string;
  activeTab: EquipmentTabRoute;
}

function routeScrollKey(equipmentId: string, route: EquipmentTabRoute): string {
  return `${equipmentId}:${route}`;
}

function findPortalScrollContainer(from: Element | null): HTMLElement | null {
  if (typeof window === "undefined") return null;

  let current = from?.parentElement ?? null;
  while (current) {
    const overflowY = window.getComputedStyle(current).overflowY;
    if (overflowY === "auto" || overflowY === "scroll") return current;
    current = current.parentElement;
  }

  return null;
}

export function EquipmentTabNavigationVisibilityProvider({
  visible,
  children,
}: PropsWithChildren<{ visible: boolean }>): JSX.Element {
  return (
    <EquipmentTabNavigationVisibilityContext.Provider value={visible}>
      {children}
    </EquipmentTabNavigationVisibilityContext.Provider>
  );
}

export function EquipmentTabNavigation({
  equipmentId,
  activeTab,
}: EquipmentTabNavigationProps): JSX.Element {
  const navigate = useNavigate();
  const { siteContext } = useAuth();
  const dataMode = getEffectiveDataMode(Boolean(siteContext?.siteId));
  const isPhone = useMediaQuery("(max-width: 767px)");
  const visible = useContext(EquipmentTabNavigationVisibilityContext);
  const navigationRef = useRef<HTMLElement>(null);
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const visibleTabs = isPhone
    ? EQUIPMENT_TABS.filter((tab) => tab.route !== "ai-insights")
    : [...EQUIPMENT_TABS];
  const activeIndex = visibleTabs.findIndex((tab) => tab.route === activeTab);

  useLayoutEffect(() => {
    if (!visible) return;
    const navigation = navigationRef.current;
    if (!navigation) return;

    navigation.scrollLeft = scrollPositionByEquipment.get(equipmentId) ?? 0;

    const activeButton = activeIndex >= 0 ? tabRefs.current[activeIndex] : null;
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

    if (pendingKeyboardFocusByEquipment.get(equipmentId) === activeTab) {
      pendingKeyboardFocusByEquipment.delete(equipmentId);
      activeButton.focus({ preventScroll: true });
    }
  }, [activeIndex, activeTab, equipmentId, visible]);

  useLayoutEffect(() => {
    if (!visible || typeof window === "undefined") return;
    const scrollContainer = findPortalScrollContainer(navigationRef.current);
    const savedTop = verticalScrollByEquipmentRoute.get(
      routeScrollKey(equipmentId, activeTab),
    );
    if (!scrollContainer || savedTop === undefined) return;

    const restore = (): void => {
      scrollContainer.scrollTo({
        top: savedTop,
        left: scrollContainer.scrollLeft,
        behavior: "auto",
      });
    };

    restore();
    const firstFrame = window.requestAnimationFrame(() => {
      restore();
      window.requestAnimationFrame(restore);
    });
    const settledTimer = window.setTimeout(restore, 160);

    return () => {
      window.cancelAnimationFrame(firstFrame);
      window.clearTimeout(settledTimer);
    };
  }, [activeTab, equipmentId, visible]);

  useEffect(() => {
    if (!visible) return;
    const scrollContainer = findPortalScrollContainer(navigationRef.current);
    if (!scrollContainer) return;

    const key = routeScrollKey(equipmentId, activeTab);
    const rememberVerticalPosition = (): void => {
      verticalScrollByEquipmentRoute.set(key, scrollContainer.scrollTop);
    };

    rememberVerticalPosition();
    scrollContainer.addEventListener("scroll", rememberVerticalPosition, {
      passive: true,
    });

    return () => {
      rememberVerticalPosition();
      scrollContainer.removeEventListener("scroll", rememberVerticalPosition);
    };
  }, [activeTab, equipmentId, visible]);

  const rememberHorizontalPosition = (): void => {
    const navigation = navigationRef.current;
    if (navigation) {
      scrollPositionByEquipment.set(equipmentId, navigation.scrollLeft);
    }
  };

  const handleTabKeyDown = (
    event: KeyboardEvent<HTMLButtonElement>,
    currentIndex: number,
    route: EquipmentTabRoute,
  ): void => {
    if (event.key === "Enter" || event.key === " ") {
      pendingKeyboardFocusByEquipment.set(equipmentId, route);
      return;
    }

    let nextIndex: number | null = null;

    if (event.key === "ArrowRight") {
      nextIndex = (currentIndex + 1) % visibleTabs.length;
    } else if (event.key === "ArrowLeft") {
      nextIndex =
        (currentIndex - 1 + visibleTabs.length) % visibleTabs.length;
    } else if (event.key === "Home") {
      nextIndex = 0;
    } else if (event.key === "End") {
      nextIndex = visibleTabs.length - 1;
    }

    if (nextIndex === null) return;

    event.preventDefault();
    tabRefs.current[nextIndex]?.focus();
  };

  const routeTo = (route: EquipmentTabRoute): void => {
    const scrollContainer = findPortalScrollContainer(navigationRef.current);
    const currentTop = scrollContainer?.scrollTop ?? 0;

    verticalScrollByEquipmentRoute.set(
      routeScrollKey(equipmentId, activeTab),
      currentTop,
    );
    verticalScrollByEquipmentRoute.set(routeScrollKey(equipmentId, route), currentTop);

    navigate(`/equipment/${equipmentId}/${route}`, {
      preventScrollReset: true,
    });
  };

  if (!visible) {
    return <span data-vorta-equipment-tab-placeholder="true" hidden />;
  }

  return (
    <div className="mt-4" data-vorta-equipment-mobile-tabs="true">
      <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500 sm:hidden">
        Equipment section
      </span>
      <nav
        ref={navigationRef}
        onScroll={rememberHorizontalPosition}
        className="flex gap-1 overflow-x-auto pb-1"
        style={{ scrollbarWidth: "none" }}
        aria-label="Equipment sections"
        role="tablist"
        aria-orientation="horizontal"
        data-vorta-equipment-tablist="true"
        data-vorta-preserve-portal-scroll="true"
      >
        {visibleTabs.map((tab, index) => {
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
              data-vorta-tab-outline="true"
              data-vorta-equipment-tab={tab.route}
              data-vorta-equipment-action={askVorta ? "ask-vorta" : undefined}
              onKeyDown={(event) => handleTabKeyDown(event, index, tab.route)}
              onClick={() => {
                rememberHorizontalPosition();
                routeTo(tab.route);
              }}
              className={`flex min-h-11 shrink-0 items-center gap-2 rounded-lg border px-3 py-2.5 text-xs font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-blue-300 sm:rounded-t-lg sm:border-x-0 sm:border-t-0 sm:border-b-2 sm:px-4 ${
                askVorta
                  ? `ml-1 border-blue-500/40 bg-blue-500/10 text-blue-300 hover:bg-blue-500/15 hover:text-blue-200 ${
                      active ? "ring-1 ring-inset ring-blue-400/50" : ""
                    }`
                  : active
                    ? "border-blue-500 bg-blue-500/[0.08] text-blue-300 shadow-[inset_0_-1px_0_rgba(96,165,250,0.65)]"
                    : "border-gray-800 bg-[#0d1117] text-slate-500 hover:border-gray-700 hover:bg-white/[0.03] hover:text-slate-300 sm:border-transparent sm:bg-transparent"
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
    </div>
  );
}
