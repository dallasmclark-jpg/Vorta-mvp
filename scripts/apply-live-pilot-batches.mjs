import fs from "node:fs";

function replaceRequired(source, before, after, label) {
  const occurrences = source.split(before).length - 1;
  if (occurrences !== 1) {
    throw new Error(`${label}: expected exactly one match, found ${occurrences}`);
  }
  return source.replace(before, after);
}

function replaceAllRequired(source, before, after, minimum, label) {
  const occurrences = source.split(before).length - 1;
  if (occurrences < minimum) {
    throw new Error(`${label}: expected at least ${minimum} matches, found ${occurrences}`);
  }
  return source.split(before).join(after);
}

function patchFile(path, transform) {
  const source = fs.readFileSync(path, "utf8");
  const next = transform(source);
  if (next === source) throw new Error(`${path}: patch made no changes`);
  fs.writeFileSync(path, next);
}

patchFile("src/screens/Equipment/EquipmentLiveRoutes.tsx", (input) => {
  let source = input;
  source = replaceRequired(
    source,
    `import {
  LiveEquipmentCalibrationsView,
  LiveEquipmentNotificationsView,
  LiveEquipmentOverviewView,
  LiveEquipmentSkillsView,
  LiveEquipmentSparesView,
  LiveEquipmentUnavailableView,
  LiveEquipmentWorkOrdersView,
} from "./EquipmentLiveEvidenceViews";`,
    `import {
  LiveEquipmentCalibrationsView,
  LiveEquipmentNotificationsView,
  LiveEquipmentOverviewView,
  LiveEquipmentSkillsView,
  LiveEquipmentSparesView,
} from "./EquipmentLiveEvidenceViews";
import {
  LiveEquipmentDocumentViewerView,
  LiveEquipmentDocumentsView,
  LiveEquipmentHistoryView,
  LiveEquipmentWorkOrdersPilotView,
} from "./EquipmentPilotEvidenceViews";`,
    "live route imports",
  );

  source = replaceRequired(
    source,
    `  const load = useCallback(async (): Promise<void> => {
    if (mode !== "live" || !siteContext?.siteId || !equipmentId) return;
    setLoading(true);
    setState(await loadLiveEquipmentRecord(siteContext.siteId, equipmentId));
    setLoading(false);
  }, [equipmentId, mode, siteContext?.siteId]);`,
    `  const load = useCallback(async (): Promise<void> => {
    if (mode !== "live" || !siteContext?.siteId || !equipmentId) return;
    setLoading(true);
    try {
      setState(await loadLiveEquipmentRecord(siteContext.siteId, equipmentId));
    } catch (error) {
      setState({
        status: "unavailable",
        message:
          error instanceof Error
            ? error.message
            : "The active-site equipment record request failed.",
      });
    } finally {
      setLoading(false);
    }
  }, [equipmentId, mode, siteContext?.siteId]);`,
    "equipment detail boundary finally",
  );

  source = replaceRequired(
    source,
    `export function EquipmentWorkOrdersTrustedEntry(): JSX.Element {
  return <EquipmentDetailBoundary demo={<EquipmentWorkOrdersWithAiNavigation />} renderLive={(record) => <LiveEquipmentWorkOrdersView record={record} />} />;
}`,
    `export function EquipmentWorkOrdersTrustedEntry(): JSX.Element {
  return <EquipmentDetailBoundary demo={<EquipmentWorkOrdersWithAiNavigation />} renderLive={(record) => <LiveEquipmentWorkOrdersPilotView record={record} />} />;
}`,
    "live work orders route",
  );

  source = replaceRequired(
    source,
    `export function EquipmentHistoryTrustedEntry(): JSX.Element {
  return <EquipmentDetailBoundary demo={<EquipmentHistoryEntry />} renderLive={(record) => <LiveEquipmentUnavailableView record={record} activeTab="history" title="History" message="A site-scoped operational history contract has not yet been approved for live pilot use." />} />;
}`,
    `export function EquipmentHistoryTrustedEntry(): JSX.Element {
  return <EquipmentDetailBoundary demo={<EquipmentHistoryEntry />} renderLive={(record) => <LiveEquipmentHistoryView record={record} />} />;
}`,
    "live history route",
  );

  source = replaceRequired(
    source,
    `export function EquipmentDocumentsTrustedEntry(): JSX.Element {
  return <EquipmentDetailBoundary demo={<EquipmentDocumentsEntry />} renderLive={(record) => <LiveEquipmentUnavailableView record={record} activeTab="documents" title="Documents" message="Live document evidence remains withheld until the active-site document route is fully validated." />} />;
}`,
    `export function EquipmentDocumentsTrustedEntry(): JSX.Element {
  return <EquipmentDetailBoundary demo={<EquipmentDocumentsEntry />} renderLive={(record) => <LiveEquipmentDocumentsView record={record} />} />;
}`,
    "live documents route",
  );

  source = replaceRequired(
    source,
    `export function EquipmentDocumentViewerTrustedEntry(): JSX.Element {
  return <EquipmentDetailBoundary demo={<EquipmentDocumentViewer />} renderLive={(record) => <LiveEquipmentUnavailableView record={record} activeTab="documents" title="Document viewer" message="The requested live document has not passed the active-site evidence boundary." />} />;
}`,
    `export function EquipmentDocumentViewerTrustedEntry(): JSX.Element {
  return <EquipmentDetailBoundary demo={<EquipmentDocumentViewer />} renderLive={(record) => <LiveEquipmentDocumentViewerView record={record} />} />;
}`,
    "live document viewer route",
  );

  return source;
});

