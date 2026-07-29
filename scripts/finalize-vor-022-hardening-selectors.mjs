import { readFileSync, writeFileSync } from "node:fs";

const read = (path) => readFileSync(path, "utf8");
const write = (path, value) => writeFileSync(path, value, "utf8");

function replaceRequired(source, from, to, label) {
  if (!source.includes(from)) throw new Error(`Missing VOR-022 target: ${label}`);
  return source.replaceAll(from, to);
}

const hardeningPath = "src/screens/AiOperations/mobilePortalHardening.css";
let hardening = read(hardeningPath);
const obsoleteTopbar = `  [data-vorta-portal-shell="true"] > section > div.md\\:hidden {
    display: grid !important;
    grid-template-columns: 2.5rem minmax(0, 1fr) 2.5rem;
    align-items: center;
    gap: 0.75rem;
    min-height: 3rem;
    padding-inline: 0.75rem;
  }

  [data-vorta-portal-shell="true"] > section > div.md\\:hidden::after {
    grid-column: 2;
    grid-row: 1;
    min-width: 0;
    overflow: hidden;
    color: rgb(203 213 225);
    content: attr(data-vorta-mobile-page-title);
    font-size: 0.8125rem;
    font-weight: 600;
    line-height: 1.25rem;
    text-align: center;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  [data-vorta-portal-shell="true"] > section > div.md\\:hidden > button {
    grid-column: 3;
    grid-row: 1;
    justify-self: end;
    margin-left: 0 !important;
  }

  [data-vorta-portal-shell="true"] > section > div.md\\:hidden > :not(button) {
    grid-column: 1;
    grid-row: 1;
    justify-self: start;
    min-width: 0;
  }

`;
if (!hardening.includes(obsoleteTopbar)) {
  throw new Error("Obsolete structural mobile topbar block was not found");
}
hardening = hardening.replace(obsoleteTopbar, "");

const root = '[data-vorta-maintenance-portal="true"] > div.fixed:has(button[aria-label="Close global assistant"])';
hardening = replaceRequired(hardening, `${root} > div.border-t > div.flex`, '[data-vorta-global-ai-composer-row="true"]', "AI composer row");
hardening = replaceRequired(hardening, `${root} > div.border-t`, '[data-vorta-global-ai-composer="true"]', "AI composer");
hardening = replaceRequired(
  hardening,
  `${root} > div.flex:not(:first-child):not(:has(> div.mb-2))`,
  '[data-vorta-global-ai-messages="true"]',
  "AI messages",
);
hardening = replaceRequired(hardening, `${root} > div:first-child`, '[data-vorta-global-ai-header="true"]', "AI header");
hardening = replaceRequired(hardening, root, '[data-vorta-global-ai-panel="true"]', "AI panel root");

if (hardening.includes('> section > div.md\\:hidden') || hardening.includes('content: attr(data-vorta-mobile-page-title)')) {
  throw new Error("Structural mobile topbar styling remains in hardening CSS");
}
if (hardening.includes('div.fixed:has(button[aria-label="Close global assistant"])')) {
  throw new Error("Global assistant still depends on a :has root selector");
}
write(hardeningPath, hardening);

const polishPath = "src/screens/AiOperations/MobileAiPolishStyles.tsx";
let polish = read(polishPath);
polish = replaceRequired(polish, `${root} > div.border-t > div.flex`, '[data-vorta-global-ai-composer-row="true"]', "polish composer row");
polish = replaceRequired(polish, `${root} > div.border-t`, '[data-vorta-global-ai-composer="true"]', "polish composer");
polish = replaceRequired(polish, `${root} > div:first-child`, '[data-vorta-global-ai-header="true"]', "polish header");
polish = replaceRequired(polish, root, '[data-vorta-global-ai-panel="true"]', "polish panel root");
if (polish.includes('div.fixed:has(button[aria-label="Close global assistant"])')) {
  throw new Error("Mobile AI polish still depends on the structural global-assistant root");
}
write(polishPath, polish);

const auditPath = "scripts/mobile-portal-audit-contracts.mjs";
let audit = read(auditPath);
if (!audit.includes('const portalShell = read("src/components/PortalShell.tsx");')) {
  audit = audit.replace(
    'const pageTransition = read("src/components/PageTransition.tsx");',
    'const pageTransition = read("src/components/PageTransition.tsx");\nconst portalShell = read("src/components/PortalShell.tsx");',
  );
}
audit = audit.replace(
  `  pageTransition.includes("vortaMobilePageTitle") &&
    pageTransition.includes("mobileRouteLabel") &&
    mobileHardening.includes("grid-template-columns: 2.5rem minmax(0, 1fr) 2.5rem") &&
    mobileHardening.includes('> div.md\\\\:hidden > button') &&
    mobileHardening.includes("grid-column: 3"),`,
  `  portalShell.includes('data-vorta-mobile-topbar="true"') &&
    portalShell.includes('data-vorta-mobile-topbar-home="true"') &&
    portalShell.includes('data-vorta-mobile-header-title="true"') &&
    portalShell.includes('data-vorta-mobile-topbar-menu="true"') &&
    portalShell.includes("grid-cols-[2.5rem_minmax(0,1fr)_2.5rem]") &&
    !mobileHardening.includes('> section > div.md\\\\:hidden'),`,
);
audit = audit.replace(
  '"The shared phone header must lock logo-left, title-centre and menu-right positions."',
  '"The shared phone header must use semantic logo-left, title-centre and menu-right positions."',
);
write(auditPath, audit);

const finalContractPath = "scripts/mobile-portal-final-polish-contracts.mjs";
let finalContract = read(finalContractPath);
if (!finalContract.includes('const mobileHardening = read("src/screens/AiOperations/mobilePortalHardening.css");')) {
  finalContract = finalContract.replace(
    'const polish = read("src/screens/AiOperations/mobilePortalFinalPolish.css");',
    'const polish = read("src/screens/AiOperations/mobilePortalFinalPolish.css");\nconst mobileHardening = read("src/screens/AiOperations/mobilePortalHardening.css");\nconst mobileAiPolish = read("src/screens/AiOperations/MobileAiPolishStyles.tsx");',
  );
}
finalContract = finalContract.replace(
  'assert.equal((polish.match(/!important/g) ?? []).length, 1);',
  `assert.equal((polish.match(/!important/g) ?? []).length, 1);
assert.doesNotMatch(mobileHardening, /> section > div\\.md\\\\:hidden|content: attr\\(data-vorta-mobile-page-title\\)/);
assert.doesNotMatch(mobileHardening, /div\\.fixed:has\\(button\\[aria-label="Close global assistant"\\]\\)/);
assert.match(mobileHardening, /data-vorta-global-ai-panel/);
assert.match(mobileHardening, /data-vorta-global-ai-header/);
assert.match(mobileHardening, /data-vorta-global-ai-messages/);
assert.match(mobileHardening, /data-vorta-global-ai-composer/);
assert.doesNotMatch(mobileAiPolish, /div\\.fixed:has\\(button\\[aria-label="Close global assistant"\\]\\)/);
assert.match(mobileAiPolish, /data-vorta-global-ai-panel/);
assert.match(mobileAiPolish, /data-vorta-global-ai-composer-row/);`,
);
write(finalContractPath, finalContract);

console.log("Finalised VOR-022 hardening selectors.");
