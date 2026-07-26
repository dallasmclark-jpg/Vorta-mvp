import { useEffect, useState, type ReactNode } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMediaQuery } from "../../hooks/useMediaQuery";
import {
  EquipmentTabNavigation,
  EquipmentTabNavigationVisibilityProvider,
  type EquipmentTabRoute,
} from "./EquipmentTabNavigation";
import {
  getCachedEquipmentIdentity,
  getEquipmentIdentityById,
} from "./equipmentService";

type EquipmentIdentity = Awaited<ReturnType<typeof getEquipmentIdentityById>>;

function riskTone(level: string): string {
  const value = level.toLowerCase();
  if (value === "critical") return "text-red-300";
  if (value === "high") return "text-orange-300";
  if (value === "medium") return "text-amber-300";
  return "text-emerald-300";
}

export function EquipmentMobileDetailFrame({
  activeTab,
  children,
}: {
  activeTab: EquipmentTabRoute;
  children: ReactNode;
}): JSX.Element {
  const navigate = useNavigate();
  const { equipmentId = "" } = useParams<{ equipmentId?: string }>();
  const isPhone = useMediaQuery("(max-width: 767px)");
  const [equipment, setEquipment] = useState<EquipmentIdentity | null>(() =>
    equipmentId ? getCachedEquipmentIdentity(equipmentId) : null,
  );

  useEffect(() => {
    if (!equipmentId) return;
    let cancelled = false;

    setEquipment(getCachedEquipmentIdentity(equipmentId));
    void getEquipmentIdentityById(equipmentId).then((identity) => {
      if (!cancelled) setEquipment(identity);
    });

    return () => {
      cancelled = true;
    };
  }, [equipmentId]);

  if (!isPhone) return <>{children}</>;

  return (
    <div data-vorta-equipment-mobile-route-frame="true">
      <style>{`
        @media (max-width: 767px) {
          [data-vorta-equipment-mobile-route-content="true"]
            :is(header, div):has(> [data-vorta-equipment-tab-placeholder="true"]) {
            display: none !important;
          }

          [data-vorta-equipment-mobile-route-content="true"]
            [data-vorta-mobile-equipment-overview="true"]
            > header:first-child {
            display: none !important;
          }

          [data-vorta-equipment-mobile-route-content="true"]
            [data-vorta-equipment-tab-placeholder="true"] {
            display: none !important;
          }
        }
      `}</style>

      <header
        className="border-b border-gray-800 bg-[#0b0e14] px-3 pb-4 pt-4"
        data-vorta-equipment-shared-mobile-hero="true"
      >
        <button
          type="button"
          onClick={() => navigate("/equipment")}
          className="min-h-10 text-sm font-semibold text-slate-500"
        >
          Equipment register
        </button>

        <div className="mt-3 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="line-clamp-2 text-xl font-semibold leading-7 text-slate-50">
              {equipment?.name ?? "Equipment"}
            </h1>
            <p className="mt-1 text-base text-slate-400">
              {equipment
                ? `${equipment.assetNumber} · ${equipment.area}`
                : equipmentId || "Loading equipment identity"}
            </p>
          </div>

          <div className="shrink-0 text-right">
            <p
              className={`text-2xl font-semibold tabular-nums ${riskTone(
                equipment?.riskLevel ?? "low",
              )}`}
            >
              {equipment ? `${equipment.riskScore}%` : "—"}
            </p>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-600">
              risk
            </p>
          </div>
        </div>

        <EquipmentTabNavigation equipmentId={equipmentId} activeTab={activeTab} />
      </header>

      <div data-vorta-equipment-mobile-route-content="true">
        <EquipmentTabNavigationVisibilityProvider visible={false}>
          {children}
        </EquipmentTabNavigationVisibilityProvider>
      </div>
    </div>
  );
}
