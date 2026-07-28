from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    file_path = Path(path)
    text = file_path.read_text()
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"Expected one match in {path}, found {count}: {old[:100]!r}")
    file_path.write_text(text.replace(old, new, 1))


# ---------------------------------------------------------------------------
# VOR-011 semantic group frame hooks
# ---------------------------------------------------------------------------
replace_once(
    "src/screens/AiOperations/sections/DashboardOverviewSection/DashboardOverviewSection.tsx",
    '<Card className="w-full rounded-xl border border-gray-800 bg-[#141820] shadow-none">',
    '<Card data-vorta-group-frame="true" className="w-full rounded-xl border border-gray-800 bg-[#141820] shadow-none">',
)

replace_once(
    "src/screens/ShiftHandover/ShiftHandoverSection.tsx",
    '<section className="rounded-2xl border border-gray-800 bg-[#10151d] p-4 sm:p-5">',
    '<section data-vorta-group-frame="true" className="rounded-2xl border border-gray-800 bg-[#10151d] p-4 sm:p-5">',
)

# ---------------------------------------------------------------------------
# VOR-008 and VOR-013: fail-closed Spares evidence + mobile disclosure
# ---------------------------------------------------------------------------
spares_path = "src/screens/Equipment/EquipmentSpares.tsx"
replace_once(
    spares_path,
    '''  getCachedEquipmentIdentity,\n  getEquipmentComponents,\n  getEquipmentIdentityById,\n  getEquipmentRecommendedWorkQueue,\n} from "./equipmentService";''',
    '''  getCachedEquipmentIdentity,\n  getEquipmentIdentityById,\n} from "./equipmentService";''',
)
replace_once(
    spares_path,
    '''import type {\n  EquipmentComponentsResult,\n  EquipmentRecommendedWorkQueue,\n} from "./equipmentService";''',
    '''import type {\n  EquipmentComponentsResult,\n  EquipmentRecommendedWorkQueue,\n} from "./equipmentService";\nimport {\n  getVerifiedEquipmentComponents,\n  getVerifiedEquipmentWorkQueue,\n} from "./sparesIntelligenceService";''',
)
replace_once(
    spares_path,
    'type ExposureBand = "Critical" | "High" | "Medium" | "Covered";',
    'type ExposureBand = "Critical" | "High" | "Medium" | "Covered";\ntype SparesEvidenceState = "loading" | "ready" | "empty" | "error";',
)
replace_once(
    spares_path,
    '''  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);\n  const [isRefreshing, setIsRefreshing] = useState(false);\n  const [hasLoaded, setHasLoaded] = useState(false);\n  const [loadError, setLoadError] = useState<string | null>(null);''',
    '''  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);\n  const [componentsState, setComponentsState] = useState<SparesEvidenceState>("loading");\n  const [queueState, setQueueState] = useState<SparesEvidenceState>("loading");\n  const [componentsSourceUpdatedAt, setComponentsSourceUpdatedAt] = useState<string | null>(null);\n  const [queueCheckedAt, setQueueCheckedAt] = useState<string | null>(null);\n  const [isRefreshing, setIsRefreshing] = useState(false);\n  const [hasLoaded, setHasLoaded] = useState(false);\n  const [loadError, setLoadError] = useState<string | null>(null);''',
)
replace_once(
    spares_path,
    '''  const loadSparesIntelligence = useCallback(async () => {\n    setIsRefreshing(true);\n    setLoadError(null);\n\n    try {\n      const [identity, componentResult, queue] = await Promise.all([\n        getEquipmentIdentityById(resolvedId),\n        getEquipmentComponents(resolvedId),\n        getEquipmentRecommendedWorkQueue(resolvedId),\n      ]);\n\n      setEquipment(identity);\n      setComponents(componentResult);\n      setWorkQueue(queue);\n      setLastUpdated(new Date());\n      setHasLoaded(true);\n    } catch (error) {\n      console.error("Failed to load equipment spares intelligence", error);\n      setLoadError(\n        "Unable to refresh spares intelligence. Showing the latest available data.",\n      );\n      setHasLoaded(true);\n    } finally {\n      setIsRefreshing(false);\n    }\n  }, [resolvedId]);''',
    '''  const loadSparesIntelligence = useCallback(async () => {\n    setIsRefreshing(true);\n    setLoadError(null);\n    if (!hasLoaded) {\n      setComponentsState("loading");\n      setQueueState("loading");\n    }\n\n    const [identityResult, componentsResult, queueResult] = await Promise.allSettled([\n      getEquipmentIdentityById(resolvedId),\n      getVerifiedEquipmentComponents(resolvedId),\n      getVerifiedEquipmentWorkQueue(resolvedId),\n    ]);\n    const failures: string[] = [];\n\n    if (identityResult.status === "fulfilled") {\n      setEquipment(identityResult.value);\n    } else {\n      failures.push("Equipment identity could not be refreshed.");\n    }\n\n    if (componentsResult.status === "fulfilled") {\n      setComponents(componentsResult.value);\n      setComponentsSourceUpdatedAt(componentsResult.value.sourceUpdatedAt);\n      setComponentsState(\n        componentsResult.value.inventory.length > 0 ? "ready" : "empty",\n      );\n    } else {\n      setComponentsState("error");\n      failures.push(\n        componentsResult.reason instanceof Error\n          ? componentsResult.reason.message\n          : "Verified spares inventory could not be loaded.",\n      );\n    }\n\n    if (queueResult.status === "fulfilled") {\n      setWorkQueue(queueResult.value.queue);\n      setQueueCheckedAt(queueResult.value.checkedAt);\n      setQueueState(queueResult.value.queue ? "ready" : "empty");\n    } else {\n      setQueueState("error");\n      failures.push(\n        queueResult.reason instanceof Error\n          ? queueResult.reason.message\n          : "Verified spares intervention could not be loaded.",\n      );\n    }\n\n    setLastUpdated(new Date());\n    setHasLoaded(true);\n    setLoadError(\n      failures.length > 0\n        ? `${failures.join(" ")} Existing verified values remain visible where available; missing values are withheld.`\n        : null,\n    );\n    setIsRefreshing(false);\n  }, [hasLoaded, resolvedId]);''',
)
replace_once(
    spares_path,
    '''  const potentialReduction =\n    spareQueueAction?.calculatedReduction ??\n    Math.min(8, Math.max(2, components.stockSummary.outOfStock * 3));\n  const projectedRisk = clamp(currentRisk - potentialReduction);''',
    '''  const verifiedPotentialReduction =\n    spareQueueAction && spareQueueAction.calculatedReduction > 0\n      ? spareQueueAction.calculatedReduction\n      : null;\n  const riskProjectionVerified =\n    verifiedPotentialReduction !== null &&\n    Boolean(workQueue) &&\n    (queueState === "ready" || queueState === "error");\n  const projectedRisk = riskProjectionVerified\n    ? clamp(currentRisk - verifiedPotentialReduction)\n    : null;''',
)
replace_once(
    spares_path,
    '''  const lastUpdatedLabel = lastUpdated\n    ? new Intl.DateTimeFormat("en-GB", {\n        day: "2-digit",\n        month: "short",\n        year: "numeric",\n        hour: "2-digit",\n        minute: "2-digit",\n      }).format(lastUpdated)\n    : "Loading latest import";\n\n  const briefing =\n    topExposure && topExposure.exposureBand !== "Covered"\n      ? `${eq.name} has ${components.stockSummary.outOfStock} part${\n          components.stockSummary.outOfStock === 1 ? "" : "s"\n        } out of stock and ${components.stockSummary.lowStock} below target. ${\n          topExposure.name\n        } creates the highest current exposure because it is ${\n          topExposure.status.toLowerCase()\n        }, is rated ${topExposure.criticality.toLowerCase()} and has a ${\n          topExposure.leadDays\n        }-day replenishment lead time.`\n      : `${eq.name} currently has full critical-spares coverage. Vorta is monitoring target holdings, supplier lead times and equipment failure consequences for early deterioration.`;''',
    '''  const evidenceTimestamp =\n    componentsSourceUpdatedAt ?? queueCheckedAt ?? lastUpdated?.toISOString() ?? null;\n  const lastUpdatedLabel = evidenceTimestamp\n    ? new Intl.DateTimeFormat("en-GB", {\n        day: "2-digit",\n        month: "short",\n        year: "numeric",\n        hour: "2-digit",\n        minute: "2-digit",\n      }).format(new Date(evidenceTimestamp))\n    : "Evidence timestamp unavailable";\n  const inventoryUnavailable =\n    componentsState === "error" && components.inventory.length === 0;\n  const inventoryStale =\n    componentsState === "error" && components.inventory.length > 0;\n  const queueStale = queueState === "error" && Boolean(workQueue);\n\n  const briefing = inventoryUnavailable\n    ? `Verified spare-parts inventory is unavailable for ${eq.name}. No stock coverage, exposure or replenishment result is being substituted.`\n    : componentsState === "empty"\n      ? `No verified equipment-component stock records are configured for ${eq.name}. Risk effects are withheld until SAP inventory evidence is available.`\n      : topExposure && topExposure.exposureBand !== "Covered"\n        ? `${eq.name} has ${components.stockSummary.outOfStock} part${\n            components.stockSummary.outOfStock === 1 ? "" : "s"\n          } out of stock and ${components.stockSummary.lowStock} below target. ${\n            topExposure.name\n          } creates the highest current exposure because it is ${\n            topExposure.status.toLowerCase()\n          }, is rated ${topExposure.criticality.toLowerCase()} and has a ${\n            topExposure.leadDays\n          }-day replenishment lead time.`\n        : `${eq.name} currently has full verified critical-spares coverage. Vorta is monitoring target holdings, supplier lead times and equipment failure consequences for early deterioration.`;''',
)

