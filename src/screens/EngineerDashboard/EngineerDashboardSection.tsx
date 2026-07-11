import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  Award,
  BookOpen,
  Briefcase,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  GraduationCap,
  Network,
  RefreshCw,
  Sparkles,
  Star,
  TrendingUp,
  Upload,
  User,
  Wrench,
  Zap,
} from "lucide-react";
import { AiActionsPanel, AiAction } from "../../components/AiActionsPanel";
import { AiAnalysing } from "../../components/AiAnalysing";
import { AnimatedProgress } from "../../components/AnimatedProgress";
import { CountUpNumber } from "../../components/CountUpNumber";
import { EmptyState } from "../../components/EmptyState";
import { ExplainWithAi } from "../../components/ExplainWithAi";
import { SyncIndicator } from "../../components/SyncIndicator";
import { TrendIndicator } from "../../components/TrendIndicator";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Card, CardContent } from "../../components/ui/card";
import { useAuth } from "../../lib/auth";
import { supabase } from "../../lib/supabaseClient";

// ─── Types ────────────────────────────────────────────────────────────────────

interface EngineerProfile {
  id: string;
  full_name: string;
  discipline: string | null;
  department_name: string | null;
  site_name: string | null;
  employment_type: string;
  availability_status: "available" | "on_shift" | "training" | "on_leave" | "unavailable";
  skills_score: number;
  risk_level: "critical" | "high" | "medium" | "low";
  training_count: number;
  training_completed: number;
  training_active: number;
  total_skills_assessed: number;
  critical_skills_count: number;
  critical_skills_met: number;
  has_expired_validation: boolean;
  years_experience: number | null;
  ai_confidence: number;
  certifications: CertEntry[];
  top_skills: TopSkill[];
  critical_knowledge_holder: boolean;
}

interface CertEntry {
  skill_name: string;
  category: string;
  expiry_date: string | null;
  verification_status: "validated" | "pending" | "expired";
}

interface TopSkill {
  name: string;
  category: string;
  rating: number;
  is_critical: boolean;
}

interface TrainingBooking {
  id?: string;
  course_title: string;
  status: string;
  booking_date: string | null;
  delivery_type?: string | null;
  partner_name?: string | null;
}

interface SkillGap {
  skill_name: string;
  skill_category: string;
  risk_level: string;
  recommendation: string;
  target_rating: number;
}

interface MatchOpportunity {
  title: string;
  match_score: number;
  status: string;
  required_skills: string[];
}

// ─── Mock fallback data ────────────────────────────────────────────────────────

