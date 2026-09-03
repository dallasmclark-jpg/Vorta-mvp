import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  AlertTriangle,
  Bell,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  Clock3,
  FileText,
  Info,
  Search,
  Settings,
  ShieldCheck,
  User,
  Wrench,
} from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "../../lib/auth";
import { supabase } from "../../lib/supabaseClient";
import {
  getEquipmentDocuments,
  getEquipmentList,
  type EquipmentListItem,
} from "../Equipment/equipmentService";

const PAGE = "mx-auto flex w-full max-w-[1600px] flex-col gap-5 px-4 pb-10 pt-5 sm:px-5 md:gap-6 md:px-6 md:pb-12 md:pt-6 xl:px-8";
const CARD = "rounded-2xl border border-slate-800/75 bg-[#030c1d] shadow-[0_14px_34px_rgba(0,0,0,0.22)]";
const ROW = "rounded-xl border border-slate-800/70 bg-[#07172b]";
const INPUT = "h-11 w-full rounded-full border border-slate-700/80 bg-[#07172b] pl-11 pr-4 text-sm text-slate-100 outline-none placeholder:text-slate-600 focus:border-blue-400/70 focus:ring-2 focus:ring-blue-500/20";

interface WorkRow {
  id: string;
  wo_number: string | null;
  equipment_id: string | null;
  priority: string | null;
  description: string | null;
  work_type: string | null;
  status: string | null;
  assigned_engineer: string | null;
  requested_date: string | null;
  due_date: string | null;
  is_overdue: boolean | null;
  fault_code: string | null;
}

interface DocumentItem {
  id: string;
  equipmentId: string;
  equipmentName: string;
  assetNumber: string;
  name: string;
  category: string;
  date: string;
  size: string;
  status: string;
}

interface SiteAlertItem {
  id: string;
  severity: "critical" | "high" | "medium";
  title: string;
  detail: string;
  equipmentId: string;
  equipmentName: string;
  area: string;
}

function Header({
  title,
  subtitle,
  icon: Icon,
}: {
  title: string;
  subtitle: string;
  icon: typeof Bell;
}): JSX.Element {
  return (
    <header className="flex items-start gap-3">
      <div className="mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-blue-500/20 bg-blue-500/10 text-blue-300">
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-[-0.025em] text-slate-50 md:text-3xl">{title}</h1>
        <p className="mt-1 text-sm leading-6 text-slate-400">{subtitle}</p>
      </div>
    </header>
  );
}

function ReadOnlyNotice({ children }: { children: ReactNode }): JSX.Element {
  return (
    <div className="flex items-start gap-2.5 rounded-xl border border-blue-500/20 bg-blue-500/[0.07] px-3.5 py-3 text-xs leading-5 text-blue-100/80">
      <Info className="mt-0.5 h-4 w-4 shrink-0 text-blue-400" />
      <span>{children}</span>
    </div>
  );
}

function Empty({ title, detail }: { title: string; detail: string }): JSX.Element {
  return (
    <div className={`${CARD} flex min-h-44 flex-col items-center justify-center px-5 py-8 text-center`}>
      <CheckCircle2 className="h-7 w-7 text-emerald-400" />
      <p className="mt-3 text-sm font-semibold text-slate-200">{title}</p>
      <p className="mt-1 max-w-md text-xs leading-5 text-slate-500">{detail}</p>
    </div>
  );
}

