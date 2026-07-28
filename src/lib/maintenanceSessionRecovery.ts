import type { Session } from "@supabase/supabase-js";
import {
  clearMaintenancePortalDataCache,
  supabase,
} from "./supabaseClient";

const SESSION_REFRESH_LEEWAY_MS = 90_000;
const MOBILE_RESUME_REFRESH_AFTER_MS = 5 * 60 * 1_000;
const SESSION_EXPIRED_MESSAGE =
  "Your secure Vorta session expired. Please sign in again.";
const HIDDEN_HTTP_ERROR_MESSAGE =
  /edge function returned a non-2xx status code/i;
const MAINTENANCE_DATA_RECOVERED_EVENT =
  "vorta:maintenance-data-recovered";

const EVIDENCE_FUNCTIONS = new Set([
  "skills-matrix-data",
  "engineers-data",
  "requirements-data",
  "training-data",
  "training-providers-data",
  "ai-matching-data",
  "career-evidence-data",
  "support-evidence-data",
  "settings-evidence-data",
  "shift-handover-data",
]);

type FunctionInvocationResult = {
  data: unknown;
  error: unknown;
  response?: Response | null;
};

type FunctionInvokeOptions = {
  headers?: HeadersInit;
  [key: string]: unknown;
};

type FunctionInvoke = (
  functionName: string,
  options?: unknown,
) => Promise<unknown>;

type SignOutScope =
  | "global"
  | "local"
  | "others";

type SignOutOptions = {
  scope?: SignOutScope;
};

type SignOutResult = Promise<{
  error: unknown;
}>;

type SignOut = (
  options?: SignOutOptions,
) => SignOutResult;

type SessionVerification = {
  accessToken: string;
  promise: Promise<void>;
};

let recoveryInstalled = false;
let refreshInFlight: Promise<Session | null> | null = null;
let localSignOutInFlight: Promise<void> | null = null;
let sessionVerificationInFlight: SessionVerification | null = null;
let verifiedAccessToken: string | null = null;
let hiddenAt: number | null = null;

function sessionNeedsRefresh(session: Session): boolean {
  if (typeof session.expires_at !== "number") return false;

  return (
    session.expires_at * 1_000 <=
    Date.now() + SESSION_REFRESH_LEEWAY_MS
  );
}

async function refreshAuthenticatedSession(): Promise<Session | null> {
  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = supabase.auth
    .refreshSession()
    .then(({ data, error }) =>
      !error && data.session?.access_token ? data.session : null,
    )
    .catch(() => null)
    .finally(() => {
      refreshInFlight = null;
    });

  return refreshInFlight;
}

async function ensureFreshSession(
  forceRefresh: boolean,
): Promise<Session | null> {
  const { data, error } = await supabase.auth.getSession();
  const session = data.session;

  if (error || !session?.access_token) return null;
  if (!forceRefresh && !sessionNeedsRefresh(session)) return session;

  return refreshAuthenticatedSession();
}

function responseFrom(value: unknown): Response | null {
  if (typeof Response !== "undefined" && value instanceof Response) {
    return value;
  }

  if (!value || typeof value !== "object") return null;

  const candidate = value as {
    response?: unknown;
    context?: unknown;
  };

  if (
    typeof Response !== "undefined" &&
    candidate.response instanceof Response
  ) {
    return candidate.response;
  }

  if (
    typeof Response !== "undefined" &&
    candidate.context instanceof Response
  ) {
    return candidate.context;
  }

  return null;
}

function statusFrom(value: unknown): number | null {
  const response = responseFrom(value);
  if (response) return response.status;
  if (!value || typeof value !== "object") return null;

  const candidate = value as {
    status?: unknown;
    context?: { status?: unknown } | null;
  };
  if (typeof candidate.status === "number") return candidate.status;
  if (typeof candidate.context?.status === "number") {
    return candidate.context.status;
  }

  return null;
}

function errorMessage(value: unknown): string {
  if (value instanceof Error) return value.message;
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && "message" in value) {
    const message = (value as { message?: unknown }).message;
    return typeof message === "string" ? message : "";
  }
  return "";
}

