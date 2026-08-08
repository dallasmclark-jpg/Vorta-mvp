from pathlib import Path
import json


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected one match, found {count}")
    return text.replace(old, new, 1)


equipment_path = Path("netlify/functions/ask-vorta/equipment-evidence.mts")
equipment = equipment_path.read_text()

equipment = replace_once(
    equipment,
    "  const loweredGoal = goal.toLowerCase();\n  const capabilityFact = selectedFacts.find((fact) =>\n",
    '''  const loweredGoal = goal.toLowerCase();
  const asksForDiagnosticContrast =
    /\\b(?:or|versus|vs\\.?|rather than)\\b/.test(loweredGoal) &&
    /\\b(?:instrument|sensor|probe|transmitter|measurement|reading)\\b/.test(
      loweredGoal,
    ) &&
    /\\b(?:fault|drift|bias|risk|condition|excursion|room|process)\\b/.test(
      loweredGoal,
    );
  const diagnosticObservationPattern =
    /(?:transmitter|sensor|probe|instrument|dpt-\\d+)[\\s\\S]{0,220}(?:drift|unstable|fluctuat|bias|fault|failed)|(?:calibrated|independent|portable) reference[\\s\\S]{0,180}(?:stable|normal|agree|within)/i;
  const diagnosticInstrumentFact = asksForDiagnosticContrast
    ? decisionFacts.find(
        (fact) =>
          /(?:work evidence|work order|WO-)/i.test(fact) &&
          diagnosticObservationPattern.test(fact),
      ) ?? decisionFacts.find((fact) => diagnosticObservationPattern.test(fact))
    : undefined;
  const diagnosticProcessPattern =
    /(?:calibrated|independent|portable) reference[\\s\\S]{0,180}(?:high|low|outside|deviation|failed|out of)|(?:room|process|pressure cascade|airflow)[\\s\\S]{0,180}(?:failed|out of spec|excursion|outside limit|deviation confirmed)/i;
  const diagnosticProcessFact = asksForDiagnosticContrast
    ? decisionFacts.find(
        (fact) =>
          /(?:work evidence|work order|WO-)/i.test(fact) &&
          diagnosticProcessPattern.test(fact),
      )
    : undefined;
  const diagnosticImpactFact = asksForDiagnosticContrast
    ? decisionFacts.find(
        (fact) =>
          /(?:work evidence|work order|WO-)/i.test(fact) &&
          /(?:impact assessment|independent reference monitoring|pressure cascade|room.?status|process condition|continued.?operation)/i.test(
            fact,
          ),
      )
    : undefined;
  const currentDirectAnswer =
    typeof answer.directAnswer === "string" ? answer.directAnswer : "";
  const diagnosticContrastAnswerIsDirect =
    /(?:instrument|sensor|probe|transmitter|dpt-\\d+)[^.]{0,140}(?:fault|drift|bias|unstable|fluctuat)|(?:fault|drift|bias|unstable|fluctuat)[^.]{0,140}(?:instrument|sensor|probe|transmitter|dpt-\\d+)|(?:cannot|can’t|can't|insufficient|not enough)[^.]{0,180}(?:distinguish|determine)/i.test(
      currentDirectAnswer,
    );
  const diagnosticContrastNeedsRepair =
    asksForDiagnosticContrast && !diagnosticContrastAnswerIsDirect;
  const boundedDiagnosticFact = (
    fact: string | undefined,
    maximum = 340,
  ): string => {
    if (!fact) return "";
    const text = readableEquipmentDecisionFact(fact);
    return text.length > maximum
      ? `${text.slice(0, Math.max(0, maximum - 1)).trimEnd()}…`
      : text;
  };
  const capabilityFact = selectedFacts.find((fact) =>
''',
    "equipment contrast detector",
)

equipment = replace_once(
    equipment,
    "  if (!originalUnavailable) {\n",
    "  if (!originalUnavailable && !diagnosticContrastNeedsRepair) {\n",
    "equipment valid-answer branch",
)

