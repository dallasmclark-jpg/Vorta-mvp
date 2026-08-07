import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const read = (path) => readFileSync(resolve(root, path), "utf8");

const migration = read(
  "supabase/migrations/20260807223406_vor_069_historical_backtest_rpc.sql",
);
const service = read(
  "src/screens/Equipment/equipmentHistoricalBacktestService.ts",
);
const panel = read("src/screens/Equipment/EquipmentHistoricalBacktest.tsx");
const trustedEntry = read("src/screens/Equipment/EquipmentTrustedEntries.tsx");
const runtime = read("netlify/functions/ask-vorta/runtime-backtest.mts");
const documentRuntime = read(
  "netlify/functions/ask-vorta/runtime-document-links.mts",
);

assert.match(migration, /vorta_get_historical_backtest/i);
assert.match(migration, /security definer/i);
assert.match(migration, /public\.vorta_has_site_access\(p_site_id, false\)/i);
assert.match(migration, /revoke all[\s\S]*from anon/i);
assert.match(migration, /grant execute[\s\S]*to authenticated/i);
assert.match(migration, /scenario_warning_start/i);
assert.match(migration, /scenario_pre_outcome/i);
assert.match(migration, /scenario_post_intervention/i);
assert.match(migration, /movement_type = '261'/i);
assert.match(migration, /coalesce\(g\.reversal, false\) = false/i);
assert.match(migration, /stockout_materially_extended_recovery/i);
assert.match(migration, /successful_intervention/i);
assert.match(migration, /false_positive/i);
assert.match(migration, /preventability_supported/i);
assert.match(migration, /false as preventability_supported/i);
assert.match(migration, /Temporal sequence does not by itself prove causation/i);
assert.match(migration, /Preventability is not asserted/i);
assert.match(migration, /not_established_from_sequence_alone/i);
assert.match(migration, /evidenceProvenance/i);
assert.match(migration, /datasetVersion/i);
assert.match(migration, /riskModelVersions/i);
assert.doesNotMatch(migration, /would have prevented/i);

assert.match(service, /VOR_069_BACKTEST_DATASET_VERSION/);
assert.match(service, /vor069-historical-backtest-v1/);
assert.match(service, /vorta_get_historical_backtest/);
assert.match(service, /resolveAuthorisedSiteId/);
assert.match(service, /\.from\("equipment_assets"\)/);
assert.match(service, /Historical backtest unavailable/);
assert.match(service, /dataset version is not approved/i);
assert.doesNotMatch(service, /demo fallback|synthetic fallback|fallback history/i);

assert.match(panel, /Historical risk validation/);
assert.match(panel, /Backtest: did Vorta surface risk before later outcomes\?/);
assert.match(panel, /Synthetic demo evidence/);
assert.match(panel, /Preventability is not established from sequence alone/);
assert.match(panel, /Breakdowns warned/);
assert.match(panel, /Pre-failure stock-outs/);
assert.match(panel, /Recovery impacts/);
assert.match(panel, /Successful interventions/);
assert.match(panel, /False positives/);
assert.match(panel, /Ask Vorta about evidence/);
assert.match(panel, /Historical validation unavailable/);
assert.match(panel, /Retry/);
assert.match(panel, /No controlled VOR-069 case for this equipment/);
assert.match(panel, /sm:grid-cols-2/);
assert.match(panel, /xl:grid-cols-/);
assert.doesNotMatch(panel, /would have prevented/i);

assert.match(trustedEntry, /EquipmentHistoricalBacktest/);
assert.match(trustedEntry, /DemoEquipmentHistoryWithBacktest/);
assert.match(trustedEntry, /getConfiguredDataMode\(\) === "demo"/);
assert.match(
  trustedEntry,
  /legacy History service can still produce demonstration activity[\s\S]*not permitted to render during a live pilot/i,
);

assert.match(runtime, /ASK_VORTA_BACKTEST_REVISION/);
assert.match(runtime, /historical_backtest/);
assert.match(runtime, /vorta_get_historical_backtest/);
assert.match(runtime, /authenticateAskVortaRequest/);
assert.match(runtime, /\.eq\("site_id", request\.siteId\)/);
assert.match(runtime, /stock-out caused the breakdown/i);
assert.match(runtime, /Preventability is not established from timing alone/i);
assert.match(runtime, /false-positive validation case/i);
assert.match(runtime, /synthetic demonstration history/i);
assert.match(runtime, /work_order_material_reservations/);
assert.match(runtime, /work_order_goods_movements/);
assert.match(runtime, /evidenceLinks/);
assert.match(runtime, /evidenceGeneratedAt/);
assert.doesNotMatch(runtime, /would have prevented/i);

assert.match(documentRuntime, /runtime-backtest\.mjs/);
assert.match(documentRuntime, /ASK_VORTA_BACKTEST_REVISION/);
assert.match(
  documentRuntime,
  /vor-069-historical-backtest-intelligence-v1/,
);

console.log("VOR-069 historical backtest intelligence contracts passed.");