function authenticationErrorRequiresLocalSignOut(
  value: unknown,
): boolean {
  const status = statusFrom(value);
  if (status === 401 || status === 403) return true;

  return /session not found|authentication could not be verified|invalid jwt|jwt expired|refresh token.*not found|token.*expired|unauthori[sz]ed/i.test(
    errorMessage(value),
  );
}

function invocationFailedAuthentication(result: unknown): boolean {
  if (!result || typeof result !== "object") return false;

  const invocation = result as FunctionInvocationResult;
  const status =
    statusFrom(invocation.response) ?? statusFrom(invocation.error);
  if (status === 401 || status === 403) return true;

  return /authentication required|authentication could not be verified|invalid jwt|jwt expired|token.*expired|session not found|unauthori[sz]ed/i.test(
    errorMessage(invocation.error),
  );
}

function invocationReturnedMissingEvidence(
  functionName: string,
  result: unknown,
): boolean {
  if (!EVIDENCE_FUNCTIONS.has(functionName)) return false;
  if (!result || typeof result !== "object") return true;

  const invocation = result as FunctionInvocationResult;
  return !invocation.error && invocation.data == null;
}

function invocationMayNeedSessionRefresh(
  functionName: string,
  result: unknown,
): boolean {
  if (invocationFailedAuthentication(result)) return true;
  if (invocationReturnedMissingEvidence(functionName, result)) return true;
  if (!EVIDENCE_FUNCTIONS.has(functionName)) return false;
  if (!result || typeof result !== "object") return false;

  const invocation = result as FunctionInvocationResult;
  const visibleStatus =
    statusFrom(invocation.response) ?? statusFrom(invocation.error);

  return (
    visibleStatus === null &&
    HIDDEN_HTTP_ERROR_MESSAGE.test(errorMessage(invocation.error))
  );
}

function optionsWithAccessToken(
  options: unknown,
  accessToken: string,
): FunctionInvokeOptions {
  const base =
    options && typeof options === "object" && !Array.isArray(options)
      ? { ...(options as FunctionInvokeOptions) }
      : {};
  const headers = new Headers(base.headers);
  headers.set("Authorization", `Bearer ${accessToken}`);

  return {
    ...base,
    headers: Object.fromEntries(headers.entries()),
  };
}

function expiredSessionResult(
  result: unknown,
): FunctionInvocationResult {
  const invocation =
    result && typeof result === "object"
      ? (result as FunctionInvocationResult)
      : null;

  return {
    data: null,
    error: new Error(SESSION_EXPIRED_MESSAGE),
    response:
      invocation?.response ?? responseFrom(invocation?.error) ?? null,
  };
}

function installLocalSignOutDefault(): SignOut {
  const originalSignOut = supabase.auth.signOut.bind(
    supabase.auth,
  ) as SignOut;

  const signOutLocallyByDefault: SignOut = (
    options,
  ) => originalSignOut(
    options ?? { scope: "local" },
  );

  (
    supabase.auth as unknown as {
      signOut: SignOut;
    }
  ).signOut = signOutLocallyByDefault;

  return originalSignOut;
}

async function clearInvalidLocalSession(
  originalSignOut: SignOut,
): Promise<void> {
  if (localSignOutInFlight) {
    return localSignOutInFlight;
  }

  verifiedAccessToken = null;
  clearMaintenancePortalDataCache();

  localSignOutInFlight = originalSignOut({
    scope: "local",
  })
    .then(({ error }) => {
      if (error) {
        console.warn(
          "Vorta could not clear the invalid local session cleanly.",
          error,
        );
      }
    })
    .catch((error) => {
      console.warn(
        "Vorta could not clear the invalid local session cleanly.",
        error,
      );
    })
    .finally(() => {
      localSignOutInFlight = null;
    });

  return localSignOutInFlight;
}

function verifySessionAgainstAuth(
  session: Session,
  originalSignOut: SignOut,
): Promise<void> {
  const accessToken = session.access_token;
  if (!accessToken || verifiedAccessToken === accessToken) {
    return Promise.resolve();
  }

  if (
    sessionVerificationInFlight?.accessToken === accessToken
  ) {
    return sessionVerificationInFlight.promise;
  }

  const promise = supabase.auth
    .getUser(accessToken)
    .then(async ({ data, error }) => {
      if (!error && data.user) {
        verifiedAccessToken = accessToken;
        return;
      }

      if (authenticationErrorRequiresLocalSignOut(error)) {
        await clearInvalidLocalSession(originalSignOut);
      }
    })
    .catch((error) => {
      if (authenticationErrorRequiresLocalSignOut(error)) {
        return clearInvalidLocalSession(originalSignOut);
      }

      console.warn(
        "Vorta could not complete background session verification.",
        error,
      );
    })
    .finally(() => {
      if (
        sessionVerificationInFlight?.accessToken === accessToken
      ) {
        sessionVerificationInFlight = null;
      }
    });

  sessionVerificationInFlight = {
    accessToken,
    promise,
  };

  return promise;
}