function buildMockProfile(email: string): EngineerProfile {
  const name = email.split("@")[0].replace(/[._]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  return {
    id: "mock-001",
    full_name: name || "James Mitchell",
    discipline: "Mechanical Engineering",
    department_name: "Maintenance",
    site_name: "Alpha Manufacturing",
    employment_type: "Permanent",
    availability_status: "available",
    skills_score: 74,
    risk_level: "medium",
    training_count: 8,
    training_completed: 5,
    training_active: 2,
    total_skills_assessed: 18,
    critical_skills_count: 6,
    critical_skills_met: 4,
    has_expired_validation: true,
    years_experience: 7,
    ai_confidence: 81,
    critical_knowledge_holder: true,
    certifications: [
      { skill_name: "PSSR Pressure Systems", category: "Compliance", expiry_date: "2025-09-14", verification_status: "validated" },
      { skill_name: "Confined Space Entry", category: "Safety", expiry_date: "2025-07-30", verification_status: "validated" },
      { skill_name: "Manual Handling", category: "Safety", expiry_date: "2024-11-01", verification_status: "expired" },
      { skill_name: "Electrical Safety LV", category: "Electrical", expiry_date: "2026-03-15", verification_status: "validated" },
      { skill_name: "GMP Fundamentals", category: "Pharmaceutical", expiry_date: "2025-12-01", verification_status: "validated" },
    ],
    top_skills: [
      { name: "Allen Bradley PLC", category: "Automation", rating: 5, is_critical: true },
      { name: "Hydraulic Systems", category: "Mechanical", rating: 4, is_critical: true },
      { name: "SAP PM", category: "Systems", rating: 4, is_critical: false },
      { name: "Pneumatic Systems", category: "Mechanical", rating: 3, is_critical: false },
      { name: "Vibration Analysis", category: "Predictive", rating: 3, is_critical: false },
      { name: "GMP Compliance", category: "Pharmaceutical", rating: 4, is_critical: true },
    ],
  };
}

const MOCK_BOOKINGS: TrainingBooking[] = [
  { course_title: "PSSR Refresher — Pressure Systems",  status: "approved",    booking_date: "2025-07-18", delivery_type: "classroom", partner_name: "Safety Pro Ltd" },
  { course_title: "Advanced PLC Programming",           status: "booked",      booking_date: "2025-08-05", delivery_type: "onsite",    partner_name: "ABB Training" },
  { course_title: "Manual Handling Renewal",            status: "pending_approval", booking_date: null,    delivery_type: "blended",   partner_name: null },
  { course_title: "Confined Space — Annual Refresher",  status: "completed",   booking_date: "2025-05-12", delivery_type: "classroom", partner_name: "Site Safety Co" },
];

const MOCK_GAPS: SkillGap[] = [
  { skill_name: "Vibration Analysis Level II",    skill_category: "Predictive",     risk_level: "high",   recommendation: "Book CBM Level 2 course with current provider", target_rating: 4 },
  { skill_name: "ATEX Zone Classification",       skill_category: "Electrical",     risk_level: "critical", recommendation: "Enrol in ATEX certification — required for Zone 1 work", target_rating: 4 },
  { skill_name: "Lean Maintenance Principles",    skill_category: "Systems",        risk_level: "medium", recommendation: "Online module available — 8 hours", target_rating: 3 },
];

const MOCK_OPPORTUNITIES: MatchOpportunity[] = [
  { title: "Senior Mechanical Engineer — Reactor Line", match_score: 87, status: "open",       required_skills: ["Hydraulic Systems", "Allen Bradley PLC", "PSSR"] },
  { title: "Shift Lead — Maintenance (Night)",          match_score: 72, status: "open",       required_skills: ["SAP PM", "Vibration Analysis", "GMP"] },
  { title: "Predictive Maintenance Specialist",         match_score: 61, status: "shortlisted", required_skills: ["Vibration Analysis", "ATEX", "CBM"] },
];

const AI_ACTIONS: AiAction[] = [
  {
    label: "Renew Manual Handling Certificate",
    description:
      "Your Manual Handling cert expired Nov 2024. Required for site compliance — book renewal within 30 days.",
    priority: "critical",
    icon: Award,
    href: "/engineer/certifications",
  },
  {
    label: "Complete ATEX Zone Certification",
    description:
      "Missing ATEX qualification limits your eligibility for Zone 1 work orders. Closing this gap adds +9pts to your match score.",
    priority: "high",
    icon: Zap,
    href: "/engineer/training",
  },
  {
    label: "Validate Vibration Analysis Skills",
    description:
      "Your Vibration Analysis rating has not been validated in 8 months. Request a manager assessment to lock in your current level.",
    priority: "medium",
    icon: Network,
    href: "/engineer/skills",
  },
  {
    label: "Apply for Senior Mechanical Role",
    description:
      "You score 87% match on the Senior Mechanical Engineer opening. Strong match — review requirements and apply.",
    priority: "low",
    icon: Briefcase,
    href: "/engineer/opportunities",
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function certDaysLeft(expiry: string | null): number {
  if (!expiry) return 9999;
  return Math.floor((new Date(expiry).getTime() - Date.now()) / 86_400_000);
}

function certStatusLabel(entry: CertEntry): string {
  if (entry.verification_status === "expired") return "Expired";
  const d = certDaysLeft(entry.expiry_date);
  if (d < 0)   return "Expired";
  if (d <= 30)  return "Expiring Soon";
  if (d <= 90)  return "Expiring";
  return "Valid";
}

function certStatusClass(label: string): string {
  if (label === "Expired")       return "bg-[#ef444420] text-red-400";
  if (label === "Expiring Soon") return "bg-[#f9731620] text-orange-400";
  if (label === "Expiring")      return "bg-[#facc1520] text-yellow-400";
  return "bg-[#10b98120] text-emerald-400";
}

function availClass(s: string): string {
  if (s === "available") return "bg-[#10b98120] text-emerald-400";
  if (s === "on_shift")  return "bg-[#3b82f620] text-blue-400";
  if (s === "training")  return "bg-[#facc1520] text-yellow-400";
  return "bg-[#ef444420] text-red-400";
}

function availLabel(s: string): string {
  if (s === "available") return "Available";
  if (s === "on_shift")  return "On Shift";
  if (s === "training")  return "In Training";
  if (s === "on_leave")  return "On Leave";
  return "Unavailable";
}

function riskClass(r: string): string {
  if (r === "critical") return "bg-[#ef444420] text-red-400";
  if (r === "high")     return "bg-[#f9731620] text-orange-400";
  if (r === "medium")   return "bg-[#facc1520] text-yellow-400";
  return "bg-[#10b98120] text-emerald-400";
}

function bookingStatusClass(s: string): string {
  if (s === "completed")        return "bg-[#10b98120] text-emerald-400";
  if (s === "approved" || s === "booked") return "bg-[#3b82f620] text-blue-400";
  return "bg-[#facc1520] text-yellow-400";
}

function bookingStatusLabel(s: string): string {
  if (s === "pending_approval") return "Pending";
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function ratingLabel(r: number): string {
  if (r === 5) return "Competent";
  if (r === 4) return "Proficient";
  if (r === 3) return "Developing";
  if (r === 2) return "Basic";
  return "Gap";
}

function ratingClass(r: number): string {
  if (r === 5) return "bg-emerald-500/20 text-emerald-400";
  if (r === 4) return "bg-blue-500/20 text-blue-400";
  if (r === 3) return "bg-yellow-400/20 text-yellow-300";
  if (r === 2) return "bg-orange-500/20 text-orange-400";
  return "bg-red-500/20 text-red-400";
}

function matchScoreClass(s: number): string {
  if (s >= 85) return "text-emerald-400";
  if (s >= 70) return "text-blue-400";
  if (s >= 55) return "text-yellow-400";
  return "text-red-400";
}

function matchScoreLabel(s: number): string {
  if (s >= 85) return "Strong Match";
  if (s >= 70) return "Good Match";
  if (s >= 55) return "Partial Match";
  return "Poor Match";
}

function profileCompletion(p: EngineerProfile): number {
  let score = 0;
  if (p.full_name)         score += 20;
  if (p.discipline)        score += 20;
  if (p.site_name)         score += 15;
  if (p.years_experience)  score += 15;
  if (p.top_skills.length >= 3) score += 15;
  if (p.certifications.length >= 2) score += 15;
  return score;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function KpiCard({ label, value, sub, icon: Icon, valueClass = "text-slate-100", index = 0 }: {
  label: string; value: string; sub: string; icon: React.ElementType; valueClass?: string; index?: number;
}) {
  return (
    <Card
      className="motion-safe:animate-card-enter min-w-0 h-full rounded-xl border border-gray-800 bg-[#141820] shadow-none"
      style={{ animationDelay: `${index * 80}ms` }}
    >
      <CardContent className="flex min-w-0 h-full flex-col gap-3 p-4 xl:p-5">
        <div className="flex min-w-0 items-center justify-between gap-2">
          <p className="min-w-0 truncate text-xs font-medium text-slate-400">{label}</p>
          <Icon className="h-4 w-4 shrink-0 text-slate-600" />
        </div>
        <CountUpNumber value={value} className={`truncate text-xl font-semibold tabular-nums ${valueClass}`} delay={index * 80 + 200} />
        <p className="truncate text-[11px] text-slate-500">{sub}</p>
      </CardContent>
    </Card>
  );
}

function SectionHeader({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <h2 className="text-sm font-semibold text-slate-200">{title}</h2>
      {sub && <p className="text-[11px] text-slate-500">{sub}</p>}
    </div>
  );
}

function SkeletonRow({ cols = 5 }: { cols?: number }) {
  return (
    <tr>
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <div className="h-3 animate-pulse rounded bg-gray-800" style={{ width: `${60 + (i % 3) * 20}%` }} />
        </td>
      ))}
    </tr>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function EngineerDashboardSection(): JSX.Element {
  const navigate = useNavigate();
  const { session } = useAuth();
  const [profile, setProfile]     = useState<EngineerProfile | null>(null);
  const [bookings, setBookings]   = useState<TrainingBooking[]>([]);
  const [gaps, setGaps]           = useState<SkillGap[]>([]);
  const [opportunities, setOpps]  = useState<MatchOpportunity[]>([]);
  const [loading, setLoading]     = useState(true);
  const [
    isUsingFallbackProfile,
    setIsUsingFallbackProfile,
  ] = useState(false);
  const [tick, setTick]           = useState(0);
  const [oppPage, setOppPage]     = useState(0);
  const OPP_PAGE = 3;

  const email = session?.user?.email ?? "";

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setIsUsingFallbackProfile(false);
      try {
        const { data } = await supabase.functions.invoke("engineers-data");
        if (cancelled) return;
        if (data?.engineers?.length) {
          setIsUsingFallbackProfile(false);
          const eng = data.engineers[0] as EngineerProfile;
          setProfile(eng);
          const myBookings: TrainingBooking[] = (data.trainingBookings ?? [])
            .filter((b: TrainingBooking & { engineer_id?: string }) => !b.engineer_id || b.engineer_id === eng.id)
            .slice(0, 10);
          setBookings(myBookings.length ? myBookings : MOCK_BOOKINGS);
          const myGaps: SkillGap[] = (data.skillGaps ?? []).slice(0, 5).map((g: SkillGap) => g);
          setGaps(myGaps.length ? myGaps : MOCK_GAPS);
        } else {
          setIsUsingFallbackProfile(true);
          setProfile(buildMockProfile(email));
          setBookings(MOCK_BOOKINGS);
          setGaps(MOCK_GAPS);
        }
        setOpps(MOCK_OPPORTUNITIES);
      } catch {
        if (!cancelled) {
          setIsUsingFallbackProfile(true);
          setProfile(buildMockProfile(email));
          setBookings(MOCK_BOOKINGS);
          setGaps(MOCK_GAPS);
          setOpps(MOCK_OPPORTUNITIES);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [tick, email]);

  const p = profile;
  const completion = p ? profileCompletion(p) : 0;

  const expiringCerts = useMemo(() =>
    (p?.certifications ?? []).filter((c) => {
      const lbl = certStatusLabel(c);
      return lbl !== "Valid";
    }).sort((a, b) => certDaysLeft(a.expiry_date) - certDaysLeft(b.expiry_date)),
    [p]
  );

  const todayPriorities = useMemo(() => {
    const items: { label: string; sub: string; type: "cert" | "training" | "gap" | "action"; severity: "critical" | "high" | "medium" | "low" }[] = [];
    expiringCerts.slice(0, 2).forEach((c) => {
      const d = certDaysLeft(c.expiry_date);
      items.push({
        label: `${c.skill_name} — ${certStatusLabel(c)}`,
        sub: d < 0 ? "Expired — book renewal now" : `Expires in ${d} day${d !== 1 ? "s" : ""}`,
        type: "cert",
        severity: d < 0 ? "critical" : d <= 30 ? "high" : "medium",
      });
    });
    bookings.filter((b) => b.status !== "completed").slice(0, 2).forEach((b) => {
      items.push({
        label: b.course_title,
        sub: b.booking_date ? `Scheduled ${b.booking_date}` : "Awaiting schedule",
        type: "training",
        severity: "low",
      });
    });
    gaps.filter((g) => g.risk_level === "critical" || g.risk_level === "high").slice(0, 2).forEach((g) => {
      items.push({
        label: `Skill gap: ${g.skill_name}`,
        sub: g.recommendation,
        type: "gap",
        severity: g.risk_level as "critical" | "high",
      });
    });
    return items.slice(0, 6);
  }, [expiringCerts, bookings, gaps]);

  const pagedOpps = opportunities.slice(oppPage * OPP_PAGE, oppPage * OPP_PAGE + OPP_PAGE);
  const totalOppPages = Math.ceil(opportunities.length / OPP_PAGE);

  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = 0; }, []);

  // Career progress mock
  const currentRole   = p?.discipline ?? "Mechanical Engineer";
  const nextRole      = "Senior Mechanical Engineer";
  const careerPct     = 62;
  const missingSkills = ["ATEX Certification", "Vibration Analysis Level II", "Project Management Fundamentals"];

  const [careerBarPct, setCareerBarPct] = useState(0);
  useEffect(() => {
    if (loading) { setCareerBarPct(0); return; }
    const t = setTimeout(() => setCareerBarPct(careerPct), 80);
    return () => clearTimeout(t);
  }, [loading, careerPct]);

  return (
    <div ref={scrollRef} className="flex flex-col gap-6 px-4 pb-12 pt-5 md:px-6 xl:px-8">

      {/* ── Page header ─────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl font-semibold text-slate-50">
              {loading ? (
                <span className="inline-block h-6 w-48 animate-pulse rounded bg-gray-800" />
              ) : (
                `Welcome back, ${p?.full_name?.split(" ")[0] ?? "Engineer"}`
              )}
            </h1>
            {!loading && p && (
              <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${availClass(p.availability_status)}`}>
                {availLabel(p.availability_status)}
              </span>
            )}
          </div>
          <p className="text-sm text-slate-400">
            {loading ? (
              <span className="inline-block h-4 w-64 animate-pulse rounded bg-gray-800" />
            ) : (
              [p?.discipline, p?.department_name, p?.site_name].filter(Boolean).join(" · ")
            )}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2 flex-wrap">
          <SyncIndicator />
          <ExplainWithAi pageId="engineer-dashboard" />
          <button
            type="button"
            onClick={() => setTick((t) => t + 1)}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-gray-700 bg-transparent px-3 text-xs font-medium text-slate-400 transition-colors hover:border-gray-600 hover:text-slate-200"
            aria-label="Refresh"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* ── Data-source warning ─────────────────────────────────────────────── */}
      {!loading && (
        <div
          role="status"
          aria-live="polite"
          className={`flex items-start gap-3 rounded-lg border px-4 py-3 ${
            isUsingFallbackProfile
              ? "border-orange-500/35 bg-orange-500/[0.08]"
              : "border-yellow-500/25 bg-yellow-500/[0.05]"
          }`}
        >
          <AlertTriangle
            aria-hidden="true"
            className={`mt-0.5 h-4 w-4 shrink-0 ${
              isUsingFallbackProfile
                ? "text-orange-400"
                : "text-yellow-400"
            }`}
          />

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p
                className={`text-xs font-semibold ${
                  isUsingFallbackProfile
                    ? "text-orange-300"
                    : "text-yellow-300"
                }`}
              >
                {isUsingFallbackProfile
                  ? "Demo fallback data displayed"
                  : "Pilot dashboard contains sample data"
                }
              </p>

              <span
                className={`inline-flex rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider ${
                  isUsingFallbackProfile
                    ? "bg-orange-500/15 text-orange-300"
                    : "bg-yellow-500/15 text-yellow-300"
                }`}
              >
                {isUsingFallbackProfile
                  ? "Demo data"
                  : "Mixed data"
                }
              </span>
            </div>

            <p className="mt-1 text-[11px] leading-relaxed text-slate-400">
              {isUsingFallbackProfile
                ? "Live Engineer data could not be loaded. The profile, training, skills, opportunities, career progression and AI recommendations shown below are sample data and must not be used operationally."
                : "The Engineer profile may be loaded from the live data service, but training fallbacks, opportunities, career progression and AI recommendations may still contain sample data and must not be treated as operational records."}
            </p>
          </div>

          {isUsingFallbackProfile && (
            <button
              type="button"
              onClick={() => setTick((value) => value + 1)}
              disabled={loading}
              className="shrink-0 rounded-md border border-orange-500/30 bg-orange-500/10 px-3 py-1.5 text-[11px] font-semibold text-orange-300 transition-colors hover:bg-orange-500/15 disabled:cursor-wait disabled:opacity-50"
            >
              Retry live data
            </button>
          )}
        </div>
      )}

      {/* ── Profile completion strip ─────────────────────────────────────────── */}
      {!loading && p && completion < 100 && (
        <div className="flex items-center gap-3 rounded-lg border border-[#3b82f620] bg-[#0d1523] px-4 py-3">
          <User className="h-4 w-4 shrink-0 text-blue-400" />
          <div className="flex flex-1 flex-col gap-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-medium text-slate-300">Profile {completion}% complete</p>
              <span className="text-[11px] text-slate-500">Add missing details to improve your match score</span>
            </div>
            <AnimatedProgress value={completion} className="h-1.5 bg-gray-800 [&>div]:bg-blue-500" />
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => navigate("/engineer/settings")}
            aria-label="Open profile settings to complete your profile"
            className="shrink-0 h-7 border-[#3b82f640] bg-transparent text-blue-400 hover:bg-[#3b82f618] hover:text-blue-300 text-xs"
          >
            Complete Profile
          </Button>
        </div>
      )}

      {/* ── KPI cards ────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-5">
        <KpiCard
          index={0}
          label="Skills Score"
          value={loading ? "—" : `${p?.skills_score ?? 0}`}
          sub={loading ? "" : `${p?.total_skills_assessed ?? 0} skills assessed`}
          icon={Network}
          valueClass={!loading && p ? (p.skills_score >= 80 ? "text-emerald-400" : p.skills_score >= 60 ? "text-blue-400" : "text-orange-400") : "text-slate-100"}
        />
        <KpiCard
          index={1}
          label="Training Readiness"
          value={loading ? "—" : `${p ? Math.round((p.training_completed / Math.max(p.training_count, 1)) * 100) : 0}%`}
          sub={loading ? "" : `${p?.training_completed ?? 0} of ${p?.training_count ?? 0} complete`}
          icon={GraduationCap}
          valueClass="text-slate-100"
        />
        <KpiCard
          index={2}
          label="Certifications"
          value={loading ? "—" : `${expiringCerts.length > 0 ? expiringCerts.length + " issue" + (expiringCerts.length !== 1 ? "s" : "") : "All Valid"}`}
          sub={loading ? "" : expiringCerts.length > 0 ? `${expiringCerts.filter(c => certStatusLabel(c) === "Expired").length} expired` : `${p?.certifications?.length ?? 0} total certifications`}
          icon={Award}
          valueClass={!loading ? (expiringCerts.some(c => certStatusLabel(c) === "Expired") ? "text-red-400" : expiringCerts.length > 0 ? "text-orange-400" : "text-emerald-400") : "text-slate-100"}
        />
        <KpiCard
          index={3}
          label="AI Match Score"
          value={loading ? "—" : `${p?.ai_confidence ?? 0}%`}
          sub={loading ? "" : `${p?.critical_skills_met ?? 0}/${p?.critical_skills_count ?? 0} critical skills met`}
          icon={Sparkles}
          valueClass={!loading && p ? matchScoreClass(p.ai_confidence) : "text-slate-100"}
        />
        <KpiCard
          index={4}
          label="Availability"
          value={loading ? "—" : availLabel(p?.availability_status ?? "unavailable")}
          sub={loading ? "" : p?.employment_type ?? ""}
          icon={CalendarDays}
          valueClass={!loading && p ? availClass(p.availability_status).split(" ")[1] : "text-slate-100"}
        />
      </div>

      {/* ── Today's Priorities + AI Recommendations (2-col on lg) ─────────────── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">

        {/* Today's Priorities */}
        <Card className="min-w-0 rounded-xl border border-gray-800 bg-[#141820] shadow-none">
          <CardContent className="flex flex-col gap-0 p-0">
            <div className="flex items-center justify-between gap-2 border-b border-gray-800 px-5 py-4">
              <SectionHeader title="Today's Priorities" sub="Actions requiring your attention" />
              {!loading && todayPriorities.length > 0 && (
                <Badge variant="secondary" className="bg-[#ef444420] text-red-400 border-0 text-[10px]">
                  {todayPriorities.filter(p => p.severity === "critical" || p.severity === "high").length} urgent
                </Badge>
              )}
            </div>
            {loading ? (
              <div className="flex flex-col gap-3 p-5">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex gap-3">
                    <div className="h-8 w-8 animate-pulse rounded-lg bg-gray-800 shrink-0" />
                    <div className="flex flex-1 flex-col gap-1.5">
                      <div className="h-3 w-3/4 animate-pulse rounded bg-gray-800" />
                      <div className="h-2.5 w-1/2 animate-pulse rounded bg-gray-800" />
                    </div>
                  </div>
                ))}
              </div>
            ) : todayPriorities.length === 0 ? (
              <div className="p-5">
                <EmptyState icon={CheckCircle2} title="All clear" description="No outstanding priorities today." />
              </div>
            ) : (
              <ul className="flex flex-col divide-y divide-gray-800/60">
                {todayPriorities.map((item, i) => {
                  const iconMap = { cert: Award, training: BookOpen, gap: Network, action: ClipboardList };
                  const Icon = iconMap[item.type];
                  const dotClass: Record<string, string> = {
                    critical: "bg-red-500",
                    high: "bg-orange-400",
                    medium: "bg-yellow-400",
                    low: "bg-emerald-400",
                  };
                  return (
                    <li key={i} className="flex items-start gap-3 px-5 py-3.5">
                      <div className="relative mt-0.5 shrink-0">
                        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#0b0e14]">
                          <Icon className="h-3.5 w-3.5 text-slate-400" />
                        </div>
                        <span className={`absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full ${dotClass[item.severity]}`} />
                      </div>
                      <div className="flex flex-1 flex-col gap-0.5 min-w-0">
                        <p className="truncate text-xs font-semibold text-slate-200">{item.label}</p>
                        <p className="text-[11px] text-slate-500 leading-relaxed">{item.sub}</p>
                      </div>
                      <span className={`shrink-0 inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${riskClass(item.severity)}`}>
                        {item.severity}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Career Progress */}
        <Card className="min-w-0 rounded-xl border border-gray-800 bg-[#141820] shadow-none">
          <CardContent className="flex flex-col gap-0 p-0">
            <div className="border-b border-gray-800 px-5 py-4">
              <SectionHeader title="Career Progression" sub="Your path to the next role" />
            </div>
            <div className="flex flex-col gap-5 p-5">
              {loading ? (
                <AiAnalysing message="AI is mapping your career path…" block className="w-full" />
              ) : (
                <>
                  <div className="flex items-center gap-3">
                    <div className="flex flex-1 flex-col gap-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 text-[11px] text-slate-500">
                        <span className="truncate font-medium text-slate-300">{currentRole}</span>
                        <span className="truncate text-right font-medium text-blue-400">{nextRole}</span>
                      </div>
                      <div className="relative h-2 overflow-hidden rounded-full bg-gray-800">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-blue-600 to-blue-400 motion-safe:transition-all motion-safe:duration-700"
                          style={{ width: `${careerBarPct}%` }}
                        />
                      </div>
                      <div className="flex items-center justify-between text-[10px] text-slate-600">
                        <span>Current</span>
                        <span>{careerPct}% ready</span>
                        <span>Target</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Missing requirements</p>
                    <div className="flex flex-col gap-1.5">
                      {missingSkills.map((s, i) => (
                        <div key={i} className="flex items-center gap-2 rounded-lg border border-gray-800 bg-[#0b0e14] px-3 py-2">
                          <div className="h-1.5 w-1.5 rounded-full bg-orange-400 shrink-0" />
                          <span className="flex-1 text-[11px] text-slate-300">{s}</span>
                          <span className="text-[10px] text-slate-600">Required</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {p?.critical_knowledge_holder && (
                    <div className="flex items-start gap-2.5 rounded-lg border border-[#3b82f620] bg-[#3b82f60a] p-3">
                      <Star className="mt-0.5 h-3.5 w-3.5 shrink-0 text-blue-400" />
                      <p className="text-[11px] leading-relaxed text-slate-400">
                        You are a <span className="text-blue-400 font-medium">Critical Knowledge Holder</span> — your expertise is essential to site operations.
                      </p>
                    </div>
                  )}
                </>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── AI Recommendations ────────────────────────────────────────────────── */}
      {!loading && (
        <div className="flex flex-col gap-3">
          <SectionHeader title="AI Recommendations" sub="Personalised actions based on your profile" />
          <AiActionsPanel actions={AI_ACTIONS} />
        </div>
      )}
      {loading && (
        <div className="rounded-xl border border-[#3b82f620] bg-[#0d1523] p-5">
          <AiAnalysing message="AI is generating your recommendations…" block className="w-full" />
        </div>
      )}

      {/* ── Training Bookings + Certifications ──────────────────────────────── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">

        {/* Upcoming Bookings */}
        <Card className="min-w-0 rounded-xl border border-gray-800 bg-[#141820] shadow-none">
          <CardContent className="flex flex-col gap-0 p-0">
            <div className="flex items-center justify-between gap-2 border-b border-gray-800 px-5 py-4">
              <SectionHeader title="Training Bookings" sub="Your upcoming and recent training" />
            </div>
            <div className="hidden md:block w-full overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-gray-800 bg-[#0f1318]">
                    {["Course", "Provider", "Date", "Status"].map((h) => (
                      <th key={h} className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    [1, 2, 3].map((i) => <SkeletonRow key={i} cols={4} />)
                  ) : bookings.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-8 text-center text-sm text-slate-500">No bookings found.</td>
                    </tr>
                  ) : (
                    bookings.map((b, i) => (
                      <tr
                        key={i}
                        className={`border-b border-gray-800/50 transition-colors hover:bg-[#ffffff04] ${i % 2 === 0 ? "bg-[#141820]" : "bg-[#111520]"}`}
                      >
                        <td className="px-4 py-3 text-xs font-medium text-slate-200 max-w-[180px]">
                          <span className="block truncate">{b.course_title}</span>
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-400">{b.partner_name ?? "—"}</td>
                        <td className="px-4 py-3 text-xs text-slate-400 whitespace-nowrap">{b.booking_date ?? "TBC"}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold ${bookingStatusClass(b.status)}`}>
                            {bookingStatusLabel(b.status)}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            {/* Mobile cards */}
            <div className="flex flex-col divide-y divide-gray-800/60 md:hidden">
              {bookings.map((b, i) => (
                <div key={i} className="flex items-start gap-3 px-4 py-3">
                  <BookOpen className="mt-0.5 h-4 w-4 shrink-0 text-slate-600" />
                  <div className="flex-1 min-w-0">
                    <p className="truncate text-xs font-medium text-slate-200">{b.course_title}</p>
                    <p className="text-[11px] text-slate-500">{b.partner_name ?? "—"} · {b.booking_date ?? "TBC"}</p>
                  </div>
                  <span className={`shrink-0 inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold ${bookingStatusClass(b.status)}`}>
                    {bookingStatusLabel(b.status)}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Certifications */}
        <Card className="min-w-0 rounded-xl border border-gray-800 bg-[#141820] shadow-none">
          <CardContent className="flex flex-col gap-0 p-0">
            <div className="flex items-center justify-between gap-2 border-b border-gray-800 px-5 py-4">
              <SectionHeader title="Certifications" sub="Status of your qualifications" />
              {expiringCerts.length > 0 && (
                <Badge variant="secondary" className="bg-[#f9731620] text-orange-400 border-0 text-[10px]">
                  {expiringCerts.length} need attention
                </Badge>
              )}
            </div>
            <ul className="flex flex-col divide-y divide-gray-800/50">
              {loading ? (
                [1, 2, 3].map((i) => (
                  <li key={i} className="flex items-center gap-3 px-5 py-3">
                    <div className="h-3 w-1/3 animate-pulse rounded bg-gray-800" />
                    <div className="ml-auto h-5 w-16 animate-pulse rounded bg-gray-800" />
                  </li>
                ))
              ) : (p?.certifications ?? []).length === 0 ? (
                <li className="px-5 py-6 text-center text-sm text-slate-500">No certifications on record.</li>
              ) : (
                (p?.certifications ?? []).map((c, i) => {
                  const lbl = certStatusLabel(c);
                  const d = certDaysLeft(c.expiry_date);
                  return (
                    <li key={i} className="flex items-center gap-3 px-5 py-3">
                      <Award className="h-3.5 w-3.5 shrink-0 text-slate-600" />
                      <div className="flex flex-1 flex-col min-w-0 gap-0.5">
                        <p className="truncate text-xs font-medium text-slate-200">{c.skill_name}</p>
                        <p className="text-[11px] text-slate-500">{c.category} · {c.expiry_date ?? "No expiry"}</p>
                      </div>
                      <div className="shrink-0 flex flex-col items-end gap-0.5">
                        <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold ${certStatusClass(lbl)}`}>
                          {lbl}
                        </span>
                        {d > 0 && d < 365 && (
                          <span className="text-[10px] text-slate-600">{d}d</span>
                        )}
                      </div>
                    </li>
                  );
                })
              )}
            </ul>
          </CardContent>
        </Card>
      </div>

      {/* ── Skills Matrix Summary ─────────────────────────────────────────────── */}
      <Card className="min-w-0 rounded-xl border border-gray-800 bg-[#141820] shadow-none">
        <CardContent className="flex flex-col gap-0 p-0">
          <div className="flex items-center justify-between gap-2 border-b border-gray-800 px-5 py-4">
            <SectionHeader title="Skills Matrix" sub="Your competency profile" />
            {!loading && p && (
              <TrendIndicator direction="up" value={`${p.skills_score}% overall`} />
            )}
          </div>
          <div className="grid grid-cols-1 gap-0 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-gray-800/50">
            {/* Top skills */}
            <div className="flex flex-col gap-0 p-5">
              <p className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Strongest Skills</p>
              {loading ? (
                [1, 2, 3].map((i) => <div key={i} className="mb-2 h-8 animate-pulse rounded bg-gray-800" />)
              ) : (
                (p?.top_skills ?? []).filter((s) => s.rating >= 4).slice(0, 4).map((s, i) => (
                  <div key={i} className="flex items-center gap-2 py-1.5">
                    <span className="flex-1 truncate text-xs text-slate-300">{s.name}</span>
                    <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold ${ratingClass(s.rating)}`}>
                      {ratingLabel(s.rating)}
                    </span>
                    {s.is_critical && (
                      <span className="shrink-0 text-[9px] font-semibold uppercase text-blue-400 tracking-wider">Critical</span>
                    )}
                  </div>
                ))
              )}
            </div>

            {/* Needs validation */}
            <div className="flex flex-col gap-0 p-5">
              <p className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Needs Validation</p>
              {loading ? (
                [1, 2].map((i) => <div key={i} className="mb-2 h-8 animate-pulse rounded bg-gray-800" />)
              ) : (
                (p?.top_skills ?? []).filter((s) => s.rating === 3).slice(0, 3).map((s, i) => (
                  <div key={i} className="flex items-center gap-2 py-1.5">
                    <span className="flex-1 truncate text-xs text-slate-300">{s.name}</span>
                    <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold ${ratingClass(s.rating)}`}>
                      {ratingLabel(s.rating)}
                    </span>
                  </div>
                ))
              )}
            </div>

            {/* Skill Gaps */}
            <div className="flex flex-col gap-0 p-5">
              <p className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Skill Gaps</p>
              {loading ? (
                [1, 2, 3].map((i) => <div key={i} className="mb-2 h-8 animate-pulse rounded bg-gray-800" />)
              ) : gaps.length === 0 ? (
                <p className="text-[11px] text-slate-500">No gaps identified.</p>
              ) : (
                gaps.slice(0, 4).map((g, i) => (
                  <div key={i} className="flex items-center gap-2 py-1.5">
                    <span className="flex-1 truncate text-xs text-slate-300">{g.skill_name}</span>
                    <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${riskClass(g.risk_level)}`}>
                      {g.risk_level}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Suggested Opportunities ───────────────────────────────────────────── */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <SectionHeader title="Suggested Opportunities" sub="Roles matched to your profile" />
          {opportunities.length > OPP_PAGE && (
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setOppPage((v) => Math.max(0, v - 1))}
                disabled={oppPage === 0}
                className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-gray-700 text-slate-400 transition-colors hover:border-gray-600 hover:text-slate-200 disabled:opacity-30 disabled:pointer-events-none"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="text-[11px] text-slate-500 tabular-nums">{oppPage + 1}/{totalOppPages}</span>
              <button
                type="button"
                onClick={() => setOppPage((v) => Math.min(totalOppPages - 1, v + 1))}
                disabled={oppPage >= totalOppPages - 1}
                className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-gray-700 text-slate-400 transition-colors hover:border-gray-600 hover:text-slate-200 disabled:opacity-30 disabled:pointer-events-none"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {loading ? (
            [1, 2, 3].map((i) => (
              <div key={i} className="h-32 animate-pulse rounded-xl bg-gray-800" />
            ))
          ) : pagedOpps.length === 0 ? (
            <div className="col-span-3">
              <EmptyState icon={Briefcase} title="No opportunities found" description="Check back as new roles are matched to your profile." />
            </div>
          ) : (
            pagedOpps.map((opp, i) => (
              <div
                key={i}
                className="flex flex-col gap-3 rounded-xl border border-gray-800 bg-[#141820] p-4 transition-all hover:border-blue-500/30 hover:shadow-[0_0_0_1px_rgba(59,130,246,0.1)] motion-safe:animate-card-enter"
                style={{ animationDelay: `${i * 80}ms` }}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#3b82f620] shrink-0">
                      <Briefcase className="h-3.5 w-3.5 text-blue-400" />
                    </div>
                    <span className={`text-lg font-bold tabular-nums ${matchScoreClass(opp.match_score)}`}>{opp.match_score}%</span>
                  </div>
                  <span className="shrink-0 inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold bg-[#3b82f620] text-blue-400">
                    {opp.status === "shortlisted" ? "Shortlisted" : "Open"}
                  </span>
                </div>
                <div>
                  <p className="text-xs font-semibold leading-snug text-slate-200">{opp.title}</p>
                  <p className="mt-0.5 text-[11px] text-slate-500">{matchScoreLabel(opp.match_score)}</p>
                </div>
                <div className="flex flex-wrap gap-1">
                  {opp.required_skills.slice(0, 3).map((s, j) => (
                    <span key={j} className="rounded bg-[#3b82f610] px-1.5 py-0.5 text-[10px] text-slate-400">{s}</span>
                  ))}
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => navigate("/engineer/opportunities")}
                  aria-label={`View opportunity: ${opp.title}`}
                  className="mt-auto h-7 w-full border-gray-700 bg-transparent text-xs text-slate-400 hover:border-blue-500/40 hover:text-blue-400"
                >
                  View Role
                </Button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* ── Quick Actions ─────────────────────────────────────────────────────── */}
      <Card className="min-w-0 rounded-xl border border-gray-800 bg-[#141820] shadow-none">
        <CardContent className="flex flex-col gap-4 p-5">
          <SectionHeader title="Quick Actions" />
          <div className="flex flex-wrap gap-2">
            {[
              { label: "Update Skills",       icon: Network,       variant: "outline" as const },
              { label: "Upload Certificate",  icon: Upload,        variant: "outline" as const },
              { label: "Book Training",       icon: GraduationCap, variant: "outline" as const },
              { label: "View Opportunities",  icon: Briefcase,     variant: "outline" as const },
              { label: "Contact Manager",     icon: User,          variant: "outline" as const },
            ].map(({ label, icon: Icon, variant }) => (
              <Button
                key={label}
                size="sm"
                variant={variant}
                className="h-8 gap-1.5 border-gray-700 bg-transparent text-slate-400 hover:border-blue-500/40 hover:text-blue-400 text-xs"
              >
                <Icon className="h-3.5 w-3.5 shrink-0" />
                {label}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

    </div>
  );
}
