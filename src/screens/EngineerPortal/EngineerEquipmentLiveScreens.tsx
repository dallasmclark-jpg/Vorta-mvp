import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  Box,
  ChevronRight,
  MapPin,
  Package,
  RefreshCw,
  Search,
  ShieldCheck,
  Wrench,
} from "lucide-react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";

const PAGE =
  "mx-auto flex w-full max-w-[1500px] flex-col gap-5 px-4 pb-10 pt-5 sm:px-5 md:gap-6 md:px-6 md:pb-12 md:pt-6 xl:px-8";
const CARD =
  "rounded-2xl border border-slate-800/75 bg-[#030c1d] shadow-[0_14px_34px_rgba(0,0,0,0.22)]";
const RAISED = "rounded-xl border border-slate-800/70 bg-[#07172b]";
const BUTTON =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-700/80 bg-[#07172b] px-3 text-sm font-medium text-slate-200 transition-colors hover:border-blue-400/50 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400";

interface EquipmentRisk {
  equipment_id: string;
  risk_score: number | null;
  risk_level: string | null;
  overdue_pm_count: number | null;
  open_work_order_count: number | null;
  calibration_overdue_count: number | null;
  repeat_breakdown_count: number | null;
  single_point_skill_gap: boolean | null;
  critical_spares_missing: number | null;
  risk_summary: string | null;
  priority_action: string | null;
  operational_risk_score: number | null;
  labour_risk_score: number | null;
  scheduled_engineer_count: number | null;
  qualified_engineer_count: number | null;
  missing_skill_count: number | null;
  labour_shift_date: string | null;
  labour_shift_type: string | null;
  no_engineer_override: boolean | null;
  updated_at: string | null;
}

interface EquipmentAsset {
  id: string;
  equipment_code: string | null;
  name: string;
  equipment_type: string | null;
  area: string | null;
  line: string | null;
  oem: string | null;
  model: string | null;
  manufacturer: string | null;
  serial_number: string | null;
  install_date: string | null;
  criticality: string | null;
  status: string | null;
  image_url: string | null;
  site_id: string;
  organisation_id: string;
  risk: EquipmentRisk | null;
}

interface EquipmentComponent {
  equipment_id: string;
  component_name: string;
  component_code: string | null;
  quantity_available: number | null;
  quantity_target: number | null;
  minimum_quantity: number | null;
  availability_status: string | null;
  vendor_name: string | null;
  maker_name: string | null;
  storage_location: string | null;
  criticality: string | null;
  unit_cost: number | null;
  lead_days: number | null;
  updated_at: string | null;
}

interface EquipmentPayload {
  siteId: string;
  organisationId: string;
  engineer: {
    id: string;
    fullName: string;
    discipline: string | null;
  };
  equipment: EquipmentAsset[];
  components: EquipmentComponent[];
  generatedAt: string;
  scope: "site";
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function numberValue(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function normaliseRisk(value: unknown): EquipmentRisk | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  const equipmentId = stringValue(row.equipment_id);
  if (!equipmentId) return null;
  return {
    equipment_id: equipmentId,
    risk_score: numberValue(row.risk_score),
    risk_level: stringValue(row.risk_level),
    overdue_pm_count: numberValue(row.overdue_pm_count),
    open_work_order_count: numberValue(row.open_work_order_count),
    calibration_overdue_count: numberValue(row.calibration_overdue_count),
    repeat_breakdown_count: numberValue(row.repeat_breakdown_count),
    single_point_skill_gap: row.single_point_skill_gap === true,
    critical_spares_missing: numberValue(row.critical_spares_missing),
    risk_summary: stringValue(row.risk_summary),
    priority_action: stringValue(row.priority_action),
    operational_risk_score: numberValue(row.operational_risk_score),
    labour_risk_score: numberValue(row.labour_risk_score),
    scheduled_engineer_count: numberValue(row.scheduled_engineer_count),
    qualified_engineer_count: numberValue(row.qualified_engineer_count),
    missing_skill_count: numberValue(row.missing_skill_count),
    labour_shift_date: stringValue(row.labour_shift_date),
    labour_shift_type: stringValue(row.labour_shift_type),
    no_engineer_override: row.no_engineer_override === true,
    updated_at: stringValue(row.updated_at),
  };
}

function normaliseAsset(value: unknown): EquipmentAsset | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  const id = stringValue(row.id);
  const name = stringValue(row.name);
  const siteId = stringValue(row.site_id);
  const organisationId = stringValue(row.organisation_id);
  if (!id || !name || !siteId || !organisationId) return null;
  return {
    id,
    equipment_code: stringValue(row.equipment_code),
    name,
    equipment_type: stringValue(row.equipment_type),
    area: stringValue(row.area),
    line: stringValue(row.line),
    oem: stringValue(row.oem),
    model: stringValue(row.model),
    manufacturer: stringValue(row.manufacturer),
    serial_number: stringValue(row.serial_number),
    install_date: stringValue(row.install_date),
    criticality: stringValue(row.criticality),
    status: stringValue(row.status),
    image_url: stringValue(row.image_url),
    site_id: siteId,
    organisation_id: organisationId,
    risk: normaliseRisk(row.risk),
  };
}

function normaliseComponent(value: unknown): EquipmentComponent | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  const equipmentId = stringValue(row.equipment_id);
  const name = stringValue(row.component_name);
  if (!equipmentId || !name) return null;
  return {
    equipment_id: equipmentId,
    component_name: name,
    component_code: stringValue(row.component_code),
    quantity_available: numberValue(row.quantity_available),
    quantity_target: numberValue(row.quantity_target),
    minimum_quantity: numberValue(row.minimum_quantity),
    availability_status: stringValue(row.availability_status),
    vendor_name: stringValue(row.vendor_name),
    maker_name: stringValue(row.maker_name),
    storage_location: stringValue(row.storage_location),
    criticality: stringValue(row.criticality),
    unit_cost: numberValue(row.unit_cost),
    lead_days: numberValue(row.lead_days),
    updated_at: stringValue(row.updated_at),
  };
}

