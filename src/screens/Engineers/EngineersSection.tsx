import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  AlertTriangle,
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
import { ContextHelp } from "../../components/ContextHelp";
import { SyncIndicator } from "../../components/SyncIndicator";
import { AiActionsPanel, AiAction } from "../../components/AiActionsPanel";
import { Select } from "../../components/Select";
import { ExplainWithAi } from "../../components/ExplainWithAi";
import { ShiftCalendar, ShiftEvent } from "../../components/ShiftCalendar";
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

interface Department {
  id: string;
  name: string;
}
interface Site {
  id: string;
  name: string;
  region: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const TABLE_PAGE_SIZE = 10;

const RISK_ORDER: Record<string, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function riskBadgeClass(level: string): string {
  switch (level) {
    case "critical":
      return "bg-[#ef444420] text-red-500";
    case "high":
      return "bg-[#f9731620] text-orange-400";
    case "medium":
      return "bg-[#facc1520] text-yellow-400";
    default:
      return "bg-[#10b98120] text-emerald-500";
  }
}

function availBadgeClass(status: string): string {
  switch (status) {
    case "available":
      return "bg-[#10b98120] text-emerald-400";
    case "on_shift":
      return "bg-[#3b82f620] text-blue-400";
    default:
      return "bg-[#ef444420] text-red-400";
  }
}

function formatAvailStatus(s: string): string {
  switch (s) {
    case "available":
      return "Available";
    case "on_shift":
      return "On Shift";
    case "unavailable":
      return "Unavailable";
    default:
      return s;
  }
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function RingScore({ value, size = 34 }: { value: number; size?: number }) {
  const STROKE = 2.5,
    R = (size - STROKE) / 2;
  const circ = 2 * Math.PI * R;
  const offset = circ * (1 - value / 100);
  const color = value >= 80 ? "#10b981" : value >= 68 ? "#facc15" : "#ef4444";
  return (
    <div
      className="relative inline-flex shrink-0 items-center justify-center"
      style={{ width: size, height: size }}
    >
      <svg
        width={size}
        height={size}
        style={{ transform: "rotate(-90deg)" }}
        aria-hidden="true"
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={R}
          fill="none"
          stroke="#1f293780"
          strokeWidth={STROKE}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={R}
          fill="none"
          stroke={color}
          strokeWidth={STROKE}
          strokeDasharray={circ}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 0.5s ease" }}
        />
      </svg>
      <span
        className="absolute text-[9px] font-bold tabular-nums leading-none"
        style={{ color, fontSize: size <= 30 ? "8px" : "9px" }}
      >
        {value}
      </span>
    </div>
  );
}

function CertDots({ certs }: { certs: CertEntry[] }) {
  if (!certs.length) return null;
  const now = Date.now();
  const thirty = 30 * 24 * 60 * 60 * 1000;
  return (
    <div className="flex items-center gap-1">
      {certs.slice(0, 3).map((c, i) => {
        const expired =
          c.expiry_date && new Date(c.expiry_date).getTime() < now;
        const expiring =
          c.expiry_date &&
          !expired &&
          new Date(c.expiry_date).getTime() < now + thirty;
        const dot = expired
          ? "bg-red-500"
          : expiring
            ? "bg-amber-400"
            : c.verification_status === "validated"
              ? "bg-emerald-400"
              : "bg-amber-400";
        const lbl = expired
          ? "Expired"
          : expiring
            ? "Expiring soon"
            : c.verification_status === "validated"
              ? "Valid"
              : capitalize(c.verification_status);
        const lblCls = expired
          ? "text-red-400"
          : expiring
            ? "text-amber-400"
            : "text-emerald-400";
        return (
          <div key={i} className="group/cert relative">
            <span
              className={`inline-flex h-2 w-2 rounded-full ${dot} cursor-default`}
            />
            <div className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 -translate-x-1/2 whitespace-nowrap rounded-lg border border-gray-700 bg-[#1a2030] px-2.5 py-1.5 text-left opacity-0 shadow-xl transition-opacity duration-150 group-hover/cert:opacity-100">
              <p className="text-[10px] font-semibold text-slate-100">
                {c.skill_name}
              </p>
              <p className={`mt-0.5 text-[9px] font-medium ${lblCls}`}>{lbl}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** Mobile engineer card */
function MobileEngineerCard({
  eng,
  isActive,
  onClick,
}: {
  eng: DrawerEngineer;
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className={`cursor-pointer rounded-xl border p-4 transition-colors ${
        isActive
          ? "border-blue-500/40 bg-blue-500/10"
          : "border-gray-800 bg-[#141820] hover:border-gray-700 hover:bg-[#1a2030]"
      }`}
    >
      <div className="flex items-start gap-3">
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-bold ${getAvatarColor(eng.full_name)}`}
        >
          {getInitials(eng.full_name)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <p className="font-medium leading-tight text-slate-200">
              {eng.full_name}
            </p>
            {eng.verified && (
              <CheckCircle2 className="h-3 w-3 shrink-0 text-emerald-400" />
            )}
            <CertDots certs={eng.certifications} />
          </div>
          <p className="mt-0.5 truncate text-[11px] leading-tight text-slate-500">
            {eng.discipline ?? "—"}
          </p>
        </div>
        <RingScore value={eng.skills_score} />
      </div>
      {(eng.department_name || eng.site_name) && (
        <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400">
          {eng.department_name && <span>{eng.department_name}</span>}
          {eng.site_name && (
            <span className="flex items-center gap-1">
              <MapPin className="h-3 w-3 text-slate-600" />
              {eng.site_name}
            </span>
          )}
        </div>
      )}
      <div className="mt-2.5 flex flex-wrap items-center gap-2">
        <Badge
          className={`inline-flex h-auto rounded px-2 py-0.5 text-[10px] font-medium shadow-none ${availBadgeClass(eng.availability_status)}`}
        >
          {formatAvailStatus(eng.availability_status)}
        </Badge>
        <Badge
          className={`inline-flex h-auto rounded px-2 py-0.5 text-[10px] font-medium shadow-none ${riskBadgeClass(eng.risk_level)}`}
        >
          {capitalize(eng.risk_level)} Risk
        </Badge>
        {eng.training_count > 0 && (
          <span className="text-[10px] font-medium text-orange-400">
            {eng.training_count} gap{eng.training_count !== 1 ? "s" : ""}
          </span>
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
      engineers: [],
      assignments: [],
      trainingBookings: [],
      skillGaps: [],
      departments: [],
      sites: [],
      stats: {
        totalEngineers: 0,
        verifiedEngineers: 0,
        currentlyAvailable: 0,
        onShiftToday: 0,
        inTraining: 0,
        criticalHolders: 0,
        avgCompetencyScore: 0,
        certificationsExpiring30d: 0,
      },
      error: true,
    };
  }
  return {
    engineers: (data.engineers ?? []) as DrawerEngineer[],
    assignments: (data.assignments ?? []) as EnrichedAssignment[],
    trainingBookings: (data.trainingBookings ?? []) as TrainingBooking[],
    skillGaps: (data.skillGaps ?? []) as GapRow[],
    departments: (data.departments ?? []) as Department[],
    sites: (data.sites ?? []) as Site[],
    stats: data.stats as EngineersStats,
  };
}

// ─── Team availability calendar mock data ────────────────────────────────────

const mmToday = new Date();
const mmY = mmToday.getFullYear();
const mmM = String(mmToday.getMonth() + 1).padStart(2, "0");
const mmD = (n: number) => `${mmY}-${mmM}-${String(n).padStart(2, "0")}`;

const MM_CALENDAR_EVENTS: ShiftEvent[] = [
  { date: mmD(1), type: "day", label: "Full coverage" },
  { date: mmD(2), type: "day", label: "Full coverage" },
  { date: mmD(3), type: "training", label: "Training – J.Patel" },
  {
    date: mmD(4),
    type: "unavailable",
    label: "Shift gap – Line 3",
    warn: true,
  },
  { date: mmD(5), type: "day", label: "Full coverage" },
  { date: mmD(6), type: "off", label: "Weekend" },
  { date: mmD(7), type: "off", label: "Weekend" },
  {
    date: mmD(8),
    type: "restricted",
    label: "Cert expiry – K.Wilson",
    warn: true,
  },
  { date: mmD(9), type: "day", label: "Full coverage" },
  { date: mmD(10), type: "overtime", label: "Contractor cover" },
  { date: mmD(11), type: "day", label: "Full coverage" },
  { date: mmD(12), type: "training", label: "ATEX – S.Chen" },
  { date: mmD(13), type: "off", label: "Weekend" },
  { date: mmD(14), type: "off", label: "Weekend" },
  {
    date: mmD(15),
    type: "unavailable",
    label: "SPOF gap – Controls",
    warn: true,
  },
  { date: mmD(16), type: "day", label: "Full coverage" },
  { date: mmD(17), type: "overtime", label: "Contractor cover" },
  { date: mmD(18), type: "day", label: "Full coverage" },
  {
    date: mmD(19),
    type: "restricted",
    label: "Cert expiry – D.Hurst",
    warn: true,
  },
  { date: mmD(20), type: "off", label: "Weekend" },
  { date: mmD(21), type: "off", label: "Weekend" },
  { date: mmD(22), type: "training", label: "PLC – T.Briggs" },
  { date: mmD(23), type: "day", label: "Full coverage" },
  { date: mmD(24), type: "day", label: "Full coverage" },
  {
    date: mmD(25),
    type: "unavailable",
    label: "Shift gap – Night",
    warn: true,
  },
  { date: mmD(26), type: "day", label: "Full coverage" },
  { date: mmD(27), type: "off", label: "Weekend" },
  { date: mmD(28), type: "off", label: "Weekend" },
];

// ─── Main component ───────────────────────────────────────────────────────────

export const EngineersSection = (): JSX.Element => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [engineers, setEngineers] = useState<DrawerEngineer[]>([]);
  const [assignments, setAssignments] = useState<EnrichedAssignment[]>([]);
  const [trainingBookings, setTrainingBookings] = useState<TrainingBooking[]>(
    [],
  );
  const [skillGaps, setSkillGaps] = useState<GapRow[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [stats, setStats] = useState<EngineersStats>({
    totalEngineers: 0,
    verifiedEngineers: 0,
    currentlyAvailable: 0,
    onShiftToday: 0,
    inTraining: 0,
    criticalHolders: 0,
    avgCompetencyScore: 0,
    certificationsExpiring30d: 0,
  });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [tick, setTick] = useState(0);

  const [selectedEngineer, setSelectedEngineer] =
    useState<DrawerEngineer | null>(null);
  const skillFilterId = searchParams.get("skill") ?? "";
  const skillFilterName = searchParams.get("skillName") ?? "Selected skill";
  const returnTo = searchParams.get("returnTo") ?? "";
  const equipmentContext = searchParams.get("equipment") ?? "";

  const [search, setSearch] = useState(() => searchParams.get("q") ?? "");
  const [filterDept, setFilterDept] = useState("all");
  const [filterSite, setFilterSite] = useState("all");
  const [filterAvailability, setFilterAvailability] = useState("all");
  const [filterRisk, setFilterRisk] = useState("all");

  const [tablePage, setTablePage] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(false);
    fetchEngineers().then((payload) => {
      if (cancelled) return;
      if (payload.error) {
        setLoadError(true);
        setLoading(false);
        return;
      }
      setEngineers(payload.engineers);
      setAssignments(payload.assignments);
      setTrainingBookings(payload.trainingBookings);
      setSkillGaps(payload.skillGaps);
      setDepartments(payload.departments);
      setSites(payload.sites);
      setStats(payload.stats);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [tick]);

  useEffect(() => {
    const requestedEngineerId = searchParams.get("engineer");
    if (!requestedEngineerId || engineers.length === 0) return;
    const match = engineers.find(
      (engineer) => engineer.id === requestedEngineerId,
    );
    if (match) setSelectedEngineer(match);
  }, [engineers, searchParams]);

  const closeEngineer = () => {
    setSelectedEngineer(null);
    setSearchParams(
      (current) => {
        const next = new URLSearchParams(current);
        next.delete("engineer");
        return next;
      },
      { replace: true },
    );
  };

  // ── Derived ───────────────────────────────────────────────────────────────

  const filteredEngineers = useMemo(() => {
    const lc = search.toLowerCase();
    const skillEngineerIds = skillFilterId
      ? new Set(
          assignments
            .filter((assignment) => assignment.skill_id === skillFilterId)
            .map((assignment) => assignment.engineer_id),
        )
      : null;
    return engineers
      .filter((eng) => {
        if (
          search &&
          !eng.full_name.toLowerCase().includes(lc) &&
          !(eng.discipline ?? "").toLowerCase().includes(lc)
        )
          return false;
        if (filterDept !== "all" && eng.department_name !== filterDept)
          return false;
        if (filterSite !== "all" && eng.site_name !== filterSite) return false;
        if (
          filterAvailability !== "all" &&
          eng.availability_status !== filterAvailability
        )
          return false;
        if (filterRisk !== "all" && eng.risk_level !== filterRisk) return false;
        if (skillEngineerIds && !skillEngineerIds.has(eng.id)) return false;
        return true;
      })
      .sort(
        (a, b) =>
          (RISK_ORDER[a.risk_level] ?? 9) - (RISK_ORDER[b.risk_level] ?? 9) ||
          a.full_name.localeCompare(b.full_name),
      );
  }, [
    assignments,
    engineers,
    filterAvailability,
    filterDept,
    filterRisk,
    filterSite,
    search,
    skillFilterId,
  ]);

  const hasActiveFilters = !!(
    search ||
    skillFilterId ||
    filterDept !== "all" ||
    filterSite !== "all" ||
    filterAvailability !== "all" ||
    filterRisk !== "all"
  );

  const resetFilters = () => {
    setSearch("");
    setFilterDept("all");
    setFilterSite("all");
    setFilterAvailability("all");
    setFilterRisk("all");
    setTablePage(0);
    setSearchParams(
      (current) => {
        const next = new URLSearchParams(current);
        next.delete("engineer");
        next.delete("skill");
        next.delete("skillName");
        next.delete("q");
        next.delete("from");
        return next;
      },
      { replace: true },
    );
  };

  const totalTablePages = Math.ceil(filteredEngineers.length / TABLE_PAGE_SIZE);
  const pagedTable = filteredEngineers.slice(
    tablePage * TABLE_PAGE_SIZE,
    (tablePage + 1) * TABLE_PAGE_SIZE,
  );

  const siteNames = useMemo(
    () =>
      [
        ...new Set(engineers.map((e) => e.site_name).filter(Boolean)),
      ] as string[],
    [engineers],
  );
  const deptNames = useMemo(
    () => departments.map((d) => d.name).sort(),
    [departments],
  );

  // ── AI Insights for Engineers ─────────────────────────────────────────────

  const insights = useMemo(() => {
    const items: {
      severity: "critical" | "high" | "medium";
      icon: React.ElementType;
      title: string;
      text: string;
      filterKey?: string;
    }[] = [];

    const critRisk = engineers.filter((e) => e.risk_level === "critical");
    if (critRisk.length > 0) {
      items.push({
        severity: "critical",
        icon: AlertTriangle,
        title: `${critRisk.length} engineer${critRisk.length !== 1 ? "s" : ""} at critical risk`,
        text: `${critRisk
          .slice(0, 2)
          .map((e) => e.full_name)
          .join(
            ", ",
          )}${critRisk.length > 2 ? ` +${critRisk.length - 2} more` : ""} — immediate review required.`,
        filterKey: "critical",
      });
    }

    const highRiskHolders = engineers.filter(
      (e) =>
        e.critical_knowledge_holder &&
        (e.retirement_risk === "high" || e.leaving_risk === "high"),
    );
    if (highRiskHolders.length > 0) {
      items.push({
        severity: "critical",
        icon: Shield,
        title: `${highRiskHolders.length} knowledge holder${highRiskHolders.length !== 1 ? "s" : ""} at high attrition risk`,
        text: "Critical expertise may exit without succession cover. Initiate knowledge transfer within 30 days.",
      });
    }

    const needTraining = engineers.filter((e) => e.training_count > 0);
    if (needTraining.length > 0) {
      const totalGaps = needTraining.reduce((s, e) => s + e.training_count, 0);
      items.push({
        severity: needTraining.length > 10 ? "high" : "medium",
        icon: Brain,
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
      }),
    );
    if (expiring.length > 0) {
      items.push({
        severity: "medium",
        icon: Zap,
        title: `${expiring.length} engineer${expiring.length !== 1 ? "s" : ""} with certifications expiring in 30 days`,
        text: "Schedule renewals to maintain site compliance. Expired certifications may block deployment.",
      });
    }

    const availGap = engineers.filter(
      (e) => e.availability_status === "unavailable",
    ).length;
    if (availGap > 3) {
      items.push({
        severity: "medium",
        icon: TrendingUp,
        title: `${availGap} engineers currently unavailable`,
        text: "Check shift patterns and leave schedule to ensure adequate coverage for critical operations.",
      });
    }

    return items.slice(0, 4);
  }, [engineers]);

  const kpiCards = useMemo(
    () => [
      {
        label: "Total Engineers",
        value: String(stats.totalEngineers),
        sub: `${stats.verifiedEngineers} verified`,
        icon: Users,
        valueClass: "text-slate-50",
      },
      {
        label: "Verified",
        value: String(stats.verifiedEngineers),
        sub: `${stats.totalEngineers > 0 ? Math.round((stats.verifiedEngineers / stats.totalEngineers) * 100) : 0}% of workforce`,
        icon: CheckCircle2,
        valueClass:
          stats.verifiedEngineers === stats.totalEngineers
            ? "text-emerald-400"
            : "text-yellow-400",
      },
      {
        label: "Available Now",
        value: String(stats.currentlyAvailable),
        sub: "Ready to deploy",
        icon: Users,
        valueClass: "text-emerald-400",
      },
      {
        label: "On Shift",
        value: String(stats.onShiftToday),
        sub: "Active right now",
        icon: TrendingDown,
        valueClass: "text-blue-400",
      },
      {
        label: "In Training",
        value: String(stats.inTraining),
        sub: "Active bookings",
        icon: GraduationCap,
        valueClass: stats.inTraining > 0 ? "text-orange-400" : "text-slate-50",
      },
      {
        label: "Critical SMEs",
        value: String(stats.criticalHolders),
        sub: "Key knowledge holders",
        icon: Shield,
        valueClass: "text-blue-400",
      },
      {
        label: "Avg Competency",
        value: `${stats.avgCompetencyScore}%`,
        sub: "Across all engineers",
        icon: Sparkles,
        valueClass:
          stats.avgCompetencyScore >= 80
            ? "text-emerald-400"
            : stats.avgCompetencyScore >= 68
              ? "text-yellow-400"
              : "text-red-400",
      },
      {
        label: "Certs Expiring (30d)",
        value: String(stats.certificationsExpiring30d),
        sub: "Require renewal",
        icon: AlertTriangle,
        valueClass:
          stats.certificationsExpiring30d > 0
            ? "text-red-400"
            : "text-emerald-400",
      },
    ],
    [stats],
  );

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <section className="relative flex min-w-0 w-full max-w-full flex-1 grow flex-col items-start gap-4 overflow-x-hidden px-4 pb-12 pt-0 md:px-6 xl:px-8">
      <EngineerDrawer
        engineer={selectedEngineer}
        assignments={assignments}
        trainingBookings={trainingBookings}
        skillGaps={skillGaps}
        onClose={closeEngineer}
      />

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header className="flex w-full flex-col justify-between gap-4 py-5 lg:flex-row lg:items-center">
        <div className="flex flex-col items-start gap-1">
          <p className="text-xs font-medium text-slate-500">
            Alpha Manufacturing
          </p>
          <div className="flex items-center gap-2">
            <h1 className="font-text-xl-semibold text-[length:var(--text-xl-semibold-font-size)] font-[number:var(--text-xl-semibold-font-weight)] leading-[var(--text-xl-semibold-line-height)] tracking-[var(--text-xl-semibold-letter-spacing)] text-slate-50">
              Engineers
            </h1>
            <ContextHelp
              content={{
                title: "Engineers",
                body: "View and manage all engineers on site. Profiles include skills ratings, certifications, training records, availability status and risk indicators.",
                usage:
                  "Click an engineer row to open their full profile. Use filters to identify skill gaps, expiring certifications or engineers needing training.",
                aiNote:
                  "Vorta AI scores each engineer's capability against site requirements and flags retirement risk, leaving risk and single-point-of-failure status.",
              }}
            />
          </div>
          <p className="text-sm text-slate-400">
            Workforce Management &amp; Engineer Profiles
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3 self-start lg:self-auto">
          <Button
            type="button"
            variant="outline"
            className="h-auto gap-2 border-[#ffffff20] bg-[#ffffff1a] px-4 py-2 text-sm font-semibold text-slate-50 hover:bg-[#ffffff24] hover:text-slate-50"
          >
            <Download className="h-4 w-4" /> Export
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-auto gap-2 border-[#ffffff20] bg-[#ffffff1a] px-4 py-2 text-sm font-semibold text-slate-50 hover:bg-[#ffffff24] hover:text-slate-50"
          >
            <Sparkles className="h-4 w-4" /> AI Report
          </Button>
          <Button
            type="button"
            className="h-auto gap-2 bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500"
          >
            <Plus className="h-4 w-4" /> Add Engineer
          </Button>
          <ExplainWithAi pageId="engineers" />
          <button
            type="button"
            onClick={() => setTick((t) => t + 1)}
            disabled={loading}
            className="inline-flex h-10 w-10 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-[#ffffff1a] hover:text-slate-200 disabled:opacity-50"
          >
            <RefreshCw className={`h-5 w-5 ${loading ? "animate-spin" : ""}`} />
          </button>
          <button
            type="button"
            className="inline-flex h-10 w-10 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-[#ffffff1a] hover:text-slate-200"
          >
            <UserCircle className="h-8 w-8" />
          </button>
        </div>
      </header>

      {returnTo ? (
        <div className="flex w-full flex-col gap-2 rounded-xl border border-blue-500/25 bg-blue-500/[0.06] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-blue-300">
              Equipment capability workflow
            </p>
            <p className="mt-1 text-xs text-slate-400">
              {skillFilterId
                ? `Showing engineers with recorded evidence for ${skillFilterName}.`
                : "Reviewing engineers linked from the equipment capability record."}
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate(returnTo)}
            className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border border-blue-500/30 px-3 text-xs font-semibold text-blue-300 transition-colors hover:bg-blue-500/10"
          >
            Back to equipment{equipmentContext ? " skills" : ""}{" "}
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : null}

      {/* ── Sync + AI actions ────────────────────────────────────────────── */}
      <div className="flex w-full flex-col gap-4">
        <SyncIndicator
          loading={loading}
          source="Supabase"
          confidence={stats.totalEngineers > 0 ? 92 : undefined}
        />
        {!loading && !loadError && (
          <AiActionsPanel
            actions={
              [
                {
                  label: "Book training for engineers with gaps",
                  description: `${stats.criticalHolders > 0 ? `${stats.criticalHolders} engineers hold critical SPOF skills.` : "Review engineer skill gaps."} Use AI Matching to identify the best training.`,
                  priority: "high",
                  icon: GraduationCap,
                  href: "/training",
                },
                {
                  label: "Review expiring certifications",
                  description: `${stats.certificationsExpiring30d} certification${stats.certificationsExpiring30d !== 1 ? "s" : ""} expire within 30 days. Book renewals before skills become non-compliant.`,
                  priority:
                    stats.certificationsExpiring30d > 0 ? "critical" : "medium",
                  icon: Shield,
                },
                {
                  label: "Add backup engineers for SPOF skills",
                  description:
                    "Engineers holding skills with no backup create single-point-of-failure risk. Cross-train colleagues to reduce site exposure.",
                  priority: "high",
                  icon: Users,
                  href: "/skills-matrix",
                },
                {
                  label: "View AI engineer insights",
                  description:
                    "See AI-generated risk scores, readiness ratings and development recommendations for each engineer.",
                  priority: "low",
                  icon: Brain,
                },
              ] as AiAction[]
            }
          />
        )}
      </div>

      {/* ── Monthly Team Availability Calendar ── */}
      <ShiftCalendar
        title="Team Availability & Coverage Calendar"
        events={MM_CALENDAR_EVENTS}
        role="engineer"
      />

      <div className="flex min-w-0 w-full max-w-full flex-col items-start gap-6">
        {/* ── Coverage summary KPIs ── */}
        <section className="grid w-full grid-cols-2 gap-4 sm:grid-cols-4">
          {[
            {
              label: "Engineers Available Today",
              value: loading ? "—" : String(stats.currentlyAvailable),
              sub: "Ready to deploy",
              valueClass: "text-emerald-400",
            },
            {
              label: "At-Risk Shifts This Month",
              value: "4",
              sub: "Understaffed dates",
              valueClass: "text-orange-400",
            },
            {
              label: "Training Conflicts",
              value: "3",
              sub: "Overlap with shifts",
              valueClass: "text-yellow-400",
            },
            {
              label: "Contractor Cover Required",
              value: "2",
              sub: "Days needing cover",
              valueClass: "text-blue-400",
            },
          ].map(({ label, value, sub, valueClass }) => (
            <Card
              key={label}
              className="min-w-0 rounded-xl border border-gray-800 bg-[#141820] shadow-none"
            >
              <CardContent className="flex flex-col gap-2 p-4">
                <p className="text-xs font-medium text-slate-400">{label}</p>
                <p
                  className={`text-xl font-semibold tabular-nums ${valueClass}`}
                >
                  {value}
                </p>
                <p className="text-[11px] text-slate-500">{sub}</p>
              </CardContent>
            </Card>
          ))}
        </section>

        {/* ── KPI cards: 2 mobile → 4 tablet → 8 desktop ─────────────────────── */}
        <section className="grid w-full grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4">
          {kpiCards.map(({ label, value, sub, icon: Icon, valueClass }) => (
            <Card
              key={label}
              className="min-w-0 h-full rounded-xl border border-gray-800 bg-[#141820] shadow-none"
            >
              <CardContent className="flex min-w-0 h-full flex-col gap-3 p-4 xl:p-5">
                <div className="flex min-w-0 items-center justify-between gap-2">
                  <p className="min-w-0 truncate text-xs font-medium text-slate-400">
                    {label}
                  </p>
                  <Icon className="h-4 w-4 shrink-0 text-slate-600" />
                </div>
                <p
                  className={`truncate text-xl font-semibold tabular-nums ${valueClass}`}
                >
                  {loading ? "—" : value}
                </p>
                <p className="truncate text-[11px] text-slate-500">{sub}</p>
              </CardContent>
            </Card>
          ))}
        </section>

        {/* ── Engineer Register (full-width table, Asset Register style) ──── */}
        <Card className="min-w-0 w-full rounded-xl border border-gray-800 bg-[#141820] shadow-none">
          <CardContent className="flex flex-col gap-0 p-0">
            {/* Register header + filters */}
            <div className="flex flex-col gap-3 px-5 pt-5 pb-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="font-semibold text-slate-50">
                    Engineer Register
                  </h2>
                  <p className="text-sm text-slate-400">
                    {loading
                      ? "Loading engineers…"
                      : `${filteredEngineers.length} engineer${filteredEngineers.length !== 1 ? "s" : ""}${totalTablePages > 1 ? ` · page ${tablePage + 1} of ${totalTablePages}` : ""}`}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {hasActiveFilters && (
                    <button
                      type="button"
                      onClick={resetFilters}
                      className="flex items-center gap-1 text-xs font-medium text-slate-500 transition-colors hover:text-slate-200"
                    >
                      <X className="h-3 w-3" /> Clear
                    </button>
                  )}
                  <Badge className="inline-flex h-auto items-center gap-1.5 rounded bg-[#3b82f620] px-2 py-1 text-xs font-medium text-blue-500 shadow-none hover:bg-[#3b82f620]">
                    <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                    Live
                  </Badge>
                  <button
                    type="button"
                    onClick={() => setTablePage((p) => Math.max(0, p - 1))}
                    disabled={tablePage === 0 || loading}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-gray-800 text-slate-400 transition-colors hover:bg-[#ffffff1a] hover:text-slate-200 disabled:opacity-30"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setTablePage((p) => Math.min(totalTablePages - 1, p + 1))
                    }
                    disabled={tablePage >= totalTablePages - 1 || loading}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-gray-800 text-slate-400 transition-colors hover:bg-[#ffffff1a] hover:text-slate-200 disabled:opacity-30"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Filters */}
              <div className="flex flex-wrap items-center gap-2">
                {skillFilterId ? (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchParams(
                        (current) => {
                          const next = new URLSearchParams(current);
                          next.delete("skill");
                          next.delete("skillName");
                          return next;
                        },
                        { replace: true },
                      );
                    }}
                    className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-blue-500/30 bg-blue-500/10 px-3 text-xs font-semibold text-blue-300"
                  >
                    Skill: {skillFilterName} <X className="h-3 w-3" />
                  </button>
                ) : null}
                <div className="relative min-w-[160px] flex-1">
                  <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
                  <input
                    type="text"
                    placeholder="Search engineers…"
                    value={search}
                    onChange={(e) => {
                      setSearch(e.target.value);
                      setTablePage(0);
                    }}
                    className="h-8 w-full rounded-lg border border-gray-800 bg-[#0b0e14] pl-8 pr-3 text-sm text-slate-200 placeholder:text-slate-600 focus:border-blue-500/50 focus:outline-none focus:ring-1 focus:ring-blue-500/30"
                  />
                </div>
                <Select
                  value={filterDept}
                  onChange={(v) => {
                    setFilterDept(v);
                    setTablePage(0);
                  }}
                  options={[
                    { value: "all", label: "All Departments" },
                    ...deptNames.map((d) => ({ value: d, label: d })),
                  ]}
                  placeholder="All Departments"
                  size="md"
                />
                <Select
                  value={filterSite}
                  onChange={(v) => {
                    setFilterSite(v);
                    setTablePage(0);
                  }}
                  options={[
                    { value: "all", label: "All Sites" },
                    ...siteNames.map((s) => ({ value: s, label: s })),
                  ]}
                  placeholder="All Sites"
                  size="md"
                />
                <Select
                  value={filterAvailability}
                  onChange={(v) => {
                    setFilterAvailability(v);
                    setTablePage(0);
                  }}
                  options={[
                    { value: "all", label: "All Availability" },
                    { value: "available", label: "Available" },
                    { value: "on_shift", label: "On Shift" },
                    { value: "unavailable", label: "Unavailable" },
                  ]}
                  placeholder="All Availability"
                  size="sm"
                />
                <Select
                  value={filterRisk}
                  onChange={(v) => {
                    setFilterRisk(v);
                    setTablePage(0);
                  }}
                  options={[
                    { value: "all", label: "All Risk Levels" },
                    { value: "critical", label: "Critical" },
                    { value: "high", label: "High" },
                    { value: "medium", label: "Medium" },
                    { value: "low", label: "Low" },
                  ]}
                  placeholder="All Risk Levels"
                  size="sm"
                />
              </div>
            </div>

            {/* Error state */}
            {loadError && (
              <div className="mx-5 mb-5 flex flex-col items-center gap-3 rounded-xl border border-red-500/20 bg-[#ef444408] py-10 text-center">
                <AlertTriangle className="h-7 w-7 text-red-500/60" />
                <div>
                  <p className="font-medium text-red-400">
                    Failed to load engineers
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
                    Unable to connect to the database.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setTick((t) => t + 1)}
                  className="rounded-lg border border-red-500/20 px-4 py-2 text-sm font-medium text-red-400 transition-colors hover:bg-red-500/10"
                >
                  Try again
                </button>
              </div>
            )}

            {/* Mobile cards */}
            {!loadError && (
              <div className="block md:hidden px-5 pb-5">
                {loading ? (
                  <div className="flex flex-col gap-3">
                    {Array.from({ length: 4 }).map((_, i) => (
                      <div
                        key={i}
                        className="rounded-xl border border-gray-800 bg-[#141820] p-4"
                      >
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
                    <p className="text-sm text-slate-500">
                      No engineers match the current filters.
                    </p>
                    {hasActiveFilters && (
                      <button
                        type="button"
                        onClick={resetFilters}
                        className="text-sm font-medium text-blue-400 hover:underline"
                      >
                        Clear filters
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-col gap-3">
                    {pagedTable.map((eng) => (
                      <MobileEngineerCard
                        key={eng.id}
                        eng={eng}
                        isActive={selectedEngineer?.id === eng.id}
                        onClick={() =>
                          setSelectedEngineer(
                            selectedEngineer?.id === eng.id ? null : eng,
                          )
                        }
                      />
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Desktop register table */}
            {!loadError && (
              <div className="hidden md:block w-full overflow-x-auto">
                <table className="w-max min-w-[960px] border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-gray-800 bg-[#0f1318]">
                      {[
                        {
                          label: "Engineer",
                          cls: "sticky left-0 z-10 bg-[#0f1318] min-w-[180px]",
                        },
                        { label: "Discipline", cls: "min-w-[130px]" },
                        { label: "Department", cls: "min-w-[130px]" },
                        { label: "Site", cls: "min-w-[110px]" },
                        { label: "Availability", cls: "min-w-[110px]" },
                        { label: "Score", cls: "min-w-[70px] text-center" },
                        { label: "Risk", cls: "min-w-[80px]" },
                        {
                          label: "Training Gaps",
                          cls: "min-w-[110px] text-right",
                        },
                        { label: "SME", cls: "min-w-[60px] text-center" },
                        { label: "Actions", cls: "min-w-[80px]" },
                      ].map(({ label, cls }) => (
                        <th
                          key={label}
                          className={`px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-500 ${cls}`}
                        >
                          {label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      Array.from({ length: TABLE_PAGE_SIZE }).map((_, i) => (
                        <tr
                          key={i}
                          className="border-b border-gray-800/50 bg-[#141820]"
                        >
                          {Array.from({ length: 10 }).map((_, j) => (
                            <td key={j} className="px-4 py-3">
                              <div
                                className="h-4 animate-pulse rounded bg-gray-800"
                                style={{ width: j === 0 ? "140px" : "60px" }}
                              />
                            </td>
                          ))}
                        </tr>
                      ))
                    ) : pagedTable.length === 0 ? (
                      <tr>
                        <td
                          colSpan={10}
                          className="py-12 text-center text-sm text-slate-500"
                        >
                          No engineers match the current filters.{" "}
                          {hasActiveFilters && (
                            <button
                              type="button"
                              onClick={resetFilters}
                              className="font-medium text-blue-400 hover:underline"
                            >
                              Clear filters
                            </button>
                          )}
                        </td>
                      </tr>
                    ) : (
                      pagedTable.map((eng, idx) => {
                        const rowBg =
                          idx % 2 === 0 ? "bg-[#141820]" : "bg-[#111620]";
                        const isActive = selectedEngineer?.id === eng.id;
                        return (
                          <tr
                            key={eng.id}
                            onClick={() =>
                              setSelectedEngineer(isActive ? null : eng)
                            }
                            className={`cursor-pointer border-b border-gray-800/50 transition-colors hover:bg-[#1a2030] ${isActive ? "bg-blue-500/10" : rowBg}`}
                          >
                            {/* Engineer — sticky */}
                            <td
                              className={`sticky left-0 z-10 min-w-[180px] px-4 py-2.5 ${isActive ? "bg-blue-500/10" : rowBg}`}
                            >
                              <div className="flex items-center gap-2">
                                <div
                                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[10px] font-bold ${getAvatarColor(eng.full_name)}`}
                                >
                                  {getInitials(eng.full_name)}
                                </div>
                                <div className="min-w-0">
                                  <div className="flex items-center gap-1">
                                    <p className="truncate text-sm font-medium text-slate-100 leading-tight">
                                      {eng.full_name}
                                    </p>
                                    {eng.verified && (
                                      <CheckCircle2 className="h-2.5 w-2.5 shrink-0 text-emerald-400" />
                                    )}
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <CertDots certs={eng.certifications} />
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-2.5 text-sm text-slate-400">
                              {eng.discipline ?? "—"}
                            </td>
                            <td className="px-4 py-2.5 text-sm text-slate-400">
                              {eng.department_name ?? "—"}
                            </td>
                            <td className="px-4 py-2.5">
                              {eng.site_name ? (
                                <span className="flex items-center gap-1 text-sm text-slate-400">
                                  <MapPin className="h-3 w-3 shrink-0 text-slate-600" />
                                  {eng.site_name}
                                </span>
                              ) : (
                                <span className="text-slate-600">—</span>
                              )}
                            </td>
                            <td className="px-4 py-2.5">
                              <Badge
                                className={`inline-flex h-auto rounded px-2 py-0.5 text-[10px] font-medium shadow-none ${availBadgeClass(eng.availability_status)}`}
                              >
                                {formatAvailStatus(eng.availability_status)}
                              </Badge>
                            </td>
                            <td className="px-4 py-2.5 text-center">
                              <RingScore value={eng.skills_score} size={28} />
                            </td>
                            <td className="px-4 py-2.5">
                              <Badge
                                className={`inline-flex h-auto rounded px-2 py-0.5 text-[10px] font-medium shadow-none ${riskBadgeClass(eng.risk_level)}`}
                              >
                                {capitalize(eng.risk_level)}
                              </Badge>
                            </td>
                            <td className="px-4 py-2.5 text-right">
                              {eng.training_count > 0 ? (
                                <span className="text-sm font-semibold text-orange-400 tabular-nums">
                                  {eng.training_count}
                                </span>
                              ) : (
                                <span className="text-slate-600">0</span>
                              )}
                            </td>
                            <td className="px-4 py-2.5 text-center">
                              {eng.critical_knowledge_holder ? (
                                <Shield
                                  className="mx-auto h-4 w-4 text-blue-400"
                                  title="Critical knowledge holder"
                                />
                              ) : (
                                <span className="text-slate-700">—</span>
                              )}
                            </td>
                            <td className="px-4 py-2.5">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedEngineer(isActive ? null : eng);
                                }}
                                className="rounded-lg border border-gray-700 px-2.5 py-1 text-[10px] font-medium text-slate-400 transition-colors hover:border-gray-600 hover:bg-[#ffffff0a] hover:text-slate-200"
                              >
                                Review
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination footer */}
            {!loading && !loadError && totalTablePages > 1 && (
              <div className="flex items-center justify-between border-t border-gray-800 px-5 py-3 text-xs text-slate-500">
                <span>
                  {tablePage * TABLE_PAGE_SIZE + 1}–
                  {Math.min(
                    (tablePage + 1) * TABLE_PAGE_SIZE,
                    filteredEngineers.length,
                  )}{" "}
                  of {filteredEngineers.length}
                </span>
                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.min(totalTablePages, 8) }).map(
                    (_, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => setTablePage(i)}
                        className={`inline-flex h-7 w-7 items-center justify-center rounded-lg text-xs transition-colors ${i === tablePage ? "bg-blue-500/20 font-semibold text-blue-400" : "text-slate-500 hover:bg-[#ffffff1a]"}`}
                      >
                        {i + 1}
                      </button>
                    ),
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── Insights + Knowledge Holders (secondary, below register) ──────── */}
        <div className="grid w-full grid-cols-1 gap-6 xl:grid-cols-2">
          {/* Engineer Insights */}
          <Card className="min-w-0 rounded-xl border border-gray-800 bg-[#141820] shadow-none">
            <CardContent className="flex min-w-0 flex-col gap-4 p-5">
              <div className="flex items-center gap-2">
                <h2 className="font-semibold text-slate-50">
                  Engineer Insights
                </h2>
                <Badge className="inline-flex h-auto items-center gap-1.5 rounded bg-[#3b82f620] px-2 py-1 text-xs font-medium text-blue-500 shadow-none hover:bg-[#3b82f620]">
                  <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                  Live
                </Badge>
              </div>
              <div className="flex flex-col gap-3">
                {loading ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <div
                      key={i}
                      className="rounded-lg border border-gray-800 p-4"
                    >
                      <div className="h-4 w-48 animate-pulse rounded bg-gray-800" />
                      <div className="mt-2 h-3 w-full animate-pulse rounded bg-gray-800/60" />
                    </div>
                  ))
                ) : insights.length === 0 ? (
                  <div className="flex flex-col items-center gap-2 py-8 text-center">
                    <CheckCircle2 className="h-8 w-8 text-emerald-400/50" />
                    <p className="text-sm font-medium text-emerald-400">
                      All clear
                    </p>
                    <p className="text-xs text-slate-500">
                      No critical issues detected.
                    </p>
                  </div>
                ) : (
                  insights.map((ins, i) => {
                    const conf =
                      ins.severity === "critical"
                        ? {
                            bg: "bg-[#ef444408]",
                            border: "border-red-500/20",
                            icon: "text-red-500",
                            title: "text-red-400",
                          }
                        : ins.severity === "high"
                          ? {
                              bg: "bg-[#f9731608]",
                              border: "border-orange-400/20",
                              icon: "text-orange-400",
                              title: "text-orange-300",
                            }
                          : {
                              bg: "bg-[#facc1508]",
                              border: "border-yellow-400/20",
                              icon: "text-yellow-400",
                              title: "text-yellow-300",
                            };
                    const Icon = ins.icon;
                    return (
                      <div
                        key={i}
                        className={`flex flex-col gap-3 rounded-lg border ${conf.border} ${conf.bg} p-4`}
                      >
                        <div className="flex items-start gap-2.5">
                          <Icon
                            className={`mt-0.5 h-4 w-4 shrink-0 ${conf.icon}`}
                          />
                          <div className="min-w-0 flex-1">
                            <p
                              className={`text-sm font-semibold ${conf.title}`}
                            >
                              {ins.title}
                            </p>
                            <p className="mt-1 text-xs leading-relaxed text-slate-400">
                              {ins.text}
                            </p>
                          </div>
                        </div>
                        {ins.filterKey && (
                          <button
                            type="button"
                            onClick={() => {
                              setFilterRisk(
                                ins.filterKey === "critical"
                                  ? "critical"
                                  : "all",
                              );
                              setTablePage(0);
                            }}
                            className={`self-start rounded-lg border ${conf.border} px-3 py-1.5 text-xs font-medium ${conf.title} transition-colors hover:bg-[#ffffff08]`}
                          >
                            Filter Engineers →
                          </button>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </CardContent>
          </Card>

          {/* Knowledge Holders + Availability */}
          <Card className="min-w-0 rounded-xl border border-gray-800 bg-[#141820] shadow-none">
            <CardContent className="flex min-w-0 flex-col gap-5 p-5">
              {!loading && !loadError && (
                <>
                  <div>
                    <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                      Knowledge Holders
                    </p>
                    <div className="flex flex-col gap-2">
                      {engineers
                        .filter((e) => e.critical_knowledge_holder)
                        .slice(0, 6)
                        .map((eng) => (
                          <div
                            key={eng.id}
                            onClick={() =>
                              setSelectedEngineer(
                                selectedEngineer?.id === eng.id ? null : eng,
                              )
                            }
                            className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-gray-800 bg-[#0b0e14] px-3 py-2 transition-colors hover:border-gray-700 hover:bg-[#141820]"
                          >
                            <div
                              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[10px] font-bold ${getAvatarColor(eng.full_name)}`}
                            >
                              {getInitials(eng.full_name)}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-xs font-medium text-slate-200">
                                {eng.full_name}
                              </p>
                              <p className="truncate text-[10px] text-slate-500">
                                {eng.department_name ?? eng.discipline ?? "—"}
                              </p>
                            </div>
                            <Shield className="h-3.5 w-3.5 shrink-0 text-blue-400" />
                          </div>
                        ))}
                    </div>
                  </div>

                  {engineers.length > 0 && (
                    <div className="border-t border-gray-800 pt-4">
                      <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                        Availability Overview
                      </p>
                      {[
                        {
                          label: "Available",
                          key: "available",
                          cls: "bg-emerald-500",
                        },
                        {
                          label: "On Shift",
                          key: "on_shift",
                          cls: "bg-blue-500",
                        },
                        {
                          label: "Unavailable",
                          key: "unavailable",
                          cls: "bg-red-500",
                        },
                      ].map(({ label, key, cls }) => {
                        const count = engineers.filter(
                          (e) => e.availability_status === key,
                        ).length;
                        const pct =
                          engineers.length > 0
                            ? (count / engineers.length) * 100
                            : 0;
                        return (
                          <div
                            key={key}
                            className="mb-2 flex items-center gap-2"
                          >
                            <span className="w-20 shrink-0 text-[11px] text-slate-400">
                              {label}
                            </span>
                            <div className="flex-1 h-1.5 overflow-hidden rounded-full bg-gray-800">
                              <div
                                className={`h-1.5 rounded-full transition-all ${cls}`}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            <span className="w-6 text-right text-[11px] tabular-nums text-slate-500">
                              {count}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>
              )}

              {loading && (
                <div className="flex flex-col gap-2">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div
                      key={i}
                      className="h-10 animate-pulse rounded-lg bg-gray-800/40"
                    />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
};