mobile_card = '''        <Card\n          data-vorta-group-frame="true"\n          className="rounded-2xl border border-indigo-500/25 bg-transparent shadow-none xl:hidden"\n        >\n          <CardContent className="space-y-4 p-4">\n            <div className="flex flex-wrap items-center justify-between gap-2">\n              <Badge className="h-auto rounded bg-indigo-500/15 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-indigo-300 shadow-none">\n                Spares decision\n              </Badge>\n              <span className={`text-[10px] font-semibold ${\n                inventoryUnavailable || queueState === "error"\n                  ? "text-amber-300"\n                  : "text-slate-500"\n              }`}>\n                {inventoryStale || queueStale ? "Previous verified evidence" : lastUpdatedLabel}\n              </span>\n            </div>\n\n            <div>\n              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">\n                Highest exposure\n              </p>\n              <h2 className="mt-1 line-clamp-2 text-lg font-semibold text-slate-50">\n                {topExposure?.name ?? (inventoryUnavailable ? "Inventory evidence withheld" : "No exposed component")}\n              </h2>\n              <p className="mt-1 text-sm leading-5 text-slate-400">\n                {topExposure?.consequence ?? briefing}\n              </p>\n            </div>\n\n            <div className="grid grid-cols-2 gap-2">\n              <div className="rounded-xl border border-gray-800 bg-[#0d1117] p-3">\n                <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Required action</p>\n                <p className="mt-1 text-sm font-semibold text-slate-100">\n                  {topExposure?.recommendation ?? "No verified replenishment action"}\n                </p>\n                <p className="mt-1 text-[10px] text-slate-500">\n                  {topExposure ? `${formatCurrency(topExposure.gap * (topExposure.unitCost ?? 0))} stock gap` : "Stock values withheld"}\n                </p>\n              </div>\n              <div className="rounded-xl border border-gray-800 bg-[#0d1117] p-3">\n                <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Lead time</p>\n                <p className="mt-1 text-xl font-bold text-orange-300">\n                  {topExposure ? `${topExposure.leadDays}d` : "—"}\n                </p>\n                <p className="mt-1 text-[10px] text-slate-500">Supplier replenishment</p>\n              </div>\n            </div>\n\n            <div className={`rounded-xl border p-3 ${\n              riskProjectionVerified\n                ? "border-emerald-500/25 bg-emerald-500/[0.06]"\n                : "border-gray-800 bg-[#0d1117]"\n            }`}>\n              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Verified risk effect</p>\n              <p className="mt-1 text-lg font-bold text-slate-100">\n                {currentRisk}% <span className="mx-1 text-slate-600">→</span>{" "}\n                <span className={riskProjectionVerified ? "text-emerald-300" : "text-slate-400"}>\n                  {projectedRisk !== null ? `${projectedRisk}%` : "Withheld"}\n                </span>\n              </p>\n              <p className="mt-1 text-[10px] text-slate-500">\n                {riskProjectionVerified\n                  ? `${verifiedPotentialReduction} verified calculated points · checked ${lastUpdatedLabel}`\n                  : "No verified spare intervention is available. No estimate is included in operational risk."}\n              </p>\n            </div>\n\n            <details className="rounded-xl border border-gray-800 bg-[#10151d] p-3">\n              <summary className="min-h-11 cursor-pointer py-2 text-sm font-semibold text-blue-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60">\n                Supporting stock evidence\n              </summary>\n              <div className="grid grid-cols-2 gap-2 border-t border-gray-800 pt-3">\n                <div><Metric label="Target stock cover" value={inventoryUnavailable ? "—" : `${stockResilience}%`} tone={stockResilience >= 90 ? "text-emerald-300" : stockResilience >= 70 ? "text-yellow-300" : "text-red-300"} /></div>\n                <div><Metric label="Critical exposed" value={inventoryUnavailable ? "—" : criticalAtRisk.length} tone="text-orange-300" /></div>\n                <div><Metric label="Out of stock" value={inventoryUnavailable ? "—" : components.stockSummary.outOfStock} tone="text-red-300" /></div>\n                <div><Metric label="Below target" value={inventoryUnavailable ? "—" : rankedParts.filter((part) => part.gap > 0).length} tone="text-yellow-300" /></div>\n              </div>\n              <p className="mt-3 border-t border-gray-800 pt-3 text-xs leading-5 text-slate-400">{briefing}</p>\n            </details>\n\n            <div className="flex min-h-11 items-center gap-2 rounded-xl border border-gray-700 bg-[#0a0f16] px-3 focus-within:border-blue-500/60">\n              <Sparkles className="h-4 w-4 shrink-0 text-blue-400" />\n              <input\n                value={question}\n                onChange={(event) => setQuestion(event.target.value)}\n                onKeyDown={(event) => { if (event.key === "Enter") askVorta(); }}\n                placeholder={`Ask Vorta about ${eq.assetNumber} spare risk...`}\n                className="min-w-0 flex-1 bg-transparent text-sm text-slate-200 outline-none placeholder:text-slate-600"\n              />\n              <button type="button" onClick={askVorta} className="min-h-11 shrink-0 px-2 text-xs font-semibold text-blue-300">Ask</button>\n            </div>\n          </CardContent>\n        </Card>\n\n'''
replace_once(
    spares_path,
    '        <Card className="overflow-hidden rounded-2xl border border-indigo-500/25 bg-[linear-gradient(135deg,#131923_0%,#10151d_55%,#111525_100%)] shadow-none">',
    mobile_card + '        <Card data-vorta-group-frame="true" className="hidden overflow-hidden rounded-2xl border border-indigo-500/25 bg-[linear-gradient(135deg,#131923_0%,#10151d_55%,#111525_100%)] shadow-none xl:block">',
)
replace_once(
    spares_path,
    '''                    SAP IH01 · MB52 · equipment BOM · refreshed{" "}\n                    {lastUpdated ? "now" : "pending"}''',
    '''                    SAP IH01 · MB52 · equipment BOM · {\n                      inventoryStale ? "previous verified" : componentsState === "error" ? "unavailable" : "verified"\n                    } · {hasLoaded ? lastUpdatedLabel : "pending"}''',
)
replace_once(
    spares_path,
    '''                    <Metric\n                      label="Risk after action"\n                      value={`${projectedRisk}%`}\n                      note={`-${potentialReduction} calculated points`}\n                      tone="text-emerald-300"\n                    />''',
    '''                    <Metric\n                      label="Risk after action"\n                      value={projectedRisk !== null ? `${projectedRisk}%` : "Withheld"}\n                      note={\n                        riskProjectionVerified\n                          ? `-${verifiedPotentialReduction} verified calculated points`\n                          : "No verified spare intervention"\n                      }\n                      tone={riskProjectionVerified ? "text-emerald-300" : "text-slate-400"}\n                    />''',
)