function normalisePayload(value: unknown): EquipmentPayload {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Engineer equipment evidence returned an invalid payload.");
  }
  const root = value as Record<string, unknown>;
  const error = stringValue(root.error);
  if (error) throw new Error(error);
  const engineerValue = root.engineer;
  if (!engineerValue || typeof engineerValue !== "object" || Array.isArray(engineerValue)) {
    throw new Error("The signed-in engineer could not be resolved from verified identity data.");
  }
  const engineer = engineerValue as Record<string, unknown>;
  const engineerId = stringValue(engineer.id);
  const fullName = stringValue(engineer.fullName);
  const siteId = stringValue(root.siteId);
  const organisationId = stringValue(root.organisationId);
  if (!engineerId || !fullName || !siteId || !organisationId || root.scope !== "site") {
    throw new Error("Engineer equipment scope could not be verified.");
  }
  return {
    siteId,
    organisationId,
    engineer: {
      id: engineerId,
      fullName,
      discipline: stringValue(engineer.discipline),
    },
    equipment: Array.isArray(root.equipment)
      ? root.equipment.flatMap((item) => {
          const asset = normaliseAsset(item);
          return asset ? [asset] : [];
        })
      : [],
    components: Array.isArray(root.components)
      ? root.components.flatMap((item) => {
          const component = normaliseComponent(item);
          return component ? [component] : [];
        })
      : [],
    generatedAt: stringValue(root.generatedAt) ?? new Date().toISOString(),
    scope: "site",
  };
}

async function loadEquipmentEvidence(): Promise<EquipmentPayload> {
  const { data, error } = await supabase.functions.invoke("engineer-equipment-data");
  if (error) {
    throw new Error(`Engineer equipment evidence could not be loaded: ${error.message}`);
  }
  return normalisePayload(data);
}

