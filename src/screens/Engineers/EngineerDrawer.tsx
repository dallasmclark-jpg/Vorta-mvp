import { useMemo } from "react";
import {
  AlertTriangle,
  Award,
  BookOpen,
  Brain,
  Building2,
  CheckCircle2,
  ExternalLink,
  FileText,
  GraduationCap,
  MapPin,
  MessageSquare,
  Shield,
  Sparkles,
  TrendingUp,
  UserCircle,
  X,
  Zap,
} from "lucide-react";
import { Badge } from "../../components/ui/badge";
import { Progress } from "../../components/ui/progress";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CertEntry {
  skill_name: string;
  category: string;
  expiry_date: string | null;
  verification_status: string;
}

export interface DrawerEngineer {
  id: string;
  full_name: string;
  discipline: string | null;
  employment_type: string;
  availability_status: string;
  verified: boolean;
  shift_pattern: string | null;
  department_name: string | null;
  site_name: string | null;
  site_region: string | null;
  skills_score: number;
  risk_level: string;
  training_count: number;
  total_skills_assessed: number;
  critical_skills_count: number;
  critical_skills_met: number;
  has_expired_validation: boolean;
  last_assessment_date: string | null;
  top_skills: { name: string; category: string; rating: number; is_critical: boolean }[];
  training_completed: number;
  training_active: number;
  critical_knowledge_holder: boolean;
  retirement_risk: string | null;
  leaving_risk: string | null;
  certifications: CertEntry[];
  years_experience: number | null;
  ai_confidence: number;
}

export interface EnrichedAssignment {
  engineer_id: string;
  skill_id: string;
  skill_name: string;
  skill_category: string;
  is_critical: boolean;
  rating: number | null;
  training_required: boolean;
  verification_status: string;
  last_validated_at: string | null;
}

export interface TrainingBooking {
  engineer_id: string;
  course_title: string;
  status: string;
  booking_date: string | null;
}

export interface GapRow {
  id: string;
  skill_name: string;
  skill_category: string;
  department_name: string | null;
  target_rating: number;
  current_average_rating: number;
  engineers_below_target: number;
  single_point_of_failure: boolean;
  risk_level: string;
  recommendation: string;
}

interface DrawerProps {
  engineer: DrawerEngineer | null;
  assignments: EnrichedAssignment[];
  trainingBookings: TrainingBooking[];
  skillGaps: GapRow[];
  onClose: () => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const AVATAR_COLORS = [
  "bg-blue-500/20 text-blue-400",
  "bg-emerald-500/20 text-emerald-400",
  "bg-amber-500/20 text-amber-400",
  "bg-cyan-500/20 text-cyan-400",
  "bg-rose-500/20 text-rose-400",
  "bg-teal-500/20 text-teal-400",
  "bg-orange-500/20 text-orange-400",
  "bg-sky-500/20 text-sky-400",
];

export function getInitials(name: string): string {
  const parts = name.trim().split(" ");
  return ((parts[0]?.[0] ?? "") + (parts[parts.length - 1]?.[0] ?? "")).toUpperCase();
}

export function getAvatarColor(name: string): string {
  let hash = 0;
  for (const c of name) hash = (hash * 31 + c.charCodeAt(0)) & 0xffff;
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

function ratingStyle(r: number | null): { bg: string; text: string } {
  switch (r) {
    case 5: return { bg: "bg-emerald-500/20", text: "text-emerald-400" };
    case 4: return { bg: "bg-blue-500/20",    text: "text-blue-400"    };
    case 3: return { bg: "bg-yellow-400/20",  text: "text-yellow-300"  };
    case 2: return { bg: "bg-orange-500/20",  text: "text-orange-400"  };
    case 1: return { bg: "bg-red-500/20",     text: "text-red-400"     };
    default: return { bg: "bg-transparent",   text: "text-slate-600"   };
  }
}

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

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

const RATING_LABELS: Record<number, string> = {
  5: "Competent", 4: "Proficient", 3: "Developing", 2: "Basic", 1: "Gap",
};

function certStatus(c: CertEntry): { label: string; cls: string; dot: string } {
  const now = Date.now();
  const thirty = 30 * 24 * 60 * 60 * 1000;
  const isExpired = c.expiry_date && new Date(c.expiry_date).getTime() < now;
  const isExpiring = c.expiry_date && !isExpired && new Date(c.expiry_date).getTime() < now + thirty;
  if (isExpired)  return { label: "Expired",        cls: "text-red-400",     dot: "bg-red-500"     };
  if (isExpiring) return { label: "Expiring soon",  cls: "text-amber-400",   dot: "bg-amber-400"   };
  if (c.verification_status === "validated") return { label: "Valid",   cls: "text-emerald-400", dot: "bg-emerald-400" };
  return { label: capitalize(c.verification_status), cls: "text-amber-400", dot: "bg-amber-400" };
}

// ─── EngineerDrawer ───────────────────────────────────────────────────────────

export function EngineerDrawer({ engineer, assignments, trainingBookings, skillGaps, onClose }: DrawerProps) {
  const isOpen = engineer !== null;

  const engAssignments = useMemo(
    () => (engineer ? assignments.filter((a) => a.engineer_id === engineer.id) : []),
    [engineer, assignments]
  );

  const engBookings = useMemo(
    () => (engineer ? trainingBookings.filter((b) => b.engineer_id === engineer.id) : []),
    [engineer, trainingBookings]
  );

  const completedBookings = useMemo(() => engBookings.filter((b) => b.status === "completed"), [engBookings]);
  const activeBookings    = useMemo(() => engBookings.filter((b) => b.status !== "completed"), [engBookings]);

  const criticalAssignments = useMemo(
    () => engAssignments.filter((a) => a.is_critical).sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0)),
    [engAssignments]
  );

