import type { JsonRecord, ToolResult } from "./contracts.mjs";
import { decisionPackCoveringTool, successfulToolNames } from "./contracts.mjs";
import { equipmentVisibleDecisionText, unavailableEquipmentDecisionClaim } from "./equipment-evidence.mjs";
import { evidenceTimestamps, numberValue, records, textValues } from "./utilities.mjs";

export const ASK_VORTA_RESPONSE_VALIDATION_REVISION =
  "vor-056-final-backlog-boundary-v1";

export function replaceReleasedWording(value: unknown): unknown {
  if (typeof value === "string") {
    return value.replace(/\breleased\b/gi, "approved for return to service");
  }
  if (Array.isArray(value)) return value.map(replaceReleasedWording);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value as JsonRecord).map(([key, item]) => [
      key,
      replaceReleasedWording(item),
    ]),
  );
}

export function enforceEquipmentReturnToServiceSafety(
  answer: JsonRecord,
  questionPlan: JsonRecord | null,
): void {
  if (
    questionPlan?.scope !== "equipment" ||
    !/\breleas(?:e|ed|ing)\b/i.test(String(questionPlan.decisionGoal ?? ""))
  ) {
    return;
  }
  for (const key of [
    "directAnswer",
    "decisionSummary",
    "evidence",
    "findings",
    "coverOptions",
    "recommendedActions",
    "actionPlan",
    "followUpQuestions",
    "missingData",
  ]) {
    answer[key] = replaceReleasedWording(answer[key]);
  }
}

export function coverShiftKey(shift: JsonRecord): string {
  return `${String(shift.shiftDate)}:${String(shift.shiftType)}`;
}

export function compareCoverPriority(first: JsonRecord, second: JsonRecord): number {
  return (
    numberValue(second.labourRiskScore) - numberValue(first.labourRiskScore) ||
    numberValue(second.missingSkillCount) - numberValue(first.missingSkillCount) ||
    String(first.shiftDate).localeCompare(String(second.shiftDate)) ||
    String(first.shiftType).localeCompare(String(second.shiftType))
  );
}

export function readableShift(shift: JsonRecord): string {
  const date = new Date(`${String(shift.shiftDate)}T12:00:00Z`);
  const dateLabel = Number.isNaN(date.getTime())
    ? String(shift.shiftDate)
    : new Intl.DateTimeFormat("en-GB", {
        day: "numeric",
        month: "short",
        timeZone: "UTC",
      }).format(date);
  return `${dateLabel} ${String(shift.shiftType)}`;
}

export function coverEvidenceConfidence(
  shiftCoverEvidence: JsonRecord,
  primaryShift: JsonRecord,
  primaryPackage: JsonRecord | undefined,
  primarySkillRisks: JsonRecord[],
  offRotaNames: string[],
): number {
  let score = primaryPackage ? 92 : 78;
  const sourceUpdatedAt =
    typeof shiftCoverEvidence.sourceUpdatedAt === "string"
      ? new Date(shiftCoverEvidence.sourceUpdatedAt).getTime()
      : Number.NaN;

  if (!Number.isFinite(sourceUpdatedAt)) {
    score -= 15;
  } else {
    const sourceAgeHours = Math.max(0, (Date.now() - sourceUpdatedAt) / 3_600_000);
    if (sourceAgeHours > 168) score -= 20;
    else if (sourceAgeHours > 72) score -= 12;
    else if (sourceAgeHours > 24) score -= 6;
  }

  if (textValues(primaryShift.engineerNames).length === 0) score -= 12;
  if (numberValue(primaryShift.missingSkillCount) > 0 && primarySkillRisks.length === 0) {
    score -= 12;
  }
  if (primaryPackage && offRotaNames.length === 0) score -= 8;
  if (primaryPackage && numberValue(primaryPackage.remainingMissingSkills) > 0) score -= 5;

  return Math.max(45, Math.min(95, Math.round(score)));
}

export function answerReasoningEffort(
  questionPlan: JsonRecord | null,
): "low" | "medium" {
  if (questionPlan?.routingMode === "deterministic") return "low";
  const scope = typeof questionPlan?.scope === "string" ? questionPlan.scope : "";
  return new Set([
    "site_priorities",
    "equipment",
    "shift_cover",
    "maintenance_plan",
    "mixed",
  ]).has(scope)
    ? "medium"
    : "low";
}

