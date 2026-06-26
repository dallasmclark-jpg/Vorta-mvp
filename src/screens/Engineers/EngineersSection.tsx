import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Award,
  BookOpen,
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
  Users,
  X,
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

function catChipClass(category: string): string {
  return CAT_CHIP[category] ?? "border-gray-700 bg-gray-800 text-slate-400";
}

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

function rowAccent(eng: DrawerEngineer): string {
  if (eng.risk_level === "critical") return "border-l-2 border-l-red-500/40";
  if (eng.training_count > 2)        return "border-l-2 border-l-amber-400/35";
  if (eng.skills_score >= 80 && eng.verified) return "border-l-2 border-l-emerald-500/25";
  return "border-l-2 border-l-transparent";
}

const RISK_ORDER: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };

// ─── Sub-components ───────────────────────────────────────────────────────────

function RingScore({ value }: { value: number }) {
  const SIZE = 36, STROKE = 2.5, R = (SIZE - STROKE) / 2;
  const circ = 2 * Math.PI * R;
  const offset = circ * (1 - value / 100);
  const color = value >= 80 ? "#10b981" : value >= 68 ? "#facc15" : "#ef4444";
  return (
    <div className="relative inline-flex shrink-0 items-center justify-center" style={{ width: SIZE, height: SIZE }}>
      <svg width={SIZE} height={SIZE} style={{ transform: "rotate(-90deg)" }} aria-hidden="true">
        <circle cx={SIZE / 2} cy={SIZE / 2} r={R} fill="none" stroke="#1f293780" strokeWidth={STROKE} />
        <circle
          cx={SIZE / 2} cy={SIZE / 2} r={R} fill="none"
          stroke={color} strokeWidth={STROKE}
          strokeDasharray={circ} strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 0.5s ease" }}
        />
      </svg>
      <span className="absolute text-[9px] font-bold tabular-nums leading-none" style={{ color }}>{value}</span>
    </div>
  );
}

function chipLabel(name: string): string {
  const map: Record<string, string> = {
    "Allen Bradley PLC": "A-B PLC",
    "Siemens TIA Portal": "Siemens TIA",
    "Groninger Filling Lines": "Groninger",
    "Bausch+Stroebel Filling Lines": "B+S Lines",
    "Bosch Vial Fillers": "Bosch Fill",
    "Electrical Fault Finding": "Elec. Fault",
    "Data Integrity": "Data Int.",
    "Freeze Dryers": "Freeze Dry",
    "Condition Monitoring": "Cond. Mon.",
    "Hydraulic Systems": "Hydraulics",
  };
  return map[name] ?? (name.length > 13 ? `${name.slice(0, 12)}…` : name);
}