function riskTone(level: string | null): string {
  const value = (level ?? "").toLowerCase();
  if (value === "critical") return "text-red-400";
  if (value === "high") return "text-orange-400";
  if (value === "medium") return "text-amber-300";
  if (value === "low" || value === "minimal") return "text-emerald-400";
  return "text-slate-400";
}

function stockTone(component: EquipmentComponent): string {
  const status = (component.availability_status ?? "").toLowerCase();
  const stock = component.quantity_available ?? 0;
  const minimum = component.minimum_quantity ?? 0;
  if (stock <= 0 || status.includes("out")) return "text-red-400";
  if (stock <= minimum || status.includes("low")) return "text-amber-400";
  return "text-emerald-400";
}

function displayDate(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value.includes("T") ? value : `${value}T12:00:00Z`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" }).format(date);
}

function LoadingState(): JSX.Element {
  return (
    <main className={PAGE} aria-live="polite">
      <div className="h-8 w-40 animate-pulse rounded bg-slate-800" />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }, (_, index) => <div key={index} className={`${CARD} h-36 animate-pulse`} />)}
      </div>
    </main>
  );
}

function EvidenceError({ title, message, onRetry }: { title: string; message: string; onRetry: () => void }): JSX.Element {
  return (
    <main className={PAGE}>
      <header><h1 className="text-2xl font-semibold tracking-[-0.025em] text-slate-50 md:text-3xl">{title}</h1></header>
      <section className={`${CARD} p-5 sm:p-6`} data-vorta-engineer-equipment-state="unavailable">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" />
          <div>
            <h2 className="text-sm font-semibold text-slate-100">Live evidence unavailable</h2>
            <p className="mt-1 text-sm leading-6 text-slate-400">{message}</p>
            <p className="mt-2 text-xs leading-5 text-slate-500">Vorta will not substitute demo equipment, spare parts or another site&apos;s records when the authenticated site scope cannot be verified.</p>
            <button type="button" onClick={onRetry} className={`${BUTTON} mt-4`}><RefreshCw className="h-4 w-4" />Retry live evidence</button>
          </div>
        </div>
      </section>
    </main>
  );
}

