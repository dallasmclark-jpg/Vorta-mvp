from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected one match, found {count}")
    return text.replace(old, new, 1)


edge_path = Path("netlify/edge-functions/ask-vorta-work-backlog.ts")
edge = edge_path.read_text()
old = '''    const answer = {
      directAnswer: top
        ? `${overdueCount} overdue work order${overdueCount === 1 ? "" : "s"} need management attention; start with ${topOrderNumber} on ${topAsset}, a ${topPriority} priority order due ${topDueDate}.`
        : "No open maintenance work orders are recorded in the authorised site backlog.",
      decisionSummary,
      evidence,
      findings,
      coverOptions: [],
      recommendedActions: [],
      actionPlan: [],
      followUpQuestions: [],
'''
new = '''    const backlogAction = top
      ? `Review ${topOrderNumber} against the authorised SAP-backed work-order evidence, confirm scope, readiness, assignee, due date and sequence, then have the Maintenance Planner make any required record change in SAP.`
      : "";
    const answer = {
      directAnswer: top
        ? `${overdueCount} overdue work order${overdueCount === 1 ? "" : "s"} need management attention; start with ${topOrderNumber} on ${topAsset}, a ${topPriority} priority order due ${topDueDate}.`
        : "No open maintenance work orders are recorded in the authorised site backlog.",
      decisionSummary,
      evidence,
      findings,
      coverOptions: [],
      recommendedActions: backlogAction ? [backlogAction] : [],
      actionPlan: backlogAction
        ? [
            {
              priority: "now",
              action: backlogAction,
              owner: "Maintenance Manager / Planner",
              expectedImpact:
                "Moves the highest-priority evidenced work-order risk toward an owned, executable maintenance plan.",
              verification:
                `Open the authorised ${topOrderNumber} evidence and confirm readiness, assignee, due date and sequence are recorded in SAP by an authorised user.`,
            },
          ]
        : [],
      followUpQuestions: [],
'''
edge = replace_once(edge, old, new, "edge backlog answer")
edge_path.write_text(edge)

contract_path = Path("scripts/vor-056-backlog-action-plan-contracts.mjs")
contract = contract_path.read_text()
old = '''const finalResponseBoundary = readFileSync(
  "netlify/functions/ask-vorta/runtime-document-links.mts",
  "utf8",
);
'''
new = '''const finalResponseBoundary = readFileSync(
  "netlify/functions/ask-vorta/runtime-document-links.mts",
  "utf8",
);
const backlogEdge = readFileSync(
  "netlify/edge-functions/ask-vorta-work-backlog.ts",
  "utf8",
);
'''
contract = replace_once(contract, old, new, "contract edge source")
anchor = '''assert.equal(
  /assigned successfully|updated SAP/i.test(finalResponseBoundary),
  false,
  "The final response guard must not claim that Ask Vorta performed an SAP or assignment write",
);

'''
addition = '''assert.equal(
  /assigned successfully|updated SAP/i.test(finalResponseBoundary),
  false,
  "The final response guard must not claim that Ask Vorta performed an SAP or assignment write",
);

for (const marker of [
  'const OPEN_WORK_PATTERN =',
  'overdue work|unassigned work',
  'toolsUsed: ["get_site_work_backlog"]',
  'const backlogAction = top',
  'authorised SAP-backed work-order evidence',
  'recommendedActions: backlogAction ? [backlogAction] : []',
  'actionPlan: backlogAction',
  'owner: "Maintenance Manager / Planner"',
  'have the Maintenance Planner make any required record change in SAP',
  'recorded in SAP by an authorised user',
]) {
  assert.ok(
    backlogEdge.includes(marker),
    `The factual backlog edge response is missing ${marker}`,
  );
}
assert.ok(
  backlogEdge.indexOf('const backlogAction = top') <
    backlogEdge.indexOf('toolsUsed: ["get_site_work_backlog"]'),
  "The edge backlog action plan must be created in the same governed response that declares the backlog tool evidence",
);
assert.equal(
  /assigned successfully|updated SAP/i.test(backlogEdge),
  false,
  "The edge backlog response must not claim that Vorta performed an SAP or assignment write",
);

'''
contract = replace_once(contract, anchor, addition, "contract edge assertions")
contract_path.write_text(contract)
