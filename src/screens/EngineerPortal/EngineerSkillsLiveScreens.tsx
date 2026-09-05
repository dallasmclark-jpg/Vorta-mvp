import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Wrench,
} from "lucide-react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";

const PAGE =
  "mx-auto flex w-full max-w-[1600px] flex-col gap-5 px-4 pb-10 pt-5 sm:px-5 md:gap-6 md:px-6 md:pb-12 md:pt-6 xl:px-8";
const CARD =
  "rounded-2xl border border-slate-800/75 bg-[#030c1d] shadow-[0_14px_34px_rgba(0,0,0,0.22)]";
const RAISED = "rounded-xl border border-slate-800/70 bg-[#07172b]";
const BUTTON =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-700/80 bg-[#07172b] px-3 text-sm font-medium text-slate-200 transition-colors hover:border-blue-400/50 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400";

interface LiveEngineer {
  id: string;
  full_name: string;
  discipline: string | null;
  site_id: string;
  organisation_id: string;
}

interface LiveEquipment {
  id: string;
  equipment_code: string | null;
  name: string;
  equipment_type: string | null;
  area: string | null;
  line: string | null;
  criticality: string | null;
  status: string | null;
}

interface LiveScore {
  vorta_score: number | null;
  score_status: string | null;
  evidence_confidence: string | null;
  confidence_score: number | null;
  evidence_coverage_pct: number | null;
  skill_score: number | null;
  training_score: number | null;
  corrective_score: number | null;
  pm_score: number | null;
  calibration_score: number | null;
  corrective_order_count: number | null;
  pm_order_count: number | null;
  calibration_order_count: number | null;
  latest_evidence_at: string | null;
}

interface LiveSkill {
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

interface LiveEquipmentProfile {
  equipment: LiveEquipment;
  score: LiveScore | null;
  requiredSkills: LiveSkill[];
}

interface EngineerSkillsPayload {
  siteId: string;
  organisationId: string;
  engineer: LiveEngineer;
  equipmentProfiles: LiveEquipmentProfile[];
  generatedAt: string;
  scoreModel?: {
    version?: string;
    authorityOrder?: string[];
  };
}

function asFiniteNumber(value: unknown): number | null {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function normaliseSkill(raw: unknown): LiveSkill | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const value = raw as Record<string, unknown>;
  const skillId = typeof value.skillId === "string" ? value.skillId : "";
  const name = typeof value.name === "string" ? value.name.trim() : "";
  if (!skillId || !name) return null;
  return {
    skillId,
    name,
    category: typeof value.category === "string" && value.category.trim()
      ? value.category.trim()
      : "General",
    requiredLevel: Math.max(1, Math.min(5, Math.round(asFiniteNumber(value.requiredLevel) ?? 1))),
    criticality: typeof value.criticality === "string" ? value.criticality : null,
    selfLevel: asFiniteNumber(value.selfLevel),
    managerLevel: asFiniteNumber(value.managerLevel),
    verifiedLevel: asFiniteNumber(value.verifiedLevel),
    effectiveLevel: asFiniteNumber(value.effectiveLevel),
    verificationStatus:
      typeof value.verificationStatus === "string" ? value.verificationStatus : "not_uploaded",
    trainingRequired: value.trainingRequired === true,
  };
}

function normaliseScore(raw: unknown): LiveScore | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const value = raw as Record<string, unknown>;
  return {
    vorta_score: asFiniteNumber(value.vorta_score),
    score_status: typeof value.score_status === "string" ? value.score_status : null,
    evidence_confidence:
      typeof value.evidence_confidence === "string" ? value.evidence_confidence : null,
    confidence_score: asFiniteNumber(value.confidence_score),
    evidence_coverage_pct: asFiniteNumber(value.evidence_coverage_pct),
    skill_score: asFiniteNumber(value.skill_score),
    training_score: asFiniteNumber(value.training_score),
    corrective_score: asFiniteNumber(value.corrective_score),
    pm_score: asFiniteNumber(value.pm_score),
    calibration_score: asFiniteNumber(value.calibration_score),
    corrective_order_count: asFiniteNumber(value.corrective_order_count),
    pm_order_count: asFiniteNumber(value.pm_order_count),
    calibration_order_count: asFiniteNumber(value.calibration_order_count),
    latest_evidence_at:
      typeof value.latest_evidence_at === "string" ? value.latest_evidence_at : null,
  };
}

function normalisePayload(raw: unknown): EngineerSkillsPayload {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("Engineer skills evidence returned an invalid payload.");
  }
  const value = raw as Record<string, unknown>;
  if (typeof value.error === "string" && value.error) {
    throw new Error(value.error);
  }
  const engineerValue = value.engineer;
  if (!engineerValue || typeof engineerValue !== "object" || Array.isArray(engineerValue)) {
    throw new Error("The signed-in engineer could not be resolved from verified identity data.");
  }
  const engineer = engineerValue as Record<string, unknown>;
  const engineerId = typeof engineer.id === "string" ? engineer.id : "";
  const engineerName = typeof engineer.full_name === "string" ? engineer.full_name : "";
  const siteId = typeof value.siteId === "string" ? value.siteId : "";
  const organisationId = typeof value.organisationId === "string" ? value.organisationId : "";
  if (!engineerId || !engineerName || !siteId || !organisationId) {
    throw new Error("Engineer skills identity evidence is incomplete.");
  }

  const profiles = Array.isArray(value.equipmentProfiles)
    ? value.equipmentProfiles.flatMap((rawProfile): LiveEquipmentProfile[] => {
        if (!rawProfile || typeof rawProfile !== "object" || Array.isArray(rawProfile)) return [];
        const profile = rawProfile as Record<string, unknown>;
        const rawEquipment = profile.equipment;
        if (!rawEquipment || typeof rawEquipment !== "object" || Array.isArray(rawEquipment)) return [];
        const equipment = rawEquipment as Record<string, unknown>;
        const id = typeof equipment.id === "string" ? equipment.id : "";
        const name = typeof equipment.name === "string" ? equipment.name.trim() : "";
        if (!id || !name) return [];
        const requiredSkills = Array.isArray(profile.requiredSkills)
          ? profile.requiredSkills.flatMap((item) => {
              const skill = normaliseSkill(item);
              return skill ? [skill] : [];
            })
          : [];
        return [{
          equipment: {
            id,
            equipment_code:
              typeof equipment.equipment_code === "string" ? equipment.equipment_code : null,
            name,
            equipment_type:
              typeof equipment.equipment_type === "string" ? equipment.equipment_type : null,
            area: typeof equipment.area === "string" ? equipment.area : null,
            line: typeof equipment.line === "string" ? equipment.line : null,
            criticality:
              typeof equipment.criticality === "string" ? equipment.criticality : null,
            status: typeof equipment.status === "string" ? equipment.status : null,
          },
          score: normaliseScore(profile.score),
          requiredSkills,
        }];
      })
    : [];

  return {
    siteId,
    organisationId,
    engineer: {
      id: engineerId,
      full_name: engineerName,
      discipline: typeof engineer.discipline === "string" ? engineer.discipline : null,
      site_id: siteId,
      organisation_id: organisationId,
    },
    equipmentProfiles: profiles,
    generatedAt: typeof value.generatedAt === "string" ? value.generatedAt : new Date().toISOString(),
    scoreModel:
      value.scoreModel && typeof value.scoreModel === "object" && !Array.isArray(value.scoreModel)
        ? (value.scoreModel as EngineerSkillsPayload["scoreModel"])
        : undefined,
  };
}