function useEquipmentPayload(): {
  payload: EquipmentPayload | null;
  loading: boolean;
  error: string | null;
  retry: () => void;
} {
  const [payload, setPayload] = useState<EquipmentPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    void loadEquipmentEvidence()
      .then((result) => {
        if (!cancelled) setPayload(result);
      })
      .catch((loadError) => {
        if (!cancelled) {
          setPayload(null);
          setError(loadError instanceof Error ? loadError.message : "Equipment evidence could not be loaded.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [reloadToken]);
  return {
    payload,
    loading,
    error,
    retry: () => setReloadToken((value) => value + 1),
  };
}

export function EngineerEquipmentScreen(): JSX.Element {
  const { payload, loading, error, retry } = useEquipmentPayload();
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return payload?.equipment ?? [];
    return (payload?.equipment ?? []).filter((asset) =>
      [asset.name, asset.equipment_code, asset.equipment_type, asset.area, asset.line, asset.oem, asset.model]
        .filter(Boolean).join(" ").toLowerCase().includes(needle),
    );
  }, [payload, query]);
  if (loading) return <LoadingState />;
  if (error || !payload) return <EvidenceError title="Equipment" message={error ?? "Equipment evidence could not be verified."} onRetry={retry} />;

  return (
    <main className={PAGE} data-vorta-engineer-equipment-state="live">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-blue-400">Site equipment</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-[-0.025em] text-slate-50 md:text-3xl">Equipment</h1>
          <p className="mt-1 text-sm leading-6 text-slate-400">Read-only equipment and current risk evidence for your authorised site.</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-500"><ShieldCheck className="h-4 w-4 text-emerald-400" />Live site scope</div>
      </header>
      <label className="relative block w-full sm:max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-600" />
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search equipment" className="h-11 w-full rounded-xl border border-slate-800 bg-slate-950/50 pl-9 pr-3 text-sm text-slate-100 placeholder:text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400" />
      </label>
      {filtered.length ? (
        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((asset) => (
            <Link key={asset.id} to={`/engineer/equipment/${encodeURIComponent(asset.id)}`} className={`${CARD} p-4 transition-colors hover:border-blue-400/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-slate-600">{asset.area ?? "Area not recorded"}</p>
                  <h2 className="mt-1 truncate text-sm font-semibold text-slate-100">{asset.name}</h2>
                  <p className="mt-1 truncate text-xs text-slate-500">{asset.equipment_code ?? "No asset code"} · {asset.equipment_type ?? "Equipment"}</p>
                </div>
                <ChevronRight className="h-5 w-5 shrink-0 text-slate-600" />
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2 border-t border-slate-800/70 pt-4">
                <div><p className={`text-lg font-semibold ${riskTone(asset.risk?.risk_level ?? null)}`}>{asset.risk?.risk_score ?? "—"}</p><p className="text-[9px] uppercase text-slate-600">Risk</p></div>
                <div><p className="text-lg font-semibold text-slate-200">{asset.risk?.open_work_order_count ?? 0}</p><p className="text-[9px] uppercase text-slate-600">Open work</p></div>
                <div><p className="text-lg font-semibold text-slate-200">{asset.risk?.missing_skill_count ?? 0}</p><p className="text-[9px] uppercase text-slate-600">Skill gaps</p></div>
              </div>
            </Link>
          ))}
        </section>
      ) : (
        <section className={`${CARD} p-6 text-center`}><Wrench className="mx-auto h-5 w-5 text-slate-600" /><p className="mt-2 text-sm font-semibold text-slate-200">No matching live equipment</p><p className="mt-1 text-xs text-slate-500">No demo equipment has been substituted.</p></section>
      )}
    </main>
  );
}

export function EngineerEquipmentDetailScreen(): JSX.Element {
  const { equipmentId } = useParams();
  const { payload, loading, error, retry } = useEquipmentPayload();
  if (loading) return <LoadingState />;
  if (error || !payload) return <EvidenceError title="Equipment" message={error ?? "Equipment evidence could not be verified."} onRetry={retry} />;
  const asset = payload.equipment.find((item) => item.id === equipmentId);
  if (!asset) {
    return <main className={PAGE}><Link to="/engineer/equipment" className={BUTTON}><ArrowLeft className="h-4 w-4" />Equipment</Link><section className={`${CARD} p-5`}><AlertTriangle className="h-5 w-5 text-amber-400" /><h1 className="mt-3 text-lg font-semibold text-slate-100">Equipment not available</h1><p className="mt-1 text-sm text-slate-500">This asset is not present in your authorised live site scope.</p></section></main>;
  }
  const components = payload.components.filter((item) => item.equipment_id === asset.id);
  const lowStock = components.filter((item) => {
    const status = (item.availability_status ?? "").toLowerCase();
    return (item.quantity_available ?? 0) <= (item.minimum_quantity ?? 0) || status.includes("low") || status.includes("out");
  }).length;
  return (
    <main className={PAGE} data-vorta-engineer-equipment-detail="live">
      <div><Link to="/engineer/equipment" className={BUTTON}><ArrowLeft className="h-4 w-4" />Equipment</Link></div>
      <header>
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-blue-400">{asset.equipment_code ?? "Equipment"}</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-[-0.025em] text-slate-50 md:text-3xl">{asset.name}</h1>
        <p className="mt-1 text-sm text-slate-400">{asset.area ?? "Area not recorded"} · {asset.equipment_type ?? "Equipment"}</p>
      </header>
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className={`${CARD} p-4`}><p className="text-[9px] uppercase text-slate-600">Risk score</p><p className={`mt-2 text-2xl font-semibold ${riskTone(asset.risk?.risk_level ?? null)}`}>{asset.risk?.risk_score ?? "—"}</p><p className="mt-1 text-xs text-slate-500">{asset.risk?.risk_level ?? "No current score"}</p></div>
        <div className={`${CARD} p-4`}><p className="text-[9px] uppercase text-slate-600">Open work</p><p className="mt-2 text-2xl font-semibold text-slate-100">{asset.risk?.open_work_order_count ?? 0}</p><p className="mt-1 text-xs text-slate-500">Current source records</p></div>
        <div className={`${CARD} p-4`}><p className="text-[9px] uppercase text-slate-600">PM overdue</p><p className="mt-2 text-2xl font-semibold text-slate-100">{asset.risk?.overdue_pm_count ?? 0}</p><p className="mt-1 text-xs text-slate-500">Current due-state evidence</p></div>
        <div className={`${CARD} p-4`}><p className="text-[9px] uppercase text-slate-600">Spares attention</p><p className={`mt-2 text-2xl font-semibold ${lowStock ? "text-amber-400" : "text-emerald-400"}`}>{lowStock}</p><p className="mt-1 text-xs text-slate-500">At/below minimum or flagged</p></div>
      </section>
      <section className={`${CARD} p-5 sm:p-6`}>
        <div className="flex items-center gap-2"><Box className="h-4 w-4 text-blue-400" /><h2 className="text-sm font-semibold text-slate-100">Asset identity</h2></div>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {[
            ["OEM", asset.oem ?? asset.manufacturer ?? "—"],
            ["Model", asset.model ?? "—"],
            ["Serial number", asset.serial_number ?? "—"],
            ["Installed", displayDate(asset.install_date)],
            ["Criticality", asset.criticality ?? "—"],
            ["Status", asset.status ?? "—"],
          ].map(([label, value]) => <div key={label} className={`${RAISED} p-3`}><p className="text-[9px] uppercase tracking-[0.1em] text-slate-600">{label}</p><p className="mt-1 text-sm font-medium text-slate-200">{value}</p></div>)}
        </div>
      </section>
      <section className={`${CARD} p-5`}>
        <h2 className="text-sm font-semibold text-slate-100">Current risk evidence</h2>
        <p className="mt-2 text-sm leading-6 text-slate-400">{asset.risk?.risk_summary ?? "No current risk summary is recorded for this asset."}</p>
        {asset.risk?.priority_action ? <p className="mt-3 rounded-xl border border-blue-500/20 bg-blue-500/[0.07] p-3 text-xs leading-5 text-blue-100/80">Priority action: {asset.risk.priority_action}</p> : null}
      </section>
      <Link to={`/engineer/stores?equipment=${encodeURIComponent(asset.id)}`} className="inline-flex min-h-12 items-center justify-center rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400">View linked stores parts</Link>
    </main>
  );
}

export function EngineerStoresScreen(): JSX.Element {
  const { payload, loading, error, retry } = useEquipmentPayload();
  const [searchParams, setSearchParams] = useSearchParams();
  const [query, setQuery] = useState("");
  const selectedEquipmentId = searchParams.get("equipment") ?? "all";
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return (payload?.components ?? []).filter((component) => {
      if (selectedEquipmentId !== "all" && component.equipment_id !== selectedEquipmentId) return false;
      if (!needle) return true;
      return [component.component_name, component.component_code, component.vendor_name, component.maker_name, component.storage_location]
        .filter(Boolean).join(" ").toLowerCase().includes(needle);
    });
  }, [payload, query, selectedEquipmentId]);
  if (loading) return <LoadingState />;
  if (error || !payload) return <EvidenceError title="Stores" message={error ?? "Stores evidence could not be verified."} onRetry={retry} />;
  const equipmentMap = new Map(payload.equipment.map((asset) => [asset.id, asset]));
  const outCount = payload.components.filter((component) => (component.quantity_available ?? 0) <= 0 || (component.availability_status ?? "").toLowerCase().includes("out")).length;
  const lowCount = payload.components.filter((component) => {
    const stock = component.quantity_available ?? 0;
    return stock > 0 && (stock <= (component.minimum_quantity ?? 0) || (component.availability_status ?? "").toLowerCase().includes("low"));
  }).length;
  return (
    <main className={PAGE} data-vorta-engineer-stores-state="live">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div><p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-blue-400">Read-only inventory</p><h1 className="mt-1 text-2xl font-semibold tracking-[-0.025em] text-slate-50 md:text-3xl">Stores</h1><p className="mt-1 text-sm leading-6 text-slate-400">Parts linked to equipment at your authorised site.</p></div>
        <div className="flex items-center gap-2 text-xs text-slate-500"><ShieldCheck className="h-4 w-4 text-emerald-400" />Live site scope</div>
      </header>
      <section className="grid gap-3 sm:grid-cols-3">
        <div className={`${CARD} p-4`}><p className="text-[9px] uppercase text-slate-600">Components</p><p className="mt-2 text-2xl font-semibold text-slate-100">{payload.components.length}</p></div>
        <div className={`${CARD} p-4`}><p className="text-[9px] uppercase text-slate-600">Low stock</p><p className={`mt-2 text-2xl font-semibold ${lowCount ? "text-amber-400" : "text-emerald-400"}`}>{lowCount}</p></div>
        <div className={`${CARD} p-4`}><p className="text-[9px] uppercase text-slate-600">Out of stock</p><p className={`mt-2 text-2xl font-semibold ${outCount ? "text-red-400" : "text-emerald-400"}`}>{outCount}</p></div>
      </section>
      <section className={`${CARD} p-4 sm:p-5`}>
        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_260px]">
          <label className="relative block"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-600" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search part number, supplier or location" className="h-11 w-full rounded-xl border border-slate-800 bg-slate-950/50 pl-9 pr-3 text-sm text-slate-100 placeholder:text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400" /></label>
          <select value={selectedEquipmentId} onChange={(event) => setSearchParams(event.target.value === "all" ? {} : { equipment: event.target.value })} className="h-11 rounded-xl border border-slate-800 bg-slate-950/50 px-3 text-sm text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400">
            <option value="all">All equipment</option>
            {payload.equipment.map((asset) => <option key={asset.id} value={asset.id}>{asset.name}</option>)}
          </select>
        </div>
        {filtered.length ? (
          <div className="mt-4 space-y-2">
            {filtered.map((component, index) => {
              const asset = equipmentMap.get(component.equipment_id);
              const key = `${component.equipment_id}:${component.component_code ?? component.component_name}:${index}`;
              const partPath = encodeURIComponent(component.component_code ?? component.component_name);
              return <Link key={key} to={`/engineer/stores/${partPath}`} className="flex min-h-20 items-center justify-between gap-3 rounded-xl border border-slate-800/70 bg-[#07172b] p-3.5 transition-colors hover:border-blue-400/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"><div className="min-w-0"><p className="truncate text-sm font-semibold text-slate-100">{component.component_name}</p><p className="mt-1 truncate text-xs text-slate-500">{component.component_code ?? "No part number"} · {asset?.name ?? "Equipment not linked"} · {component.storage_location ?? "Location not recorded"}</p></div><div className="flex shrink-0 items-center gap-3"><div className="text-right"><p className={`text-lg font-semibold ${stockTone(component)}`}>{component.quantity_available ?? 0}</p><p className="text-[9px] uppercase text-slate-600">On hand</p></div><ChevronRight className="h-5 w-5 text-slate-600" /></div></Link>;
            })}
          </div>
        ) : <div className="mt-4 rounded-xl border border-slate-800/70 bg-slate-950/25 p-6 text-center"><Package className="mx-auto h-5 w-5 text-slate-600" /><p className="mt-2 text-sm font-semibold text-slate-200">No matching live parts</p><p className="mt-1 text-xs text-slate-500">No demo inventory has been substituted.</p></div>}
      </section>
    </main>
  );
}

export function EngineerSpareDetailScreen(): JSX.Element {
  const { partNumber } = useParams();
  const { payload, loading, error, retry } = useEquipmentPayload();
  if (loading) return <LoadingState />;
  if (error || !payload) return <EvidenceError title="Stores" message={error ?? "Stores evidence could not be verified."} onRetry={retry} />;
  const decoded = decodeURIComponent(partNumber ?? "");
  const matches = payload.components.filter((component) => component.component_code === decoded || component.component_name === decoded);
  if (!matches.length) return <main className={PAGE}><Link to="/engineer/stores" className={BUTTON}><ArrowLeft className="h-4 w-4" />Stores</Link><section className={`${CARD} p-5`}><AlertTriangle className="h-5 w-5 text-amber-400" /><h1 className="mt-3 text-lg font-semibold text-slate-100">Part not available</h1><p className="mt-1 text-sm text-slate-500">This part is not present in your authorised live site inventory.</p></section></main>;
  const equipmentMap = new Map(payload.equipment.map((asset) => [asset.id, asset]));
  const component = matches[0];
  return (
    <main className={PAGE} data-vorta-engineer-spare-detail="live">
      <div><Link to="/engineer/stores" className={BUTTON}><ArrowLeft className="h-4 w-4" />Stores</Link></div>
      <header><p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-blue-400">{component.component_code ?? "Component"}</p><h1 className="mt-1 text-2xl font-semibold tracking-[-0.025em] text-slate-50 md:text-3xl">{component.component_name}</h1><p className="mt-1 text-sm text-slate-400">Read-only stock evidence from your authorised site.</p></header>
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className={`${CARD} p-4`}><p className="text-[9px] uppercase text-slate-600">On hand</p><p className={`mt-2 text-2xl font-semibold ${stockTone(component)}`}>{component.quantity_available ?? 0}</p></div>
        <div className={`${CARD} p-4`}><p className="text-[9px] uppercase text-slate-600">Minimum</p><p className="mt-2 text-2xl font-semibold text-slate-100">{component.minimum_quantity ?? "—"}</p></div>
        <div className={`${CARD} p-4`}><p className="text-[9px] uppercase text-slate-600">Target</p><p className="mt-2 text-2xl font-semibold text-slate-100">{component.quantity_target ?? "—"}</p></div>
        <div className={`${CARD} p-4`}><p className="text-[9px] uppercase text-slate-600">Lead time</p><p className="mt-2 text-2xl font-semibold text-slate-100">{component.lead_days ?? "—"}<span className="ml-1 text-xs font-normal text-slate-500">days</span></p></div>
      </section>
      <section className={`${CARD} p-5 sm:p-6`}>
        <div className="flex items-center gap-2"><MapPin className="h-4 w-4 text-blue-400" /><h2 className="text-sm font-semibold text-slate-100">Stores identity</h2></div>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {[
            ["Location", component.storage_location ?? "—"],
            ["Supplier", component.vendor_name ?? "—"],
            ["Manufacturer", component.maker_name ?? "—"],
            ["Criticality", component.criticality ?? "—"],
            ["Availability", component.availability_status ?? "—"],
            ["Last updated", displayDate(component.updated_at)],
          ].map(([label, value]) => <div key={label} className={`${RAISED} p-3`}><p className="text-[9px] uppercase tracking-[0.1em] text-slate-600">{label}</p><p className="mt-1 text-sm font-medium text-slate-200">{value}</p></div>)}
        </div>
      </section>
      <section className={`${CARD} p-5`}><h2 className="text-sm font-semibold text-slate-100">Linked equipment</h2><div className="mt-3 space-y-2">{matches.map((item, index) => { const asset = equipmentMap.get(item.equipment_id); return <Link key={`${item.equipment_id}:${index}`} to={`/engineer/equipment/${encodeURIComponent(item.equipment_id)}`} className="flex min-h-12 items-center justify-between rounded-xl border border-slate-800/70 bg-[#07172b] px-3 text-sm text-slate-200 hover:border-blue-400/35"><span>{asset?.name ?? item.equipment_id}</span><ChevronRight className="h-4 w-4 text-slate-600" /></Link>; })}</div></section>
    </main>
  );
}
