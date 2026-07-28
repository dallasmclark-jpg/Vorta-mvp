import { supabase } from "./supabaseClient";

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

const EVIDENCE_RPCS = new Set([
  "vorta_get_shift_cover_snapshot",
]);

const TRANSIENT_MESSAGE = /failed to send a request|failed to fetch|network|load failed|timed out|timeout|statement timeout|canceling statement|aborted/i;
const GENERIC_FUNCTION_ERROR = /edge function returned a non-2xx status code/i;
const REQUEST_TIMEOUT_MS = 8_000;
const MAX_ATTEMPTS = 2;
const FUNCTIONS_INSTALL_MARKER = "__vortaLiveEvidenceResilienceInstalled";
const RPC_INSTALL_MARKER = "__vortaLiveEvidenceRpcResilienceInstalled";

const inFlightEvidence = new Map<string, Promise<InvokeResult>>();

type InvokeResult = {
  data?: unknown;
  error?: unknown;
};

type InvokeOptions = Record<string, unknown> | undefined;

type FunctionsClient = typeof supabase.functions & {
  [FUNCTIONS_INSTALL_MARKER]?: boolean;
};

type RpcClient = {
  rpc: (
    functionName: string,
    parameters?: Record<string, unknown>,
    options?: Record<string, unknown>,
  ) => unknown;
  [RPC_INSTALL_MARKER]?: boolean;
};

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}

function errorFrom(value: unknown): Error | null {
  if (!value) return null;
  if (value instanceof Error) return value;
  if (typeof value === "object" && value !== null && "message" in value) {
    const message = (value as { message?: unknown }).message;
    if (typeof message === "string" && message.trim()) return new Error(message);
  }
  return new Error(String(value));
}

function stableKey(value: unknown): string {
  const seen = new WeakSet<object>();
  try {
    return JSON.stringify(value, (_key, nested) => {
      if (!nested || typeof nested !== "object") return nested;
      if (seen.has(nested)) return "[circular]";
      seen.add(nested);
      if (Array.isArray(nested)) return nested;
      return Object.keys(nested as Record<string, unknown>)
        .sort()
        .reduce<Record<string, unknown>>((result, key) => {
          result[key] = (nested as Record<string, unknown>)[key];
          return result;
        }, {});
    });
  } catch {
    return "unkeyed";
  }
}

function telemetry(
  evidenceName: string,
  attempt: number,
  outcome: "retry" | "success" | "failed" | "timeout",
  durationMs: number,
): void {
  window.dispatchEvent(
    new CustomEvent("vorta:evidence-request", {
      detail: { evidenceName, attempt, outcome, durationMs },
    }),
  );
}

function withFriendlyEvidenceError(result: InvokeResult): InvokeResult {
  const error = errorFrom(result.error);
  if (!error || !GENERIC_FUNCTION_ERROR.test(error.message)) return result;

  return {
    ...result,
    error: new Error(
      "Secure evidence could not be refreshed. Tap refresh to try again.",
    ),
  };
}

function withTimeout<T>(
  request: Promise<T>,
  evidenceName: string,
  cancel?: () => void,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timeoutId = window.setTimeout(() => {
      cancel?.();
      reject(new Error(`${evidenceName} evidence request timed out`));
    }, REQUEST_TIMEOUT_MS);

    request.then(
      (result) => {
        window.clearTimeout(timeoutId);
        resolve(result);
      },
      (error: unknown) => {
        window.clearTimeout(timeoutId);
        reject(error);
      },
    );
  });
}

