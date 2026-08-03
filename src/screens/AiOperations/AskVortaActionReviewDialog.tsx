import {
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardCheck,
  Loader2,
  ShieldCheck,
  X,
} from "lucide-react";
import { Button } from "../../components/ui/button";
import {
  cancelAskVortaControlledDraft,
  confirmAskVortaControlledDraft,
  createAskVortaControlledDraft,
  loadAskVortaActionTargets,
  type AskVortaActionKind,
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

function initialKind(actionText: string): AskVortaActionKind {
  if (/spare|stock|inventory|part|replenish|order/i.test(actionText)) {
    return "spare_stock_review";
  }
  if (/handover|incoming shift|outgoing shift|next shift/i.test(actionText)) {
    return "handover_note";
  }
  return "work_request";
}

function kindLabel(kind: AskVortaActionKind): string {
  if (kind === "handover_note") return "Handover note";
  if (kind === "spare_stock_review") return "Spare stock review";
  return "Maintenance work request";
}

function targetLabel(kind: AskVortaActionKind): string {
  if (kind === "handover_note") return "Open work order";
  if (kind === "spare_stock_review") return "Spare component";
  return "Equipment";
}

function proposedRows(value: Record<string, unknown>): Array<[string, string]> {
  return Object.entries(value).map(([key, rawValue]) => [
    key
      .replace(/([A-Z])/g, " $1")
      .replace(/^./, (character) => character.toUpperCase()),
    rawValue === null || rawValue === undefined || rawValue === ""
      ? "Not set"
      : typeof rawValue === "object"
        ? JSON.stringify(rawValue)
        : String(rawValue),
  ]);
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
  const [kind, setKind] = useState<AskVortaActionKind>(() =>
    initialKind(action.action),
  );
  const [targets, setTargets] = useState<AskVortaActionTarget[]>([]);
  const [targetId, setTargetId] = useState("");
  const [loadingTargets, setLoadingTargets] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<AskVortaControlledDraft | null>(null);

  const now = useMemo(() => new Date(), []);
  const [shortText, setShortText] = useState(action.action.slice(0, 160));
  const [longText, setLongText] = useState(
    [action.expectedImpact, action.verification].filter(Boolean).join("\n\n"),
  );
  const [priorityCode, setPriorityCode] = useState(
    action.priority === "now"
      ? "1"
      : action.priority === "before_shift"
        ? "2"
        : action.priority === "this_week"
          ? "3"
          : "4",
  );
  const [requiredStartDate, setRequiredStartDate] = useState(
    now.toISOString().slice(0, 10),
  );
  const [requiredEndDate, setRequiredEndDate] = useState(
    new Date(now.getTime() + 24 * 60 * 60 * 1_000)
      .toISOString()
      .slice(0, 10),
  );
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
  const [requestedQuantity, setRequestedQuantity] = useState("1");
  const [stockReason, setStockReason] = useState(action.action);

  useEffect(() => {
    let active = true;
    setLoadingTargets(true);
    setError(null);
    setTargetId("");
    void loadAskVortaActionTargets(siteId, kind)
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
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Vorta could not load authorised action targets.",
        );
      })
      .finally(() => {
        if (active) setLoadingTargets(false);
      });
    return () => {
      active = false;
    };
  }, [conversationContext?.activeEquipment?.query, kind, siteId]);

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !working) onClose();
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [onClose, working]);

  const selectedTarget = targets.find((item) => item.id === targetId) ?? null;

  const proposedChanges = useMemo<Record<string, unknown>>(() => {
    if (kind === "handover_note") {
      return {
        windowStart: new Date(windowStart).toISOString(),
        windowEnd: new Date(windowEnd).toISOString(),
        outgoingNote: outgoingNote.trim(),
        nextAction: nextAction.trim(),
        ownerName: ownerName.trim(),
        dueAt: new Date(dueAt).toISOString(),
        expectedVersion: Number(selectedTarget?.snapshot.expectedVersion) || 0,
      };
    }
    if (kind === "spare_stock_review") {
      return {
        requestedQuantity: Number(requestedQuantity),
        reason: stockReason.trim(),
        ownerName: ownerName.trim(),
        dueAt: new Date(dueAt).toISOString(),
      };
    }
    return {
      shortText: shortText.trim(),
      longText: longText.trim(),
      priorityCode,
      requiredStartDate,
      requiredEndDate,
      breakdownIndicator: false,
    };
  }, [
    dueAt,
    kind,
    longText,
    nextAction,
    outgoingNote,
    ownerName,
    priorityCode,
    requestedQuantity,
    requiredEndDate,
    requiredStartDate,
    selectedTarget?.snapshot.expectedVersion,
    shortText,
    stockReason,
    windowEnd,
    windowStart,
  ]);

  const formValid = Boolean(
    selectedTarget &&
      (kind === "work_request"
        ? shortText.trim()
        : kind === "handover_note"
          ? outgoingNote.trim() && nextAction.trim() && ownerName.trim()
          : stockReason.trim() && ownerName.trim() && Number(requestedQuantity) > 0),
  );

  const prepareDraft = async () => {
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
        actionKind: kind,
        target: selectedTarget,
        proposedChanges,
      });
      setDraft(created);
      setStage("review");
    } catch (prepareError) {
      setError(
        prepareError instanceof Error
          ? prepareError.message
          : "Vorta could not prepare the controlled action.",
      );
    } finally {
      setWorking(false);
    }
  };

  const confirmDraft = async () => {
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
          : "Vorta could not confirm the controlled action.",
      );
    } finally {
      setWorking(false);
    }
  };

  const cancelDraft = async () => {
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
          : "Vorta could not cancel the controlled action.",
      );
    } finally {
      setWorking(false);
    }
  };

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
              Controlled action
            </div>
            <h2 id="ask-vorta-action-title" className="text-lg font-semibold text-white">
              {stage === "complete"
                ? "Action confirmed"
                : stage === "review"
                  ? "Review exact proposed changes"
                  : "Prepare an action for confirmation"}
            </h2>
            <p className="mt-1 text-sm text-slate-400">
              A normal Ask Vorta answer never changes maintenance records.
            </p>
          </div>
          <button
            type="button"
            onClick={stage === "review" ? cancelDraft : onClose}
            disabled={working}
            className="rounded-lg p-2 text-slate-400 hover:bg-white/10 hover:text-white disabled:opacity-50"
            aria-label="Close controlled action review"
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
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Ask Vorta recommendation</p>
                <p className="mt-2 text-sm font-semibold text-slate-100">{action.action}</p>
                <p className="mt-2 text-sm text-slate-400">Owner: {action.owner}</p>
                <p className="mt-1 text-sm text-slate-400">Expected impact: {action.expectedImpact}</p>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-1.5 text-sm text-slate-300">
                  <span>Action type</span>
                  <select
                    value={kind}
                    onChange={(event) => setKind(event.target.value as AskVortaActionKind)}
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-slate-100 outline-none focus:border-blue-500"
                  >
                    <option value="work_request">Maintenance work request</option>
                    <option value="handover_note">Handover note</option>
                    <option value="spare_stock_review">Spare stock review</option>
                  </select>
                </label>

                <label className="space-y-1.5 text-sm text-slate-300">
                  <span>{targetLabel(kind)}</span>
                  <select
                    value={targetId}
                    onChange={(event) => setTargetId(event.target.value)}
                    disabled={loadingTargets}
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-slate-100 outline-none focus:border-blue-500 disabled:opacity-50"
                  >
                    {loadingTargets ? <option>Loading authorised targets…</option> : null}
                    {!loadingTargets && targets.length === 0 ? <option>No authorised target found</option> : null}
                    {targets.map((target) => (
                      <option key={target.id} value={target.id}>{target.label}</option>
                    ))}
                  </select>
                  {selectedTarget?.detail ? (
                    <span className="block text-xs text-slate-500">{selectedTarget.detail}</span>
                  ) : null}
                </label>
              </div>

              {kind === "work_request" ? (
                <div className="space-y-4">
                  <label className="block space-y-1.5 text-sm text-slate-300">
                    <span>Request summary</span>
                    <input value={shortText} maxLength={160} onChange={(event) => setShortText(event.target.value)} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-slate-100 outline-none focus:border-blue-500" />
                  </label>
                  <label className="block space-y-1.5 text-sm text-slate-300">
                    <span>Request detail</span>
                    <textarea value={longText} maxLength={4000} rows={4} onChange={(event) => setLongText(event.target.value)} className="w-full resize-y rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-slate-100 outline-none focus:border-blue-500" />
                  </label>
                  <div className="grid gap-4 md:grid-cols-3">
                    <label className="space-y-1.5 text-sm text-slate-300"><span>Priority</span><select value={priorityCode} onChange={(event) => setPriorityCode(event.target.value)} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-slate-100"><option value="1">Critical</option><option value="2">High</option><option value="3">Medium</option><option value="4">Low</option></select></label>
                    <label className="space-y-1.5 text-sm text-slate-300"><span>Required start</span><input type="date" value={requiredStartDate} onChange={(event) => setRequiredStartDate(event.target.value)} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-slate-100" /></label>
                    <label className="space-y-1.5 text-sm text-slate-300"><span>Required end</span><input type="date" value={requiredEndDate} onChange={(event) => setRequiredEndDate(event.target.value)} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-slate-100" /></label>
                  </div>
                </div>
              ) : null}

              {kind === "handover_note" ? (
                <div className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <label className="space-y-1.5 text-sm text-slate-300"><span>Window start</span><input type="datetime-local" value={windowStart} onChange={(event) => setWindowStart(event.target.value)} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-slate-100" /></label>
                    <label className="space-y-1.5 text-sm text-slate-300"><span>Window end</span><input type="datetime-local" value={windowEnd} onChange={(event) => setWindowEnd(event.target.value)} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-slate-100" /></label>
                  </div>
                  <label className="block space-y-1.5 text-sm text-slate-300"><span>Outgoing note</span><textarea value={outgoingNote} rows={3} onChange={(event) => setOutgoingNote(event.target.value)} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-slate-100" /></label>
                  <label className="block space-y-1.5 text-sm text-slate-300"><span>Incoming-shift action</span><textarea value={nextAction} rows={3} onChange={(event) => setNextAction(event.target.value)} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-slate-100" /></label>
                  <div className="grid gap-4 md:grid-cols-2">
                    <label className="space-y-1.5 text-sm text-slate-300"><span>Owner</span><input value={ownerName} onChange={(event) => setOwnerName(event.target.value)} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-slate-100" /></label>
                    <label className="space-y-1.5 text-sm text-slate-300"><span>Due by</span><input type="datetime-local" value={dueAt} onChange={(event) => setDueAt(event.target.value)} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-slate-100" /></label>
                  </div>
                </div>
              ) : null}

              {kind === "spare_stock_review" ? (
                <div className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <label className="space-y-1.5 text-sm text-slate-300"><span>Quantity to review</span><input type="number" min="0.01" step="0.01" value={requestedQuantity} onChange={(event) => setRequestedQuantity(event.target.value)} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-slate-100" /></label>
                    <label className="space-y-1.5 text-sm text-slate-300"><span>Owner</span><input value={ownerName} onChange={(event) => setOwnerName(event.target.value)} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-slate-100" /></label>
                  </div>
                  <label className="block space-y-1.5 text-sm text-slate-300"><span>Review reason</span><textarea value={stockReason} rows={4} onChange={(event) => setStockReason(event.target.value)} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-slate-100" /></label>
                  <label className="block space-y-1.5 text-sm text-slate-300"><span>Due by</span><input type="datetime-local" value={dueAt} onChange={(event) => setDueAt(event.target.value)} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-slate-100" /></label>
                  <p className="text-xs text-slate-500">Confirmation creates a review task. It does not change the recorded stock quantity.</p>
                </div>
              ) : null}

              <div className="flex gap-3 rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-sm text-amber-100">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <p>Preparing the draft records the proposal and evidence only. The target maintenance record changes only after the separate confirmation step.</p>
              </div>
            </div>
          ) : null}

          {stage === "review" && draft && selectedTarget ? (
            <div className="space-y-5">
              <div className="rounded-xl border border-blue-500/25 bg-blue-500/10 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-blue-300">Draft created · source unchanged</p>
                <p className="mt-2 text-sm font-semibold text-white">{kindLabel(kind)}</p>
                <p className="mt-1 text-sm text-slate-300">Target: {selectedTarget.label}</p>
                <p className="mt-1 text-xs text-slate-500">Draft {draft.id} · version {draft.version}</p>
              </div>

              <div>
                <h3 className="mb-2 text-sm font-semibold text-white">Exact proposed changes</h3>
                <dl className="divide-y divide-slate-800 overflow-hidden rounded-xl border border-slate-800 bg-slate-950/60">
                  {proposedRows(draft.proposedChanges).map(([label, value]) => (
                    <div key={label} className="grid gap-1 px-4 py-3 md:grid-cols-[180px_1fr]">
                      <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</dt>
                      <dd className="break-words text-sm text-slate-200">{value}</dd>
                    </div>
                  ))}
                </dl>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Expected impact</p><p className="mt-2 text-sm text-slate-300">{draft.expectedImpact}</p></div>
                <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Verification</p><p className="mt-2 text-sm text-slate-300">{draft.verification}</p></div>
              </div>

              <div className="flex gap-3 rounded-xl border border-red-500/25 bg-red-500/10 p-3 text-sm text-red-100">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <p>Confirming applies this action to Vorta. Permissions, target state and draft version are checked again by the server.</p>
              </div>
            </div>
          ) : null}

          {stage === "complete" && draft ? (
            <div className="space-y-5 py-4 text-center">
              {draft.status === "confirmed" ? <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-400" /> : <AlertTriangle className="mx-auto h-12 w-12 text-red-400" />}
              <div><h3 className="text-xl font-semibold text-white">{draft.status === "confirmed" ? "Controlled action completed" : "Controlled action failed safely"}</h3><p className="mx-auto mt-2 max-w-xl text-sm text-slate-400">{draft.status === "confirmed" ? `${draft.resultType ?? "Action"} ${draft.resultId ?? ""} was created and linked to this Ask Vorta draft.` : draft.failureReason ?? "The target record was not changed."}</p></div>
              <div className="mx-auto max-w-xl rounded-xl border border-slate-800 bg-slate-950/60 p-4 text-left"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Audit evidence</p><p className="mt-2 text-sm text-slate-300">Draft {draft.id} · version {draft.version} · {draft.events.length} recorded event{draft.events.length === 1 ? "" : "s"}</p></div>
            </div>
          ) : null}
        </div>

        <footer className="flex flex-col-reverse gap-3 border-t border-slate-800 px-5 py-4 sm:flex-row sm:justify-end md:px-6">
          {stage === "edit" ? (
            <><Button type="button" variant="outline" onClick={onClose} disabled={working}>Cancel</Button><Button type="button" onClick={() => void prepareDraft()} disabled={!formValid || loadingTargets || working}>{working ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ClipboardCheck className="mr-2 h-4 w-4" />}Review exact changes</Button></>
          ) : null}
          {stage === "review" ? (
            <><Button type="button" variant="outline" onClick={() => void cancelDraft()} disabled={working}>Cancel draft</Button><Button type="button" onClick={() => void confirmDraft()} disabled={working} className="bg-red-600 text-white hover:bg-red-500">{working ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2 h-4 w-4" />}Confirm controlled action</Button></>
          ) : null}
          {stage === "complete" ? <Button type="button" onClick={onClose}>Close</Button> : null}
        </footer>
      </section>
    </div>
  );
}
