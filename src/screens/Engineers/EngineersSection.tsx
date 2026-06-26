import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Award,
  BookOpen,
  Brain,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleUser as UserCircle,
  Download,
  GraduationCap,
  Mail,
  MapPin,
  MessageSquare,
  Network,
  Plus,
  RefreshCw,
  Search,
  Shield,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Users,
  X,
  Zap,
} from "lucide-react";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Card, CardContent } from "../../components/ui/card";
import { supabase } from "../../lib/supabaseClient";
import {
  CertEntry,
  DrawerEngineer,
  EngineerDrawer,
  EnrichedAssignment,
  GapRow,
  TrainingBooking,
  getAvatarColor,
  getInitials,
} from "./EngineerDrawer";

// ─── Types ────────────────────────────────────────────────────────────────────

interface EngineersStats {
  totalEngineers: number;
  verifiedEngineers: number;
  currentlyAvailable: number;
  onShiftToday: number;
  inTraining: number;
  criticalHolders: number;
  avgCompetencyScore: number;
  certificationsExpiring30d: number;
}

interface Department { id: string; name: string }
interface Site       { id: string; name: string; region: string }

// ─── Constants ────────────────────────────────────────────────────────────────

const TABLE_PAGE_SIZE = 10;
const DIR_PAGE_SIZE   = 8;

const RISK_ORDER: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };

// ─── Helpers ──────────────────────────────────────────────────────────────────

function riskBadgeClass(level: string): string {
  switch (level) {
    case "critical": return "bg-[#ef444420] text-red-500";
    case "high":     return "bg-[#f9731620] text-orange-400";
    case "medium":   return "bg-[#facc1520] text-yellow-400";
    default:         return "bg-[#10b98120] text-emerald-500";
  }
}

function availBadgeClass(status: string): string {
  switch (status) {
    case "available":   return "bg-[#10b98120] text-emerald-400";
    case "on_shift":    return "bg-[#3b82f620] text-blue-400";
    default:            return "bg-[#ef444420] text-red-400";
  }
}

