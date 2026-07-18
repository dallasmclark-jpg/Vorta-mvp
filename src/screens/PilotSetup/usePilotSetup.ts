import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "../../lib/auth";
import { supabase } from "../../lib/supabaseClient";
import { validatePilotSetupReport } from "../../lib/runtimeContracts";
import {
  type AttemptDraft,
  type ConfigurationDraft,
  type Notice,
  type PilotCheck,
  type PilotSetupReport,
  type RehearsalScenario,
  type SetupStage,
  type SuccessCriterion,
  type WeeklyReview,
  type WeeklyReviewDraft,
  addDaysIso,
  blankAttemptDraft,
  blankWeeklyDraft,
  localDateIso,
  numberOrNull,
} from "./pilotSetupModel";

export function usePilotSetup() {
  const { siteContext } = useAuth();
  const today = useMemo(() => localDateIso(), []);
  const [report, setReport] = useState<PilotSetupReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeStage, setActiveStage] = useState<SetupStage>("setup");
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  const [notice, setNotice] = useState<Notice | null>(null);
  const [launchOpen, setLaunchOpen] = useState(false);
  const [configuration, setConfiguration] = useState<ConfigurationDraft>({
    objective: "",
    plannedStartDate: "",
    plannedEndDate: "",
    knownLimitations: "",
  });
  const [configurationDirty, setConfigurationDirty] = useState(false);
  const [criteria, setCriteria] = useState<SuccessCriterion[]>([]);
  const [criteriaDirty, setCriteriaDirty] = useState(false);
  const [pilotOwnerUserId, setPilotOwnerUserId] = useState("");
  const [managerContactUserId, setManagerContactUserId] = useState("");
  const [participantsDirty, setParticipantsDirty] = useState(false);
  const [manualEvidence, setManualEvidence] = useState<Record<string, string>>({});
  const [attemptDrafts, setAttemptDrafts] = useState<Record<string, AttemptDraft>>({});
  const [weeklyDraft, setWeeklyDraft] = useState<WeeklyReviewDraft>(
    blankWeeklyDraft(today),
  );

  const hasUnsavedChanges =
    configurationDirty || criteriaDirty || participantsDirty;

  const initialiseForms = useCallback((nextReport: PilotSetupReport): void => {
    setReport(nextReport);
    setConfiguration({
      objective: nextReport.pilot.objective ?? "",
      plannedStartDate: nextReport.pilot.plannedStartDate ?? "",
      plannedEndDate: nextReport.pilot.plannedEndDate ?? "",
      knownLimitations: nextReport.pilot.knownLimitations ?? "",
    });
    setConfigurationDirty(false);
    setCriteria(nextReport.pilot.successCriteria ?? []);
    setCriteriaDirty(false);
    setPilotOwnerUserId(nextReport.pilot.pilotOwnerUserId ?? "");
    setManagerContactUserId(nextReport.pilot.managerContactUserId ?? "");
    setParticipantsDirty(false);
    setManualEvidence(
      Object.fromEntries(
        nextReport.readiness.manualChecks.map((check) => [
          check.key,
          check.evidence ?? "",
        ]),
      ),
    );
    setAttemptDrafts((current) => {
      const next = { ...current };
      nextReport.rehearsal.scenarios.forEach((scenario) => {
        next[scenario.key] ??= blankAttemptDraft();
      });
      return next;
    });
  }, []);

  const loadReport = useCallback(async (): Promise<void> => {
    const siteId = siteContext?.siteId;
    if (!siteId) {
      setReport(null);
      setNotice({
        kind: "error",
        text: "A maintenance site could not be resolved for this account.",
      });
      setLoading(false);
      return;
    }

    setLoading(true);
    setNotice(null);
    const { data, error } = await supabase.rpc("vorta_get_pilot_setup", {
      p_site_id: siteId,
    });

    if (error || !data) {
      setReport(null);
      setNotice({
        kind: "error",
        text:
          error?.message ??
          "Pilot Setup is restricted to authorised pilot administrators.",
      });
      setLoading(false);
      return;
    }

    const validated = validatePilotSetupReport(data) as unknown as PilotSetupReport;
    initialiseForms(validated);
    setLoading(false);
  }, [initialiseForms, siteContext?.siteId]);

  useEffect(() => {
    void loadReport();
  }, [loadReport]);

  useEffect(() => {
    if (!hasUnsavedChanges) return undefined;

    const handleBeforeUnload = (event: BeforeUnloadEvent): void => {
      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hasUnsavedChanges]);

  useEffect(() => {
    if (!notice || notice.kind === "error") return undefined;
    const timeoutId = window.setTimeout(() => setNotice(null), 3500);
    return () => window.clearTimeout(timeoutId);
  }, [notice]);

  const runMutation = useCallback(
    async (
      key: string,
      rpcName: string,
      payload: Record<string, unknown>,
      successText: string,
    ): Promise<PilotSetupReport | null> => {
      setBusy((current) => ({ ...current, [key]: true }));
      setNotice(null);

      const { data, error } = await supabase.rpc(rpcName, payload);

      setBusy((current) => ({ ...current, [key]: false }));

      if (error || !data) {
        setNotice({
          kind: "error",
          text: error?.message ?? "The pilot workflow could not be updated.",
        });
        return null;
      }

      const nextReport = validatePilotSetupReport(data) as unknown as PilotSetupReport;
      setReport(nextReport);
      setNotice({ kind: "success", text: successText });
      return nextReport;
    },
    [],
  );

  const updateConfiguration = (
    patch: Partial<ConfigurationDraft>,
  ): void => {
    setConfiguration((current) => ({ ...current, ...patch }));
    setConfigurationDirty(true);
  };

  const saveConfiguration = async (): Promise<void> => {
    const siteId = siteContext?.siteId;
    if (!siteId) return;

    if (configuration.objective.trim().length < 20) {
      setNotice({
        kind: "error",
        text: "Add a clear pilot objective of at least 20 characters.",
      });
      return;
    }

    if (!configuration.plannedStartDate || !configuration.plannedEndDate) {
      setNotice({
        kind: "error",
        text: "Choose both planned pilot dates.",
      });
      return;
    }

    if (configuration.plannedEndDate < configuration.plannedStartDate) {
      setNotice({
        kind: "error",
        text: "The pilot end date must be on or after the start date.",
      });
      return;
    }

    const next = await runMutation(
      "configuration",
      "vorta_update_pilot_configuration",
      {
        p_site_id: siteId,
        p_objective: configuration.objective,
        p_planned_start_date: configuration.plannedStartDate,
        p_planned_end_date: configuration.plannedEndDate,
        p_known_limitations: configuration.knownLimitations,
      },
      "Pilot configuration saved.",
    );

    if (next) setConfigurationDirty(false);
  };

  const saveParticipants = async (): Promise<void> => {
    const siteId = siteContext?.siteId;

    if (!siteId || !pilotOwnerUserId || !managerContactUserId) {
      setNotice({
        kind: "error",
        text: "Choose both the pilot owner and Maintenance Manager contact.",
      });
      return;
    }

    const next = await runMutation(
      "participants",
      "vorta_update_pilot_participants",
      {
        p_site_id: siteId,
        p_pilot_owner_user_id: pilotOwnerUserId,
        p_manager_contact_user_id: managerContactUserId,
      },
      "Pilot participants saved.",
    );

    if (next) setParticipantsDirty(false);
  };

  const saveCriteria = async (): Promise<void> => {
    const siteId = siteContext?.siteId;
    if (!siteId) return;

    if (
      criteria.length === 0 ||
      criteria.some(
        (criterion) =>
          !Number.isFinite(Number(criterion.target)) ||
          Number(criterion.target) < 0,
      )
    ) {
      setNotice({
        kind: "error",
        text: "Every success criterion needs a valid non-negative target.",
      });
      return;
    }

    const next = await runMutation(
      "criteria",
      "vorta_update_pilot_success_criteria",
      {
        p_site_id: siteId,
        p_success_criteria: criteria.map((criterion) => ({
          ...criterion,
          target: Number(criterion.target),
        })),
      },
      "Success criteria saved.",
    );

    if (next) setCriteriaDirty(false);
  };

  const updateManualCheck = async (
    check: PilotCheck,
    status: "pass" | "fail",
  ): Promise<void> => {
    const siteId = siteContext?.siteId;
    const evidence = (manualEvidence[check.key] ?? "").trim();
    if (!siteId) return;

    if (evidence.length < 8) {
      setNotice({
        kind: "error",
        text: "Add meaningful evidence before recording this check.",
      });
      return;
    }

    await runMutation(
      `check:${check.key}`,
      "vorta_update_pilot_manual_check",
      {
        p_site_id: siteId,
        p_item_key: check.key,
        p_status: status,
        p_evidence: evidence,
      },
      `${check.label} recorded as ${status}.`,
    );
  };

  const updateAttemptDraft = (
    scenarioKey: string,
    patch: Partial<AttemptDraft>,
  ): void => {
    setAttemptDrafts((current) => ({
      ...current,
      [scenarioKey]: {
        ...(current[scenarioKey] ?? blankAttemptDraft()),
        ...patch,
      },
    }));
  };

  const recordAttempt = async (
    scenario: RehearsalScenario,
  ): Promise<void> => {
    const siteId = siteContext?.siteId;
    const draft = attemptDrafts[scenario.key] ?? blankAttemptDraft();
    const duration = numberOrNull(draft.durationMinutes);
    if (!siteId) return;

    if (!draft.result) {
      setNotice({
        kind: "error",
        text: "Choose pass, fail or blocked before recording the attempt.",
      });
      return;
    }

    if (draft.result === "pass") {
      if (duration === null || duration < 1) {
        setNotice({
          kind: "error",
          text: "A passing rehearsal needs a recorded duration.",
        });
        return;
      }

      if (draft.interventionRequired) {
        setNotice({
          kind: "error",
          text: "An assisted rehearsal cannot be recorded as a clean pass.",
        });
        return;
      }

      if (
        draft.notes.trim().length < 8 ||
        draft.evidence.trim().length < 8
      ) {
        setNotice({
          kind: "error",
          text: "A passing rehearsal needs notes and evidence.",
        });
        return;
      }
    } else if (draft.notes.trim().length < 8) {
      setNotice({
        kind: "error",
        text: "Explain why the rehearsal failed or was blocked.",
      });
      return;
    }

    const next = await runMutation(
      `scenario:${scenario.key}`,
      "vorta_record_pilot_rehearsal_attempt",
      {
        p_site_id: siteId,
        p_scenario_key: scenario.key,
        p_result: draft.result,
        p_duration_minutes: duration,
        p_intervention_required: draft.interventionRequired,
        p_notes: draft.notes,
        p_evidence: draft.evidence,
        p_issue_reference: draft.issueReference,
      },
      `${scenario.title} attempt recorded.`,
    );

    if (next) {
      setAttemptDrafts((current) => ({
        ...current,
        [scenario.key]: blankAttemptDraft(),
      }));
    }
  };

  const loadWeeklyReview = (review: WeeklyReview): void => {
    setWeeklyDraft({
      weekNumber: String(review.weekNumber),
      periodStart: review.periodStart,
      periodEnd: review.periodEnd,
      status: review.status,
      managerValueScore:
        review.managerValueScore == null
          ? ""
          : String(review.managerValueScore),
      dataAccuracyPercent:
        review.dataAccuracyPercent == null
          ? ""
          : String(review.dataAccuracyPercent),
      estimatedTimeSavedMinutes:
        review.estimatedTimeSavedMinutes == null
          ? ""
          : String(review.estimatedTimeSavedMinutes),
      risksIdentified: String(review.risksIdentified),
      followThroughActions: String(review.followThroughActions),
      summary: review.summary ?? "",
      blockers: review.blockers ?? "",
      nextActions: review.nextActions ?? "",
    });

    setActiveStage("launch");
  };

  const saveWeeklyReview = async (): Promise<void> => {
    const siteId = siteContext?.siteId;
    const weekNumber = Number(weeklyDraft.weekNumber);
    if (!siteId) return;

    if (
      !Number.isInteger(weekNumber) ||
      weekNumber < 0 ||
      weekNumber > 52
    ) {
      setNotice({
        kind: "error",
        text: "Week number must be between 0 and 52.",
      });
      return;
    }

    if (!weeklyDraft.periodStart || !weeklyDraft.periodEnd) {
      setNotice({
        kind: "error",
        text: "Choose both weekly review dates.",
      });
      return;
    }

    if (weeklyDraft.periodEnd < weeklyDraft.periodStart) {
      setNotice({
        kind: "error",
        text: "The weekly review end date must be on or after the start date.",
      });
      return;
    }

    if (
      weeklyDraft.status === "complete" &&
      (numberOrNull(weeklyDraft.managerValueScore) === null ||
        numberOrNull(weeklyDraft.dataAccuracyPercent) === null ||
        weeklyDraft.summary.trim().length < 8 ||
        weeklyDraft.nextActions.trim().length < 8)
    ) {
      setNotice({
        kind: "error",
        text: "A completed review needs value, accuracy, summary and next actions.",
      });
      return;
    }

    const next = await runMutation(
      `week:${weekNumber}`,
      "vorta_upsert_pilot_weekly_review",
      {
        p_site_id: siteId,
        p_week_number: weekNumber,
        p_period_start: weeklyDraft.periodStart,
        p_period_end: weeklyDraft.periodEnd,
        p_status: weeklyDraft.status,
        p_manager_value_score: numberOrNull(
          weeklyDraft.managerValueScore,
        ),
        p_data_accuracy_percent: numberOrNull(
          weeklyDraft.dataAccuracyPercent,
        ),
        p_estimated_time_saved_minutes: numberOrNull(
          weeklyDraft.estimatedTimeSavedMinutes,
        ),
        p_risks_identified: Number(weeklyDraft.risksIdentified || 0),
        p_follow_through_actions: Number(
          weeklyDraft.followThroughActions || 0,
        ),
        p_summary: weeklyDraft.summary,
        p_blockers: weeklyDraft.blockers,
        p_next_actions: weeklyDraft.nextActions,
      },
      `Week ${weekNumber} review saved.`,
    );

    if (next) {
      const nextWeek =
        next.pilot.status === "LIVE"
          ? Math.max(1, weekNumber + 1)
          : 0;

      setWeeklyDraft({
        ...blankWeeklyDraft(today),
        weekNumber: String(nextWeek),
        periodStart: next.pilot.plannedStartDate ?? today,
        periodEnd: next.pilot.plannedStartDate
          ? addDaysIso(next.pilot.plannedStartDate, 6)
          : today,
      });
    }
  };

  const launchPilot = async (): Promise<void> => {
    const siteId = siteContext?.siteId;
    if (!siteId || !report?.readiness.launchEligible) return;

    const next = await runMutation(
      "launch",
      "vorta_launch_pilot",
      { p_site_id: siteId },
      "Pilot launched. The actual start time is now fixed.",
    );

    if (next) {
      setLaunchOpen(false);
      setActiveStage("launch");
    }
  };

  return {
    report,
    loading,
    activeStage,
    setActiveStage,
    busy,
    notice,
    setNotice,
    launchOpen,
    setLaunchOpen,
    configuration,
    configurationDirty,
    updateConfiguration,
    saveConfiguration,
    criteria,
    criteriaDirty,
    setCriteria,
    setCriteriaDirty,
    saveCriteria,
    pilotOwnerUserId,
    setPilotOwnerUserId,
    managerContactUserId,
    setManagerContactUserId,
    participantsDirty,
    setParticipantsDirty,
    saveParticipants,
    manualEvidence,
    setManualEvidence,
    updateManualCheck,
    attemptDrafts,
    updateAttemptDraft,
    recordAttempt,
    weeklyDraft,
    setWeeklyDraft,
    loadWeeklyReview,
    saveWeeklyReview,
    launchPilot,
    loadReport,
    hasUnsavedChanges,
  };
}
