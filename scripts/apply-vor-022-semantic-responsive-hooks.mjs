import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

function read(path) {
  return readFileSync(path, "utf8");
}

function write(path, content) {
  writeFileSync(path, content, "utf8");
}

function replaceOnce(source, from, to, label) {
  const first = source.indexOf(from);
  if (first < 0) throw new Error(`VOR-022 patch target missing: ${label}`);
  if (source.indexOf(from, first + from.length) >= 0) {
    throw new Error(`VOR-022 patch target is ambiguous: ${label}`);
  }
  return `${source.slice(0, first)}${to}${source.slice(first + from.length)}`;
}

function walk(directory) {
  return readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

function addExplicitMobileTitleHooks() {
  const duplicateTitles = new Set([
    "operations overview",
    "shift handover",
    "equipment",
    "capability summary",
    "skills matrix",
    "engineers",
    "requirements",
    "requirements evidence",
    "training",
    "training plan",
    "training evidence",
    "training providers",
    "training provider evidence",
    "workforce development",
    "career evidence",
    "career",
    "pilot evidence",
    "pilot impact",
    "pilot adoption",
    "support",
    "support evidence",
    "settings",
    "system & access",
    "shift cover",
    "operational rota risk map",
    "labour risk",
  ]);

  for (const path of walk("src/screens").filter((value) => value.endsWith(".tsx"))) {
    let source = read(path);
    let changed = false;
    source = source.replace(/<h1(?![^>]*data-vorta-mobile-page-title)([^>]*)>([\s\S]*?)<\/h1>/g, (match, attributes, body) => {
      const plain = body
        .replace(/<[^>]+>/g, " ")
        .replace(/\{[^}]+\}/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .toLowerCase();
      if (!duplicateTitles.has(plain)) return match;
      changed = true;
      return `<h1 data-vorta-mobile-page-title="true"${attributes}>${body}</h1>`;
    });
    if (changed) write(path, source);
  }
}

function patchPortalShell() {
  const path = "src/components/PortalShell.tsx";
  let source = read(path);

  source = replaceOnce(
    source,
    'import { useEffect, useRef, useState } from "react";',
    'import { createContext, useContext, useEffect, useRef, useState } from "react";',
    "PortalShell React imports",
  );

  source = replaceOnce(
    source,
    `function isGrouped(nav: NavConfig): nav is NavGroup[] {\n  return nav.length > 0 && "groupLabel" in nav[0];\n}\n`,
    `function isGrouped(nav: NavConfig): nav is NavGroup[] {\n  return nav.length > 0 && "groupLabel" in nav[0];\n}\n\nconst PHONE_HIDDEN_ROUTES = new Set([\n  "/settings/pilot-setup",\n  "/settings/data-import",\n  "/design-system",\n  "/ai-matching",\n]);\n\nfunction filterPhoneItems(items: NavItem[]): NavItem[] {\n  return items\n    .filter((item) => !PHONE_HIDDEN_ROUTES.has(item.to))\n    .map((item) => ({\n      ...item,\n      children: item.children ? filterPhoneItems(item.children) : undefined,\n    }));\n}\n\nfunction filterPhoneNav(nav: NavConfig): NavConfig {\n  if (!isGrouped(nav)) return filterPhoneItems(nav);\n  return nav\n    .map((group) => ({ ...group, items: filterPhoneItems(group.items) }))\n    .filter((group) => group.items.length > 0);\n}\n\ninterface PortalMobileHeaderContextValue {\n  setTitle: (title: string) => void;\n}\n\nconst PortalMobileHeaderContext =\n  createContext<PortalMobileHeaderContextValue | null>(null);\n\nexport function usePortalMobileHeaderTitle(title: string): void {\n  const setTitle = useContext(PortalMobileHeaderContext)?.setTitle;\n\n  useEffect(() => {\n    setTitle?.(title);\n    return () => setTitle?.("");\n  }, [setTitle, title]);\n}\n`,
    "PortalShell phone navigation and mobile title context",
  );

  source = replaceOnce(
    source,
    '<aside data-vorta-sidebar="true" className="relative flex h-full max-h-[100dvh] w-full flex-col border-r border-gray-800 bg-[#090b10] px-2 py-5 2xl:px-4 overflow-hidden">',
    `<aside\n      data-vorta-sidebar="true"\n      data-vorta-sidebar-variant={forceLabels ? "mobile" : "desktop"}\n      className={\`relative flex h-full max-h-[100dvh] w-full flex-col border-gray-800 bg-[#090b10] px-2 py-5 2xl:px-4 overflow-hidden \${\n        forceLabels ? "border-l border-r-0" : "border-r"\n      }\`}\n    >`,
    "PortalShell semantic Sidebar variant",
  );

  source = replaceOnce(
    source,
    `  const [mobileOpen, setMobileOpen] = useState(false);\n  const scrollRef = useRef<HTMLDivElement>(null);`,
    `  const [mobileOpen, setMobileOpen] = useState(false);\n  const [mobileTitle, setMobileTitle] = useState("Dashboard");\n  const scrollRef = useRef<HTMLDivElement>(null);\n  const mobileNav = filterPhoneNav(nav);\n  const mobileSecondaryNav = secondaryNav\n    ? filterPhoneItems(secondaryNav)\n    : undefined;`,
    "PortalShell mobile state",
  );

  source = replaceOnce(
    source,
    `  return (\n    <main data-vorta-portal-shell="true" className="flex h-[100dvh] max-h-[100dvh] w-full overflow-hidden bg-[#0b0e14] text-white">`,
    `  return (\n    <PortalMobileHeaderContext.Provider value={{ setTitle: setMobileTitle }}>\n      <main data-vorta-portal-shell="true" className="flex h-[100dvh] max-h-[100dvh] w-full overflow-hidden bg-[#0b0e14] text-white">`,
    "PortalShell context provider opening",
  );

  source = replaceOnce(
    source,
    `<div className="fixed inset-0 z-50 flex md:hidden">`,
    `<div\n          data-vorta-mobile-navigation-overlay="true"\n          className="fixed inset-0 z-50 flex justify-end md:hidden"\n        >`,
    "PortalShell mobile overlay",
  );

  source = replaceOnce(
    source,
    `            className="relative z-50 flex w-64 shrink-0 flex-col"`,
    `            data-vorta-mobile-navigation-drawer="true"\n            className="relative z-50 flex w-[min(18rem,88vw)] shrink-0 flex-col"`,
    "PortalShell mobile drawer",
  );

  source = replaceOnce(
    source,
    `              nav={nav}\n              secondaryNav={secondaryNav}`,
    `              nav={mobileNav}\n              secondaryNav={mobileSecondaryNav}`,
    "PortalShell filtered mobile navigation",
  );

  source = replaceOnce(
    source,
    `        <div className="flex shrink-0 items-center gap-3 border-b border-gray-800 bg-[#090b10] px-4 py-1 md:hidden">\n          <button\n            type="button"\n            onClick={() => setMobileOpen(true)}\n            className="inline-flex h-10 w-10 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-white/10 hover:text-slate-200"\n            aria-label="Open menu"\n          >\n            <Menu className="h-5 w-5" />\n          </button>\n          <VortaIcon />\n        </div>`,
    `        <div\n          data-vorta-mobile-topbar="true"\n          className="grid min-h-16 shrink-0 grid-cols-[2.5rem_minmax(0,1fr)_2.5rem] items-center gap-3 border-b border-gray-800 bg-[#090b10] px-3 md:hidden"\n        >\n          <NavLink\n            to={homeRoute}\n            data-vorta-mobile-topbar-home="true"\n            aria-label="Go to main dashboard"\n            className="inline-flex h-10 w-10 items-center justify-center rounded-md text-slate-200 transition-opacity focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-400"\n          >\n            <VortaIcon />\n          </NavLink>\n          <h1\n            data-vorta-mobile-header-title="true"\n            className="min-w-0 truncate text-center text-lg font-semibold leading-6 text-slate-200"\n          >\n            {mobileTitle}\n          </h1>\n          <button\n            type="button"\n            data-vorta-mobile-topbar-menu="true"\n            onClick={() => setMobileOpen(true)}\n            className="inline-flex h-10 w-10 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-white/10 hover:text-slate-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-400"\n            aria-label="Open menu"\n          >\n            <Menu className="h-5 w-5" />\n          </button>\n        </div>`,
    "PortalShell semantic mobile topbar",
  );

  source = replaceOnce(
    source,
    `<div ref={scrollRef} className="min-w-0 flex-1 min-h-0 overflow-y-auto overflow-x-hidden">`,
    `<div\n          ref={scrollRef}\n          data-vorta-portal-scroll-container="true"\n          className="min-w-0 flex-1 min-h-0 overflow-y-auto overflow-x-hidden"\n        >`,
    "PortalShell semantic scroll container",
  );

  source = replaceOnce(
    source,
    `    </main>\n  );`,
    `      </main>\n    </PortalMobileHeaderContext.Provider>\n  );`,
    "PortalShell context provider closing",
  );

  write(path, source);
}

function patchMobileHeaderExperience() {
  const path = "src/screens/AiOperations/MobilePageHeaderExperience.tsx";
  const source = `import { useLocation } from "react-router-dom";\nimport { usePortalMobileHeaderTitle } from "../../components/PortalShell";\n\nconst PAGE_PROFILES: Array<{\n  matches: (pathname: string) => boolean;\n  title: string;\n}> = [\n  { matches: (pathname) => pathname === "/dashboard", title: "Dashboard" },\n  { matches: (pathname) => pathname === "/shift-handover", title: "Shift Handover" },\n  { matches: (pathname) => /^\\/equipment(?:\\/|$)/.test(pathname), title: "Equipment" },\n  { matches: (pathname) => pathname === "/skills-matrix", title: "Capability" },\n  { matches: (pathname) => pathname === "/engineers", title: "Engineers" },\n  { matches: (pathname) => pathname === "/requirements", title: "Requirements" },\n  { matches: (pathname) => pathname === "/training", title: "Training" },\n  { matches: (pathname) => pathname === "/training-providers", title: "Training Providers" },\n  { matches: (pathname) => pathname === "/career", title: "Development" },\n  {\n    matches: (pathname) => pathname === "/pilot-impact" || pathname === "/pilot-adoption",\n    title: "Pilot Evidence",\n  },\n  { matches: (pathname) => pathname === "/support", title: "Support" },\n  { matches: (pathname) => pathname === "/settings", title: "Settings" },\n  {\n    matches: (pathname) => pathname.includes("/maintenance/labour-risk/shift-cover"),\n    title: "Shift Cover",\n  },\n  {\n    matches: (pathname) => pathname.includes("/maintenance/labour-risk/"),\n    title: "Labour Risk",\n  },\n];\n\nfunction fallbackTitle(pathname: string): string {\n  const segment = pathname.split("/").filter(Boolean).at(-1) ?? "Dashboard";\n  return segment\n    .split("-")\n    .filter(Boolean)\n    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))\n    .join(" ");\n}\n\nexport function MobilePageHeaderExperience(): null {\n  const location = useLocation();\n  const title =\n    PAGE_PROFILES.find(({ matches }) => matches(location.pathname))?.title ??\n    fallbackTitle(location.pathname);\n\n  usePortalMobileHeaderTitle(title);\n  return null;\n}\n`;
  write(path, source);
}

function patchRequirements() {
  const path = "src/screens/Requirements/MobileRequirementsSection.tsx";
  let source = read(path);
  source = replaceOnce(
    source,
    `            <button\n              type="button"\n              onClick={() => navigate("/ai-matching")}\n              className="inline-flex min-h-12 items-center justify-between rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white"\n            >\n              Open AI Matching <ChevronRight className="h-4 w-4" />\n            </button>\n`,
    "",
    "retired mobile AI Matching action",
  );
  write(path, source);
}

function patchGlobalAssistant() {
  const path = "src/screens/AiOperations/GlobalMaintenanceAiAssistant.tsx";
  let source = read(path);

  source = replaceOnce(
    source,
    `<div className="fixed bottom-4 right-4 z-40 w-[min(420px,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-blue-500/20 bg-[#10141d] shadow-2xl shadow-black/60">`,
    `<div\n      data-vorta-global-ai-panel="true"\n      className="fixed bottom-4 right-4 z-40 w-[min(420px,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-blue-500/20 bg-[#10141d] shadow-2xl shadow-black/60 max-sm:inset-0 max-sm:flex max-sm:h-[100dvh] max-sm:w-screen max-sm:flex-col max-sm:rounded-none max-sm:border-0 max-sm:bg-[#0b0e14] max-sm:shadow-none"\n    >`,
    "global AI panel root",
  );

  source = replaceOnce(
    source,
    `<div className="flex items-center justify-between border-b border-gray-800 bg-[#141820] px-4 py-3">`,
    `<div\n        data-vorta-global-ai-header="true"\n        className="flex min-h-14 items-center justify-between border-b border-gray-800 bg-[#141820] px-4 py-3 max-sm:bg-[#0b0e14] max-sm:px-3"\n      >`,
    "global AI header",
  );

  source = replaceOnce(
    source,
    `            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-white/10 hover:text-slate-200"\n            aria-label="Minimise global assistant"`,
    `            data-vorta-global-ai-minimise="true"\n            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-white/10 hover:text-slate-200 max-sm:hidden"\n            aria-label="Minimise global assistant"`,
    "global AI minimise control",
  );

  source = replaceOnce(
    source,
    `<div className="flex max-h-[380px] flex-col gap-3 overflow-y-auto px-4 py-3">`,
    `<div\n            data-vorta-global-ai-messages="true"\n            className="flex max-h-[380px] flex-col gap-3 overflow-y-auto px-4 py-3 max-sm:min-h-0 max-sm:max-h-none max-sm:flex-1"\n          >`,
    "global AI messages",
  );

  source = replaceOnce(
    source,
    `<div className="border-t border-gray-800 px-4 py-3">\n            <div className="flex gap-2">`,
    `<div\n            data-vorta-global-ai-composer="true"\n            className="border-t border-gray-800 px-4 py-3 max-sm:bg-[#0b0e14] max-sm:px-3 max-sm:pb-[max(0.75rem,env(safe-area-inset-bottom))]"\n          >\n            <div\n              data-vorta-global-ai-composer-row="true"\n              className="flex gap-2"\n            >`,
    "global AI composer",
  );

  source = replaceOnce(
    source,
    `              <input\n                type="text"`,
    `              <input\n                data-vorta-global-ai-input="true"\n                type="text"`,
    "global AI input",
  );

  write(path, source);
}

function replaceFinalPolishCss() {
  const source = `@media (max-width: 767px) {\n  /* Legacy embedded assistants opt into this semantic boundary. The global\n     assistant owns its responsive layout in React and must remain visible. */\n  [data-vorta-embedded-ai="true"] {\n    display: none !important;\n  }\n\n  /* Route components explicitly mark headings duplicated by PortalShell's\n     mobile h1. The title remains accessible once through the shared shell. */\n  [data-vorta-mobile-page-title="true"] {\n    position: absolute;\n    width: 1px;\n    height: 1px;\n    padding: 0;\n    margin: -1px;\n    overflow: hidden;\n    clip: rect(0, 0, 0, 0);\n    clip-path: inset(50%);\n    white-space: nowrap;\n    border: 0;\n  }\n}\n`;
  write("src/screens/AiOperations/mobilePortalFinalPolish.css", source);
}

function updateContracts() {
  const path = "scripts/mobile-portal-final-polish-contracts.mjs";
  let source = read(path);

  source = replaceOnce(
    source,
    `const maintenanceExperience = read("src/screens/AiOperations/MaintenanceAiWorkOrderExperience.tsx");\nconst mobilePageHeader = read("src/screens/AiOperations/MobilePageHeaderExperience.tsx");`,
    `const maintenanceExperience = read("src/screens/AiOperations/MaintenanceAiWorkOrderExperience.tsx");\nconst globalAssistant = read("src/screens/AiOperations/GlobalMaintenanceAiAssistant.tsx");\nconst mobilePageHeader = read("src/screens/AiOperations/MobilePageHeaderExperience.tsx");`,
    "final polish contract global assistant source",
  );

  const oldHeaderAssertions = `assert.match(mobilePageHeader, /data-vorta-mobile-header-title/);\nassert.match(mobilePageHeader, /content: attr\\(data-vorta-mobile-header-title\\)/);\nassert.match(mobilePageHeader, /data-vorta-mobile-duplicate-page-title/);\nassert.match(mobilePageHeader, /data-vorta-mobile-settings-duplicate-theme-toggle/);\nassert.match(mobilePageHeader, /removeSettingsHeaderThemeShortcut/);\nassert.match(mobilePageHeader, /THEME_SHORTCUT_LABELS/);\nassert.match(mobilePageHeader, /title: "Capability"/);\nassert.match(mobilePageHeader, /title: "Shift Handover"/);\nassert.match(mobilePageHeader, /profile: \\{ title: "Equipment", duplicateHeadings: \\[\\] \\}/);\nassert.match(mobilePageHeader, /font-size: 1\\.125rem !important/);\nassert.match(mobilePageHeader, /min-height: 4rem !important/);\nassert.match(mobilePageHeader, /data-vorta-mobile-dashboard-logo-link/);\nassert.match(mobilePageHeader, /aria-label", "Go to main dashboard"/);\nassert.match(mobilePageHeader, /navigate\\("\\/dashboard"\\)/);\nassert.match(mobilePageHeader, /event\\.key !== "Enter" && event\\.key !== " "/);\nassert.match(portalShell, /<NavLink to=\\{homeRoute\\} aria-label="Vorta home"/);`;
  const newHeaderAssertions = `assert.match(mobilePageHeader, /usePortalMobileHeaderTitle\\(title\\)/);\nassert.match(mobilePageHeader, /title: "Capability"/);\nassert.match(mobilePageHeader, /title: "Shift Handover"/);\nassert.match(mobilePageHeader, /title: "Equipment"/);\nassert.doesNotMatch(mobilePageHeader, /querySelector|MutationObserver|content: attr|!important/);\nassert.match(portalShell, /PortalMobileHeaderContext/);\nassert.match(portalShell, /data-vorta-mobile-topbar="true"/);\nassert.match(portalShell, /data-vorta-mobile-header-title="true"/);\nassert.match(portalShell, /data-vorta-mobile-topbar-home="true"/);\nassert.match(portalShell, /aria-label="Go to main dashboard"/);\nassert.match(portalShell, /data-vorta-mobile-topbar-menu="true"/);\nassert.match(portalShell, /grid-cols-\\[2\\.5rem_minmax\\(0,1fr\\)_2\\.5rem\\]/);\nassert.match(portalShell, /data-vorta-mobile-navigation-overlay="true"/);\nassert.match(portalShell, /data-vorta-mobile-navigation-drawer="true"/);\nassert.match(portalShell, /PHONE_HIDDEN_ROUTES/);\nassert.match(portalShell, /filterPhoneNav/);\nassert.match(portalShell, /data-vorta-portal-scroll-container="true"/);`;
  source = replaceOnce(source, oldHeaderAssertions, newHeaderAssertions, "final polish header assertions");

  source = replaceOnce(
    source,
    `assert.match(requirementsEntry, /MobileRequirementsSection/);\nassert.match(mobileRequirements, /View capability evidence/);\nassert.match(polish, /Remove the retired standalone matching action/);\nassert.match(polish, /data-vorta-mobile-requirements/);\n\nassert.match(polish, /@media \\(max-width: 767px\\)/);\nassert.match(polish, /flex-direction: row-reverse !important/);\nassert.match(polish, /justify-content: space-between/);\nassert.match(polish, /justify-content: flex-end/);\nassert.match(polish, /aria-label="Portal navigation"/);\nassert.match(polish, /href="\\/settings\\/pilot-setup"/);\nassert.match(polish, /href="\\/settings\\/data-import"/);\nassert.match(polish, /@media \\(min-width: 640px\\) and \\(max-width: 767px\\)/);\nassert.match(polish, /height: 100dvh !important/);`,
    `assert.match(requirementsEntry, /MobileRequirementsSection/);\nassert.match(mobileRequirements, /View capability evidence/);\nassert.doesNotMatch(mobileRequirements, /Open AI Matching|navigate\\("\\/ai-matching"\\)/);\n\nassert.match(globalAssistant, /data-vorta-global-ai-panel="true"/);\nassert.match(globalAssistant, /data-vorta-global-ai-header="true"/);\nassert.match(globalAssistant, /data-vorta-global-ai-messages="true"/);\nassert.match(globalAssistant, /data-vorta-global-ai-composer="true"/);\nassert.match(globalAssistant, /data-vorta-global-ai-input="true"/);\nassert.match(globalAssistant, /max-sm:h-\\[100dvh\\]/);\nassert.match(globalAssistant, /max-sm:hidden/);\n\nassert.match(polish, /@media \\(max-width: 767px\\)/);\nassert.match(polish, /data-vorta-embedded-ai/);\nassert.match(polish, /data-vorta-mobile-page-title/);\nassert.doesNotMatch(polish, /:has\\(|md\\\\:hidden|href=|aria-label=|>\\s|\\[class|placeholder\\^=/);\nassert.equal((polish.match(/!important/g) ?? []).length, 1);`,
    "final polish semantic CSS assertions",
  );

  source = source.replace(
    'console.log("Final mobile portal navigation, retired demo statements, dashboard logo routing, page titles, settings controls, breakpoints, capability summary and route restrictions passed.");',
    'console.log("Semantic mobile portal navigation, shared page titles, AI layout, capability summary and route restrictions passed.");',
  );
  write(path, source);
}

addExplicitMobileTitleHooks();
patchPortalShell();
patchMobileHeaderExperience();
patchRequirements();
patchGlobalAssistant();
replaceFinalPolishCss();
updateContracts();

console.log("Applied VOR-022 semantic responsive hooks.");