export function answerOutputTokenBudget(questionPlan: JsonRecord | null): number {
  if (questionPlan?.routingMode === "deterministic") {
    const scope =
      typeof questionPlan.scope === "string" ? questionPlan.scope : "";
    if (scope === "site_risk" || scope === "work") return 1_400;
    return questionPlan.forceActionPlan === true ? 2_000 : 1_700;
  }
  return answerReasoningEffort(questionPlan) === "medium" ? 4_200 : 2_800;
}

export function evidenceAwareConfidence(
  answer: JsonRecord,
  questionPlan: JsonRecord | null,
  outcomes: Map<string, ToolResult>,
): number {
  const results = [...outcomes.values()];
  const okResults = results.filter((result) => result.status === "ok");
  const emptyResults = results.filter((result) => result.status === "empty");
  const unavailableResults = results.filter((result) => result.status === "unavailable");
  const successfulTools = successfulToolNames(outcomes);
  const unresolvedRequired = textValues(questionPlan?.requiredTools).filter(
    (toolName) =>
      !successfulTools.has(toolName) &&
      !decisionPackCoveringTool(toolName, successfulTools),
  );
  const missingDataCount = textValues(answer.missingData).length;
  const ambiguity = Boolean(
    typeof questionPlan?.ambiguity === "string" &&
      questionPlan.ambiguity.trim() &&
      !/^(none|no ambiguity|not ambiguous)$/i.test(questionPlan.ambiguity.trim()),
  );

  let score = okResults.length > 0
    ? 86
    : emptyResults.length > 0
      ? 68
      : questionPlan?.shouldUseTools === true
        ? 35
        : 82;

  score += Math.min(6, Math.max(0, okResults.length - 1) * 2);
  score -= Math.min(24, unavailableResults.length * 10);
  score -= Math.min(16, emptyResults.length * 4);
  score -= Math.min(24, unresolvedRequired.length * 8);
  score -= Math.min(20, missingDataCount * 5);
  if (ambiguity) score -= 12;

  const timestamps = okResults.flatMap((result) => evidenceTimestamps(result.data));
  if (timestamps.length > 0) {
    const newestEvidence = Math.max(...timestamps);
    const ageHours = Math.max(0, (Date.now() - newestEvidence) / 3_600_000);
    if (ageHours > 168) score -= 8;
    else if (ageHours > 72) score -= 4;
  }

  const modelConfidence = numberValue(answer.confidence);
  if (modelConfidence >= 85) score += 3;
  else if (modelConfidence > 0 && modelConfidence < 40) score -= 3;

  const lowerBound = okResults.length > 0 ? (ambiguity ? 40 : 55) : 20;
  const visibleDecisionUnavailable = unavailableEquipmentDecisionClaim(
    equipmentVisibleDecisionText(answer),
  );
  const upperBound = visibleDecisionUnavailable ? 50 : 95;
  return Math.max(
    Math.min(lowerBound, upperBound),
    Math.min(upperBound, Math.round(score)),
  );
}

export function enforceBacklogActionPlan(
  answer: JsonRecord,
  outcomes: Map<string, ToolResult>,
  usedTools: Set<string>,
): void {
  const backlogResult = outcomes.get("get_site_work_backlog");
  const backlogToolExecuted =
    usedTools.has("get_site_work_backlog") || Boolean(backlogResult);
  if (!backlogToolExecuted || records(answer.actionPlan).length > 0) {
    return;
  }

  const firstFinding = records(answer.findings).find(
    (item) => typeof item.title === "string" && item.title.trim().length > 0,
  );
  const prioritySummary = records(answer.decisionSummary).find((item) =>
    /highest priority|first priority|first action/i.test(String(item.label ?? "")),
  );
  const findingTitle =
    typeof firstFinding?.title === "string" ? firstFinding.title.trim() : "";
  const summaryValue =
    typeof prioritySummary?.value === "string" ? prioritySummary.value.trim() : "";
  const target = findingTitle || summaryValue;
  if (!target) return;

  const action =
    `Confirm scope, readiness and an authorised assignee for ${target}, then have the Maintenance Planner update and sequence the SAP work order before release.`;
  const existingRecommendations = textValues(answer.recommendedActions).filter(
    (item) => item !== action,
  );
  answer.recommendedActions = [action, ...existingRecommendations].slice(0, 4);
  answer.actionPlan = [
    {
      priority: "now",
      action,
      owner: "Maintenance Manager / Planner",
      expectedImpact:
        "Moves the highest-priority overdue or unassigned work order from identified risk toward an owned, executable plan.",
      verification:
        "Open the linked SAP work order evidence and confirm the authorised assignee, readiness, due date and released sequence are recorded by an authorised user.",
    },
  ];
}