async function loadEngineerSkills(): Promise<EngineerSkillsPayload> {
  const { data, error } = await supabase.functions.invoke("engineer-skills-data");
  if (error) {
    throw new Error(`Engineer skills evidence could not be loaded: ${error.message}`);
  }
  return normalisePayload(data);
}

function effectiveLevel(skill: LiveSkill): number | null {
  return skill.verifiedLevel ?? skill.managerLevel ?? skill.selfLevel ?? skill.effectiveLevel ?? null;
}

function levelStatus(skill: LiveSkill): "ready" | "gap" | "unrated" {
  const level = effectiveLevel(skill);
  if (level === null) return "unrated";
  return level >= skill.requiredLevel ? "ready" : "gap";
}

function levelTone(skill: LiveSkill): string {
  const status = levelStatus(skill);
  if (status === "ready") return "border-emerald-500/25 bg-emerald-500/10 text-emerald-300";
  if (status === "gap") return "border-amber-500/25 bg-amber-500/10 text-amber-300";
  return "border-slate-700 bg-slate-800/30 text-slate-500";
}

function scoreTone(score: number | null): string {
  if (score === null) return "text-slate-400";
  if (score >= 85) return "text-emerald-400";
  if (score >= 70) return "text-blue-400";
  if (score >= 55) return "text-amber-400";
  return "text-red-400";
}

