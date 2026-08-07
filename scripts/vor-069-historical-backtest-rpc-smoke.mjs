import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";

const required = (name) => {
  const value = String(process.env[name] ?? "").trim();
  assert.ok(value, `${name} is required for the VOR-069 backtest smoke`);
  return value;
};

const supabase = createClient(
  required("VITE_SUPABASE_URL"),
  required("VITE_SUPABASE_ANON_KEY"),
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  },
);

const siteId = required("VORTA_E2E_SITE_ID");
const { data: signIn, error: signInError } = await supabase.auth.signInWithPassword({
  email: required("VORTA_E2E_EMAIL"),
  password: required("VORTA_E2E_PASSWORD"),
});
assert.ifError(signInError);
assert.ok(signIn.user, "Backtest smoke could not authenticate");

try {
  const { data: siteData, error: siteError } = await supabase.rpc(
    "vorta_get_historical_backtest",
    {
      p_site_id: siteId,
      p_equipment_id: null,
      p_dataset_version: "vor069-historical-backtest-v1",
      p_validation_days: 45,
    },
  );
  assert.ifError(siteError);
  assert.equal(siteData?.status, "ready");
  assert.equal(siteData?.datasetVersion, "vor069-historical-backtest-v1");
  assert.equal(Number(siteData?.summary?.scenarioCount), 24);
  assert.equal(Number(siteData?.summary?.breakdownCount), 12);
  assert.equal(Number(siteData?.summary?.elevatedRiskPrecededBreakdownCount), 12);
  assert.equal(Number(siteData?.summary?.preFailureStockoutCount), 6);
  assert.equal(Number(siteData?.summary?.stockoutExtendedRecoveryCount), 6);
  assert.equal(Number(siteData?.summary?.successfulInterventionCount), 6);
  assert.equal(Number(siteData?.summary?.falsePositiveCount), 6);
  assert.equal(Number(siteData?.summary?.preventabilitySupportedCount), 0);
  assert.equal(siteData?.summary?.preventabilityStatus, "not_established_from_sequence_alone");
  assert.equal(Number(siteData?.summary?.medianWarningDays), 21.3);
  assert.equal(Number(siteData?.summary?.medianVerifiedMaterialWaitMinutes), 630);

  const cases = Array.isArray(siteData?.cases) ? siteData.cases : [];
  const stockout = cases.find((item) => item?.scenarioType === "stockout_extended_recovery");
  const intervention = cases.find((item) => item?.scenarioType === "successful_intervention");
  const falsePositive = cases.find((item) => item?.scenarioType === "false_positive");
  assert.ok(stockout, "Backtest smoke has no stock-out recovery case");
  assert.ok(intervention, "Backtest smoke has no successful intervention case");
  assert.ok(falsePositive, "Backtest smoke has no false-positive case");
  assert.equal(Number(stockout.stock?.availableQuantity), 0);
  assert.equal(stockout.stock?.movementType, "261");
  assert.ok(Number(stockout.stock?.verifiedMaterialWaitMinutes) > 0);
  assert.ok(Number(intervention.risk?.observedPostInterventionReduction) > 0);
  assert.equal(falsePositive.validation?.noBreakdownInWindow, true);

  const equipmentId = String(stockout.equipment?.id ?? "");
  assert.ok(equipmentId, "Stock-out case has no equipment identity");
  const { data: equipmentData, error: equipmentError } = await supabase.rpc(
    "vorta_get_historical_backtest",
    {
      p_site_id: siteId,
      p_equipment_id: equipmentId,
      p_dataset_version: "vor069-historical-backtest-v1",
      p_validation_days: 45,
    },
  );
  assert.ifError(equipmentError);
  assert.equal(equipmentData?.equipmentId, equipmentId);
  assert.ok(Array.isArray(equipmentData?.cases) && equipmentData.cases.length > 0);

  console.log(
    JSON.stringify(
      {
        scenarioCount: siteData.summary.scenarioCount,
        breakdownCount: siteData.summary.breakdownCount,
        medianWarningDays: siteData.summary.medianWarningDays,
        medianVerifiedMaterialWaitMinutes:
          siteData.summary.medianVerifiedMaterialWaitMinutes,
        stockoutScenario: stockout.scenarioKey,
        equipmentId,
      },
      null,
      2,
    ),
  );
} finally {
  await supabase.auth.signOut();
}