export function enforceDeterministicResponseShape(
  answer: JsonRecord,
  questionPlan: JsonRecord | null,
): void {
  if (questionPlan?.routingMode !== "deterministic") return;

  const scope =
    typeof questionPlan.scope === "string" ? questionPlan.scope : "";
  const configuredLimit = Number(questionPlan.summaryItemLimit);
  const summaryLimit = Number.isFinite(configuredLimit)
    ? Math.max(1, Math.min(5, Math.round(configuredLimit)))
    : scope === "handover"
      ? 3
      : 4;

  answer.decisionSummary = records(answer.decisionSummary).slice(0, summaryLimit);
  const configuredFollowUpLimit = Number(questionPlan.followUpLimit);
  const followUpLimit = Number.isFinite(configuredFollowUpLimit)
    ? Math.max(0, Math.min(1, Math.round(configuredFollowUpLimit)))
    : 1;
  answer.followUpQuestions = textValues(answer.followUpQuestions).slice(0, followUpLimit);

  const requiresAction =
    scope === "site_priorities" || questionPlan.forceActionPlan === true;
  if (!requiresAction || records(answer.actionPlan).length > 0) return;

  const summaryAction = records(answer.decisionSummary).find((item) =>
  /first action|next action|required action|action|order|buy/i.test(String(item.label ?? "")),
);
const firstFinding = records(answer.findings)[0];
const findingTitle =
  typeof firstFinding?.title === "string" ? firstFinding.title.trim() : "";
const evidenceBackedWorkAction =
  scope === "work" && findingTitle
    ? `Confirm scope, readiness and an authorised assignee for ${findingTitle}, then have the Maintenance Planner update and sequence the SAP work order before release.`
    : "";
const action =
  textValues(answer.recommendedActions)[0] ??
  ((typeof summaryAction?.value === "string"
    ? summaryAction.value.trim()
    : "") || evidenceBackedWorkAction);

if (!action) return;
if (textValues(answer.recommendedActions).length === 0) {
  answer.recommendedActions = [action];
}

answer.actionPlan = [
  {
    priority: "now",
    action,
    owner:
      scope === "spares"
        ? "Maintenance Manager / Stores"
        : scope === "work"
          ? "Maintenance Manager / Planner"
          : "Maintenance Manager",
    expectedImpact:
      scope === "spares"
        ? "Starts the highest-priority verified stock intervention identified by the current Vorta evidence."
        : scope === "work"
          ? "Moves the highest-priority overdue or unassigned work order from identified risk toward an owned, executable plan."
          : "Starts the highest-priority executable maintenance intervention identified by the current Vorta evidence.",
    verification:
      scope === "spares"
        ? "Open the linked Stores Inventory evidence and confirm the named part, shortfall, lead time and purchasing status."
        : scope === "work"
          ? "Open the linked SAP work order evidence and confirm the assignee, readiness, due date and released sequence are recorded by an authorised user."
          : "Open the linked Vorta evidence and confirm the named action has an owner and status before the next shift handover.",
  },
];
}

