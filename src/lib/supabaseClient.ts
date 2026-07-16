import { createClient } from "@supabase/supabase-js";

const rawSupabaseUrl =
  typeof import.meta.env
    .VITE_SUPABASE_URL ===
  "string"
    ? import.meta.env.VITE_SUPABASE_URL.trim()
    : "";

const rawSupabaseAnonKey =
  typeof import.meta.env
    .VITE_SUPABASE_ANON_KEY ===
  "string"
    ? import.meta.env.VITE_SUPABASE_ANON_KEY.trim()
    : "";

function isLocalSupabaseHost(
  hostname: string,
): boolean {
  const normalisedHostname =
    hostname
      .trim()
      .toLowerCase();

  return (
    normalisedHostname ===
      "localhost" ||
    normalisedHostname ===
      "127.0.0.1" ||
    normalisedHostname ===
      "[::1]"
  );
}

function validateSupabaseConfiguration(
  urlValue: string,
  keyValue: string,
): string | null {
  if (
    !urlValue &&
    !keyValue
  ) {
    return "VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are missing.";
  }

  if (!urlValue) {
    return "VITE_SUPABASE_URL is missing.";
  }

  if (!keyValue) {
    return "VITE_SUPABASE_ANON_KEY is missing.";
  }

  let parsedUrl: URL;

  try {
    parsedUrl =
      new URL(urlValue);
  } catch {
    return "VITE_SUPABASE_URL is not a valid absolute URL.";
  }

  const localDevelopment =
    isLocalSupabaseHost(
      parsedUrl.hostname,
    );

  const secureProtocol =
    parsedUrl.protocol ===
    "https:";

  const allowedLocalProtocol =
    localDevelopment &&
    parsedUrl.protocol ===
      "http:";

  if (
    !secureProtocol &&
    !allowedLocalProtocol
  ) {
    return "VITE_SUPABASE_URL must use HTTPS outside local development.";
  }

  if (keyValue.length < 20) {
    return "VITE_SUPABASE_ANON_KEY is missing or invalid.";
  }

  return null;
}

export const supabaseConfigurationError =
  validateSupabaseConfiguration(
    rawSupabaseUrl,
    rawSupabaseAnonKey,
  );

const supabaseUrl =
  supabaseConfigurationError
    ? "https://invalid.vorta.local"
    : rawSupabaseUrl;

const supabaseAnonKey =
  supabaseConfigurationError
    ? "vorta-configuration-placeholder-key"
    : rawSupabaseAnonKey;

const REMEMBER_PREFERENCE_KEY = "vorta:remember-session";

function shouldRememberSession(): boolean {
  return localStorage.getItem(REMEMBER_PREFERENCE_KEY) === "true";
}

const sessionStorageAdapter = {
  getItem(key: string): string | null {
    return localStorage.getItem(key) ?? sessionStorage.getItem(key);
  },

  setItem(key: string, value: string): void {
    if (shouldRememberSession()) {
      localStorage.setItem(key, value);
      sessionStorage.removeItem(key);
      return;
    }

    sessionStorage.setItem(key, value);
    localStorage.removeItem(key);
  },

  removeItem(key: string): void {
    localStorage.removeItem(key);
    sessionStorage.removeItem(key);
  },
};

export function setRememberSession(remember: boolean): void {
  if (remember) {
    localStorage.setItem(REMEMBER_PREFERENCE_KEY, "true");
  } else {
    localStorage.removeItem(REMEMBER_PREFERENCE_KEY);
  }
}

export function getRememberSession(): boolean {
  return shouldRememberSession();
}

export const supabase = createClient(
  supabaseUrl,
  supabaseAnonKey,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storage: sessionStorageAdapter,
    },
  },
);

const MAINTENANCE_READ_FUNCTIONS = new Set([
  "skills-matrix-data",
  "engineers-data",
  "requirements-data",
  "training-data",
  "training-providers-data",
  "ai-matching-data",
]);

const MAINTENANCE_CACHE_TTL_MS = 5 * 60_000;

type CachedFunctionInvocation = {
  expiresAt: number;
  promise: Promise<unknown>;
};

const maintenanceFunctionCache =
  new Map<string, CachedFunctionInvocation>();

const originalFunctionInvoke =
  supabase.functions.invoke.bind(
    supabase.functions,
  ) as (
    functionName: string,
    options?: unknown,
  ) => Promise<unknown>;

function invocationCacheKey(
  functionName: string,
  options?: unknown,
): string {
  const body =
    options &&
    typeof options === "object" &&
    "body" in options
      ? (options as { body?: unknown }).body
      : null;

  try {
    return `${functionName}:${JSON.stringify(body ?? null)}`;
  } catch {
    return functionName;
  }
}

const cachedFunctionInvoke = (
  functionName: string,
  options?: unknown,
): Promise<unknown> => {
  if (
    !MAINTENANCE_READ_FUNCTIONS.has(
      functionName,
    )
  ) {
    return originalFunctionInvoke(
      functionName,
      options,
    );
  }

  const key = invocationCacheKey(
    functionName,
    options,
  );
  const now = Date.now();
  const cached =
    maintenanceFunctionCache.get(key);

  if (
    cached &&
    cached.expiresAt > now
  ) {
    return cached.promise;
  }

  const promise = originalFunctionInvoke(
    functionName,
    options,
  ).then((result) => {
    const invocationResult = result as {
      error?: unknown;
    };

    if (invocationResult?.error) {
      maintenanceFunctionCache.delete(key);
    }

    return result;
  }).catch((error) => {
    maintenanceFunctionCache.delete(key);
    throw error;
  });

  maintenanceFunctionCache.set(key, {
    expiresAt:
      now +
      MAINTENANCE_CACHE_TTL_MS,
    promise,
  });

  return promise;
};

(
  supabase.functions as unknown as {
    invoke: (
      functionName: string,
      options?: unknown,
    ) => Promise<unknown>;
  }
).invoke = cachedFunctionInvoke;

export function clearMaintenancePortalDataCache(
  functionName?: string,
): void {
  if (!functionName) {
    maintenanceFunctionCache.clear();
    return;
  }

  for (const key of maintenanceFunctionCache.keys()) {
    if (
      key === functionName ||
      key.startsWith(`${functionName}:`)
    ) {
      maintenanceFunctionCache.delete(key);
    }
  }
}

let maintenanceWarmupStarted = false;

export function warmMaintenancePortalData(): void {
  if (maintenanceWarmupStarted) {
    return;
  }

  maintenanceWarmupStarted = true;

  const primaryFunctions = [
    "skills-matrix-data",
    "engineers-data",
    "requirements-data",
  ];
  const secondaryFunctions = [
    "training-data",
    "training-providers-data",
    "ai-matching-data",
  ];

  void Promise.allSettled(
    primaryFunctions.map(
      (functionName) =>
        cachedFunctionInvoke(
          functionName,
        ),
    ),
  ).then(() =>
    Promise.allSettled(
      secondaryFunctions.map(
        (functionName) =>
          cachedFunctionInvoke(
            functionName,
          ),
      ),
    ),
  );
}

let cachedPortalUserId: string | null = null;

supabase.auth.onAuthStateChange(
  (_event, session) => {
    const nextUserId =
      session?.user.id ?? null;

    if (
      cachedPortalUserId !== null &&
      nextUserId !== cachedPortalUserId
    ) {
      clearMaintenancePortalDataCache();
      maintenanceWarmupStarted = false;
    }

    cachedPortalUserId = nextUserId;
  },
);