async function retryTransientEvidence(
  evidenceName: string,
  request: (attempt: number) => Promise<InvokeResult>,
): Promise<InvokeResult> {
  let lastThrownError: Error | null = null;
  let lastResult: InvokeResult | null = null;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    const startedAt = performance.now();
    try {
      const result = await request(attempt);
      const resultError = errorFrom(result?.error);
      if (!resultError) {
        telemetry(evidenceName, attempt + 1, "success", Math.round(performance.now() - startedAt));
        return result;
      }

      lastResult = result;
      if (!TRANSIENT_MESSAGE.test(resultError.message) || attempt === MAX_ATTEMPTS - 1) {
        telemetry(evidenceName, attempt + 1, "failed", Math.round(performance.now() - startedAt));
        return withFriendlyEvidenceError(result);
      }
      telemetry(evidenceName, attempt + 1, "retry", Math.round(performance.now() - startedAt));
    } catch (error) {
      const currentError = errorFrom(error) ?? new Error(`${evidenceName} evidence request failed`);
      lastThrownError = currentError;
      const timedOut = /timed out|aborted/i.test(currentError.message);
      if (!TRANSIENT_MESSAGE.test(currentError.message) || attempt === MAX_ATTEMPTS - 1) {
        telemetry(
          evidenceName,
          attempt + 1,
          timedOut ? "timeout" : "failed",
          Math.round(performance.now() - startedAt),
        );
        throw currentError;
      }
      telemetry(
        evidenceName,
        attempt + 1,
        timedOut ? "timeout" : "retry",
        Math.round(performance.now() - startedAt),
      );
    }

    await delay(250 * (attempt + 1));
  }

  if (lastResult) return withFriendlyEvidenceError(lastResult);
  throw lastThrownError ?? new Error(`${evidenceName} evidence could not be loaded`);
}

function deduplicated(
  key: string,
  request: () => Promise<InvokeResult>,
): Promise<InvokeResult> {
  const current = inFlightEvidence.get(key);
  if (current) return current;

  const next = request().finally(() => {
    if (inFlightEvidence.get(key) === next) inFlightEvidence.delete(key);
  });
  inFlightEvidence.set(key, next);
  return next;
}

function installFunctionResilience(): void {
  const functions = supabase.functions as FunctionsClient;
  if (functions[FUNCTIONS_INSTALL_MARKER]) return;

  const invoke = functions.invoke.bind(functions) as (
    functionName: string,
    options?: InvokeOptions,
  ) => Promise<InvokeResult>;

  functions.invoke = (async (
    functionName: string,
    options?: InvokeOptions,
  ): Promise<InvokeResult> => {
    if (!EVIDENCE_FUNCTIONS.has(functionName)) {
      return invoke(functionName, options);
    }

    const key = `function:${functionName}:${stableKey(options?.body ?? null)}`;
    return deduplicated(key, () =>
      retryTransientEvidence(functionName, () => {
        const controller = new AbortController();
        const requestOptions = {
          ...(options ?? {}),
          signal: controller.signal,
        } as InvokeOptions;
        return withTimeout(
          invoke(functionName, requestOptions),
          functionName,
          () => controller.abort(),
        );
      }),
    );
  }) as typeof functions.invoke;

  functions[FUNCTIONS_INSTALL_MARKER] = true;
}

function installRpcResilience(): void {
  const client = supabase as unknown as RpcClient;
  if (client[RPC_INSTALL_MARKER]) return;

  const rpc = client.rpc.bind(client);
  client.rpc = (
    functionName: string,
    parameters?: Record<string, unknown>,
    options?: Record<string, unknown>,
  ): unknown => {
    if (!EVIDENCE_RPCS.has(functionName)) {
      return rpc(functionName, parameters, options);
    }

    const key = `rpc:${functionName}:${stableKey(parameters ?? null)}`;
    return deduplicated(key, () =>
      retryTransientEvidence(functionName, () =>
        withTimeout(
          Promise.resolve(rpc(functionName, parameters, options)) as Promise<InvokeResult>,
          functionName,
        ),
      ),
    );
  };

  client[RPC_INSTALL_MARKER] = true;
}

function installLiveEvidenceResilience(): void {
  if (typeof window === "undefined") return;
  installFunctionResilience();
  installRpcResilience();
}

installLiveEvidenceResilience();
