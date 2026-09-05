import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  Clock3,
  RefreshCw,
  ShieldCheck,
  Wrench,
} from "lucide-react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";
import { EquipmentCompetencyReviewPanel } from "./EquipmentCompetencyReviewPanel";
import { EngineerSkillsScreen as EngineerSkillsLiveList } from "./EngineerSkillsLiveScreens";

const PAGE =
  "mx-auto flex w-full max-w-[1600px] flex-col gap-5 px-4 pb-10 pt-5 sm:px-5 md:gap-6 md:px-6 md:pb-12 md:pt-6 xl:px-8";
const CARD =
  "rounded-2xl border border-slate-800/75 bg-[#030c1d] shadow-[0_14px_34px_rgba(0,0,0,0.22)]";
const RAISED = "rounded-xl border border-slate-800/70 bg-[#07172b]";
const BUTTON =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-700/80 bg-[#07172b] px-3 text-sm font-medium text-slate-200 transition-colors hover:border-blue-400/50 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400";

interface SkillEvidence {
  skillId: string;
  name: string;
  category: string;
  requiredLevel: number;
  selfLevel: number | null;
  managerLevel: number | null;
  verifiedLevel: number | null;
  verificationStatus: string;
  trainingRequired: boolean;
}

interface WorkflowEquipmentProfile {
  equipment: {
    id: string;
    name: string;
    equipment_code?: string | null;
    area?: string | null;
  };
  score?: {
    vorta_score?: number | null;
    evidence_coverage_pct?: number | null;
    evidence_confidence?: string | null;
  } | null;
  selfAssessment?: {
    id?: string;
    assessment_level?: number | null;
    assessment_status?: string | null;
  } | null;
  requiredSkills: SkillEvidence[];
}

interface WorkflowPayload {
  siteId: string;
  engineer: {
    id: string;
    full_name: string;
  };
  equipmentProfiles: WorkflowEquipmentProfile[];
}

function numberOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function parsePayload(raw: unknown): WorkflowPayload {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("Engineer skills evidence returned an invalid payload.");
  }
  const value = raw as Record<string, unknown>;
  if (typeof value.error === "string" && value.error) throw new Error(value.error);
  const engineerValue = value.engineer;
  if (!engineerValue || typeof engineerValue !== "object" || Array.isArray(engineerValue)) {
    throw new Error("The signed-in engineer could not be resolved.");
  }
  const engineer = engineerValue as Record<string, unknown>;
  const siteId = typeof value.siteId === "string" ? value.siteId : "";
  const engineerId = typeof engineer.id === "string" ? engineer.id : "";
  const engineerName = typeof engineer.full_name === "string" ? engineer.full_name : "";
  if (!siteId || !engineerId || !engineerName) {
    throw new Error("Engineer identity evidence is incomplete.");
  }

  const equipmentProfiles = Array.isArray(value.equipmentProfiles)
    ? value.equipmentProfiles.flatMap((rawProfile): WorkflowEquipmentProfile[] => {
        if (!rawProfile || typeof rawProfile !== "object" || Array.isArray(rawProfile)) return [];
        const profile = rawProfile as Record<string, unknown>;
        if (!profile.equipment || typeof profile.equipment !== "object" || Array.isArray(profile.equipment)) return [];
        const equipment = profile.equipment as Record<string, unknown>;
        const id = typeof equipment.id === "string" ? equipment.id : "";
        const name = typeof equipment.name === "string" ? equipment.name : "";
        if (!id || !name) return [];
        const requiredSkills = Array.isArray(profile.requiredSkills)
          ? profile.requiredSkills.flatMap((rawSkill): SkillEvidence[] => {
              if (!rawSkill || typeof rawSkill !== "object" || Array.isArray(rawSkill)) return [];
              const skill = rawSkill as Record<string, unknown>;
              const skillId = typeof skill.skillId === "string" ? skill.skillId : "";
              const skillName = typeof skill.name === "string" ? skill.name : "";
              if (!skillId || !skillName) return [];
              return [{
                skillId,
                name: skillName,
                category: typeof skill.category === "string" ? skill.category : "General",
                requiredLevel: Math.max(1, Math.min(5, Math.round(numberOrNull(skill.requiredLevel) ?? 1))),
                selfLevel: numberOrNull(skill.selfLevel),
                managerLevel: numberOrNull(skill.managerLevel),
                verifiedLevel: numberOrNull(skill.verifiedLevel),
                verificationStatus: typeof skill.verificationStatus === "string" ? skill.verificationStatus : "not_uploaded",
                trainingRequired: skill.trainingRequired === true,
              }];
            })
          : [];
        const selfAssessment =
          profile.selfAssessment && typeof profile.selfAssessment === "object" && !Array.isArray(profile.selfAssessment)
            ? profile.selfAssessment as WorkflowEquipmentProfile["selfAssessment"]
            : null;
        const score =
          profile.score && typeof profile.score === "object" && !Array.isArray(profile.score)
            ? profile.score as WorkflowEquipmentProfile["score"]
            : null;
        return [{
          equipment: {
            id,
            name,
            equipment_code: typeof equipment.equipment_code === "string" ? equipment.equipment_code : null,
            area: typeof equipment.area === "string" ? equipment.area : null,
          },
          score,
          selfAssessment,
          requiredSkills,
        }];
      })
    : [];

  return {
    siteId,
    engineer: { id: engineerId, full_name: engineerName },
    equipmentProfiles,
  };
}

