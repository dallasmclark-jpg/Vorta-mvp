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
const MAINTENANCE_SESSION_CACHE_PREFIX =
  "vorta:maintenance-data:";

type FunctionInvokeOptions = {
  body?: unknown;
};

type FunctionInvocationResult = {
  data: unknown;
  error: unknown;
  response?: Response | null;
};

type CachedFunctionInvocation = {
  expiresAt: number;
  promise: Promise<unknown>;
};

type StoredFunctionInvocation = {
  storedAt: number;
  data: unknown;
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

function invocationBody(
  options?: unknown,
): unknown {
  if (
    options &&
    typeof options === "object" &&
    "body" in options
  ) {
    return (options as FunctionInvokeOptions).body ?? null;
  }

  return null;
}

function invocationCacheKey(
  functionName: string,
  options?: unknown,
): string {
  try {
    return `${functionName}:${JSON.stringify(
      invocationBody(options),
    )}`;
  } catch {
    return functionName;
  }
}

function sessionCacheKey(key: string): string {
  return `${MAINTENANCE_SESSION_CACHE_PREFIX}${key}`;
}

function readStoredInvocation(
  key: string,
): StoredFunctionInvocation | null {
  try {
    const raw = sessionStorage.getItem(
      sessionCacheKey(key),
    );
    if (!raw) return null;

    const parsed = JSON.parse(raw) as StoredFunctionInvocation;
    if (
      typeof parsed?.storedAt !== "number" ||
      !("data" in parsed)
    ) {
      sessionStorage.removeItem(
        sessionCacheKey(key),
      );
      return null;
    }

    if (
      Date.now() - parsed.storedAt >=
      MAINTENANCE_CACHE_TTL_MS
    ) {
      sessionStorage.removeItem(
        sessionCacheKey(key),
      );
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

function storeInvocation(
  key: string,
  data: unknown,
): void {
  try {
    sessionStorage.setItem(
      sessionCacheKey(key),
      JSON.stringify({
        storedAt: Date.now(),
        data,
      } satisfies StoredFunctionInvocation),
    );
  } catch {
    // Storage quotas or privacy settings should not block page loading.
  }
}

function removeStoredInvocations(
  functionName?: string,
): void {
  try {
    for (
      let index = sessionStorage.length - 1;
      index >= 0;
      index -= 1
    ) {
      const storageKey = sessionStorage.key(index);
      if (
        !storageKey ||
        !storageKey.startsWith(
          MAINTENANCE_SESSION_CACHE_PREFIX,
        )
      ) {
        continue;
      }

      if (!functionName) {
        sessionStorage.removeItem(storageKey);
        continue;
      }

      const invocationKey = storageKey.slice(
        MAINTENANCE_SESSION_CACHE_PREFIX.length,
      );
      if (
        invocationKey === functionName ||
        invocationKey.startsWith(`${functionName}:`)
      ) {
        sessionStorage.removeItem(storageKey);
      }
    }
  } catch {
    // Session storage is an optimisation only.
  }
}

function shouldUseMaintenanceProxy(): boolean {
  if (typeof window === "undefined") return false;

  return !isLocalSupabaseHost(
    window.location.hostname,
  );
}

async function invokeMaintenanceProxy(
  functionName: string,
  options?: unknown,
): Promise<FunctionInvocationResult> {
  const {
    data: sessionData,
    error: sessionError,
  } = await supabase.auth.getSession();
  const accessToken =
    sessionData.session?.access_token;

  if (!accessToken) {
    return {
      data: null,
      error:
        sessionError ??
        new Error("Authentication required"),
      response: null,
    };
  }

  const response = await fetch(
    `/api/maintenance-data/${encodeURIComponent(
      functionName,
    )}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        apikey: supabaseAnonKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(
        invocationBody(options) ?? {},
      ),
    },
  );

  const contentType =
    response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    throw new Error(
      "Maintenance data proxy returned an invalid response",
    );
  }

  const data = await response.json() as {
    error?: unknown;
    [key: string]: unknown;
  };

  if (!response.ok) {
    return {
      data: null,
      error: new Error(
        typeof data.error === "string"
          ? data.error
          : "Maintenance data could not be loaded",
      ),
      response,
    };
  }

  return {
    data,
    error: null,
    response,
  };
}

async function invokeMaintenanceNetwork(
  functionName: string,
  options?: unknown,
): Promise<unknown> {
  if (shouldUseMaintenanceProxy()) {
    try {
      return await invokeMaintenanceProxy(
        functionName,
        options,
      );
    } catch (error) {
      console.warn(
        "Maintenance data proxy unavailable; falling back to Supabase",
        error,
      );
    }
  }

  return originalFunctionInvoke(
    functionName,
    options,
  );
}

function createNetworkInvocation(
  functionName: string,
  options: unknown,
  key: string,
): Promise<unknown> {
  const promise = invokeMaintenanceNetwork(
    functionName,
    options,
  ).then((result) => {
    const invocationResult = result as FunctionInvocationResult;

    if (invocationResult?.error) {
      maintenanceFunctionCache.delete(key);
      return result;
    }

    storeInvocation(
      key,
      invocationResult?.data ?? null,
    );

    return result;
  }).catch((error) => {
    maintenanceFunctionCache.delete(key);
    throw error;
  });

  maintenanceFunctionCache.set(key, {
    expiresAt:
      Date.now() +
      MAINTENANCE_CACHE_TTL_MS,
    promise,
  });

  return promise;
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

  const stored = readStoredInvocation(key);
  if (stored) {
    const promise = Promise.resolve({
      data: stored.data,
      error: null,
      response: null,
    } satisfies FunctionInvocationResult);

    maintenanceFunctionCache.set(key, {
      expiresAt:
        stored.storedAt +
        MAINTENANCE_CACHE_TTL_MS,
      promise,
    });

    return promise;
  }

  return createNetworkInvocation(
    functionName,
    options,
    key,
  );
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
    removeStoredInvocations();
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

  removeStoredInvocations(functionName);
}

let maintenanceWarmupStarted = false;

type IdleWindow = Window & {
  requestIdleCallback?: (
    callback: () => void,
    options?: { timeout: number },
  ) => number;
};

function pause(milliseconds: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, milliseconds);
  });
}

async function warmMaintenanceDataSequentially(): Promise<void> {
  const functionNames = [
    "skills-matrix-data",
    "engineers-data",
    "requirements-data",
    "training-providers-data",
    "ai-matching-data",
    "training-data",
  ];

  for (const functionName of functionNames) {
    await cachedFunctionInvoke(functionName);
    await pause(80);
  }
}

export function warmMaintenancePortalData(): void {
  if (
    maintenanceWarmupStarted ||
    typeof window === "undefined"
  ) {
    return;
  }

  maintenanceWarmupStarted = true;

  const startWarmup = () => {
    void warmMaintenanceDataSequentially();
  };
  const idleWindow = window as IdleWindow;

  if (idleWindow.requestIdleCallback) {
    idleWindow.requestIdleCallback(
      startWarmup,
      { timeout: 1_200 },
    );
    return;
  }

  window.setTimeout(startWarmup, 600);
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
