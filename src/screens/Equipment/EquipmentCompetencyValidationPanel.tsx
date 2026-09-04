import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, RefreshCw, ShieldCheck, UserCheck } from "lucide-react";
import { useParams } from "react-router-dom";
import { Button } from "../../components/ui/button";
import { Card, CardContent } from "../../components/ui/card";
import { supabase } from "../../lib/supabaseClient";
import {
  type EquipmentEngineerCapability,
  type EquipmentSkillsShowcase,
  getEquipmentSkillsShowcase,
} from "./equipmentService";

const levelLabels: Record<number, string> = {
  1: "Awareness",
  2: "Assisted",
  3: "Competent",
  4: "Proficient",
  5: "Expert",
};

function words(value?: string | null): string {
  return value ? value.replaceAll("_", " ").toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase()) : "—";
}

function validationTone(status?: string | null): string {
  if (status === "VALIDATED") return "border-emerald-500/25 bg-emerald-500/10 text-emerald-300";
  if (status === "MANAGER_REVIEW") return "border-amber-500/25 bg-amber-500/10 text-amber-300";
  if (status === "DEVELOPING") return "border-blue-500/25 bg-blue-500/10 text-blue-300";
  return "border-slate-700 bg-slate-800/70 text-slate-400";
}

export function EquipmentCompetencyValidationPanel(): JSX.Element | null {
  const { equipmentId } = useParams<{ equipmentId?: string }>();
  const [showcase, setShowcase] = useState<EquipmentSkillsShowcase | null>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<EquipmentEngineerCapability | null>(null);
  const [level, setLevel] = useState<number>(3);
  const [evidence, setEvidence] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const load = async (): Promise<void> => {
    if (!equipmentId) return;
    setLoading(true);
    try {
      setShowcase(await getEquipmentSkillsShowcase(equipmentId));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, [equipmentId]);

  const queue = useMemo(
    () => (showcase?.engineers ?? [])
      .filter((engineer) => engineer.validationStatus !== "VALIDATED")
      .sort((left, right) => (right.competencyLevel ?? 0) - (left.competencyLevel ?? 0) || left.engineerName.localeCompare(right.engineerName)),
    [showcase],
  );

  const begin = (engineer: EquipmentEngineerCapability): void => {
    setSelected(engineer);
    setLevel(Math.min(5, Math.max(1, engineer.competencyLevel ?? 3)));
    setEvidence(engineer.evidenceReference ?? "");
    setNotes("");
    setMessage(null);
  };

  const submit = async (): Promise<void> => {
    if (!equipmentId || !selected) return;
    setSaving(true);
    setMessage(null);
    try {
      const { data, error } = await supabase.functions.invoke("equipment-competency-assessment", {
        body: {
          equipmentId,
          engineerId: selected.engineerId,
          assessmentLevel: level,
          evidenceReference: evidence.trim() || null,
          notes: notes.trim() || null,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setMessage(`${selected.engineerName} validated at Level ${level}. Vorta Equipment Score refreshed.`);
      setSelected(null);
      setEvidence("");
      setNotes("");
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Competency validation could not be saved.");
    } finally {
      setSaving(false);
    }
  };

  if (!equipmentId) return null;

  return (
    <div className="mx-auto w-full max-w-[1600px] px-4 pb-8 md:px-6 xl:px-8" data-vorta-equipment-validation-queue="true">
      <Card className="rounded-2xl border border-blue-500/20 bg-[#141820] shadow-none">
        <CardContent className="p-5 md:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-blue-400" />
                <h2 className="text-base font-semibold text-slate-100">Equipment Competency Validation</h2>
              </div>
              <p className="mt-1 max-w-3xl text-xs leading-5 text-slate-500">
                Manager or authorised peer sign-off for this equipment. Validation changes competency evidence only; execution authority remains separately controlled.
              </p>
            </div>
            <Button type="button" variant="outline" onClick={() => void load()} disabled={loading} className="h-9 gap-2 border-gray-700 bg-transparent px-3 text-xs text-slate-300 hover:bg-gray-800">
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />Refresh
            </Button>
          </div>

          {message ? (
            <div className="mt-4 rounded-xl border border-blue-500/20 bg-blue-500/[0.05] px-4 py-3 text-xs text-blue-200">{message}</div>
          ) : null}

          {loading ? (
            <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 3 }).map((_, index) => <div key={index} className="h-24 animate-pulse rounded-xl bg-[#171c25]" />)}
            </div>
          ) : queue.length ? (
            <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {queue.map((engineer) => (
                <article key={engineer.capabilityId || engineer.engineerId} className="rounded-xl border border-gray-800 bg-[#0d1219] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-100">{engineer.engineerName}</p>
                      <p className="mt-1 text-[11px] text-slate-500">Level {engineer.competencyLevel ?? "—"} · {words(engineer.capabilityRole)}</p>
                    </div>
                    <span className={`rounded border px-2 py-1 text-[9px] font-semibold ${validationTone(engineer.validationStatus)}`}>{words(engineer.validationStatus)}</span>
                  </div>
                  <Button type="button" onClick={() => begin(engineer)} className="mt-4 h-9 w-full gap-2 bg-blue-600 px-3 text-xs text-white hover:bg-blue-500">
                    <UserCheck className="h-3.5 w-3.5" />Review & validate
                  </Button>
                </article>
              ))}
            </div>
          ) : (
            <div className="mt-5 rounded-xl border border-emerald-500/20 bg-emerald-500/[0.05] px-4 py-8 text-center">
              <CheckCircle2 className="mx-auto h-6 w-6 text-emerald-400" />
              <p className="mt-3 text-sm font-semibold text-emerald-200">All listed equipment competencies are validated</p>
              <p className="mt-1 text-xs text-slate-500">Future reassessments remain recorded in the competency audit history.</p>
            </div>
          )}

          {selected ? (
            <div className="mt-5 rounded-2xl border border-blue-500/25 bg-[#07172b] p-4 md:p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-blue-400/80">Authorised assessment</p>
                  <h3 className="mt-1 text-sm font-semibold text-slate-100">{selected.engineerName}</h3>
                  <p className="mt-1 text-xs text-slate-500">Current Level {selected.competencyLevel ?? "—"} · {words(selected.validationStatus)}</p>
                </div>
                <button type="button" onClick={() => setSelected(null)} className="text-xs font-medium text-slate-500 hover:text-slate-200">Cancel</button>
              </div>

              <div className="mt-4 grid grid-cols-5 gap-2">
                {[1, 2, 3, 4, 5].map((value) => (
                  <button key={value} type="button" onClick={() => setLevel(value)} className={`rounded-xl border px-2 py-3 text-center transition-colors ${level === value ? "border-blue-400/50 bg-blue-500/10 text-blue-200" : "border-gray-800 bg-[#0d1219] text-slate-500 hover:border-blue-500/30"}`}>
                    <span className="block text-base font-semibold">{value}</span>
                    <span className="mt-1 hidden text-[9px] sm:block">{levelLabels[value]}</span>
                  </button>
                ))}
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <label className="text-xs text-slate-400">Evidence reference
                  <input value={evidence} onChange={(event) => setEvidence(event.target.value)} placeholder="Assessment, job, certificate or evidence reference" className="mt-1.5 h-10 w-full rounded-lg border border-gray-700 bg-[#0b0e14] px-3 text-xs text-slate-200 outline-none placeholder:text-slate-600 focus:border-blue-500" />
                </label>
                <label className="text-xs text-slate-400">Assessment note
                  <input value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Why this level is justified" className="mt-1.5 h-10 w-full rounded-lg border border-gray-700 bg-[#0b0e14] px-3 text-xs text-slate-200 outline-none placeholder:text-slate-600 focus:border-blue-500" />
                </label>
              </div>

              <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                <p className="max-w-2xl text-[10px] leading-4 text-slate-500">Self-verification is blocked. Peer validation requires a current validated capability on this same equipment and sufficient practice authority. The assessment is retained in history even after later reassessment.</p>
                <Button type="button" onClick={() => void submit()} disabled={saving} className="h-10 gap-2 bg-emerald-600 px-4 text-xs text-white hover:bg-emerald-500 disabled:opacity-50">
                  {saving ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <ShieldCheck className="h-3.5 w-3.5" />}
                  Validate Level {level}
                </Button>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