export function enforcePlannedResponseShape(
  answer: JsonRecord,
  questionPlan: JsonRecord | null,
): void {
  const scope = typeof questionPlan?.scope === "string" ? questionPlan.scope : "";
  const summaryLimit = scope === "mixed" ? 5 : new Set(["equipment", "skills"]).has(scope) ? 4 : 5;
  answer.decisionSummary = records(answer.decisionSummary).slice(0, summaryLimit);
  answer.followUpQuestions = textValues(answer.followUpQuestions).slice(0, 1);

  const actionRequested =
    questionPlan?.forceActionPlan === true ||
    /(?:what (?:do|should)|do first|can we fix|what is stopping|let .* run|next shift must)/i.test(
      String(questionPlan?.decisionGoal ?? ""),
    );
  if (!actionRequested || records(answer.actionPlan).length > 0) return;
  const action =
    textValues(answer.recommendedActions)[0] ??
    records(answer.findings)
      .map((item) => (typeof item.detail === "string" ? item.detail : ""))
      .find((value) => /(?:verify|replace|confirm|inspect|repair|order|test|challenge)/i.test(value)) ??
    "Review the linked Vorta evidence and assign the first verified intervention before releasing the work.";
  answer.actionPlan = [
    {
      priority: "now",
      action,
      owner: "Maintenance Manager",
      expectedImpact: "Starts the first evidence-backed intervention for the requested maintenance decision.",
      verification: "Open the linked equipment evidence and confirm the named action, owner and completion status.",
    },
  ];
}

export function enforceReadOnlyWriteBoundary(
  answer: JsonRecord,
  question: string,
): void {
  const writeRequest =
    /^\s*(?:please\s+)?(?:change|update|assign|delete|create|approve|order|schedule|book|cancel|close|complete|move|switch)\b/i.test(
      question,
    ) ||
    /\b(?:can|could|would|will)\s+you\s+(?:change|update|assign|delete|create|approve|order|schedule|book|cancel|close|complete|move|switch)\b/i.test(
      question,
    );
  if (!writeRequest) return;

  const directAnswer =
    typeof answer.directAnswer === "string" ? answer.directAnswer.trim() : "";
  if (/\bread-only\b/i.test(directAnswer) && /\bcannot\b/i.test(directAnswer)) {
    return;
  }
  const staffingWriteRequest =
    /\b(?:shift|rota|cover|engineers?|people|team)\b/i.test(question);
  const refusal = staffingWriteRequest
    ? "Ask Vorta is read-only and cannot assign engineers or change the rota."
    : "Ask Vorta is read-only and cannot change Vorta records.";
  answer.directAnswer = `${refusal} ${directAnswer}`.trim();
}

