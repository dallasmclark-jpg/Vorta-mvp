import {
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  ShieldCheck,
  X,
} from "lucide-react";
import { Button } from "../../components/ui/button";
import {
  cancelAskVortaControlledDraft,
  confirmAskVortaControlledDraft,
  createAskVortaControlledDraft,
  loadAskVortaHandoverTargets,
  type AskVortaActionReviewContext,
  type AskVortaActionTarget,
  type AskVortaControlledDraft,
} from "./askVortaControlledActions";

interface AskVortaActionReviewDialogProps
  extends AskVortaActionReviewContext {
  onClose: () => void;
}

type DialogStage = "edit" | "review" | "complete";

function localDateTime(date: Date): string {
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60_000)
    .toISOString()
    .slice(0, 16);
}

function validDateTime(value: string): boolean {
  return Boolean(value) && Number.isFinite(new Date(value).getTime());
}

function toIso(value: string): string {
  if (!validDateTime(value)) {
    throw new Error("A valid date and time is required.");
  }
  return new Date(value).toISOString();
}

function displayValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "Not set";
  if (typeof value === "string" && Number.isFinite(new Date(value).getTime())) {
    return new Intl.DateTimeFormat("en-GB", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value));
  }
  return String(value);
}

export function AskVortaActionReviewDialog({
  siteId,
  responseId,
  action,
  conversationContext,
  evidence,
  sources,
  onClose,
}: AskVortaActionReviewDialogProps) {
  const [stage, setStage] = useState<DialogStage>("edit");
  const [targets, setTargets] = useState<AskVortaActionTarget[]>([]);
  const [targetId, setTargetId] = useState("");
  const [loadingTargets, setLoadingTargets] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<AskVortaControlledDraft | null>(null);

  const now = useMemo(() => new Date(), []);
  const [outgoingNote, setOutgoingNote] = useState(
    evidence[0] || action.expectedImpact,
  );
  const [nextAction, setNextAction] = useState(action.action);
  const [ownerName, setOwnerName] = useState(action.owner);
  const [windowStart, setWindowStart] = useState(
    localDateTime(new Date(now.getTime() - 12 * 60 * 60 * 1_000)),
  );
  const [windowEnd, setWindowEnd] = useState(localDateTime(now));
  const [dueAt, setDueAt] = useState(
    localDateTime(new Date(now.getTime() + 4 * 60 * 60 * 1_000)),
  );

  useEffect(() => {
    let active = true;
    setLoadingTargets(true);
    setError(null);

    void loadAskVortaHandoverTargets(siteId)
      .then((items) => {
        if (!active) return;
        setTargets(items);
        const equipmentQuery =
          conversationContext?.activeEquipment?.query?.toLowerCase() ?? "";
        const preferred = equipmentQuery
          ? items.find((item) =>
              `${item.label} ${item.detail}`.toLowerCase().includes(equipmentQuery),
            )
          : undefined;
        setTargetId(preferred?.id ?? items[0]?.id ?? "");
      })
      .catch((loadError) => {
        if (!active) return;
        setTargets([]);
        setTargetId("");
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Vorta could not load authorised handover targets.",
        );
      })
      .finally(() => {
        if (active) setLoadingTargets(false);
      });

    return () => {
      active = false;
    };
  }, [conversationContext?.activeEquipment?.query, siteId]);

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || working) return;
      if (stage === "review" && draft?.status === "draft") {
        void cancelDraft();
        return;
      }
      onClose();
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  });

  const selectedTarget = targets.find((item) => item.id === targetId) ?? null;

  const formValid = Boolean(
    selectedTarget &&
      outgoingNote.trim() &&
      nextAction.trim() &&
      ownerName.trim() &&
      validDateTime(windowStart) &&
      validDateTime(windowEnd) &&
      validDateTime(dueAt) &&
      new Date(windowStart).getTime() <= new Date(windowEnd).getTime(),
  );

  const proposedChanges = useMemo<Record<string, unknown>>(() => ({
    windowStart: validDateTime(windowStart) ? new Date(windowStart).toISOString() : "",
    windowEnd: validDateTime(windowEnd) ? new Date(windowEnd).toISOString() : "",
    outgoingNote: outgoingNote.trim(),
    nextAction: nextAction.trim(),
    ownerName: ownerName.trim(),
    dueAt: validDateTime(dueAt) ? new Date(dueAt).toISOString() : "",
    expectedVersion: Number(selectedTarget?.snapshot.expectedVersion) || 0,
  }), [
    dueAt,
    nextAction,
    outgoingNote,
    ownerName,
    selectedTarget?.snapshot.expectedVersion,
    windowEnd,
    windowStart,
  ]);

  const prepareDraft = async (): Promise<void> => {
    if (!selectedTarget || !formValid) return;
    setWorking(true);
    setError(null);

    try {
      const created = await createAskVortaControlledDraft({
        siteId,
        responseId,
        action,
        conversationContext,
        evidence,
        sources,
        target: selectedTarget,
        proposedChanges: {
          ...proposedChanges,
          windowStart: toIso(windowStart),
          windowEnd: toIso(windowEnd),
          dueAt: toIso(dueAt),
        },
      });
      setDraft(created);
      setStage("review");
    } catch (prepareError) {
      setError(
        prepareError instanceof Error
          ? prepareError.message
          : "Vorta could not prepare the handover action.",
      );
    } finally {
      setWorking(false);
    }
  };

  const confirmDraft = async (): Promise<void> => {
    if (!draft) return;
    setWorking(true);
    setError(null);

    try {
      const confirmed = await confirmAskVortaControlledDraft(draft);
      setDraft(confirmed);
      setStage("complete");
    } catch (confirmError) {
      setError(
        confirmError instanceof Error
          ? confirmError.message
          : "The handover action failed closed.",
      );
    } finally {
      setWorking(false);
    }
  };

  const cancelDraft = async (): Promise<void> => {
    if (!draft || draft.status !== "draft") {
      onClose();
      return;
    }

    setWorking(true);
    setError(null);
    try {
      await cancelAskVortaControlledDraft(draft);
      onClose();
    } catch (cancelError) {
      setError(
        cancelError instanceof Error
          ? cancelError.message
          : "Vorta could not cancel the handover action.",
      );
    } finally {
      setWorking(false);
    }
  };

  const reviewRows: Array<[string, unknown]> = [
    ["Work order", selectedTarget?.label],
    ["Window start", proposedChanges.windowStart],
    ["Window end", proposedChanges.windowEnd],
    ["Outgoing note", proposedChanges.outgoingNote],
    ["Incoming-shift action", proposedChanges.nextAction],
    ["Owner", proposedChanges.ownerName],
    ["Due by", proposedChanges.dueAt],
  ];

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/75 p-3 backdrop-blur-sm md:p-6">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="ask-vorta-action-title"
        className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-slate-700 bg-[#11151d] shadow-2xl"
      >
        <header className="flex items-start justify-between gap-4 border-b border-slate-800 px-5 py-4 md:px-6">
          <div>
            <div className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-blue-300">
              <ShieldCheck className="h-4 w-4" />
              Vorta shift-handover action
            </div>
            <h2 id="ask-vorta-action-title" className="text-lg font-semibold text-white">
              {stage === "complete"
                ? "Handover action confirmed"
                : stage === "review"
                  ? "Review exact proposed handover"
                  : "Prepare a handover action for confirmation"}
            </h2>
            <p className="mt-1 text-sm text-slate-400">
              Vorta remains read-only from SAP. This cannot create a maintenance request, notification, work order or stock record.
            </p>
          </div>
          <button
            type="button"
            onClick={stage === "review" ? () => void cancelDraft() : onClose}
            disabled={working}
            className="rounded-lg p-2 text-slate-400 hover:bg-white/10 hover:text-white disabled:opacity-50"
            aria-label="Close handover action review"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="overflow-y-auto px-5 py-5 md:px-6">
          {error ? (
            <div className="mb-4 flex gap-3 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200" role="alert">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          ) : null}

          {stage === "edit" ? (
            <div className="space-y-5">
              <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Ask Vorta recommendation
                </p>
                <p className="mt-2 text-sm font-semibold text-slate-100">{action.action}</p>
                <p className="mt-2 text-sm text-slate-400">Owner: {action.owner}</p>
                <p className="mt-1 text-sm text-slate-400">
                  Expected impact: {action.expectedImpact}
                </p>
              </div>

              <label className="block space-y-1.5 text-sm text-slate-300">
                <span>Open work order</span>
                <select
                  value={targetId}
                  onChange={(event) => setTargetId(event.target.value)}
                  disabled={loadingTargets}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-slate-100 outline-none focus:border-blue-500 disabled:opacity-50"
                >
                  {loadingTargets ? <option>Loading authorised targets…</option> : null}
                  {!loadingTargets && targets.length === 0 ? (
                    <option>No eligible open work order found</option>
                  ) : null}
                  {targets.map((target) => (
                    <option key={target.id} value={target.id}>{target.label}</option>
                  ))}
                </select>
                {selectedTarget?.detail ? (
                  <span className="block text-xs text-slate-500">{selectedTarget.detail}</span>
                ) : null}
              </label>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-1.5 text-sm text-slate-300">
                  <span>Window start</span>
                  <input
                    type="datetime-local"
                    value={windowStart}
                    onChange={(event) => setWindowStart(event.target.value)}
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-slate-100"
                  />
                </label>
                <label className="space-y-1.5 text-sm text-slate-300">
                  <span>Window end</span>
                  <input
                    type="datetime-local"
                    value={windowEnd}
                    onChange={(event) => setWindowEnd(event.target.value)}
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-slate-100"
                  />
                </label>
              </div>

              <label className="block space-y-1.5 text-sm text-slate-300">
                <span>Outgoing note</span>
                <textarea
                  value={outgoingNote}
                  rows={4}
                  onChange={(event) => setOutgoingNote(event.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-slate-100"
                />
              </label>

              <label className="block space-y-1.5 text-sm text-slate-300">
                <span>Incoming-shift action</span>
                <textarea
                  value={nextAction}
                  rows={4}
                  onChange={(event) => setNextAction(event.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-slate-100"
                />
              </label>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-1.5 text-sm text-slate-300">
                  <span>Owner</span>
                  <input
                    value={ownerName}
                    onChange={(event) => setOwnerName(event.target.value)}
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-slate-100"
                  />
                </label>
                <label className="space-y-1.5 text-sm text-slate-300">
                  <span>Due by</span>
                  <input
                    type="datetime-local"
                    value={dueAt}
                    onChange={(event) => setDueAt(event.target.value)}
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-slate-100"
                  />
                </label>
              </div>

              {validDateTime(windowStart) && validDateTime(windowEnd) &&
              new Date(windowStart).getTime() > new Date(windowEnd).getTime() ? (
                <p className="text-sm text-amber-300">Window end must be after window start.</p>
              ) : null}
            </div>
          ) : null}

          {stage === "review" ? (
            <div className="space-y-5">
              <div className="rounded-xl border border-amber-500/25 bg-amber-500/10 p-4 text-sm text-amber-100">
                Confirming writes only the Vorta shift-handover action below. It does not change SAP or create a parallel maintenance request.
              </div>
              <dl className="divide-y divide-slate-800 overflow-hidden rounded-xl border border-slate-800 bg-slate-950/60">
                {reviewRows.map(([label, value]) => (
                  <div key={label} className="grid gap-1 px-4 py-3 md:grid-cols-[180px_1fr] md:gap-4">
                    <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</dt>
                    <dd className="whitespace-pre-wrap text-sm text-slate-200">{displayValue(value)}</dd>
                  </div>
                ))}
              </dl>
              <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Verification</p>
                <p className="mt-2 text-sm text-slate-300">{action.verification}</p>
              </div>
            </div>
          ) : null}

          {stage === "complete" ? (
            <div className="flex flex-col items-center py-8 text-center">
              <CheckCircle2 className="h-12 w-12 text-emerald-400" />
              <h3 className="mt-4 text-lg font-semibold text-white">Handover action saved</h3>
              <p className="mt-2 max-w-xl text-sm leading-6 text-slate-400">
                Vorta recorded the confirmed handover action and audit evidence. SAP remains unchanged.
              </p>
              {draft?.resultId ? (
                <p className="mt-3 text-xs text-slate-500">Action reference: {draft.resultId}</p>
              ) : null}
            </div>
          ) : null}
        </div>

        <footer className="flex flex-wrap justify-end gap-3 border-t border-slate-800 px-5 py-4 md:px-6">
          {stage === "edit" ? (
            <>
              <Button type="button" variant="outline" onClick={onClose} disabled={working}>
                Cancel
              </Button>
              <Button type="button" onClick={() => void prepareDraft()} disabled={!formValid || working}>
                {working ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Review exact changes
              </Button>
            </>
          ) : null}

          {stage === "review" ? (
            <>
              <Button type="button" variant="outline" onClick={() => void cancelDraft()} disabled={working}>
                Cancel draft
              </Button>
              <Button type="button" onClick={() => void confirmDraft()} disabled={working}>
                {working ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Confirm handover action
              </Button>
            </>
          ) : null}

          {stage === "complete" ? (
            <Button type="button" onClick={onClose}>Close</Button>
          ) : null}
        </footer>
      </section>
    </div>
  );
}