patchFile("src/screens/Equipment/EquipmentLiveEvidenceViews.tsx", (input) => {
  let source = input;
  source = replaceRequired(
    source,
    `import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";`,
    `import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";`,
    "useEvidence useRef import",
  );

  source = replaceRequired(
    source,
    `function useEvidence<T>(loader: () => Promise<LiveDataState<T>>): {
  state: LiveDataState<T> | null;
  loading: boolean;
  reload: () => void;
} {
  const [state, setState] = useState<LiveDataState<T> | null>(null);
  const [loading, setLoading] = useState(true);
  const reload = useCallback(() => {
    setLoading(true);
    void loader().then((next) => {
      setState(next);
      setLoading(false);
    });
  }, [loader]);
  useEffect(() => reload(), [reload]);
  return { state, loading, reload };
}`,
    `function useEvidence<T>(loader: () => Promise<LiveDataState<T>>): {
  state: LiveDataState<T> | null;
  loading: boolean;
  reload: () => void;
} {
  const requestVersion = useRef(0);
  const [state, setState] = useState<LiveDataState<T> | null>(null);
  const [loading, setLoading] = useState(true);
  const reload = useCallback(() => {
    const request = ++requestVersion.current;
    setLoading(true);
    void (async () => {
      try {
        const next = await loader();
        if (request === requestVersion.current) setState(next);
      } catch (error) {
        if (request === requestVersion.current) {
          setState({
            status: "unavailable",
            message:
              error instanceof Error
                ? error.message
                : "The verified evidence request failed.",
          });
        }
      } finally {
        if (request === requestVersion.current) setLoading(false);
      }
    })();
  }, [loader]);
  useEffect(() => {
    reload();
    return () => {
      requestVersion.current += 1;
    };
  }, [reload]);
  return { state, loading, reload };
}`,
    "useEvidence rejection and stale request protection",
  );
  return source;
});

