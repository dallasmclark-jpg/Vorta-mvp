import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  Award,
  CheckCircle2,
  ChevronRight,
  Clock3,
  GraduationCap,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Wrench,
} from "lucide-react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";

const PAGE = "mx-auto flex w-full max-w-[1600px] flex-col gap-5 px-4 pb-10 pt-5 sm:px-5 md:gap-6 md:px-6 md:pb-12 md:pt-6 xl:px-8";
const CARD = "rounded-2xl border border-slate-800/75 bg-[#030c1d] shadow-[0_14px_34px_rgba(0,0,0,0.22)]";
const RAISED = "rounded-xl border border-slate-800/70 bg-[#07172b]";
const ACTION = "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-700/80 bg-[#07172b] px-3 text-sm font-medium text-slate-200 transition-colors hover:border-blue-400/50 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400";

type ScoreStatus = "Foundation" | "Developing" | "Competent" | "Advanced" | "Expert";
type Confidence = "Low" | "Medium" | "High";

interface EquipmentItem {
  id: string;
  equipment_code: string;
  name: string;
  equipment_type: string | null;
  area: string | null;
  line: string | null;
  criticality: string | null;
  status: string | null;
}

interface PersonalSkill {
  skillId: string;
  name: string;
  category: string;
  requiredLevel: number;
  criticality: string | null;
  selfLevel: number | null;
  managerLevel: number | null;
  verifiedLevel: number | null;
  effectiveLevel: number | null;
  verificationStatus: string;
  trainingRequired: boolean;
}

interface EquipmentScore {
  equipment_id: string;
  score_version: string;
  vorta_score: number | string;
  score_status: ScoreStatus;
  evidence_confidence: Confidence;
  confidence_score: number | string;
  evidence_coverage_pct: number | string;
  skill_score: number | string | null;
  training_score: number | string | null;
  corrective_score: number | string | null;
  pm_score: number | string | null;
  calibration_score: number | string | null;
  required_skill_count: number;
  corrective_order_count: number;
  pm_order_count: number;
  calibration_order_count: number;
  latest_evidence_at: string | null;
  calculated_at: string;
}

interface EquipmentProfile {
  equipment: EquipmentItem;
  score: EquipmentScore | null;
  requiredSkills: PersonalSkill[];
}

interface EngineerSkillsPayload {
  engineer: { id: string; full_name: string; discipline: string | null };
  equipmentProfiles: EquipmentProfile[];
  scoreModel: {
    version: string;
    weights: { verifiedSkills: number; training: number; corrective: number; pm: number; calibration: number };
  };
}

interface TrainingItem {
  title: string;
  status: string;
  date: string | null;
  provider: string | null;
  deliveryType: string | null;
}

interface CertificateItem {
  name: string;
  category: string;
  expiryDate: string | null;
  status: string;
}

interface LoadedSkills {
  payload: EngineerSkillsPayload;
  training: TrainingItem[];
  certificates: CertificateItem[];
}

