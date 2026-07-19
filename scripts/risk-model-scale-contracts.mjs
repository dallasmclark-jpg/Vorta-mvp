import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20260719223000_normalise_risk_model_scale.sql",
    import.meta.url,
  ),
  "utf8",
);

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}

function areaOperationalScore({
  maximumOperationalRisk,
  averageOperationalRisk,
  atRiskAssets,
  totalAssets,
}) {
  const prevalence = totalAssets > 0 ? atRiskAssets / totalAssets : 0;
  return clamp(
    Number(
      (
        maximumOperationalRisk * 0.55 +
        averageOperationalRisk * 0.3 +
        prevalence * 15
      ).toFixed(1),
    ),
    5,
    96,
  );
}

function siteOperationalScore({
  maximumAreaOperationalRisk,
  averageAreaOperationalRisk,
  atRiskAssets,
  totalAssets,
}) {
  const prevalence = totalAssets > 0 ? atRiskAssets / totalAssets : 0;
  return clamp(
    Number(
      (
        maximumAreaOperationalRisk * 0.6 +
        averageAreaOperationalRisk * 0.25 +
        prevalence * 15
      ).toFixed(1),
    ),
    5,
    96,
  );
}

const areaBaseline = {
  maximumOperationalRisk: 88,
  averageOperationalRisk: 61,
  atRiskAssets: 4,
  totalAssets: 5,
};
const areaDoubled = {
  ...areaBaseline,
  atRiskAssets: areaBaseline.atRiskAssets * 2,
  totalAssets: areaBaseline.totalAssets * 2,
};

assert.equal(
  areaOperationalScore(areaBaseline),
  areaOperationalScore(areaDoubled),
  "Area risk must not change when an identical asset population is duplicated",
);

const siteBaseline = {
  maximumAreaOperationalRisk: 90.8,
  averageAreaOperationalRisk: 54.6,
  atRiskAssets: 8,
  totalAssets: 35,
};
const siteDoubled = {
  ...siteBaseline,
  atRiskAssets: siteBaseline.atRiskAssets * 2,
  totalAssets: siteBaseline.totalAssets * 2,
};

assert.equal(
  siteOperationalScore(siteBaseline),
  siteOperationalScore(siteDoubled),
  "Site risk must not change when an identical asset population is duplicated",
);

assert.ok(
  siteOperationalScore({
    maximumAreaOperationalRisk: 100,
    averageAreaOperationalRisk: 100,
    atRiskAssets: 100,
    totalAssets: 100,
  }) <= 96,
  "The existing operational ceiling must remain intact",
);

assert.match(migration, /operational_at_risk_assets, 0\)::numeric\s*\/\s*nullif\(r\.asset_count, 0\)/);
assert.match(migration, /operational_at_risk, 0\)::numeric\s*\/\s*nullif\(total_assets, 0\)/);
assert.doesNotMatch(migration, /operational_at_risk_assets\s*\*\s*5/);
assert.doesNotMatch(migration, /operational_at_risk\s*\*\s*3/);
assert.match(migration, /if r\.no_engineer_override then/);
assert.match(migration, /if lr\.no_engineer_override then/);

console.log("Risk model scale contracts passed.");