patchFile("src/screens/Equipment/EquipmentWorkOrders.tsx", (input) => {
  let source = input;

  source = replaceRequired(
    source,
    `type RegisterView = "OPEN" | "COMPLETED";
type WorkFilter =`,
    `type RegisterView = "OPEN" | "COMPLETED";
type EvidenceSourceStatus = "loading" | "available" | "unavailable";
interface WorkOrderSourceState {
  identity: EvidenceSourceStatus;
  workOrders: EvidenceSourceStatus;
  riskQueue: EvidenceSourceStatus;
  schedules: EvidenceSourceStatus;
}
type WorkFilter =`,
    "work order source-state types",
  );

  source = replaceRequired(
    source,
    `function parseDate(value: string): Date | null {
  if (!value) return null;
  const date = new Date(\`${value}T00:00:00\`);
  return Number.isNaN(date.getTime()) ? null : date;
}`,
    `function parseDate(value: string): Date | null {
  if (!value) return null;
  const date = new Date(\`${value}T00:00:00\`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function isWorkOrderCompleted(workOrder: WorkOrder): boolean {
  return /completed|closed|cancelled|canceled/i.test(workOrder.status);
}

function isWorkOrderOverdue(workOrder: WorkOrder, today: Date): boolean {
  if (isWorkOrderCompleted(workOrder)) return false;
  const dueDate = parseDate(workOrder.dueDate);
  return Boolean(dueDate && dueDate < today);
}`,
    "derived overdue helper",
  );

  source = replaceRequired(
    source,
    `  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [copied, setCopied] = useState<string | null>(null);`,
    `  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [sourceState, setSourceState] = useState<WorkOrderSourceState>({
    identity: "loading",
    workOrders: "loading",
    riskQueue: "loading",
    schedules: "loading",
  });`,
    "work order source state",
  );

  source = replaceRequired(
    source,
    `  const loadWorkOrderIntelligence = useCallback(async () => {
    setLoading(true);
    setLoadError(null);

    try {
      const [identity, workOrders, queue, schedules] = await Promise.all([
        getEquipmentIdentityById(resolvedId),
        getEquipmentWorkOrders(resolvedId),
        getEquipmentRecommendedWorkQueue(resolvedId),
        getEquipmentMaintenanceSchedules(resolvedId, "pm"),
      ]);

      setEquipment(identity);
      setOpenWorkOrders(workOrders.open as WorkOrder[]);
      setCompletedWorkOrders(workOrders.completed as CompletedWorkOrder[]);
      setRiskQueue(queue);
      setPmSchedules(schedules);
      setLastUpdated(new Date());
    } catch (error) {
      console.error("Failed to load equipment work-order intelligence", error);
      setPmSchedules([]);
      setLoadError(
        "Work-order intelligence could not be refreshed. Showing the latest available equipment data.",
      );
    } finally {
      setLoading(false);
    }
  }, [resolvedId]);`,
    `  const loadWorkOrderIntelligence = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    setSourceState({
      identity: "loading",
      workOrders: "loading",
      riskQueue: "loading",
      schedules: "loading",
    });

    try {
      const [identityResult, workOrdersResult, queueResult, schedulesResult] =
        await Promise.allSettled([
          getEquipmentIdentityById(resolvedId),
          getEquipmentWorkOrders(resolvedId),
          getEquipmentRecommendedWorkQueue(resolvedId),
          getEquipmentMaintenanceSchedules(resolvedId, "pm"),
        ]);

      const failures: string[] = [];
      const nextSourceState: WorkOrderSourceState = {
        identity: identityResult.status === "fulfilled" ? "available" : "unavailable",
        workOrders: workOrdersResult.status === "fulfilled" ? "available" : "unavailable",
        riskQueue: queueResult.status === "fulfilled" ? "available" : "unavailable",
        schedules: schedulesResult.status === "fulfilled" ? "available" : "unavailable",
      };

      if (identityResult.status === "fulfilled") setEquipment(identityResult.value);
      else failures.push("equipment identity");

      if (workOrdersResult.status === "fulfilled") {
        setOpenWorkOrders(workOrdersResult.value.open as WorkOrder[]);
        setCompletedWorkOrders(workOrdersResult.value.completed as CompletedWorkOrder[]);
        setLastUpdated(new Date());
      } else failures.push("work orders");

      if (queueResult.status === "fulfilled") setRiskQueue(queueResult.value);
      else failures.push("risk-reduction queue");

      if (schedulesResult.status === "fulfilled") setPmSchedules(schedulesResult.value);
      else failures.push("PM schedules");

      setSourceState(nextSourceState);
      if (failures.length) {
        setLoadError(
          \`Some evidence is unavailable: \${failures.join(", ")}. Successfully loaded evidence remains visible and unavailable metrics are not scored.\`,
        );
      }
    } catch (error) {
      console.error("Failed to coordinate equipment work-order intelligence", error);
      setSourceState({
        identity: "unavailable",
        workOrders: "unavailable",
        riskQueue: "unavailable",
        schedules: "unavailable",
      });
      setLoadError("Work-order evidence could not be verified. Existing values have been retained but are not scored as current.");
    } finally {
      setLoading(false);
    }
  }, [resolvedId]);`,
    "independent work-order evidence loading",
  );

  source = replaceRequired(
    source,
    `  const overdueWorkOrders = useMemo(
    () => openWorkOrders.filter((workOrder) => workOrder.overdue),
    [openWorkOrders],
  );`,
    `  const overdueWorkOrders = useMemo(
    () => openWorkOrders.filter((workOrder) => isWorkOrderOverdue(workOrder, today)),
    [openWorkOrders, today],
  );`,
    "defensive overdue collection",
  );

  source = replaceRequired(
    source,
    `          priorityRank(workOrder.priority) * 20 +
          Number(Boolean(workOrder.overdue)) * 28 +`,
    `          priorityRank(workOrder.priority) * 20 +
          Number(isWorkOrderOverdue(workOrder, today)) * 28 +`,
    "defensive overdue exposure score",
  );

  source = replaceRequired(
    source,
    `    [openWorkOrders],
  );

  const priorityCounts`,
    `    [openWorkOrders, today],
  );

  const priorityCounts`,
    "exposure today dependency",
  );

  source = replaceRequired(
    source,
    `  const assignmentReadiness =
    openWorkOrders.length > 0
      ? Math.round(
          ((openWorkOrders.length - unassignedWorkOrders.length) /
            openWorkOrders.length) *
            100,
        )
      : 100;
  const partsReadiness =
    openWorkOrders.length > 0
      ? Math.round(
          ((openWorkOrders.length - waitingPartsWorkOrders.length) /
            openWorkOrders.length) *
            100,
        )
      : 100;
  const scheduleReadiness =
    openWorkOrders.length > 0
      ? Math.round(
          ((openWorkOrders.length - overdueWorkOrders.length) /
            openWorkOrders.length) *
            100,
        )
      : 100;
  const evidenceReadiness =
    openWorkOrders.length > 0
      ? Math.round(
          (openWorkOrders.filter(
            (workOrder) =>
              Boolean(workOrder.description) && Boolean(workOrder.dueDate),
          ).length /
            openWorkOrders.length) *
            100,
        )
      : 100;
  const executionReadiness = Math.round(
    (assignmentReadiness +
      partsReadiness +
      scheduleReadiness +
      evidenceReadiness) /
      4,
  );`,
    `  const workOrdersAvailable = sourceState.workOrders === "available";
  const assignmentReadiness =
    workOrdersAvailable && openWorkOrders.length > 0
      ? Math.round(
          ((openWorkOrders.length - unassignedWorkOrders.length) /
            openWorkOrders.length) *
            100,
        )
      : null;
  const partsReadiness =
    workOrdersAvailable && openWorkOrders.length > 0
      ? Math.round(
          ((openWorkOrders.length - waitingPartsWorkOrders.length) /
            openWorkOrders.length) *
            100,
        )
      : null;
  const scheduleReadiness =
    workOrdersAvailable && openWorkOrders.length > 0
      ? Math.round(
          ((openWorkOrders.length - overdueWorkOrders.length) /
            openWorkOrders.length) *
            100,
        )
      : null;
  const evidenceReadiness =
    workOrdersAvailable && openWorkOrders.length > 0
      ? Math.round(
          (openWorkOrders.filter(
            (workOrder) =>
              Boolean(workOrder.description) && Boolean(workOrder.dueDate),
          ).length /
            openWorkOrders.length) *
            100,
        )
      : null;
  const executionReadiness =
    assignmentReadiness === null ||
    partsReadiness === null ||
    scheduleReadiness === null ||
    evidenceReadiness === null
      ? null
      : Math.round(
          (assignmentReadiness +
            partsReadiness +
            scheduleReadiness +
            evidenceReadiness) /
            4,
        );`,
    "truth-safe readiness calculations",
  );

  source = replaceRequired(
    source,
    `  const briefing = highestExecutionExposure
    ? \`${"${equipment?.name ?? \"This equipment\"}"} has ${"${openWorkOrders.length}"} open SAP work order${"${\n        openWorkOrders.length === 1 ? \"\" : \"s\"\n      }"}, including ${"${overdueWorkOrders.length}"} overdue and ${"${waitingPartsWorkOrders.length}"} waiting for parts. ${"${\n        highestExecutionExposure.id\n      }"} creates the highest current execution exposure because it is ${"${\n        highestExecutionExposure.priority.toLowerCase()\n      }"} priority, ${"${\n        highestExecutionExposure.overdue\n          ? \"overdue\"\n          : highestExecutionExposure.status.toLowerCase()\n      }"} and is assigned to ${"${\n        highestExecutionExposure.engineer === \"—\"\n          ? \"no engineer\"\n          : highestExecutionExposure.engineer\n      }"}.\`
    : \`${"${equipment?.name ?? \"This equipment\"}"} has no open SAP work orders. Vorta is continuing to monitor imported maintenance demand, completion outcomes and emerging repeat-failure evidence.\`;`,
    `  const briefing = !workOrdersAvailable
    ? \`Work-order evidence for ${"${equipment?.name ?? \"this equipment\"}"} is unavailable. Vorta has retained any successfully loaded equipment, schedule and risk evidence but will not infer backlog readiness.\`
    : highestExecutionExposure
      ? \`${"${equipment?.name ?? \"This equipment\"}"} has ${"${openWorkOrders.length}"} open SAP work order${"${\n          openWorkOrders.length === 1 ? \"\" : \"s\"\n        }"}, including ${"${overdueWorkOrders.length}"} overdue and ${"${waitingPartsWorkOrders.length}"} waiting for parts. ${"${\n          highestExecutionExposure.id\n        }"} creates the highest current execution exposure because it is ${"${\n          highestExecutionExposure.priority.toLowerCase()\n        }"} priority, ${"${\n          isWorkOrderOverdue(highestExecutionExposure, today)\n            ? \"overdue\"\n            : highestExecutionExposure.status.toLowerCase()\n        }"} and is assigned to ${"${\n          highestExecutionExposure.engineer === \"—\"\n            ? \"no engineer\"\n            : highestExecutionExposure.engineer\n        }"}.\`
      : \`${"${equipment?.name ?? \"This equipment\"}"} has no open SAP work orders in the verified source. Vorta is continuing to monitor imported maintenance demand, completion outcomes and emerging repeat-failure evidence.\`;`,
    "truth-safe briefing",
  );

  source = replaceRequired(
    source,
    `(filter === "OVERDUE" && Boolean(workOrder.overdue)) ||`,
    `(filter === "OVERDUE" && isWorkOrderOverdue(workOrder, today)) ||`,
    "defensive overdue filter",
  );
  source = replaceRequired(
    source,
    `  }, [filter, openWorkOrders, search]);`,
    `  }, [filter, openWorkOrders, search, today]);`,
    "overdue filter dependency",
  );

  source = replaceAllRequired(
    source,
    `highestExecutionExposure.overdue`,
    `isWorkOrderOverdue(highestExecutionExposure, today)`,
    2,
    "highest exposure derived overdue",
  );

  source = replaceRequired(
    source,
    `                    value={openWorkOrders.length}
                    detail={\`${"${priorityCounts.CRITICAL}"} critical · ${"${priorityCounts.HIGH}"} high\`}`,
    `                    value={workOrdersAvailable ? openWorkOrders.length : "—"}
                    detail={workOrdersAvailable ? \`${"${priorityCounts.CRITICAL}"} critical · ${"${priorityCounts.HIGH}"} high\` : "Work-order source unavailable"}`,
    "open work orders unavailable metric",
  );

  source = replaceRequired(
    source,
    `                    value={overdueWorkOrders.length}
                    detail={\`${"${dueThisWeek.length}"} due within seven days\`}`,
    `                    value={workOrdersAvailable ? overdueWorkOrders.length : "—"}
                    detail={workOrdersAvailable ? \`${"${dueThisWeek.length}"} due within seven days\` : "Due-date evidence unavailable"}`,
    "overdue unavailable metric",
  );

  source = replaceRequired(
    source,
    `                    value={\`${"${executionReadiness}"}%\`}
                    detail={\`${"${unassignedWorkOrders.length}"} unassigned · ${"${waitingPartsWorkOrders.length}"} waiting parts\`}
                    tone={
                      executionReadiness >= 85
                        ? "text-emerald-300"
                        : executionReadiness >= 65
                          ? "text-yellow-300"
                          : "text-red-300"
                    }`,
    `                    value={executionReadiness === null ? "—" : \`${"${executionReadiness}"}%\`}
                    detail={
                      executionReadiness === null
                        ? workOrdersAvailable
                          ? "No open backlog to score"
                          : "Readiness evidence unavailable"
                        : \`${"${unassignedWorkOrders.length}"} unassigned · ${"${waitingPartsWorkOrders.length}"} waiting parts\`
                    }
                    tone={
                      executionReadiness === null
                        ? "text-slate-500"
                        : executionReadiness >= 85
                          ? "text-emerald-300"
                          : executionReadiness >= 65
                            ? "text-yellow-300"
                            : "text-red-300"
                    }`,
    "top execution readiness metric",
  );

  source = replaceRequired(
    source,
    `                    value={\`${"${riskQueue?.totalCalculatedReduction ?? 0}"} pts\`}
                    detail={\`${"${currentRisk}"}% to ${"${projectedRisk}"}% projected risk\`}`,
    `                    value={sourceState.riskQueue === "available" ? \`${"${riskQueue?.totalCalculatedReduction ?? 0}"} pts\` : "—"}
                    detail={sourceState.riskQueue === "available" ? \`${"${currentRisk}"}% to ${"${projectedRisk}"}% projected risk\` : "Risk-reduction evidence unavailable"}`,
    "risk queue unavailable metric",
  );

  source = replaceRequired(
    source,
    `               loading={loading}`,
    `               loading={sourceState.schedules === "loading"}`,
    "schedule-specific loading state",
  );

  source = replaceRequired(
    source,
    `                     {loading
                       ? "Calculating risk-reducing work"
                       : "No immediate risk-reduction work identified"}`,
    `                     {sourceState.riskQueue === "loading"
                       ? "Calculating risk-reducing work"
                       : sourceState.riskQueue === "unavailable"
                         ? "Risk-reduction evidence unavailable"
                         : "No immediate risk-reduction work identified"}`,
    "risk queue empty-state truth",
  );

  source = replaceRequired(
    source,
    `                      executionReadiness >= 85
                        ? "text-emerald-300"
                        : executionReadiness >= 65
                          ? "text-yellow-300"
                          : "text-red-300"`,
    `                      executionReadiness === null
                        ? "text-slate-500"
                        : executionReadiness >= 85
                          ? "text-emerald-300"
                          : executionReadiness >= 65
                            ? "text-yellow-300"
                            : "text-red-300"`,
    "readiness card tone",
  );

  source = replaceRequired(
    source,
    `                    {executionReadiness}%`,
    `                    {executionReadiness === null ? "—" : \`${"${executionReadiness}"}%\`}`,
    "readiness card value",
  );

  source = replaceRequired(
    source,
    `                         {value}%`,
    `                         {value === null ? "Unavailable" : \`${"${value}"}%\`}`,
    "readiness source value",
  );

  source = replaceRequired(
    source,
    `                         style={{ width: \`${"${value}"}%\` }}`,
    `                         style={{ width: \`${"${value ?? 0}"}%\` }}`,
    "readiness source bar",
  );

  source = replaceRequired(
    source,
    `                       No open execution exposure`,
    `                       {workOrdersAvailable ? "No open execution exposure" : "Execution exposure unavailable"}`,
    "highest exposure empty title",
  );

  source = replaceRequired(
    source,
    `                       No open SAP work orders are currently linked to this
                       equipment.`,
    `                       {workOrdersAvailable
                         ? "No open SAP work orders are currently linked to this equipment."
                         : "The work-order source could not be verified, so Vorta cannot determine the current execution exposure."}`,
    "highest exposure empty detail",
  );

  return source;
});

console.log("Applied live Equipment pilot readiness batches.");
