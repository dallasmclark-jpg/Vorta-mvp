import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  BookOpen,
  Brain,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleUser as UserCircle,
  Download,
  GraduationCap,
  MapPin,
  Plus,
  RefreshCw,
  Search,
  Shield,
  Sparkles,
  TrendingUp,
  X,
  Zap,
} from "lucide-react";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Card, CardContent } from "../../components/ui/card";
import { Progress } from "../../components/ui/progress";
import { supabase } from "../../lib/supabaseClient";
import { ContextHelp } from "../../components/ContextHelp";
import { SyncIndicator } from "../../components/SyncIndicator";
import { AiActionsPanel, AiAction } from "../../components/AiActionsPanel";
import { Select } from "../../components/Select";
import { ExplainWithAi } from "../../components/ExplainWithAi";
// ─── Types ────────────────────────────────────────────────────────────────────

interface Booking {
  id: string;
  engineer_name: string | null;
  department: string | null;
  course_title: string;
  delivery_type: string | null;
  partner_name: string | null;
  status: string;
  booking_date: string | null;
  cost: number | null;
  currency: string;
}

interface PriorityRow {
  id: string;
  skill_name: string;
  category: string;
  is_critical: boolean;
  dept_name: string | null;
  current_avg: number;
  target_rating: number;
  gap: number;
  engineers_qualified: number;
  risk_level: string;
  priority: string;
  single_point_of_failure: boolean;
  recommendation: string;
}

interface CertRiskRow {
  skill_name: string;
  engineer_name: string;
  expiry_date: string | null;
  days_left: number;
  status: string;
  risk_level: string;
}

interface Course {
  id: string;
  title: string;
  partner_name: string | null;
  partner_location: string | null;
  delivery_type: string;
  duration_days: number;
  price: number;
  currency: string;
  skills_covered: string[];
  bookings: number;
}

interface Partner {
  id: string;
  name: string;
  location: string;
  status: string;
  course_count: number;
  booking_count: number;
  specialisms: string[];
}

interface SpendMonth  { month: string; label: string; spend: number }
interface DeptBooking { dept: string; count: number; spend: number; pct: number }
interface Insight     { severity: string; title: string; text: string }
interface Department  { id: string; name: string }

interface TrainingStats {
  totalBookings: number;
  completed: number;
  activeBookings: number;
  totalSpendGBP: number;
  compliancePct: number;
  expiringIn30Days: number;
  expiringIn90Days: number;
  engineersNeedingTraining: number;
  criticalGaps: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const PRIORITY_PAGE_SIZE = 10;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function priorityBadgeClass(priority: string): string {
  switch (priority) {
    case "Critical": return "bg-[#ef444420] text-red-500";
    case "High":     return "bg-[#f9731620] text-orange-400";
    case "Medium":   return "bg-[#facc1520] text-yellow-400";
    case "Low":      return "bg-[#10b98120] text-emerald-500";
    default:         return "bg-gray-800 text-slate-400";
  }
}

function bookingStatusBadgeClass(status: string): string {
  switch (status) {
    case "completed":        return "bg-[#10b98120] text-emerald-500";
    case "approved":         return "bg-[#3b82f620] text-blue-400";
    case "booked":           return "bg-[#3b82f620] text-blue-400";
    case "pending_approval": return "bg-[#facc1520] text-yellow-400";
    default:                 return "bg-gray-800 text-slate-400";
  }
}

function certStatusBadgeClass(status: string): string {
  switch (status) {
    case "Expired":       return "bg-[#ef444420] text-red-500";
    case "Expiring Soon": return "bg-[#f9731620] text-orange-400";
    case "Expiring":      return "bg-[#facc1520] text-yellow-400";
    case "Valid":         return "bg-[#10b98120] text-emerald-500";
    default:              return "bg-gray-800 text-slate-400";
  }
}

function deliveryBadgeClass(type: string): string {
  switch (type) {
    case "classroom": return "bg-[#3b82f620] text-blue-400";
    case "blended":   return "bg-[#8b5cf620] text-violet-400";
    case "onsite":    return "bg-[#10b98120] text-emerald-400";
    default:          return "bg-gray-800 text-slate-400";
  }
}

function coverageBarClass(pct: number): string {
  if (pct >= 80) return "[&>div]:bg-emerald-500";
  if (pct >= 50) return "[&>div]:bg-yellow-400";
  return "[&>div]:bg-blue-500";
}

function insightConf(severity: string) {
  switch (severity) {
    case "critical": return { bg: "bg-[#ef444408]", border: "border-red-500/20",    icon: AlertTriangle, iconCls: "text-red-500",    titleCls: "text-red-400"    };
    case "high":     return { bg: "bg-[#f9731608]", border: "border-orange-400/20", icon: Zap,           iconCls: "text-orange-400", titleCls: "text-orange-300" };
    default:         return { bg: "bg-[#facc1508]", border: "border-yellow-400/20", icon: Brain,         iconCls: "text-yellow-400", titleCls: "text-yellow-300" };
  }
}

function fmtCurrency(n: number, currency = "GBP"): string {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency, maximumFractionDigits: 0 }).format(n);
}