equipment = replace_once(
    equipment,
    '''  if (/\\b(?:who|qualified|engineer|skill|authori[sz]e|can lead|can verify)\\b/.test(loweredGoal)) {
''',
    '''  if (diagnosticContrastNeedsRepair) {
    const instrumentText = boundedDiagnosticFact(diagnosticInstrumentFact);
    const processText = boundedDiagnosticFact(diagnosticProcessFact);
    const impactText = boundedDiagnosticFact(diagnosticImpactFact, 300);
    const hasInstrumentEvidence = Boolean(diagnosticInstrumentFact);
    const hasProcessEvidence = Boolean(diagnosticProcessFact);

    if (hasInstrumentEvidence && !hasProcessEvidence) {
      answer.directAnswer =
        `The current authorised evidence points to an instrument fault; a genuine room or process failure is not proven: ${instrumentText}.`;
      answer.decisionSummary = [
        {
          label: "Decision",
          value:
            "Instrument fault is the leading evidence; a genuine room or process failure is not proven.",
        },
        { label: "Diagnostic evidence", value: instrumentText },
        ...(impactText ? [{ label: "Impact boundary", value: impactText }] : []),
      ].slice(0, 5);
      answer.findings = [
        {
          category: "data",
          severity: "high",
          title: "Instrument-side evidence",
          detail: instrumentText,
        },
        ...(impactText
          ? [
              {
                category: "data",
                severity: "info",
                title: "Room or process impact still requires confirmation",
                detail: impactText,
              },
            ]
          : []),
      ];
    } else if (hasProcessEvidence && !hasInstrumentEvidence) {
      answer.directAnswer =
        `The current authorised evidence points to a genuine room or process condition rather than an instrument-only fault: ${processText}.`;
      answer.decisionSummary = [
        {
          label: "Decision",
          value:
            "The monitored condition is supported by independent evidence; an instrument-only explanation is not sufficient.",
        },
        { label: "Condition evidence", value: processText },
      ];
      answer.findings = [
        {
          category: "data",
          severity: "high",
          title: "Independent condition evidence",
          detail: processText,
        },
      ];
    } else {
      answer.directAnswer =
        "The current authorised evidence is insufficient to distinguish an instrument fault from a genuine room or process condition, so neither is confirmed yet.";
      answer.decisionSummary = [
        {
          label: "Decision",
          value:
            "Do not treat either explanation as confirmed until the instrument indication and the monitored condition are independently verified.",
        },
        ...(instrumentText ? [{ label: "Instrument evidence", value: instrumentText }] : []),
        ...(processText ? [{ label: "Condition evidence", value: processText }] : []),
      ].slice(0, 5);
      answer.findings = [
        ...(instrumentText
          ? [
              {
                category: "data",
                severity: "info",
                title: "Instrument-side evidence",
                detail: instrumentText,
              },
            ]
          : []),
        ...(processText
          ? [
              {
                category: "data",
                severity: "info",
                title: "Condition-side evidence",
                detail: processText,
              },
            ]
          : []),
      ].slice(0, 6);
    }

    answer.missingData = textValues(answer.missingData).filter(
      (item) => !unavailableEquipmentDecisionClaim(item),
    );
    if (questionPlan.forceActionPlan === true) {
      const referenceAvailable = /reference/i.test(
        `${instrumentText} ${processText} ${impactText}`,
      );
      answer.actionPlan = [
        {
          priority: "now",
          action: referenceAvailable
            ? "Confirm the suspect instrument against the calibrated or independent reference and verify the affected room or process condition before treating the indication as a genuine process failure."
            : "Complete the approved instrument verification and independently confirm the affected room or process condition before treating the indication as a genuine process failure.",
          owner: "Maintenance Manager",
          expectedImpact:
            "Separates an instrument indication fault from a genuine monitored-condition deviation before maintenance or quality escalation.",
          verification:
            impactText || instrumentText || processText ||
            "Record the independent instrument and monitored-condition results before closing the diagnosis.",
        },
      ];
      answer.recommendedActions = [
        referenceAvailable
          ? "Compare the suspect instrument with the calibrated or independent reference and confirm the monitored room or process condition."
          : "Complete the approved instrument check and independently confirm the monitored room or process condition.",
      ];
    }
    return;
  }

  if (/\\b(?:who|qualified|engineer|skill|authori[sz]e|can lead|can verify)\\b/.test(loweredGoal)) {
''',
    "equipment contrast repair branch",
)

equipment_path.write_text(equipment)


