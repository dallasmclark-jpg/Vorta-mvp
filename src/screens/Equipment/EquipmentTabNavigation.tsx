import { useLayoutEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";

const EQUIPMENT_TABS = [
  { label: "Overview", route: "overview" },
  { label: "Notifications", route: "notifications" },
  { label: "Work Orders", route: "work-orders" },
  { label: "Calibrations", route: "pms" },
  { label: "History", route: "history" },
  { label: "Skills & Engineers", route: "skills" },
  { label: "Spares", route: "spares" },
  { label: "Documents", route: "documents" },
  { label: "AI Insights", route: "ai-insights" },
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
  const navigationRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const navigation = navigationRef.current;
    if (navigation) {
      navigation.scrollLeft =
        scrollPositionByEquipment.get(equipmentId) ?? 0;
    }
  }, [equipmentId]);

  const rememberScrollPosition = () => {
    const navigation = navigationRef.current;
    if (navigation) {
      scrollPositionByEquipment.set(
        equipmentId,
        navigation.scrollLeft,
      );
    }
  };

  return (
    <div
      ref={navigationRef}
      onScroll={rememberScrollPosition}
      className="mt-4 flex gap-0 overflow-x-auto"
      aria-label="Equipment sections"
    >
      {EQUIPMENT_TABS.map((tab) => (
        <button
          key={tab.route}
          type="button"
          aria-current={tab.route === activeTab ? "page" : undefined}
          onClick={() => {
            rememberScrollPosition();
            navigate(`/equipment/${equipmentId}/${tab.route}`);
          }}
          className={`flex shrink-0 items-center border-b-2 px-4 py-2.5 text-xs font-semibold transition-colors ${
            tab.route === activeTab
              ? "border-blue-500 text-blue-400"
              : "border-transparent text-slate-500 hover:text-slate-300"
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