function displayDate(value: string | null | undefined): string {
  if (!value) return "No date";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function severityClasses(severity: SiteAlertItem["severity"]): string {
  if (severity === "critical") return "border-red-500/25 bg-red-500/[0.08] text-red-300";
  if (severity === "high") return "border-orange-500/25 bg-orange-500/[0.08] text-orange-300";
  return "border-amber-500/25 bg-amber-500/[0.08] text-amber-300";
}

function priorityClasses(priority: string | null | undefined): string {
  const value = (priority ?? "").toLowerCase();
  if (value.includes("critical") || value.includes("high")) return "border-red-500/25 bg-red-500/[0.08] text-red-300";
  if (value.includes("medium")) return "border-amber-500/25 bg-amber-500/[0.08] text-amber-300";
  return "border-blue-500/25 bg-blue-500/[0.08] text-blue-300";
}

async function loadOpenWork(): Promise<WorkRow[]> {
  const { data, error } = await supabase
    .from("work_orders")
    .select("id, wo_number, equipment_id, priority, description, work_type, status, assigned_engineer, requested_date, due_date, is_overdue, fault_code")
    .order("is_overdue", { ascending: false })
    .order("due_date", { ascending: true, nullsFirst: false })
    .limit(30);

  if (error) throw error;
  return (data ?? []) as WorkRow[];
}

async function loadDocuments(): Promise<DocumentItem[]> {
  const equipment = await getEquipmentList();
  const assets = equipment.slice(0, 18);
  const groups = await Promise.all(
    assets.map(async (asset) => {
      try {
        const docs = await getEquipmentDocuments(asset.id);
        return docs.map((doc) => ({
          id: String(doc.id),
          equipmentId: asset.id,
          equipmentName: asset.name,
          assetNumber: asset.assetNumber,
          name: String(doc.name ?? "Document"),
          category: String(doc.category ?? "Document"),
          date: String(doc.date ?? ""),
          size: String(doc.size ?? ""),
          status: String(doc.status ?? "Current"),
        }));
      } catch {
        return [] as DocumentItem[];
      }
    }),
  );
  return groups.flat();
}

function alertsFromEquipment(equipment: EquipmentListItem[]): SiteAlertItem[] {
  const alerts: SiteAlertItem[] = [];
  equipment.forEach((asset) => {
    const severity: SiteAlertItem["severity"] = asset.riskLevel === "Critical" ? "critical" : asset.riskLevel === "High" ? "high" : "medium";

    if (asset.riskScore >= 55) {
      alerts.push({
        id: `${asset.id}-risk`,
        severity,
        title: `${asset.name} is ${asset.riskLevel.toLowerCase()} risk`,
        detail: `Current Vorta equipment risk score is ${asset.riskScore}%. Review the active risk drivers before working on the asset.`,
        equipmentId: asset.id,
        equipmentName: asset.name,
        area: asset.area,
      });
    }

    if (asset.overduePmCount > 0) {
      alerts.push({
        id: `${asset.id}-pm`,
        severity: asset.overduePmCount > 1 ? "high" : "medium",
        title: `${asset.overduePmCount} overdue PM${asset.overduePmCount === 1 ? "" : "s"} on ${asset.name}`,
        detail: "Check the PM requirement and current work status before the next maintenance intervention.",
        equipmentId: asset.id,
        equipmentName: asset.name,
        area: asset.area,
      });
    }

    if (asset.calibrationOverdueCount > 0) {
      alerts.push({
        id: `${asset.id}-calibration`,
        severity: "high",
        title: `Calibration attention required on ${asset.name}`,
        detail: `${asset.calibrationOverdueCount} calibration item${asset.calibrationOverdueCount === 1 ? " is" : "s are"} overdue.`,
        equipmentId: asset.id,
        equipmentName: asset.name,
        area: asset.area,
      });
    }
  });

  const order = { critical: 0, high: 1, medium: 2 } as const;
  return alerts.sort((a, b) => order[a.severity] - order[b.severity]).slice(0, 20);
}

export function EngineerHandoverScreen(): JSX.Element {
  const [work, setWork] = useState<WorkRow[]>([]);
  const [equipment, setEquipment] = useState<EquipmentListItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    void Promise.allSettled([loadOpenWork(), getEquipmentList()]).then(([workResult, equipmentResult]) => {
      if (!alive) return;
      if (workResult.status === "fulfilled") setWork(workResult.value);
      if (equipmentResult.status === "fulfilled") setEquipment(equipmentResult.value);
      setLoading(false);
    });
    return () => { alive = false; };
  }, []);

  const carryOver = useMemo(
    () => work.filter((item) => !["completed", "closed", "teco"].includes((item.status ?? "").toLowerCase())).slice(0, 8),
    [work],
  );
  const watchList = useMemo(() => equipment.filter((asset) => asset.riskScore >= 55).sort((a, b) => b.riskScore - a.riskScore).slice(0, 5), [equipment]);

  return (
    <section className={PAGE}>
      <Header title="Shift Handover" subtitle="A concise view of open work and equipment that needs attention as the shift changes." icon={Wrench} />
      <ReadOnlyNotice>SAP and other connected maintenance records remain read-only in Vorta. Handover is assembled from the latest synchronised site evidence.</ReadOnlyNotice>

      {loading ? <div className={`${CARD} h-44 animate-pulse`} /> : (
        <div className="grid gap-5 xl:grid-cols-[1.35fr_0.65fr]">
          <div className={`${CARD} p-4 sm:p-5`}>
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-slate-100">Open work to carry forward</h2>
                <p className="mt-1 text-xs text-slate-500">Highest-priority open maintenance items from the current site record.</p>
              </div>
              <span className="rounded-full border border-slate-700 px-2.5 py-1 text-xs tabular-nums text-slate-400">{carryOver.length}</span>
            </div>
            {carryOver.length === 0 ? <Empty title="No open carry-over work" detail="No open maintenance items were returned by the current site data." /> : (
              <div className="space-y-2.5">
                {carryOver.map((item) => (
                  <Link key={item.id} to={`/engineer/work/${encodeURIComponent(item.wo_number ?? item.id)}`} className={`${ROW} flex items-start gap-3 p-3.5 transition-colors hover:border-blue-500/40`}>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${priorityClasses(item.priority)}`}>{item.priority ?? "Priority"}</span>
                        <span className="text-[11px] text-slate-500">{item.wo_number ?? item.id}</span>
                        {item.is_overdue ? <span className="text-[11px] font-medium text-red-400">Overdue</span> : null}
                      </div>
                      <p className="mt-2 text-sm font-medium text-slate-100">{item.description ?? "Maintenance work"}</p>
                      <p className="mt-1 text-xs text-slate-500">Due {displayDate(item.due_date)} · {item.assigned_engineer ?? "Unassigned"}</p>
                    </div>
                    <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-slate-600" />
                  </Link>
                ))}
              </div>
            )}
          </div>

          <div className={`${CARD} p-4 sm:p-5`}>
            <h2 className="text-sm font-semibold text-slate-100">Equipment watch list</h2>
            <p className="mt-1 text-xs text-slate-500">Assets most likely to matter to the incoming shift.</p>
            <div className="mt-4 space-y-2.5">
              {watchList.map((asset) => (
                <Link key={asset.id} to={`/engineer/equipment/${asset.id}`} className={`${ROW} flex items-center gap-3 p-3.5 transition-colors hover:border-blue-500/40`}>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-100">{asset.name}</p>
                    <p className="mt-1 text-xs text-slate-500">{asset.area} · {asset.openWorkOrderCount} open work order{asset.openWorkOrderCount === 1 ? "" : "s"}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold tabular-nums text-orange-300">{asset.riskScore}%</p>
                    <p className="text-[10px] uppercase tracking-wide text-slate-600">risk</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

export function EngineerDocumentsScreen(): JSX.Element {
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    void loadDocuments().then((items) => { if (alive) setDocuments(items); }).catch(() => undefined).finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return documents;
    return documents.filter((item) => [item.name, item.category, item.equipmentName, item.assetNumber].some((value) => value.toLowerCase().includes(needle)));
  }, [documents, query]);

  return (
    <section className={PAGE}>
      <Header title="Documents" subtitle="Equipment manuals, SOPs, drawings and maintenance instructions in one engineer-focused library." icon={BookOpen} />
      <div className="relative max-w-2xl">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
        <input value={query} onChange={(event) => setQuery(event.target.value)} className={INPUT} placeholder="Search documents or equipment..." />
      </div>
      <ReadOnlyNotice>Documents are read-only source evidence. Equipment-linked documents are surfaced first so engineers are not digging through a corporate filing cabinet at 2am.</ReadOnlyNotice>

      {loading ? <div className={`${CARD} h-56 animate-pulse`} /> : filtered.length === 0 ? <Empty title="No matching documents" detail="Try a different equipment name, asset number or document category." /> : (
        <div className={`${CARD} overflow-hidden`}>
          <div className="divide-y divide-slate-800/70">
            {filtered.slice(0, 40).map((item) => (
              <Link key={`${item.equipmentId}-${item.id}`} to={`/engineer/equipment/${item.equipmentId}`} className="flex items-start gap-3 px-4 py-4 transition-colors hover:bg-white/[0.025] sm:px-5">
                <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-slate-700/70 bg-[#07172b] text-blue-300">
                  <FileText className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <p className="truncate text-sm font-medium text-slate-100">{item.name}</p>
                    <span className="rounded-full border border-slate-700 px-2 py-0.5 text-[10px] text-slate-400">{item.category}</span>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">{item.equipmentName} · {item.assetNumber} · {item.date || "Current source"}{item.size ? ` · ${item.size}` : ""}</p>
                </div>
                <ChevronRight className="mt-2 h-4 w-4 shrink-0 text-slate-600" />
              </Link>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

export function EngineerNotificationsScreen(): JSX.Element {
  const [work, setWork] = useState<WorkRow[]>([]);
  const [alerts, setAlerts] = useState<SiteAlertItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    void Promise.allSettled([loadOpenWork(), getEquipmentList()]).then(([workResult, equipmentResult]) => {
      if (!alive) return;
      if (workResult.status === "fulfilled") setWork(workResult.value);
      if (equipmentResult.status === "fulfilled") setAlerts(alertsFromEquipment(equipmentResult.value));
      setLoading(false);
    });
    return () => { alive = false; };
  }, []);

  const notifications = useMemo(() => {
    const workItems = work.filter((item) => item.is_overdue || ["critical", "high"].some((level) => (item.priority ?? "").toLowerCase().includes(level))).slice(0, 8).map((item) => ({
      id: `work-${item.id}`,
      title: item.is_overdue ? `Overdue work: ${item.wo_number ?? item.id}` : `Priority work: ${item.wo_number ?? item.id}`,
      detail: item.description ?? "Maintenance work requires attention.",
      meta: `Due ${displayDate(item.due_date)}`,
      to: `/engineer/work/${encodeURIComponent(item.wo_number ?? item.id)}`,
      tone: item.is_overdue ? "text-red-400" : "text-orange-300",
    }));
    const alertItems = alerts.slice(0, 6).map((alert) => ({
      id: `alert-${alert.id}`,
      title: alert.title,
      detail: alert.detail,
      meta: alert.area,
      to: `/engineer/equipment/${alert.equipmentId}`,
      tone: alert.severity === "critical" ? "text-red-400" : alert.severity === "high" ? "text-orange-300" : "text-amber-300",
    }));
    return [...workItems, ...alertItems].slice(0, 14);
  }, [work, alerts]);

  return (
    <section className={PAGE}>
      <Header title="Notifications" subtitle="Engineer-relevant work and equipment changes, stripped of the management noise." icon={Bell} />
      {loading ? <div className={`${CARD} h-52 animate-pulse`} /> : notifications.length === 0 ? <Empty title="You're up to date" detail="There are no priority engineer notifications in the current site data." /> : (
        <div className={`${CARD} overflow-hidden`}>
          <div className="divide-y divide-slate-800/70">
            {notifications.map((item) => (
              <Link key={item.id} to={item.to} className="flex items-start gap-3 px-4 py-4 transition-colors hover:bg-white/[0.025] sm:px-5">
                <div className={`mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full border border-slate-700/70 bg-[#07172b] ${item.tone}`}><Bell className="h-4 w-4" /></div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-slate-100">{item.title}</p>
                  <p className="mt-1 text-xs leading-5 text-slate-500">{item.detail}</p>
                  <p className="mt-1.5 text-[11px] text-slate-600">{item.meta}</p>
                </div>
                <ChevronRight className="mt-2 h-4 w-4 shrink-0 text-slate-600" />
              </Link>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

export function EngineerSiteAlertsScreen(): JSX.Element {
  const [alerts, setAlerts] = useState<SiteAlertItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    void getEquipmentList().then((equipment) => { if (alive) setAlerts(alertsFromEquipment(equipment)); }).catch(() => undefined).finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  const counts = useMemo(() => ({
    critical: alerts.filter((item) => item.severity === "critical").length,
    high: alerts.filter((item) => item.severity === "high").length,
    medium: alerts.filter((item) => item.severity === "medium").length,
  }), [alerts]);

  return (
    <section className={PAGE}>
      <Header title="Site Alerts" subtitle="Only the site risks an engineer can act on: equipment condition, PM and calibration exposure." icon={AlertTriangle} />
      <ReadOnlyNotice>This is an engineer view of site risk, not the Maintenance Manager dashboard. It deliberately excludes commercial and management-only information.</ReadOnlyNotice>

      {!loading ? (
        <div className="grid grid-cols-3 gap-2.5 sm:max-w-xl">
          {[{ label: "Critical", value: counts.critical, tone: "text-red-400" }, { label: "High", value: counts.high, tone: "text-orange-300" }, { label: "Medium", value: counts.medium, tone: "text-amber-300" }].map((item) => (
            <div key={item.label} className={`${CARD} px-3 py-3.5 text-center`}>
              <p className={`text-xl font-semibold tabular-nums ${item.tone}`}>{item.value}</p>
              <p className="mt-1 text-[10px] font-medium uppercase tracking-[0.12em] text-slate-600">{item.label}</p>
            </div>
          ))}
        </div>
      ) : null}

      {loading ? <div className={`${CARD} h-56 animate-pulse`} /> : alerts.length === 0 ? <Empty title="No engineer site alerts" detail="Current equipment data does not contain engineer-actionable high-risk conditions." /> : (
        <div className="space-y-2.5">
          {alerts.map((alert) => (
            <Link key={alert.id} to={`/engineer/equipment/${alert.equipmentId}`} className={`${CARD} flex items-start gap-3 p-4 transition-colors hover:border-blue-500/40 sm:p-5`}>
              <div className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg border ${severityClasses(alert.severity)}`}><AlertTriangle className="h-4 w-4" /></div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold text-slate-100">{alert.title}</p>
                  <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${severityClasses(alert.severity)}`}>{alert.severity}</span>
                </div>
                <p className="mt-1.5 text-xs leading-5 text-slate-500">{alert.detail}</p>
                <p className="mt-2 text-[11px] text-slate-600">{alert.equipmentName} · {alert.area}</p>
              </div>
              <ChevronRight className="mt-2 h-4 w-4 shrink-0 text-slate-600" />
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}

function ToggleRow({ label, detail, checked, onChange }: { label: string; detail: string; checked: boolean; onChange: () => void }): JSX.Element {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-slate-800/70 py-4 last:border-b-0">
      <div className="min-w-0">
        <p className="text-sm font-medium text-slate-100">{label}</p>
        <p className="mt-1 text-xs leading-5 text-slate-500">{detail}</p>
      </div>
      <button type="button" role="switch" aria-checked={checked} onClick={onChange} className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${checked ? "bg-blue-600" : "bg-slate-700"}`}>
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${checked ? "translate-x-5" : "translate-x-0.5"}`} />
      </button>
    </div>
  );
}

export function EngineerProfileSettingsScreen(): JSX.Element {
  const { session, siteContext, role } = useAuth();
  const storageKey = `vorta-engineer-settings:${session?.user.id ?? "anonymous"}`;
  const [preferences, setPreferences] = useState({ priorityWork: true, siteRisk: true, skillUpdates: true });

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(storageKey);
      if (saved) setPreferences((current) => ({ ...current, ...JSON.parse(saved) }));
    } catch {
      // Local preferences are optional and must never block the portal.
    }
  }, [storageKey]);

  const updatePreference = (key: keyof typeof preferences): void => {
    setPreferences((current) => {
      const next = { ...current, [key]: !current[key] };
      try { window.localStorage.setItem(storageKey, JSON.stringify(next)); } catch { /* optional */ }
      return next;
    });
  };

  const fullName = String(session?.user.user_metadata?.full_name ?? session?.user.user_metadata?.name ?? "Engineer");
  const email = session?.user.email ?? "No email available";
  const roleLabel = (role ?? "engineer").replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
  const siteLabel = siteContext?.siteId ? `Active site · ${siteContext.siteId.slice(0, 8).toUpperCase()}` : "Active site context unavailable";

  return (
    <section className={PAGE}>
      <Header title="Profile & Settings" subtitle="Your Vorta engineer identity, active site context and app notification preferences." icon={Settings} />

      <div className="grid gap-5 xl:grid-cols-[0.85fr_1.15fr]">
        <div className={`${CARD} p-5`}>
          <div className="flex items-center gap-3">
            <div className="grid h-12 w-12 place-items-center rounded-full border border-blue-500/25 bg-blue-500/10 text-blue-300"><User className="h-5 w-5" /></div>
            <div className="min-w-0">
              <p className="truncate text-base font-semibold text-slate-100">{fullName}</p>
              <p className="mt-0.5 truncate text-xs text-slate-500">{email}</p>
            </div>
          </div>

          <div className="mt-5 space-y-3 border-t border-slate-800/70 pt-5">
            <div className={`${ROW} px-3.5 py-3`}><p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-600">Portal role</p><p className="mt-1 text-sm text-slate-200">{roleLabel}</p></div>
            <div className={`${ROW} px-3.5 py-3`}><p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-600">Site access</p><p className="mt-1 text-sm text-slate-200">{siteLabel}</p></div>
            <div className={`${ROW} flex items-start gap-2.5 px-3.5 py-3`}><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" /><p className="text-xs leading-5 text-slate-400">External maintenance systems remain read-only. Your engineer skills self-assessments and Vorta preferences are the only user-owned data edited in the engineer experience.</p></div>
          </div>
        </div>

        <div className={`${CARD} p-5`}>
          <div className="mb-2">
            <h2 className="text-sm font-semibold text-slate-100">Notification preferences</h2>
            <p className="mt-1 text-xs text-slate-500">Stored on this device for the MVP.</p>
          </div>
          <ToggleRow label="Priority work" detail="Surface high-priority and overdue maintenance work in Notifications." checked={preferences.priorityWork} onChange={() => updatePreference("priorityWork")} />
          <ToggleRow label="Site risk alerts" detail="Surface engineer-actionable equipment, PM and calibration risk." checked={preferences.siteRisk} onChange={() => updatePreference("siteRisk")} />
          <ToggleRow label="Skills updates" detail="Keep skills validation and training-related updates visible in the engineer experience." checked={preferences.skillUpdates} onChange={() => updatePreference("skillUpdates")} />
        </div>
      </div>
    </section>
  );
}