eval_path = Path("scripts/ask-vorta-live-evals.mjs")
live_eval = eval_path.read_text()
live_eval = replace_once(
    live_eval,
    '''    const assertionText = requireVisibleDecision ? visibleText : text;
    const usedTools = new Set(payload.toolsUsed || []);
''',
    '''    const assertionText = requireVisibleDecision ? visibleText : text;
    const directAnswerText = String(payload.directAnswer ?? "").toLowerCase();
    const usedTools = new Set(payload.toolsUsed || []);
''',
    "live eval direct-answer text",
)
live_eval = replace_once(
    live_eval,
    '''    if (
      scenario.mustMentionAny?.length &&
      !scenario.mustMentionAny.some((phrase) => assertionText.includes(phrase.toLowerCase()))
    ) {
      failures.push(`missing any of: ${scenario.mustMentionAny.join(", ")}`);
    }
    for (const phrase of scenario.mustNotMention || []) {
''',
    '''    if (
      scenario.mustMentionAny?.length &&
      !scenario.mustMentionAny.some((phrase) => assertionText.includes(phrase.toLowerCase()))
    ) {
      failures.push(`missing any of: ${scenario.mustMentionAny.join(", ")}`);
    }
    for (const phrase of scenario.directAnswerMustMention || []) {
      if (!directAnswerText.includes(phrase.toLowerCase())) {
        failures.push(`direct answer missing "${phrase}"`);
      }
    }
    if (
      scenario.directAnswerMustMentionAny?.length &&
      !scenario.directAnswerMustMentionAny.some((phrase) =>
        directAnswerText.includes(phrase.toLowerCase()),
      )
    ) {
      failures.push(
        `direct answer missing any of: ${scenario.directAnswerMustMentionAny.join(", ")}`,
      );
    }
    for (const phrase of scenario.directAnswerMustNotMention || []) {
      if (directAnswerText.includes(phrase.toLowerCase())) {
        failures.push(`unsafe direct-answer phrase "${phrase}"`);
      }
    }
    for (const phrase of scenario.mustNotMention || []) {
''',
    "live eval direct-answer assertions",
)
eval_path.write_text(live_eval)


golden_path = Path("tests/evals/vor-033-demo-golden.json")
golden = json.loads(golden_path.read_text())
ahu = next((item for item in golden if item.get("id") == "vor033-ahu01-diagnosis"), None)
if not ahu:
    raise SystemExit("AHU diagnosis fixture not found")
ahu["directAnswerMustMention"] = ["instrument fault", "not proven"]
ahu["directAnswerMustMentionAny"] = ["DPT-17", "calibrated reference", "transmitter drift"]
ahu["directAnswerMustNotMention"] = ["the authorised diagnosis is supported by"]
golden_path.write_text(json.dumps(golden, indent=2) + "\n")


contract_path = Path("scripts/vor-049-decision-ready-equipment-contracts.mjs")
contract = contract_path.read_text()
contract = replace_once(
    contract,
    '''  "repairEquipmentDecisionAnswer",
  "unavailableEquipmentDecisionClaim",
''',
    '''  "repairEquipmentDecisionAnswer",
  "diagnosticContrastNeedsRepair",
  "unavailableEquipmentDecisionClaim",
''',
    "contract backend marker",
)
contract = replace_once(
    contract,
    '''  "assertionText",
  "visible answer denies capability evidence",
''',
    '''  "assertionText",
  "directAnswerMustMention",
  "directAnswerMustMentionAny",
  "directAnswerMustNotMention",
  "visible answer denies capability evidence",
''',
    "contract evaluator markers",
)
contract = replace_once(
    contract,
    '''const ahuDiagnosis = golden.find((scenario) => scenario.id === "vor033-ahu01-diagnosis");
assert.ok(ahuDiagnosis?.expectedTools?.includes("get_equipment_calibrations"));
''',
    '''const ahuDiagnosis = golden.find((scenario) => scenario.id === "vor033-ahu01-diagnosis");
assert.ok(ahuDiagnosis?.expectedTools?.includes("get_equipment_calibrations"));
assert.deepEqual(ahuDiagnosis?.directAnswerMustMention, ["instrument fault", "not proven"]);
assert.deepEqual(ahuDiagnosis?.directAnswerMustMentionAny, [
  "DPT-17",
  "calibrated reference",
  "transmitter drift",
]);
assert.ok(
  ahuDiagnosis?.directAnswerMustNotMention?.includes(
    "the authorised diagnosis is supported by",
  ),
);
assert.match(
  answerRepairTemplate,
  /The current authorised evidence points to an instrument fault; a genuine room or process failure is not proven/,
  "Contrast diagnosis repair must state the evidence-backed side and the safety boundary directly",
);
''',
    "contract AHU direct-answer assertions",
)
contract_path.write_text(contract)


