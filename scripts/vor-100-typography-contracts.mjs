import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const typography = readFileSync(resolve("src/typography-system.ts"), "utf8");
const parity = readFileSync(resolve("src/portal-visual-parity.ts"), "utf8");
const indexHtml = readFileSync(resolve("index.html"), "utf8");
const governance = readFileSync(resolve("docs/vorta-typography-system.md"), "utf8");

function mustMatch(source, pattern, message) {
  if (!pattern.test(source)) {
    console.error(`VOR-100 typography contract failed: ${message}`);
    process.exit(1);
  }
}

function mustNotMatch(source, pattern, message) {
  if (pattern.test(source)) {
    console.error(`VOR-100 typography contract failed: ${message}`);
    process.exit(1);
  }
}

mustMatch(parity, /import "\.\/typography-system";/, "the shared portal bootstrap must install the typography system before page parity styling");
mustMatch(indexHtml, /family=Inter:wght@400;500;600;700/, "Inter must remain the stable core UI/body family");
mustMatch(typography, /Inter\+Tight:wght@500;600;700/, "Inter Tight must be loaded only as the controlled display layer");
mustMatch(typography, /--vorta-font-ui:\s*"Inter"/, "the UI family token must be Inter");
mustMatch(typography, /--vorta-font-display:\s*"Inter Tight",\s*"Inter"/, "the display family must fall back to Inter");
mustMatch(typography, /font-variant-numeric:\s*lining-nums tabular-nums/, "operational numerals must use lining tabular figures");
mustMatch(typography, /\[data-vorta-page-content="true"\][\s\S]*:is\(h1, h2\)[\s\S]*font-family:\s*var\(--vorta-font-display\)/, "product page h1/h2 hierarchy must use the display family");
mustMatch(typography, /\.vorta-type-page-title[\s\S]*font-weight:\s*600/, "page titles must use the restrained semibold hierarchy");
mustMatch(typography, /\.vorta-type-body[\s\S]*font-weight:\s*400/, "body copy must remain regular weight");
mustMatch(typography, /\.vorta-type-control[\s\S]*font-weight:\s*500/, "controls must use medium weight");
mustMatch(typography, /\.vorta-type-eyebrow[\s\S]*letter-spacing:\s*0\.08em[\s\S]*text-transform:\s*uppercase/, "technical eyebrow labels must use the governed tracked uppercase treatment");
mustMatch(typography, /\.vorta-type-kpi[\s\S]*font-family:\s*var\(--vorta-font-display\)/, "KPI values must use the display family");
mustMatch(typography, /@media \(max-width: 767px\)/, "the typography scale must include a phone treatment");
mustMatch(governance, /Product page title \| Inter Tight \| 28px \| 600 \| 34px/, "the documented page-title role must match the runtime baseline");
mustMatch(governance, /Operational numerals use \*\*lining tabular figures\*\*/, "numeral governance must be documented");
mustMatch(governance, /Any future family replacement requires a dedicated snag/, "future typography replacements must remain controlled");
mustNotMatch(typography, /font-weight:\s*(800|900)/, "the operational typography layer must not introduce 800/900 weights");

console.log("VOR-100 typography contracts passed.");