async function loadWorkflowPayload(): Promise<WorkflowPayload> {
  const { data, error } = await supabase.functions.invoke("engineer-skills-data");
  if (error) throw new Error(`Engineer skills evidence could not be loaded: ${error.message}`);
  return parsePayload(data);
}

function effectiveLevel(skill: SkillEvidence): number | null {
  return skill.verifiedLevel ?? skill.managerLevel ?? skill.selfLevel ?? null;
}

function EquipmentAssessmentLinks(): JSX.Element {
  const [payload, setPayload] = useState<WorkflowPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    void loadWorkflowPayload()
      .then((result) => {
        if (!cancelled) setPayload(result);
      })
      .catch((loadError) => {
        if (!cancelled) {
          setPayload(null);
          setError(loadError instanceof Error ? loadError.message : "Equipment assessment evidence could not be loaded.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [reloadToken]);

  if (loading) {
    return (
      <section className={`${PAGE} pt-0`} aria-live="polite">
        <div className={`${CARD} h-32 animate-pulse`} />
      </section>
    );
  }

  if (error || !payload) {
    return (
      <section className={`${PAGE} pt-0`}>
        <div className={`${CARD} p-4`}>
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-amber-300">{error ?? "Equipment assessment evidence is unavailable."}</p>
            <button type="button" onClick={() => setReloadToken((value) => value + 1)} className="text-xs font-semibold text-slate-200">Retry</button>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className={`${PAGE} pt-0`} data-vorta-equipment-assessment-links="live">
      <div className={`${CARD} p-4 sm:p-5`}>
        <div className="flex items-start gap-3">
          <ClipboardCheck className="mt-0.5 h-5 w-5 text-blue-400" />
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-blue-400">Equipment self-assessment</p>
            <h2 className="mt-1 text-sm font-semibold text-slate-100">Propose your equipment competency</h2>
            <p className="mt-1 text-xs leading-5 text-slate-500">
              A proposal is development evidence only until an authorised manager, team leader or qualified peer validates it.
            </p>
          </div>
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {payload.equipmentProfiles.map((profile) => {
            const pending = profile.selfAssessment?.assessment_status === "pending";
            return (
              <Link
                key={profile.equipment.id}
                to={`/engineer/skills/equipment/${encodeURIComponent(profile.equipment.id)}`}
                className="flex min-h-16 items-center justify-between gap-3 rounded-xl border border-slate-800/75 bg-[#07172b] px-3 py-3 transition-colors hover:border-blue-400/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
              >
                <div className="min-w-0">
                  <p className="truncate text-xs font-semibold text-slate-200">{profile.equipment.name}</p>
                  <p className="mt-1 text-[10px] text-slate-500">
                    {profile.equipment.equipment_code ?? "No asset code"} · {profile.score?.vorta_score ?? "—"} Vorta score
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {pending ? (
                    <span className="inline-flex items-center gap-1 rounded-lg border border-amber-500/25 bg-amber-500/10 px-2 py-1 text-[9px] font-semibold text-amber-300">
                      <Clock3 className="h-3 w-3" />Pending
                    </span>
                  ) : null}
                  <ChevronRight className="h-4 w-4 text-slate-600" />
                </div>
              </Link>
            );
          })}
        </div>
      </div>
      <EquipmentCompetencyReviewPanel siteId={payload.siteId} compact />
    </section>
  );
}

export function EngineerSkillsWorkflowScreen(): JSX.Element {
  return (
    <>
      <EngineerSkillsLiveList />
      <EquipmentAssessmentLinks />
    </>
  );
}

export function EngineerSkillSelfAssessmentScreen(): JSX.Element {
  const { skillName } = useParams();
  const [searchParams] = useSearchParams();
  const equipmentId = searchParams.get("equipment") ?? "";
  const decodedName = decodeURIComponent(skillName ?? "");
  const [payload, setPayload] = useState<WorkflowPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [nextLevel, setNextLevel] = useState<number | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    void loadWorkflowPayload()
      .then((result) => {
        if (!cancelled) setPayload(result);
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
    return () => { cancelled = true; };
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
    setNextLevel(match?.skill.selfLevel ?? null);
  }, [match?.skill.skillId, match?.skill.selfLevel]);

  const save = async (): Promise<void> => {
    if (!match || nextLevel === null || nextLevel < 1 || nextLevel > 5) {
      setMessage("Choose a self-assessment level from 1 to 5.");
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      const { data, error: saveError } = await supabase.functions.invoke(
        "engineer-skill-self-assessment",
        { body: { skillId: match.skill.skillId, selfRating: nextLevel } },
      );
      if (saveError) throw saveError;
      if (!data) throw new Error("Self-assessment returned no evidence.");
      setMessage(`Level ${nextLevel} self-assessment saved and marked pending verification. Manager and verified ratings remain unchanged.`);
      setReloadToken((value) => value + 1);
    } catch (saveError) {
      setMessage(saveError instanceof Error ? `Self-assessment was not saved: ${saveError.message}` : "Self-assessment was not saved.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <main className={PAGE}><div className={`${CARD} h-72 animate-pulse`} /></main>;
  }

  if (error || !payload || !match) {
    return (
      <main className={PAGE}>
        <Link to="/engineer/skills" className={BUTTON}><ArrowLeft className="h-4 w-4" />My Skills</Link>
        <section className={`${CARD} p-5`}>
          <AlertTriangle className="h-5 w-5 text-amber-400" />
          <h1 className="mt-3 text-lg font-semibold text-slate-100">Skill evidence unavailable</h1>
          <p className="mt-1 text-sm leading-6 text-slate-500">{error ?? "This skill is not present in your current authorised equipment evidence."}</p>
        </section>
      </main>
    );
  }

  const { skill, profile } = match;
  const effective = effectiveLevel(skill);
  const pending = skill.selfLevel !== null && skill.verificationStatus.toLowerCase() === "pending";

  return (
    <main className={PAGE} data-vorta-engineer-skill-self-assessment="live">
      <div><Link to="/engineer/skills" className={BUTTON}><ArrowLeft className="h-4 w-4" />My Skills</Link></div>

      <header>
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-blue-400">{profile.equipment.name}</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-[-0.025em] text-slate-50 md:text-3xl">{skill.name}</h1>
        <p className="mt-1 text-sm text-slate-400">{skill.category} · Required Level {skill.requiredLevel}</p>
      </header>

      <section className="grid gap-3 sm:grid-cols-3">
        <div className={`${CARD} p-5`}>
          <div className="flex items-center gap-2 text-emerald-400"><ShieldCheck className="h-4 w-4" /><span className="text-xs font-semibold">Verified</span></div>
          <p className="mt-3 text-2xl font-semibold text-slate-100">{skill.verifiedLevel ?? "—"}</p>
          <p className="mt-1 text-xs text-slate-500">Authoritative competency evidence</p>
        </div>
        <div className={`${CARD} p-5`}>
          <div className="flex items-center gap-2 text-blue-400"><ClipboardCheck className="h-4 w-4" /><span className="text-xs font-semibold">Manager</span></div>
          <p className="mt-3 text-2xl font-semibold text-slate-100">{skill.managerLevel ?? "—"}</p>
          <p className="mt-1 text-xs text-slate-500">Manager assessment</p>
        </div>
        <div className={`${CARD} p-5`}>
          <div className="flex items-center gap-2 text-amber-400"><Clock3 className="h-4 w-4" /><span className="text-xs font-semibold">Self {pending ? "· pending" : ""}</span></div>
          <p className="mt-3 text-2xl font-semibold text-slate-100">{skill.selfLevel ?? "—"}</p>
          <p className="mt-1 text-xs text-slate-500">Development evidence, not verification</p>
        </div>
      </section>

      <section className={`${CARD} p-5 sm:p-6`}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-sm font-semibold text-slate-100">Update self-assessment</h2>
            <p className="mt-1 max-w-2xl text-xs leading-5 text-slate-500">
              Your selection is stored as pending self-evidence. It cannot alter manager, verified or practice-authority evidence and does not by itself certify you for this equipment.
            </p>
          </div>
          {skill.trainingRequired ? (
            <span className="rounded-lg border border-amber-500/25 bg-amber-500/10 px-2.5 py-1 text-[10px] font-semibold text-amber-300">Training required</span>
          ) : null}
        </div>

        <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-5">
          {[[1,"Awareness"],[2,"Assisted"],[3,"Working"],[4,"Proficient"],[5,"Expert"]].map(([rawLevel, rawLabel]) => {
            const level = Number(rawLevel);
            const selected = nextLevel === level;
            return (
              <button
                key={level}
                type="button"
                onClick={() => setNextLevel(level)}
                aria-pressed={selected}
                className={`min-h-20 rounded-xl border px-3 py-3 text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 ${selected ? "border-blue-400/50 bg-blue-500/12 text-blue-100" : "border-slate-800 bg-[#07172b] text-slate-400 hover:border-slate-700"}`}
              >
                <span className="block text-lg font-semibold">{level}</span>
                <span className="mt-1 block text-[10px] font-medium">{String(rawLabel)}</span>
              </button>
            );
          })}
        </div>

        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="min-h-5 text-xs text-slate-400" aria-live="polite">{message}</p>
          <button
            type="button"
            onClick={() => void save()}
            disabled={saving || nextLevel === null || nextLevel === skill.selfLevel}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
          >
            {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            {saving ? "Saving…" : "Save pending self-assessment"}
          </button>
        </div>
      </section>

      <section className={`${RAISED} p-4`}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <Wrench className="mt-0.5 h-5 w-5 text-blue-400" />
            <div>
              <p className="text-sm font-semibold text-slate-100">Equipment-level assessment</p>
              <p className="mt-1 text-xs text-slate-500">Skill self-ratings are separate from verified competence on the machine as a whole.</p>
            </div>
          </div>
          <Link to={`/engineer/skills/equipment/${encodeURIComponent(profile.equipment.id)}`} className={BUTTON}>
            Assess {profile.equipment.name}<ChevronRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      <section className={`${CARD} p-4`}>
        <p className="text-[9px] uppercase tracking-[0.1em] text-slate-600">Current effective display level</p>
        <p className="mt-1 text-xl font-semibold text-slate-100">{effective ?? "—"}</p>
        <p className="mt-1 text-xs text-slate-500">Verified evidence retains priority over manager evidence, which retains priority over self-evidence.</p>
      </section>
    </main>
  );
}
