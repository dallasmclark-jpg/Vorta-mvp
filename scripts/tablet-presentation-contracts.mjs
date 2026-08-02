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
  /\[data-vorta-card="true"\][\s\S]*> \[class\*="pt-0"\]:first-child/,
  "Responsive content-only cards must recover their top padding.",
);
assert.match(
  dashboardStyles,
  /\[data-vorta-embedded-ai="true"\][\s\S]*border: 0 !important;[\s\S]*background: transparent !important;[\s\S]*box-shadow: none !important;/,
  "The embedded Ask Vorta control must retain the approved slim, flat outer treatment.",
);
assert.match(
  dashboardStyles,
  /\.flex\.min-w-0\.flex-1\.items-center:focus-within[\s\S]*border-color: rgb\(55 65 81\) !important;[\s\S]*box-shadow: none !important;/,
  "The embedded Ask Vorta input must not draw the rejected blue focus rectangle.",
);
assert.doesNotMatch(
  dashboardStyles,
  /box-shadow:\s*0 14px 32px|border:\s*1px solid rgba\(96, 165, 250/,
  "The rejected glowing Ask Vorta shell must not return.",
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
  /button\[aria-pressed\][\s\S]*::before[\s\S]*padding: 2px 1px 0;[\s\S]*linear-gradient\([\s\S]*transparent 86%[\s\S]*mask-composite: exclude/,
  "Skills Matrix cards must use a strong top edge with side colours fading towards the bottom.",
);
assert.match(
  styles,
  /\[data-vorta-card-rail="labour-risk"\] > :nth-child\(n \+ 5\)[\s\S]*display: none !important;/,
  "The combined Spares and Labour Risks rail must show only its four highest-ranked cards.",
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

console.log("Final Ask Vorta, top-four risk rail and faded Skills Matrix edge contracts passed.");
