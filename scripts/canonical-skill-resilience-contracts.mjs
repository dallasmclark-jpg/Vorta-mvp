import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20260719234500_canonicalise_equipment_skill_resilience.sql",
    import.meta.url,
  ),
  "utf8",
);

function authoritySatisfies(actual, required) {
  const current = String(actual ?? "").toLowerCase();
  const needed = String(required ?? "independent").toLowerCase();
  if (needed === "authoriser") return current === "authoriser";
  if (needed === "independent") {
    return current === "independent" || current === "authoriser";
  }
  return true;
}

function qualifies({
  engineerVerified,
  capabilityActive,
  capabilityValidated,
  skillStatus,
  rating,
  requiredLevel,
  skillAuthority,
  capabilityAuthority,
  requiredAuthority,
  skillExpiryValid,
  capabilityValidityValid,
}) {
  return Boolean(
    engineerVerified &&
      capabilityActive &&
      capabilityValidated &&
      !["expired", "rejected"].includes(String(skillStatus).toLowerCase()) &&
      rating >= requiredLevel &&
      authoritySatisfies(skillAuthority, requiredAuthority) &&
      authoritySatisfies(capabilityAuthority, requiredAuthority) &&
      skillExpiryValid &&
      capabilityValidityValid,
  );
}

assert.equal(
  qualifies({
    engineerVerified: true,
    capabilityActive: true,
    capabilityValidated: true,
    skillStatus: "validated",
    rating: 4,
    requiredLevel: 3,
    skillAuthority: "authoriser",
    capabilityAuthority: "AUTHORISER",
    requiredAuthority: "authoriser",
    skillExpiryValid: true,
    capabilityValidityValid: true,
  }),
  true,
);
assert.equal(
  qualifies({
    engineerVerified: true,
    capabilityActive: true,
    capabilityValidated: true,
    skillStatus: "validated",
    rating: 4,
    requiredLevel: 3,
    skillAuthority: "independent",
    capabilityAuthority: "INDEPENDENT",
    requiredAuthority: "authoriser",
    skillExpiryValid: true,
    capabilityValidityValid: true,
  }),
  false,
  "Independent capability must not satisfy an authoriser requirement",
);
assert.equal(
  qualifies({
    engineerVerified: true,
    capabilityActive: true,
    capabilityValidated: true,
    skillStatus: "expired",
    rating: 4,
    requiredLevel: 3,
    skillAuthority: "authoriser",
    capabilityAuthority: "AUTHORISER",
    requiredAuthority: "authoriser",
    skillExpiryValid: true,
    capabilityValidityValid: true,
  }),
  false,
  "Expired evidence must not qualify",
);

for (const expected of [
  "private.vorta_get_equipment_skill_resilience",
  "public.engineer_skills",
  "public.equipment_engineer_capabilities",
  "engineer.verified",
  "capability.capability_status = 'ACTIVE'",
  "capability.validation_status = 'VALIDATED'",
  "engineer_skill.verification_status",
  "engineer_skill.expiry_date",
  "capability.valid_until",
  "engineer_skill.practice_authority",
  "capability.practice_authority",
  "requirement.minimum_qualified_engineers",
  "skill_resilience_score",
  "private.vorta_get_equipment_people_resilience",
  "public.vorta_sync_equipment_risk_counts",
  "resilience.single_person_skill_count",
  "Current-shift coverage is reported separately",
]) {
  assert.ok(migration.includes(expected), `Missing canonical skill contract: ${expected}`);
}

assert.match(migration, /capability\.capability_role = 'BACKUP_SME'/);
assert.match(migration, /lower\(coalesce\(equipment\.criticality, ''\)\) in \('critical', 'high'\)/);
assert.match(migration, /ranked_backups\.backup_rank = 1/);
assert.match(migration, /on conflict\(engineer_id, skill_id\) do update/);
assert.match(migration, /v_missing_assets <> 0/);
assert.match(migration, /v_gap_assets <= 0 or v_gap_assets >= v_asset_count/);
assert.doesNotMatch(
  migration,
  /single_point_skill_gap = lr\.single_point_skill_count > 0/,
);

console.log("Canonical skill resilience contracts passed.");
