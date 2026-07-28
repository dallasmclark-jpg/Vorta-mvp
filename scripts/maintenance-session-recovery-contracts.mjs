import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const read = (relativePath) =>
  readFileSync(fileURLToPath(new URL(`../${relativePath}`, import.meta.url)), "utf8");

const check = (condition, message) => {
  if (!condition) throw new Error(message);
};

const indexHtml = read("index.html");
const recovery = read("src/lib/maintenanceSessionRecovery.ts");
const maintenanceExperience = read(
  "src/screens/AiOperations/MaintenanceAiWorkOrderExperience.tsx",
);
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
    recovery.includes("session not found") &&
    recovery.includes("invocationMayNeedSessionRefresh") &&
    recovery.includes("invocationReturnedMissingEvidence") &&
    recovery.includes("HIDDEN_HTTP_ERROR_MESSAGE") &&
    recovery.includes("EVIDENCE_FUNCTIONS.has(functionName)") &&
    recovery.includes("ensureFreshSession(true)") &&
    recovery.includes("optionsWithAccessToken") &&
    recovery.includes('headers.set("Authorization"') &&
    recovery.includes("clearMaintenancePortalDataCache(functionName)") &&
    recovery.includes("invocationFailedAuthentication(retryResult)") &&
    recovery.includes("expiredSessionResult(retryResult)"),
  "Maintenance evidence requests must recover explicit, hidden and missing-payload authentication failures, clear failed caches, attach a refreshed token and fail clearly after one retry.",
);

check(
  recovery.includes("verifySessionAgainstAuth") &&
    recovery.includes(".getUser(accessToken)") &&
    recovery.includes("authenticationErrorRequiresLocalSignOut") &&
    recovery.includes('event === "INITIAL_SESSION"') &&
    recovery.includes('event === "TOKEN_REFRESHED"'),
  "Stored browser sessions must be verified against Supabase Auth instead of trusting a locally cached token.",
);

check(
  recovery.includes("installLocalSignOutDefault") &&
    recovery.includes("clearInvalidLocalSession") &&
    recovery.includes('scope: "local"') &&
    recovery.includes("initialAuthenticationFailure") &&
    recovery.includes("await clearInvalidLocalSession(originalSignOut)") &&
    !recovery.includes('scope: "global"'),
  "Invalid sessions and ordinary sign-outs must clear only the current browser session and must not revoke other devices or CI sessions.",
);

check(
  recovery.includes("MAINTENANCE_DATA_RECOVERED_EVENT") &&
    recovery.includes("dispatchMaintenanceDataRecovered") &&
    recovery.includes("clearMaintenancePortalDataCache()") &&
    recovery.includes('event === "INITIAL_SESSION"') &&
    recovery.includes('event === "SIGNED_IN"') &&
    maintenanceExperience.includes("dataRecoveryRevision") &&
    maintenanceExperience.includes("vorta:maintenance-data-recovered") &&
    maintenanceExperience.includes("data-vorta-maintenance-data-revision"),
  "Stale cross-session caches must be cleared and the active Maintenance Manager data route must remount after a successful resume recovery.",
);

check(
  recovery.includes("MOBILE_RESUME_REFRESH_AFTER_MS") &&
    recovery.includes('window.addEventListener("pageshow"') &&
    recovery.includes("event.persisted") &&
    recovery.includes('window.addEventListener("online"') &&
    recovery.includes('recoverOnResume(true, "online")') &&
    recovery.includes('document.addEventListener("visibilitychange"') &&
    recovery.includes('document.visibilityState === "hidden"') &&
    recovery.includes('document.visibilityState === "visible"') &&
    recovery.includes("hiddenDuration >= MOBILE_RESUME_REFRESH_AFTER_MS"),
  "Mobile browser resume and reconnect events must force-refresh sessions and rerun the current page loader after meaningful suspension.",
);

check(
  !recovery.includes("verify_jwt: false") &&
    !recovery.includes("SUPABASE_SERVICE_ROLE_KEY"),
  "Client-side recovery must not weaken Edge Function authentication.",
);

console.log("Maintenance session recovery contracts passed.");