function fmtDate(d: string | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function getInitials(name: string | null): string {
  if (!name) return "?";
  return name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
}

const AVATAR_COLORS = [
  "bg-blue-500/20 text-blue-400",
  "bg-emerald-500/20 text-emerald-400",
  "bg-orange-500/20 text-orange-400",
  "bg-violet-500/20 text-violet-400",
  "bg-cyan-500/20 text-cyan-400",
];

function avatarColor(name: string | null): string {
  if (!name) return AVATAR_COLORS[0];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash += name.charCodeAt(i);
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

// ─── Fetch ────────────────────────────────────────────────────────────────────

async function fetchTraining(): Promise<{
  recentActivity: Booking[];
  stats: TrainingStats;
  spendByMonth: SpendMonth[];
  bookingsByDept: DeptBooking[];
  priorityRows: PriorityRow[];
  certRiskRows: CertRiskRow[];
  recommendedCourses: Course[];
  trainingPartners: Partner[];
  departments: Department[];
  insights: Insight[];
  error?: boolean;
}> {
  const { data, error } = await supabase.functions.invoke("training-data");
  const empty = {
    recentActivity: [], stats: { totalBookings: 0, completed: 0, activeBookings: 0, totalSpendGBP: 0, compliancePct: 0, expiringIn30Days: 0, expiringIn90Days: 0, engineersNeedingTraining: 0, criticalGaps: 0 },
    spendByMonth: [], bookingsByDept: [], priorityRows: [], certRiskRows: [],
    recommendedCourses: [], trainingPartners: [], departments: [], insights: [],
  };
  if (error || !data) return { ...empty, error: true };
  return {
    recentActivity:    (data.recentActivity      ?? []) as Booking[],
    stats:              data.stats                as TrainingStats,
    spendByMonth:      (data.spendByMonth         ?? []) as SpendMonth[],
    bookingsByDept:    (data.bookingsByDept        ?? []) as DeptBooking[],
    priorityRows:      (data.priorityRows          ?? []) as PriorityRow[],
    certRiskRows:      (data.certRiskRows           ?? []) as CertRiskRow[],
    recommendedCourses:(data.recommendedCourses    ?? []) as Course[],
    trainingPartners:  (data.trainingPartners       ?? []) as Partner[],
    departments:       (data.departments            ?? []) as Department[],
    insights:          (data.insights               ?? []) as Insight[],
  };
}

// ─── Booking Drawer ───────────────────────────────────────────────────────────

interface BookingDrawerItem {
  id: string;
  course_title: string;
  engineer_name: string | null;
  department: string | null;
  status: string;
  booking_date: string | null;
  cost: number | null;
  currency: string;
  delivery_type: string | null;
  partner_name: string | null;
  // Course extras (optional, only when opened from course card)
  skills_covered?: string[];
  duration_days?: number;
}

function BookingDrawer({
  item,
  onClose,
  onStatusChange,
}: {
  item: BookingDrawerItem | null;
  onClose: () => void;
  onStatusChange: (id: string, status: string) => void;
}) {
  const isOpen   = item !== null;
  const navigate = useNavigate();
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => { if (item && scrollRef.current) scrollRef.current.scrollTop = 0; }, [item?.id]);

  const canApprove  = item?.status === "pending_approval";
  const canComplete = item?.status === "approved" || item?.status === "booked";
  const canReject   = item?.status === "pending_approval" || item?.status === "booked";

  return (
    <>
      <div
        className={`fixed inset-0 z-40 bg-black/50 backdrop-blur-[2px] transition-opacity duration-200 ${
          isOpen ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={onClose}
      />
      <div
        className={`fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l border-gray-800 bg-[#0d1117] shadow-2xl transition-transform duration-300 ease-in-out ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* Header */}
        <div className="flex items-start justify-between border-b border-gray-800 p-5">
          <div className="flex min-w-0 flex-1 flex-col gap-1.5 pr-3">
            <div className="flex flex-wrap items-center gap-2">
              {item && (
                <Badge className={`inline-flex h-auto rounded px-2 py-0.5 text-[10px] font-medium shadow-none ${bookingStatusBadgeClass(item.status)}`}>
                  {item.status.replace("_", " ")}
                </Badge>
              )}
              {item?.delivery_type && (
                <Badge className={`inline-flex h-auto rounded px-1.5 py-0.5 text-[10px] font-medium shadow-none ${deliveryBadgeClass(item.delivery_type)}`}>
                  {item.delivery_type}
                </Badge>
              )}
            </div>
            <h2 className="text-base font-semibold leading-snug text-slate-50">{item?.course_title ?? "—"}</h2>
            {item?.partner_name && <p className="text-sm text-slate-400">{item.partner_name}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-[#ffffff10] hover:text-slate-200"
            aria-label="Close drawer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 divide-x divide-gray-800 border-b border-gray-800">
          {[
            { label: "Engineer",  value: item?.engineer_name ?? "—",                          cls: "text-slate-200" },
            { label: "Department", value: item?.department ?? "—",                             cls: "text-slate-200" },
            { label: "Date",      value: fmtDate(item?.booking_date ?? null),                  cls: "text-slate-200" },
          ].map(({ label, value, cls }) => (
            <div key={label} className="flex flex-col gap-0.5 px-3 py-3">
              <p className="text-[10px] font-medium text-slate-500">{label}</p>
              <p className={`truncate text-xs font-semibold ${cls}`}>{value}</p>
            </div>
          ))}
        </div>

        <div ref={scrollRef} className="flex flex-1 flex-col overflow-y-auto">

          {/* Details */}
          <div className="border-b border-gray-800 p-5">
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Booking Details</p>
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: "Cost",          value: item?.cost ? fmtCurrency(item.cost, item.currency) : "—" },
                { label: "Delivery",      value: item?.delivery_type ?? "—" },
                { label: "Provider",      value: item?.partner_name ?? "—" },
                { label: "Status",        value: item?.status.replace("_", " ") ?? "—" },
                ...(item?.duration_days ? [{ label: "Duration", value: `${item.duration_days} day${item.duration_days !== 1 ? "s" : ""}` }] : []),
              ].map(({ label, value }) => (
                <div key={label} className="flex flex-col gap-0.5 rounded-lg border border-gray-800 bg-[#111620] p-2.5">
                  <span className="text-[10px] font-medium uppercase tracking-wider text-slate-500">{label}</span>
                  <span className="text-xs font-medium text-slate-200">{value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Skills covered */}
          {(item?.skills_covered ?? []).length > 0 && (
            <div className="border-b border-gray-800 p-5">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Skills Covered</p>
              <div className="flex flex-wrap gap-1.5">
                {(item!.skills_covered!).map((s) => (
                  <span key={s} className="rounded-full border border-gray-700 bg-[#111620] px-2.5 py-0.5 text-[11px] font-medium text-slate-300">
                    {s}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* AI note */}
          <div className="border-b border-gray-800 p-5">
            <div className="flex items-center gap-2 mb-2">
              <Brain className="h-4 w-4 text-blue-400" />
              <p className="text-[11px] font-semibold uppercase tracking-wider text-blue-400">AI Recommendation</p>
            </div>
            <p className="text-xs leading-relaxed text-slate-300">
              {item?.status === "pending_approval"
                ? "Approve this booking promptly — delayed approvals push back training completion dates and extend skill gap exposure."
                : item?.status === "completed"
                ? "Training completed. Update the skills matrix to reflect the new competency level and check if any SPOF risks are now resolved."
                : "Ensure the engineer is available for the full course duration. Check for any prerequisite skills or certification requirements beforehand."}
            </p>
          </div>

          {/* Local actions */}
          {(canApprove || canComplete || canReject) && (
            <div className="border-b border-gray-800 p-5">
              <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Actions</p>
              <div className="flex flex-wrap gap-2">
                {canApprove && (
                  <button
                    type="button"
                    onClick={() => { onStatusChange(item!.id, "approved"); onClose(); }}
                    className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-400 transition-colors hover:bg-emerald-500/20"
                  >
                    Approve Booking
                  </button>
                )}
                {canComplete && (
                  <button
                    type="button"
                    onClick={() => { onStatusChange(item!.id, "completed"); onClose(); }}
                    className="rounded-lg border border-blue-500/30 bg-blue-500/10 px-3 py-1.5 text-xs font-semibold text-blue-400 transition-colors hover:bg-blue-500/20"
                  >
                    Mark Completed
                  </button>
                )}
                {canReject && (
                  <button
                    type="button"
                    onClick={() => { onStatusChange(item!.id, "cancelled"); onClose(); }}
                    className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs font-semibold text-red-400 transition-colors hover:bg-red-500/20"
                  >
                    Reject / Query
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Workflow navigation */}
          <div className="p-5">
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Navigate</p>
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: "View Skills",       route: "/skills-matrix"     },
                { label: "View Engineers",    route: "/engineers"         },
                { label: "View Equipment",    route: "/equipment"         },
                { label: "View Requirements", route: "/requirements"      },
                { label: "View Providers",    route: "/training-providers"},
                { label: "View AI Match",     route: "/ai-matching"       },
              ].map(({ label, route }) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => { onClose(); navigate(route); }}
                  className="rounded-lg border border-gray-700 bg-[#111620] px-3 py-2 text-xs font-semibold text-slate-300 transition-colors hover:border-blue-500/40 hover:bg-[#141b2a] hover:text-blue-300"
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Skeleton line ────────────────────────────────────────────────────────────

function SkeletonLine({ w = "w-24", h = "h-4" }: { w?: string; h?: string }) {
  return <div className={`${h} ${w} animate-pulse rounded bg-gray-800`} />;
}

// ─── Main component ───────────────────────────────────────────────────────────

export const TrainingSection = (): JSX.Element => {
  const [stats,              setStats]              = useState<TrainingStats>({ totalBookings: 0, completed: 0, activeBookings: 0, totalSpendGBP: 0, compliancePct: 0, expiringIn30Days: 0, expiringIn90Days: 0, engineersNeedingTraining: 0, criticalGaps: 0 });
  const [spendByMonth,       setSpendByMonth]       = useState<SpendMonth[]>([]);
  const [bookingsByDept,     setBookingsByDept]     = useState<DeptBooking[]>([]);
  const [priorityRows,       setPriorityRows]       = useState<PriorityRow[]>([]);
  const [certRiskRows,       setCertRiskRows]       = useState<CertRiskRow[]>([]);
  const [recentActivity,     setRecentActivity]     = useState<Booking[]>([]);
  const [recommendedCourses, setRecommendedCourses] = useState<Course[]>([]);
  const [trainingPartners,   setTrainingPartners]   = useState<Partner[]>([]);
  const [insights,           setInsights]           = useState<Insight[]>([]);
  const [loading,            setLoading]            = useState(true);
  const [loadError,          setLoadError]          = useState(false);
  const [tick,               setTick]               = useState(0);

  const [selectedItem,       setSelectedItem]       = useState<BookingDrawerItem | null>(null);
  const [toast,              setToast]              = useState<string | null>(null);
  const [localStatuses,      setLocalStatuses]      = useState<Record<string, string>>({});

  // Priority table filters
  const [prioritySearch,  setPrioritySearch]  = useState("");
  const [filterPriority,  setFilterPriority]  = useState("all");
  const [priorityPage,    setPriorityPage]    = useState(0);

  const handleStatusChange = (id: string, status: string) => {
    setLocalStatuses((prev) => ({ ...prev, [id]: status }));
    const msg = status === "approved" ? "Booking approved" : status === "completed" ? "Marked as completed" : "Booking rejected / queried";
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(false);
    fetchTraining().then((payload) => {
      if (cancelled) return;
      if (payload.error) { setLoadError(true); setLoading(false); return; }
      setStats(payload.stats);
      setSpendByMonth(payload.spendByMonth);
      setBookingsByDept(payload.bookingsByDept);
      setPriorityRows(payload.priorityRows);
      setCertRiskRows(payload.certRiskRows);
      setRecentActivity(payload.recentActivity);
      setRecommendedCourses(payload.recommendedCourses);
      setTrainingPartners(payload.trainingPartners);
      setInsights(payload.insights);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [tick]);

  // ── Derived ───────────────────────────────────────────────────────────────

  const filteredPriority = useMemo(() => {
    const lc = prioritySearch.toLowerCase();
    return priorityRows.filter((r) => {
      if (prioritySearch && !r.skill_name.toLowerCase().includes(lc) && !(r.dept_name ?? "").toLowerCase().includes(lc)) return false;
      if (filterPriority !== "all" && r.priority !== filterPriority) return false;
      return true;
    });
  }, [priorityRows, prioritySearch, filterPriority]);

  const totalPriorityPages = Math.ceil(filteredPriority.length / PRIORITY_PAGE_SIZE);
  const pagedPriority      = filteredPriority.slice(priorityPage * PRIORITY_PAGE_SIZE, (priorityPage + 1) * PRIORITY_PAGE_SIZE);

  const maxSpend = useMemo(() => Math.max(...spendByMonth.map((s) => s.spend), 1), [spendByMonth]);

  // ── KPI cards ─────────────────────────────────────────────────────────────

  const kpiCards = useMemo(() => [
    {
      label: "Engineers Needing Training",
      value: String(stats.engineersNeedingTraining),
      sub: "Flagged in skills assessment",
      icon: GraduationCap,
      valueClass: stats.engineersNeedingTraining > 0 ? "text-orange-400" : "text-emerald-400",
    },
    {
      label: "Critical Gaps",
      value: String(stats.criticalGaps),
      sub: "Risk level: critical",
      icon: AlertTriangle,
      valueClass: stats.criticalGaps > 0 ? "text-red-500" : "text-emerald-400",
    },
    {
      label: "Expiring in 30 Days",
      value: String(stats.expiringIn30Days),
      sub: "Certifications at risk",
      icon: Shield,
      valueClass: stats.expiringIn30Days > 0 ? "text-orange-400" : "text-emerald-400",
    },
    {
      label: "Spend YTD",
      value: fmtCurrency(stats.totalSpendGBP),
      sub: `${stats.totalBookings} total bookings`,
      icon: TrendingUp,
      valueClass: "text-slate-50",
    },
    {
      label: "Compliance",
      value: `${stats.compliancePct}%`,
      sub: `${stats.completed} of ${stats.totalBookings} completed`,
      icon: CheckCircle2,
      valueClass: stats.compliancePct >= 80 ? "text-emerald-400" : stats.compliancePct >= 50 ? "text-yellow-400" : "text-red-400",
    },
  ], [stats]);

  // ─────────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <section className="relative flex min-w-0 w-full max-w-full flex-1 grow flex-col items-start gap-6 overflow-x-hidden px-4 pb-12 pt-0 md:gap-8 md:px-6 xl:px-8">

      <BookingDrawer item={selectedItem} onClose={() => setSelectedItem(null)} onStatusChange={handleStatusChange} />

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 z-[60] -translate-x-1/2 rounded-xl border border-emerald-500/30 bg-[#0d1117] px-5 py-3 text-sm font-medium text-emerald-400 shadow-2xl">
          {toast}
        </div>
      )}

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header className="flex w-full flex-col justify-between gap-4 py-5 lg:flex-row lg:items-center">
        <div className="flex flex-col items-start gap-1">
          <p className="text-xs font-medium text-slate-500">Alpha Manufacturing</p>
          <div className="flex items-center gap-2">
            <h1 className="font-text-xl-semibold text-[length:var(--text-xl-semibold-font-size)] font-[number:var(--text-xl-semibold-font-weight)] leading-[var(--text-xl-semibold-line-height)] tracking-[var(--text-xl-semibold-letter-spacing)] text-slate-50">
              Training
            </h1>
            <ContextHelp content={{
              title: "Training Bookings",
              body:  "Manage and track all training bookings for your engineering team. View upcoming courses, completion rates, costs and compliance gaps.",
              usage: "Use Add Booking to schedule training. Filter by status or engineer to find specific records. Export to share training plans with management.",
              aiNote: "Vorta AI ranks engineers for training based on skill gaps, SPOF risk and equipment criticality — helping you prioritise training investment.",
            }} />
          </div>
          <p className="text-sm text-slate-400">Prioritise training gaps, compliance risks and development needs across your maintenance team.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3 self-start lg:self-auto">
          <Button type="button" variant="outline" className="h-auto gap-2 border-[#ffffff20] bg-[#ffffff1a] px-4 py-2 text-sm font-semibold text-slate-50 hover:bg-[#ffffff24] hover:text-slate-50">
            <Download className="h-4 w-4" /> Export
          </Button>
          <Button type="button" className="h-auto gap-2 bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500">
            <Plus className="h-4 w-4" /> Create Training Plan
          </Button>
          <ExplainWithAi pageId="training" />
          <button type="button" onClick={() => setTick((t) => t + 1)} disabled={loading}
            className="inline-flex h-10 w-10 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-[#ffffff1a] hover:text-slate-200 disabled:opacity-50">
            <RefreshCw className={`h-5 w-5 ${loading ? "animate-spin" : ""}`} />
          </button>
          <button type="button"
            className="inline-flex h-10 w-10 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-[#ffffff1a] hover:text-slate-200">
            <UserCircle className="h-8 w-8" />
          </button>
        </div>
      </header>

      {/* ── Sync + AI actions ────────────────────────────────────────────── */}
      <div className="flex w-full flex-col gap-4">
        <SyncIndicator loading={loading} source="Supabase" confidence={stats.compliancePct > 0 ? Math.min(95, Math.round(stats.compliancePct * 0.9 + 10)) : undefined} />
        {!loading && !loadError && (
          <AiActionsPanel actions={[
            { label: "Book priority training now", description: `${stats.criticalGaps} critical skill gap${stats.criticalGaps !== 1 ? "s" : ""} require immediate training. AI has identified engineers and ranked recommended courses.`, priority: "critical", icon: GraduationCap, href: "/training-providers" },
            { label: "Renew expiring certifications", description: `${stats.expiringIn30Days} certification${stats.expiringIn30Days !== 1 ? "s" : ""} expire within 30 days. Book renewals before skills lapse and create compliance risk.`, priority: stats.expiringIn30Days > 0 ? "high" : "medium", icon: AlertTriangle },
            { label: "Create training plan for the quarter", description: "Use AI Matching to generate a prioritised training plan based on skill gaps, equipment risk and compliance deadlines.", priority: "medium", icon: BookOpen, href: "/ai-matching" },
            { label: "Review training spend vs ROI", description: `£${stats.totalSpendGBP.toLocaleString()} spent on training to date. Compare this against risk reduction and compliance improvements.`, priority: "low", icon: TrendingUp },
          ] as AiAction[]} />
        )}
      </div>

      <div className="flex min-w-0 w-full max-w-full flex-col items-start gap-6">

        {/* ── KPI cards ──────────────────────────────────────────────────────── */}
        <section className="grid w-full grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {kpiCards.map(({ label, value, sub, icon: Icon, valueClass }) => (
            <Card key={label} className="min-w-0 h-full rounded-xl border border-gray-800 bg-[#141820] shadow-none">
              <CardContent className="flex min-w-0 h-full flex-col gap-3 p-5">
                <div className="flex min-w-0 items-center justify-between gap-2">
                  <p className="min-w-0 truncate text-xs font-medium text-slate-400">{label}</p>
                  <Icon className="h-4 w-4 shrink-0 text-slate-600" />
                </div>
                <p className={`truncate text-xl font-semibold tabular-nums ${valueClass}`}>
                  {loading ? "—" : value}
                </p>
                <p className="truncate text-[11px] text-slate-500">{sub}</p>
              </CardContent>
            </Card>
          ))}
        </section>

        {/* ── Error banner ───────────────────────────────────────────────────── */}
        {loadError && (
          <div className="flex w-full flex-col items-center gap-3 rounded-xl border border-red-500/20 bg-[#ef444408] py-10 text-center">
            <AlertTriangle className="h-7 w-7 text-red-500/60" />
            <div>
              <p className="font-medium text-red-400">Failed to load training data</p>
              <p className="mt-1 text-sm text-slate-500">Unable to connect to the database.</p>
            </div>
            <button type="button" onClick={() => setTick((t) => t + 1)}
              className="rounded-lg border border-red-500/20 px-4 py-2 text-sm font-medium text-red-400 transition-colors hover:bg-red-500/10">
              Try again
            </button>
          </div>
        )}

        {!loadError && (
          <>
            {/* ── AI Insights + Spend chart ─────────────────────────────────────── */}
            <div className="grid w-full grid-cols-1 gap-6 xl:grid-cols-2">

              {/* AI Insights */}
              <Card className="min-w-0 rounded-xl border border-gray-800 bg-[#141820] shadow-none">
                <CardContent className="flex min-w-0 flex-col gap-4 p-5">
                  <div className="flex items-center gap-2">
                    <h2 className="font-semibold text-slate-50">AI Training Insights</h2>
                    <Badge className="inline-flex h-auto items-center gap-1.5 rounded bg-[#3b82f620] px-2 py-1 text-xs font-medium text-blue-500 shadow-none hover:bg-[#3b82f620]">
                      <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />Live
                    </Badge>
                  </div>
                  <div className="flex flex-col gap-3">
                    {loading
                      ? Array.from({ length: 4 }).map((_, i) => (
                          <div key={i} className="rounded-lg border border-gray-800 p-4">
                            <SkeletonLine w="w-48" />
                            <div className="mt-2"><SkeletonLine w="w-full" h="h-3" /></div>
                          </div>
                        ))
                      : insights.length === 0
                      ? (
                          <div className="flex flex-col items-center gap-2 py-8 text-center">
                            <CheckCircle2 className="h-8 w-8 text-emerald-400/50" />
                            <p className="text-sm font-medium text-emerald-400">No critical issues found</p>
                            <p className="text-xs text-slate-500">Training is on track.</p>
                          </div>
                        )
                      : insights.map((ins, i) => {
                          const conf = insightConf(ins.severity);
                          const Icon = conf.icon;
                          return (
                            <div key={i} className={`flex items-start gap-2.5 rounded-lg border ${conf.border} ${conf.bg} p-4`}>
                              <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${conf.iconCls}`} />
                              <div className="min-w-0 flex-1">
                                <p className={`text-sm font-semibold ${conf.titleCls}`}>{ins.title}</p>
                                <p className="mt-1 text-xs leading-relaxed text-slate-400">{ins.text}</p>
                              </div>
                            </div>
                          );
                        })}
                  </div>
                </CardContent>
              </Card>

              {/* Spend by Month + dept breakdown */}
              <Card className="min-w-0 rounded-xl border border-gray-800 bg-[#141820] shadow-none">
                <CardContent className="flex min-w-0 flex-col gap-4 p-5">
                  <div className="flex items-center justify-between">
                    <h2 className="font-semibold text-slate-50">Training Spend</h2>
                    <span className="text-[11px] text-slate-500">Last 6 months</span>
                  </div>

                  {/* Bar chart */}
                  {loading ? (
                    <div className="flex items-end gap-2 h-24">
                      {Array.from({ length: 6 }).map((_, i) => (
                        <div key={i} className="flex-1 animate-pulse rounded-sm bg-gray-800" style={{ height: `${40 + i * 10}%` }} />
                      ))}
                    </div>
                  ) : spendByMonth.length === 0 ? (
                    <div className="flex flex-col items-center gap-2 py-4 text-center">
                      <TrendingUp className="h-6 w-6 text-slate-700" />
                      <p className="text-sm text-slate-500">No spend data available.</p>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-end gap-1.5 h-24">
                        {spendByMonth.map((m) => {
                          const pct = Math.max((m.spend / maxSpend) * 100, 4);
                          return (
                            <div key={m.month} className="group relative flex flex-1 flex-col items-center">
                              <div
                                className="w-full rounded-sm bg-blue-500/30 transition-all group-hover:bg-blue-500/60"
                                style={{ height: `${pct}%` }}
                                title={`${m.label}: ${fmtCurrency(m.spend)}`}
                              />
                            </div>
                          );
                        })}
                      </div>
                      <div className="flex items-center gap-1.5">
                        {spendByMonth.map((m) => (
                          <span key={m.month} className="flex-1 text-center text-[10px] text-slate-500">{m.label}</span>
                        ))}
                      </div>
                    </>
                  )}

                  {/* Total + dept breakdown */}
                  <div className="border-t border-gray-800 pt-3">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs text-slate-500">Total YTD</span>
                      <span className="text-sm font-semibold tabular-nums text-slate-200">{loading ? "—" : fmtCurrency(stats.totalSpendGBP)}</span>
                    </div>
                    <div className="flex flex-col gap-2.5">
                      {loading
                        ? Array.from({ length: 3 }).map((_, i) => (
                            <div key={i} className="flex flex-col gap-1">
                              <SkeletonLine w="w-28" h="h-3" />
                              <div className="h-1.5 w-full animate-pulse rounded bg-gray-800/60" />
                            </div>
                          ))
                        : bookingsByDept.map((d) => (
                            <div key={d.dept} className="flex flex-col gap-1">
                              <div className="flex items-center justify-between">
                                <span className="text-[11px] text-slate-400 truncate">{d.dept}</span>
                                <span className="ml-2 shrink-0 text-[11px] tabular-nums text-slate-500">{fmtCurrency(d.spend)}</span>
                              </div>
                              <Progress value={d.pct} className={`h-1.5 overflow-hidden rounded bg-gray-800 ${coverageBarClass(d.pct)}`} />
                            </div>
                          ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* ── Certification Risk + Recommended Courses ──────────────────────── */}
            <div className="grid w-full grid-cols-1 gap-6 xl:grid-cols-2">

              {/* Certification Risk */}
              <Card className="min-w-0 rounded-xl border border-gray-800 bg-[#141820] shadow-none">
                <CardContent className="flex min-w-0 flex-col gap-4 p-5">
                  <div className="flex items-center justify-between">
                    <h2 className="font-semibold text-slate-50">Certification Risk</h2>
                    {!loading && certRiskRows.length > 0 && (
                      <Badge className="inline-flex h-auto rounded bg-[#f9731620] px-2 py-0.5 text-[10px] font-medium text-orange-400 shadow-none hover:bg-[#f9731620]">
                        {certRiskRows.length} at risk
                      </Badge>
                    )}
                  </div>
                  {loading ? (
                    <div className="flex flex-col gap-3">
                      {Array.from({ length: 4 }).map((_, i) => (
                        <div key={i} className="flex items-center justify-between gap-3 py-2 border-b border-gray-800">
                          <SkeletonLine w="w-32" />
                          <SkeletonLine w="w-20" />
                        </div>
                      ))}
                    </div>
                  ) : certRiskRows.length === 0 ? (
                    <div className="flex flex-col items-center gap-2 py-8 text-center">
                      <CheckCircle2 className="h-8 w-8 text-emerald-400/50" />
                      <p className="text-sm font-medium text-emerald-400">All certifications current</p>
                      <p className="text-xs text-slate-500">No certifications expiring within 90 days.</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-gray-800">
                      {certRiskRows.map((r, i) => (
                        <div key={i} className="flex items-center justify-between gap-3 py-3">
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-slate-200">{r.skill_name}</p>
                            <p className="truncate text-[11px] text-slate-500">{r.engineer_name}</p>
                          </div>
                          <div className="flex shrink-0 flex-col items-end gap-1">
                            <Badge className={`inline-flex h-auto rounded px-2 py-0.5 text-[10px] font-medium shadow-none ${certStatusBadgeClass(r.status)}`}>
                              {r.status}
                            </Badge>
                            <span className="text-[10px] text-slate-500">
                              {r.days_left < 0 ? `${Math.abs(r.days_left)}d overdue` : `${r.days_left}d remaining`}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Recommended Courses */}
              <Card className="min-w-0 rounded-xl border border-gray-800 bg-[#141820] shadow-none">
                <CardContent className="flex min-w-0 flex-col gap-4 p-5">
                  <div className="flex items-center justify-between">
                    <h2 className="font-semibold text-slate-50">Available Courses</h2>
                    <span className="text-[11px] text-slate-500">{loading ? "—" : `${recommendedCourses.length} active`}</span>
                  </div>
                  {loading ? (
                    <div className="flex flex-col gap-3">
                      {Array.from({ length: 4 }).map((_, i) => (
                        <div key={i} className="rounded-lg border border-gray-800 p-3">
                          <SkeletonLine w="w-40" />
                          <div className="mt-2"><SkeletonLine w="w-24" h="h-3" /></div>
                        </div>
                      ))}
                    </div>
                  ) : recommendedCourses.length === 0 ? (
                    <div className="flex flex-col items-center gap-2 py-8 text-center">
                      <BookOpen className="h-8 w-8 text-slate-700" />
                      <p className="text-sm text-slate-500">No courses available.</p>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-2">
                      {recommendedCourses.slice(0, 6).map((c) => (
                        <div
                          key={c.id}
                          onClick={() => setSelectedItem({ id: c.id, course_title: c.title, engineer_name: null, department: null, status: "booked", booking_date: null, cost: c.price, currency: c.currency, delivery_type: c.delivery_type, partner_name: c.partner_name, skills_covered: c.skills_covered, duration_days: c.duration_days })}
                          className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-gray-800 bg-[#0b0e14] px-4 py-3 transition-colors hover:border-gray-700 hover:bg-[#141820]"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-slate-200">{c.title}</p>
                            <div className="mt-1 flex flex-wrap items-center gap-2">
                              {c.partner_name && <span className="text-[11px] text-slate-500">{c.partner_name}</span>}
                              {c.delivery_type && (
                                <Badge className={`inline-flex h-auto rounded px-1.5 py-0.5 text-[9px] font-medium shadow-none ${deliveryBadgeClass(c.delivery_type)}`}>
                                  {c.delivery_type}
                                </Badge>
                              )}
                              {c.duration_days > 0 && <span className="text-[11px] text-slate-500">{c.duration_days}d</span>}
                            </div>
                          </div>
                          <div className="flex shrink-0 flex-col items-end gap-1">
                            <span className="text-sm font-semibold tabular-nums text-slate-200">{fmtCurrency(c.price, c.currency)}</span>
                            {c.bookings > 0 && <span className="text-[10px] text-slate-500">{c.bookings} booked</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* ── Training Priority Register ──────────────────────────────────────── */}
            <Card className="min-w-0 w-full rounded-xl border border-gray-800 bg-[#141820] shadow-none">
              <CardContent className="flex min-w-0 flex-col gap-4 p-5">

                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h2 className="font-semibold text-slate-50">Training Priority Register</h2>
                    <p className="text-sm text-slate-400">
                      {loading ? "Loading…" : `${filteredPriority.length} of ${priorityRows.length} skill gaps`}
                      {totalPriorityPages > 1 ? ` · page ${Math.min(priorityPage + 1, totalPriorityPages)} of ${totalPriorityPages}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {(prioritySearch || filterPriority !== "all") && (
                      <button type="button" onClick={() => { setPrioritySearch(""); setFilterPriority("all"); setPriorityPage(0); }}
                        className="flex items-center gap-1 text-xs font-medium text-slate-500 transition-colors hover:text-slate-200">
                        <X className="h-3 w-3" /> Clear
                      </button>
                    )}
                    <div className="flex items-center gap-1">
                      <button type="button" onClick={() => setPriorityPage((p) => Math.max(0, p - 1))} disabled={priorityPage === 0 || loading}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-gray-800 text-slate-400 transition-colors hover:bg-[#ffffff1a] hover:text-slate-200 disabled:opacity-30">
                        <ChevronLeft className="h-4 w-4" />
                      </button>
                      <button type="button" onClick={() => setPriorityPage((p) => Math.min(totalPriorityPages - 1, p + 1))} disabled={priorityPage >= totalPriorityPages - 1 || loading}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-gray-800 text-slate-400 transition-colors hover:bg-[#ffffff1a] hover:text-slate-200 disabled:opacity-30">
                        <ChevronRight className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative min-w-[160px] flex-1 sm:max-w-xs">
                    <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
                    <input
                      type="text"
                      placeholder="Search skills…"
                      value={prioritySearch}
                      onChange={(e) => { setPrioritySearch(e.target.value); setPriorityPage(0); }}
                      className="h-8 w-full rounded-lg border border-gray-800 bg-[#0b0e14] pl-8 pr-3 text-sm text-slate-200 placeholder:text-slate-600 focus:border-blue-500/50 focus:outline-none focus:ring-1 focus:ring-blue-500/30"
                    />
                  </div>
                  <Select
                    value={filterPriority}
                    onChange={(v) => { setFilterPriority(v); setPriorityPage(0); }}
                    options={[
                      { value: "all",      label: "All Priorities" },
                      { value: "Critical", label: "Critical"       },
                      { value: "High",     label: "High"           },
                      { value: "Medium",   label: "Medium"         },
                      { value: "Low",      label: "Low"            },
                    ]}
                    placeholder="All Priorities"
                    size="sm"
                  />
                </div>

                <div className="w-full max-w-full overflow-x-auto rounded-lg border border-gray-800">
                  <table className="w-max min-w-[740px] border-collapse text-sm">
                    <thead>
                      <tr className="border-b border-gray-800 bg-[#0f1318]">
                        {[
                          { label: "Skill / Gap",   cls: "sticky left-0 z-10 bg-[#0f1318] min-w-[200px]" },
                          { label: "Department",    cls: "min-w-[130px]" },
                          { label: "Current Avg",  cls: "min-w-[100px] text-center" },
                          { label: "Target",        cls: "min-w-[70px] text-center" },
                          { label: "Gap",           cls: "min-w-[60px] text-center" },
                          { label: "Priority",      cls: "min-w-[90px]" },
                          { label: "Recommendation",cls: "min-w-[180px]" },
                        ].map(({ label, cls }) => (
                          <th key={label} className={`px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-500 ${cls}`}>
                            {label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {loading
                        ? Array.from({ length: PRIORITY_PAGE_SIZE }).map((_, i) => (
                            <tr key={i} className="border-b border-gray-800/50 bg-[#141820]">
                              {Array.from({ length: 7 }).map((_, j) => (
                                <td key={j} className="px-4 py-3">
                                  <div className="h-4 w-20 animate-pulse rounded bg-gray-800" />
                                </td>
                              ))}
                            </tr>
                          ))
                        : pagedPriority.length === 0
                        ? (
                            <tr>
                              <td colSpan={7} className="py-12 text-center text-sm text-slate-500">
                                No training gaps found. Your team meets the selected requirements.
                              </td>
                            </tr>
                          )
                        : pagedPriority.map((row, idx) => {
                            const rowBg = idx % 2 === 0 ? "bg-[#141820]" : "bg-[#111620]";
                            const gapColor = row.gap === 0 ? "text-emerald-400" : row.gap <= 3 ? "text-yellow-400" : "text-red-400";
                            return (
                              <tr key={row.id} className={`border-b border-gray-800/50 ${rowBg} transition-colors hover:bg-[#1a2030]`}>
                                <td className={`sticky left-0 z-10 min-w-[200px] px-4 py-2.5 ${rowBg}`}>
                                  <div className="flex flex-col gap-0.5">
                                    <div className="flex items-center gap-1.5">
                                      <span className="font-medium text-slate-200 leading-tight">{row.skill_name}</span>
                                      {row.single_point_of_failure && (
                                        <Badge className="inline-flex h-auto rounded bg-[#ef444420] px-1 py-0.5 text-[9px] font-medium text-red-500 shadow-none hover:bg-[#ef444420]">
                                          SPOF
                                        </Badge>
                                      )}
                                      {row.is_critical && (
                                        <Shield className="h-3 w-3 shrink-0 text-blue-400" title="Critical skill" />
                                      )}
                                    </div>
                                    <span className="text-[11px] text-slate-500">{row.category}</span>
                                  </div>
                                </td>
                                <td className="px-4 py-2.5 text-sm text-slate-400">{row.dept_name ?? "—"}</td>
                                <td className="px-4 py-2.5 text-center">
                                  <span className={`text-sm font-semibold tabular-nums ${row.current_avg >= row.target_rating ? "text-emerald-400" : "text-yellow-400"}`}>
                                    {row.current_avg.toFixed(1)}/5
                                  </span>
                                </td>
                                <td className="px-4 py-2.5 text-center">
                                  <span className="text-sm font-semibold tabular-nums text-slate-200">{row.target_rating}/5</span>
                                </td>
                                <td className={`px-4 py-2.5 text-center text-sm font-semibold tabular-nums ${gapColor}`}>
                                  {row.gap > 0 ? row.gap : "—"}
                                </td>
                                <td className="px-4 py-2.5">
                                  <Badge className={`inline-flex h-auto rounded px-2 py-0.5 text-[10px] font-medium shadow-none ${priorityBadgeClass(row.priority)}`}>
                                    {row.priority}
                                  </Badge>
                                </td>
                                <td className="px-4 py-2.5 text-[11px] text-slate-400">
                                  <span className="line-clamp-2">{row.recommendation || "—"}</span>
                                </td>
                              </tr>
                            );
                          })}
                    </tbody>
                  </table>
                </div>

                {!loading && totalPriorityPages > 1 && (
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span>
                      {priorityPage * PRIORITY_PAGE_SIZE + 1}–{Math.min((priorityPage + 1) * PRIORITY_PAGE_SIZE, filteredPriority.length)} of {filteredPriority.length}
                    </span>
                    <div className="flex items-center gap-1">
                      {Array.from({ length: Math.min(totalPriorityPages, 8) }).map((_, i) => (
                        <button key={i} type="button" onClick={() => setPriorityPage(i)}
                          className={`inline-flex h-7 w-7 items-center justify-center rounded-lg text-xs transition-colors ${i === priorityPage ? "bg-blue-500/20 font-semibold text-blue-400" : "text-slate-500 hover:bg-[#ffffff1a]"}`}>
                          {i + 1}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

              </CardContent>
            </Card>

            {/* ── Training Providers ──────────────────────────────────────────────── */}
            {trainingPartners.length > 0 && (
              <Card className="min-w-0 w-full rounded-xl border border-gray-800 bg-[#141820] shadow-none">
                <CardContent className="flex min-w-0 flex-col gap-4 p-5">
                  <h2 className="font-semibold text-slate-50">Training Providers</h2>
                  <div className="grid w-full grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                    {trainingPartners.map((p) => (
                      <div key={p.id} className="flex flex-col gap-3 rounded-lg border border-gray-800 bg-[#0b0e14] p-4">
                        <div className="flex items-start justify-between gap-2">
                          <p className="font-semibold text-slate-200">{p.name}</p>
                          <Badge className={`inline-flex h-auto shrink-0 rounded px-2 py-0.5 text-[10px] font-medium shadow-none ${p.status === "active" ? "bg-[#10b98120] text-emerald-500" : "bg-gray-800 text-slate-400"}`}>
                            {p.status}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
                          <MapPin className="h-3 w-3 shrink-0" />
                          {p.location}
                        </div>
                        <p className="text-[11px] text-slate-500">{p.course_count} course{p.course_count !== 1 ? "s" : ""}</p>
                        <button type="button"
                          className="mt-auto rounded-lg border border-gray-700 px-3 py-1.5 text-[11px] font-medium text-slate-400 transition-colors hover:border-gray-600 hover:bg-[#ffffff0a] hover:text-slate-200">
                          View Provider
                        </button>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* ── Recent Bookings (compact — full table on Bookings page) ─────────── */}
            <Card className="min-w-0 w-full rounded-xl border border-gray-800 bg-[#141820] shadow-none">
              <CardContent className="flex min-w-0 flex-col gap-3 p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="font-semibold text-slate-50">Recent Bookings</h2>
                    <p className="text-[11px] text-slate-500 mt-0.5">Latest activity · full management on Bookings page</p>
                  </div>
                  <span className="text-[11px] text-slate-500">{loading ? "—" : `${recentActivity.length} shown`}</span>
                </div>

                {loading ? (
                  <div className="flex flex-col">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <div key={i} className="flex items-center gap-3 border-b border-gray-800/60 py-2.5">
                        <div className="h-7 w-7 animate-pulse rounded-full bg-gray-800" />
                        <div className="flex flex-1 items-center justify-between gap-4">
                          <SkeletonLine w="w-36" />
                          <SkeletonLine w="w-20" h="h-3" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : recentActivity.length === 0 ? (
                  <div className="flex flex-col items-center gap-2 py-6 text-center">
                    <Sparkles className="h-6 w-6 text-slate-700" />
                    <p className="text-sm text-slate-500">No recent bookings.</p>
                  </div>
                ) : (
                  <div className="flex flex-col divide-y divide-gray-800/60">
                    {recentActivity.slice(0, 8).map((b) => {
                      const effectiveStatus = localStatuses[b.id] ?? b.status;
                      const verb = effectiveStatus === "completed" ? "completed" : effectiveStatus === "approved" ? "approved" : effectiveStatus === "pending_approval" ? "pending" : effectiveStatus === "cancelled" ? "rejected" : "booked";
                      return (
                        <div
                          key={b.id}
                          onClick={() => setSelectedItem({ ...b, status: effectiveStatus })}
                          className="flex cursor-pointer items-center gap-3 py-2.5 transition-colors hover:bg-[#ffffff04]"
                        >
                          <div className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[9px] font-semibold ${avatarColor(b.engineer_name)}`}>
                            {getInitials(b.engineer_name)}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm text-slate-200">
                              <span className="font-medium">{b.engineer_name ?? "Unknown"}</span>
                              <span className="text-slate-500"> · </span>
                              <span className="text-slate-400">{b.course_title}</span>
                            </p>
                          </div>
                          <div className="flex shrink-0 items-center gap-3">
                            <span className="hidden text-[11px] text-slate-500 sm:block">{fmtDate(b.booking_date)}</span>
                            <Badge className={`inline-flex h-auto rounded px-1.5 py-0.5 text-[9px] font-medium shadow-none ${bookingStatusBadgeClass(effectiveStatus)}`}>
                              {verb}
                            </Badge>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}

      </div>
    </section>
  );
};