function dispatchMaintenanceDataRecovered(
  reason: "online" | "page-restore" | "foreground-resume",
): void {
  clearMaintenancePortalDataCache();
  window.dispatchEvent(
    new CustomEvent(MAINTENANCE_DATA_RECOVERED_EVENT, {
      detail: { reason },
    }),
  );
}

export function installMaintenanceSessionRecovery(): void {
  if (recoveryInstalled || typeof window === "undefined") return;

  recoveryInstalled = true;

  const originalSignOut = installLocalSignOutDefault();
  const originalInvoke = supabase.functions.invoke.bind(
    supabase.functions,
  ) as FunctionInvoke;

  const invokeWithSessionRecovery: FunctionInvoke = async (
    functionName,
    options,
  ) => {
    const currentSession = await ensureFreshSession(false);
    const initialResult = await originalInvoke(
      functionName,
      currentSession?.access_token
        ? optionsWithAccessToken(options, currentSession.access_token)
        : options,
    );
    if (!invocationMayNeedSessionRefresh(functionName, initialResult)) {
      return initialResult;
    }

    const initialAuthenticationFailure =
      invocationFailedAuthentication(initialResult);

    clearMaintenancePortalDataCache(functionName);
    const refreshedSession = await ensureFreshSession(true);
    if (!refreshedSession?.access_token) {
      if (initialAuthenticationFailure) {
        await clearInvalidLocalSession(originalSignOut);
      }

      return expiredSessionResult(initialResult);
    }

    const retryResult = await originalInvoke(
      functionName,
      optionsWithAccessToken(options, refreshedSession.access_token),
    );

    if (invocationFailedAuthentication(retryResult)) {
      await clearInvalidLocalSession(originalSignOut);
      return expiredSessionResult(retryResult);
    }

    return retryResult;
  };

  (
    supabase.functions as unknown as {
      invoke: FunctionInvoke;
    }
  ).invoke = invokeWithSessionRecovery;

  supabase.auth.onAuthStateChange((event, session) => {
    if (
      event === "INITIAL_SESSION" ||
      event === "SIGNED_IN" ||
      event === "SIGNED_OUT" ||
      event === "TOKEN_REFRESHED" ||
      event === "USER_UPDATED"
    ) {
      clearMaintenancePortalDataCache();
    }

    if (event === "SIGNED_OUT") {
      verifiedAccessToken = null;
      sessionVerificationInFlight = null;
      return;
    }

    if (
      session?.access_token &&
      (
        event === "INITIAL_SESSION" ||
        event === "SIGNED_IN" ||
        event === "TOKEN_REFRESHED" ||
        event === "USER_UPDATED"
      )
    ) {
      void verifySessionAgainstAuth(
        session,
        originalSignOut,
      );
    }
  });

  const recoverOnResume = (
    forceRefresh: boolean,
    reason: "online" | "page-restore" | "foreground-resume",
  ): void => {
    void ensureFreshSession(forceRefresh).then((session) => {
      if (!forceRefresh || !session?.access_token) return;
      dispatchMaintenanceDataRecovered(reason);
    });
  };

  window.addEventListener("pageshow", (event) => {
    recoverOnResume(event.persisted, "page-restore");
  });
  window.addEventListener("online", () => {
    recoverOnResume(true, "online");
  });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      hiddenAt = Date.now();
      return;
    }

    if (document.visibilityState === "visible") {
      const hiddenDuration = hiddenAt === null ? 0 : Date.now() - hiddenAt;
      hiddenAt = null;
      recoverOnResume(
        hiddenDuration >= MOBILE_RESUME_REFRESH_AFTER_MS,
        "foreground-resume",
      );
    }
  });
}

installMaintenanceSessionRecovery();
