import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [styles, dashboardStyles, engineersRoute] = await Promise.all([
  readFile(new URL("../src/card-surfaces.css", import.meta.url), "utf8"),
  readFile(
    new URL(
      "../src/screens/AiOperations/sections/DashboardOverviewSection/dashboardMobileFocus.css",
      import.meta.url,
    ),
    "utf8",
  ),
  readFile(new URL("../src/screens/Engineers/EngineersRouteEntry.tsx", import.meta.url), "utf8"),
]);

assert.match(
  styles,
  /\[data-vorta-card="true"\][\s\S]*> \[class~="pt-0"\]:first-child/,
  "Content-only cards must recover their top padding.",
);
assert.match(
  dashboardStyles,
  /@media \(min-width: 768px\) \{[\s\S]*\[data-vorta-embedded-ai="true"\]/,
  "The approved embedded Ask Vorta presentation must apply at every non-phone width.",
);
assert.doesNotMatch(
  dashboardStyles,
  /@media \(min-width: 768px\) and \(max-width: 1439px\)/,
  "Chrome desktop-site mode must not bypass the approved Ask Vorta presentation.",
);
for (const teamClass of [
  "border-t-red-500",
  "border-t-emerald-500",
  "border-t-blue-500",
  "border-t-yellow-400",
  "border-t-slate-300",
  "border-t-violet-400",
  "border-t-cyan-400",
]) {
  assert.match(
    styles,
    new RegExp(teamClass),
    `Skills Matrix must retain the ${teamClass} capability edge.`,
  );
}
assert.match(
  styles,
  /border-left-color:[\s\S]*border-right-color:[\s\S]*border-bottom-color:/,
  "Skills Matrix capability cards must use team colour on left, top and right while keeping a neutral bottom edge.",
);
assert.match(
  engineersRoute,
  /data-vorta-original-shift-rota="true"/,
  "The original Engineers rota route must remain intact.",
);
assert.doesNotMatch(
  engineersRoute,
  /TabletEngineersSection/,
  "Presentation recovery must not restore the rejected Engineers replacement.",
);

console.log("Tablet card spacing, Ask Vorta and Skills Matrix team-edge contracts passed.");
