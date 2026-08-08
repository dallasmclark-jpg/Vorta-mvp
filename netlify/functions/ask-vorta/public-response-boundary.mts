import type { JsonRecord } from "./contracts.mjs";

export const ASK_VORTA_PUBLIC_RESPONSE_REVISION =
  "vor-076-public-action-plan-boundary-v1";

function records(value: unknown): JsonRecord[] {
  return Array.isArray(value)
    ? value.filter(
        (item): item is JsonRecord =>
          Boolean(item) && typeof item === "object" && !Array.isArray(item),
      )
    : [];
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function toolWasUsed(answer: JsonRecord, toolName: string): boolean {
  return Array.isArray(answer.toolsUsed)
    ? answer.toolsUsed.some((value) => value === toolName)
    : false;
}

function firstFindingTitle(answer: JsonRecord): string {
  for (const finding of records(answer.findings)) {
    const title = text(finding.title);
    if (title) return title;
  }
  return "";
}

function summaryValue(answer: JsonRecord, labelPattern: RegExp): string {
  for (const item of records(answer.decisionSummary)) {
    const label = text(item.label);
    const value = text(item.value);
    if (value && labelPattern.test(label)) return value;
  }
  return "";
}

function ensureRecommendedAction(answer: JsonRecord, action: string): void {
  const current = Array.isArray(answer.recommendedActions)
    ? answer.recommendedActions.filter(
        (value): value is string => typeof value === "string" && value.trim().length > 0,
      )
    : [];
  if (current.length === 0) answer.recommendedActions = [action];
}

function repairBacklogActionPlan(answer: JsonRecord): boolean {
  if (!toolWasUsed(answer, "get_site_work_backlog")) return false;
  const target =
    firstFindingTitle(answer) ||
    summaryValue(answer, /highest priority|first priority|check first/i);
  if (!target) return false;

  const action =
    `Confirm scope, readiness and an authorised assignee for ${target}, ` +
    "then have the Maintenance Planner update and sequence the SAP work order before release.";
  ensureRecommendedAction(answer, action);
  answer.actionPlan = [
    {
      priority: "now",
      action,
      owner: "Maintenance Manager / Planner",
      expectedImpact:
        "Moves the highest-priority overdue or unassigned work order from identified risk toward an owned, executable plan.",
      verification:
        "Open the linked SAP work-order evidence and confirm the authorised assignee, readiness, due date and released sequence are recorded by an authorised user; Ask Vorta does not change SAP.",
    },
  ];
  return true;
}

function handoverHasOutstandingPriority(answer: JsonRecord): boolean {
  const directAnswer = text(answer.directAnswer);
  const checkFirst = summaryValue(answer, /check first|first action|priority/i);
  const outstandingFinding = records(answer.findings).some((finding) =>
    /\b(?:ongoing|waiting(?: on)? parts?|open|blocked|temporary|contractor|not completed|no final completion)\b/i.test(
      [text(finding.title), text(finding.detail)].filter(Boolean).join(" "),
    ),
  );
  return Boolean(
    checkFirst ||
      outstandingFinding ||
      /\b(?:check|review)\b.{0,160}\bfirst\b/i.test(directAnswer),
  );
}

function repairHandoverActionPlan(answer: JsonRecord): boolean {
  if (!toolWasUsed(answer, "get_shift_handover")) return false;
  if (!handoverHasOutstandingPriority(answer)) return false;

  const target =
    summaryValue(answer, /check first|first action|priority/i) ||
    firstFindingTitle(answer);
  if (!target) return false;

  const action =
    `Review ${target} at incoming-shift handover and confirm its recorded status, ` +
    "blocker and next authorised step before work proceeds.";
  ensureRecommendedAction(answer, action);
  answer.actionPlan = [
    {
      priority: "incoming_shift",
      action,
      owner: "Incoming Shift / Maintenance Manager",
      expectedImpact:
        "Turns the highest-priority outstanding handover item into an explicit, owned incoming-shift check without changing the source work order.",
      verification:
        "Open the linked handover and work-order evidence and confirm the recorded status, blocker and next authorised step before the incoming shift acts; Ask Vorta does not update SAP.",
    },
  ];
  return true;
}

export function enforcePublicDecisionActionPlan(answer: JsonRecord): boolean {
  if (records(answer.actionPlan).length > 0) return false;
  if (repairBacklogActionPlan(answer)) return true;
  return repairHandoverActionPlan(answer);
}
