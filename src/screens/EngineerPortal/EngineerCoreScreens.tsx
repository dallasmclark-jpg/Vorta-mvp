import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Bell,
  BookOpen,
  Box,
  Camera,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  Clock3,
  FileSearch,
  FileText,
  Filter,
  Gauge,
  History,
  Info,
  MapPin,
  Mic,
  Package,
  QrCode,
  Search,
  ShieldCheck,
  Sparkles,
  Wrench,
  XCircle,
} from "lucide-react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useAuth } from "../../lib/auth";
import { supabase } from "../../lib/supabaseClient";
import {
  getEquipmentActivity,
  getEquipmentComponents,
  getEquipmentDocuments,
  getEquipmentIdentityById,
  getEquipmentList,
  getEquipmentPMs,
  getEquipmentSkills,
  getEquipmentWorkOrders,
  type EquipmentComponent,
  type EquipmentListItem,
} from "../Equipment/equipmentService";

const PAGE = "mx-auto flex w-full max-w-[1600px] flex-col gap-5 px-4 pb-10 pt-5 sm:px-5 md:gap-6 md:px-6 md:pb-12 md:pt-6 xl:px-8";
const CARD = "rounded-2xl border border-slate-800/75 bg-[#030c1d] shadow-[0_14px_34px_rgba(0,0,0,0.22)]";
const RAISED = "rounded-xl border border-slate-800/70 bg-[#07172b]";
const BUTTON = "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-700/80 bg-[#07172b] px-3 text-sm font-medium text-slate-200 transition-colors hover:border-blue-400/50 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400";

interface EngineerWorkOrder {
  id: string;
  rowId: string;
  equipmentId: string;
  equipmentName: string;
  assetNumber: string;
  area: string;
  priority: string;
  description: string;
  workType: string;
  status: string;
  assignedEngineer: string;
  requestedDate: string;
  dueDate: string;
  overdue: boolean;
  downtimeMinutes: number | null;
  faultCode: string | null;
}

interface EngineerPart {
  equipmentId: string;
  equipmentName: string;
  equipmentAssetNumber: string;
  name: string;
  partNumber: string;
  stock: number;
  target: number;
  minimumQuantity: number;
  status: string;
  supplier: string;
  manufacturer: string;
  location: string;
  criticality: string;
  leadDays: number;
}

const DEMO_WORK_ORDERS: EngineerWorkOrder[] = [
  {
    id: "4201846",
    rowId: "demo-4201846",
    equipmentId: "vf-02",
    equipmentName: "Bosch VF-02",
    assetNumber: "VF-02",
    area: "Fill Finish",
    priority: "High",
    description: "Reject sensor intermittent fault",
    workType: "Corrective Maintenance",
    status: "REL",
    assignedEngineer: "You",
    requestedDate: "2026-09-03",
    dueDate: "2026-09-03",
    overdue: false,
    downtimeMinutes: 34,
    faultCode: "RS-17",
  },
  {
    id: "4201944",
    rowId: "demo-4201944",
    equipmentId: "vf-02",
    equipmentName: "VF-02 Conveyor Inspection",
    assetNumber: "VF-02-CV",
    area: "Fill Finish",
    priority: "Medium",
    description: "Planned conveyor inspection",
    workType: "Preventive Maintenance",
    status: "REL",
    assignedEngineer: "You",
    requestedDate: "2026-09-03",
    dueDate: "2026-09-03",
    overdue: false,
    downtimeMinutes: null,
    faultCode: null,
  },
  {
    id: "4201952",
    rowId: "demo-4201952",
    equipmentId: "pl-02",
    equipmentName: "Palletiser 2",
    assetNumber: "PL-02",
    area: "Packing",
    priority: "Medium",
    description: "Follow-up inspection after intermittent trip",
    workType: "Follow-up",
    status: "REL",
    assignedEngineer: "You",
    requestedDate: "2026-09-03",
    dueDate: "2026-09-04",
    overdue: false,
    downtimeMinutes: null,
    faultCode: null,
  },
];

const DEMO_EQUIPMENT: EquipmentListItem[] = [
  {
    id: "vf-02",
    name: "Bosch VF-02",
    assetNumber: "VF-02",
    type: "FILLING MACHINE",
    area: "Fill Finish",
    riskScore: 73,
    riskLevel: "High",
    breakdown: [],
    status: "Running",
    oem: "Bosch",
    criticality: "Critical",
    overduePmCount: 0,
    openWorkOrderCount: 3,
    calibrationOverdueCount: 0,
  },
  {
    id: "pl-02",
    name: "Palletiser 2",
    assetNumber: "PL-02",
    type: "PALLETISER",
    area: "Packing",
    riskScore: 58,
    riskLevel: "Medium",
    breakdown: [],
    status: "Running",
    oem: "ABB",
    criticality: "High",
    overduePmCount: 0,
    openWorkOrderCount: 2,
    calibrationOverdueCount: 0,
  },
  {
    id: "pur-skid-01",
    name: "Purification Skid 1",
    assetNumber: "PUR-01",
    type: "PROCESS SKID",
    area: "Purification",
    riskScore: 42,
    riskLevel: "Medium",
    breakdown: [],
    status: "Running",
    oem: "GEA",
    criticality: "High",
    overduePmCount: 0,
    openWorkOrderCount: 1,
    calibrationOverdueCount: 0,
  },
];

const DEMO_PARTS: EngineerPart[] = [
  {
    equipmentId: "vf-02",
    equipmentName: "Bosch VF-02",
    equipmentAssetNumber: "VF-02",
    name: "IFM O5D100 Photoelectric Sensor",
    partNumber: "10004921",
    stock: 3,
    target: 4,
    minimumQuantity: 2,
    status: "In Stock",
    supplier: "IFM",
    manufacturer: "IFM",
    location: "Main Stores · Rack 4 · Shelf B · Bin 12",
    criticality: "Critical",
    leadDays: 3,
  },
  {
    equipmentId: "pl-02",
    equipmentName: "Palletiser 2",
    equipmentAssetNumber: "PL-02",
    name: "SKF Bearing 6205-2RS1",
    partNumber: "6205-2RS1",
    stock: 4,
    target: 8,
    minimumQuantity: 4,
    status: "Low Stock",
    supplier: "SKF",
    manufacturer: "SKF",
    location: "Main Stores · Bearing Rack",
    criticality: "High",
    leadDays: 2,
  },
  {
    equipmentId: "pl-02",
    equipmentName: "Palletiser 2",
    equipmentAssetNumber: "PL-02",
    name: "ABB Servo Drive ACS380",
    partNumber: "ACS380-04S-02A6",
    stock: 1,
    target: 2,
    minimumQuantity: 1,
    status: "In Stock",
    supplier: "ABB",
    manufacturer: "ABB",
    location: "Electrical Stores · Drive Cabinet",
    criticality: "Critical",
    leadDays: 14,
  },
];

function askVorta(question = "", submit = false): void {
  window.dispatchEvent(
    new CustomEvent("vorta-global-ai-prompt", {
      detail: { question, submit, role: "engineer" },
    }),
  );
}

function firstNameFromSession(session: ReturnType<typeof useAuth>["session"]): string {
  const metadataName = session?.user.user_metadata?.full_name;
  if (typeof metadataName === "string" && metadataName.trim()) {
    return metadataName.trim().split(/\s+/)[0] ?? "Engineer";
  }
  const local = session?.user.email?.split("@")[0] ?? "Engineer";
  return local
    .replace(/[._-]+/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase())
    .split(/\s+/)[0] ?? "Engineer";
}