function numeric(value: unknown): number {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function statusTone(status: string): string {
  const value = status.toLowerCase();
  if (value.includes("expert") || value.includes("advanced") || value.includes("current") || value.includes("complete") || value.includes("valid")) return "text-emerald-400";
  if (value.includes("competent")) return "text-blue-400";
  if (value.includes("develop") || value.includes("pending") || value.includes("assign") || value.includes("medium")) return "text-amber-400";
  if (value.includes("foundation") || value.includes("expired") || value.includes("low")) return "text-red-400";
  return "text-slate-400";
}

function scoreTone(score: number): string {
  if (score >= 90) return "text-emerald-300";
  if (score >= 75) return "text-emerald-400";
  if (score >= 60) return "text-blue-400";
  if (score >= 40) return "text-amber-400";
  return "text-red-400";
}

function levelTone(level: number | null, required: number): string {
  if (level == null) return "border-slate-700 bg-slate-800/30 text-slate-500";
  if (level >= required) return "border-emerald-500/25 bg-emerald-500/10 text-emerald-300";
  if (level === required - 1) return "border-amber-500/25 bg-amber-500/10 text-amber-300";
  return "border-red-500/25 bg-red-500/10 text-red-300";
}

function dateLabel(value: string | null): string {
  if (!value) return "No evidence date";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function readiness(profile: EquipmentProfile): number {
  const skills = profile.requiredSkills;
  if (!skills.length) return 0;
  const met = skills.filter((skill) => (skill.verifiedLevel ?? skill.managerLevel ?? 0) >= skill.requiredLevel).length;
  return Math.round((met / skills.length) * 100);
}

function relevantProfiles(profiles: EquipmentProfile[]): EquipmentProfile[] {
  return profiles.filter((profile) => {
    if (!profile.requiredSkills.length) return false;
    const score = profile.score;
    return profile.requiredSkills.some((skill) => skill.selfLevel != null || skill.managerLevel != null || skill.verifiedLevel != null)
      || Boolean(score && (numeric(score.skill_score) > 0 || score.corrective_order_count > 0 || score.pm_order_count > 0 || score.calibration_order_count > 0));
  });
}

async function loadSkills(): Promise<LoadedSkills> {
  const [skillsResult, engineerResult] = await Promise.all([
    supabase.functions.invoke("engineer-skills-data"),
    supabase.functions.invoke("engineers-data"),
  ]);
  if (skillsResult.error || !skillsResult.data?.engineer) throw skillsResult.error ?? new Error("Engineer skills data unavailable");

  const bookings = (engineerResult.data?.trainingBookings ?? []) as Array<any>;
  const training: TrainingItem[] = bookings.slice(0, 24).map((booking) => ({
    title: booking.course_title ?? "Training",
    status: booking.status ?? "Assigned",
    date: booking.booking_date ?? null,
    provider: booking.partner_name ?? null,
    deliveryType: booking.delivery_type ?? null,
  }));

  const rawCertificates = (engineerResult.data?.engineers?.[0]?.certifications ?? []) as Array<any>;
  const certificates: CertificateItem[] = rawCertificates.map((certificate) => ({
    name: certificate.skill_name ?? "Certificate",
    category: certificate.category ?? "Certificate",
    expiryDate: certificate.expiry_date ?? null,
    status: certificate.verification_status === "expired" ? "Expired" : "Current",
  }));

  return { payload: skillsResult.data as EngineerSkillsPayload, training, certificates };
}

function ComponentMetric({ label, value, weight }: { label: string; value: number | string | null | undefined; weight: number }): JSX.Element {
  const score = value == null ? null : numeric(value);
  return (
    <div className="min-w-0">
      <div className="flex items-center justify-between gap-2 text-[10px] text-slate-500"><span className="truncate">{label}</span><span>{weight}%</span></div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-800/80">
        <div className="h-full rounded-full bg-blue-500" style={{ width: `${Math.max(0, Math.min(100, score ?? 0))}%` }} />
      </div>
      <p className="mt-1 text-[10px] font-medium tabular-nums text-slate-400">{score == null ? "No mapped evidence" : `${Math.round(score)}%`}</p>
    </div>
  );
}

function SkillsHeader(): JSX.Element {
  return (
    <header>
      <h1 className="text-2xl font-semibold tracking-[-0.025em] text-slate-50 md:text-3xl">My Skills</h1>
      <p className="mt-1 text-sm leading-6 text-slate-400">Verified competency, real maintenance evidence and readiness by equipment.</p>
    </header>
  );
}

export function EngineerSkillsScreenV2(): JSX.Element {
  const [data, setData] = useState<LoadedSkills | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<"equipment" | "skill" | "training" | "certificates">("equipment");
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    void loadSkills()
      .then((result) => { if (!cancelled) setData(result); })
      .catch((reason) => { if (!cancelled) setError(reason instanceof Error ? reason.message : "Skills data could not be loaded"); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [tick]);

  const profiles = useMemo(() => relevantProfiles(data?.payload.equipmentProfiles ?? []), [data]);
  const allSkills = useMemo(() => profiles.flatMap((profile) => profile.requiredSkills.map((skill) => ({ ...skill, equipment: profile.equipment, profile }))), [profiles]);
  const scoredProfiles = profiles.filter((profile) => profile.score && numeric(profile.score.evidence_coverage_pct) > 0);
  const portfolioScore = scoredProfiles.length ? Math.round(scoredProfiles.reduce((sum, profile) => sum + numeric(profile.score?.vorta_score), 0) / scoredProfiles.length) : 0;
  const avgReadiness = profiles.length ? Math.round(profiles.reduce((sum, profile) => sum + readiness(profile), 0) / profiles.length) : 0;
  const verified = allSkills.filter((skill) => skill.verificationStatus === "validated" && skill.verifiedLevel != null).length;
  const gaps = allSkills.filter((skill) => (skill.verifiedLevel ?? skill.managerLevel ?? 0) < skill.requiredLevel).length;
  const evidenceCount = scoredProfiles.reduce((sum, profile) => sum + (profile.score?.corrective_order_count ?? 0) + (profile.score?.pm_order_count ?? 0) + (profile.score?.calibration_order_count ?? 0), 0);

  if (loading) return <div data-vorta-page-content="true" className={PAGE}><SkillsHeader /><div className={`${CARD} h-40 animate-pulse`} /><div className="grid gap-3 md:grid-cols-2"><div className={`${CARD} h-52 animate-pulse`} /><div className={`${CARD} h-52 animate-pulse`} /></div></div>;

  if (error || !data) {
    return (
      <div data-vorta-page-content="true" className={PAGE}>
        <SkillsHeader />
        <section className={`${CARD} p-5`}><div className="flex items-start gap-3"><AlertTriangle className="mt-0.5 h-5 w-5 text-amber-400" /><div className="min-w-0 flex-1"><p className="text-sm font-semibold text-slate-100">Live skills evidence unavailable</p><p className="mt-1 text-sm text-slate-400">{error ?? "The engineer evidence service did not return a profile."}</p><button type="button" onClick={() => setTick((value) => value + 1)} className={`${ACTION} mt-4`}><RefreshCw className="h-4 w-4" />Retry</button></div></div></section>
      </div>
    );
  }

  const weights = data.payload.scoreModel.weights;

  return (
    <div data-vorta-page-content="true" data-vorta-engineer-skills-v2="true" className={PAGE}>
      <SkillsHeader />

      <section className={`${CARD} overflow-hidden border-blue-500/35 bg-blue-500/[0.08] p-4 sm:p-5`}>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <div className="flex items-center gap-4 sm:col-span-2 xl:col-span-1">
            <div className="relative flex h-20 w-20 shrink-0 items-center justify-center rounded-full border-[6px] border-blue-500/20">
              <div className="absolute inset-[-6px] rounded-full border-[6px] border-transparent border-t-blue-500" style={{ transform: `rotate(${Math.max(20, Math.round(portfolioScore * 2.6))}deg)` }} />
              <span className={`text-xl font-semibold tabular-nums ${scoreTone(portfolioScore)}`}>{portfolioScore}</span>
            </div>
            <div><p className="text-xs text-slate-500">Vorta score</p><p className="mt-1 text-sm font-semibold text-blue-300">Evidence weighted</p><p className="mt-1 text-[10px] text-slate-600">{data.payload.scoreModel.version}</p></div>
          </div>
          <div className="border-l border-slate-800/70 pl-4"><p className="text-2xl font-semibold tabular-nums text-slate-50">{avgReadiness}%</p><p className="mt-1 text-xs text-slate-500">Requirement readiness</p></div>
          <div className="border-l border-slate-800/70 pl-4"><p className="text-2xl font-semibold tabular-nums text-emerald-400">{verified}</p><p className="mt-1 text-xs text-slate-500">Verified competencies</p></div>
          <div className="border-l border-slate-800/70 pl-4"><p className="text-2xl font-semibold tabular-nums text-blue-300">{evidenceCount}</p><p className="mt-1 text-xs text-slate-500">SAP evidence events</p></div>
          <div className="border-l border-slate-800/70 pl-4"><p className="text-2xl font-semibold tabular-nums text-amber-400">{gaps}</p><p className="mt-1 text-xs text-slate-500">Requirements below target</p></div>
        </div>
      </section>

      <div className="grid grid-cols-2 gap-1 rounded-xl border border-slate-800/80 bg-[#07172b] p-1 sm:grid-cols-4" role="tablist" aria-label="Skills views">
        {([ ["equipment", "By Equipment"], ["skill", "By Skill"], ["training", "Training"], ["certificates", "Certificates"] ] as const).map(([key, label]) => (
          <button key={key} type="button" role="tab" aria-selected={view === key} onClick={() => setView(key)} className={`min-h-11 rounded-lg px-3 text-sm font-medium transition-colors ${view === key ? "bg-blue-500/15 text-blue-300" : "text-slate-500 hover:text-slate-200"}`}>{label}</button>
        ))}
      </div>

      {view === "equipment" ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {profiles.map((profile) => {
            const score = profile.score;
            const vortaScore = numeric(score?.vorta_score);
            const ready = readiness(profile);
            const competent = profile.requiredSkills.filter((skill) => (skill.verifiedLevel ?? skill.managerLevel ?? 0) >= skill.requiredLevel).length;
            const profileGaps = profile.requiredSkills.length - competent;
            return (
              <article key={profile.equipment.id} className={`${CARD} overflow-hidden`}>
                <Link to={`/engineer/equipment/${profile.equipment.id}`} className="flex items-center gap-3 border-b border-slate-800/60 p-4 sm:p-5">
                  <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-500/10 text-blue-400"><Wrench className="h-5 w-5" /></span>
                  <div className="min-w-0 flex-1"><h2 className="truncate text-base font-semibold text-slate-100">{profile.equipment.name}</h2><p className="truncate text-xs text-slate-500">{profile.equipment.equipment_code} · {profile.equipment.area ?? "Site"}</p></div>
                  <div className="text-right"><p className={`text-2xl font-semibold tabular-nums ${scoreTone(vortaScore)}`}>{score ? Math.round(vortaScore) : "—"}</p><p className="text-[10px] text-slate-600">Vorta score</p></div>
                </Link>

                <div className="space-y-4 p-4 sm:p-5">
                  <div className="flex items-center justify-between gap-3">
                    <div><p className={`text-xs font-semibold ${statusTone(score?.score_status ?? "")}`}>{score?.score_status ?? "Not scored"}</p><p className="mt-0.5 text-[10px] text-slate-600">Evidence confidence: <span className={statusTone(score?.evidence_confidence ?? "")}>{score?.evidence_confidence ?? "Low"}</span></p></div>
                    <div className="text-right"><p className="text-sm font-semibold tabular-nums text-slate-200">{ready}%</p><p className="text-[10px] text-slate-600">readiness</p></div>
                  </div>

                  <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                    <ComponentMetric label="Verified skills" value={score?.skill_score} weight={weights.verifiedSkills} />
                    <ComponentMetric label="Training" value={score?.training_score} weight={weights.training} />
                    <ComponentMetric label="Corrective" value={score?.corrective_score} weight={weights.corrective} />
                    <ComponentMetric label="PM" value={score?.pm_score} weight={weights.pm} />
                    <ComponentMetric label="Calibration" value={score?.calibration_score} weight={weights.calibration} />
                  </div>

                  <div className="space-y-2 border-t border-slate-800/60 pt-4">
                    {profile.requiredSkills.slice(0, 4).map((skill) => (
                      <Link key={skill.skillId} to={`/engineer/skills/${encodeURIComponent(skill.name)}?equipment=${profile.equipment.id}`} className={`${RAISED} flex min-h-14 items-center gap-3 p-3 hover:border-blue-400/40`}>
                        <div className="min-w-0 flex-1"><p className="truncate text-xs font-medium text-slate-200">{skill.name}</p><p className="mt-0.5 text-[10px] text-slate-500">Required L{skill.requiredLevel}{skill.trainingRequired ? " · Training required" : ""}</p></div>
                        <span className={`inline-flex min-w-10 items-center justify-center rounded-lg border px-2 py-1 text-xs font-semibold ${levelTone(skill.verifiedLevel ?? skill.managerLevel, skill.requiredLevel)}`}>L{skill.verifiedLevel ?? skill.managerLevel ?? "—"}</span>
                        <ChevronRight className="h-4 w-4 text-slate-600" />
                      </Link>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-4 border-t border-slate-800/60 px-4 py-3 text-center text-xs sm:px-5">
                  <div><p className="font-semibold tabular-nums text-emerald-400">{competent}</p><p className="text-[10px] text-slate-600">Competent</p></div>
                  <div className="border-l border-slate-800/60"><p className="font-semibold tabular-nums text-red-400">{profileGaps}</p><p className="text-[10px] text-slate-600">Gap</p></div>
                  <div className="border-l border-slate-800/60"><p className="font-semibold tabular-nums text-blue-300">{(score?.corrective_order_count ?? 0) + (score?.pm_order_count ?? 0)}</p><p className="text-[10px] text-slate-600">Jobs</p></div>
                  <div className="border-l border-slate-800/60"><p className="font-semibold tabular-nums text-violet-300">{score?.calibration_order_count ?? 0}</p><p className="text-[10px] text-slate-600">Calibrations</p></div>
                </div>
              </article>
            );
          })}
          {!profiles.length ? <section className={`${CARD} p-5 md:col-span-2 xl:col-span-3`}><p className="text-sm text-slate-400">No equipment-specific competency records are linked to this engineer yet.</p></section> : null}
        </div>
      ) : null}

      {view === "skill" ? (
        <section className={`${CARD} overflow-hidden`}>
          <div className="flex items-center justify-between border-b border-slate-800/60 px-4 py-4 sm:px-5"><div className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-blue-400" /><h2 className="text-sm font-semibold text-slate-100">Competency by skill</h2></div><span className="text-xs text-slate-500">Validated beats manager; manager beats self</span></div>
          <div className="divide-y divide-slate-800/55">
            {allSkills.map((skill) => (
              <Link key={`${skill.equipment.id}-${skill.skillId}`} to={`/engineer/skills/${encodeURIComponent(skill.name)}?equipment=${skill.equipment.id}`} className="grid min-h-16 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 hover:bg-blue-500/[0.04] sm:px-5 md:grid-cols-[minmax(0,1fr)_8rem_5rem_auto]">
                <div className="min-w-0"><p className="truncate text-sm font-medium text-slate-100">{skill.name}</p><p className="truncate text-xs text-slate-500">{skill.equipment.name}</p></div>
                <p className={`hidden text-xs font-semibold md:block ${statusTone(skill.verificationStatus)}`}>{skill.verificationStatus.replace(/_/g, " ")}</p>
                <span className={`inline-flex min-w-10 items-center justify-center rounded-lg border px-2 py-1 text-xs font-semibold ${levelTone(skill.verifiedLevel ?? skill.managerLevel, skill.requiredLevel)}`}>L{skill.verifiedLevel ?? skill.managerLevel ?? "—"}</span>
                <ChevronRight className="h-4 w-4 text-slate-600" />
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {view === "training" ? (
        <section className={`${CARD} overflow-hidden`}>
          <div className="flex items-center justify-between border-b border-slate-800/60 px-4 py-4 sm:px-5"><div className="flex items-center gap-2"><GraduationCap className="h-5 w-5 text-violet-400" /><h2 className="text-sm font-semibold text-slate-100">My Training</h2></div><span className="text-xs text-slate-500">Completed training feeds the Vorta score when mapped to an equipment requirement</span></div>
          <div className="divide-y divide-slate-800/55">
            {data.training.map((item) => <div key={`${item.title}-${item.date}`} className="grid min-h-16 gap-2 px-4 py-3 sm:px-5 md:grid-cols-[minmax(0,1fr)_8rem_8rem] md:items-center"><div className="min-w-0"><p className="text-sm font-medium text-slate-100">{item.title}</p><p className="mt-0.5 text-xs text-slate-500">{[item.provider, item.deliveryType].filter(Boolean).join(" · ") || "Training record"}</p></div><p className={`text-xs font-semibold ${statusTone(item.status)}`}>{item.status}</p><p className="text-xs text-slate-500">{dateLabel(item.date)}</p></div>)}
            {!data.training.length ? <p className="px-5 py-8 text-center text-sm text-slate-500">No training records are linked yet.</p> : null}
          </div>
        </section>
      ) : null}

      {view === "certificates" ? (
        <section className={`${CARD} overflow-hidden`}>
          <div className="flex items-center justify-between border-b border-slate-800/60 px-4 py-4 sm:px-5"><div className="flex items-center gap-2"><Award className="h-5 w-5 text-blue-400" /><h2 className="text-sm font-semibold text-slate-100">Certificates</h2></div><span className="text-xs text-slate-500">Expiry and validation status</span></div>
          <div className="divide-y divide-slate-800/55">
            {data.certificates.map((item) => <div key={item.name} className="grid min-h-16 gap-2 px-4 py-3 sm:px-5 md:grid-cols-[minmax(0,1fr)_10rem_8rem] md:items-center"><div><p className="text-sm font-medium text-slate-100">{item.name}</p><p className="text-xs text-slate-500">{item.category}</p></div><p className="text-xs text-slate-500">Expires {dateLabel(item.expiryDate)}</p><p className={`text-xs font-semibold ${statusTone(item.status)}`}>{item.status}</p></div>)}
            {!data.certificates.length ? <p className="px-5 py-8 text-center text-sm text-slate-500">No certificate records are linked yet.</p> : null}
          </div>
        </section>
      ) : null}
    </div>
  );
}

const LEVELS = [
  { level: 1, label: "Awareness" },
  { level: 2, label: "Assisted" },
  { level: 3, label: "Competent" },
  { level: 4, label: "Proficient" },
  { level: 5, label: "Expert" },
] as const;

export function EngineerSkillDetailScreenV2(): JSX.Element {
  const { skillName } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const decodedName = decodeURIComponent(skillName ?? "");
  const equipmentId = searchParams.get("equipment") ?? "";
  const [data, setData] = useState<LoadedSkills | null>(null);
  const [loading, setLoading] = useState(true);
  const [nextSelfLevel, setNextSelfLevel] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void loadSkills().then((result) => {
      if (cancelled) return;
      setData(result);
      const profile = result.payload.equipmentProfiles.find((item) => item.equipment.id === equipmentId);
      const skill = profile?.requiredSkills.find((item) => item.name === decodedName);
      setNextSelfLevel(skill?.selfLevel ?? null);
      setLoading(false);
    }).catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [decodedName, equipmentId]);

  const profile = data?.payload.equipmentProfiles.find((item) => item.equipment.id === equipmentId) ?? null;
  const skill = profile?.requiredSkills.find((item) => item.name === decodedName) ?? null;

  const saveSelfAssessment = async (): Promise<void> => {
    if (!data || !skill || !nextSelfLevel) return;
    setSaving(true);
    setMessage(null);
    const { error } = await supabase.from("engineer_skills").update({ self_rating: nextSelfLevel }).eq("engineer_id", data.payload.engineer.id).eq("skill_id", skill.skillId);
    setSaving(false);
    if (error) {
      setMessage("Vorta could not save the self-assessment. Verified competency was not changed.");
      return;
    }
    setMessage(`Self-assessment updated to Level ${nextSelfLevel}. Verified competency remains controlled by authorised assessment.`);
  };

  if (loading) return <div data-vorta-page-content="true" className={PAGE}><div className={`${CARD} h-56 animate-pulse`} /></div>;
  if (!data || !profile || !skill) return <div data-vorta-page-content="true" className={PAGE}><button type="button" onClick={() => navigate(-1)} className={ACTION}><ArrowLeft className="h-4 w-4" />Back</button><section className={`${CARD} p-5`}><p className="text-sm text-slate-400">This skill is not linked to the selected equipment for your profile.</p></section></div>;

  const score = profile.score;
  const verified = skill.verifiedLevel ?? skill.managerLevel;

  return (
    <div data-vorta-page-content="true" className={PAGE}>
      <div className="flex items-start gap-3"><button type="button" onClick={() => navigate(-1)} className={`${ACTION} min-h-10 px-2.5`} aria-label="Back"><ArrowLeft className="h-4 w-4" /></button><div className="min-w-0"><p className="text-xs text-blue-400">{profile.equipment.name}</p><h1 className="mt-1 text-2xl font-semibold tracking-[-0.025em] text-slate-50">{skill.name}</h1><p className="mt-1 text-sm text-slate-500">Required Level {skill.requiredLevel} · {skill.category}</p></div></div>

      <section className={`${CARD} p-5`}>
        <div className="grid gap-4 md:grid-cols-3">
          <div className={`${RAISED} p-4`}><p className="text-xs text-slate-500">Verified competency</p><p className="mt-2 text-2xl font-semibold text-blue-300">Level {verified ?? "—"}</p><p className={`mt-2 text-xs font-semibold ${statusTone(skill.verificationStatus)}`}>{skill.verificationStatus.replace(/_/g, " ")}</p></div>
          <div className={`${RAISED} p-4`}><p className="text-xs text-slate-500">Self-assessment</p><p className="mt-2 text-2xl font-semibold text-emerald-400">Level {skill.selfLevel ?? "—"}</p><p className="mt-2 text-xs text-slate-500">Editable by you; never overwrites verified level</p></div>
          <div className={`${RAISED} p-4`}><p className="text-xs text-slate-500">Equipment Vorta score</p><p className={`mt-2 text-2xl font-semibold ${scoreTone(numeric(score?.vorta_score))}`}>{score ? Math.round(numeric(score.vorta_score)) : "—"}</p><p className={`mt-2 text-xs font-semibold ${statusTone(score?.evidence_confidence ?? "")}`}>{score?.evidence_confidence ?? "Low"} evidence confidence</p></div>
        </div>
      </section>

      <section className={`${CARD} p-5`}>
        <div className="flex items-center justify-between gap-3"><div><h2 className="text-sm font-semibold text-slate-100">Update self-assessment</h2><p className="mt-1 text-xs text-slate-500">Self-rating is supporting evidence only. Validated and manager ratings take priority in scoring.</p></div><TrendingUp className="h-5 w-5 text-emerald-400" /></div>
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-5">
          {LEVELS.map(({ level, label }) => <button key={level} type="button" onClick={() => setNextSelfLevel(level)} className={`min-h-16 rounded-xl border px-3 py-2 text-center transition-colors ${nextSelfLevel === level ? "border-emerald-400/50 bg-emerald-500/10 text-emerald-300" : "border-slate-800 bg-[#07172b] text-slate-400 hover:border-blue-400/40"}`}><span className="block text-lg font-semibold">{level}</span><span className="mt-1 block text-[10px]">{label}</span></button>)}
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3"><button type="button" disabled={saving || !nextSelfLevel} onClick={() => void saveSelfAssessment()} className={`${ACTION} border-blue-500/40 bg-blue-500/10 text-blue-200 disabled:opacity-50`}>{saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}Save self-assessment</button>{message ? <p className="text-xs text-slate-400">{message}</p> : null}</div>
      </section>

      <section className={`${CARD} p-5`}>
        <div className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-blue-400" /><h2 className="text-sm font-semibold text-slate-100">Equipment evidence</h2></div>
        <div className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-5">
          <ComponentMetric label="Verified skills" value={score?.skill_score} weight={data.payload.scoreModel.weights.verifiedSkills} />
          <ComponentMetric label="Training" value={score?.training_score} weight={data.payload.scoreModel.weights.training} />
          <ComponentMetric label="Corrective" value={score?.corrective_score} weight={data.payload.scoreModel.weights.corrective} />
          <ComponentMetric label="PM" value={score?.pm_score} weight={data.payload.scoreModel.weights.pm} />
          <ComponentMetric label="Calibration" value={score?.calibration_score} weight={data.payload.scoreModel.weights.calibration} />
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <div className={`${RAISED} p-3`}><p className="text-[10px] text-slate-500">Corrective confirmations</p><p className="mt-1 text-lg font-semibold text-slate-100">{score?.corrective_order_count ?? 0}</p></div>
          <div className={`${RAISED} p-3`}><p className="text-[10px] text-slate-500">PM confirmations</p><p className="mt-1 text-lg font-semibold text-slate-100">{score?.pm_order_count ?? 0}</p></div>
          <div className={`${RAISED} p-3`}><p className="text-[10px] text-slate-500">Calibration confirmations</p><p className="mt-1 text-lg font-semibold text-slate-100">{score?.calibration_order_count ?? 0}</p></div>
        </div>
        <div className="mt-4 flex items-center gap-2 text-xs text-slate-500"><Clock3 className="h-4 w-4" />Latest mapped equipment evidence: {dateLabel(score?.latest_evidence_at ?? null)}</div>
      </section>
    </div>
  );
}
