import { LockKeyhole, Sparkles } from "lucide-react";
import { useLayoutEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../lib/auth";
import { getEffectiveDataMode } from "../../lib/dataTrust";

const EQUIPMENT_TABS = [
  { label: "Overview", route: "overview" },
  { label: "Notifications", route: "notifications" },
  { label: "Work Orders", route: "work-orders" },
  { label: "Calibrations", route: "pms" },
  { label: "History", route: "history", unavailableInLive: true },
  { label: "Skills & Engineers", route: "skills" },
  { label: "Spares", route: "spares" },
  { label: "Documents", route: "documents", unavailableInLive: true },
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
  const navigationRef = useRef<HTMLDivElement>(null);

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
    <>
      <div
        ref={navigationRef}
        onScroll={rememberScrollPosition}
        className="mt-4 flex gap-1 overflow-x-auto pb-1"
        aria-label="Equipment sections"
      >
        {EQUIPMENT_TABS.map((tab) => {
          const unavailable = dataMode === "live" && "unavailableInLive" in tab;
          const askVorta = dataMode === "live" && "actionInLive" in tab;
          const label = askVorta ? "Ask Vorta" : tab.label;
          const active = tab.route === activeTab;

          return (
            <button
              key={tab.route}
              type="button"
              disabled={unavailable}
              aria-disabled={unavailable || undefined}
              aria-describedby={unavailable ? "live-equipment-unavailable-description" : undefined}
              aria-current={active ? "page" : undefined}
              data-vorta-equipment-action={askVorta ? "ask-vorta" : undefined}
              title={
                unavailable
                  ? `${tab.label} is unavailable until its live evidence contract is approved.`
                  : undefined
              }
              onClick={() => {
                if (unavailable) return;
                rememberScrollPosition();
                navigate(`/equipment/${equipmentId}/${tab.route}`);
              }}
              className={`flex min-h-10 shrink-0 items-center gap-2 rounded-t-lg border-b-2 px-4 py-2.5 text-xs font-semibold transition-colors ${
                askVorta
                  ? "ml-1 border-blue-500/40 bg-blue-500/10 text-blue-300 hover:bg-blue-500/15 hover:text-blue-200"
                  : unavailable
                    ? "cursor-not-allowed border-transparent text-slate-700"
                    : active
                      ? "border-blue-500 bg-blue-500/[0.06] text-blue-400"
                      : "border-transparent text-slate-500 hover:bg-white/[0.03] hover:text-slate-300"
              }`}
            >
              {unavailable ? <LockKeyhole className="h-3.5 w-3.5" aria-hidden="true" /> : null}
              {askVorta ? <Sparkles className="h-3.5 w-3.5" aria-hidden="true" /> : null}
              {label}
            </button>
          );
        })}
      </div>
      <p id="live-equipment-unavailable-description" className="sr-only">
        This live Equipment section is disabled because its active-site evidence contract has not yet been approved. No demonstration data will be substituted.
      </p>
    </>
  );
}
