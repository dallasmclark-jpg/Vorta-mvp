import { supabase } from "./supabaseClient";

const TRANSIENT_MESSAGE = /failed to send a request|failed to fetch|network|load failed/i;

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}

export async function invokeEvidenceFunction<T>(
  slug: string,
  body: Record<string, unknown>,
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const { data, error } = await supabase.functions.invoke(slug, { body });
    if (!error && data !== null && data !== undefined) return data as T;

    const currentError = error instanceof Error
      ? error
      : new Error(error ? String(error) : `${slug} returned no evidence`);
    lastError = currentError;

    const mayRetry = TRANSIENT_MESSAGE.test(currentError.message) && attempt < 2;
    if (!mayRetry) throw currentError;
    await delay(300 * (attempt + 1));
  }

  throw lastError ?? new Error(`${slug} evidence could not be loaded`);
}
