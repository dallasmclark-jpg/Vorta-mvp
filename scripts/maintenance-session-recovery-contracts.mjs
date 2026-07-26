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
    recovery.includes("invocation.response?.status === 401") &&
    recovery.includes("ensureFreshSession(true)") &&
    recovery.includes("originalInvoke(functionName, options)"),
  "Maintenance evidence requests must proactively refresh and retry once after a 401.",
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
