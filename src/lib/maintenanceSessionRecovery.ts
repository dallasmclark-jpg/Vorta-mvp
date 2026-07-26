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

type FunctionInvoke = (
  functionName: string,
  options?: unknown,
) => Promise<unknown>;

let recoveryInstalled = false;
let refreshInFlight: Promise<boolean> | null = null;

function sessionNeedsRefresh(session: Session): boolean {
  if (typeof session.expires_at !== "number") return false;

  return (
    session.expires_at * 1_000 <=
    Date.now() + SESSION_REFRESH_LEEWAY_MS
  );
}

async function refreshAuthenticatedSession(): Promise<boolean> {
  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = supabase.auth
    .refreshSession()
    .then(({ data, error }) =>
      !error && Boolean(data.session?.access_token),
    )
    .catch(() => false)
    .finally(() => {
      refreshInFlight = null;
    });

  return refreshInFlight;
}

async function ensureFreshSession(forceRefresh: boolean): Promise<boolean> {
  const { data, error } = await supabase.auth.getSession();
  const session = data.session;

  if (error || !session?.access_token) return false;
  if (!forceRefresh && !sessionNeedsRefresh(session)) return true;

  return refreshAuthenticatedSession();
}

function invocationFailedAuthentication(result: unknown): boolean {
  if (!result || typeof result !== "object") return false;

  const invocation = result as FunctionInvocationResult;
  if (invocation.response?.status === 401) return true;

  const message =
    invocation.error instanceof Error
      ? invocation.error.message
      : typeof invocation.error === "string"
        ? invocation.error
        : "";

  return /authentication required|invalid jwt|jwt expired|token.*expired/i.test(
    message,
  );
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
    response: invocation?.response ?? null,
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
    await ensureFreshSession(false);

    const initialResult = await originalInvoke(functionName, options);
    if (!invocationFailedAuthentication(initialResult)) {
      return initialResult;
    }

    const refreshed = await ensureFreshSession(true);
    if (!refreshed) return expiredSessionResult(initialResult);

    return originalInvoke(functionName, options);
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
