import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  resolveConversationFollowUp,
  sanitizeConversationContext,
} from "../netlify/functions/_shared/askVortaConversationContext.mjs";

const fixturePath = process.argv[2] || "tests/evals/vor-045-conversation-context.json";
const fixture = JSON.parse(readFileSync(fixturePath, "utf8"));
const scenarios = Array.isArray(fixture.scenarios) ? fixture.scenarios : [];
const contexts = new Map();
const failures = [];

for (const scenario of scenarios) {
  try {
    let context = scenario.context ?? contexts.get(scenario.contextRef) ?? null;
    if (scenario.roundTrip && context) {
      context = sanitizeConversationContext(JSON.parse(JSON.stringify(context)));
    }
    const sanitised = sanitizeConversationContext(context);
    if (scenario.context) contexts.set(scenario.id, sanitised);
    if (scenario.contextRef && sanitised) contexts.set(scenario.id, sanitised);

    const resolution = resolveConversationFollowUp(scenario.question, sanitised);
    const expected = scenario.expect ?? {};

    if (Object.hasOwn(expected, "selectedPosition")) {
      assert.equal(resolution.selectedOption?.position ?? null, expected.selectedPosition);
    }
    if (Object.hasOwn(expected, "equipmentQuery")) {
      assert.equal(resolution.activeEquipmentQuery, expected.equipmentQuery);
    }
    if (Object.hasOwn(expected, "subject")) {
      assert.equal(resolution.inheritedSubject, expected.subject);
    }
    if (Object.hasOwn(expected, "inheritedDateRange")) {
      assert.deepEqual(resolution.inheritedDateRange, expected.inheritedDateRange);
    }
    if (Object.hasOwn(expected, "shouldClarify")) {
      assert.equal(resolution.shouldClarify, expected.shouldClarify);
    }
    if (Object.hasOwn(expected, "usedContext")) {
      assert.equal(resolution.usedContext, expected.usedContext);
    }
    if (Object.hasOwn(expected, "hasExplicitDate")) {
      assert.equal(resolution.hasExplicitDate, expected.hasExplicitDate);
    }
    if (Object.hasOwn(expected, "hasExplicitEquipment")) {
      assert.equal(resolution.hasExplicitEquipment, expected.hasExplicitEquipment);
    }
    if (expected.clarificationContains) {
      assert.match(
        resolution.clarificationQuestion ?? "",
        new RegExp(expected.clarificationContains, "i"),
      );
    }

    console.log(`✓ ${scenario.id}`);
  } catch (error) {
    failures.push({ id: scenario.id, error });
    console.error(`✗ ${scenario.id}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

console.log(`\n${scenarios.length - failures.length}/${scenarios.length} VOR-045 multi-turn scenarios passed.`);
if (failures.length) process.exit(1);
