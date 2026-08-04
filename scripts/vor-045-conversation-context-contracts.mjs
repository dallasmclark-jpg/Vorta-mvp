import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import {
  createConversationContext,
  resolveConversationFollowUp,
  sanitizeConversationContext,
} from "../netlify/functions/_shared/askVortaConversationContext.mjs";

const baseContext = createConversationContext({
  subject: "equipment",
  intent: "ranked maintenance action",
  activeEquipment: {
    query: "VF-02",
    code: "VF-02",
    name: "Bosch Vial Filler",
  },
  dateRange: {
    startDate: "2026-08-03",
    endDate: "2026-08-09",
    timezone: "Europe/London",
  },
  orderedOptions: [
    {
      position: 1,
      type: "ranked_action",
      label: "WO-250511 · WFI-01",
      equipmentQuery: "WFI-01",
      reference: "WO-250511",
    },
    {
      position: 2,
      type: "ranked_action",
      label: "WO-250466 · VF-02",
      equipmentQuery: "VF-02",
      reference: "WO-250466",
    },
    {
      position: 3,
      type: "ranked_action",
      label: "WO-250477 · AUT-02",
      equipmentQuery: "AUT-02",
      reference: "WO-250477",
    },
  ],
});

assert.ok(baseContext, "base context must be valid");
assert.equal(baseContext.orderedOptions.length, 3);
assert.equal(
  JSON.stringify(sanitizeConversationContext(JSON.parse(JSON.stringify(baseContext)))),
  JSON.stringify(baseContext),
  "Recent conversation restore must preserve the same bounded context",
);

const ordinal = resolveConversationFollowUp("Show me the second option", baseContext);
assert.equal(ordinal.shouldClarify, false);
assert.equal(ordinal.selectedOption?.position, 2);
assert.equal(ordinal.activeEquipmentQuery, "VF-02");
assert.equal(ordinal.inheritedSubject, "equipment");

const pronoun = resolveConversationFollowUp("What is stopping that asset?", baseContext);
assert.equal(pronoun.shouldClarify, false);
assert.equal(pronoun.activeEquipmentQuery, "VF-02");

const explicitAsset = resolveConversationFollowUp("What about AUT-02?", baseContext);
assert.equal(explicitAsset.hasExplicitEquipment, true);
assert.equal(explicitAsset.activeEquipmentQuery, null, "explicit asset text must override inherited equipment");

const changedDate = resolveConversationFollowUp("What about next week?", baseContext);
assert.equal(changedDate.inheritedSubject, "equipment");
assert.equal(changedDate.hasExplicitDate, true);
assert.equal(changedDate.inheritedDateRange, null, "explicit dates must replace the inherited window");

const inheritedDate = resolveConversationFollowUp("And for the same asset?", baseContext);
assert.deepEqual(inheritedDate.inheritedDateRange, baseContext.dateRange);

const outOfRange = resolveConversationFollowUp("Show option 7", baseContext);
assert.equal(outOfRange.shouldClarify, true);
assert.match(outOfRange.clarificationQuestion ?? "", /contains 3/i);

const ambiguousContext = createConversationContext({
  subject: "shift_cover",
  intent: "cover options",
  orderedOptions: [
    { position: 1, type: "cover", label: "Option A" },
    { position: 2, type: "cover", label: "Option B" },
  ],
});
const ambiguous = resolveConversationFollowUp("What about that one?", ambiguousContext);
assert.equal(ambiguous.shouldClarify, true);
assert.match(ambiguous.clarificationQuestion ?? "", /Which one/i);

const bounded = sanitizeConversationContext({
  version: 1,
  subject: "equipment",
  intent: "x".repeat(500),
  orderedOptions: Array.from({ length: 20 }, (_, index) => ({
    position: index + 1,
    type: "equipment",
    label: `Asset ${index + 1}`,
    equipmentQuery: `EQ-${index + 1}`,
    unexpected: "must be removed",
  })),
  activeEquipment: { query: "EQ-1", injected: "no" },
  extra: "no",
});
assert.ok(bounded);
assert.equal(bounded.orderedOptions.length, 8);
assert.equal(bounded.intent.length, 120);
assert.equal("extra" in bounded, false);
assert.equal("unexpected" in bounded.orderedOptions[0], false);
assert.equal("injected" in bounded.activeEquipment, false);

const multiTurnEval = spawnSync(
  process.execPath,
  [
    "scripts/vor-045-multi-turn-context-evals.mjs",
    "tests/evals/vor-045-conversation-context.json",
  ],
  { encoding: "utf8" },
);
assert.equal(
  multiTurnEval.status,
  0,
  `VOR-045 multi-turn context fixture failed:\n${multiTurnEval.stdout}\n${multiTurnEval.stderr}`,
);

const normaliser = readFileSync("scripts/vor-045-normalise-request-context.mjs", "utf8");
assert.match(normaliser, /interface PageContext/);
assert.match(normaliser, /pageContext: PageContext/);
assert.match(normaliser, /equipmentReferenceFromQuestion/);
assert.match(normaliser, /request\.question\.trim\(\)/);

const integration = readFileSync("scripts/vor-045-integrate-conversation-context.mjs", "utf8");
assert.match(integration, /conversationContext/);
assert.match(integration, /resolveConversationFollowUp/);
assert.match(integration, /buildConversationContext/);
assert.match(integration, /latestConversationContext/);
assert.match(integration, /clarificationQuestion/);
assert.match(integration, /selectedOption/);
assert.match(integration, /orderedOptions/);
assert.doesNotMatch(integration, /ShiftHandover|shift-handover|src\/screens\/ShiftHandover/);

const packageJson = JSON.parse(readFileSync("package.json", "utf8"));
assert.equal(packageJson.scripts.prebuild, "node scripts/validate-live-pilot.mjs");
assert.equal(
  packageJson.scripts.build,
  "npm run build:metadata && npm run typecheck && npm run test:contracts && npm run test:smoke && vite build",
);
assert.match(
  packageJson.scripts["build:metadata"],
  /vor-044-integrate-operational-value\.mjs && node scripts\/vor-045-normalise-request-context\.mjs && node scripts\/vor-045-integrate-conversation-context\.mjs(?: && node scripts\/vor-046-integrate-image-backend\.mjs && node scripts\/vor-046-integrate-image-client\.mjs)?(?: && node scripts\/vor-047-integrate-confirmed-actions\.mjs)?(?: && node scripts\/vor-048-integrate-routing-telemetry-feedback\.mjs)?(?: && node scripts\/vor-049-integrate-decision-ready-equipment\.mjs)? && node scripts\/write-build-metadata\.mjs/,
);
assert.match(
  packageJson.scripts.predev,
  /vor-044-integrate-operational-value\.mjs && node scripts\/vor-045-normalise-request-context\.mjs && node scripts\/vor-045-integrate-conversation-context\.mjs(?: && node scripts\/vor-046-integrate-image-backend\.mjs && node scripts\/vor-046-integrate-image-client\.mjs)?(?: && node scripts\/vor-047-integrate-confirmed-actions\.mjs)?(?: && node scripts\/vor-048-integrate-routing-telemetry-feedback\.mjs)?(?: && node scripts\/vor-049-integrate-decision-ready-equipment\.mjs)?/,
);

console.log("VOR-045 conversational context contracts passed.");
