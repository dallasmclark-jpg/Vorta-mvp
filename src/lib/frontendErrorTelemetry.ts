import {
  supabase,
} from "./supabaseClient";

interface VortaRenderErrorDetail {
  reference: string;
  scope:
    | "application"
    | "portal";
  pathname: string;
  message: string;
  stack: string | null;
  componentStack:
    | string
    | null;
  occurredAt: string;
}

const MAX_SUBMISSIONS_PER_MINUTE =
  5;

const SUBMISSION_WINDOW_MS =
  60_000;

const MAX_REMEMBERED_REFERENCES =
  100;

const submittedReferences =
  new Set<string>();

const recentSubmissionTimes:
  number[] = [];

let telemetryInstalled = false;

function isRenderErrorDetail(
  value: unknown,
): value is VortaRenderErrorDetail {
  if (
    !value ||
    typeof value !== "object"
  ) {
    return false;
  }

  const detail =
    value as Partial<VortaRenderErrorDetail>;

  return (
    typeof detail.reference ===
      "string" &&
    detail.reference.trim()
      .length > 0 &&
    (
      detail.scope ===
        "application" ||
      detail.scope === "portal"
    ) &&
    typeof detail.pathname ===
      "string" &&
    typeof detail.message ===
      "string" &&
    (
      detail.stack === null ||
      typeof detail.stack ===
        "string"
    ) &&
    (
      detail.componentStack ===
        null ||
      typeof detail.componentStack ===
        "string"
    ) &&
    typeof detail.occurredAt ===
      "string"
  );
}

function submissionAllowed(
  now: number,
): boolean {
  const cutoff =
    now -
    SUBMISSION_WINDOW_MS;

  while (
    recentSubmissionTimes
      .length > 0 &&
    recentSubmissionTimes[0] <
      cutoff
  ) {
    recentSubmissionTimes.shift();
  }

  if (
    recentSubmissionTimes
      .length >=
    MAX_SUBMISSIONS_PER_MINUTE
  ) {
    return false;
  }

  recentSubmissionTimes.push(
    now,
  );

  return true;
}

function rememberReference(
  reference: string,
): void {
  submittedReferences.add(
    reference,
  );

  if (
    submittedReferences.size <=
    MAX_REMEMBERED_REFERENCES
  ) {
    return;
  }

  const oldestReference =
    submittedReferences
      .values()
      .next()
      .value;

  if (
    typeof oldestReference ===
    "string"
  ) {
    submittedReferences.delete(
      oldestReference,
    );
  }
}

async function submitRenderError(
  detail:
    VortaRenderErrorDetail,
): Promise<void> {
  try {
    const {
      data,
      error: sessionError,
    } =
      await supabase.auth.getSession();

    if (
      sessionError ||
      !data.session
    ) {
      return;
    }

    const {
      error: loggingError,
    } = await supabase.rpc(
      "vorta_log_frontend_error",
      {
        p_reference:
          detail.reference,
        p_scope:
          detail.scope,
        p_pathname:
          detail.pathname,
        p_message:
          detail.message,
        p_stack:
          detail.stack,
        p_component_stack:
          detail.componentStack,
        p_occurred_at:
          detail.occurredAt,
      },
    );

    if (loggingError) {
      console.warn(
        "Vorta frontend telemetry could not be recorded.",
      );
    }
  } catch {
    console.warn(
      "Vorta frontend telemetry could not be recorded.",
    );
  }
}

export function installFrontendErrorTelemetry(): void {
  if (
    telemetryInstalled ||
    typeof window ===
      "undefined"
  ) {
    return;
  }

  telemetryInstalled = true;

  window.addEventListener(
    "vorta:render-error",
    (event: Event) => {
      const detail =
        (
          event as CustomEvent<unknown>
        ).detail;

      if (
        !isRenderErrorDetail(
          detail,
        )
      ) {
        return;
      }

      if (
        submittedReferences.has(
          detail.reference,
        )
      ) {
        return;
      }

      const now = Date.now();

      if (
        !submissionAllowed(now)
      ) {
        console.warn(
          "Vorta frontend telemetry rate limit reached.",
        );

        return;
      }

      rememberReference(
        detail.reference,
      );

      void submitRenderError(
        detail,
      );
    },
  );
}
