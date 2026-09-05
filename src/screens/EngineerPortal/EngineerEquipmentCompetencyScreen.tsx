import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ArrowLeft, CheckCircle2, Clock3, RefreshCw, ShieldCheck, Wrench } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";

const PAGE = "mx-auto flex w-full max-w-[1040px] flex-col gap-5 px-4 pb-10 pt-5 sm:px-5 md:px-6 md:pb-12 md:pt-6";
const CARD = "rounded-2xl border border-slate-800/75 bg-[#030c1d] shadow-[0_14px_34px_rgba(0,0,0,0.2)]";
const RAISED = "rounded-xl border border-slate-800/70 bg-[#07172b]";
const BUTTON = "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-700/80 bg-[#07172b] px-3 text-sm font-medium text-slate-200 transition-colors hover:border-blue-400/50 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400";

interface EquipmentProfile {
  equipment: {
    id: string;
    name: string;
    equipment_code?: string | null;
    area?: string | null;
    criticality?: string | null;
  };
  score?: {
    vorta_score?: number | null;
    evidence_coverage_pct?: number | null;
    evidence_confidence?: string | null;
  } | null;
  capability?: {
    competency_level?: number | null;
    capability_status?: string | null;
    practice_authority?: string | null;
    validation_status?: string | null;
    verified_at?: string | null;
  } | null;
  selfAssessment?: {
    id: string;
    assessment_level?: number | null;
    assessment_status?: string | null;
    evidence_reference?: string | null;
    notes?: string | null;
    assessed_at?: string | null;
  } | null;
  latestAssessment?: {
    assessment_status?: string | null;
    review_outcome?: string | null;
    reviewed_at?: string | null;
    review_notes?: string | null;
  } | null;
  requiredSkills?: Array<{
    skillId: string;
    name: string;
    requiredLevel: number;
    verifiedLevel?: number | null;
    managerLevel?: number | null;
    selfLevel?: number | null;
  }>;
}

function formatDate(value?: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" }).format(date);
}

