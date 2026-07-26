import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const read = (relativePath) =>
  readFileSync(fileURLToPath(new URL(`../${relativePath}`, import.meta.url)), "utf8");

const check = (condition, message) => {
  if (!condition) throw new Error(message);
};

const indexHtml = read("index.html");
const recovery = read("src/lib/maintenanceSessionRecovery.ts");
const recoveryEntry = './src/lib/maintenanceSessionRecovery.ts';
const appEntry = './src/index.tsx';

check(
  indexHtml.includes(recoveryEntry) &&
    indexHtml.indexOf(recoveryEntry) < indexHtml.indexOf(appEntry),
  "Session recovery must install before the Vorta application entrypoint.",
);

check(
  recovery.includes("refreshSession()") &&
    recovery.includes("refreshInFlight") &&
    recovery.includes("SESSION_REFRESH_LEEWAY_MS") &&
    recovery.includes("statusFrom(invocation.error)") &&
    recovery.includes("candidate.context instanceof Response") &&
    recovery.includes("status === 401 || status === 403") &&
    recovery.includes("ensureFreshSession(true)") &&
    recovery.includes("optionsWithAccessToken") &&
    recovery.includes('headers.set("Authorization"') &&
    recovery.includes("invocationFailedAuthentication(retryResult)") &&
    recovery.includes("expiredSessionResult(retryResult)"),
  "Maintenance evidence requests must detect wrapped authentication failures, refresh, attach the new token and fail clearly after one retry.",
);

check(
  recovery.includes('window.addEventListener("pageshow"') &&
    recovery.includes('window.addEventListener("online"') &&
    recovery.includes('document.addEventListener("visibilitychange"') &&
    recovery.includes('document.visibilityState === "visible"'),
  "Mobile browser resume and reconnect events must refresh stale sessions.",
);

check(
  !recovery.includes("verify_jwt: false") &&
    !recovery.includes("SUPABASE_SERVICE_ROLE_KEY"),
  "Client-side recovery must not weaken Edge Function authentication.",
);

console.log("Maintenance session recovery contracts passed.");