function formatAvailStatus(s: string): string {
  switch (s) {
    case "available":   return "Available";
    case "on_shift":    return "On Shift";
    case "unavailable": return "Unavailable";
    default:            return s;
  }
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function RingScore({ value, size = 34 }: { value: number; size?: number }) {
  const STROKE = 2.5, R = (size - STROKE) / 2;
  const circ   = 2 * Math.PI * R;
  const offset = circ * (1 - value / 100);
  const color  = value >= 80 ? "#10b981" : value >= 68 ? "#facc15" : "#ef4444";
  return (
    <div className="relative inline-flex shrink-0 items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }} aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={R} fill="none" stroke="#1f293780" strokeWidth={STROKE} />
        <circle cx={size / 2} cy={size / 2} r={R} fill="none"
          stroke={color} strokeWidth={STROKE}
          strokeDasharray={circ} strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 0.5s ease" }}
        />
      </svg>
      <span className="absolute text-[9px] font-bold tabular-nums leading-none" style={{ color, fontSize: size <= 30 ? "8px" : "9px" }}>
        {value}
      </span>
    </div>
  );
}

const CAT_CHIP: Record<string, string> = {
  "Automation & Controls":           "border-blue-500/20 bg-blue-500/10 text-blue-400",
  "Electrical Maintenance":          "border-yellow-400/20 bg-yellow-400/10 text-yellow-300",
  "Mechanical Maintenance":          "border-orange-400/20 bg-orange-400/10 text-orange-300",
  "Pharmaceutical Compliance":       "border-emerald-500/20 bg-emerald-500/10 text-emerald-400",
  "Pharmaceutical Equipment":        "border-teal-500/20 bg-teal-500/10 text-teal-400",
  "CMMS / Maintenance Systems":      "border-sky-500/20 bg-sky-500/10 text-sky-400",
  "Reliability Engineering":         "border-cyan-500/20 bg-cyan-500/10 text-cyan-400",
  "Certifications & Qualifications": "border-amber-400/20 bg-amber-400/10 text-amber-300",
  "Bosch OEM Expertise":             "border-rose-500/20 bg-rose-500/10 text-rose-400",
  "Pharmaceutical OEM Expertise":    "border-pink-500/20 bg-pink-500/10 text-pink-400",
};

function catChipClass(cat: string) { return CAT_CHIP[cat] ?? "border-gray-700 bg-gray-800 text-slate-400"; }

function chipLabel(name: string): string {
  const map: Record<string, string> = {
    "Allen Bradley PLC": "A-B PLC", "Siemens TIA Portal": "Siemens TIA",
    "Groninger Filling Lines": "Groninger", "Bausch+Stroebel Filling Lines": "B+S Lines",
    "Bosch Vial Fillers": "Bosch Fill", "Electrical Fault Finding": "Elec. Fault",
    "Data Integrity": "Data Int.", "Freeze Dryers": "Freeze Dry",
    "Condition Monitoring": "Cond. Mon.", "Hydraulic Systems": "Hydraulics",
  };
  return map[name] ?? (name.length > 13 ? `${name.slice(0, 12)}…` : name);
}

function SkillChips({ skills, max = 3 }: { skills: DrawerEngineer["top_skills"]; max?: number }) {
  const shown = skills.slice(0, max);
  const extra = skills.length - shown.length;
  if (shown.length === 0) return null;
  return (
    <div className="mt-1 flex flex-wrap gap-1">
      {shown.map((s, i) => (
        <span key={i} className={`inline-flex items-center rounded border px-1.5 py-[1px] text-[9px] font-medium leading-snug ${catChipClass(s.category)}`}>
          {chipLabel(s.name)}
        </span>
      ))}
      {extra > 0 && (
        <span className="inline-flex items-center rounded border border-gray-700 px-1.5 py-[1px] text-[9px] font-medium text-slate-500">
          +{extra}
        </span>
      )}
    </div>
  );
}

function CertDots({ certs }: { certs: CertEntry[] }) {
  if (!certs.length) return null;
  const now   = Date.now();
  const thirty = 30 * 24 * 60 * 60 * 1000;
  return (
    <div className="flex items-center gap-1">
      {certs.slice(0, 3).map((c, i) => {
        const expired  = c.expiry_date && new Date(c.expiry_date).getTime() < now;
        const expiring = c.expiry_date && !expired && new Date(c.expiry_date).getTime() < now + thirty;
        const dot      = expired ? "bg-red-500" : expiring ? "bg-amber-400" : c.verification_status === "validated" ? "bg-emerald-400" : "bg-amber-400";
        const lbl      = expired ? "Expired" : expiring ? "Expiring soon" : c.verification_status === "validated" ? "Valid" : capitalize(c.verification_status);
        const lblCls   = expired ? "text-red-400" : expiring ? "text-amber-400" : "text-emerald-400";
        return (
          <div key={i} className="group/cert relative">
            <span className={`inline-flex h-2 w-2 rounded-full ${dot} cursor-default`} />
            <div className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 -translate-x-1/2 whitespace-nowrap rounded-lg border border-gray-700 bg-[#1a2030] px-2.5 py-1.5 text-left opacity-0 shadow-xl transition-opacity duration-150 group-hover/cert:opacity-100">
              <p className="text-[10px] font-semibold text-slate-100">{c.skill_name}</p>
              <p className={`mt-0.5 text-[9px] font-medium ${lblCls}`}>{lbl}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** Single row in the Engineer Directory list panel */
function DirectoryRow({
  eng, isActive, onClick,
}: {
  eng: DrawerEngineer;
  isActive: boolean;
  onClick: () => void;
}) {
  const critPct = eng.critical_skills_count > 0
    ? Math.round((eng.critical_skills_met / eng.critical_skills_count) * 100) : 100;

  return (
    <div
      onClick={onClick}
      className={`flex cursor-pointer items-center gap-3 border-b border-gray-800/60 px-4 py-3 transition-colors hover:bg-[#1a2030] ${
        isActive ? "bg-blue-500/10 border-l-2 border-l-blue-500/60" : "border-l-2 border-l-transparent"
      }`}
    >
      {/* Avatar */}
      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-xs font-bold ${getAvatarColor(eng.full_name)}`}>
        {getInitials(eng.full_name)}
      </div>

      {/* Name + role + chips */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <p className="truncate text-sm font-medium leading-tight text-slate-200">{eng.full_name}</p>
          {eng.verified && <CheckCircle2 className="h-3 w-3 shrink-0 text-emerald-400" />}
          <CertDots certs={eng.certifications} />
        </div>
        <p className="mt-0.5 truncate text-[11px] leading-tight text-slate-500">{eng.discipline ?? "—"}</p>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5">
          {eng.department_name && <span className="truncate text-[10px] text-slate-500">{eng.department_name}</span>}
          {eng.site_name && (
            <span className="flex items-center gap-0.5 text-[10px] text-slate-600">
              <MapPin className="h-2.5 w-2.5 shrink-0" />{eng.site_name}
            </span>
          )}
        </div>
        <SkillChips skills={eng.top_skills} max={3} />
      </div>

      {/* Right: availability + competency ring + risk */}
      <div className="flex shrink-0 flex-col items-end gap-1.5">
        <Badge className={`inline-flex h-auto rounded px-1.5 py-0.5 text-[9px] font-medium shadow-none ${availBadgeClass(eng.availability_status)}`}>
          {formatAvailStatus(eng.availability_status)}
        </Badge>
        <div className="flex items-center gap-1.5">
          <RingScore value={eng.skills_score} size={28} />
          <Badge className={`inline-flex h-auto rounded px-1.5 py-0.5 text-[9px] font-medium shadow-none ${riskBadgeClass(eng.risk_level)}`}>
            {capitalize(eng.risk_level)}
          </Badge>
        </div>
        {eng.training_count > 0 && (
          <span className="text-[9px] font-medium text-orange-400">{eng.training_count} gap{eng.training_count !== 1 ? "s" : ""}</span>
        )}
      </div>
    </div>
  );
}

/** Mobile engineer card */
function MobileEngineerCard({ eng, isActive, onClick }: { eng: DrawerEngineer; isActive: boolean; onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      className={`cursor-pointer rounded-xl border p-4 transition-colors ${
        isActive ? "border-blue-500/40 bg-blue-500/10" : "border-gray-800 bg-[#141820] hover:border-gray-700 hover:bg-[#1a2030]"
      }`}
    >
      <div className="flex items-start gap-3">
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-bold ${getAvatarColor(eng.full_name)}`}>
          {getInitials(eng.full_name)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <p className="font-medium leading-tight text-slate-200">{eng.full_name}</p>
            {eng.verified && <CheckCircle2 className="h-3 w-3 shrink-0 text-emerald-400" />}
            <CertDots certs={eng.certifications} />
          </div>
          <p className="mt-0.5 truncate text-[11px] leading-tight text-slate-500">{eng.discipline ?? "—"}</p>
          <SkillChips skills={eng.top_skills} max={3} />
        </div>
        <RingScore value={eng.skills_score} />
      </div>
      {(eng.department_name || eng.site_name) && (
        <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400">
          {eng.department_name && <span>{eng.department_name}</span>}
          {eng.site_name && <span className="flex items-center gap-1"><MapPin className="h-3 w-3 text-slate-600" />{eng.site_name}</span>}
        </div>
      )}
      <div className="mt-2.5 flex flex-wrap items-center gap-2">
        <Badge className={`inline-flex h-auto rounded px-2 py-0.5 text-[10px] font-medium shadow-none ${availBadgeClass(eng.availability_status)}`}>
          {formatAvailStatus(eng.availability_status)}
        </Badge>
        <Badge className={`inline-flex h-auto rounded px-2 py-0.5 text-[10px] font-medium shadow-none ${riskBadgeClass(eng.risk_level)}`}>
          {capitalize(eng.risk_level)} Risk
        </Badge>
        {eng.training_count > 0 && (
          <span className="text-[10px] font-medium text-orange-400">{eng.training_count} gap{eng.training_count !== 1 ? "s" : ""}</span>
        )}
      </div>
    </div>
  );
}

// ─── Fetch ────────────────────────────────────────────────────────────────────

async function fetchEngineers(): Promise<{
  engineers: DrawerEngineer[];
  assignments: EnrichedAssignment[];
  trainingBookings: TrainingBooking[];
  skillGaps: GapRow[];
  departments: Department[];
  sites: Site[];
  stats: EngineersStats;
  error?: boolean;
}> {
  const { data, error } = await supabase.functions.invoke("engineers-data");
  if (error || !data) {
    return {
      engineers: [], assignments: [], trainingBookings: [], skillGaps: [],
      departments: [], sites: [],
      stats: { totalEngineers: 0, verifiedEngineers: 0, currentlyAvailable: 0, onShiftToday: 0, inTraining: 0, criticalHolders: 0, avgCompetencyScore: 0, certificationsExpiring30d: 0 },
      error: true,
    };
  }
  return {
    engineers:        (data.engineers        ?? []) as DrawerEngineer[],
    assignments:      (data.assignments      ?? []) as EnrichedAssignment[],
    trainingBookings: (data.trainingBookings ?? []) as TrainingBooking[],
    skillGaps:        (data.skillGaps        ?? []) as GapRow[],
    departments:      (data.departments      ?? []) as Department[],
    sites:            (data.sites            ?? []) as Site[],
    stats: data.stats as EngineersStats,
  };
}

// ─── Main component ───────────────────────────────────────────────────────────

export const EngineersSection = (): JSX.Element => {
  const [engineers,        setEngineers]        = useState<DrawerEngineer[]>([]);
  const [assignments,      setAssignments]      = useState<EnrichedAssignment[]>([]);
  const [trainingBookings, setTrainingBookings] = useState<TrainingBooking[]>([]);
  const [skillGaps,        setSkillGaps]        = useState<GapRow[]>([]);
  const [departments,      setDepartments]      = useState<Department[]>([]);
  const [sites,            setSites]            = useState<Site[]>([]);
  const [stats,            setStats]            = useState<EngineersStats>({
    totalEngineers: 0, verifiedEngineers: 0, currentlyAvailable: 0, onShiftToday: 0,
    inTraining: 0, criticalHolders: 0, avgCompetencyScore: 0, certificationsExpiring30d: 0,
  });
  const [loading,   setLoading]   = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [tick,      setTick]      = useState(0);

  const [selectedEngineer, setSelectedEngineer] = useState<DrawerEngineer | null>(null);

  const [search,               setSearch]               = useState("");
  const [filterDept,           setFilterDept]           = useState("all");
  const [filterSite,           setFilterSite]           = useState("all");
  const [filterAvailability,   setFilterAvailability]   = useState("all");
  const [filterRisk,           setFilterRisk]           = useState("all");

  const [dirPage,   setDirPage]   = useState(0);
  const [tablePage, setTablePage] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(false);
    fetchEngineers().then((payload) => {
      if (cancelled) return;
      if (payload.error) { setLoadError(true); setLoading(false); return; }
      setEngineers(payload.engineers);
      setAssignments(payload.assignments);
      setTrainingBookings(payload.trainingBookings);
      setSkillGaps(payload.skillGaps);
      setDepartments(payload.departments);
      setSites(payload.sites);
      setStats(payload.stats);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [tick]);

  // ── Derived ───────────────────────────────────────────────────────────────

  const filteredEngineers = useMemo(() => {
    const lc = search.toLowerCase();
    return engineers
      .filter((eng) => {
        if (search && !eng.full_name.toLowerCase().includes(lc) && !(eng.discipline ?? "").toLowerCase().includes(lc)) return false;
        if (filterDept !== "all"          && eng.department_name !== filterDept)             return false;
        if (filterSite !== "all"          && eng.site_name !== filterSite)                   return false;
        if (filterAvailability !== "all"  && eng.availability_status !== filterAvailability) return false;
        if (filterRisk !== "all"          && eng.risk_level !== filterRisk)                  return false;
        return true;
      })
      .sort((a, b) => (RISK_ORDER[a.risk_level] ?? 9) - (RISK_ORDER[b.risk_level] ?? 9) || a.full_name.localeCompare(b.full_name));
  }, [engineers, search, filterDept, filterSite, filterAvailability, filterRisk]);

  const hasActiveFilters = !!(search || filterDept !== "all" || filterSite !== "all" || filterAvailability !== "all" || filterRisk !== "all");

  const resetFilters = () => {
    setSearch(""); setFilterDept("all"); setFilterSite("all");
    setFilterAvailability("all"); setFilterRisk("all");
    setDirPage(0); setTablePage(0);
  };

  const totalDirPages   = Math.ceil(filteredEngineers.length / DIR_PAGE_SIZE);
  const pagedDirectory  = filteredEngineers.slice(dirPage * DIR_PAGE_SIZE, (dirPage + 1) * DIR_PAGE_SIZE);
  const totalTablePages = Math.ceil(filteredEngineers.length / TABLE_PAGE_SIZE);
  const pagedTable      = filteredEngineers.slice(tablePage * TABLE_PAGE_SIZE, (tablePage + 1) * TABLE_PAGE_SIZE);

  const siteNames = useMemo(() => [...new Set(engineers.map((e) => e.site_name).filter(Boolean))] as string[], [engineers]);
  const deptNames = useMemo(() => departments.map((d) => d.name).sort(), [departments]);

  // ── AI Insights for Engineers ─────────────────────────────────────────────

  const insights = useMemo(() => {
    const items: { severity: "critical" | "high" | "medium"; icon: React.ElementType; title: string; text: string; filterKey?: string }[] = [];

    const critRisk = engineers.filter((e) => e.risk_level === "critical");
    if (critRisk.length > 0) {
      items.push({
        severity: "critical", icon: AlertTriangle,
        title: `${critRisk.length} engineer${critRisk.length !== 1 ? "s" : ""} at critical risk`,
        text: `${critRisk.slice(0, 2).map(e => e.full_name).join(", ")}${critRisk.length > 2 ? ` +${critRisk.length - 2} more` : ""} — immediate review required.`,
        filterKey: "critical",
      });
    }

    const highRiskHolders = engineers.filter((e) => e.critical_knowledge_holder && (e.retirement_risk === "high" || e.leaving_risk === "high"));
    if (highRiskHolders.length > 0) {
      items.push({
        severity: "critical", icon: Shield,
        title: `${highRiskHolders.length} knowledge holder${highRiskHolders.length !== 1 ? "s" : ""} at high attrition risk`,
        text: "Critical expertise may exit without succession cover. Initiate knowledge transfer within 30 days.",
      });
    }

    const needTraining = engineers.filter((e) => e.training_count > 0);
    if (needTraining.length > 0) {
      const totalGaps = needTraining.reduce((s, e) => s + e.training_count, 0);
      items.push({
        severity: needTraining.length > 10 ? "high" : "medium", icon: Brain,
        title: `${totalGaps} training gaps across ${needTraining.length} engineers`,
        text: "Prioritise critical and compliance skills first to reduce operational risk exposure.",
        filterKey: "training",
      });
    }

    const expiring = engineers.filter((e) =>
      e.certifications.some((c) => {
        if (!c.expiry_date) return false;
        const t = new Date(c.expiry_date).getTime();
        return t > Date.now() && t < Date.now() + 30 * 24 * 60 * 60 * 1000;
      })
    );
    if (expiring.length > 0) {
      items.push({
        severity: "medium", icon: Zap,
        title: `${expiring.length} engineer${expiring.length !== 1 ? "s" : ""} with certifications expiring in 30 days`,
        text: "Schedule renewals to maintain site compliance. Expired certifications may block deployment.",
      });
    }

    const availGap = engineers.filter((e) => e.availability_status === "unavailable").length;
    if (availGap > 3) {
      items.push({
        severity: "medium", icon: TrendingUp,
        title: `${availGap} engineers currently unavailable`,
        text: "Check shift patterns and leave schedule to ensure adequate coverage for critical operations.",
      });
    }

    return items.slice(0, 4);
  }, [engineers]);

  const kpiCards = useMemo(() => [
    { label: "Total Engineers",      value: String(stats.totalEngineers),            sub: `${stats.verifiedEngineers} verified`,       icon: Users,         valueClass: "text-slate-50"    },
    { label: "Verified",             value: String(stats.verifiedEngineers),          sub: `${stats.totalEngineers > 0 ? Math.round((stats.verifiedEngineers / stats.totalEngineers) * 100) : 0}% of workforce`, icon: CheckCircle2, valueClass: stats.verifiedEngineers === stats.totalEngineers ? "text-emerald-400" : "text-yellow-400" },
    { label: "Available Now",        value: String(stats.currentlyAvailable),        sub: "Ready to deploy",                           icon: Users,         valueClass: "text-emerald-400" },
    { label: "On Shift",             value: String(stats.onShiftToday),              sub: "Active right now",                          icon: TrendingDown,  valueClass: "text-blue-400"    },
    { label: "In Training",          value: String(stats.inTraining),                sub: "Active bookings",                           icon: GraduationCap, valueClass: stats.inTraining > 0 ? "text-orange-400" : "text-slate-50" },
    { label: "Critical SMEs",        value: String(stats.criticalHolders),           sub: "Key knowledge holders",                     icon: Shield,        valueClass: "text-blue-400"    },
    { label: "Avg Competency",       value: `${stats.avgCompetencyScore}%`,          sub: "Across all engineers",                      icon: Sparkles,      valueClass: stats.avgCompetencyScore >= 80 ? "text-emerald-400" : stats.avgCompetencyScore >= 68 ? "text-yellow-400" : "text-red-400" },
    { label: "Certs Expiring (30d)", value: String(stats.certificationsExpiring30d), sub: "Require renewal",                           icon: AlertTriangle, valueClass: stats.certificationsExpiring30d > 0 ? "text-red-400" : "text-emerald-400" },
  ], [stats]);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <section className="relative flex min-w-0 w-full max-w-full flex-1 grow flex-col items-start gap-6 overflow-x-hidden px-4 pb-12 pt-0 md:px-6 xl:px-8">

      <EngineerDrawer
        engineer={selectedEngineer}
        assignments={assignments}
        trainingBookings={trainingBookings}
        skillGaps={skillGaps}
        onClose={() => setSelectedEngineer(null)}
      />

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header className="flex w-full flex-col justify-between gap-4 py-5 lg:flex-row lg:items-center">
        <div className="flex flex-col items-start gap-1">
          <p className="text-xs font-medium text-slate-500">Alpha Manufacturing</p>
          <h1 className="font-text-xl-semibold text-[length:var(--text-xl-semibold-font-size)] font-[number:var(--text-xl-semibold-font-weight)] leading-[var(--text-xl-semibold-line-height)] tracking-[var(--text-xl-semibold-letter-spacing)] text-slate-50">
            Engineers
          </h1>
          <p className="text-sm text-slate-400">Workforce Management &amp; Engineer Profiles</p>
        </div>
        <div className="flex flex-wrap items-center gap-3 self-start lg:self-auto">
          <Button type="button" variant="outline" className="h-auto gap-2 border-[#ffffff20] bg-[#ffffff1a] px-4 py-2 text-sm font-semibold text-slate-50 hover:bg-[#ffffff24] hover:text-slate-50">
            <Download className="h-4 w-4" /> Export
          </Button>
          <Button type="button" variant="outline" className="h-auto gap-2 border-[#ffffff20] bg-[#ffffff1a] px-4 py-2 text-sm font-semibold text-slate-50 hover:bg-[#ffffff24] hover:text-slate-50">
            <Sparkles className="h-4 w-4" /> AI Report
          </Button>
          <Button type="button" className="h-auto gap-2 bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500">
            <Plus className="h-4 w-4" /> Add Engineer
          </Button>
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

      <div className="flex min-w-0 w-full max-w-full flex-col items-start gap-6">

        {/* ── KPI cards: 2 mobile → 4 tablet → 8 desktop ─────────────────────── */}
        <section className="grid w-full grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4">
          {kpiCards.map(({ label, value, sub, icon: Icon, valueClass }) => (
            <Card key={label} className="h-full rounded-xl border border-gray-800 bg-[#141820] shadow-none">
              <CardContent className="flex h-full flex-col gap-3 p-4 xl:p-5">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-slate-400">{label}</p>
                  <Icon className="h-4 w-4 text-slate-600" />
                </div>
                <p className={`text-xl font-semibold tabular-nums ${valueClass}`}>{loading ? "—" : value}</p>
                <p className="text-[11px] text-slate-500">{sub}</p>
              </CardContent>
            </Card>
          ))}
        </section>

        {/* ── Two-panel row: Directory + Insights ─────────────────────────────── */}
        <div className="grid w-full grid-cols-1 gap-6 xl:grid-cols-[1fr_380px]">

          {/* ── LEFT: Engineer Directory ──────────────────────────────────────── */}
          <Card className="rounded-xl border border-gray-800 bg-[#141820] shadow-none">
            <CardContent className="flex flex-col gap-4 p-5">

              {/* Directory header */}
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="font-semibold text-slate-50">Engineer Directory</h2>
                  <p className="text-sm text-slate-400">
                    {loading ? "Loading…" : `${filteredEngineers.length} of ${engineers.length} engineers`}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {hasActiveFilters && (
                    <button type="button" onClick={resetFilters}
                      className="flex items-center gap-1 text-xs font-medium text-slate-500 transition-colors hover:text-slate-200">
                      <X className="h-3 w-3" /> Clear
                    </button>
                  )}
                  <Badge className="inline-flex h-auto items-center gap-1.5 rounded bg-[#3b82f620] px-2 py-1 text-xs font-medium text-blue-500 shadow-none hover:bg-[#3b82f620]">
                    <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />Live
                  </Badge>
                </div>
              </div>

              {/* Filters */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative min-w-[160px] flex-1">
                  <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
                  <input type="text" placeholder="Search engineers…" value={search}
                    onChange={(e) => { setSearch(e.target.value); setDirPage(0); setTablePage(0); }}
                    className="h-8 w-full rounded-lg border border-gray-800 bg-[#0b0e14] pl-8 pr-3 text-sm text-slate-200 placeholder:text-slate-600 focus:border-blue-500/50 focus:outline-none focus:ring-1 focus:ring-blue-500/30" />
                </div>
                <select value={filterDept} onChange={(e) => { setFilterDept(e.target.value); setDirPage(0); setTablePage(0); }}
                  className="h-8 rounded-lg border border-gray-800 bg-[#0b0e14] px-3 text-sm text-slate-300 focus:outline-none">
                  <option value="all">All Departments</option>
                  {deptNames.map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
                <select value={filterSite} onChange={(e) => { setFilterSite(e.target.value); setDirPage(0); setTablePage(0); }}
                  className="h-8 rounded-lg border border-gray-800 bg-[#0b0e14] px-3 text-sm text-slate-300 focus:outline-none">
                  <option value="all">All Sites</option>
                  {siteNames.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
                <select value={filterAvailability} onChange={(e) => { setFilterAvailability(e.target.value); setDirPage(0); setTablePage(0); }}
                  className="h-8 rounded-lg border border-gray-800 bg-[#0b0e14] px-3 text-sm text-slate-300 focus:outline-none">
                  <option value="all">All Availability</option>
                  <option value="available">Available</option>
                  <option value="on_shift">On Shift</option>
                  <option value="unavailable">Unavailable</option>
                </select>
                <select value={filterRisk} onChange={(e) => { setFilterRisk(e.target.value); setDirPage(0); setTablePage(0); }}
                  className="h-8 rounded-lg border border-gray-800 bg-[#0b0e14] px-3 text-sm text-slate-300 focus:outline-none">
                  <option value="all">All Risk Levels</option>
                  <option value="critical">Critical</option>
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
              </div>

              {/* Error */}
              {loadError && (
                <div className="flex flex-col items-center gap-3 rounded-xl border border-red-500/20 bg-[#ef444408] py-10 text-center">
                  <AlertTriangle className="h-7 w-7 text-red-500/60" />
                  <div>
                    <p className="font-medium text-red-400">Failed to load engineers</p>
                    <p className="mt-1 text-sm text-slate-500">Unable to connect to the database.</p>
                  </div>
                  <button type="button" onClick={() => setTick((t) => t + 1)}
                    className="rounded-lg border border-red-500/20 px-4 py-2 text-sm font-medium text-red-400 transition-colors hover:bg-red-500/10">
                    Try again
                  </button>
                </div>
              )}

              {/* Mobile cards < md */}
              {!loadError && (
                <div className="block md:hidden">
                  {loading ? (
                    <div className="flex flex-col gap-3">
                      {Array.from({ length: 4 }).map((_, i) => (
                        <div key={i} className="rounded-xl border border-gray-800 bg-[#141820] p-4">
                          <div className="flex items-start gap-3">
                            <div className="h-10 w-10 animate-pulse rounded-xl bg-gray-800" />
                            <div className="flex-1">
                              <div className="h-4 w-32 animate-pulse rounded bg-gray-800" />
                              <div className="mt-1 h-2.5 w-20 animate-pulse rounded bg-gray-800/60" />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : filteredEngineers.length === 0 ? (
                    <div className="flex flex-col items-center gap-3 py-10 text-center">
                      <Users className="h-8 w-8 text-slate-700" />
                      <p className="text-sm text-slate-500">No engineers match the current filters.</p>
                      {hasActiveFilters && (
                        <button type="button" onClick={resetFilters} className="text-sm font-medium text-blue-400 hover:underline">Clear filters</button>
                      )}
                    </div>
                  ) : (
                    <div className="flex flex-col gap-3">
                      {pagedDirectory.map((eng) => (
                        <MobileEngineerCard key={eng.id} eng={eng}
                          isActive={selectedEngineer?.id === eng.id}
                          onClick={() => setSelectedEngineer(selectedEngineer?.id === eng.id ? null : eng)} />
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Desktop/tablet list rows md+ */}
              {!loadError && (
                <div className="hidden md:block">
                  {loading ? (
                    <div className="divide-y divide-gray-800/60">
                      {Array.from({ length: DIR_PAGE_SIZE }).map((_, i) => (
                        <div key={i} className="flex items-center gap-3 px-4 py-3">
                          <div className="h-9 w-9 animate-pulse rounded-xl bg-gray-800" />
                          <div className="flex-1">
                            <div className="h-3.5 w-32 animate-pulse rounded bg-gray-800" />
                            <div className="mt-1 h-2.5 w-20 animate-pulse rounded bg-gray-800/60" />
                            <div className="mt-1.5 flex gap-1">
                              {[32, 28, 36].map((w, j) => <div key={j} className="h-3 animate-pulse rounded bg-gray-800/40" style={{ width: w }} />)}
                            </div>
                          </div>
                          <div className="flex shrink-0 flex-col items-end gap-1">
                            <div className="h-4 w-16 animate-pulse rounded bg-gray-800" />
                            <div className="h-4 w-12 animate-pulse rounded bg-gray-800/60" />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : filteredEngineers.length === 0 ? (
                    <div className="flex flex-col items-center gap-3 py-10 text-center">
                      <Users className="h-8 w-8 text-slate-700" />
                      <p className="text-sm text-slate-500">No engineers match the current filters.</p>
                      {hasActiveFilters && (
                        <button type="button" onClick={resetFilters} className="text-sm font-medium text-blue-400 hover:underline">Clear filters</button>
                      )}
                    </div>
                  ) : (
                    <div className="rounded-lg border border-gray-800/60 bg-[#0f1318]">
                      {/* Column header */}
                      <div className="flex items-center gap-3 border-b border-gray-800 px-4 py-2">
                        <span className="w-9 shrink-0" />
                        <span className="flex-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Engineer</span>
                        <span className="shrink-0 text-right text-[10px] font-semibold uppercase tracking-wider text-slate-500">Availability · Score · Risk</span>
                      </div>
                      {pagedDirectory.map((eng) => (
                        <DirectoryRow key={eng.id} eng={eng}
                          isActive={selectedEngineer?.id === eng.id}
                          onClick={() => setSelectedEngineer(selectedEngineer?.id === eng.id ? null : eng)} />
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Directory pagination */}
              {!loading && !loadError && totalDirPages > 1 && (
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span>{dirPage * DIR_PAGE_SIZE + 1}–{Math.min((dirPage + 1) * DIR_PAGE_SIZE, filteredEngineers.length)} of {filteredEngineers.length}</span>
                  <div className="flex items-center gap-1">
                    <button type="button" onClick={() => setDirPage((p) => Math.max(0, p - 1))} disabled={dirPage === 0}
                      className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-gray-800 text-slate-400 transition-colors hover:bg-[#ffffff1a] disabled:opacity-30">
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    {Array.from({ length: Math.min(totalDirPages, 5) }).map((_, i) => (
                      <button key={i} type="button" onClick={() => setDirPage(i)}
                        className={`inline-flex h-7 w-7 items-center justify-center rounded-lg text-xs transition-colors ${i === dirPage ? "bg-blue-500/20 font-semibold text-blue-400" : "text-slate-500 hover:bg-[#ffffff1a]"}`}>
                        {i + 1}
                      </button>
                    ))}
                    <button type="button" onClick={() => setDirPage((p) => Math.min(totalDirPages - 1, p + 1))} disabled={dirPage >= totalDirPages - 1}
                      className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-gray-800 text-slate-400 transition-colors hover:bg-[#ffffff1a] disabled:opacity-30">
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              )}

            </CardContent>
          </Card>

          {/* ── RIGHT: Engineer Insights ──────────────────────────────────────── */}
          <Card className="rounded-xl border border-gray-800 bg-[#141820] shadow-none">
            <CardContent className="flex flex-col gap-4 p-5">

              <div className="flex items-center gap-2">
                <h2 className="font-semibold text-slate-50">Engineer Insights</h2>
                <Badge className="inline-flex h-auto items-center gap-1.5 rounded bg-[#3b82f620] px-2 py-1 text-xs font-medium text-blue-500 shadow-none hover:bg-[#3b82f620]">
                  <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />Live
                </Badge>
              </div>

              {/* Insight cards */}
              <div className="flex flex-col gap-3">
                {loading
                  ? Array.from({ length: 4 }).map((_, i) => (
                      <div key={i} className="rounded-lg border border-gray-800 p-4">
                        <div className="h-4 w-48 animate-pulse rounded bg-gray-800" />
                        <div className="mt-2 h-3 w-full animate-pulse rounded bg-gray-800/60" />
                      </div>
                    ))
                  : insights.length === 0
                  ? (
                      <div className="flex flex-col items-center gap-2 py-8 text-center">
                        <CheckCircle2 className="h-8 w-8 text-emerald-400/50" />
                        <p className="text-sm font-medium text-emerald-400">All clear</p>
                        <p className="text-xs text-slate-500">No critical issues detected.</p>
                      </div>
                    )
                  : insights.map((ins, i) => {
                      const conf =
                        ins.severity === "critical"
                          ? { bg: "bg-[#ef444408]", border: "border-red-500/20",    icon: "text-red-500",    title: "text-red-400"    }
                          : ins.severity === "high"
                          ? { bg: "bg-[#f9731608]", border: "border-orange-400/20", icon: "text-orange-400", title: "text-orange-300" }
                          : { bg: "bg-[#facc1508]", border: "border-yellow-400/20", icon: "text-yellow-400", title: "text-yellow-300" };
                      const Icon = ins.icon;
                      return (
                        <div key={i} className={`flex flex-col gap-3 rounded-lg border ${conf.border} ${conf.bg} p-4`}>
                          <div className="flex items-start gap-2.5">
                            <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${conf.icon}`} />
                            <div className="min-w-0 flex-1">
                              <p className={`text-sm font-semibold ${conf.title}`}>{ins.title}</p>
                              <p className="mt-1 text-xs leading-relaxed text-slate-400">{ins.text}</p>
                            </div>
                          </div>
                          {ins.filterKey && (
                            <button type="button"
                              onClick={() => { setFilterRisk(ins.filterKey === "critical" ? "critical" : "all"); setDirPage(0); }}
                              className={`self-start rounded-lg border ${conf.border} px-3 py-1.5 text-xs font-medium ${conf.title} transition-colors hover:bg-[#ffffff08]`}>
                              Filter Engineers →
                            </button>
                          )}
                        </div>
                      );
                    })}
              </div>

              {/* Quick stats: knowledge holders */}
              {!loading && !loadError && (
                <div className="mt-2 border-t border-gray-800 pt-4">
                  <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Knowledge Holders</p>
                  <div className="flex flex-col gap-2">
                    {engineers.filter((e) => e.critical_knowledge_holder).slice(0, 5).map((eng) => (
                      <div key={eng.id}
                        onClick={() => setSelectedEngineer(selectedEngineer?.id === eng.id ? null : eng)}
                        className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-gray-800 bg-[#0b0e14] px-3 py-2 transition-colors hover:border-gray-700 hover:bg-[#141820]">
                        <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[10px] font-bold ${getAvatarColor(eng.full_name)}`}>
                          {getInitials(eng.full_name)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-medium text-slate-200">{eng.full_name}</p>
                          <p className="truncate text-[10px] text-slate-500">{eng.department_name ?? eng.discipline ?? "—"}</p>
                        </div>
                        <Shield className="h-3.5 w-3.5 shrink-0 text-blue-400" />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Availability summary */}
              {!loading && !loadError && engineers.length > 0 && (
                <div className="border-t border-gray-800 pt-4">
                  <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Availability Overview</p>
                  {[
                    { label: "Available", key: "available",   cls: "bg-emerald-500" },
                    { label: "On Shift",  key: "on_shift",    cls: "bg-blue-500"    },
                    { label: "Unavailable", key: "unavailable", cls: "bg-red-500"   },
                  ].map(({ label, key, cls }) => {
                    const count = engineers.filter((e) => e.availability_status === key).length;
                    const pct   = engineers.length > 0 ? (count / engineers.length) * 100 : 0;
                    return (
                      <div key={key} className="mb-2 flex items-center gap-2">
                        <span className="w-20 shrink-0 text-[11px] text-slate-400">{label}</span>
                        <div className="flex-1 overflow-hidden rounded-full bg-gray-800 h-1.5">
                          <div className={`h-1.5 rounded-full transition-all ${cls}`} style={{ width: `${pct}%` }} />
                        </div>
                        <span className="w-6 text-right text-[11px] tabular-nums text-slate-500">{count}</span>
                      </div>
                    );
                  })}
                </div>
              )}

            </CardContent>
          </Card>
        </div>

        {/* ── Engineer Skills Overview (detailed table, internal scroll) ────── */}
        <Card className="w-full rounded-xl border border-gray-800 bg-[#141820] shadow-none">
          <CardContent className="flex flex-col gap-4 p-5">

            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-semibold text-slate-50">Engineer Skills Overview</h2>
                <p className="text-sm text-slate-400">
                  {filteredEngineers.length} engineers · page {Math.min(tablePage + 1, totalTablePages || 1)} of {totalTablePages || 1}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => setTablePage((p) => Math.max(0, p - 1))} disabled={tablePage === 0 || loading}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-gray-800 text-slate-400 transition-colors hover:bg-[#ffffff1a] disabled:opacity-30">
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button type="button" onClick={() => setTablePage((p) => Math.min(totalTablePages - 1, p + 1))} disabled={tablePage >= totalTablePages - 1 || loading}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-gray-800 text-slate-400 transition-colors hover:bg-[#ffffff1a] disabled:opacity-30">
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="w-full max-w-full overflow-x-auto rounded-lg border border-gray-800">
              <table className="w-max min-w-[720px] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-gray-800 bg-[#0f1318]">
                    {[
                      { label: "Engineer",       cls: "sticky left-0 z-10 bg-[#0f1318] min-w-[160px]" },
                      { label: "Department",     cls: "min-w-[120px]" },
                      { label: "Site",           cls: "min-w-[100px]" },
                      { label: "Availability",   cls: "min-w-[100px]" },
                      { label: "Competency",     cls: "min-w-[90px] text-center" },
                      { label: "AI Confidence",  cls: "min-w-[100px] text-right" },
                      { label: "Critical Skills",cls: "min-w-[110px] text-right" },
                      { label: "Training Gaps",  cls: "min-w-[110px] text-right" },
                      { label: "Knowledge",      cls: "min-w-[90px] text-center"  },
                      { label: "Certs",          cls: "min-w-[60px] text-center"  },
                      { label: "Last Active",    cls: "min-w-[110px]" },
                      { label: "Risk",           cls: "min-w-[80px]"  },
                    ].map(({ label, cls }) => (
                      <th key={label} className={`px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-500 ${cls}`}>
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loading
                    ? Array.from({ length: TABLE_PAGE_SIZE }).map((_, i) => (
                        <tr key={i} className="border-b border-gray-800/50 bg-[#141820]">
                          {Array.from({ length: 12 }).map((_, j) => (
                            <td key={j} className="px-4 py-3">
                              <div className="h-4 w-16 animate-pulse rounded bg-gray-800" />
                            </td>
                          ))}
                        </tr>
                      ))
                    : pagedTable.length === 0
                    ? (
                        <tr>
                          <td colSpan={12} className="py-12 text-center text-sm text-slate-500">
                            No engineers match the current filters.{" "}
                            {hasActiveFilters && (
                              <button type="button" onClick={resetFilters} className="font-medium text-blue-400 hover:underline">
                                Clear filters
                              </button>
                            )}
                          </td>
                        </tr>
                      )
                    : pagedTable.map((eng, idx) => {
                        const rowBg   = idx % 2 === 0 ? "bg-[#141820]" : "bg-[#111620]";
                        const critPct = eng.critical_skills_count > 0 ? Math.round((eng.critical_skills_met / eng.critical_skills_count) * 100) : 100;
                        const isActive = selectedEngineer?.id === eng.id;
                        return (
                          <tr key={eng.id}
                            onClick={() => setSelectedEngineer(isActive ? null : eng)}
                            className={`group/row cursor-pointer border-b border-gray-800/50 transition-colors hover:bg-[#1a2030] ${isActive ? "bg-blue-500/10" : rowBg}`}>

                            {/* Engineer — sticky */}
                            <td className={`sticky left-0 z-10 min-w-[160px] px-4 py-2.5 ${isActive ? "bg-blue-500/10" : rowBg}`}>
                              <div className="flex items-center gap-2">
                                <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[10px] font-bold ${getAvatarColor(eng.full_name)}`}>
                                  {getInitials(eng.full_name)}
                                </div>
                                <div className="min-w-0">
                                  <div className="flex items-center gap-1">
                                    <p className="truncate text-sm font-medium text-slate-200">{eng.full_name}</p>
                                    {eng.verified && <CheckCircle2 className="h-2.5 w-2.5 shrink-0 text-emerald-400" />}
                                  </div>
                                  <p className="truncate text-[10px] text-slate-500">{eng.discipline ?? "—"}</p>
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-2.5 text-sm text-slate-400">{eng.department_name ?? "—"}</td>
                            <td className="px-4 py-2.5">
                              {eng.site_name
                                ? <span className="flex items-center gap-1 text-sm text-slate-400"><MapPin className="h-3 w-3 shrink-0 text-slate-600" />{eng.site_name}</span>
                                : <span className="text-slate-600">—</span>}
                            </td>
                            <td className="px-4 py-2.5">
                              <Badge className={`inline-flex h-auto rounded px-2 py-0.5 text-[10px] font-medium shadow-none ${availBadgeClass(eng.availability_status)}`}>
                                {formatAvailStatus(eng.availability_status)}
                              </Badge>
                            </td>
                            <td className="px-4 py-2.5 text-center">
                              <RingScore value={eng.skills_score} size={28} />
                            </td>
                            <td className="px-4 py-2.5 text-right">
                              <span className="text-sm font-semibold tabular-nums text-blue-400">{eng.ai_confidence}%</span>
                            </td>
                            <td className="px-4 py-2.5 text-right">
                              <span className={`text-sm font-semibold tabular-nums ${critPct >= 80 ? "text-emerald-400" : critPct >= 60 ? "text-yellow-400" : "text-red-400"}`}>
                                {eng.critical_skills_met}
                              </span>
                              <span className="text-xs text-slate-600">/{eng.critical_skills_count}</span>
                            </td>
                            <td className="px-4 py-2.5 text-right">
                              {eng.training_count > 0
                                ? <span className="text-sm font-semibold text-orange-400 tabular-nums">{eng.training_count}</span>
                                : <span className="text-slate-600">0</span>}
                            </td>
                            <td className="px-4 py-2.5 text-center">
                              {eng.critical_knowledge_holder
                                ? <Shield className="mx-auto h-4 w-4 text-blue-400" title="Critical knowledge holder" />
                                : <span className="text-slate-700">—</span>}
                            </td>
                            <td className="px-4 py-2.5 text-center">
                              <div className="flex justify-center gap-1">
                                <CertDots certs={eng.certifications} />
                              </div>
                            </td>
                            <td className="px-4 py-2.5 text-sm text-slate-400">{formatDate(eng.last_assessment_date)}</td>
                            <td className="px-4 py-2.5">
                              <Badge className={`inline-flex h-auto rounded px-2 py-0.5 text-[10px] font-medium shadow-none ${riskBadgeClass(eng.risk_level)}`}>
                                {capitalize(eng.risk_level)}
                              </Badge>
                            </td>
                          </tr>
                        );
                      })}
                </tbody>
              </table>
            </div>

            {/* Table pagination */}
            {!loading && totalTablePages > 1 && (
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>{tablePage * TABLE_PAGE_SIZE + 1}–{Math.min((tablePage + 1) * TABLE_PAGE_SIZE, filteredEngineers.length)} of {filteredEngineers.length}</span>
                <div className="flex items-center gap-1">
                  {Array.from({ length: totalTablePages }).map((_, i) => (
                    <button key={i} type="button" onClick={() => setTablePage(i)}
                      className={`inline-flex h-7 w-7 items-center justify-center rounded-lg text-xs transition-colors ${i === tablePage ? "bg-blue-500/20 font-semibold text-blue-400" : "text-slate-500 hover:bg-[#ffffff1a]"}`}>
                      {i + 1}
                    </button>
                  ))}
                </div>
              </div>
            )}

          </CardContent>
        </Card>

      </div>
    </section>
  );
};
