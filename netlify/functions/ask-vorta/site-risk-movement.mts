import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  AskVortaRequest,
  JsonRecord,
  ToolResult,
} from "./contracts.mjs";

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 24 * 60 * 60 * 1_000;
const MAX_LATEST_SNAPSHOT_AGE_DAYS = 2;
const SITE_RISK_MOVEMENT_MAX_ROWS = 60;

const MONTH_NUMBERS: Record<string, string> = {
  january: "01",
  jan: "01",
  february: "02",
  feb: "02",
  march: "03",
  mar: "03",
  april: "04",
  apr: "04",
  may: "05",
  june: "06",
  jun: "06",
  july: "07",
  jul: "07",
  august: "08",
  aug: "08",
  september: "09",
  sep: "09",
  sept: "09",
  october: "10",
  oct: "10",
  november: "11",
  nov: "11",
  december: "12",
  dec: "12",
};

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

interface RequestedDateRange {
  startDate: string;
  endDate: string;
}

interface VerifiedPmDriverRecord {
  pmNumber: string;
  title: string;
  dueDate: string;
  criticality: string;
  status: string;
  equipmentId: string;
  equipmentCode: string;
  equipmentName: string;
  area: string;
}

interface PmDriverVerification {
  verificationState:
    | "verified"
    | "count_mismatch"
    | "unavailable"
    | "no_pm_increase"
    | "non_consecutive";
  snapshotOverduePmDelta: number;
  matchedRecordCount: number;
  matchedRecords: VerifiedPmDriverRecord[];
  message: string;
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

function requestedDateRange(
  question: string,
  timezone: string,
): RequestedDateRange | null {
  const isoDates = [...question.matchAll(/\b(20\d{2}-\d{2}-\d{2})\b/g)]
    .map((match) => match[1])
    .filter((value) => DATE_ONLY_PATTERN.test(value));
  if (isoDates.length >= 2) {
    return isoDates[0] <= isoDates[1]
      ? { startDate: isoDates[0], endDate: isoDates[1] }
      : { startDate: isoDates[1], endDate: isoDates[0] };
  }

  const fallbackYear = Number(localDate(timezone).slice(0, 4));
  const naturalDates = [...question.toLowerCase().matchAll(
    /\b(\d{1,2})(?:st|nd|rd|th)?\s+(january|jan|february|feb|march|mar|april|apr|may|june|jun|july|jul|august|aug|september|sept|sep|october|oct|november|nov|december|dec)(?:\s+(20\d{2}))?\b/g,
  )]
    .map((match) => {
      const day = Number(match[1]);
      const month = MONTH_NUMBERS[match[2]];
      const year = Number(match[3] ?? fallbackYear);
      if (!month || !Number.isInteger(day) || day < 1 || day > 31) return "";
      const value = `${year}-${month}-${String(day).padStart(2, "0")}`;
      const parsed = new Date(`${value}T12:00:00Z`);
      return Number.isFinite(parsed.getTime()) &&
        parsed.getUTCDate() === day &&
        parsed.getUTCMonth() + 1 === Number(month)
        ? value
        : "";
    })
    .filter(Boolean);

  if (naturalDates.length < 2) return null;
  return naturalDates[0] <= naturalDates[1]
    ? { startDate: naturalDates[0], endDate: naturalDates[1] }
    : { startDate: naturalDates[1], endDate: naturalDates[0] };
}

function pmDriverFromOutcome(value: unknown): PmDriverVerification | null {
  if (!isRecord(value)) return null;
  const verificationState = stringValue(value.verificationState);
  if (![
    "verified",
    "count_mismatch",
    "unavailable",
    "no_pm_increase",
    "non_consecutive",
  ].includes(verificationState)) {
    return null;
  }
  return {
    verificationState: verificationState as PmDriverVerification["verificationState"],
    snapshotOverduePmDelta: finiteNumber(value.snapshotOverduePmDelta),
    matchedRecordCount: finiteNumber(value.matchedRecordCount),
    matchedRecords: Array.isArray(value.matchedRecords)
      ? value.matchedRecords.filter(isRecord).map((record) => ({
          pmNumber: stringValue(record.pmNumber),
          title: stringValue(record.title),
          dueDate: stringValue(record.dueDate),
          criticality: stringValue(record.criticality),
          status: stringValue(record.status),
          equipmentId: stringValue(record.equipmentId),
          equipmentCode: stringValue(record.equipmentCode),
          equipmentName: stringValue(record.equipmentName),
          area: stringValue(record.area),
        }))
      : [],
    message: stringValue(value.message),
  };
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
  const siteRiskPhrase =
    "(?:(?:overall|maintenance) site |(?:site|overall|maintenance) )?risk";
  const asksForCause =
    /\b(?:why|what caused|what drove|what is behind|what's behind)\b.*\b(?:(?:overall|maintenance)\s+site\s+risk|site\s+risk|overall\s+risk)\b/.test(
      question,
    ) ||
    /\b(?:(?:overall|maintenance)\s+site\s+risk|site\s+risk|overall\s+risk)\b.*\b(?:cause|caused|driver|drove|behind|why)\b/.test(
      question,
    );
  const asksForMovement =
    asksForCause ||
    bareChangeQuestion ||
    /\bwhat(?:'s| has| is)? changed\b/.test(question) ||
    /\bwhat changed since (?:yesterday|today|the last shift|last shift|the previous shift|previous shift)\b/.test(
      question,
    ) ||
    /\bcompare (?:today(?:'s)?(?: site)? risk|today|the latest(?: site)? risk|current(?: site)? risk) (?:with|to|against) (?:yesterday|the previous day|the prior day)\b/.test(
      question,
    ) ||
    new RegExp(
      `\\b(?:has|is|did) (?:the )?${siteRiskPhrase} (?:got|gotten|get|become|gone|go|move|changed|change|worsened|improved|worse|better)\\b`,
    ).test(question) ||
    new RegExp(
      `\\b(?:is|was) (?:the )?${siteRiskPhrase} (?:worse|better|higher|lower)\\b`,
    ).test(question);
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
  const explicitRange = requestedDateRange(question, request.pageContext.timezone);

  return {
    routingMode: "deterministic",
    scope: "site_change",
    intentLabel: "site_risk_movement",
    decisionGoal: request.question,
    shouldUseTools: true,
    requiredTools: ["get_site_risk_movement"],
    optionalTools: [],
    equipmentQuery: "",
    startDate: explicitRange?.startDate ?? "",
    endDate: explicitRange?.endDate ?? "",
    ambiguity: "none",
    answerFocus:
      "Compare two verified daily site-risk snapshots and explain a positive overdue-PM movement only when exact site-scoped PM due-date crossings reconcile to the snapshot delta. Never generalise that verified PM component into proof of every cause of the overall risk score.",
    verificationChecks: [
      "Use only site-scoped daily risk history and PM/equipment records visible through authenticated row-level security.",
      "State exact snapshot dates and never describe daily history as a previous-shift comparison.",
      "Claim a recorded PM driver only when consecutive daily snapshots, due-date crossings and the overdue-PM count reconcile exactly.",
      "If record counts disagree or other metrics lack record-level evidence, state the mismatch and do not claim verified causation.",
    ],
    summaryItemLimit: 5,
    forceActionPlan: false,
    followUpLimit: 1,
    requestedShiftComparison,
    asksForCause,
  };
}

async function verifyPmDriver(
  supabase: SupabaseClient,
  request: AskVortaRequest,
  previous: SiteRiskSnapshot,
  current: SiteRiskSnapshot,
  dayGap: number,
): Promise<PmDriverVerification> {
  const snapshotOverduePmDelta = Math.round(
    current.overduePmCount - previous.overduePmCount,
  );
  if (dayGap !== 1) {
    return {
      verificationState: "non_consecutive",
      snapshotOverduePmDelta,
      matchedRecordCount: 0,
      matchedRecords: [],
      message:
        "The selected daily snapshots are not consecutive, so PM due-date crossings cannot be reconciled safely to the overdue-PM movement.",
    };
  }
  if (snapshotOverduePmDelta <= 0) {
    return {
      verificationState: "no_pm_increase",
      snapshotOverduePmDelta,
      matchedRecordCount: 0,
      matchedRecords: [],
      message:
        "There is no positive overdue-PM count movement to explain between these two daily snapshots.",
    };
  }

  const { data: pmData, error: pmError } = await supabase
    .from("preventive_maintenance")
    .select(
      "id,equipment_id,pm_number,title,next_due_date,criticality,status",
    )
    .eq("site_id", request.siteId)
    .gte("next_due_date", previous.snapshotDate)
    .lt("next_due_date", current.snapshotDate)
    .order("next_due_date", { ascending: true })
    .order("pm_number", { ascending: true });

  if (pmError) {
    return {
      verificationState: "unavailable",
      snapshotOverduePmDelta,
      matchedRecordCount: 0,
      matchedRecords: [],
      message:
        `The overdue-PM count increased by ${snapshotOverduePmDelta}, but the site-scoped PM crossing records could not be read, so no verified PM cause is claimed.`,
    };
  }

  const pmRows = (pmData ?? []).filter(isRecord);
  const equipmentIds = [...new Set(
    pmRows.map((row) => stringValue(row.equipment_id)).filter(Boolean),
  )];
  if (equipmentIds.length === 0 && pmRows.length > 0) {
    return {
      verificationState: "unavailable",
      snapshotOverduePmDelta,
      matchedRecordCount: pmRows.length,
      matchedRecords: [],
      message:
        "PM due-date crossings were found, but their equipment identities could not be verified inside the authorised site context, so no verified PM cause is claimed.",
    };
  }

  let equipmentById = new Map<string, JsonRecord>();
  if (equipmentIds.length > 0) {
    const { data: equipmentData, error: equipmentError } = await supabase
      .from("equipment_assets")
      .select("id,equipment_code,name,area")
      .eq("site_id", request.siteId)
      .in("id", equipmentIds);
    if (equipmentError) {
      return {
        verificationState: "unavailable",
        snapshotOverduePmDelta,
        matchedRecordCount: pmRows.length,
        matchedRecords: [],
        message:
          "PM due-date crossings were found, but the linked equipment could not be verified inside the authorised site context, so no verified PM cause is claimed.",
      };
    }
    equipmentById = new Map(
      (equipmentData ?? [])
        .filter(isRecord)
        .map((row) => [stringValue(row.id), row]),
    );
  }

  const matchedRecords: VerifiedPmDriverRecord[] = [];
  for (const row of pmRows) {
    const equipmentId = stringValue(row.equipment_id);
    const equipment = equipmentById.get(equipmentId);
    if (!equipment) continue;
    const equipmentCode = stringValue(equipment.equipment_code);
    const equipmentName = stringValue(equipment.name);
    const area = stringValue(equipment.area);
    const pmNumber = stringValue(row.pm_number);
    const title = stringValue(row.title);
    const dueDate = stringValue(row.next_due_date);
    if (!pmNumber || !title || !DATE_ONLY_PATTERN.test(dueDate) ||
        !equipmentCode || !equipmentName || !area) {
      continue;
    }
    matchedRecords.push({
      pmNumber,
      title,
      dueDate,
      criticality: stringValue(row.criticality) || "Not recorded",
      status: stringValue(row.status) || "Not recorded",
      equipmentId,
      equipmentCode,
      equipmentName,
      area,
    });
  }

  const matchedRecordCount = matchedRecords.length;
  if (
    matchedRecordCount !== pmRows.length ||
    matchedRecordCount !== snapshotOverduePmDelta
  ) {
    return {
      verificationState: "count_mismatch",
      snapshotOverduePmDelta,
      matchedRecordCount,
      matchedRecords,
      message:
        `The overdue-PM count increased by ${snapshotOverduePmDelta}, but ${matchedRecordCount} fully verified site-scoped PM crossing record${matchedRecordCount === 1 ? "" : "s"} were found. The counts do not reconcile, so Ask Vorta will not claim a verified PM cause.`,
    };
  }

  return {
    verificationState: "verified",
    snapshotOverduePmDelta,
    matchedRecordCount,
    matchedRecords,
    message:
      `${matchedRecordCount} site-scoped PM record${matchedRecordCount === 1 ? "" : "s"} crossed from due to overdue between the snapshots and exactly reconcile to the +${snapshotOverduePmDelta} overdue-PM count movement.`,
  };
}

export async function loadSiteRiskMovement(
  supabase: SupabaseClient,
  request: AskVortaRequest,
): Promise<ToolResult> {
  const explicitRange = requestedDateRange(
    request.question,
    request.pageContext.timezone,
  );
  const { data, error } = await supabase
    .from("site_risk_history")
    .select(
      "snapshot_date,risk_score,risk_level,highest_area,highest_area_score,at_risk_assets,overdue_pm_count,calibration_backlog_count,cover_gap_count,operational_risk_score,labour_risk_score,scheduled_engineer_count,labour_shift_type,created_at",
    )
    .eq("site_id", request.siteId)
    .order("snapshot_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(SITE_RISK_MOVEMENT_MAX_ROWS);

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

  let current: SiteRiskSnapshot | undefined;
  let previous: SiteRiskSnapshot | undefined;
  if (explicitRange) {
    previous = distinct.get(explicitRange.startDate);
    current = distinct.get(explicitRange.endDate);
    if (!current || !previous) {
      return {
        source: "Verified daily site risk history",
        status: "empty",
        data: {
          comparisonBasis: "daily",
          requestedStartDate: explicitRange.startDate,
          requestedEndDate: explicitRange.endDate,
          shiftLevelAvailable: false,
        },
        message:
          `Both requested authorised daily site-risk snapshots (${explicitRange.startDate} and ${explicitRange.endDate}) are required to prove movement.`,
      };
    }
  } else {
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
    current = snapshots[0];
    previous = snapshots[1];
  }

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
  if (!explicitRange && latestAgeDays > MAX_LATEST_SNAPSHOT_AGE_DAYS) {
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

  const pmDriver = await verifyPmDriver(
    supabase,
    request,
    previous,
    current,
    dayGap,
  );

  return {
    source: "Verified daily site risk history",
    status: "ok",
    data: {
      comparisonBasis: "daily",
      comparisonMode: explicitRange ? "requested_daily_range" : "latest_daily",
      shiftLevelAvailable: false,
      dayGap,
      latestAgeDays,
      current,
      previous,
      pmDriver,
      caveat:
        "Daily snapshots prove movement, not its cause unless a specific record-level component is independently reconciled. A verified PM driver proves only the overdue-PM count movement and does not prove every cause of the overall risk score.",
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
  const pmDriver = pmDriverFromOutcome(outcome.data.pmDriver);

  let pmDriverText = "";
  let pmDriverSummary: JsonRecord | null = null;
  let pmEvidence: string[] = [];
  let pmFindings: JsonRecord[] = [];
  let causeBoundary =
    "The daily snapshots do not prove which work, spare, skill, absence or equipment event caused the movement.";

  if (pmDriver?.verificationState === "verified") {
    const recordText = pmDriver.matchedRecords
      .map((record) => `${record.pmNumber} (${record.equipmentCode}, ${record.area})`)
      .join("; ");
    pmDriverText =
      ` The recorded PM driver of the overdue-count movement is verified: ${pmDriver.matchedRecordCount} PM${pmDriver.matchedRecordCount === 1 ? "" : "s"} crossed into overdue and exactly reconcile to the +${pmDriver.snapshotOverduePmDelta} snapshot movement: ${recordText}. This verifies the overdue-PM component only; it does not prove every cause of the overall site-risk score change.`;
    pmDriverSummary = {
      label: "Verified PM driver",
      value:
        `${pmDriver.matchedRecordCount} exact PM due-date crossing${pmDriver.matchedRecordCount === 1 ? "" : "s"} reconcile to the +${pmDriver.snapshotOverduePmDelta} overdue-PM movement.`,
    };
    pmEvidence = pmDriver.matchedRecords.map(
      (record) =>
        `${record.pmNumber}: ${record.title}; due ${record.dueDate}; ${record.criticality}; ${record.equipmentCode} ${record.equipmentName}; ${record.area}; status ${record.status}.`,
    );
    pmFindings = pmDriver.matchedRecords.map((record) => ({
      category: "pm",
      severity: /critical/i.test(record.criticality) ? "high" : "medium",
      title: `${record.pmNumber} crossed into overdue`,
      detail:
        `${record.title}; ${record.equipmentCode} ${record.equipmentName}, ${record.area}; due ${readableDate(record.dueDate)}; ${record.criticality}.`,
    }));
    causeBoundary =
      "The PM crossings verify only the recorded overdue-PM count movement. Other movement in the overall risk score is not attributed without matching record-level evidence.";
  } else if (pmDriver?.verificationState === "count_mismatch") {
    pmDriverText = ` ${pmDriver.message}`;
    pmDriverSummary = {
      label: "PM cause not verified",
      value: pmDriver.message,
    };
    pmEvidence = pmDriver.matchedRecords.map(
      (record) =>
        `${record.pmNumber}: due ${record.dueDate}; ${record.equipmentCode} ${record.equipmentName}; ${record.area}.`,
    );
    causeBoundary =
      "The PM record count does not reconcile to the snapshot overdue-PM delta, so Ask Vorta does not claim those PMs caused the recorded count or the overall risk movement.";
  } else if (pmDriver?.verificationState === "unavailable") {
    pmDriverText = ` ${pmDriver.message}`;
    pmDriverSummary = {
      label: "PM verification unavailable",
      value: pmDriver.message,
    };
    causeBoundary = pmDriver.message;
  } else if (pmDriver?.verificationState === "no_pm_increase") {
    pmDriverText =
      " There was no positive overdue-PM count movement between these snapshots, so no PM due-date crossing is claimed as a driver.";
    causeBoundary =
      "There was no positive overdue-PM count movement to attribute; other metric movement remains unexplained without record-level evidence.";
  } else if (pmDriver?.verificationState === "non_consecutive") {
    pmDriverText = ` ${pmDriver.message}`;
    causeBoundary = pmDriver.message;
  }

  const summaryItems: JsonRecord[] = [
    {
      label: "Overall movement",
      value:
        `${previous.riskScore.toFixed(1)} ${previous.riskLevel} on ${previousDate} → ${current.riskScore.toFixed(1)} ${current.riskLevel} on ${currentDate} (${signed(riskDelta)}).`,
    },
  ];
  if (pmDriverSummary) summaryItems.push(pmDriverSummary);
  summaryItems.push(
    ...changes
      .filter((item) => item.key !== "riskScore")
      .slice(0, pmDriverSummary ? 1 : 2)
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
        `${unchanged.length ? unchanged.map((item) => item.label.toLowerCase()).join(", ") + " did not change. " : ""}${causeBoundary}${requestedShiftComparison ? " No verified shift-level comparison is available." : ""}`,
    },
  );

  return {
    ...base,
    directAnswer:
      `Verified daily site risk ${direction} from ${previous.riskScore.toFixed(1)} on ${previousDate} to ${current.riskScore.toFixed(1)} on ${currentDate} (${signed(riskDelta)}).${topChangeText}${pmDriverText}${shiftBoundary}`,
    decisionSummary: summaryItems.slice(0, 5),
    evidence: [
      ...metrics.map(
        (item) =>
          `${item.label}: ${formatted(item.previous, item.integer)} on ${previous.snapshotDate} → ${formatted(item.current, item.integer)} on ${current.snapshotDate} (${signed(item.delta, item.integer ? 0 : 1)}).`,
      ),
      ...pmEvidence,
    ],
    findings: [
      ...pmFindings,
      ...changes.slice(0, Math.max(0, 5 - pmFindings.length)).map((item, index) => ({
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
    ].slice(0, 5),
    missingData: [
      causeBoundary,
      ...(requestedShiftComparison
        ? [
            "No verified shift-level site-risk snapshot is available; the comparison uses the latest two distinct daily snapshots.",
          ]
        : []),
    ],
    confidence:
      pmDriver?.verificationState === "verified"
        ? requestedShiftComparison ? 88 : 94
        : requestedShiftComparison ? 78 : 86,
  };
}
