import type { Session } from "@supabase/supabase-js";
import { supabase } from "./supabaseClient";

const SESSION_REFRESH_LEEWAY_MS = 90_000;
const SESSION_EXPIRED_MESSAGE =
  "Your secure Vorta session expired. Please sign in again.";

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

let recoveryInstalled = false;
let refreshInFlight: Promise<Session | null> | null = null;

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

function invocationFailedAuthentication(result: unknown): boolean {
  if (!result || typeof result !== "object") return false;

  const invocation = result as FunctionInvocationResult;
  const status =
    statusFrom(invocation.response) ?? statusFrom(invocation.error);
  if (status === 401 || status === 403) return true;

  return /authentication required|invalid jwt|jwt expired|token.*expired|unauthori[sz]ed/i.test(
    errorMessage(invocation.error),
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

export function installMaintenanceSessionRecovery(): void {
  if (recoveryInstalled || typeof window === "undefined") return;

  recoveryInstalled = true;

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
    if (!invocationFailedAuthentication(initialResult)) {
      return initialResult;
    }

    const refreshedSession = await ensureFreshSession(true);
    if (!refreshedSession?.access_token) {
      return expiredSessionResult(initialResult);
    }

    const retryResult = await originalInvoke(
      functionName,
      optionsWithAccessToken(options, refreshedSession.access_token),
    );

    return invocationFailedAuthentication(retryResult)
      ? expiredSessionResult(retryResult)
      : retryResult;
  };

  (
    supabase.functions as unknown as {
      invoke: FunctionInvoke;
    }
  ).invoke = invokeWithSessionRecovery;

  const recoverOnResume = (): void => {
    void ensureFreshSession(false);
  };

  window.addEventListener("pageshow", recoverOnResume);
  window.addEventListener("online", recoverOnResume);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") recoverOnResume();
  });
}

installMaintenanceSessionRecovery();
