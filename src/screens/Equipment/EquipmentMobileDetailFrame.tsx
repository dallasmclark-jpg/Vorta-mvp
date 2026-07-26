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
    <div
      data-vorta-equipment-mobile-route-frame="true"
      data-vorta-equipment-active-tab={activeTab}
      className="w-full min-w-0 max-w-full overflow-x-clip"
    >
      <style>{`
        @media (max-width: 767px) {
          [data-vorta-equipment-mobile-route-frame="true"],
          [data-vorta-equipment-mobile-route-content="true"],
          [data-vorta-equipment-mobile-route-content="true"] > * {
            width: 100% !important;
            min-width: 0 !important;
            max-width: 100% !important;
            overflow-x: clip;
          }

          [data-vorta-equipment-mobile-route-content="true"]
            :where(div, section, article, header, main, aside, form, label) {
            min-width: 0 !important;
          }

          [data-vorta-equipment-mobile-route-content="true"]
            :where(.grid, .flex) > * {
            min-width: 0 !important;
          }

          [data-vorta-equipment-mobile-route-content="true"]
            :where(h1, h2, h3, h4, p, a, button, span, code, td, th) {
            overflow-wrap: anywhere;
            word-break: normal;
          }

          [data-vorta-equipment-mobile-route-content="true"]
            :where(img, canvas, video, iframe) {
            max-width: 100% !important;
            height: auto;
          }

          [data-vorta-equipment-mobile-route-content="true"]
            svg[class*="min-w-"] {
            width: 100% !important;
            min-width: 0 !important;
            max-width: 100% !important;
          }

          [data-vorta-equipment-mobile-route-content="true"]
            :where(input, select, textarea) {
            min-width: 0 !important;
            max-width: 100% !important;
          }

          [data-vorta-equipment-mobile-route-content="true"]
            [class~="overflow-x-auto"] {
            width: 100% !important;
            min-width: 0 !important;
            max-width: 100% !important;
          }

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

          /* Desktop data tables become complete phone cards rather than 760–900px
             surfaces clipped inside a 360px viewport. */
          [data-vorta-equipment-mobile-route-content="true"] table {
            display: block !important;
            width: 100% !important;
            min-width: 0 !important;
            max-width: 100% !important;
            border-collapse: separate !important;
          }

          [data-vorta-equipment-mobile-route-content="true"] table thead {
            display: none !important;
          }

          [data-vorta-equipment-mobile-route-content="true"] table tbody {
            display: grid !important;
            width: 100% !important;
            min-width: 0 !important;
            gap: 0.75rem;
          }

          [data-vorta-equipment-mobile-route-content="true"] table tbody tr {
            display: grid !important;
            width: 100% !important;
            min-width: 0 !important;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 0.75rem;
            padding: 1rem;
            border: 1px solid rgb(31 41 55) !important;
            border-radius: 0.75rem;
            background: rgb(13 18 25);
          }

          [data-vorta-equipment-mobile-route-content="true"] table tbody td {
            display: block !important;
            width: auto !important;
            min-width: 0 !important;
            max-width: 100% !important;
            padding: 0 !important;
            border: 0 !important;
            white-space: normal !important;
            overflow-wrap: anywhere;
          }

          [data-vorta-equipment-mobile-route-content="true"] table tbody td:first-child,
          [data-vorta-equipment-mobile-route-content="true"] table tbody td:last-child,
          [data-vorta-equipment-mobile-route-content="true"] table tbody td[colspan] {
            grid-column: 1 / -1;
          }

          [data-vorta-equipment-mobile-route-content="true"] table tbody td::before {
            display: block;
            margin-bottom: 0.25rem;
            color: rgb(100 116 139);
            font-size: 0.6875rem;
            font-weight: 700;
            line-height: 1rem;
            letter-spacing: 0.08em;
            text-transform: uppercase;
          }

          [data-vorta-equipment-active-tab="spares"]
            table[class*="min-w-[900px]"] tbody td:nth-child(2)::before {
            content: "Criticality";
          }
          [data-vorta-equipment-active-tab="spares"]
            table[class*="min-w-[900px]"] tbody td:nth-child(3)::before {
            content: "Stock / target";
          }
          [data-vorta-equipment-active-tab="spares"]
            table[class*="min-w-[900px]"] tbody td:nth-child(4)::before {
            content: "Supplier";
          }
          [data-vorta-equipment-active-tab="spares"]
            table[class*="min-w-[900px]"] tbody td:nth-child(5)::before {
            content: "Lead time";
          }
          [data-vorta-equipment-active-tab="spares"]
            table[class*="min-w-[900px]"] tbody td:nth-child(6)::before {
            content: "Storage";
          }
          [data-vorta-equipment-active-tab="spares"]
            table[class*="min-w-[900px]"] tbody td:nth-child(7)::before {
            content: "Exposure";
          }

          [data-vorta-equipment-active-tab="spares"]
            table[class*="min-w-[760px]"] tbody td:nth-child(2)::before {
            content: "Status";
          }
          [data-vorta-equipment-active-tab="spares"]
            table[class*="min-w-[760px]"] tbody td:nth-child(3)::before {
            content: "Stock";
          }
          [data-vorta-equipment-active-tab="spares"]
            table[class*="min-w-[760px]"] tbody td:nth-child(4)::before {
            content: "Minimum";
          }
          [data-vorta-equipment-active-tab="spares"]
            table[class*="min-w-[760px]"] tbody td:nth-child(5)::before {
            content: "Target";
          }
          [data-vorta-equipment-active-tab="spares"]
            table[class*="min-w-[760px]"] tbody td:nth-child(6)::before {
            content: "Supplier";
          }
          [data-vorta-equipment-active-tab="spares"]
            table[class*="min-w-[760px]"] tbody td:nth-child(7)::before {
            content: "Lead time";
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