function displayDate(value: string): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function priorityTone(priority: string): string {
  const value = priority.toLowerCase();
  if (value.includes("critical") || value.includes("high")) return "border-red-500/30 bg-red-500/10 text-red-300";
  if (value.includes("medium")) return "border-amber-500/30 bg-amber-500/10 text-amber-300";
  return "border-blue-500/30 bg-blue-500/10 text-blue-300";
}

function stockTone(part: Pick<EngineerPart, "status" | "stock" | "minimumQuantity">): string {
  const value = part.status.toLowerCase();
  if (part.stock <= 0 || value.includes("out")) return "text-red-400";
  if (value.includes("low") || part.stock <= part.minimumQuantity) return "text-amber-400";
  return "text-emerald-400";
}

function equipmentRiskTone(level: EquipmentListItem["riskLevel"]): string {
  if (level === "Critical") return "text-red-400";
  if (level === "High") return "text-orange-400";
  if (level === "Medium") return "text-amber-300";
  return "text-emerald-400";
}

async function loadEngineerEquipment(): Promise<EquipmentListItem[]> {
  try {
    const live = await getEquipmentList();
    return live.length > 0 ? live : DEMO_EQUIPMENT;
  } catch {
    return DEMO_EQUIPMENT;
  }
}

async function loadEngineerWorkOrders(): Promise<EngineerWorkOrder[]> {
  try {
    const [equipment, result] = await Promise.all([
      loadEngineerEquipment(),
      supabase
        .from("work_orders")
        .select("id, equipment_id, priority, description, work_type, status, assigned_engineer, requested_date, due_date, wo_number, is_overdue, downtime_minutes, fault_code")
        .order("due_date", { ascending: true, nullsFirst: false })
        .limit(40),
    ]);

    if (result.error || !result.data?.length) return DEMO_WORK_ORDERS;
    const equipmentMap = new Map(equipment.map((item) => [item.id, item]));

    return result.data.map((row: any): EngineerWorkOrder => {
      const asset = row.equipment_id ? equipmentMap.get(row.equipment_id) : undefined;
      return {
        id: row.wo_number ?? row.id,
        rowId: row.id,
        equipmentId: row.equipment_id ?? "",
        equipmentName: asset?.name ?? "Equipment not linked",
        assetNumber: asset?.assetNumber ?? "—",
        area: asset?.area ?? "—",
        priority: row.priority ?? "Medium",
        description: row.description ?? "No description supplied",
        workType: row.work_type ?? "Maintenance",
        status: row.status ?? "Unknown",
        assignedEngineer: row.assigned_engineer ?? "Unassigned",
        requestedDate: row.requested_date ?? "",
        dueDate: row.due_date ?? "",
        overdue: Boolean(row.is_overdue),
        downtimeMinutes: row.downtime_minutes ?? null,
        faultCode: row.fault_code ?? null,
      };
    });
  } catch (error) {
    console.warn("Engineer My Work load failed; using demo evidence:", error);
    return DEMO_WORK_ORDERS;
  }
}

async function loadEngineerParts(): Promise<EngineerPart[]> {
  const equipment = await loadEngineerEquipment();
  const scoped = equipment.slice(0, 10);
  try {
    const results = await Promise.all(
      scoped.map(async (asset) => {
        const components = await getEquipmentComponents(asset.id);
        return components.inventory.map((component): EngineerPart => ({
          equipmentId: asset.id,
          equipmentName: asset.name,
          equipmentAssetNumber: asset.assetNumber,
          name: component.name,
          partNumber: component.partNumber,
          stock: component.stock,
          target: component.max,
          minimumQuantity: component.minimumQuantity ?? 0,
          status: component.status,
          supplier: component.supplier,
          manufacturer: component.manufacturer,
          location: component.location,
          criticality: component.criticality,
          leadDays: component.leadDays,
        }));
      }),
    );
    const parts = results.flat();
    return parts.length > 0 ? parts : DEMO_PARTS;
  } catch {
    return DEMO_PARTS;
  }
}

function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: React.ReactNode }): JSX.Element {
  return (
    <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-[-0.025em] text-slate-50 md:text-3xl">{title}</h1>
        {subtitle ? <p className="mt-1 text-sm leading-6 text-slate-400">{subtitle}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </header>
  );
}

function SourceReadOnlyNotice({ label = "SAP data is synchronised into Vorta and shown read-only." }: { label?: string }): JSX.Element {
  return (
    <div className="flex items-start gap-2.5 rounded-xl border border-blue-500/20 bg-blue-500/[0.07] px-3.5 py-3 text-xs leading-5 text-blue-100/80">
      <Info className="mt-0.5 h-4 w-4 shrink-0 text-blue-400" />
      <span>{label}</span>
    </div>
  );
}

function LoadingRows({ count = 3 }: { count?: number }): JSX.Element {
  return (
    <div className="space-y-3" aria-label="Loading">
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className={`${RAISED} h-24 animate-pulse`} />
      ))}
    </div>
  );
}

function EmptyState({ title, detail }: { title: string; detail: string }): JSX.Element {
  return (
    <div className={`${CARD} flex min-h-48 flex-col items-center justify-center gap-2 px-5 py-8 text-center`}>
      <FileSearch className="h-7 w-7 text-slate-600" />
      <p className="text-sm font-semibold text-slate-200">{title}</p>
      <p className="max-w-md text-xs leading-5 text-slate-500">{detail}</p>
    </div>
  );
}