export function EngineerEquipmentCompetencyScreen(): JSX.Element {
  const { equipmentId = "" } = useParams();
  const [profile, setProfile] = useState<EquipmentProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [level, setLevel] = useState<number | null>(null);
  const [evidenceReference, setEvidenceReference] = useState("");
  const [notes, setNotes] = useState("");
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    void supabase.functions
      .invoke("engineer-skills-data")
      .then(({ data, error: invokeError }) => {
        if (cancelled) return;
        if (invokeError) throw invokeError;
        const profiles = Array.isArray(data?.equipmentProfiles) ? data.equipmentProfiles as EquipmentProfile[] : [];
        const match = profiles.find((item) => item?.equipment?.id === equipmentId) ?? null;
        if (!match) throw new Error("This equipment is not present in your authorised live capability evidence.");
        setProfile(match);
      })
      .catch((loadError) => {
        if (!cancelled) {
          setProfile(null);
          setError(loadError instanceof Error ? loadError.message : "Equipment competency evidence could not be loaded.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [equipmentId, reloadToken]);

  useEffect(() => {
    if (!profile) return;
    const pendingLevel = Number(profile.selfAssessment?.assessment_level);
    const verifiedLevel = Number(profile.capability?.competency_level);
    setLevel(Number.isInteger(pendingLevel) && pendingLevel >= 1 && pendingLevel <= 5
      ? pendingLevel
      : Number.isInteger(verifiedLevel) && verifiedLevel >= 1 && verifiedLevel <= 5
        ? verifiedLevel
        : null);
    setEvidenceReference(profile.selfAssessment?.evidence_reference ?? "");
    setNotes(profile.selfAssessment?.notes ?? "");
  }, [profile?.equipment.id, profile?.selfAssessment?.id]);

  const skillSummary = useMemo(() => {
    const skills = profile?.requiredSkills ?? [];
    const ready = skills.filter((skill) => {
      const effective = skill.verifiedLevel ?? skill.managerLevel ?? skill.selfLevel ?? 0;
      return effective >= skill.requiredLevel;
    }).length;
    return { total: skills.length, ready };
  }, [profile]);

  const submit = async (): Promise<void> => {
    if (!level || level < 1 || level > 5) {
      setMessage("Choose a proposed equipment competency level from 1 to 5.");
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      const { data, error: submitError } = await supabase.functions.invoke(
        "engineer-equipment-self-assessment",
        {
          body: {
            equipmentId,
            assessmentLevel: level,
            evidenceReference: evidenceReference.trim() || null,
            notes: notes.trim() || null,
          },
        },
      );
      if (submitError) throw submitError;
      if (!data) throw new Error("The proposal returned no evidence.");
      setMessage(`Level ${level} proposal submitted for independent review. Your verified capability and Vorta Score remain unchanged until approval.`);
      setReloadToken((value) => value + 1);
    } catch (submitError) {
      setMessage(submitError instanceof Error ? `Proposal was not saved: ${submitError.message}` : "Proposal was not saved.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <main className={PAGE} aria-live="polite">
        <div className={`${CARD} h-52 animate-pulse`} />
        <div className={`${CARD} h-72 animate-pulse`} />
      </main>
    );
  }

  if (error || !profile) {
    return (
      <main className={PAGE}>
        <Link to="/engineer/skills" className={BUTTON}><ArrowLeft className="h-4 w-4" />My Skills</Link>
        <section className={`${CARD} p-5`}>
          <AlertTriangle className="h-5 w-5 text-amber-400" />
          <h1 className="mt-3 text-lg font-semibold text-slate-100">Equipment competency evidence unavailable</h1>
          <p className="mt-1 text-sm leading-6 text-slate-500">{error ?? "Live evidence could not be verified."}</p>
        </section>
      </main>
    );
  }

  const pending = profile.selfAssessment?.assessment_status === "pending";
  const verifiedLevel = profile.capability?.validation_status === "VALIDATED" ? profile.capability.competency_level ?? null : null;

  return (
    <main className={PAGE} data-vorta-equipment-self-assessment="live">
      <div><Link to="/engineer/skills" className={BUTTON}><ArrowLeft className="h-4 w-4" />My Skills</Link></div>

      <header>
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-blue-400">Equipment competency</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-[-0.025em] text-slate-50 md:text-3xl">{profile.equipment.name}</h1>
        <p className="mt-1 text-sm text-slate-400">{profile.equipment.equipment_code ?? "No asset code"} · {profile.equipment.area ?? "Maintenance"} · {profile.equipment.criticality ?? "Unrated criticality"}</p>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className={`${CARD} p-4`}><p className="text-[9px] uppercase tracking-[0.1em] text-slate-600">Verified level</p><p className="mt-2 text-2xl font-semibold text-emerald-300">{verifiedLevel ?? "—"}</p><p className="mt-1 text-xs text-slate-500">Independent authoritative capability</p></div>
        <div className={`${CARD} p-4`}><p className="text-[9px] uppercase tracking-[0.1em] text-slate-600">Vorta score</p><p className="mt-2 text-2xl font-semibold text-blue-300">{profile.score?.vorta_score ?? "—"}</p><p className="mt-1 text-xs text-slate-500">Evidence-derived equipment score</p></div>
        <div className={`${CARD} p-4`}><p className="text-[9px] uppercase tracking-[0.1em] text-slate-600">Skill fit</p><p className="mt-2 text-2xl font-semibold text-slate-100">{skillSummary.ready}/{skillSummary.total}</p><p className="mt-1 text-xs text-slate-500">Requirements currently at level</p></div>
        <div className={`${CARD} p-4`}><p className="text-[9px] uppercase tracking-[0.1em] text-slate-600">Practice authority</p><p className="mt-2 text-sm font-semibold text-slate-100">{profile.capability?.practice_authority ?? "Not assigned"}</p><p className="mt-1 text-xs text-slate-500">Separate from self-assessment</p></div>
      </section>

      {pending ? (
        <section className="rounded-2xl border border-amber-500/25 bg-amber-500/8 p-4 sm:p-5" data-vorta-equipment-assessment-state="pending">
          <div className="flex items-start gap-3">
            <Clock3 className="mt-0.5 h-5 w-5 text-amber-300" />
            <div>
              <h2 className="text-sm font-semibold text-amber-100">Level {profile.selfAssessment?.assessment_level} awaiting independent review</h2>
              <p className="mt-1 text-xs leading-5 text-amber-100/70">Submitted {formatDate(profile.selfAssessment?.assessed_at)}. You may replace the pending proposal below; the previous proposal will remain in the audit chain as superseded.</p>
            </div>
          </div>
        </section>
      ) : profile.latestAssessment?.review_outcome === "rejected" ? (
        <section className="rounded-2xl border border-red-500/20 bg-red-500/7 p-4">
          <p className="text-sm font-semibold text-red-200">Previous proposal was rejected</p>
          <p className="mt-1 text-xs text-red-100/65">Reviewed {formatDate(profile.latestAssessment.reviewed_at)}{profile.latestAssessment.review_notes ? ` · ${profile.latestAssessment.review_notes}` : ""}</p>
        </section>
      ) : null}

      <section className={`${CARD} p-5 sm:p-6`}>
        <div className="flex items-start gap-3">
          <Wrench className="mt-0.5 h-5 w-5 text-blue-400" />
          <div>
            <h2 className="text-sm font-semibold text-slate-100">Propose your equipment competency</h2>
            <p className="mt-1 max-w-2xl text-xs leading-5 text-slate-500">Rate what you can independently demonstrate on this equipment and add a useful evidence reference. The proposal is not authoritative until an authorised manager, team leader or suitably validated peer reviews it.</p>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-5">
          {[[1,"Awareness"],[2,"Assisted"],[3,"Working"],[4,"Proficient"],[5,"Expert"]].map(([rawLevel, rawLabel]) => {
            const value = Number(rawLevel);
            const selected = level === value;
            return (
              <button key={value} type="button" onClick={() => setLevel(value)} aria-pressed={selected} className={`min-h-20 rounded-xl border px-3 py-3 text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 ${selected ? "border-blue-400/50 bg-blue-500/12 text-blue-100" : "border-slate-800 bg-[#07172b] text-slate-400 hover:border-slate-700"}`}>
                <span className="block text-lg font-semibold">{value}</span><span className="mt-1 block text-[10px] font-medium">{String(rawLabel)}</span>
              </button>
            );
          })}
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="text-xs font-medium text-slate-300">Evidence reference
            <input value={evidenceReference} onChange={(event) => setEvidenceReference(event.target.value)} maxLength={1000} placeholder="WO number, training record, assessment or other evidence" className="mt-2 h-11 w-full rounded-xl border border-slate-800 bg-slate-950/50 px-3 text-sm text-slate-100 placeholder:text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400" />
          </label>
          <label className="text-xs font-medium text-slate-300">Notes
            <textarea value={notes} onChange={(event) => setNotes(event.target.value)} maxLength={2000} rows={3} placeholder="What can you diagnose, maintain, set up or recover on this equipment?" className="mt-2 w-full rounded-xl border border-slate-800 bg-slate-950/50 px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400" />
          </label>
        </div>

        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="min-h-5 text-xs text-slate-400" aria-live="polite">{message}</p>
          <button type="button" onClick={() => void submit()} disabled={saving || level === null} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400">
            {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            {saving ? "Submitting…" : pending ? "Replace pending proposal" : "Submit for independent review"}
          </button>
        </div>
      </section>

      <section className={`${RAISED} p-4`}>
        <div className="flex items-start gap-3"><ShieldCheck className="mt-0.5 h-5 w-5 text-emerald-400" /><div><p className="text-sm font-semibold text-slate-100">Authority boundary</p><p className="mt-1 text-xs leading-5 text-slate-500">A self-proposal never updates verified competency, practice authority or the equipment Vorta Score. Those change only after independent validation and the score refresh that follows it.</p></div></div>
      </section>
    </main>
  );
}
