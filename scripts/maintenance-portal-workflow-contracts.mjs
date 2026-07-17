import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const operations = await readFile(
  new URL("../src/screens/AiOperations/AiOperations.tsx", import.meta.url),
  "utf8",
);
const brief = await readFile(
  new URL("../src/screens/AiOperations/MaintenanceOperationalBrief.tsx", import.meta.url),
  "utf8",
);

for (const kind of [
  "skills",
  "engineers",
  "matching",
  "requirements",
  "training",
  "providers",
]) {
  assert.match(
    operations,
    new RegExp(`kind=\\"${kind}\\"`),
    `${kind} route must use the maintenance operational brief`,
  );
}

assert.match(
  operations,
  /label: "Training Plan"/,
  "Maintenance navigation must frame bookings as an operational training plan",
);
assert.doesNotMatch(
  operations,
  /label: "Providers"/,
  "Training providers must not remain a permanent primary navigation item",
);
assert.match(
  operations,
  /path="training-providers"/,
  "Training providers must remain available as a contextual route",
);
assert.match(
  brief,
  /secondaryLabel: "Compare providers"/,
  "The training plan must provide contextual access to providers",
);
assert.match(
  brief,
  /data-maintenance-operational-brief=/,
  "Operational briefs must expose a stable UI contract marker",
);
assert.match(
  brief,
  /supabase\.functions\.invoke\(functionName\)/,
  "Operational briefs must use the shared cached live page payload",
);
assert.match(
  brief,
  /highest workforce exposure/,
  "Skills workflow must identify the highest workforce exposure",
);
assert.match(
  brief,
  /strongest current match/,
  "AI matching workflow must expose the strongest evidence-based match",
);
assert.match(
  brief,
  /Prioritise bookings by operational risk removed/,
  "Training workflow must be framed around operational risk reduction",
);

console.log("Maintenance portal workflow contracts passed.");