Path(".tmp-vor049-tsconfig.json").write_text(
    json.dumps(
        {
            "compilerOptions": {
                "target": "ES2022",
                "module": "NodeNext",
                "moduleResolution": "NodeNext",
                "outDir": ".tmp-vor049-build",
                "rootDir": ".",
                "skipLibCheck": True,
                "strict": False,
                "noEmit": False,
            },
            "include": [
                "netlify/functions/ask-vorta/equipment-evidence.mts",
                "netlify/functions/ask-vorta/contracts.mts",
                "netlify/functions/ask-vorta/utilities.mts",
                "netlify/functions/_shared/askVortaImageEvidence.mts",
                "netlify/functions/_shared/askVortaConversationContext.mts",
            ],
        },
        indent=2,
    )
    + "\n"
)

Path(".tmp-vor049-behaviour.mjs").write_text(
    '''import assert from "node:assert/strict";
import { repairEquipmentDecisionAnswer } from "./.tmp-vor049-build/netlify/functions/ask-vorta/equipment-evidence.mjs";

const questionPlan = {
  scope: "equipment",
  decisionGoal: "Is the Grade B room currently at risk, or is AHU-01 showing an instrument fault?",
  forceActionPlan: true,
};
const answer = {
  directAnswer: "I cannot confirm the current room condition from the available authorised evidence.",
  decisionSummary: [],
  findings: [],
  actionPlan: [],
  recommendedActions: [],
  missingData: ["Current room result needs confirmation."],
};
const decisionFacts = [
  "priority document evidence: AHU-01 HEPA Differential Pressure Fault-Finding Guide | revision Rev C | approval Approved | page 9",
  "equipment: Grade B Cleanroom HVAC AHU-01",
  "work evidence WO-250447 | fault AHU-DP-104 | DPT-17 fluctuates at the upper operating range while the calibrated reference remains stable | waiting for replacement transmitter",
  "work evidence WO-250448 | Grade B airflow and pressure-cascade impact assessment remains open | independent reference monitoring in place",
];
const outcomes = new Map([
  [
    "get_equipment_decision_pack",
    {
      source: "Equipment cross-domain decision pack",
      status: "ok",
      data: { decisionFacts },
    },
  ],
]);
repairEquipmentDecisionAnswer(answer, questionPlan, outcomes);
assert.match(answer.directAnswer, /instrument fault/i);
assert.match(answer.directAnswer, /not proven/i);
assert.match(answer.directAnswer, /DPT-17|calibrated reference/i);
assert.doesNotMatch(answer.directAnswer, /^The authorised diagnosis is supported by/i);
assert.equal(answer.decisionSummary[0]?.label, "Decision");
assert.match(answer.decisionSummary[0]?.value ?? "", /instrument fault/i);
assert.match(answer.actionPlan[0]?.action ?? "", /reference/i);
assert.match(answer.actionPlan[0]?.action ?? "", /room or process condition/i);

const uncertainAnswer = {
  directAnswer: "I cannot determine this from the available evidence.",
  decisionSummary: [],
  findings: [],
  actionPlan: [],
  recommendedActions: [],
  missingData: [],
};
repairEquipmentDecisionAnswer(
  uncertainAnswer,
  questionPlan,
  new Map([
    [
      "get_equipment_decision_pack",
      {
        source: "Equipment cross-domain decision pack",
        status: "ok",
        data: {
          decisionFacts: [
            "priority document evidence: Generic instrument fault-finding guide | approval Approved",
          ],
        },
      },
    ],
  ]),
);
assert.match(uncertainAnswer.directAnswer, /insufficient to distinguish/i);
assert.match(uncertainAnswer.directAnswer, /neither is confirmed/i);
console.log("VOR-049 diagnostic contrast behaviour passed.");
'''
)