function SkillChips({ skills, max = 5 }: { skills: DrawerEngineer["top_skills"]; max?: number }) {
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
  const now = Date.now();
  const thirty = 30 * 24 * 60 * 60 * 1000;
  return (
    <div className="flex items-center gap-1">
      {certs.slice(0, 4).map((c, i) => {
        const isExpired  = c.expiry_date && new Date(c.expiry_date).getTime() < now;
        const isExpiring = c.expiry_date && !isExpired && new Date(c.expiry_date).getTime() < now + thirty;
        const dot = isExpired ? "bg-red-500" : isExpiring ? "bg-amber-400" : c.verification_status === "validated" ? "bg-emerald-400" : "bg-amber-400";
        const label = isExpired ? "Expired" : isExpiring ? "Expiring soon" : c.verification_status === "validated" ? "Valid" : capitalize(c.verification_status);
        const labelCls = isExpired ? "text-red-400" : isExpiring ? "text-amber-400" : "text-emerald-400";
        return (
          <div key={i} className="group/cert relative">
            <span className={`inline-flex h-2 w-2 rounded-full ${dot} cursor-default`} />
            <div className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 -translate-x-1/2 whitespace-nowrap rounded-lg border border-gray-700 bg-[#1a2030] px-2.5 py-1.5 text-left opacity-0 shadow-xl transition-opacity duration-150 group-hover/cert:opacity-100">
              <p className="text-[10px] font-semibold text-slate-100">{c.skill_name}</p>
              {c.expiry_date
                ? <p className="mt-0.5 text-[9px] text-slate-400">Expires {new Date(c.expiry_date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</p>
                : <p className="mt-0.5 text-[9px] text-slate-400">No expiry date</p>
              }
              <p className={`mt-0.5 text-[9px] font-medium ${labelCls}`}>{label}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/**
 * Compact tablet row — 3-column flex layout, no table, no fixed widths.
 * Used at md–xl (768px–1279px). Fits inside available width without scrolling.
 */
function TabletEngineerRow({
  eng, isSelected, isActive, onClick, onSelect,
}: {
  eng: DrawerEngineer;
  isSelected: boolean;
  isActive: boolean;
  onClick: () => void;
  onSelect: (e: React.MouseEvent) => void;
}) {
  const critPct = eng.critical_skills_count > 0
    ? Math.round((eng.critical_skills_met / eng.critical_skills_count) * 100)
    : 100;

  const bg = isActive ? "bg-blue-500/10" : isSelected ? "bg-blue-500/[0.07]" : "";

  return (
    <div
      onClick={onClick}
      className={`flex cursor-pointer items-center gap-3 border-b border-gray-800/60 px-3 py-2.5 transition-colors hover:bg-[#1a2030] ${bg} ${rowAccent(eng)}`}
    >
      {/* Checkbox */}
      <div onClick={onSelect} className="shrink-0">
        <input
          type="checkbox"
          checked={isSelected}
          onChange={() => {}}
          className="h-3.5 w-3.5 cursor-pointer rounded border-gray-600 accent-blue-500"
          aria-label={`Select ${eng.full_name}`}
        />
      </div>

      {/* Left: avatar + name + role + chips — flex-[2] */}
      <div className="flex min-w-0 flex-[2] items-start gap-2">
        <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[10px] font-bold ${getAvatarColor(eng.full_name)}`}>
          {getInitials(eng.full_name)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1">
            <p className="truncate text-xs font-medium leading-tight text-slate-200">{eng.full_name}</p>
            {eng.verified && <CheckCircle2 className="h-2.5 w-2.5 shrink-0 text-emerald-400" />}
            <CertDots certs={eng.certifications} />
          </div>
          <p className="mt-0.5 truncate text-[10px] leading-tight text-slate-500">{eng.discipline ?? "—"}</p>
          <SkillChips skills={eng.top_skills} max={3} />
        </div>
      </div>

      {/* Middle: dept + site + availability + shift — flex-[1.5] */}
      <div className="min-w-0 flex-[1.5]">
        {(eng.department_name || eng.site_name) && (
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
            {eng.department_name && (
              <span className="truncate text-[11px] text-slate-400">{eng.department_name}</span>
            )}
            {eng.site_name && (
              <span className="hidden items-center gap-1 text-[10px] text-slate-500 lg:flex">
                <MapPin className="h-2.5 w-2.5 shrink-0" />{eng.site_name}
              </span>
            )}
          </div>
        )}
        <div className="mt-1 flex flex-wrap items-center gap-1">
          <Badge className={`inline-flex h-auto rounded px-1.5 py-0.5 text-[9px] font-medium shadow-none ${availBadgeClass(eng.availability_status)}`}>
            {formatAvailStatus(eng.availability_status)}
          </Badge>
          {eng.shift_pattern && (
            <span className="hidden text-[10px] text-slate-500 lg:inline">{eng.shift_pattern}</span>
          )}
        </div>
      </div>

      {/* Right: competency ring + stats + risk */}
      <div className="flex shrink-0 items-center gap-2">
        <RingScore value={eng.skills_score} />
        <div className="hidden flex-col items-end gap-0.5 lg:flex">
          <span className={`text-[10px] font-semibold tabular-nums ${critPct >= 80 ? "text-emerald-400" : critPct >= 60 ? "text-yellow-400" : "text-red-400"}`}>
            {eng.critical_skills_met}/{eng.critical_skills_count}
          </span>
          {eng.training_count > 0 && (
            <span className="text-[10px] font-medium text-orange-400">{eng.training_count} gaps</span>
          )}
        </div>
        <Badge className={`inline-flex h-auto rounded px-1.5 py-0.5 text-[9px] font-medium shadow-none ${riskBadgeClass(eng.risk_level)}`}>
          {capitalize(eng.risk_level)}
        </Badge>
      </div>
    </div>
  );
}

/** Mobile engineer card — full-card layout, shown below md */
function MobileEngineerCard({
  eng, isSelected, isActive, onClick, onSelect,
}: {
  eng: DrawerEngineer;
  isSelected: boolean;
  isActive: boolean;
  onClick: () => void;
  onSelect: (e: React.MouseEvent) => void;
}) {
  const critPct = eng.critical_skills_count > 0
    ? Math.round((eng.critical_skills_met / eng.critical_skills_count) * 100)
    : 100;

  return (
    <div
      onClick={onClick}
      className={`relative cursor-pointer rounded-xl border p-4 transition-colors ${
        isActive     ? "border-blue-500/40 bg-blue-500/10"
        : isSelected ? "border-blue-500/20 bg-blue-500/[0.07]"
        : "border-gray-800 bg-[#141820] hover:border-gray-700 hover:bg-[#1a2030]"
      } ${rowAccent(eng)}`}
    >
      <div className="flex items-start gap-3">
        <div onClick={onSelect} className="mt-1">
          <input type="checkbox" checked={isSelected} onChange={() => {}}
            className="h-3.5 w-3.5 cursor-pointer rounded border-gray-600 accent-blue-500"
            aria-label={`Select ${eng.full_name}`} />
        </div>
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
        </div>
        <RingScore value={eng.skills_score} />
      </div>
      {eng.top_skills.length > 0 && <SkillChips skills={eng.top_skills} />}
      {(eng.department_name || eng.site_name) && (
        <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400">
          {eng.department_name && <span>{eng.department_name}</span>}
          {eng.site_name && (
            <span className="flex items-center gap-1"><MapPin className="h-3 w-3 text-slate-600" />{eng.site_name}</span>
          )}
        </div>
      )}
      <div className="mt-2.5 flex flex-wrap items-center gap-2">
        <Badge className={`inline-flex h-auto rounded px-2 py-0.5 text-[10px] font-medium shadow-none ${availBadgeClass(eng.availability_status)}`}>
          {formatAvailStatus(eng.availability_status)}
        </Badge>
        <Badge className={`inline-flex h-auto rounded px-2 py-0.5 text-[10px] font-medium shadow-none ${riskBadgeClass(eng.risk_level)}`}>
          {capitalize(eng.risk_level)} Risk
        </Badge>
        {eng.critical_knowledge_holder && (
          <span className="flex items-center gap-1 text-[10px] font-medium text-blue-400">
            <Shield className="h-3 w-3" />SME
          </span>
        )}
        {eng.training_count > 0 && (
          <span className="text-[10px] font-medium text-orange-400">{eng.training_count} training gap{eng.training_count !== 1 ? "s" : ""}</span>
        )}
        <span className={`text-[10px] font-medium tabular-nums ${critPct >= 80 ? "text-emerald-400" : critPct >= 60 ? "text-yellow-400" : "text-red-400"}`}>
          {eng.critical_skills_met}/{eng.critical_skills_count} critical
        </span>
      </div>
    </div>
  );
}

function BulkBar({ count, onClear }: { count: number; onClear: () => void }) {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-blue-500/25 bg-blue-500/8 px-4 py-2.5">
      <span className="text-sm font-semibold text-blue-400">{count} engineer{count !== 1 ? "s" : ""} selected</span>
      <div className="ml-auto flex flex-wrap items-center gap-2">
        {[
          { icon: GraduationCap, label: "Assign Training" },
          { icon: Download,      label: "Export"          },
          { icon: Sparkles,      label: "AI Report"       },
          { icon: Mail,          label: "Send Message"    },
        ].map(({ icon: Icon, label }) => (
          <button key={label} type="button"
            className="flex items-center gap-1.5 rounded-md border border-blue-500/20 bg-blue-500/10 px-3 py-1.5 text-xs font-medium text-blue-300 transition-colors hover:bg-blue-500/20 hover:text-blue-200">
            <Icon className="h-3.5 w-3.5" />{label}
          </button>
        ))}
      </div>
      <button type="button" onClick={onClear}
        className="inline-flex h-6 w-6 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-[#ffffff10] hover:text-slate-200"
        aria-label="Clear selection">
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

// ─── Shared empty / error / skeleton sub-renders ──────────────────────────────

function EmptyState({ hasFilters, onReset }: { hasFilters: boolean; onReset: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 py-12 text-center">
      <Users className="h-8 w-8 text-slate-700" />
      <div>
        <p className="font-medium text-slate-400">No engineers found</p>
        <p className="mt-1 text-sm text-slate-600">
          {hasFilters ? "No engineers match the current filters." : "No engineers have been added yet."}
        </p>
      </div>
      {hasFilters && (
        <button type="button" onClick={onReset} className="text-sm font-medium text-blue-400 hover:underline">
          Clear all filters
        </button>
      )}
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
  const [selectedIds,      setSelectedIds]      = useState<Set<string>>(new Set());

  const [search,               setSearch]               = useState("");
  const [filterDept,           setFilterDept]           = useState("all");
  const [filterSite,           setFilterSite]           = useState("all");
  const [filterEmploymentType, setFilterEmploymentType] = useState("all");
  const [filterAvailability,   setFilterAvailability]   = useState("all");
  const [filterVerified,       setFilterVerified]       = useState("all");
  const [filterRisk,           setFilterRisk]           = useState("all");

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
        if (filterDept !== "all"            && eng.department_name !== filterDept)             return false;
        if (filterSite !== "all"            && eng.site_name !== filterSite)                   return false;
        if (filterEmploymentType !== "all"  && eng.employment_type !== filterEmploymentType)   return false;
        if (filterAvailability !== "all"    && eng.availability_status !== filterAvailability) return false;
        if (filterVerified === "verified"   && !eng.verified)                                  return false;
        if (filterVerified === "unverified" && eng.verified)                                   return false;
        if (filterRisk !== "all"            && eng.risk_level !== filterRisk)                  return false;
        return true;
      })
      .sort((a, b) => (RISK_ORDER[a.risk_level] ?? 9) - (RISK_ORDER[b.risk_level] ?? 9) || a.full_name.localeCompare(b.full_name));
  }, [engineers, search, filterDept, filterSite, filterEmploymentType, filterAvailability, filterVerified, filterRisk]);

  const totalPages     = Math.ceil(filteredEngineers.length / TABLE_PAGE_SIZE);
  const pagedEngineers = filteredEngineers.slice(tablePage * TABLE_PAGE_SIZE, (tablePage + 1) * TABLE_PAGE_SIZE);

  const hasActiveFilters = !!(search || filterDept !== "all" || filterSite !== "all" || filterEmploymentType !== "all" || filterAvailability !== "all" || filterVerified !== "all" || filterRisk !== "all");
  const allPageSelected  = pagedEngineers.length > 0 && pagedEngineers.every((e) => selectedIds.has(e.id));

  const resetFilters = () => {
    setSearch(""); setFilterDept("all"); setFilterSite("all");
    setFilterEmploymentType("all"); setFilterAvailability("all");
    setFilterVerified("all"); setFilterRisk("all");
    setTablePage(0);
  };

  const toggleSelectAll = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allPageSelected) pagedEngineers.forEach((e) => next.delete(e.id));
      else pagedEngineers.forEach((e) => next.add(e.id));
      return next;
    });
  };

  const toggleSelectOne = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const siteNames = useMemo(() => [...new Set(engineers.map((e) => e.site_name).filter(Boolean))] as string[], [engineers]);
  const deptNames = useMemo(() => departments.map((d) => d.name).sort(), [departments]);

  const kpiCards = useMemo(() => [
    { label: "Total Engineers",      value: String(stats.totalEngineers),            sub: `${stats.verifiedEngineers} verified`,                              icon: Users,         valueClass: "text-slate-50"    },
    { label: "Verified",             value: String(stats.verifiedEngineers),          sub: `${stats.totalEngineers > 0 ? Math.round((stats.verifiedEngineers / stats.totalEngineers) * 100) : 0}% of workforce`, icon: CheckCircle2,  valueClass: stats.verifiedEngineers === stats.totalEngineers ? "text-emerald-400" : "text-yellow-400" },
    { label: "Available Now",        value: String(stats.currentlyAvailable),        sub: "Ready to deploy",                                                  icon: Users,         valueClass: "text-emerald-400" },
    { label: "On Shift",             value: String(stats.onShiftToday),              sub: "Active right now",                                                 icon: TrendingDown,  valueClass: "text-blue-400"    },
    { label: "In Training",          value: String(stats.inTraining),                sub: "Active bookings",                                                  icon: GraduationCap, valueClass: stats.inTraining > 0 ? "text-orange-400" : "text-slate-50" },
    { label: "Critical SMEs",        value: String(stats.criticalHolders),           sub: "Key knowledge holders",                                            icon: Shield,        valueClass: "text-blue-400"    },
    { label: "Avg Competency",       value: `${stats.avgCompetencyScore}%`,          sub: "Across all engineers",                                             icon: Sparkles,      valueClass: stats.avgCompetencyScore >= 80 ? "text-emerald-400" : stats.avgCompetencyScore >= 68 ? "text-yellow-400" : "text-red-400" },
    { label: "Certs Expiring (30d)", value: String(stats.certificationsExpiring30d), sub: "Require renewal",                                                  icon: AlertTriangle, valueClass: stats.certificationsExpiring30d > 0 ? "text-red-400" : "text-emerald-400" },
  ], [stats]);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <section className="relative flex w-full max-w-full flex-1 grow flex-col items-start gap-4 overflow-x-hidden px-4 pb-12 pt-0 xl:gap-6 xl:px-8">

      <EngineerDrawer
        engineer={selectedEngineer}
        assignments={assignments}
        trainingBookings={trainingBookings}
        skillGaps={skillGaps}
        onClose={() => setSelectedEngineer(null)}
      />

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header className="flex w-full flex-col justify-between gap-3 py-4 lg:flex-row lg:items-center lg:py-5">
        <div className="flex flex-col items-start gap-1">
          <p className="text-xs font-medium text-slate-500">Alpha Manufacturing</p>
          <h1 className="font-text-xl-semibold text-[length:var(--text-xl-semibold-font-size)] font-[number:var(--text-xl-semibold-font-weight)] leading-[var(--text-xl-semibold-line-height)] tracking-[var(--text-xl-semibold-letter-spacing)] text-slate-50">
            Engineers
          </h1>
          <p className="text-sm text-slate-400">Workforce Management &amp; Engineer Profiles</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 self-start lg:self-auto">
          <Button type="button" variant="outline" className="h-auto gap-2 border-[#ffffff20] bg-[#ffffff1a] px-3 py-2 text-sm font-semibold text-slate-50 hover:bg-[#ffffff24] hover:text-slate-50">
            <Download className="h-4 w-4" />
            <span className="hidden md:inline">Export</span>
          </Button>
          <Button type="button" variant="outline" className="h-auto gap-2 border-[#ffffff20] bg-[#ffffff1a] px-3 py-2 text-sm font-semibold text-slate-50 hover:bg-[#ffffff24] hover:text-slate-50">
            <Sparkles className="h-4 w-4" />
            <span className="hidden xl:inline">AI Report</span>
          </Button>
          <Button type="button" className="h-auto gap-2 bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-500">
            <Plus className="h-4 w-4" />
            <span className="hidden xl:inline">Add Engineer</span>
          </Button>
          <button type="button" onClick={() => setTick((t) => t + 1)} disabled={loading}
            className="inline-flex h-9 w-9 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-[#ffffff1a] hover:text-slate-200 disabled:opacity-50">
            <RefreshCw className={`h-5 w-5 ${loading ? "animate-spin" : ""}`} />
          </button>
          <button type="button"
            className="inline-flex h-9 w-9 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-[#ffffff1a] hover:text-slate-200">
            <UserCircle className="h-7 w-7" />
          </button>
        </div>
      </header>

      <div className="flex w-full max-w-full flex-col gap-4 xl:gap-6">

        {/* ── KPI Cards ──────────────────────────────────────────────────────── */}
        {/* 2 cols mobile → 4 cols tablet → 8 cols desktop */}
        <section className="grid w-full grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-8">
          {kpiCards.map(({ label, value, sub, icon: Icon, valueClass }) => (
            <Card key={label} className="h-full rounded-xl border border-gray-800 bg-[#141820] shadow-none">
              <CardContent className="flex h-full flex-col gap-2 p-3">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-medium leading-tight text-slate-400">{label}</p>
                  <Icon className="h-3.5 w-3.5 shrink-0 text-slate-600" />
                </div>
                <p className={`text-lg font-semibold tabular-nums xl:text-xl ${valueClass}`}>{loading ? "—" : value}</p>
                <p className="text-[10px] leading-tight text-slate-600">{sub}</p>
              </CardContent>
            </Card>
          ))}
        </section>

        {/* ── Engineer Directory Card ─────────────────────────────────────────── */}
        <Card className="w-full max-w-full rounded-xl border border-gray-800 bg-[#141820] shadow-none">
          <CardContent className="flex flex-col gap-3 p-3 md:p-4 xl:p-5">

            {/* Card header */}
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="font-semibold text-slate-50">Engineer Directory</h2>
                <p className="text-sm text-slate-400">
                  {loading ? "Loading…" : `${filteredEngineers.length} of ${engineers.length} engineers`}
                  {selectedIds.size > 0 && <span className="ml-2 text-blue-400">· {selectedIds.size} selected</span>}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {hasActiveFilters && (
                  <button type="button" onClick={resetFilters}
                    className="flex items-center gap-1 text-xs font-medium text-slate-500 transition-colors hover:text-slate-200">
                    <X className="h-3 w-3" /> Clear filters
                  </button>
                )}
                <Badge className="inline-flex h-auto items-center gap-1.5 rounded bg-[#3b82f620] px-2 py-1 text-xs font-medium text-blue-500 shadow-none hover:bg-[#3b82f620]">
                  <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />Live
                </Badge>
              </div>
            </div>

            {/* Filters: search full-width, dropdowns in responsive grid */}
            <div className="flex flex-col gap-2">
              <div className="relative w-full">
                <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
                <input
                  type="text" placeholder="Search engineers…" value={search}
                  onChange={(e) => { setSearch(e.target.value); setTablePage(0); }}
                  className="h-8 w-full rounded-lg border border-gray-800 bg-[#0b0e14] pl-8 pr-3 text-sm text-slate-200 placeholder:text-slate-600 focus:border-blue-500/50 focus:outline-none focus:ring-1 focus:ring-blue-500/30"
                />
              </div>
              <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-6">
                {[
                  { value: filterDept,           onChange: (v: string) => { setFilterDept(v);           setTablePage(0); }, def: "All Departments",  opts: deptNames },
                  { value: filterSite,           onChange: (v: string) => { setFilterSite(v);           setTablePage(0); }, def: "All Locations",    opts: siteNames },
                  { value: filterEmploymentType, onChange: (v: string) => { setFilterEmploymentType(v); setTablePage(0); }, def: "All Types",        opts: ["internal", "contractor", "agency"] },
                  { value: filterAvailability,   onChange: (v: string) => { setFilterAvailability(v);   setTablePage(0); }, def: "All Availability", opts: ["available", "on_shift", "unavailable"] },
                  { value: filterVerified,       onChange: (v: string) => { setFilterVerified(v);       setTablePage(0); }, def: "All Verification", opts: ["verified", "unverified"] },
                  { value: filterRisk,           onChange: (v: string) => { setFilterRisk(v);           setTablePage(0); }, def: "All Risk Levels",  opts: ["critical", "high", "medium", "low"] },
                ].map(({ value, onChange, def, opts }) => (
                  <select key={def} value={value} onChange={(e) => onChange(e.target.value)}
                    className="h-8 w-full rounded-lg border border-gray-800 bg-[#0b0e14] px-2 text-xs text-slate-300 focus:outline-none">
                    <option value="all">{def}</option>
                    {opts.map((o) => <option key={o} value={o}>{capitalize(o)}</option>)}
                  </select>
                ))}
              </div>
            </div>

            {/* Bulk action bar */}
            {selectedIds.size > 0 && (
              <>
                <div className="hidden sm:block">
                  <BulkBar count={selectedIds.size} onClear={() => setSelectedIds(new Set())} />
                </div>
                <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-gray-800 bg-[#0d1117]/95 p-3 backdrop-blur-sm sm:hidden">
                  <BulkBar count={selectedIds.size} onClear={() => setSelectedIds(new Set())} />
                </div>
              </>
            )}

            {/* Error state */}
            {loadError && (
              <div className="flex flex-col items-center gap-3 rounded-xl border border-red-500/20 bg-[#ef444408] py-12 text-center">
                <AlertTriangle className="h-8 w-8 text-red-500/60" />
                <div>
                  <p className="font-medium text-red-400">Failed to load engineers</p>
                  <p className="mt-1 text-sm text-slate-500">Unable to connect to the database.</p>
                </div>
                <button type="button" onClick={() => setTick((t) => t + 1)}
                  className="mt-1 rounded-lg border border-red-500/20 px-4 py-2 text-sm font-medium text-red-400 transition-colors hover:bg-red-500/10">
                  Try again
                </button>
              </div>
            )}

            {/* ── MOBILE: card list (< 768px) ─────────────────────────────────── */}
            {!loadError && (
              <div className="block md:hidden">
                {loading ? (
                  <div className="flex flex-col gap-3">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <div key={i} className="rounded-xl border border-gray-800 bg-[#141820] p-4">
                        <div className="flex items-start gap-3">
                          <div className="h-3.5 w-3.5 animate-pulse rounded bg-gray-800" />
                          <div className="h-10 w-10 animate-pulse rounded-xl bg-gray-800" />
                          <div className="flex-1">
                            <div className="h-4 w-32 animate-pulse rounded bg-gray-800" />
                            <div className="mt-1 h-2.5 w-20 animate-pulse rounded bg-gray-800/60" />
                          </div>
                          <div className="h-9 w-9 animate-pulse rounded-full bg-gray-800" />
                        </div>
                        <div className="mt-2 flex gap-1">
                          {[40, 32, 36].map((w, j) => <div key={j} className="h-3.5 animate-pulse rounded bg-gray-800/40" style={{ width: w }} />)}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : filteredEngineers.length === 0 ? (
                  <EmptyState hasFilters={hasActiveFilters} onReset={resetFilters} />
                ) : (
                  <div className="flex flex-col gap-3">
                    {pagedEngineers.map((eng) => {
                      const isSelected = selectedIds.has(eng.id);
                      const isActive   = selectedEngineer?.id === eng.id;
                      return (
                        <MobileEngineerCard key={eng.id} eng={eng} isSelected={isSelected} isActive={isActive}
                          onClick={() => setSelectedEngineer(isActive ? null : eng)}
                          onSelect={(e) => { e.stopPropagation(); toggleSelectOne(eng.id); }} />
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* ── TABLET: compact row list (768px – 1279px) ──────────────────── */}
            {!loadError && (
              <div className="hidden md:block xl:hidden">
                {loading ? (
                  <div className="rounded-lg border border-gray-800 bg-[#0f1318]">
                    {/* Tablet skeleton header */}
                    <div className="flex items-center gap-3 border-b border-gray-800 px-3 py-2">
                      <div className="h-3 w-3 animate-pulse rounded bg-gray-800" />
                      <div className="h-3 w-24 animate-pulse rounded bg-gray-800" />
                      <div className="ml-auto flex gap-2">
                        <div className="h-3 w-16 animate-pulse rounded bg-gray-800" />
                        <div className="h-3 w-12 animate-pulse rounded bg-gray-800" />
                      </div>
                    </div>
                    {Array.from({ length: TABLE_PAGE_SIZE }).map((_, i) => (
                      <div key={i} className="flex items-center gap-3 border-b border-gray-800/50 px-3 py-2.5">
                        <div className="h-3.5 w-3.5 animate-pulse rounded bg-gray-800" />
                        <div className="h-8 w-8 animate-pulse rounded-lg bg-gray-800" />
                        <div className="flex-[2]">
                          <div className="h-3.5 w-28 animate-pulse rounded bg-gray-800" />
                          <div className="mt-1 h-2.5 w-20 animate-pulse rounded bg-gray-800/60" />
                          <div className="mt-1.5 flex gap-1">
                            {[32, 28, 36].map((w, j) => <div key={j} className="h-3 animate-pulse rounded bg-gray-800/40" style={{ width: w }} />)}
                          </div>
                        </div>
                        <div className="flex-[1.5]">
                          <div className="h-3 w-20 animate-pulse rounded bg-gray-800" />
                          <div className="mt-1 h-4 w-16 animate-pulse rounded bg-gray-800/60" />
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="h-9 w-9 animate-pulse rounded-full bg-gray-800" />
                          <div className="h-4 w-12 animate-pulse rounded bg-gray-800" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : filteredEngineers.length === 0 ? (
                  <EmptyState hasFilters={hasActiveFilters} onReset={resetFilters} />
                ) : (
                  <div className="rounded-lg border border-gray-800 bg-[#0f1318]">
                    {/* Tablet column header */}
                    <div className="flex items-center gap-3 border-b border-gray-800 px-3 py-2">
                      <div className="w-3.5 shrink-0">
                        <input type="checkbox" checked={allPageSelected} onChange={toggleSelectAll}
                          className="h-3.5 w-3.5 cursor-pointer rounded border-gray-600 accent-blue-500"
                          aria-label="Select all on page" />
                      </div>
                      <span className="flex-[2] text-[10px] font-semibold uppercase tracking-wider text-slate-500">Engineer</span>
                      <span className="flex-[1.5] text-[10px] font-semibold uppercase tracking-wider text-slate-500">Dept / Status</span>
                      <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Score / Risk</span>
                    </div>
                    {pagedEngineers.map((eng) => {
                      const isSelected = selectedIds.has(eng.id);
                      const isActive   = selectedEngineer?.id === eng.id;
                      return (
                        <TabletEngineerRow key={eng.id} eng={eng} isSelected={isSelected} isActive={isActive}
                          onClick={() => setSelectedEngineer(isActive ? null : eng)}
                          onSelect={(e) => { e.stopPropagation(); toggleSelectOne(eng.id); }} />
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* ── DESKTOP: full table (xl+, 1280px+) ─────────────────────────── */}
            {!loadError && (
              <div className="hidden xl:block">
                <div className="overflow-x-auto rounded-lg border border-gray-800">
                  <table className="min-w-full border-collapse text-sm">
                    <thead>
                      <tr className="border-b border-gray-800 bg-[#0f1318]">
                        <th className="w-10 px-3 py-2.5">
                          <input type="checkbox" checked={allPageSelected} onChange={toggleSelectAll}
                            className="h-3.5 w-3.5 cursor-pointer rounded border-gray-600 accent-blue-500"
                            aria-label="Select all on page" />
                        </th>
                        {[
                          { label: "Engineer",        cls: "sticky left-0 z-10 bg-[#0f1318] min-w-[220px]" },
                          { label: "Department",      cls: "min-w-[130px]" },
                          { label: "Site",            cls: "min-w-[110px]" },
                          { label: "Type",            cls: "min-w-[90px]" },
                          { label: "Availability",    cls: "min-w-[110px]" },
                          { label: "Shift",           cls: "min-w-[110px]" },
                          { label: "Competency",      cls: "min-w-[100px] text-center" },
                          { label: "AI Confidence",   cls: "min-w-[100px] text-right" },
                          { label: "Critical Skills", cls: "min-w-[110px] text-right" },
                          { label: "Knowledge",       cls: "min-w-[90px]  text-center" },
                          { label: "Training Gaps",   cls: "min-w-[110px] text-right" },
                          { label: "Last Active",     cls: "min-w-[110px]" },
                          { label: "Risk",            cls: "min-w-[90px]" },
                          { label: "",                cls: "w-px" },
                        ].map(({ label, cls }) => (
                          <th key={label || "actions"} className={`px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-500 ${cls}`}>
                            {label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {loading
                        ? Array.from({ length: TABLE_PAGE_SIZE }).map((_, i) => (
                            <tr key={i} className="border-b border-gray-800/50 bg-[#141820]">
                              <td className="w-10 px-3 py-3"><div className="h-3.5 w-3.5 animate-pulse rounded bg-gray-800" /></td>
                              <td className="sticky left-0 z-10 bg-[#141820] px-3 py-3">
                                <div className="flex items-start gap-3">
                                  <div className="h-9 w-9 animate-pulse rounded-xl bg-gray-800" />
                                  <div>
                                    <div className="h-4 w-32 animate-pulse rounded bg-gray-800" />
                                    <div className="mt-1 h-2.5 w-20 animate-pulse rounded bg-gray-800/60" />
                                    <div className="mt-1.5 flex gap-1">
                                      {[40, 32, 36].map((w, j) => <div key={j} className="h-3.5 animate-pulse rounded bg-gray-800/40" style={{ width: w }} />)}
                                    </div>
                                  </div>
                                </div>
                              </td>
                              {Array.from({ length: 12 }).map((_, j) => (
                                <td key={j} className="px-3 py-3"><div className="h-4 w-14 animate-pulse rounded bg-gray-800" /></td>
                              ))}
                            </tr>
                          ))
                        : filteredEngineers.length === 0
                        ? (
                            <tr>
                              <td colSpan={15} className="py-16 text-center">
                                <EmptyState hasFilters={hasActiveFilters} onReset={resetFilters} />
                              </td>
                            </tr>
                          )
                        : pagedEngineers.map((eng, idx) => {
                            const isSelected = selectedIds.has(eng.id);
                            const isActive   = selectedEngineer?.id === eng.id;
                            const baseOdd    = idx % 2 === 0 ? "bg-[#141820]" : "bg-[#111620]";
                            const rowBg      = isActive ? "bg-blue-500/10" : isSelected ? "bg-blue-500/[0.07]" : baseOdd;
                            const critPct    = eng.critical_skills_count > 0 ? Math.round((eng.critical_skills_met / eng.critical_skills_count) * 100) : 100;
                            return (
                              <tr key={eng.id} onClick={() => setSelectedEngineer(isActive ? null : eng)}
                                className={`group/row cursor-pointer border-b border-gray-800/50 transition-colors duration-100 hover:bg-[#1a2030] ${rowBg} ${rowAccent(eng)}`}>
                                <td className="w-10 px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                                  <input type="checkbox" checked={isSelected} onChange={() => toggleSelectOne(eng.id)}
                                    className="h-3.5 w-3.5 cursor-pointer rounded border-gray-600 accent-blue-500"
                                    aria-label={`Select ${eng.full_name}`} />
                                </td>
                                <td className={`sticky left-0 z-10 min-w-[220px] px-3 py-2.5 ${rowBg}`}>
                                  <div className="flex items-start gap-3">
                                    <div className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-xs font-bold ${getAvatarColor(eng.full_name)}`}>
                                      {getInitials(eng.full_name)}
                                    </div>
                                    <div className="min-w-0">
                                      <div className="flex items-center gap-1.5">
                                        <p className="truncate font-medium leading-tight text-slate-200">{eng.full_name}</p>
                                        {eng.verified && <CheckCircle2 className="h-3 w-3 shrink-0 text-emerald-400" />}
                                        <CertDots certs={eng.certifications} />
                                      </div>
                                      <p className="mt-0.5 truncate text-[11px] leading-tight text-slate-500">{eng.discipline ?? "—"}</p>
                                      <SkillChips skills={eng.top_skills} max={5} />
                                    </div>
                                  </div>
                                </td>
                                <td className="px-3 py-2.5 text-sm text-slate-400">{eng.department_name ?? "—"}</td>
                                <td className="px-3 py-2.5">
                                  {eng.site_name
                                    ? <span className="flex items-center gap-1.5 text-sm text-slate-400"><MapPin className="h-3 w-3 shrink-0 text-slate-600" />{eng.site_name}</span>
                                    : <span className="text-sm text-slate-600">—</span>}
                                </td>
                                <td className="px-3 py-2.5"><span className="text-xs text-slate-400">{capitalize(eng.employment_type)}</span></td>
                                <td className="px-3 py-2.5">
                                  <Badge className={`inline-flex h-auto rounded px-2 py-0.5 text-[10px] font-medium shadow-none ${availBadgeClass(eng.availability_status)}`}>
                                    {formatAvailStatus(eng.availability_status)}
                                  </Badge>
                                </td>
                                <td className="px-3 py-2.5 text-sm text-slate-400">{eng.shift_pattern ?? "—"}</td>
                                <td className="px-3 py-2.5 text-center"><RingScore value={eng.skills_score} /></td>
                                <td className="px-3 py-2.5 text-right">
                                  <span className="text-sm font-semibold tabular-nums text-blue-400">{eng.ai_confidence}%</span>
                                </td>
                                <td className="px-3 py-2.5 text-right">
                                  <span className={`text-sm font-semibold tabular-nums ${critPct >= 80 ? "text-emerald-400" : critPct >= 60 ? "text-yellow-400" : "text-red-400"}`}>
                                    {eng.critical_skills_met}
                                  </span>
                                  <span className="text-xs text-slate-600">/{eng.critical_skills_count}</span>
                                </td>
                                <td className="px-3 py-2.5 text-center">
                                  {eng.critical_knowledge_holder
                                    ? <Shield className="mx-auto h-4 w-4 text-blue-400" title="Critical knowledge holder" />
                                    : <span className="text-slate-700">—</span>}
                                </td>
                                <td className="px-3 py-2.5 text-right">
                                  {eng.training_count > 0
                                    ? <span className="text-sm font-semibold text-orange-400 tabular-nums">{eng.training_count}</span>
                                    : <span className="text-sm text-slate-600">0</span>}
                                </td>
                                <td className="px-3 py-2.5 text-sm text-slate-400">{formatDate(eng.last_assessment_date)}</td>
                                <td className="px-3 py-2.5">
                                  <Badge className={`inline-flex h-auto rounded px-2 py-0.5 text-[10px] font-medium shadow-none ${riskBadgeClass(eng.risk_level)}`}>
                                    {capitalize(eng.risk_level)}
                                  </Badge>
                                </td>
                                <td className="px-2 py-2.5" onClick={(e) => e.stopPropagation()}>
                                  <div className="flex items-center gap-0.5 opacity-0 transition-opacity duration-150 group-hover/row:opacity-100">
                                    {[
                                      { icon: UserCircle,    title: "View profile",       action: () => setSelectedEngineer(eng) },
                                      { icon: Network,       title: "Open Skills Matrix", action: () => {} },
                                      { icon: GraduationCap, title: "Assign training",    action: () => {} },
                                      { icon: Award,         title: "Certifications",     action: () => {} },
                                      { icon: Sparkles,      title: "AI Report",          action: () => {} },
                                      { icon: MessageSquare, title: "Message",            action: () => {} },
                                    ].map(({ icon: Icon, title, action }) => (
                                      <button key={title} type="button" title={title}
                                        onClick={(e) => { e.stopPropagation(); action(); }}
                                        className="inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-[#ffffff10] hover:text-slate-200">
                                        <Icon className="h-3.5 w-3.5" />
                                      </button>
                                    ))}
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Pagination — shared across all layouts */}
            {!loading && !loadError && filteredEngineers.length > TABLE_PAGE_SIZE && (
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>
                  {tablePage * TABLE_PAGE_SIZE + 1}–{Math.min((tablePage + 1) * TABLE_PAGE_SIZE, filteredEngineers.length)} of {filteredEngineers.length}
                </span>
                <div className="flex items-center gap-1">
                  <button type="button" onClick={() => setTablePage((p) => Math.max(0, p - 1))} disabled={tablePage === 0}
                    className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-gray-800 text-slate-400 transition-colors hover:bg-[#ffffff1a] hover:text-slate-200 disabled:opacity-30">
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  {Array.from({ length: totalPages }).map((_, i) => (
                    <button key={i} type="button" onClick={() => setTablePage(i)}
                      className={`inline-flex h-7 w-7 items-center justify-center rounded-lg text-xs transition-colors ${i === tablePage ? "bg-blue-500/20 font-semibold text-blue-400" : "text-slate-500 hover:bg-[#ffffff1a]"}`}>
                      {i + 1}
                    </button>
                  ))}
                  <button type="button" onClick={() => setTablePage((p) => Math.min(totalPages - 1, p + 1))} disabled={tablePage >= totalPages - 1}
                    className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-gray-800 text-slate-400 transition-colors hover:bg-[#ffffff1a] hover:text-slate-200 disabled:opacity-30">
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}

          </CardContent>
        </Card>
      </div>
    </section>
  );
};
