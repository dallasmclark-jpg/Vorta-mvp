import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  AskVortaRequest,
  JsonRecord,
  ToolResult,
} from "./contracts.mjs";

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 24 * 60 * 60 * 1_000;
const MAX_LATEST_SNAPSHOT_AGE_DAYS = 2;

interface SiteRiskSnapshot {
  snapshotDate: string;
  riskScore: number;
  riskLevel: string;
  highestArea: string;
  highestAreaScore: number;
  atRiskAssets: number;
  overduePmCount: number;
  calibrationBacklogCount: number;
  coverGapCount: number;
  operationalRiskScore: number;
  labourRiskScore: number;
  scheduledEngineerCount: number;
  labourShiftType: string;
  createdAt: string;
}

function finiteNumber(value: unknown): number {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function localDate(timezone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function dateDifferenceDays(later: string, earlier: string): number | null {
  if (!DATE_ONLY_PATTERN.test(later) || !DATE_ONLY_PATTERN.test(earlier)) {
    return null;
  }
  const laterTime = Date.parse(`${later}T12:00:00Z`);
  const earlierTime = Date.parse(`${earlier}T12:00:00Z`);
  if (!Number.isFinite(laterTime) || !Number.isFinite(earlierTime)) return null;
  return Math.round((laterTime - earlierTime) / DAY_MS);
}

function normaliseSnapshot(row: JsonRecord): SiteRiskSnapshot | null {
  const snapshotDate = stringValue(row.snapshot_date);
  if (!DATE_ONLY_PATTERN.test(snapshotDate)) return null;
  return {
    snapshotDate,
    riskScore: finiteNumber(row.risk_score),
    riskLevel: stringValue(row.risk_level) || "Not recorded",
    highestArea: stringValue(row.highest_area) || "Not recorded",
    highestAreaScore: finiteNumber(row.highest_area_score),
    atRiskAssets: finiteNumber(row.at_risk_assets),
    overduePmCount: finiteNumber(row.overdue_pm_count),
    calibrationBacklogCount: finiteNumber(row.calibration_backlog_count),
    coverGapCount: finiteNumber(row.cover_gap_count),
    operationalRiskScore: finiteNumber(row.operational_risk_score),
    labourRiskScore: finiteNumber(row.labour_risk_score),
    scheduledEngineerCount: finiteNumber(row.scheduled_engineer_count),
    labourShiftType: stringValue(row.labour_shift_type) || "Not recorded",
    createdAt: stringValue(row.created_at),
  };
}

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function readableDate(value: string): string {
  if (!DATE_ONLY_PATTERN.test(value)) return value;
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "UTC",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(`${value}T12:00:00Z`));
}

function signed(value: number, digits = 1): string {
  const rounded = value.toFixed(digits);
  return value > 0 ? `+${rounded}` : rounded;
}

function formatted(value: number, integer: boolean): string {
  return integer ? String(Math.round(value)) : value.toFixed(1);
}

export function siteRiskMovementQuestionPlan(
  request: AskVortaRequest,
): JsonRecord | null {
  if (request.image) return null;
  const question = request.question
    .trim()
    .toLowerCase()
    .replace(/[’']/g, "'")
    .replace(/\s+/g, " ");
  const explicitSiteRisk =
    /\b(?:site|overall|maintenance|risk|today|yesterday|daily|day)\b/.test(
      question,
    );
  const bareChangeQuestion =
    /^(?:what(?:'s| has| is)? changed|what changed|anything changed)\??$/.test(
      question,
    );
  const asksForMovement =
    bareChangeQuestion ||
    /\bwhat(?:'s| has| is)? changed\b/.test(question) ||
    /\bwhat changed since (?:yesterday|today|the last shift|last shift|the previous shift|previous shift)\b/.test(
      question,
    ) ||
    /\bcompare (?:today|the latest|current risk) (?:with|to|against) (?:yesterday|the previous day|the prior day)\b/.test(
      question,
    ) ||
    /\b(?:has|is|did) (?:the )?(?:site |overall )?risk (?:got|get|become|gone|go|move|changed|change|worsened|improved|worse|better)\b/.test(
      question,
    ) ||
    /\b(?:is|was) (?:the )?(?:site |overall )?risk (?:worse|better|higher|lower)\b/.test(
      question,
    );
  if (!asksForMovement) return null;

  const equipmentPage = /\/equipment(?:\/|$)/.test(request.pageContext.path);
  const shiftHandoverPage = /\/shift-handover(?:\/|$)/.test(
    request.pageContext.path,
  );
  if (equipmentPage && !explicitSiteRisk) return null;
  if (shiftHandoverPage && !explicitSiteRisk && !bareChangeQuestion) return null;

  const requestedShiftComparison =
    /\b(?:last|previous) shift\b/.test(question) ||
    /\bshift[- ]level\b/.test(question);

  return {
    routingMode: "deterministic",
    scope: "site_change",
    intentLabel: "site_risk_movement",
    decisionGoal: request.question,
    shouldUseTools: true,
    requiredTools: ["get_site_risk_movement"],
    optionalTools: [],
    equipmentQuery: "",
    startDate: "",
    endDate: "",
    ambiguity: "none",
    answerFocus:
      "Compare the latest two verified daily site-risk snapshots, rank material movement, state unchanged metrics and fail closed on shift-level precision or unsupported causation.",
    verificationChecks: [
      "Use only site-scoped daily risk history visible through authenticated row-level security.",
      "State exact snapshot dates and never describe daily history as a previous-shift comparison.",
      "Report movement without inventing its cause.",
    ],
    summaryItemLimit: 5,
    forceActionPlan: false,
    followUpLimit: 1,
    requestedShiftComparison,
  };
}

export async function loadSiteRiskMovement(
  supabase: SupabaseClient,
  request: AskVortaRequest,
): Promise<ToolResult> {
  const { data, error } = await supabase
    .from("site_risk_history")
    .select(
      "snapshot_date,risk_score,risk_level,highest_area,highest_area_score,at_risk_assets,overdue_pm_count,calibration_backlog_count,cover_gap_count,operational_risk_score,labour_risk_score,scheduled_engineer_count,labour_shift_type,created_at",
    )
    .eq("site_id", request.siteId)
    .order("snapshot_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) {
    return {
      source: "Verified daily site risk history",
      status: "unavailable",
      message: error.message,
    };
  }

  const distinct = new Map<string, SiteRiskSnapshot>();
  for (const value of data ?? []) {
    const snapshot = normaliseSnapshot(value as JsonRecord);
    if (snapshot && !distinct.has(snapshot.snapshotDate)) {
      distinct.set(snapshot.snapshotDate, snapshot);
    }
  }
  const snapshots = [...distinct.values()].sort((left, right) =>
    right.snapshotDate.localeCompare(left.snapshotDate),
  );

  if (snapshots.length < 2) {
    return {
      source: "Verified daily site risk history",
      status: "empty",
      data: {
        comparisonBasis: "daily",
        snapshotCount: snapshots.length,
        shiftLevelAvailable: false,
      },
      message:
        "At least two distinct authorised daily site-risk snapshots are required to prove movement.",
    };
  }

  const current = snapshots[0];
  const previous = snapshots[1];
  const dayGap = dateDifferenceDays(current.snapshotDate, previous.snapshotDate);
  const latestAgeDays = dateDifferenceDays(
    localDate(request.pageContext.timezone),
    current.snapshotDate,
  );
  if (dayGap === null || dayGap <= 0 || latestAgeDays === null) {
    return {
      source: "Verified daily site risk history",
      status: "unavailable",
      message:
        "The authorised site-risk history contains invalid or non-sequential snapshot dates.",
    };
  }
  if (latestAgeDays > MAX_LATEST_SNAPSHOT_AGE_DAYS) {
    return {
      source: "Verified daily site risk history",
      status: "unavailable",
      data: {
        comparisonBasis: "daily",
        latestSnapshotDate: current.snapshotDate,
        latestAgeDays,
        shiftLevelAvailable: false,
      },
      message:
        `The newest authorised site-risk snapshot is ${latestAgeDays} days old, so Ask Vorta cannot describe it as current movement.`,
    };
  }

  return {
    source: "Verified daily site risk history",
    status: "ok",
    data: {
      comparisonBasis: "daily",
      shiftLevelAvailable: false,
      dayGap,
      latestAgeDays,
      current,
      previous,
      caveat:
        "These records prove daily site-risk movement only. They do not prove shift-level movement or the cause of a change.",
    },
  };
}

export function siteRiskMovementAnswer(
  request: AskVortaRequest,
  questionPlan: JsonRecord | null,
  outcomes: Map<string, ToolResult>,
): JsonRecord | null {
  if (questionPlan?.routingMode !== "deterministic") return null;
  if (questionPlan.intentLabel !== "site_risk_movement") return null;

  const outcome = outcomes.get("get_site_risk_movement");
  const requestedShiftComparison =
    questionPlan.requestedShiftComparison === true;
  const generatedAt = new Date().toISOString();
  const unavailableMessage =
    outcome?.message ||
    "Two current authorised daily site-risk snapshots were not available.";

  const base = {
    findings: [] as JsonRecord[],
    coverOptions: [] as JsonRecord[],
    recommendedActions: [] as string[],
    actionPlan: [] as JsonRecord[],
    followUpQuestions: [] as string[],
    sources: [] as string[],
    toolsUsed: [] as string[],
    evidenceLinks: [] as JsonRecord[],
    evidenceGeneratedAt: generatedAt,
    intentLabel: "site_risk_movement",
  };

  if (outcome?.status !== "ok" || !isRecord(outcome.data)) {
    return {
      ...base,
      directAnswer:
        `Ask Vorta cannot prove how site risk changed: ${unavailableMessage}`,
      decisionSummary: [
        {
          label: "Comparison unavailable",
          value: unavailableMessage,
        },
        {
          label: "Evidence boundary",
          value:
            "No movement, shift comparison or cause has been inferred from missing or stale history.",
        },
      ],
      evidence: [],
      findings: [{
        category: "data",
        severity: "high",
        title: "Verified comparison unavailable",
        detail: unavailableMessage,
      }],
      missingData: [
        unavailableMessage,
        ...(requestedShiftComparison
          ? [
              "No verified shift-level site-risk snapshot is available; daily history must not be represented as the previous shift.",
            ]
          : []),
      ],
      confidence: 35,
    };
  }

  const current = isRecord(outcome.data.current)
    ? (outcome.data.current as unknown as SiteRiskSnapshot)
    : null;
  const previous = isRecord(outcome.data.previous)
    ? (outcome.data.previous as unknown as SiteRiskSnapshot)
    : null;
  if (!current || !previous) {
    return {
      ...base,
      directAnswer:
        "Ask Vorta cannot prove how site risk changed because the authorised comparison rows were incomplete.",
      decisionSummary: [{
        label: "Comparison unavailable",
        value: "Current and previous daily snapshot values were not both returned.",
      }],
      evidence: [],
      missingData: [
        "Current and previous daily snapshot values were not both returned.",
      ],
      confidence: 35,
    };
  }

  const metrics = [
    {
      key: "riskScore",
      label: "Site risk score",
      current: current.riskScore,
      previous: previous.riskScore,
      integer: false,
    },
    {
      key: "operationalRiskScore",
      label: "Operational risk",
      current: current.operationalRiskScore,
      previous: previous.operationalRiskScore,
      integer: false,
    },
    {
      key: "labourRiskScore",
      label: "Labour risk",
      current: current.labourRiskScore,
      previous: previous.labourRiskScore,
      integer: false,
    },
    {
      key: "highestAreaScore",
      label: "Highest-area score",
      current: current.highestAreaScore,
      previous: previous.highestAreaScore,
      integer: false,
    },
    {
      key: "atRiskAssets",
      label: "At-risk assets",
      current: current.atRiskAssets,
      previous: previous.atRiskAssets,
      integer: true,
    },
    {
      key: "overduePmCount",
      label: "Overdue PMs",
      current: current.overduePmCount,
      previous: previous.overduePmCount,
      integer: true,
    },
    {
      key: "calibrationBacklogCount",
      label: "Calibration backlog",
      current: current.calibrationBacklogCount,
      previous: previous.calibrationBacklogCount,
      integer: true,
    },
    {
      key: "coverGapCount",
      label: "Cover gaps",
      current: current.coverGapCount,
      previous: previous.coverGapCount,
      integer: true,
    },
    {
      key: "scheduledEngineerCount",
      label: "Scheduled engineers",
      current: current.scheduledEngineerCount,
      previous: previous.scheduledEngineerCount,
      integer: true,
    },
  ].map((metric) => ({
    ...metric,
    delta: metric.current - metric.previous,
  }));

  const riskDelta = current.riskScore - previous.riskScore;
  const direction =
    riskDelta > 0.05
      ? "worsened"
      : riskDelta < -0.05
        ? "improved"
        : "remained effectively stable";
  const changes = metrics
    .filter((metric) => Math.abs(metric.delta) > 0.0001)
    .sort((left, right) => Math.abs(right.delta) - Math.abs(left.delta));
  const unchanged = metrics.filter(
    (metric) => Math.abs(metric.delta) <= 0.0001,
  );
  const topChange = changes.find((item) => item.key !== "riskScore");
  const currentDate = readableDate(current.snapshotDate);
  const previousDate = readableDate(previous.snapshotDate);
  const shiftBoundary = requestedShiftComparison
    ? " No verified shift-level site-risk snapshot exists, so this is a daily comparison rather than a previous-shift comparison."
    : "";
  const topChangeText = topChange
    ? ` The largest recorded metric movement was ${topChange.label.toLowerCase()}, ${formatted(topChange.previous, topChange.integer)} → ${formatted(topChange.current, topChange.integer)} (${signed(topChange.delta, topChange.integer ? 0 : 1)}).`
    : " No supporting metric changed in the two returned daily snapshots.";

  return {
    ...base,
    directAnswer:
      `Verified daily site risk ${direction} from ${current.riskScore.toFixed(1)} on ${previousDate} to ${current.riskScore.toFixed(1)} on ${currentDate} (${signed(riskDelta)}).${topChangeText}${shiftBoundary}`
        .replace(
          `from ${current.riskScore.toFixed(1)} on ${previousDate}`,
          `from ${previous.riskScore.toFixed(1)} on ${previousDate}`,
        ),
    decisionSummary: [
      {
        label: "Overall movement",
        value:
          `${previous.riskScore.toFixed(1)} ${previous.riskLevel} on ${previousDate} → ${current.riskScore.toFixed(1)} ${current.riskLevel} on ${currentDate} (${signed(riskDelta)}).`,
      },
      ...changes
        .filter((item) => item.key !== "riskScore")
        .slice(0, 2)
        .map((item) => ({
          label: item.label,
          value:
            `${formatted(item.previous, item.integer)} → ${formatted(item.current, item.integer)} (${signed(item.delta, item.integer ? 0 : 1)}).`,
        })),
      {
        label: "Highest-risk area",
        value:
          `${previous.highestArea} ${previous.highestAreaScore.toFixed(1)} → ${current.highestArea} ${current.highestAreaScore.toFixed(1)}.`,
      },
      {
        label: "Unchanged / evidence boundary",
        value:
          `${unchanged.length ? unchanged.map((item) => item.label.toLowerCase()).join(", ") + " did not change. " : ""}Daily snapshots prove movement, not its cause${requestedShiftComparison ? ", and no verified shift-level comparison is available" : ""}.`,
      },
    ].slice(0, 5),
    evidence: metrics.map(
      (item) =>
        `${item.label}: ${formatted(item.previous, item.integer)} on ${previous.snapshotDate} → ${formatted(item.current, item.integer)} on ${current.snapshotDate} (${signed(item.delta, item.integer ? 0 : 1)}).`,
    ),
    findings: changes.slice(0, 5).map((item, index) => ({
      category: "risk",
      severity:
        index === 0 && direction === "worsened"
          ? "high"
          : Math.abs(item.delta) > 0
            ? "medium"
            : "info",
      title: item.label,
      detail:
        `${formatted(item.previous, item.integer)} on ${previousDate} → ${formatted(item.current, item.integer)} on ${currentDate} (${signed(item.delta, item.integer ? 0 : 1)}).`,
    })),
    missingData: [
      "The daily snapshots do not prove which work, spare, skill, absence or equipment event caused the movement.",
      ...(requestedShiftComparison
        ? [
            "No verified shift-level site-risk snapshot is available; the comparison uses the latest two distinct daily snapshots.",
          ]
        : []),
    ],
    confidence: requestedShiftComparison ? 82 : 90,
  };
}
