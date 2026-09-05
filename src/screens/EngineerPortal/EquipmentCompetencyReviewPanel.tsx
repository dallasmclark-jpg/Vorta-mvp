import { useEffect, useState } from "react";
import { CheckCircle2, RefreshCw, ShieldCheck, XCircle } from "lucide-react";
import { supabase } from "../../lib/supabaseClient";

interface ReviewItem {
  id: string;
  equipment: {
    id: string;
    name: string;
    equipmentCode: string | null;
    area: string | null;
  };
  engineer: {
    id: string;
    name: string;
    discipline: string | null;
  };
  proposedLevel: number;
  evidenceReference: string | null;
  notes: string | null;
  submittedAt: string | null;
  reviewerAuthority: string;
}

interface ReviewPayload {
  siteId: string;
  reviewerRole: string;
  items: ReviewItem[];
  generatedAt: string;
}

interface EquipmentCompetencyReviewPanelProps {
  siteId?: string | null;
  enabled?: boolean;
  compact?: boolean;
}

const CARD = "rounded-2xl border border-slate-800/75 bg-[#030c1d] shadow-[0_14px_34px_rgba(0,0,0,0.18)]";

function dateLabel(value: string | null): string {
  if (!value) return "Recently submitted";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Recently submitted";
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" }).format(date);
}

export function EquipmentCompetencyReviewPanel({
  siteId,
  enabled = true,
  compact = false,
}: EquipmentCompetencyReviewPanelProps): JSX.Element | null {
  const [payload, setPayload] = useState<ReviewPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    void supabase.functions
      .invoke("equipment-competency-review-data", { body: siteId ? { siteId } : {} })
      .then(({ data, error: invokeError }) => {
        if (cancelled) return;
        if (invokeError) throw invokeError;
        const value = data as ReviewPayload | null;
        if (!value || !Array.isArray(value.items)) throw new Error("Review evidence returned an invalid payload.");
        setPayload(value);
      })
      .catch((loadError) => {
        if (!cancelled) {
          setPayload(null);
          setError(loadError instanceof Error ? loadError.message : "Review queue could not be loaded.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [enabled, reloadToken, siteId]);

  if (!enabled) return null;

  const review = async (item: ReviewItem, action: "validate" | "reject"): Promise<void> => {
    setSavingId(item.id);
    setMessage(null);
    setError(null);
    try {
      const { data, error: reviewError } = await supabase.functions.invoke(
        "equipment-competency-assessment",
        { body: { assessmentId: item.id, action } },
      );
      if (reviewError) throw reviewError;
      if (!data) throw new Error("Review action returned no evidence.");
      setMessage(
        action === "validate"
          ? `${item.engineer.name}'s Level ${item.proposedLevel} proposal for ${item.equipment.name} was independently validated.`
          : `${item.engineer.name}'s proposal for ${item.equipment.name} was rejected and remains outside authoritative capability.`,
      );
      setReloadToken((value) => value + 1);
    } catch (reviewError) {
      setError(reviewError instanceof Error ? reviewError.message : "Competency review could not be saved.");
    } finally {
      setSavingId(null);
    }
  };

  const items = payload?.items ?? [];
  if (!loading && !error && items.length === 0) {
    return compact ? null : (
      <section className={`${CARD} p-4 sm:p-5`} data-vorta-competency-review-state="empty">
        <div className="flex items-start gap-3">
          <ShieldCheck className="mt-0.5 h-5 w-5 text-emerald-400" />
          <div>
            <h2 className="text-sm font-semibold text-slate-100">Equipment competency reviews</h2>
            <p className="mt-1 text-xs leading-5 text-slate-500">No pending proposals currently require your authorised review.</p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className={`${CARD} p-4 sm:p-5`} data-vorta-competency-review-state={error ? "unavailable" : loading ? "loading" : "pending"}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-blue-400">Independent verification</p>
          <h2 className="mt-1 text-sm font-semibold text-slate-100">Equipment competency reviews</h2>
          <p className="mt-1 text-xs leading-5 text-slate-500">
            Only proposals your current role or verified equipment authority permits you to assess are shown here.
          </p>
        </div>
        {loading ? <RefreshCw className="h-4 w-4 animate-spin text-slate-500" /> : <ShieldCheck className="h-5 w-5 text-emerald-400" />}
      </div>

      {message ? <p className="mt-3 rounded-xl border border-emerald-500/20 bg-emerald-500/8 px-3 py-2 text-xs text-emerald-200" aria-live="polite">{message}</p> : null}
      {error ? (
        <div className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-amber-500/20 bg-amber-500/8 px-3 py-2 text-xs text-amber-200">
          <span>{error}</span>
          <button type="button" onClick={() => setReloadToken((value) => value + 1)} className="shrink-0 font-semibold text-amber-100">Retry</button>
        </div>
      ) : null}

      {items.length > 0 ? (
        <div className="mt-4 space-y-3">
          {items.map((item) => (
            <article key={item.id} className="rounded-xl border border-slate-800/75 bg-[#07172b] p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-500">{item.equipment.area ?? "Maintenance"} · {item.equipment.equipmentCode ?? "No asset code"}</p>
                  <h3 className="mt-1 text-sm font-semibold text-slate-100">{item.equipment.name}</h3>
                  <p className="mt-1 text-xs text-slate-400">{item.engineer.name}{item.engineer.discipline ? ` · ${item.engineer.discipline}` : ""}</p>
                </div>
                <div className="rounded-xl border border-blue-500/25 bg-blue-500/10 px-3 py-2 text-center">
                  <p className="text-[9px] font-semibold uppercase tracking-[0.1em] text-blue-300">Proposed</p>
                  <p className="mt-0.5 text-xl font-semibold text-blue-100">L{item.proposedLevel}</p>
                </div>
              </div>

              <div className="mt-3 grid gap-2 text-xs text-slate-400 sm:grid-cols-2">
                <div className="rounded-lg border border-slate-800/70 bg-slate-950/25 p-3">
                  <p className="text-[9px] font-semibold uppercase tracking-[0.1em] text-slate-600">Evidence reference</p>
                  <p className="mt-1 break-words">{item.evidenceReference || "No reference supplied"}</p>
                </div>
                <div className="rounded-lg border border-slate-800/70 bg-slate-950/25 p-3">
                  <p className="text-[9px] font-semibold uppercase tracking-[0.1em] text-slate-600">Engineer notes</p>
                  <p className="mt-1">{item.notes || "No notes supplied"}</p>
                </div>
              </div>

              <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-[10px] text-slate-600">Submitted {dateLabel(item.submittedAt)} · reviewer authority {item.reviewerAuthority.replaceAll("_", " ")}</p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => void review(item, "reject")}
                    disabled={savingId === item.id}
                    className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-red-500/25 bg-red-500/8 px-3 text-xs font-semibold text-red-200 hover:bg-red-500/12 disabled:opacity-50"
                  >
                    <XCircle className="h-4 w-4" />Reject
                  </button>
                  <button
                    type="button"
                    onClick={() => void review(item, "validate")}
                    disabled={savingId === item.id}
                    className="inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-emerald-600 px-3 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
                  >
                    {savingId === item.id ? <RefreshCw className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                    Validate level
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : null}
    </section>
  );
}