# ---------------------------------------------------------------------------
# VOR-009: controlled Shift Handover workflow UI
# ---------------------------------------------------------------------------
handover_path = "src/screens/ShiftHandover/ShiftHandoverSection.tsx"
replace_once(
    handover_path,
    '''} from "./shiftHandoverService";''',
    '''} from "./shiftHandoverService";\nimport {\n  acknowledgeShiftHandoverAction,\n  carryForwardShiftHandoverAction,\n  loadShiftHandoverActions,\n  saveShiftHandoverAction,\n  type ShiftHandoverWorkflowAction,\n} from "./shiftHandoverWorkflowService";''',
)

control_panel = r'''
function toDateTimeLocal(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function HandoverControlPanel({
  item,
  workflow,
  dataMode,
  siteId,
  windowStart,
  windowEnd,
  onWorkflowChange,
}: {
  item: ShiftHandoverItem;
  workflow: ShiftHandoverWorkflowAction | null;
  dataMode: VortaDataMode;
  siteId: string | null;
  windowStart: string;
  windowEnd: string;
  onWorkflowChange: (action: ShiftHandoverWorkflowAction) => void;
}): JSX.Element {
  const [outgoingNote, setOutgoingNote] = useState(workflow?.outgoingNote ?? item.latestConfirmationText ?? "");
  const [nextAction, setNextAction] = useState(workflow?.nextAction ?? item.nextAction);
  const [ownerName, setOwnerName] = useState(workflow?.ownerName ?? item.assignedEngineer ?? "");
  const [dueAt, setDueAt] = useState(toDateTimeLocal(workflow?.dueAt ?? windowEnd));
  const [busy, setBusy] = useState<"save" | "acknowledge" | "carry" | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    setOutgoingNote(workflow?.outgoingNote ?? item.latestConfirmationText ?? "");
    setNextAction(workflow?.nextAction ?? item.nextAction);
    setOwnerName(workflow?.ownerName ?? item.assignedEngineer ?? "");
    setDueAt(toDateTimeLocal(workflow?.dueAt ?? windowEnd));
    setMessage(null);
  }, [item.id, item.assignedEngineer, item.latestConfirmationText, item.nextAction, windowEnd, workflow]);

  const completed = item.status === "completed";
  const liveControl = dataMode === "live" && Boolean(siteId);
  const editable = liveControl && !completed && (!workflow || workflow.status === "ready");

  const run = async (operation: "save" | "acknowledge" | "carry"): Promise<void> => {
    if (!siteId) return;
    setBusy(operation);
    setMessage(null);
    try {
      if (operation === "save") {
        if (!outgoingNote.trim() || !nextAction.trim() || !ownerName.trim() || !dueAt) {
          throw new Error("Note, next action, owner and due time are required.");
        }
        const saved = await saveShiftHandoverAction({
          siteId,
          workOrderId: item.id,
          windowStart,
          windowEnd,
          outgoingNote: outgoingNote.trim(),
          nextAction: nextAction.trim(),
          ownerName: ownerName.trim(),
          dueAt: new Date(dueAt).toISOString(),
          expectedVersion: workflow?.version ?? null,
        });
        onWorkflowChange(saved);
        setMessage("Handover control saved with an audit entry.");
      } else if (operation === "acknowledge" && workflow) {
        const acknowledged = await acknowledgeShiftHandoverAction(workflow.id, workflow.version);
        onWorkflowChange(acknowledged);
        setMessage("Incoming shift acknowledgement recorded.");
      } else if (operation === "carry" && workflow) {
        const nextStart = new Date(windowEnd);
        const nextEnd = new Date(nextStart.getTime() + 12 * 60 * 60 * 1000);
        const carried = await carryForwardShiftHandoverAction(
          workflow.id,
          workflow.version,
          nextStart.toISOString(),
          nextEnd.toISOString(),
          nextEnd.toISOString(),
        );
        onWorkflowChange(carried.current);
        setMessage(`Carried forward to the shift ending ${formatTimestamp(nextEnd.toISOString())}.`);
      }
    } catch (operationError) {
      setMessage(
        operationError instanceof Error
          ? operationError.message
          : "The handover control could not be updated. Refresh and retry.",
      );
    } finally {
      setBusy(null);
    }
  };

  if (completed) {
    return (
      <section className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.05] p-4">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-emerald-300">Handover control locked</p>
        <p className="mt-2 text-sm leading-6 text-slate-300">This work order is completed in SAP and cannot be reopened through handover.</p>
      </section>
    );
  }

  if (!liveControl) {
    return (
      <section className="rounded-xl border border-gray-800 bg-[#10151d] p-4">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Handover control</p>
        <p className="mt-2 text-sm leading-6 text-slate-400">Notes, ownership and acknowledgement are available only against an authorised live site.</p>
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-blue-500/25 bg-blue-500/[0.04] p-4" data-vorta-handover-control="true">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-blue-300">Controlled handover</p>
          <p className="mt-1 text-xs text-slate-500">SAP remains read-only. Vorta records accountability and acknowledgement.</p>
        </div>
        <span className="rounded-md border border-gray-700 bg-[#0d1117] px-2 py-1 text-[10px] font-semibold uppercase text-slate-300">
          {workflow?.status.replaceAll("_", " ") ?? "Not saved"}
        </span>
      </div>

      <div className="mt-4 grid gap-3">
        <label className="grid gap-1.5 text-xs text-slate-400">
          Outgoing shift note
          <textarea
            value={outgoingNote}
            onChange={(event) => setOutgoingNote(event.target.value)}
            readOnly={!editable}
            maxLength={1200}
            rows={3}
            className="rounded-xl border border-gray-700 bg-[#0d1117] px-3 py-2 text-sm leading-6 text-slate-200 outline-none focus:border-blue-500/60 read-only:opacity-70"
          />
        </label>
        <label className="grid gap-1.5 text-xs text-slate-400">
          Incoming shift next action
          <textarea
            value={nextAction}
            onChange={(event) => setNextAction(event.target.value)}
            readOnly={!editable}
            maxLength={800}
            rows={2}
            className="rounded-xl border border-gray-700 bg-[#0d1117] px-3 py-2 text-sm leading-6 text-slate-200 outline-none focus:border-blue-500/60 read-only:opacity-70"
          />
        </label>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="grid gap-1.5 text-xs text-slate-400">
            Accountable owner
            <input
              value={ownerName}
              onChange={(event) => setOwnerName(event.target.value)}
              readOnly={!editable}
              maxLength={160}
              className="min-h-11 rounded-xl border border-gray-700 bg-[#0d1117] px-3 text-sm text-slate-200 outline-none focus:border-blue-500/60 read-only:opacity-70"
            />
          </label>
          <label className="grid gap-1.5 text-xs text-slate-400">
            Due by
            <input
              type="datetime-local"
              value={dueAt}
              onChange={(event) => setDueAt(event.target.value)}
              readOnly={!editable}
              className="min-h-11 rounded-xl border border-gray-700 bg-[#0d1117] px-3 text-sm text-slate-200 outline-none focus:border-blue-500/60 read-only:opacity-70"
            />
          </label>
        </div>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        <button type="button" disabled={!editable || Boolean(busy)} onClick={() => void run("save")} className="min-h-11 rounded-xl bg-blue-600 px-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">
          {busy === "save" ? "Saving…" : workflow ? "Update handover" : "Save handover"}
        </button>
        <button type="button" disabled={!workflow || workflow.status !== "ready" || Boolean(busy)} onClick={() => void run("acknowledge")} className="min-h-11 rounded-xl border border-emerald-500/30 bg-emerald-500/[0.06] px-3 text-sm font-semibold text-emerald-200 disabled:cursor-not-allowed disabled:opacity-50">
          {busy === "acknowledge" ? "Recording…" : "Acknowledge"}
        </button>
        <button type="button" disabled={!workflow || !["ready", "acknowledged"].includes(workflow.status) || Boolean(busy)} onClick={() => void run("carry")} className="min-h-11 rounded-xl border border-amber-500/30 bg-amber-500/[0.06] px-3 text-sm font-semibold text-amber-200 disabled:cursor-not-allowed disabled:opacity-50">
          {busy === "carry" ? "Carrying…" : "Carry forward"}
        </button>
      </div>

      {message ? <p className="mt-3 text-xs leading-5 text-slate-300" role="status">{message}</p> : null}
      {workflow?.events.length ? (
        <details className="mt-4 border-t border-gray-800 pt-3">
          <summary className="min-h-11 cursor-pointer py-2 text-xs font-semibold text-blue-300">Audit trail ({workflow.events.length})</summary>
          <div className="space-y-2 pt-2">
            {workflow.events.slice(0, 5).map((event) => (
              <div key={event.id} className="flex items-center justify-between gap-3 text-xs text-slate-500">
                <span className="capitalize">{event.eventType.replaceAll("_", " ")} · v{event.actionVersion}</span>
                <span>{formatTimestamp(event.createdAt)}</span>
              </div>
            ))}
          </div>
        </details>
      ) : null}
    </section>
  );
}

'''
replace_once(
    handover_path,
    'function HandoverDetail({',
    control_panel + 'function HandoverDetail({',
)
replace_once(
    handover_path,
    '''function HandoverDetail({\n  item,\n  onClose,\n  showClose,\n}: {\n  item: ShiftHandoverItem;\n  onClose: () => void;\n  showClose: boolean;\n}): JSX.Element {''',
    '''function HandoverDetail({\n  item,\n  workflow,\n  dataMode,\n  siteId,\n  windowStart,\n  windowEnd,\n  onWorkflowChange,\n  onClose,\n  showClose,\n}: {\n  item: ShiftHandoverItem;\n  workflow: ShiftHandoverWorkflowAction | null;\n  dataMode: VortaDataMode;\n  siteId: string | null;\n  windowStart: string;\n  windowEnd: string;\n  onWorkflowChange: (action: ShiftHandoverWorkflowAction) => void;\n  onClose: () => void;\n  showClose: boolean;\n}): JSX.Element {''',
)
replace_once(
    handover_path,
    '''        <section className="rounded-xl border border-blue-500/25 bg-blue-500/[0.06] p-4">\n          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-blue-300">Incoming shift action</p>\n          <p className="mt-2 text-sm leading-6 text-slate-200">{item.nextAction}</p>\n        </section>''',
    '''        <section className="rounded-xl border border-blue-500/25 bg-blue-500/[0.06] p-4">\n          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-blue-300">Incoming shift action</p>\n          <p className="mt-2 text-sm leading-6 text-slate-200">{workflow?.nextAction ?? item.nextAction}</p>\n        </section>\n\n        <HandoverControlPanel\n          item={item}\n          workflow={workflow}\n          dataMode={dataMode}\n          siteId={siteId}\n          windowStart={windowStart}\n          windowEnd={windowEnd}\n          onWorkflowChange={onWorkflowChange}\n        />''',
)
replace_once(
    handover_path,
    '''  const [filtersOpen, setFiltersOpen] = useState(false);''',
    '''  const [filtersOpen, setFiltersOpen] = useState(false);\n  const [workflowActions, setWorkflowActions] = useState<Map<string, ShiftHandoverWorkflowAction>>(new Map());\n  const [workflowError, setWorkflowError] = useState<string | null>(null);''',
)
old_load = '''  const load = useCallback(async (refresh = false): Promise<void> => {\n    setLoading(true);\n    setError(null);\n    try {\n      const next = await loadShiftHandoverSnapshot(dataMode, refresh);\n      setSnapshot(next);\n      setSelectedId((current) => current && next.items.some((item) => item.id === current)\n        ? current\n        : next.items[0]?.id ?? null);\n    } catch (loadError) {\n      setSnapshot(null);\n      setSelectedId(null);\n      setError(loadError instanceof Error ? loadError.message : "Shift handover could not be loaded.");\n    } finally {\n      setLoading(false);\n    }\n  }, [dataMode]);'''
new_load = '''  const load = useCallback(async (refresh = false): Promise<void> => {\n    setLoading(true);\n    setError(null);\n    setWorkflowError(null);\n    try {\n      const next = await loadShiftHandoverSnapshot(dataMode, refresh);\n      setSnapshot(next);\n      setSelectedId((current) => current && next.items.some((item) => item.id === current)\n        ? current\n        : next.items[0]?.id ?? null);\n\n      if (dataMode === "live" && siteContext?.siteId) {\n        try {\n          setWorkflowActions(\n            await loadShiftHandoverActions(\n              siteContext.siteId,\n              next.window.start,\n              next.window.end,\n            ),\n          );\n        } catch (workflowLoadError) {\n          setWorkflowError(\n            workflowLoadError instanceof Error\n              ? workflowLoadError.message\n              : "Shift handover controls could not be loaded.",\n          );\n          if (!refresh) setWorkflowActions(new Map());\n        }\n      } else {\n        setWorkflowActions(new Map());\n      }\n    } catch (loadError) {\n      if (!refresh) {\n        setSnapshot(null);\n        setSelectedId(null);\n      }\n      setError(\n        `${loadError instanceof Error ? loadError.message : "Shift handover could not be loaded."}${\n          refresh ? " Previous verified evidence remains visible." : ""\n        }`,\n      );\n    } finally {\n      setLoading(false);\n    }\n  }, [dataMode, siteContext?.siteId]);'''
replace_once(handover_path, old_load, new_load)
replace_once(
    handover_path,
    '''  const openItem = (item: ShiftHandoverItem): void => {\n    setSelectedId(item.id);\n    if (compactDetail) setDetailOpen(true);\n  };''',
    '''  const openItem = (item: ShiftHandoverItem): void => {\n    setSelectedId(item.id);\n    if (compactDetail) setDetailOpen(true);\n  };\n\n  const updateWorkflow = useCallback((action: ShiftHandoverWorkflowAction): void => {\n    setWorkflowActions((current) => {\n      const next = new Map(current);\n      next.set(action.workOrderId, action);\n      return next;\n    });\n  }, []);''',
)
replace_once(
    handover_path,
    '''      {error ? (''',
    '''      {workflowError && snapshot ? (\n        <div role="status" className="rounded-xl border border-amber-500/25 bg-amber-500/[0.06] px-4 py-3 text-sm text-amber-200">\n          {workflowError} SAP evidence remains available; control actions are withheld until refreshed.\n        </div>\n      ) : null}\n\n      {error ? (''',
)
replace_once(
    handover_path,
    '''                  <HandoverDetail item={selectedItem} onClose={() => undefined} showClose={false} />''',
    '''                  <HandoverDetail\n                    item={selectedItem}\n                    workflow={workflowActions.get(selectedItem.id) ?? null}\n                    dataMode={dataMode}\n                    siteId={siteContext?.siteId ?? null}\n                    windowStart={snapshot.window.start}\n                    windowEnd={snapshot.window.end}\n                    onWorkflowChange={updateWorkflow}\n                    onClose={() => undefined}\n                    showClose={false}\n                  />''',
)
replace_once(
    handover_path,
    '''        {selectedItem ? <HandoverDetail item={selectedItem} onClose={() => setDetailOpen(false)} showClose /> : null}''',
    '''        {selectedItem && snapshot ? (\n          <HandoverDetail\n            item={selectedItem}\n            workflow={workflowActions.get(selectedItem.id) ?? null}\n            dataMode={dataMode}\n            siteId={siteContext?.siteId ?? null}\n            windowStart={snapshot.window.start}\n            windowEnd={snapshot.window.end}\n            onWorkflowChange={updateWorkflow}\n            onClose={() => setDetailOpen(false)}\n            showClose\n          />\n        ) : null}''',
)

print("Applied VOR-007 to VOR-013 focused implementation changes.")