  const insights = useMemo(() => {
    if (!engineer) return [];
    const items: { severity: "critical" | "high" | "medium"; icon: React.ElementType; title: string; text: string }[] = [];

    if (engineer.retirement_risk === "high" || engineer.leaving_risk === "high") {
      items.push({
        severity: "critical", icon: Shield,
        title: "High attrition risk",
        text: `${engineer.retirement_risk === "high" ? "Retirement" : "Leaving"} risk flagged. Initiate knowledge transfer and identify successor candidates.`,
      });
    }
    if (engineer.critical_knowledge_holder) {
      const unmet = engineer.critical_skills_count - engineer.critical_skills_met;
      if (unmet > 0) {
        items.push({
          severity: "high", icon: Zap,
          title: "Critical knowledge holder with skill gaps",
          text: `${unmet} of ${engineer.critical_skills_count} critical skills below target. Cross-train a backup to reduce SPOF exposure.`,
        });
      }
    }
    if (engineer.training_count > 0) {
      items.push({
        severity: engineer.training_count > 5 ? "high" : "medium", icon: TrendingUp,
        title: `${engineer.training_count} skill gap${engineer.training_count !== 1 ? "s" : ""} require training`,
        text: `Prioritise critical and compliance skills first. ${activeBookings.length > 0 ? `${activeBookings.length} course(s) already booked.` : "No active bookings yet."}`,
      });
    }
    if (engineer.has_expired_validation) {
      items.push({
        severity: "medium", icon: AlertTriangle,
        title: "Validation records require renewal",
        text: "One or more skill assessments are marked as pending re-validation. Schedule a competency review.",
      });
    }
    if (items.length === 0 && engineer.skills_score >= 80) {
      items.push({
        severity: "medium", icon: Brain,
        title: "Strong competency profile",
        text: "Performing above team average. Consider this engineer for mentoring or SME designation.",
      });
    }
    return items.slice(0, 4);
  }, [engineer, activeBookings]);

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-40 bg-black/60 backdrop-blur-[2px] transition-opacity duration-200 ${
          isOpen ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={onClose}
      />

      {/* Drawer panel */}
      <div
        className={`fixed inset-y-0 right-0 z-50 flex w-full max-w-lg flex-col border-l border-gray-800 bg-[#0d1117] shadow-2xl transition-transform duration-300 ease-in-out ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* ── Header ─────────────────────────────────────────────────────────── */}
        <div className="flex items-start gap-4 border-b border-gray-800 p-5">
          {engineer && (
            <div className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl text-xl font-bold ${getAvatarColor(engineer.full_name)}`}>
              {getInitials(engineer.full_name)}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base font-semibold text-slate-50">{engineer?.full_name ?? "—"}</h2>
              {engineer?.verified && <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" title="Verified" />}
              {engineer?.critical_knowledge_holder && <Shield className="h-4 w-4 text-blue-400 shrink-0" title="Critical knowledge holder" />}
            </div>
            <p className="mt-0.5 text-sm text-slate-400">{engineer?.discipline ?? "—"}</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {engineer && (
                <Badge className={`inline-flex h-auto rounded px-2 py-0.5 text-[10px] font-medium shadow-none ${availBadgeClass(engineer.availability_status)}`}>
                  {formatAvailStatus(engineer.availability_status)}
                </Badge>
              )}
              {engineer && (
                <Badge className={`inline-flex h-auto rounded px-2 py-0.5 text-[10px] font-medium shadow-none ${riskBadgeClass(engineer.risk_level)}`}>
                  {capitalize(engineer.risk_level)} Risk
                </Badge>
              )}
              {engineer?.employment_type && (
                <span className="text-[10px] font-medium text-slate-500">{capitalize(engineer.employment_type)}</span>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-[#ffffff10] hover:text-slate-200"
            aria-label="Close panel"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* ── Info row ──────────────────────────────────────────────────────── */}
        <div className="flex flex-wrap gap-x-4 gap-y-1.5 border-b border-gray-800 px-5 py-3">
          {engineer?.department_name && (
            <span className="flex items-center gap-1.5 text-xs text-slate-400">
              <Building2 className="h-3.5 w-3.5 text-slate-600" />{engineer.department_name}
            </span>
          )}
          {engineer?.site_name && (
            <span className="flex items-center gap-1.5 text-xs text-slate-400">
              <MapPin className="h-3.5 w-3.5 text-slate-600" />
              {engineer.site_name}{engineer.site_region ? ` · ${engineer.site_region}` : ""}
            </span>
          )}
          {engineer?.shift_pattern && (
            <span className="text-xs text-slate-400">
              Shift: <span className="text-slate-300">{engineer.shift_pattern}</span>
            </span>
          )}
          {engineer?.years_experience !== null && engineer?.years_experience !== undefined && (
            <span className="text-xs text-slate-400">
              Experience: <span className="text-slate-300">{engineer.years_experience.toFixed(1)} yrs</span>
            </span>
          )}
          {engineer?.last_assessment_date && (
            <span className="text-xs text-slate-400">
              Assessed: <span className="text-slate-300">{formatDate(engineer.last_assessment_date)}</span>
            </span>
          )}
        </div>

        {/* ── Stats row ─────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-4 divide-x divide-gray-800 border-b border-gray-800">
          {[
            {
              label: "Competency",
              value: engineer ? `${engineer.skills_score}%` : "—",
              cls: engineer
                ? engineer.skills_score >= 80 ? "text-emerald-400"
                : engineer.skills_score >= 68 ? "text-yellow-400" : "text-red-400"
                : "text-slate-50",
            },
            { label: "AI Score",  value: engineer ? `${engineer.ai_confidence}%` : "—", cls: "text-blue-400" },
            {
              label: "Training",
              value: engineer ? String(engineer.training_count) : "—",
              cls: engineer && engineer.training_count > 0 ? "text-orange-400" : "text-slate-50",
            },
            {
              label: "Critical",
              value: engineer ? `${engineer.critical_skills_met}/${engineer.critical_skills_count}` : "—",
              cls: engineer && engineer.critical_skills_met < engineer.critical_skills_count ? "text-yellow-400" : "text-emerald-400",
            },
          ].map(({ label, value, cls }) => (
            <div key={label} className="flex flex-col gap-0.5 px-3 py-3">
              <p className="text-[10px] font-medium text-slate-500">{label}</p>
              <p className={`text-base font-semibold tabular-nums ${cls}`}>{value}</p>
            </div>
          ))}
        </div>

        {/* ── Scrollable body ────────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto">

          {/* Skills Summary */}
          <div className="border-b border-gray-800 p-5">
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Skills Summary</p>

            <div className="mb-4">
              <div className="mb-1.5 flex items-center justify-between">
                <span className="text-xs text-slate-400">Overall Competency</span>
                <span className={`text-xs font-semibold tabular-nums ${
                  (engineer?.skills_score ?? 0) >= 80 ? "text-emerald-400" :
                  (engineer?.skills_score ?? 0) >= 68 ? "text-yellow-400" : "text-red-400"
                }`}>{engineer?.skills_score ?? 0}%</span>
              </div>
              <Progress
                value={engineer?.skills_score ?? 0}
                className={`h-2 rounded bg-gray-800 ${
                  (engineer?.skills_score ?? 0) >= 80 ? "[&>div]:bg-emerald-500" :
                  (engineer?.skills_score ?? 0) >= 68 ? "[&>div]:bg-yellow-400" : "[&>div]:bg-red-500"
                }`}
              />
            </div>

            {criticalAssignments.length > 0 && (
              <div className="mb-4">
                <p className="mb-2 text-[10px] font-medium text-slate-500">Critical Skills</p>
                <div className="flex flex-col gap-1.5">
                  {criticalAssignments.slice(0, 6).map((a) => {
                    const { bg, text } = ratingStyle(a.rating);
                    return (
                      <div key={a.skill_id} className="flex items-center gap-2">
                        <div className={`flex h-6 w-7 shrink-0 items-center justify-center rounded text-[11px] font-semibold tabular-nums ${bg} ${text}`}>
                          {a.rating ?? "—"}
                        </div>
                        <span className="min-w-0 flex-1 truncate text-xs text-slate-300">{a.skill_name}</span>
                        {a.training_required && (
                          <span className="shrink-0 rounded-full bg-orange-400/15 px-1.5 py-0.5 text-[9px] font-medium text-orange-400">Training</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {(engineer?.top_skills ?? []).filter((s) => !s.is_critical).length > 0 && (
              <div>
                <p className="mb-2 text-[10px] font-medium text-slate-500">Top Rated Skills</p>
                <div className="flex flex-col gap-1.5">
                  {(engineer?.top_skills ?? []).filter((s) => !s.is_critical).slice(0, 5).map((s, i) => {
                    const { bg, text } = ratingStyle(s.rating);
                    return (
                      <div key={i} className="flex items-center gap-2">
                        <div className={`flex h-6 w-7 shrink-0 items-center justify-center rounded text-[11px] font-semibold tabular-nums ${bg} ${text}`}>
                          {s.rating}
                        </div>
                        <span className="min-w-0 flex-1 truncate text-xs text-slate-300">{s.name}</span>
                        <span className="shrink-0 text-[10px] text-slate-600">{RATING_LABELS[s.rating] ?? ""}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Certifications */}
          <div className="border-b border-gray-800 p-5">
            <div className="mb-3 flex items-center gap-2">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Certifications</p>
              <span className="rounded-full bg-gray-800 px-1.5 py-0.5 text-[9px] font-medium text-slate-400">
                {(engineer?.certifications ?? []).length}
              </span>
            </div>
            {(engineer?.certifications ?? []).length === 0 ? (
              <p className="text-xs text-slate-600">No certifications on record.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {(engineer?.certifications ?? []).map((cert, i) => {
                  const { label, cls, dot } = certStatus(cert);
                  return (
                    <div key={i} className="flex items-center gap-3 rounded-lg border border-gray-800 bg-[#0b0e14] p-2.5">
                      <Award className="h-4 w-4 shrink-0 text-slate-500" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-medium text-slate-200">{cert.skill_name}</p>
                        <p className="mt-0.5 text-[10px] text-slate-500">{cert.category}</p>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-0.5">
                        <div className="flex items-center gap-1.5">
                          <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
                          <span className={`text-[10px] font-medium ${cls}`}>{label}</span>
                        </div>
                        {cert.expiry_date && (
                          <span className="text-[9px] text-slate-600">Expires {formatDate(cert.expiry_date)}</span>
                        )}
                        {!cert.expiry_date && (
                          <span className="text-[9px] text-slate-600">No expiry</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Training */}
          <div className="border-b border-gray-800 p-5">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Training</p>
              <div className="flex items-center gap-3 text-[10px] text-slate-500">
                <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />{completedBookings.length} completed</span>
                <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-blue-500" />{activeBookings.length} active</span>
              </div>
            </div>
            {engBookings.length === 0 ? (
              <p className="text-xs text-slate-600">No training records linked to this engineer.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {engBookings.slice(0, 6).map((b, i) => (
                  <div key={i} className="flex items-start gap-2.5 rounded-lg border border-gray-800 bg-[#0b0e14] p-2.5">
                    <GraduationCap className={`mt-0.5 h-4 w-4 shrink-0 ${b.status === "completed" ? "text-emerald-400" : "text-blue-400"}`} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-medium text-slate-200">{b.course_title}</p>
                      {b.booking_date && <p className="mt-0.5 text-[10px] text-slate-500">{formatDate(b.booking_date)}</p>}
                    </div>
                    <Badge className={`shrink-0 inline-flex h-auto rounded px-1.5 py-0.5 text-[9px] font-medium shadow-none ${
                      b.status === "completed"                              ? "bg-[#10b98120] text-emerald-400" :
                      b.status === "booked" || b.status === "approved"     ? "bg-[#3b82f620] text-blue-400" :
                                                                             "bg-gray-800 text-slate-400"
                    }`}>{capitalize(b.status)}</Badge>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* AI Insights */}
          <div className="border-b border-gray-800 p-5">
            <div className="mb-3 flex items-center gap-2">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">AI Insights</p>
              <Badge className="inline-flex h-auto items-center gap-1 rounded bg-[#3b82f620] px-1.5 py-0.5 text-[9px] font-medium text-blue-500 shadow-none hover:bg-[#3b82f620]">
                <span className="h-1 w-1 rounded-full bg-blue-500" />Live
              </Badge>
            </div>
            <div className="flex flex-col gap-2.5">
              {insights.map((ins, i) => {
                const conf =
                  ins.severity === "critical" ? { bg: "bg-[#ef444408]", border: "border-red-500/20",    icon: "text-red-500",    title: "text-red-400"    } :
                  ins.severity === "high"     ? { bg: "bg-[#f9731608]", border: "border-orange-400/20", icon: "text-orange-400", title: "text-orange-300" } :
                                               { bg: "bg-[#facc1508]", border: "border-yellow-400/20", icon: "text-yellow-400", title: "text-yellow-300" };
                const Icon = ins.icon;
                return (
                  <div key={i} className={`flex items-start gap-2.5 rounded-lg border ${conf.border} ${conf.bg} p-3`}>
                    <Icon className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${conf.icon}`} />
                    <div>
                      <p className={`text-xs font-semibold ${conf.title}`}>{ins.title}</p>
                      <p className="mt-0.5 text-[11px] leading-relaxed text-slate-400">{ins.text}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="p-5">
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Quick Actions</p>
            <div className="grid grid-cols-2 gap-2">
              {[
                { icon: UserCircle,    label: "View Full Profile"     },
                { icon: ExternalLink,  label: "Open Skills Matrix"    },
                { icon: FileText,      label: "Training History"      },
                { icon: Award,         label: "View Certifications"   },
                { icon: GraduationCap, label: "Assign Training"       },
                { icon: Sparkles,      label: "Generate AI Report"    },
                { icon: MessageSquare, label: "Message Engineer"      },
                { icon: BookOpen,      label: "Book Assessment"       },
              ].map(({ icon: Icon, label }) => (
                <button
                  key={label}
                  type="button"
                  className="flex items-center gap-2 rounded-lg border border-gray-800 bg-[#0b0e14] px-3 py-2 text-left text-xs font-medium text-slate-300 transition-colors hover:border-gray-700 hover:bg-[#141820] hover:text-slate-100"
                >
                  <Icon className="h-3.5 w-3.5 shrink-0 text-slate-500" />
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
