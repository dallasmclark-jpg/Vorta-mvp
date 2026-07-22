const context = String(process.env.CONTEXT ?? "").trim().toLowerCase();
const branch = String(process.env.BRANCH ?? "").trim().toLowerCase();
const siteName = String(process.env.SITE_NAME ?? "").trim().toLowerCase();
const mode = String(process.env.VITE_VORTA_DATA_MODE ?? "").trim().toLowerCase();
const approved = String(process.env.VORTA_LIVE_PILOT_APPROVED ?? "").trim().toLowerCase();
const supabaseUrl = String(process.env.VITE_SUPABASE_URL ?? "").trim();

if (mode !== "live") {
  console.log("Live-pilot validation skipped because this build is not in live data mode.");
  process.exit(0);
}

const isControlledPilotBranch = context === "branch-deploy" && branch === "pilot-live";
const isDedicatedPilotProject = context === "production" && siteName === "vorta-pilot";

if (!isControlledPilotBranch && !isDedicatedPilotProject) {
  throw new Error(
    "Live data mode is restricted to the pilot-live branch deployment or the dedicated vorta-pilot project.",
  );
}

if (approved !== "true") {
  throw new Error(
    "Live pilot deployment requires VORTA_LIVE_PILOT_APPROVED=true after site data and access have been verified.",
  );
}

if (!supabaseUrl.startsWith("https://") || !supabaseUrl.endsWith(".supabase.co")) {
  throw new Error("Live pilot deployment requires an HTTPS Supabase project URL.");
}

console.log(
  `Validated controlled live pilot deployment for ${siteName || branch} using ${supabaseUrl}.`,
);