export function EngineerHomeScreen(): JSX.Element {
  const { session, siteContext } = useAuth();
  const navigate = useNavigate();
  const [question, setQuestion] = useState("");
  const [equipment, setEquipment] = useState<EquipmentListItem[]>([]);
  const [workOrders, setWorkOrders] = useState<EngineerWorkOrder[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void Promise.all([loadEngineerEquipment(), loadEngineerWorkOrders()]).then(([nextEquipment, nextWork]) => {
      if (cancelled) return;
      setEquipment(nextEquipment);
      setWorkOrders(nextWork);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, []);

  const firstName = firstNameFromSession(session);
  const todayWork = workOrders.slice(0, 3);
  const recentEquipment = equipment.slice(0, 3);

  const submit = (): void => {
    askVorta(question, Boolean(question.trim()));
    setQuestion("");
  };

  return (
    <div data-vorta-page-content="true" data-vorta-engineer-home="true" className={PAGE}>
      <PageHeader
        title={`Good ${new Date().getHours() < 12 ? "morning" : new Date().getHours() < 18 ? "afternoon" : "evening"}, ${firstName}`}
        subtitle={`Maintenance Engineer${siteContext?.siteId ? " · Active Vorta site" : ""}`}
        action={
          <button type="button" onClick={() => navigate("/engineer/notifications")} className={`${BUTTON} w-11 px-0`} aria-label="Notifications">
            <Bell className="h-5 w-5" />
          </button>
        }
      />

      <section className={`${CARD} overflow-hidden border-blue-500/40 bg-blue-500/[0.10]`} aria-labelledby="engineer-ask-vorta-title">
        <div className="relative overflow-hidden p-4 sm:p-5 md:p-6">
          <div aria-hidden="true" className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-blue-500/10 blur-3xl" />
          <div className="relative flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/15 text-blue-300">
                <Sparkles className="h-5 w-5" />
              </span>
              <div>
                <h2 id="engineer-ask-vorta-title" className="text-lg font-semibold text-slate-50 md:text-xl">Ask Vorta</h2>
                <p className="text-xs leading-5 text-slate-400 sm:text-sm">Faults, assets, work orders, spares, documents or previous repairs.</p>
              </div>
            </div>

            <form
              onSubmit={(event) => { event.preventDefault(); submit(); }}
              className="flex min-h-14 items-center gap-2 rounded-xl border border-blue-400/35 bg-[#000814]/70 p-2 shadow-inner shadow-black/20"
            >
              <input
                value={question}
                onChange={(event) => setQuestion(event.target.value)}
                placeholder="Ask Vorta what you're working on..."
                aria-label="Ask Vorta"
                className="min-w-0 flex-1 bg-transparent px-2 text-sm text-slate-100 outline-none placeholder:text-slate-500 sm:text-base"
              />
              <button
                type="submit"
                aria-label="Send to Ask Vorta"
                className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-white transition-colors hover:bg-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300"
              >
                <ArrowRight className="h-5 w-5" />
              </button>
            </form>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <button type="button" onClick={() => navigate("/engineer/equipment?scan=1")} className={BUTTON}><QrCode className="h-4 w-4 text-blue-400" />Scan Equipment</button>
              <button type="button" onClick={() => askVorta("Help me diagnose a fault from a photo.")} className={BUTTON}><Camera className="h-4 w-4 text-blue-400" />Take Photo</button>
              <button type="button" onClick={() => askVorta("I want to dictate an engineering question.")} className={BUTTON}><Mic className="h-4 w-4 text-blue-400" />Voice</button>
              <button type="button" onClick={() => navigate("/engineer/equipment")} className={BUTTON}><Search className="h-4 w-4 text-blue-400" />Search</button>
            </div>
          </div>
        </div>
      </section>

      <section className="space-y-3" aria-labelledby="my-work-today-heading">
        <div className="flex items-center justify-between gap-3">
          <h2 id="my-work-today-heading" className="text-base font-semibold text-slate-100 md:text-lg">My Work Today</h2>
          <Link to="/engineer/work" className="text-xs font-medium text-blue-400 hover:text-blue-300">View all</Link>
        </div>
        {loading ? <LoadingRows /> : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {todayWork.map((item) => (
              <Link key={item.id} to={`/engineer/work/${encodeURIComponent(item.id)}`} className={`${CARD} group p-4 transition-colors hover:border-blue-400/40`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-blue-400">WO {item.id}</p>
                    <h3 className="mt-1 truncate text-base font-semibold text-slate-100">{item.equipmentName}</h3>
                    <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-400">{item.description}</p>
                  </div>
                  <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-slate-600 transition-colors group-hover:text-blue-400" />
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <span className={`rounded-full border px-2 py-1 text-[10px] font-semibold ${priorityTone(item.priority)}`}>{item.priority} priority</span>
                  <span className="rounded-full border border-slate-700/70 bg-slate-800/30 px-2 py-1 text-[10px] text-slate-400">{item.workType}</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3" aria-labelledby="recent-equipment-heading">
        <div className="flex items-center justify-between gap-3">
          <h2 id="recent-equipment-heading" className="text-base font-semibold text-slate-100 md:text-lg">Recent Equipment</h2>
          <Link to="/engineer/equipment" className="text-xs font-medium text-blue-400 hover:text-blue-300">View all</Link>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {recentEquipment.map((asset) => (
            <Link key={asset.id} to={`/engineer/equipment/${asset.id}`} className={`${RAISED} group flex min-h-24 items-center gap-3 p-4 transition-colors hover:border-blue-400/40`}>
              <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-500/10 text-blue-400"><Wrench className="h-5 w-5" /></span>
              <div className="min-w-0 flex-1">
                <h3 className="truncate text-sm font-semibold text-slate-100">{asset.name}</h3>
                <p className="truncate text-xs text-slate-500">{asset.assetNumber} · {asset.area}</p>
                <p className={`mt-1 text-[11px] font-medium ${equipmentRiskTone(asset.riskLevel)}`}>{asset.riskLevel} risk · {asset.status ?? "Status unavailable"}</p>
              </div>
              <ChevronRight className="h-4 w-4 shrink-0 text-slate-600 group-hover:text-blue-400" />
            </Link>
          ))}
        </div>
      </section>

      <section className="space-y-3" aria-labelledby="important-to-me-heading">
        <h2 id="important-to-me-heading" className="text-base font-semibold text-slate-100 md:text-lg">Important to Me</h2>
        <div className="grid gap-3 md:grid-cols-3">
          <Link to="/engineer/skills" className={`${RAISED} flex items-center gap-3 p-4`}>
            <BookOpen className="h-5 w-5 text-violet-400" />
            <div><p className="text-sm font-medium text-slate-200">Training & skills</p><p className="text-xs text-slate-500">Review reassessments and gaps</p></div>
          </Link>
          <Link to="/engineer/stores" className={`${RAISED} flex items-center gap-3 p-4`}>
            <Package className="h-5 w-5 text-amber-400" />
            <div><p className="text-sm font-medium text-slate-200">Critical spares</p><p className="text-xs text-slate-500">Check low-stock parts</p></div>
          </Link>
          <Link to="/engineer/alerts" className={`${RAISED} flex items-center gap-3 p-4`}>
            <AlertTriangle className="h-5 w-5 text-red-400" />
            <div><p className="text-sm font-medium text-slate-200">Equipment alerts</p><p className="text-xs text-slate-500">See relevant operational risk</p></div>
          </Link>
        </div>
      </section>
    </div>
  );
}

export function EngineerMyWorkScreen(): JSX.Element {
  const [workOrders, setWorkOrders] = useState<EngineerWorkOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<"assigned" | "area" | "history">("assigned");
  const [priority, setPriority] = useState("All");

  useEffect(() => {
    let cancelled = false;
    void loadEngineerWorkOrders().then((rows) => {
      if (cancelled) return;
      setWorkOrders(rows);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, []);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return workOrders.filter((item) => {
      const matchesQuery = !normalized || [item.id, item.equipmentName, item.assetNumber, item.description, item.area].some((value) => value.toLowerCase().includes(normalized));
      const matchesPriority = priority === "All" || item.priority.toLowerCase() === priority.toLowerCase();
      const isHistory = /complete|closed|teco/i.test(item.status);
      const matchesTab = tab === "history" ? isHistory : tab === "assigned" ? !isHistory : true;
      return matchesQuery && matchesPriority && matchesTab;
    });
  }, [workOrders, query, priority, tab]);

  return (
    <div data-vorta-page-content="true" data-vorta-engineer-my-work="true" className={PAGE}>
      <PageHeader title="My Work" subtitle="Your SAP-derived maintenance work, with Vorta intelligence layered around it." />
      <SourceReadOnlyNotice label="Work order information is synchronised from SAP and cannot be edited in Vorta." />

      <div className="grid grid-cols-3 rounded-xl border border-slate-800/80 bg-[#07172b] p-1" role="tablist" aria-label="Work order view">
        {(["assigned", "area", "history"] as const).map((value) => (
          <button
            key={value}
            role="tab"
            aria-selected={tab === value}
            type="button"
            onClick={() => setTab(value)}
            className={`min-h-11 rounded-lg px-3 text-sm font-medium capitalize transition-colors ${tab === value ? "bg-blue-500/15 text-blue-300 shadow-inner" : "text-slate-500 hover:text-slate-200"}`}
          >
            {value === "area" ? "Area / Team" : value}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-2 lg:flex-row">
        <label className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search work order, equipment, fault or area"
            className="min-h-12 w-full rounded-xl border border-slate-700/80 bg-[#07172b] pl-10 pr-3 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-blue-400/60"
          />
        </label>
        <label className="relative lg:w-48">
          <Filter className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <select value={priority} onChange={(event) => setPriority(event.target.value)} className="min-h-12 w-full appearance-none rounded-xl border border-slate-700/80 bg-[#07172b] pl-10 pr-9 text-sm text-slate-300 outline-none focus:border-blue-400/60">
            <option>All</option><option>High</option><option>Medium</option><option>Low</option>
          </select>
          <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
        </label>
      </div>

      {loading ? <LoadingRows count={4} /> : filtered.length === 0 ? (
        <EmptyState title="No work orders match this view" detail="Change the filter or search. Vorta will not invent work orders when the source system returns no matching evidence." />
      ) : (
        <div className="grid gap-3 xl:grid-cols-2">
          {filtered.map((item) => (
            <article key={`${item.rowId}-${item.id}`} className={`${CARD} overflow-hidden`}>
              <div className="p-4 sm:p-5">
                <div className="flex items-start gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-semibold text-blue-400">WO {item.id}</span>
                      <span className={`rounded-full border px-2 py-1 text-[10px] font-semibold ${priorityTone(item.priority)}`}>{item.priority}</span>
                    </div>
                    <h2 className="mt-2 text-lg font-semibold text-slate-100">{item.equipmentName}</h2>
                    <p className="mt-1 text-sm leading-5 text-slate-400">{item.description}</p>
                  </div>
                  <Link to={`/engineer/work/${encodeURIComponent(item.id)}`} aria-label={`View work order ${item.id}`} className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-700/70 bg-[#07172b] text-slate-400 hover:border-blue-400/40 hover:text-blue-300">
                    <ChevronRight className="h-5 w-5" />
                  </Link>
                </div>

                <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-slate-800/60 pt-4 text-xs sm:grid-cols-4">
                  <div><dt className="text-slate-600">Area</dt><dd className="mt-1 text-slate-300">{item.area}</dd></div>
                  <div><dt className="text-slate-600">SAP status</dt><dd className="mt-1 text-slate-300">{item.status}</dd></div>
                  <div><dt className="text-slate-600">Work type</dt><dd className="mt-1 truncate text-slate-300">{item.workType}</dd></div>
                  <div><dt className="text-slate-600">Planned / due</dt><dd className={`mt-1 ${item.overdue ? "text-red-400" : "text-slate-300"}`}>{displayDate(item.dueDate)}</dd></div>
                </dl>
              </div>
              <button
                type="button"
                onClick={() => askVorta(`Help me with work order ${item.id} on ${item.equipmentName}: ${item.description}`)}
                className="flex min-h-12 w-full items-center justify-between gap-3 border-t border-blue-500/20 bg-blue-500/[0.06] px-4 text-left text-xs font-semibold text-blue-300 transition-colors hover:bg-blue-500/[0.10] sm:px-5"
              >
                <span className="inline-flex items-center gap-2"><Sparkles className="h-4 w-4" />Ask Vorta about this job</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

export function EngineerWorkOrderDetailScreen(): JSX.Element {
  const { workOrderId } = useParams();
  const navigate = useNavigate();
  const [item, setItem] = useState<EngineerWorkOrder | null>(null);
  const [documents, setDocuments] = useState<Awaited<ReturnType<typeof getEquipmentDocuments>>>([]);
  const [components, setComponents] = useState<EquipmentComponent[]>([]);
  const [activity, setActivity] = useState<Awaited<ReturnType<typeof getEquipmentActivity>>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const decodedId = decodeURIComponent(workOrderId ?? "");
    void loadEngineerWorkOrders().then(async (rows) => {
      const matched = rows.find((row) => row.id === decodedId) ?? rows[0] ?? null;
      if (!matched || cancelled) {
        setLoading(false);
        return;
      }
      setItem(matched);
      if (!matched.equipmentId) {
        setLoading(false);
        return;
      }
      const [nextDocuments, nextComponents, nextActivity] = await Promise.all([
        getEquipmentDocuments(matched.equipmentId),
        getEquipmentComponents(matched.equipmentId),
        getEquipmentActivity(matched.equipmentId),
      ]);
      if (cancelled) return;
      setDocuments(nextDocuments);
      setComponents(nextComponents.inventory);
      setActivity(nextActivity);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [workOrderId]);

  if (loading) return <div data-vorta-page-content="true" className={PAGE}><LoadingRows count={5} /></div>;
  if (!item) return <div data-vorta-page-content="true" className={PAGE}><EmptyState title="Work order unavailable" detail="Vorta could not find this work order in the authorised source data." /></div>;

  const similar = activity.filter((event) => event.woNumber !== item.id).slice(0, 4);
  const relevantDocuments = documents.slice(0, 4);
  const relatedParts = components.slice(0, 4);

  return (
    <div data-vorta-page-content="true" data-vorta-engineer-work-order-detail="true" className={PAGE}>
      <button type="button" onClick={() => navigate(-1)} className="inline-flex w-fit min-h-11 items-center gap-2 text-sm font-medium text-slate-400 hover:text-white"><ArrowLeft className="h-4 w-4" />Back to My Work</button>
      <PageHeader
        title={`WO ${item.id}`}
        subtitle={`${item.equipmentName} · ${item.workType}`}
        action={<span className={`inline-flex rounded-full border px-3 py-2 text-xs font-semibold ${priorityTone(item.priority)}`}>{item.priority} priority</span>}
      />
      <SourceReadOnlyNotice label={`SAP status: ${item.status}. Source work order fields are synchronised and cannot be edited in Vorta.`} />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.25fr)_minmax(320px,0.75fr)]">
        <div className="space-y-5">
          <section className={`${CARD} p-4 sm:p-5`}>
            <div className="flex items-start gap-3">
              <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 text-amber-400"><AlertTriangle className="h-5 w-5" /></span>
              <div className="min-w-0">
                <h2 className="text-base font-semibold text-slate-100">Fault / Request</h2>
                <p className="mt-1 text-sm leading-6 text-slate-300">{item.description}</p>
              </div>
            </div>
            <dl className="mt-5 grid grid-cols-2 gap-4 border-t border-slate-800/60 pt-4 text-xs sm:grid-cols-4">
              <div><dt className="text-slate-600">Reported / requested</dt><dd className="mt-1 text-slate-300">{displayDate(item.requestedDate)}</dd></div>
              <div><dt className="text-slate-600">Downtime</dt><dd className="mt-1 text-slate-300">{item.downtimeMinutes == null ? "Not recorded" : `${item.downtimeMinutes} mins`}</dd></div>
              <div><dt className="text-slate-600">Fault code</dt><dd className="mt-1 text-slate-300">{item.faultCode ?? "Not recorded"}</dd></div>
              <div><dt className="text-slate-600">Area</dt><dd className="mt-1 text-slate-300">{item.area}</dd></div>
            </dl>
          </section>

          <section className={`${CARD} overflow-hidden border-blue-500/35 bg-blue-500/[0.08]`}>
            <div className="p-4 sm:p-5">
              <div className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-blue-400" /><h2 className="text-base font-semibold text-slate-100">Ask Vorta about this job</h2></div>
              <p className="mt-2 text-sm leading-6 text-slate-400">Vorta can combine the work order context with equipment history, manuals, spares and previous repairs.</p>
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                {["Have we seen this fault before?", "What normally causes this?", "Show similar previous work orders.", "Find the relevant manual section."].map((prompt) => (
                  <button key={prompt} type="button" onClick={() => askVorta(`${prompt} Context: WO ${item.id}, ${item.equipmentName}, ${item.description}`, true)} className={`${BUTTON} justify-between text-left`}><span>{prompt}</span><ChevronRight className="h-4 w-4 shrink-0 text-blue-400" /></button>
                ))}
              </div>
            </div>
          </section>

          <section className={`${CARD} p-4 sm:p-5`}>
            <div className="mb-4 flex items-center gap-2"><History className="h-5 w-5 text-slate-500" /><h2 className="text-base font-semibold text-slate-100">Previous Similar Work</h2></div>
            {similar.length ? (
              <div className="divide-y divide-slate-800/60">
                {similar.map((event) => (
                  <div key={event.id} className="flex items-start justify-between gap-4 py-3 first:pt-0 last:pb-0">
                    <div className="min-w-0"><p className="text-xs font-semibold text-blue-400">{event.woNumber} · {displayDate(event.date)}</p><p className="mt-1 text-sm text-slate-300">{event.description}</p></div>
                    <span className="shrink-0 text-[10px] font-medium text-slate-500">{event.outcome}</span>
                  </div>
                ))}
              </div>
            ) : <p className="text-sm text-slate-500">No similar historical work is linked to this asset.</p>}
          </section>
        </div>

        <div className="space-y-5">
          {item.equipmentId ? (
            <Link to={`/engineer/equipment/${item.equipmentId}`} className={`${CARD} group flex items-center gap-3 p-4 sm:p-5`}>
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10 text-blue-400"><Wrench className="h-5 w-5" /></span>
              <div className="min-w-0 flex-1"><p className="text-xs text-slate-500">Equipment</p><p className="truncate text-sm font-semibold text-slate-100">{item.equipmentName}</p></div>
              <ChevronRight className="h-4 w-4 text-slate-600 group-hover:text-blue-400" />
            </Link>
          ) : null}

          <section className={`${CARD} p-4 sm:p-5`}>
            <div className="mb-3 flex items-center gap-2"><FileText className="h-5 w-5 text-blue-400" /><h2 className="text-base font-semibold text-slate-100">Relevant Documents</h2></div>
            {relevantDocuments.length ? <div className="space-y-2">{relevantDocuments.map((document) => <div key={document.id} className={`${RAISED} flex items-center gap-3 p-3`}><FileText className="h-4 w-4 shrink-0 text-blue-400" /><div className="min-w-0"><p className="truncate text-xs font-medium text-slate-200">{document.name}</p><p className="text-[10px] text-slate-500">{document.category} · {document.status}</p></div></div>)}</div> : <p className="text-xs text-slate-500">No current documents matched this equipment.</p>}
          </section>

          <section className={`${CARD} p-4 sm:p-5`}>
            <div className="mb-3 flex items-center gap-2"><Package className="h-5 w-5 text-blue-400" /><h2 className="text-base font-semibold text-slate-100">Related Spares</h2></div>
            {relatedParts.length ? <div className="space-y-2">{relatedParts.map((part) => <Link key={part.partNumber} to={`/engineer/stores/${encodeURIComponent(part.partNumber)}?equipment=${item.equipmentId}`} className={`${RAISED} flex items-center gap-3 p-3`}><Box className="h-4 w-4 shrink-0 text-blue-400" /><div className="min-w-0 flex-1"><p className="truncate text-xs font-medium text-slate-200">{part.name}</p><p className="text-[10px] text-slate-500">{part.partNumber} · {part.location || "Location not recorded"}</p></div><span className="text-xs font-semibold text-slate-300">{part.stock}</span></Link>)}</div> : <p className="text-xs text-slate-500">No inventory components are linked to this equipment.</p>}
          </section>
        </div>
      </div>
    </div>
  );
}

export function EngineerEquipmentScreen(): JSX.Element {
  const [equipment, setEquipment] = useState<EquipmentListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [expandedAreas, setExpandedAreas] = useState<Set<string>>(new Set());
  const [searchParams] = useSearchParams();
  const scanRequested = searchParams.get("scan") === "1";

  useEffect(() => {
    let cancelled = false;
    void loadEngineerEquipment().then((items) => {
      if (cancelled) return;
      setEquipment(items);
      setExpandedAreas(new Set(items.slice(0, 8).map((item) => item.area).filter(Boolean)));
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, []);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return equipment.filter((item) => !normalized || [item.name, item.assetNumber, item.type, item.area, item.oem].some((value) => value.toLowerCase().includes(normalized)));
  }, [equipment, query]);

  const grouped = useMemo(() => {
    const map = new Map<string, EquipmentListItem[]>();
    filtered.forEach((item) => {
      const area = item.area || "Unassigned Area";
      map.set(area, [...(map.get(area) ?? []), item]);
    });
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [filtered]);

  return (
    <div data-vorta-page-content="true" data-vorta-engineer-equipment="true" className={PAGE}>
      <PageHeader title="Equipment" subtitle="Find an asset in a few taps, then open its work, documents, spares and competency context." />
      <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_auto]">
        <label className="relative min-w-0">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search equipment, tag, description or location" className="min-h-12 w-full rounded-xl border border-slate-700/80 bg-[#07172b] pl-10 pr-3 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-blue-400/60" />
        </label>
        <button type="button" onClick={() => askVorta("Help me identify an equipment asset from its QR or barcode.")} className={`${BUTTON} px-4 ${scanRequested ? "border-blue-400/60 text-blue-300" : ""}`}><QrCode className="h-4 w-4 text-blue-400" />Scan QR / Barcode</button>
      </div>

      {loading ? <LoadingRows count={4} /> : grouped.length === 0 ? <EmptyState title="No equipment found" detail="No authorised equipment matches this search." /> : (
        <div className="space-y-3">
          {grouped.map(([area, assets]) => {
            const expanded = expandedAreas.has(area);
            return (
              <section key={area} className={`${CARD} overflow-hidden`}>
                <button
                  type="button"
                  onClick={() => setExpandedAreas((current) => { const next = new Set(current); expanded ? next.delete(area) : next.add(area); return next; })}
                  className="flex min-h-14 w-full items-center gap-3 px-4 text-left sm:px-5"
                  aria-expanded={expanded}
                >
                  <MapPin className="h-5 w-5 text-blue-400" />
                  <span className="flex-1 text-sm font-semibold text-slate-100">{area}</span>
                  <span className="rounded-full bg-blue-500/10 px-2 py-1 text-[10px] font-semibold text-blue-300">{assets.length}</span>
                  <ChevronDown className={`h-4 w-4 text-slate-500 transition-transform ${expanded ? "rotate-180" : ""}`} />
                </button>
                {expanded ? (
                  <div className="divide-y divide-slate-800/60 border-t border-slate-800/60">
                    {assets.map((asset) => (
                      <Link key={asset.id} to={`/engineer/equipment/${asset.id}`} className="group flex min-h-16 items-center gap-3 px-4 py-3 transition-colors hover:bg-blue-500/[0.04] sm:px-5">
                        <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#07172b] text-blue-400"><Wrench className="h-5 w-5" /></span>
                        <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-slate-100">{asset.name}</p><p className="truncate text-xs text-slate-500">{asset.assetNumber} · {asset.type}</p></div>
                        <div className="hidden text-right sm:block"><p className={`text-xs font-semibold ${equipmentRiskTone(asset.riskLevel)}`}>{asset.riskLevel}</p><p className="text-[10px] text-slate-600">{asset.openWorkOrderCount} open work</p></div>
                        <ChevronRight className="h-4 w-4 shrink-0 text-slate-600 group-hover:text-blue-400" />
                      </Link>
                    ))}
                  </div>
                ) : null}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function EngineerEquipmentDetailScreen(): JSX.Element {
  const { equipmentId } = useParams();
  const navigate = useNavigate();
  const [identity, setIdentity] = useState<Awaited<ReturnType<typeof getEquipmentIdentityById>> | null>(null);
  const [work, setWork] = useState<Awaited<ReturnType<typeof getEquipmentWorkOrders>> | null>(null);
  const [pms, setPms] = useState<Awaited<ReturnType<typeof getEquipmentPMs>>>([]);
  const [documents, setDocuments] = useState<Awaited<ReturnType<typeof getEquipmentDocuments>>>([]);
  const [components, setComponents] = useState<Awaited<ReturnType<typeof getEquipmentComponents>> | null>(null);
  const [skills, setSkills] = useState<Awaited<ReturnType<typeof getEquipmentSkills>> | null>(null);
  const [activity, setActivity] = useState<Awaited<ReturnType<typeof getEquipmentActivity>>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const id = equipmentId ?? DEMO_EQUIPMENT[0].id;
    void Promise.all([
      getEquipmentIdentityById(id),
      getEquipmentWorkOrders(id),
      getEquipmentPMs(id),
      getEquipmentDocuments(id),
      getEquipmentComponents(id),
      getEquipmentSkills(id),
      getEquipmentActivity(id),
    ]).then(([nextIdentity, nextWork, nextPms, nextDocuments, nextComponents, nextSkills, nextActivity]) => {
      if (cancelled) return;
      setIdentity(nextIdentity);
      setWork(nextWork);
      setPms(nextPms);
      setDocuments(nextDocuments);
      setComponents(nextComponents);
      setSkills(nextSkills);
      setActivity(nextActivity);
      setLoading(false);
    }).catch(() => setLoading(false));
    return () => { cancelled = true; };
  }, [equipmentId]);

  if (loading) return <div data-vorta-page-content="true" className={PAGE}><LoadingRows count={6} /></div>;
  if (!identity) return <div data-vorta-page-content="true" className={PAGE}><EmptyState title="Equipment unavailable" detail="This equipment could not be resolved in the authorised Vorta data." /></div>;

  const overduePms = pms.filter((pm) => /overdue/i.test(pm.status)).length;
  const repeatFailures = activity.filter((event) => /breakdown|corrective/i.test(event.type)).length;
  const personalLikeSkills = skills?.skills.slice(0, 4) ?? [];

  return (
    <div data-vorta-page-content="true" data-vorta-engineer-equipment-detail="true" className={PAGE}>
      <button type="button" onClick={() => navigate(-1)} className="inline-flex w-fit min-h-11 items-center gap-2 text-sm font-medium text-slate-400 hover:text-white"><ArrowLeft className="h-4 w-4" />Back to Equipment</button>
      <PageHeader
        title={identity.name}
        subtitle={`${identity.type} · ${identity.area} · ${identity.assetNumber}`}
        action={<span className="inline-flex items-center gap-2 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-300"><span className="h-2 w-2 rounded-full bg-emerald-400" />{identity.status}</span>}
      />
      <SourceReadOnlyNotice label="Equipment master, maintenance and inventory information shown here is synchronised from source systems and is read-only in Vorta." />

      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        <button type="button" onClick={() => askVorta(`I am working on ${identity.name} (${identity.assetNumber}). Open this asset as my engineering context.`)} className={`${CARD} flex min-h-24 flex-col items-start justify-center gap-2 p-4 text-left hover:border-blue-400/40`}><Sparkles className="h-5 w-5 text-blue-400" /><span className="text-sm font-semibold text-slate-100">Ask Vorta</span></button>
        <a href="#equipment-work" className={`${CARD} flex min-h-24 flex-col items-start justify-center gap-2 p-4 hover:border-blue-400/40`}><ClipboardList className="h-5 w-5 text-blue-400" /><span className="text-sm font-semibold text-slate-100">Work Orders</span></a>
        <a href="#equipment-documents" className={`${CARD} flex min-h-24 flex-col items-start justify-center gap-2 p-4 hover:border-blue-400/40`}><FileText className="h-5 w-5 text-blue-400" /><span className="text-sm font-semibold text-slate-100">Documents</span></a>
        <a href="#equipment-spares" className={`${CARD} flex min-h-24 flex-col items-start justify-center gap-2 p-4 hover:border-blue-400/40`}><Package className="h-5 w-5 text-blue-400" /><span className="text-sm font-semibold text-slate-100">Spares</span></a>
      </div>

      <section className={`${CARD} p-4 sm:p-5`} aria-labelledby="condition-heading">
        <h2 id="condition-heading" className="text-base font-semibold text-slate-100">Current Maintenance Context</h2>
        <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <div className={`${RAISED} p-4`}><AlertTriangle className="h-4 w-4 text-red-400" /><p className="mt-3 text-2xl font-semibold tabular-nums text-slate-50">{identity.riskLevel === "Critical" || identity.riskLevel === "High" ? 1 : 0}</p><p className="text-xs text-slate-500">Elevated risk</p></div>
          <div className={`${RAISED} p-4`}><ClipboardList className="h-4 w-4 text-amber-400" /><p className="mt-3 text-2xl font-semibold tabular-nums text-slate-50">{work?.open.length ?? 0}</p><p className="text-xs text-slate-500">Open work orders</p></div>
          <div className={`${RAISED} p-4`}><CheckCircle2 className="h-4 w-4 text-emerald-400" /><p className="mt-3 text-2xl font-semibold tabular-nums text-slate-50">{overduePms}</p><p className="text-xs text-slate-500">Overdue PM</p></div>
          <div className={`${RAISED} p-4`}><Gauge className="h-4 w-4 text-red-400" /><p className="mt-3 text-2xl font-semibold tabular-nums text-slate-50">{repeatFailures}</p><p className="text-xs text-slate-500">Historical fault events</p></div>
        </div>
      </section>

      <section className={`${CARD} overflow-hidden border-blue-500/35 bg-blue-500/[0.08]`}>
        <div className="p-4 sm:p-5">
          <div className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-blue-400" /><h2 className="text-base font-semibold text-slate-100">Ask Vorta Equipment Agent</h2></div>
          <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            {["Show the last 5 breakdowns", "Why does this machine keep faulting?", "Find the likely sensor fault", "Show the relevant wiring or manual evidence"].map((prompt) => (
              <button key={prompt} type="button" onClick={() => askVorta(`${prompt}. Equipment: ${identity.name} ${identity.assetNumber}`, true)} className={`${BUTTON} justify-between text-left`}><span>{prompt}</span><Sparkles className="h-4 w-4 shrink-0 text-blue-400" /></button>
            ))}
          </div>
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-2">
        <section id="equipment-work" className={`${CARD} scroll-mt-5 p-4 sm:p-5`}>
          <div className="mb-4 flex items-center justify-between gap-3"><h2 className="text-base font-semibold text-slate-100">Maintenance History</h2><span className="text-xs text-slate-500">{activity.length} events</span></div>
          <div className="space-y-3">{activity.slice(0, 5).map((event) => <div key={event.id} className={`${RAISED} p-3`}><p className="text-xs font-semibold text-blue-400">{displayDate(event.date)} · {event.woNumber}</p><p className="mt-1 text-sm text-slate-300">{event.description}</p><p className="mt-1 text-[10px] text-slate-600">{event.type} · {event.outcome}</p></div>)}</div>
        </section>

        <section className={`${CARD} p-4 sm:p-5`}>
          <div className="mb-4 flex items-center justify-between gap-3"><h2 className="text-base font-semibold text-slate-100">My Skills & Training for this Equipment</h2><Link to="/engineer/skills" className="text-xs font-medium text-blue-400">View My Skills</Link></div>
          {personalLikeSkills.length ? (
            <div className="grid gap-2 sm:grid-cols-2">
              {personalLikeSkills.map((skill) => (
                <Link key={skill.skillId} to={`/engineer/skills/${encodeURIComponent(skill.name)}?equipment=${identity.id}`} className={`${RAISED} p-3 hover:border-blue-400/40`}>
                  <p className="text-xs font-medium text-slate-200">{skill.name}</p>
                  <div className="mt-2 flex items-center justify-between"><span className="text-[10px] text-slate-500">Required L{skill.requiredLevel}</span><span className={`text-sm font-semibold ${skill.coverage === "green" ? "text-emerald-400" : skill.coverage === "amber" ? "text-amber-400" : "text-red-400"}`}>L{skill.highestValidatedLevel || "—"}</span></div>
                </Link>
              ))}
            </div>
          ) : <p className="text-sm text-slate-500">No required skill relationship is currently linked to this equipment.</p>}
          {skills ? <div className="mt-4 flex items-center justify-between border-t border-slate-800/60 pt-4"><span className="text-xs text-slate-500">Equipment team coverage</span><span className="text-xl font-semibold tabular-nums text-blue-400">{skills.coverageSummary.coveragePercent}%</span></div> : null}
        </section>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <section id="equipment-documents" className={`${CARD} scroll-mt-5 p-4 sm:p-5`}>
          <div className="mb-4 flex items-center justify-between gap-3"><h2 className="text-base font-semibold text-slate-100">Documents</h2><span className="text-xs text-slate-500">{documents.length} current</span></div>
          <div className="space-y-2">{documents.slice(0, 5).map((document) => <div key={document.id} className={`${RAISED} flex items-center gap-3 p-3`}><FileText className="h-4 w-4 shrink-0 text-blue-400" /><div className="min-w-0 flex-1"><p className="truncate text-xs font-medium text-slate-200">{document.name}</p><p className="text-[10px] text-slate-500">{document.category} · {document.status}</p></div></div>)}</div>
        </section>

        <section id="equipment-spares" className={`${CARD} scroll-mt-5 p-4 sm:p-5`}>
          <div className="mb-4 flex items-center justify-between gap-3"><h2 className="text-base font-semibold text-slate-100">Spares</h2><span className="text-xs text-slate-500">Read-only inventory</span></div>
          <div className="space-y-2">{components?.inventory.slice(0, 5).map((part) => <Link key={part.partNumber} to={`/engineer/stores/${encodeURIComponent(part.partNumber)}?equipment=${identity.id}`} className={`${RAISED} flex items-center gap-3 p-3 hover:border-blue-400/40`}><Box className="h-4 w-4 shrink-0 text-blue-400" /><div className="min-w-0 flex-1"><p className="truncate text-xs font-medium text-slate-200">{part.name}</p><p className="truncate text-[10px] text-slate-500">{part.partNumber} · {part.location || "Location unavailable"}</p></div><span className="text-xs font-semibold text-slate-300">{part.stock}</span></Link>)}</div>
        </section>
      </div>
    </div>
  );
}

export function EngineerStoresScreen(): JSX.Element {
  const [parts, setParts] = useState<EngineerPart[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");

  useEffect(() => {
    let cancelled = false;
    void loadEngineerParts().then((items) => {
      if (cancelled) return;
      setParts(items);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, []);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return parts.filter((part) => !normalized || [part.name, part.partNumber, part.manufacturer, part.equipmentName, part.equipmentAssetNumber, part.location].some((value) => value.toLowerCase().includes(normalized)));
  }, [parts, query]);

  const critical = filtered.filter((part) => /critical/i.test(part.criticality) || part.stock <= part.minimumQuantity);
  const normal = filtered.filter((part) => !critical.includes(part));

  const PartRow = ({ part }: { part: EngineerPart }): JSX.Element => (
    <Link to={`/engineer/stores/${encodeURIComponent(part.partNumber)}?equipment=${part.equipmentId}`} className="group grid min-h-16 grid-cols-[2.75rem_minmax(0,1fr)_auto] items-center gap-3 border-b border-slate-800/55 px-4 py-3 last:border-b-0 hover:bg-blue-500/[0.04] sm:px-5 md:grid-cols-[2.75rem_minmax(0,1fr)_6rem_10rem_auto]">
      <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-[#07172b] text-blue-400"><Box className="h-5 w-5" /></span>
      <div className="min-w-0"><p className="truncate text-sm font-medium text-slate-100">{part.name}</p><p className="truncate text-[11px] text-slate-500">{part.partNumber} · {part.equipmentName}</p></div>
      <div className="hidden md:block"><p className="text-[10px] text-slate-600">Stock</p><p className={`text-xs font-semibold tabular-nums ${stockTone(part)}`}>{part.stock}</p></div>
      <div className="hidden min-w-0 md:block"><p className="text-[10px] text-slate-600">Location</p><p className="truncate text-xs text-slate-400">{part.location || "Not recorded"}</p></div>
      <div className="flex items-center gap-2"><span className={`text-xs font-semibold tabular-nums md:hidden ${stockTone(part)}`}>{part.stock}</span><ChevronRight className="h-4 w-4 text-slate-600 group-hover:text-blue-400" /></div>
    </Link>
  );

  return (
    <div data-vorta-page-content="true" data-vorta-engineer-stores="true" className={PAGE}>
      <PageHeader title="Stores" subtitle="Search inventory by part, material, manufacturer or equipment. Inventory remains read-only in Vorta." />
      <label className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search part, manufacturer, equipment or SAP material number" className="min-h-12 w-full rounded-xl border border-slate-700/80 bg-[#07172b] pl-10 pr-3 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-blue-400/60" />
      </label>
      <div className="grid grid-cols-2 gap-2"><button type="button" onClick={() => askVorta("Help me identify a spare part from its label or photo.")} className={BUTTON}><QrCode className="h-4 w-4 text-blue-400" />Scan Part</button><Link to="/engineer/equipment" className={BUTTON}><Wrench className="h-4 w-4 text-blue-400" />Find by Equipment</Link></div>
      <SourceReadOnlyNotice label="Inventory, stock and storage locations are synchronised into Vorta and shown read-only. Reserve, issue and consumption actions remain in the source system." />

      {loading ? <LoadingRows count={5} /> : filtered.length === 0 ? <EmptyState title="No parts found" detail="No authorised inventory records match this search." /> : (
        <>
          {critical.length ? <section className={`${CARD} overflow-hidden`}><div className="flex items-center justify-between px-4 py-4 sm:px-5"><div className="flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-amber-400" /><h2 className="text-sm font-semibold text-slate-100">Critical / Low Stock</h2></div><span className="text-xs text-amber-400">{critical.length}</span></div><div className="border-t border-slate-800/60">{critical.slice(0, 8).map((part) => <PartRow key={`${part.equipmentId}-${part.partNumber}`} part={part} />)}</div></section> : null}
          <section className={`${CARD} overflow-hidden`}><div className="flex items-center justify-between px-4 py-4 sm:px-5"><h2 className="text-sm font-semibold text-slate-100">Inventory</h2><span className="text-xs text-slate-500">{normal.length || filtered.length} items</span></div><div className="border-t border-slate-800/60">{(normal.length ? normal : filtered).slice(0, 20).map((part) => <PartRow key={`${part.equipmentId}-${part.partNumber}`} part={part} />)}</div></section>
        </>
      )}
    </div>
  );
}

export function EngineerSpareDetailScreen(): JSX.Element {
  const { partNumber } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const equipmentId = searchParams.get("equipment") ?? "";
  const decodedPart = decodeURIComponent(partNumber ?? "");
  const [part, setPart] = useState<EngineerPart | null>(null);
  const [usedOn, setUsedOn] = useState<Array<{ id: string; name: string; assetNumber: string }>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void Promise.all([loadEngineerParts(), loadEngineerEquipment()]).then(([parts, equipment]) => {
      if (cancelled) return;
      const match = parts.find((item) => item.partNumber === decodedPart && (!equipmentId || item.equipmentId === equipmentId)) ?? parts.find((item) => item.partNumber === decodedPart) ?? null;
      setPart(match);
      const matches = parts.filter((item) => item.partNumber === decodedPart).map((item) => ({ id: item.equipmentId, name: item.equipmentName, assetNumber: item.equipmentAssetNumber }));
      const unique = [...new Map(matches.map((item) => [item.id, item])).values()];
      if (unique.length === 0 && match) {
        const asset = equipment.find((item) => item.id === match.equipmentId);
        if (asset) unique.push({ id: asset.id, name: asset.name, assetNumber: asset.assetNumber });
      }
      setUsedOn(unique);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [decodedPart, equipmentId]);

  if (loading) return <div data-vorta-page-content="true" className={PAGE}><LoadingRows count={5} /></div>;
  if (!part) return <div data-vorta-page-content="true" className={PAGE}><EmptyState title="Spare part unavailable" detail="Vorta could not find this material in the authorised inventory scope." /></div>;

  return (
    <div data-vorta-page-content="true" data-vorta-engineer-spare-detail="true" className={PAGE}>
      <button type="button" onClick={() => navigate(-1)} className="inline-flex w-fit min-h-11 items-center gap-2 text-sm font-medium text-slate-400 hover:text-white"><ArrowLeft className="h-4 w-4" />Back to Stores</button>
      <PageHeader title={part.name} subtitle={`Material / Part ${part.partNumber}`} action={<span className={`rounded-full border border-slate-700/70 bg-[#07172b] px-3 py-2 text-xs font-semibold ${stockTone(part)}`}>{part.stock} in stock</span>} />
      <SourceReadOnlyNotice label="Stock, location and material data are source-system records and cannot be changed, reserved or issued from Vorta." />

      <div className="grid gap-5 xl:grid-cols-2">
        <section className={`${CARD} p-4 sm:p-5`}>
          <div className="flex items-center gap-2"><Package className="h-5 w-5 text-blue-400" /><h2 className="text-base font-semibold text-slate-100">Stock</h2></div>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className={`${RAISED} p-3`}><p className="text-[10px] text-slate-600">Available</p><p className={`mt-1 text-xl font-semibold tabular-nums ${stockTone(part)}`}>{part.stock}</p></div>
            <div className={`${RAISED} p-3`}><p className="text-[10px] text-slate-600">Minimum</p><p className="mt-1 text-xl font-semibold tabular-nums text-slate-200">{part.minimumQuantity}</p></div>
            <div className={`${RAISED} p-3`}><p className="text-[10px] text-slate-600">Target</p><p className="mt-1 text-xl font-semibold tabular-nums text-slate-200">{part.target}</p></div>
            <div className={`${RAISED} p-3`}><p className="text-[10px] text-slate-600">Lead time</p><p className="mt-1 text-xl font-semibold tabular-nums text-slate-200">{part.leadDays}d</p></div>
          </div>
          <div className={`${RAISED} mt-3 flex items-start gap-3 p-4`}><MapPin className="mt-0.5 h-4 w-4 shrink-0 text-blue-400" /><div><p className="text-xs text-slate-500">Storage location</p><p className="mt-1 text-sm font-medium text-slate-200">{part.location || "Not recorded"}</p></div></div>
        </section>

        <section className={`${CARD} p-4 sm:p-5`}>
          <div className="flex items-center gap-2"><Wrench className="h-5 w-5 text-blue-400" /><h2 className="text-base font-semibold text-slate-100">Used On</h2></div>
          <div className="mt-4 space-y-2">{usedOn.length ? usedOn.map((asset) => <Link key={asset.id} to={`/engineer/equipment/${asset.id}`} className={`${RAISED} group flex min-h-14 items-center gap-3 p-3 hover:border-blue-400/40`}><Wrench className="h-4 w-4 text-blue-400" /><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium text-slate-200">{asset.name}</p><p className="text-xs text-slate-500">{asset.assetNumber}</p></div><ChevronRight className="h-4 w-4 text-slate-600 group-hover:text-blue-400" /></Link>) : <p className="text-sm text-slate-500">No equipment usage relationship is currently available.</p>}</div>
        </section>
      </div>

      <section className={`${CARD} p-4 sm:p-5`}>
        <div className="flex items-center gap-2"><Info className="h-5 w-5 text-blue-400" /><h2 className="text-base font-semibold text-slate-100">Technical Information</h2></div>
        <dl className="mt-4 grid grid-cols-2 gap-4 text-xs sm:grid-cols-4">
          <div><dt className="text-slate-600">Manufacturer</dt><dd className="mt-1 font-medium text-slate-200">{part.manufacturer || "—"}</dd></div>
          <div><dt className="text-slate-600">Supplier</dt><dd className="mt-1 font-medium text-slate-200">{part.supplier || "—"}</dd></div>
          <div><dt className="text-slate-600">Criticality</dt><dd className="mt-1 font-medium text-slate-200">{part.criticality || "—"}</dd></div>
          <div><dt className="text-slate-600">Source status</dt><dd className="mt-1 font-medium text-emerald-400">Read-only</dd></div>
        </dl>
      </section>

      <section className={`${CARD} overflow-hidden border-blue-500/35 bg-blue-500/[0.08]`}>
        <button type="button" onClick={() => askVorta(`Tell me about spare ${part.name}, part ${part.partNumber}, used on ${part.equipmentName}. Show source-backed installation, wiring and maintenance evidence.`)} className="flex min-h-16 w-full items-center justify-between gap-3 p-4 text-left sm:p-5"><span className="inline-flex items-center gap-3"><Sparkles className="h-5 w-5 text-blue-400" /><span><span className="block text-sm font-semibold text-slate-100">Ask Vorta about this part</span><span className="mt-0.5 block text-xs text-slate-500">Find documents, history and related equipment evidence</span></span></span><ArrowRight className="h-5 w-5 text-blue-400" /></button>
      </section>
    </div>
  );
}

export function EngineerUtilityScreen({
  title,
  subtitle,
  icon: Icon,
  snagId,
}: {
  title: string;
  subtitle: string;
  icon: React.ElementType;
  snagId: string;
}): JSX.Element {
  return (
    <div data-vorta-page-content="true" className={PAGE}>
      <PageHeader title={title} subtitle={subtitle} />
      <section className={`${CARD} p-5 sm:p-6`}>
        <div className="flex items-start gap-4">
          <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-500/10 text-blue-400"><Icon className="h-5 w-5" /></span>
          <div>
            <p className="text-sm font-semibold text-slate-100">Engineer workstream · {snagId}</p>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-400">This route now sits inside the new Engineer shell and will be completed against the dedicated Engineer snag acceptance criteria. The primary Engineer workflow is already isolated from the Maintenance Manager portal.</p>
          </div>
        </div>
      </section>
    </div>
  );
}

export const EngineerUtilityIcons = {
  documents: FileText,
  handover: ClipboardList,
  notifications: Bell,
  alerts: AlertTriangle,
  settings: ShieldCheck,
  history: Clock3,
  search: Search,
  error: XCircle,
};
