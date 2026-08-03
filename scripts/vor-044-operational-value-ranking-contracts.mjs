import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const rankingMigration = readFileSync(
  "supabase/migrations/20260803113112_vor_044_rank_operational_actions.sql",
  "utf8",
);
const invariantMigration = readFileSync(
  "supabase/migrations/20260803113243_vor_044_operational_value_invariants.sql",
  "utf8",
);
const integrationScript = readFileSync(
  "scripts/vor-044-integrate-operational-value.mjs",
  "utf8",
);
const packageJson = JSON.parse(readFileSync("package.json", "utf8"));

const syntaxCheck = spawnSync(
  process.execPath,
  ["--check", "scripts/vor-044-integrate-operational-value.mjs"],
  { encoding: "utf8" },
);

const checks = [
  [
    syntaxCheck.status === 0,
    `operational-value integration codemod has valid JavaScript syntax${syntaxCheck.stderr ? `: ${syntaxCheck.stderr.trim()}` : ""}`,
  ],
  [
    rankingMigration.includes("vorta_get_ranked_operational_actions")
      && rankingMigration.includes("vorta_rank_operational_actions_internal"),
    "authorised and internal operational-value ranking functions are versioned",
  ],
  [
    rankingMigration.includes("risk_reduction_points")
      && rankingMigration.includes("urgency_points")
      && rankingMigration.includes("readiness_points")
      && rankingMigration.includes("criticality_points")
      && rankingMigration.includes("efficiency_points")
      && rankingMigration.includes("confidence_points"),
    "the 100-point ranking exposes every score component",
  ],
  [
    rankingMigration.includes("operational_value_v1")
      && rankingMigration.includes("ready work is ordered before blocked work"),
    "the ranking model is versioned and states the feasibility ordering",
  ],
  [
    rankingMigration.includes("case when scored.feasibility_state = 'ready_now' then 0 else 1 end")
      && invariantMigration.includes("blocked work outranked executable work"),
    "ready work is deterministically ordered before blocked work and guarded by a migration invariant",
  ],
  [
    rankingMigration.includes("hard_dependencies text[]")
      && rankingMigration.includes("advisory_dependencies text[]")
      && rankingMigration.includes("owner text")
      && rankingMigration.includes("verification text"),
    "dependencies, owner and verification remain first-class evidence",
  ],
  [
    rankingMigration.includes("current_risk_score numeric")
      && rankingMigration.includes("projected_risk_score numeric")
      && rankingMigration.includes("calculated_risk_reduction numeric")
      && rankingMigration.includes("risk_projection_basis text"),
    "current risk, projected risk, calculated reduction and projection basis remain exact",
  ],
  [
    rankingMigration.includes("confidence_score integer")
      && rankingMigration.includes("confidence_basis text")
      && rankingMigration.includes("evidence_updated_at timestamptz"),
    "confidence and evidence freshness are explicit rather than inferred",
  ],
  [
    rankingMigration.includes("security definer")
      && rankingMigration.includes("vorta_has_site_access")
      && rankingMigration.includes("set search_path to 'pg_catalog', 'public'"),
    "the public wrapper preserves site authorisation and a fixed search path",
  ],
  [
    rankingMigration.includes("from public, anon, authenticated")
      && rankingMigration.includes("to authenticated, service_role")
      && invariantMigration.includes("has_function_privilege('anon'")
      && invariantMigration.includes("has_function_privilege('authenticated'"),
    "RPC grants are explicit and protected by migration-time privilege checks",
  ],
  [
    integrationScript.includes('case "get_site_ranked_actions":')
      && integrationScript.includes('["rankedActions", executeTool("get_site_ranked_actions", {}, supabase, request)]')
      && integrationScript.includes('"vorta_get_ranked_operational_actions"'),
    "the site decision pack consumes the deterministic ranking RPC",
  ],
  [
    integrationScript.includes('"Equipment operational-value ranking"')
      && integrationScript.includes("{ p_equipment_id: id, p_limit: 10 }"),
    "equipment risk-action questions consume the same ranking model",
  ],
  [
    integrationScript.includes('const rankedData = operationalDomainData(snapshot, "rankedActions");')
      && integrationScript.includes("Score components:")
      && integrationScript.includes("hardDependencies")
      && integrationScript.includes("owner,"),
    "the deterministic answer retains score components, blockers and the exact owner",
  ],
  [
    packageJson.scripts.prebuild.startsWith("node scripts/vor-044-integrate-operational-value.mjs")
      && packageJson.scripts["pretest:contracts"] === "node scripts/vor-044-integrate-operational-value.mjs"
      && packageJson.scripts.predev === "node scripts/vor-044-integrate-operational-value.mjs",
    "development, contracts and production builds apply the audited integration before use",
  ],
  [
    integrationScript.includes('const targetPath = "netlify/functions/ask-vorta.mts";')
      && !integrationScript.includes("src/screens/")
      && !integrationScript.includes("src/components/"),
    "the VOR-044 integration is backend-only and does not alter mobile or shared frontend files",
  ],
];

const failures = checks.filter(([passed]) => !passed);
for (const [passed, label] of checks) console.log(`${passed ? "✓" : "✗"} ${label}`);
if (failures.length) process.exit(1);