function verificationLabel(skill: LiveSkill): string {
  if (skill.verifiedLevel !== null && skill.verificationStatus.toLowerCase() === "validated") {
    return "Verified";
  }
  if (skill.managerLevel !== null) return "Manager rated";
  if (skill.selfLevel !== null) return "Self assessed";
  return "Not assessed";
}

function formatTimestamp(value: string | null | undefined): string {
  if (!value) return "No evidence date";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "No evidence date";
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

function LoadingState(): JSX.Element {
  return (
    <div className={PAGE} aria-live="polite">
      <div className="h-8 w-40 animate-pulse rounded bg-slate-800" />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className={`${CARD} h-28 animate-pulse`} />
        ))}
      </div>
      <div className={`${CARD} h-80 animate-pulse`} />
    </div>
  );
}

function EvidenceError({ message, onRetry }: { message: string; onRetry: () => void }): JSX.Element {
  return (
    <div className={PAGE}>
      <header>
        <h1 className="text-2xl font-semibold tracking-[-0.025em] text-slate-50 md:text-3xl">My Skills</h1>
        <p className="mt-1 text-sm leading-6 text-slate-400">Verified equipment capability and your own self-assessment.</p>
      </header>
      <section className={`${CARD} p-5 sm:p-6`} data-vorta-engineer-skills-state="unavailable">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" />
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-slate-100">Live skills evidence unavailable</h2>
            <p className="mt-1 text-sm leading-6 text-slate-400">{message}</p>
            <p className="mt-2 text-xs leading-5 text-slate-500">
              Vorta will not substitute demo skills or another engineer&apos;s profile when live identity or competency evidence cannot be verified.
            </p>
            <button type="button" onClick={onRetry} className={`${BUTTON} mt-4`}>
              <RefreshCw className="h-4 w-4" />
              Retry live evidence
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

function KpiCard({ label, value, detail, tone = "text-slate-100" }: {
  label: string;
  value: string;
  detail: string;
  tone?: string;
}): JSX.Element {
  return (
    <div className={`${CARD} p-4 sm:p-5`}>
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">{label}</p>
      <p className={`mt-2 text-2xl font-semibold tabular-nums ${tone}`}>{value}</p>
      <p className="mt-1 text-xs leading-5 text-slate-500">{detail}</p>
    </div>
  );
}

export function EngineerSkillsScreen(): JSX.Element {
  const [payload, setPayload] = useState<EngineerSkillsPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    void loadEngineerSkills()
      .then((result) => {
        if (!cancelled) setPayload(result);
      })
      .catch((loadError) => {
        if (!cancelled) {
          setPayload(null);
          setError(loadError instanceof Error ? loadError.message : "Engineer skills evidence could not be loaded.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [reloadToken]);

  const profiles = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("en-GB");
    const source = payload?.equipmentProfiles ?? [];
    if (!needle) return source;
    return source.filter((profile) => {
      const equipmentText = [
        profile.equipment.name,
        profile.equipment.equipment_code,
        profile.equipment.area,
        profile.equipment.line,
      ]
        .filter(Boolean)
        .join(" ")
        .toLocaleLowerCase("en-GB");
      return equipmentText.includes(needle) || profile.requiredSkills.some((skill) =>
        `${skill.name} ${skill.category}`.toLocaleLowerCase("en-GB").includes(needle),
      );
    });
  }, [payload, query]);

  if (loading) return <LoadingState />;
  if (error || !payload) {
    return <EvidenceError message={error ?? "Engineer skills evidence could not be verified."} onRetry={() => setReloadToken((value) => value + 1)} />;
  }

  const allSkills = payload.equipmentProfiles.flatMap((profile) => profile.requiredSkills);
  const assessed = allSkills.filter((skill) => effectiveLevel(skill) !== null).length;
  const gaps = allSkills.filter((skill) => levelStatus(skill) === "gap").length;
  const verified = allSkills.filter(
    (skill) => skill.verifiedLevel !== null && skill.verificationStatus.toLowerCase() === "validated",
  ).length;
  const trainingNeeded = allSkills.filter((skill) => skill.trainingRequired).length;
  const scoreRows = payload.equipmentProfiles
    .map((profile) => profile.score?.vorta_score ?? null)
    .filter((score): score is number => score !== null);
  const averageScore = scoreRows.length
    ? Math.round(scoreRows.reduce((sum, score) => sum + score, 0) / scoreRows.length)
    : null;

  return (
    <main className={PAGE} data-vorta-engineer-skills-state="live">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-blue-400">Engineer capability</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-[-0.025em] text-slate-50 md:text-3xl">My Skills</h1>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-400">
            {payload.engineer.full_name} · equipment competency from verified skills, training and maintenance evidence.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <ShieldCheck className="h-4 w-4 text-emerald-400" />
          Live identity matched
        </div>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Vorta equipment score"
          value={averageScore === null ? "—" : String(averageScore)}
          detail={scoreRows.length ? `${scoreRows.length} equipment scores with live evidence` : "No scored equipment yet"}
          tone={scoreTone(averageScore)}
        />
        <KpiCard label="Verified skills" value={String(verified)} detail={`${assessed} assessed requirement records`} tone="text-emerald-400" />
        <KpiCard label="Capability gaps" value={String(gaps)} detail="Below the equipment-required level" tone={gaps > 0 ? "text-amber-400" : "text-emerald-400"} />
        <KpiCard label="Training required" value={String(trainingNeeded)} detail="Current requirement records flagged for training" tone={trainingNeeded > 0 ? "text-blue-400" : "text-emerald-400"} />
      </section>

      <section className={`${CARD} p-4 sm:p-5`}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-sm font-semibold text-slate-100">Equipment capability</h2>
            <p className="mt-1 text-xs leading-5 text-slate-500">
              Self-assessment can inform development, but verified and manager evidence retains higher authority.
            </p>
          </div>
          <label className="relative block w-full sm:max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-600" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search equipment or skill"
              className="h-11 w-full rounded-xl border border-slate-800 bg-slate-950/50 pl-9 pr-3 text-sm text-slate-100 placeholder:text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
            />
          </label>
        </div>

        {profiles.length > 0 ? (
          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            {profiles.map((profile) => {
              const skillCount = profile.requiredSkills.length;
              const readyCount = profile.requiredSkills.filter((skill) => levelStatus(skill) === "ready").length;
              const readiness = skillCount ? Math.round((readyCount / skillCount) * 100) : 0;
              return (
                <article key={profile.equipment.id} className={`${RAISED} p-4`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                        {profile.equipment.area ?? "Maintenance"}
                      </p>
                      <h3 className="mt-1 truncate text-sm font-semibold text-slate-100">{profile.equipment.name}</h3>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {profile.equipment.equipment_code ?? "No asset code"} · {profile.equipment.criticality ?? "Unrated criticality"}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className={`text-xl font-semibold ${scoreTone(profile.score?.vorta_score ?? null)}`}>
                        {profile.score?.vorta_score ?? readiness}
                      </p>
                      <p className="text-[9px] uppercase tracking-[0.1em] text-slate-600">
                        {profile.score?.vorta_score !== null && profile.score?.vorta_score !== undefined ? "Vorta score" : "skill fit"}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 space-y-2">
                    {profile.requiredSkills.length > 0 ? profile.requiredSkills.slice(0, 6).map((skill) => (
                      <Link
                        key={skill.skillId}
                        to={`/engineer/skills/${encodeURIComponent(skill.name)}?equipment=${encodeURIComponent(profile.equipment.id)}`}
                        className="flex min-h-12 items-center justify-between gap-3 rounded-xl border border-slate-800/70 bg-slate-950/25 px-3 py-2.5 transition-colors hover:border-blue-400/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-xs font-semibold text-slate-200">{skill.name}</p>
                          <p className="mt-0.5 text-[10px] text-slate-500">
                            Required L{skill.requiredLevel} · {verificationLabel(skill)}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`rounded-lg border px-2 py-1 text-[10px] font-semibold ${levelTone(skill)}`}>
                            L{effectiveLevel(skill) ?? "—"}
                          </span>
                          <ChevronRight className="h-4 w-4 text-slate-600" />
                        </div>
                      </Link>
                    )) : (
                      <p className="text-xs leading-5 text-slate-500">No required skills are mapped to this equipment yet.</p>
                    )}
                  </div>

                  <div className="mt-4 grid grid-cols-3 gap-2 border-t border-slate-800/70 pt-4 text-center">
                    <div>
                      <p className="text-sm font-semibold text-slate-200">{readyCount}/{skillCount}</p>
                      <p className="text-[9px] uppercase tracking-[0.08em] text-slate-600">At level</p>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-200">{profile.score?.evidence_coverage_pct ?? "—"}%</p>
                      <p className="text-[9px] uppercase tracking-[0.08em] text-slate-600">Evidence</p>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-200">{profile.score?.evidence_confidence ?? "—"}</p>
                      <p className="text-[9px] uppercase tracking-[0.08em] text-slate-600">Confidence</p>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="mt-4 rounded-xl border border-slate-800/70 bg-slate-950/25 p-5 text-center">
            <Wrench className="mx-auto h-5 w-5 text-slate-600" />
            <p className="mt-2 text-sm font-semibold text-slate-200">
              {query ? "No matching live capability records" : "No equipment capability records yet"}
            </p>
            <p className="mt-1 text-xs leading-5 text-slate-500">
              {query
                ? "Change the search terms to view other verified equipment records."
                : "Vorta has no mapped equipment-skill requirements for this engineer yet. No demo data has been substituted."}
            </p>
          </div>
        )}
      </section>

      <section className={`${CARD} p-4 sm:p-5`}>
        <div className="flex items-start gap-3">
          <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-blue-400" />
          <div>
            <h2 className="text-sm font-semibold text-slate-100">How your Vorta score works</h2>
            <p className="mt-1 text-xs leading-5 text-slate-500">
              Verified skills, mapped training and maintenance history contribute to the equipment score. Self-assessment is visible for development but never overwrites manager or verified evidence.
            </p>
            <p className="mt-2 text-[10px] uppercase tracking-[0.1em] text-slate-600">
              Model {payload.scoreModel?.version ?? "vorta-equipment-v1"} · refreshed {formatTimestamp(payload.generatedAt)}
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}

export function EngineerSkillDetailScreen(): JSX.Element {
  const { skillName } = useParams();
  const [searchParams] = useSearchParams();
  const equipmentId = searchParams.get("equipment") ?? "";
  const decodedName = decodeURIComponent(skillName ?? "");
  const [payload, setPayload] = useState<EngineerSkillsPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [nextSelfLevel, setNextSelfLevel] = useState<number | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    void loadEngineerSkills()
      .then((result) => {
        if (cancelled) return;
        setPayload(result);
      })
      .catch((loadError) => {
        if (!cancelled) {
          setPayload(null);
          setError(loadError instanceof Error ? loadError.message : "Skill evidence could not be loaded.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [reloadToken]);

  const match = useMemo(() => {
    if (!payload) return null;
    const candidates = payload.equipmentProfiles.flatMap((profile) =>
      profile.requiredSkills.map((skill) => ({ skill, profile })),
    );
    return candidates.find(({ skill, profile }) =>
      skill.name === decodedName && (!equipmentId || profile.equipment.id === equipmentId),
    ) ?? candidates.find(({ skill }) => skill.name === decodedName) ?? null;
  }, [decodedName, equipmentId, payload]);

  useEffect(() => {
    setNextSelfLevel(match?.skill.selfLevel ?? null);
  }, [match?.skill.skillId, match?.skill.selfLevel]);

  if (loading) return <LoadingState />;
  if (error || !payload) {
    return <EvidenceError message={error ?? "Skill evidence could not be verified."} onRetry={() => setReloadToken((value) => value + 1)} />;
  }
  if (!match) {
    return (
      <main className={PAGE}>
        <Link to="/engineer/skills" className={BUTTON}><ArrowLeft className="h-4 w-4" />My Skills</Link>
        <section className={`${CARD} p-5`}>
          <AlertTriangle className="h-5 w-5 text-amber-400" />
          <h1 className="mt-3 text-lg font-semibold text-slate-100">Skill evidence not found</h1>
          <p className="mt-1 text-sm leading-6 text-slate-500">This skill is not present in your current live equipment capability evidence.</p>
        </section>
      </main>
    );
  }

  const { skill, profile } = match;
  const currentEffective = effectiveLevel(skill);

  const saveSelfAssessment = async (): Promise<void> => {
    if (nextSelfLevel === null || nextSelfLevel < 1 || nextSelfLevel > 5) {
      setSaveMessage("Choose a self-assessment level from 1 to 5.");
      return;
    }
    setSaving(true);
    setSaveMessage(null);
    try {
      const { data, error: updateError } = await supabase
        .from("engineer_skills")
        .update({ self_rating: nextSelfLevel })
        .eq("engineer_id", payload.engineer.id)
        .eq("skill_id", skill.skillId)
        .select("engineer_id,skill_id,self_rating")
        .maybeSingle();
      if (updateError) throw updateError;
      if (!data) throw new Error("No authorised self-assessment row was updated.");
      setSaveMessage(`Self-assessment saved at Level ${nextSelfLevel}. Verified competency remains unchanged.`);
      setReloadToken((value) => value + 1);
    } catch (saveError) {
      setSaveMessage(
        saveError instanceof Error
          ? `Self-assessment was not saved: ${saveError.message}`
          : "Self-assessment was not saved.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className={PAGE} data-vorta-engineer-skill-detail="live">
      <div>
        <Link to="/engineer/skills" className={BUTTON}>
          <ArrowLeft className="h-4 w-4" />
          My Skills
        </Link>
      </div>

      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-blue-400">
            {profile.equipment.name}
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-[-0.025em] text-slate-50 md:text-3xl">{skill.name}</h1>
          <p className="mt-1 text-sm text-slate-400">{skill.category} · Required Level {skill.requiredLevel}</p>
        </div>
        <span className={`self-start rounded-xl border px-3 py-2 text-sm font-semibold ${levelTone(skill)}`}>
          Effective Level {currentEffective ?? "—"}
        </span>
      </header>

      <section className="grid gap-3 md:grid-cols-3">
        <div className={`${CARD} p-5`}>
          <div className="flex items-center gap-2 text-emerald-400"><ShieldCheck className="h-4 w-4" /><span className="text-xs font-semibold">Verified</span></div>
          <p className="mt-3 text-2xl font-semibold text-slate-100">{skill.verifiedLevel ?? "—"}</p>
          <p className="mt-1 text-xs text-slate-500">Authorised competency evidence</p>
        </div>
        <div className={`${CARD} p-5`}>
          <div className="flex items-center gap-2 text-blue-400"><ClipboardCheck className="h-4 w-4" /><span className="text-xs font-semibold">Manager</span></div>
          <p className="mt-3 text-2xl font-semibold text-slate-100">{skill.managerLevel ?? "—"}</p>
          <p className="mt-1 text-xs text-slate-500">Manager assessment</p>
        </div>
        <div className={`${CARD} p-5`}>
          <div className="flex items-center gap-2 text-amber-400"><TrendingUp className="h-4 w-4" /><span className="text-xs font-semibold">Self</span></div>
          <p className="mt-3 text-2xl font-semibold text-slate-100">{skill.selfLevel ?? "—"}</p>
          <p className="mt-1 text-xs text-slate-500">Your development self-assessment</p>
        </div>
      </section>

      <section className={`${CARD} p-5 sm:p-6`}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-sm font-semibold text-slate-100">Update self-assessment</h2>
            <p className="mt-1 max-w-2xl text-xs leading-5 text-slate-500">
              Choose the level that reflects what you can currently do. This changes only your self-rating. It cannot alter manager, verified or practice-authority evidence.
            </p>
          </div>
          {skill.trainingRequired ? (
            <span className="rounded-lg border border-amber-500/25 bg-amber-500/10 px-2.5 py-1 text-[10px] font-semibold text-amber-300">Training required</span>
          ) : null}
        </div>

        <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-5">
          {[
            [1, "Awareness"],
            [2, "Assisted"],
            [3, "Working"],
            [4, "Proficient"],
            [5, "Expert"],
          ].map(([rawLevel, rawLabel]) => {
            const level = Number(rawLevel);
            const label = String(rawLabel);
            const selected = nextSelfLevel === level;
            return (
              <button
                key={level}
                type="button"
                onClick={() => setNextSelfLevel(level)}
                aria-pressed={selected}
                className={`min-h-20 rounded-xl border px-3 py-3 text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 ${selected ? "border-blue-400/50 bg-blue-500/12 text-blue-100" : "border-slate-800 bg-[#07172b] text-slate-400 hover:border-slate-700"}`}
              >
                <span className="block text-lg font-semibold">{level}</span>
                <span className="mt-1 block text-[10px] font-medium">{label}</span>
              </button>
            );
          })}
        </div>

        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-h-5 text-xs text-slate-400" aria-live="polite">{saveMessage}</div>
          <button
            type="button"
            onClick={() => void saveSelfAssessment()}
            disabled={saving || nextSelfLevel === null || nextSelfLevel === skill.selfLevel}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
          >
            {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            {saving ? "Saving…" : "Save self-assessment"}
          </button>
        </div>
      </section>

      <section className={`${CARD} p-5`}>
        <h2 className="text-sm font-semibold text-slate-100">Evidence boundary</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className={`${RAISED} p-3`}><p className="text-[9px] uppercase tracking-[0.1em] text-slate-600">Vorta equipment score</p><p className={`mt-1 text-lg font-semibold ${scoreTone(profile.score?.vorta_score ?? null)}`}>{profile.score?.vorta_score ?? "—"}</p></div>
          <div className={`${RAISED} p-3`}><p className="text-[9px] uppercase tracking-[0.1em] text-slate-600">Evidence coverage</p><p className="mt-1 text-lg font-semibold text-slate-200">{profile.score?.evidence_coverage_pct ?? "—"}%</p></div>
          <div className={`${RAISED} p-3`}><p className="text-[9px] uppercase tracking-[0.1em] text-slate-600">Confidence</p><p className="mt-1 text-lg font-semibold text-slate-200">{profile.score?.evidence_confidence ?? "—"}</p></div>
          <div className={`${RAISED} p-3`}><p className="text-[9px] uppercase tracking-[0.1em] text-slate-600">Latest evidence</p><p className="mt-1 text-sm font-semibold text-slate-200">{formatTimestamp(profile.score?.latest_evidence_at)}</p></div>
        </div>
      </section>
    </main>
  );
}