export function enforceAnswerEvidence(
  answer: JsonRecord,
  question: string,
  shiftCoverEvidence: JsonRecord | null,
  shiftCoverArguments: JsonRecord | null,
): void {
  enforceReadOnlyWriteBoundary(answer, question);

  if (!shiftCoverEvidence) return;
  const calendar = records(shiftCoverEvidence.calendar);
  const issueShifts = calendar
    .filter(
      (shift) =>
        shift.coverageStatus !== "covered" ||
        numberValue(shift.missingSkillCount) > 0,
    )
    .sort(compareCoverPriority);
  const priorityShift = issueShifts[0];
  if (!priorityShift) return;
  const jointHighestShifts = issueShifts.filter(
    (shift) =>
      numberValue(shift.labourRiskScore) ===
        numberValue(priorityShift.labourRiskScore) &&
      numberValue(shift.missingSkillCount) ===
        numberValue(priorityShift.missingSkillCount),
  );
  const packages = records(shiftCoverEvidence.coverPackages);
  const coverCandidates = records(shiftCoverEvidence.coverCandidates);
  const exceptions = records(shiftCoverEvidence.exceptions).filter(
    (item) => item.isAvailable === false,
  );
  const offRota = records(shiftCoverEvidence.offRota);
  const skillRisks = records(shiftCoverEvidence.skillRisks);
  const requestedStart =
    typeof shiftCoverArguments?.start_date === "string"
      ? shiftCoverArguments.start_date
      : undefined;
  const requestedEnd =
    typeof shiftCoverArguments?.end_date === "string"
      ? shiftCoverArguments.end_date
      : undefined;
  const requestedDate =
    requestedStart && requestedStart === requestedEnd ? requestedStart : undefined;
  const requestedType = /\bnight\b/i.test(question)
    ? "night"
    : /\bday\b/i.test(question)
      ? "day"
      : undefined;
  const requestedShift = issueShifts.find(
    (item) =>
      (!requestedDate || item.shiftDate === requestedDate) &&
      (!requestedType || item.shiftType === requestedType),
  );
  const packageEvidence =
    packages.find(
      (item) =>
        (!requestedDate || item.shiftDate === requestedDate) &&
        (!requestedType || item.shiftType === requestedType) &&
        (requestedDate || requestedType),
    ) ??
    packages.find(
      (item) =>
        item.shiftDate === priorityShift.shiftDate &&
        item.shiftType === priorityShift.shiftType,
    );
  const broadCoverQuestion = /\bcover(?:age)?\b/i.test(question);
  const packageQuestion = /\b(best|strongest|recommended|cover package)\b/i.test(
    question,
  ) || /\b(who can cover|cover option|cover candidate|replacement cover)\b/i.test(
    question,
  );

  const primaryShift = requestedShift ?? priorityShift;
  const primaryKey = coverShiftKey(primaryShift);
  const primaryPackage =
    packages.find((item) => coverShiftKey(item) === primaryKey) ?? packageEvidence;
  const scheduledNames = textValues(primaryShift.engineerNames);
  const teamNames = textValues(primaryShift.teamNames);
  const primaryOffRota = offRota.find((item) => coverShiftKey(item) === primaryKey);
  const offRotaNames = textValues(primaryOffRota?.engineerNames);
  const restConflictNames = textValues(primaryOffRota?.restConflictEngineerNames);
  const primarySkillRisks = skillRisks
    .filter((item) => coverShiftKey(item) === primaryKey)
    .sort(
      (first, second) =>
        numberValue(first.qualifiedEngineerCount) -
          numberValue(second.qualifiedEngineerCount) ||
        String(first.skillName).localeCompare(String(second.skillName)),
    )
    .slice(0, 4);
  const closedGapKeys = new Set(textValues(primaryPackage?.closedGapKeys));
  const residualSkillRisks = primarySkillRisks.filter((item) => {
    const gapKey = typeof item.gapKey === "string" ? item.gapKey : "";
    return !gapKey || !closedGapKeys.has(gapKey);
  });
  const residualRiskDetail =
    residualSkillRisks.length > 0
      ? residualSkillRisks
          .map(
            (item) =>
              `${String(item.skillName)} on ${String(item.equipmentCode ?? item.equipmentName)}`,
          )
          .join("; ")
      : primaryPackage && numberValue(primaryPackage.remainingMissingSkills) > 0
        ? `${numberValue(primaryPackage.remainingMissingSkills)} gaps remain; open the residual skill-by-asset list before releasing planned work`
        : "No zero-cover skill gap remains in the calculated package";

  const deterministicFindings: JsonRecord[] = [];
  deterministicFindings.push({
    category: "cover",
    severity: "high",
    title:
      jointHighestShifts.length > 1 && primaryShift === priorityShift
        ? "Joint-highest-risk shifts"
        : "Priority shift and scheduled team",
    detail:
      jointHighestShifts.length > 1 && primaryShift === priorityShift
        ? `${jointHighestShifts.map((shift) => `${readableShift(shift)} (${textValues(shift.teamNames).join(" + ")}), scheduled: ${textValues(shift.engineerNames).join(", ")}`).join("; ")}. These shifts are joint highest at ${numberValue(priorityShift.labourRiskScore).toFixed(1)} labour risk, with ${numberValue(priorityShift.missingSkillCount)} missing required-skill gaps across ${numberValue(priorityShift.equipmentWithMissingCover)} assets.`
        : `${readableShift(primaryShift)} — ${teamNames.join(" + ")}. Scheduled engineers: ${scheduledNames.join(", ")}. Labour risk ${numberValue(primaryShift.labourRiskScore).toFixed(1)}; ${numberValue(primaryShift.missingSkillCount)} missing required-skill gaps across ${numberValue(primaryShift.equipmentWithMissingCover)} assets.`,
  });
  deterministicFindings.push({
    category: "absence",
    severity: exceptions.length ? "high" : "info",
    title: exceptions.length
      ? "Recorded holiday, training or absence"
      : "No recorded holiday, training or absence",
    detail: exceptions.length
      ? exceptions
          .slice(0, 6)
          .map(
            (item) =>
              `${item.engineerName ?? item.teamName ?? "Scheduled team"} — ${String(item.exceptionType)} on ${readableShift(item)}`,
          )
          .join("; ")
      : "No holiday, training or absence exception is recorded for this period. This does not confirm that every off-rota engineer is available.",
  });
  if (offRotaNames.length) {
    deterministicFindings.push({
      category: "cover",
      severity: "info",
      title: "Off-rota engineers — availability not confirmed",
      detail: `${readableShift(primaryShift)}: ${offRotaNames.join(", ")}. ${restConflictNames.length ? `Rest-conflict review: ${restConflictNames.join(", ")}. ` : ""}Off-rota does not mean available; confirm overtime acceptance, unrecorded leave, fatigue/rest compliance and manager approval.`,
    });
  }
  if (primarySkillRisks.length) {
    deterministicFindings.push({
      category: "skill",
      severity: "high",
      title: "Highest missing skills and affected assets",
      detail: primarySkillRisks
        .map(
          (item) =>
            `${String(item.skillName)} — ${String(item.equipmentCode ?? item.equipmentName)} (${numberValue(item.qualifiedEngineerCount)}/${numberValue(item.minimumQualifiedEngineers)} validated on shift)`,
        )
        .join("; "),
    });
  }
  if (primaryPackage) {
    const names = textValues(primaryPackage.engineerNames);
    deterministicFindings.push({
      category: "cover",
      severity: "medium",
      title: "Calculated cover-package impact",
      detail: `${readableShift(primaryPackage)} — ${names.join(", ")} fully closes ${numberValue(primaryPackage.missingSkillsClosed)} missing-skill gaps, improves ${numberValue(primaryPackage.gapsImproved)} skill-by-asset exposure points and leaves ${numberValue(primaryPackage.remainingMissingSkills)} missing-skill gaps. This is provisional, not assigned.`,
    });
    deterministicFindings.push({
      category: "skill",
      severity:
        numberValue(primaryPackage.remainingMissingSkills) > 0 ? "high" : "low",
      title: "Residual risk after proposed cover",
      detail: `${residualRiskDetail}. ${
        numberValue(primaryPackage.remainingMissingSkills) > 0
          ? "Move work requiring these competencies or arrange validated cross-shift or contractor support."
          : "Verify the revised roster before releasing planned work."
      }`,
    });
  }

  const existingFindings = records(answer.findings).filter(
    (item) =>
      ![
        "Priority shift scheduled team",
        "Priority shift and scheduled team",
        "Joint-highest-risk shifts",
        "Recorded holiday, training or absence",
        "No recorded holiday, training or absence",
        "Off-rota engineers — availability not confirmed",
        "Highest missing skills and affected assets",
        "Calculated cover-package impact",
        "Residual risk after proposed cover",
      ].includes(String(item.title)) &&
      (!broadCoverQuestion && !packageQuestion ||
        !["cover", "absence", "skill"].includes(String(item.category))),
  );
  answer.findings = [...deterministicFindings, ...existingFindings].slice(0, 10);

  if (broadCoverQuestion || packageQuestion) {
    const orderedPackageShifts = [primaryShift];
    const packageOptions = orderedPackageShifts
      .map((shift) => {
        const coverPackage = packages.find(
          (item) => coverShiftKey(item) === coverShiftKey(shift),
        );
        if (!coverPackage || textValues(coverPackage.engineerNames).length === 0) {
          return null;
        }
        return {
          engineerNames: textValues(coverPackage.engineerNames).slice(0, 4),
          shift: readableShift(coverPackage),
          reason: `Strongest calculated package for ${textValues(shift.teamNames).join(" + ")} at ${numberValue(shift.labourRiskScore).toFixed(1)} labour risk.`,
          skillsCovered: textValues(coverPackage.closedSkills).slice(0, 6),
          assetsProtected: textValues(coverPackage.protectedAssets).slice(0, 6),
          projectedImpact: `Closes ${numberValue(coverPackage.missingSkillsClosed)} of ${numberValue(shift.missingSkillCount)} missing-skill gaps; improves ${numberValue(coverPackage.gapsImproved)} skill-by-asset exposure points; protects ${numberValue(coverPackage.assetsWithClosedGaps)} assets.`,
          remainingRisk: `${numberValue(coverPackage.remainingMissingSkills)} missing-skill gaps remain across the shift.`,
          caveat:
            "Provisional only—confirm overtime acceptance, unrecorded leave, fatigue/rest compliance and manager approval.",
        };
      })
      .filter(Boolean);
    const packageEngineerNames = new Set(
      textValues(primaryPackage?.engineerNames).map((name) => name.toLowerCase()),
    );
    const rankedCandidates = coverCandidates
      .filter((item) => coverShiftKey(item) === primaryKey)
      .sort(
        (first, second) =>
          numberValue(first.candidateRank) - numberValue(second.candidateRank),
      );
    const independentCandidates = rankedCandidates.filter(
      (item) =>
        !packageEngineerNames.has(String(item.engineerName).toLowerCase()),
    );
    const alternativePool =
      independentCandidates.length > 0 ? independentCandidates : rankedCandidates;
    const alternativeOptions = alternativePool.slice(0, 3).map((candidate) => ({
      engineerNames: [String(candidate.engineerName)],
      shift: readableShift(candidate),
      reason: `Ranked individual fallback${candidate.discipline ? ` — ${String(candidate.discipline)}` : ""}.`,
      skillsCovered: textValues(candidate.topSkills).slice(0, 6),
      assetsProtected: textValues(candidate.topAssets).slice(0, 6),
      projectedImpact: `Closes ${numberValue(candidate.gapsClosed)} gaps and improves ${numberValue(candidate.gapsImproved)} skill-by-asset exposure points.`,
      remainingRisk: `${numberValue(candidate.remainingMissingSkills)} missing-skill gaps remain with this individual option.`,
      caveat: `${String(candidate.availabilityStatus ?? "Availability unconfirmed")}. ${
        candidate.restConflict
          ? "Rest conflict recorded—do not assign until resolved."
          : "Confirm overtime acceptance, unrecorded leave, fatigue/rest compliance and manager approval."
      }`,
    }));
    answer.coverOptions = [...packageOptions, ...alternativeOptions].slice(0, 4);
  }

  if (broadCoverQuestion && primaryPackage) {
    const reducedCount = calendar.filter(
      (shift) => shift.coverageStatus !== "covered",
    ).length;
    const highestLabels = jointHighestShifts
      .map(
        (shift) =>
          `${textValues(shift.teamNames).join(" + ")} ${readableShift(shift)}`,
      )
      .join(" and ");
    const packageNames = textValues(primaryPackage.engineerNames);
    const scheduledForHighestRisk = [
      ...new Set(
        jointHighestShifts.flatMap((shift) => textValues(shift.engineerNames)),
      ),
    ];
    const skillsGapCount = calendar.filter(
      (shift) => numberValue(shift.missingSkillCount) > 0,
    ).length;
    answer.directAnswer =
      `Yes—${skillsGapCount} of ${calendar.length} shifts have insufficient validated skill coverage; ` +
      `${reducedCount} also have reduced or non-standard rota cover.`;
    answer.decisionSummary = [
      {
        label: "Highest risk",
        value: `${highestLabels}; ${numberValue(priorityShift.labourRiskScore).toFixed(1)} labour risk, ${numberValue(priorityShift.missingSkillCount)} missing-skill gaps across ${numberValue(priorityShift.equipmentWithMissingCover)} assets.`,
      },
      {
        label: "Scheduled",
        value: scheduledForHighestRisk.join(", "),
      },
      {
        label: "Absence",
        value: exceptions.length
          ? `${exceptions.length} recorded holiday, training or absence exception${exceptions.length === 1 ? "" : "s"}.`
          : "None recorded. Confirm unrecorded leave or rota changes before offering overtime.",
      },
      {
        label: "Best provisional cover",
        value: `${packageNames.join(", ")} for ${readableShift(primaryPackage)}.`,
      },
      {
        label: "Calculated impact",
        value: `Closes ${numberValue(primaryPackage.missingSkillsClosed)} of ${numberValue(primaryShift.missingSkillCount)} missing-skill gaps; ${numberValue(primaryPackage.remainingMissingSkills)} remain.`,
      },
      {
        label: "Residual risk",
        value: residualRiskDetail,
      },
      {
        label: "First action",
        value: "Confirm overtime acceptance, unrecorded leave, fatigue/rest compliance and manager approval.",
      },
    ];
  }

  if (packageQuestion && primaryPackage) {
    const packageNames = textValues(primaryPackage.engineerNames);
    answer.directAnswer = `Best provisional cover for ${readableShift(primaryPackage)} is ${packageNames.join(", ")}.`;
    answer.decisionSummary = [
      {
        label: "Cover package",
        value: packageNames.join(", "),
      },
      {
        label: "Calculated impact",
        value: `Closes ${numberValue(primaryPackage.missingSkillsClosed)} of ${numberValue(primaryShift.missingSkillCount)} missing-skill gaps, improves ${numberValue(primaryPackage.gapsImproved)} skill-by-asset exposure points and leaves ${numberValue(primaryPackage.remainingMissingSkills)} gaps.`,
      },
      {
        label: "Residual risk",
        value: residualRiskDetail,
      },
      {
        label: "Status",
        value: "Off-rota candidates—not confirmed available or assigned.",
      },
      {
        label: "First action",
        value: "Confirm overtime acceptance, unrecorded leave, fatigue/rest compliance and manager approval.",
      },
    ];
  }

  if ((broadCoverQuestion || packageQuestion) && primaryPackage) {
    const packageNames = textValues(primaryPackage.engineerNames);
    const namedAction = {
      priority: "now",
      action: `Contact ${packageNames.join(", ")} for provisional cover of ${readableShift(primaryPackage)}.`,
      owner: "Maintenance Manager",
      expectedImpact: `Close ${numberValue(primaryPackage.missingSkillsClosed)} of ${numberValue(primaryShift.missingSkillCount)} missing-skill gaps; ${numberValue(primaryPackage.remainingMissingSkills)} remain.`,
      verification:
        "Confirm each engineer's acceptance and rest compliance, update the rota, then re-run Shift Cover.",
    };
    answer.actionPlan = [
      namedAction,
      {
        priority: "before_shift",
        action:
          "Confirm overtime acceptance, unrecorded leave, fatigue/rest compliance and manager approval for every proposed engineer.",
        owner: "Shift Supervisor",
        expectedImpact: "Converts the provisional package into a safe, auditable cover decision.",
        verification:
          "Record each acceptance and confirm the final named roster at handover.",
      },
      {
        priority: "before_shift",
        action:
          numberValue(primaryPackage.remainingMissingSkills) > 0
            ? `Move work relying on the ${numberValue(primaryPackage.remainingMissingSkills)} residual gaps or arrange validated cross-shift or contractor support.`
            : "Verify the revised team covers every required asset skill before releasing the plan.",
        owner: "Maintenance Planner",
        expectedImpact:
          "Prevents planned work from relying on competencies that remain uncovered.",
        verification:
          "Compare the released work plan with the residual skill-by-asset list after re-running Shift Cover.",
      },
    ];
    answer.recommendedActions = [
      namedAction.action,
      ...(Array.isArray(answer.recommendedActions)
        ? answer.recommendedActions.filter(
            (item): item is string =>
              typeof item === "string" && !/\bcontact\b/i.test(item),
      )
        : []),
    ].slice(0, 6);
    answer.followUpQuestions = [
      "Which skills and assets remain uncovered after this package?",
      `Show alternative cover if ${packageNames.join(", ")} are unavailable.`,
      "Which planned work should move away from the highest-risk shift?",
      "Show every shift with reduced rota or insufficient skills coverage.",
    ];
  }
  answer.evidenceGeneratedAt =
    typeof shiftCoverEvidence.sourceUpdatedAt === "string"
      ? shiftCoverEvidence.sourceUpdatedAt
      : typeof shiftCoverEvidence.generatedAt === "string"
        ? shiftCoverEvidence.generatedAt
        : undefined;
  answer.confidence = coverEvidenceConfidence(
    shiftCoverEvidence,
    primaryShift,
    primaryPackage,
    primarySkillRisks,
    offRotaNames,
  );
  enforceReadOnlyWriteBoundary(answer, question);
}
