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
]);

const TRANSIENT_MESSAGE = /failed to send a request|failed to fetch|network|load failed|timed out|timeout/i;
const REQUEST_TIMEOUT_MS = 15_000;
const MAX_ATTEMPTS = 3;
const INSTALL_MARKER = "__vortaLiveEvidenceResilienceInstalled";

type InvokeResult = {
  data?: unknown;
  error?: unknown;
};

type InvokeOptions = Record<string, unknown> | undefined;

type FunctionsClient = typeof supabase.functions & {
  [INSTALL_MARKER]?: boolean;
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

function withTimeout<T>(request: Promise<T>, functionName: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timeoutId = window.setTimeout(() => {
      reject(new Error(`${functionName} evidence request timed out`));
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

function installLiveEvidenceResilience(): void {
  if (typeof window === "undefined") return;

  const functions = supabase.functions as FunctionsClient;
  if (functions[INSTALL_MARKER]) return;

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

    let lastThrownError: Error | null = null;
    let lastResult: InvokeResult | null = null;

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
      try {
        const result = await withTimeout(
          invoke(functionName, options),
          functionName,
        );
        const resultError = errorFrom(result?.error);
        if (!resultError) return result;

        lastResult = result;
        if (!TRANSIENT_MESSAGE.test(resultError.message) || attempt === MAX_ATTEMPTS - 1) {
          return result;
        }
      } catch (error) {
        const currentError = errorFrom(error) ?? new Error(`${functionName} evidence request failed`);
        lastThrownError = currentError;
        if (!TRANSIENT_MESSAGE.test(currentError.message) || attempt === MAX_ATTEMPTS - 1) {
          throw currentError;
        }
      }

      await delay(300 * (attempt + 1));
    }

    if (lastResult) return lastResult;
    throw lastThrownError ?? new Error(`${functionName} evidence could not be loaded`);
  }) as typeof functions.invoke;

  functions[INSTALL_MARKER] = true;
}

installLiveEvidenceResilience();
