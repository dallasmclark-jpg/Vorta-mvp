from __future__ import annotations

from pathlib import Path
import re
from textwrap import dedent

ROOT = Path.cwd()
MODE_CONST = 'const isLivePilotMode = String(import.meta.env.VITE_VORTA_DATA_MODE ?? "").trim().toLowerCase() === "live";'


def find_unique(name: str) -> Path:
    matches = [path for path in ROOT.glob(f"src/**/{name}") if path.is_file()]
    if len(matches) != 1:
        raise RuntimeError(f"Expected one {name}, found {len(matches)}: {matches}")
    return matches[0]


def read(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def write(path: Path, text: str) -> None:
    path.write_text(text, encoding="utf-8")


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise RuntimeError(f"Missing {label}")
    return text.replace(old, new, 1)


def insert_mode_const(text: str, anchor: str, label: str) -> str:
    if MODE_CONST in text:
        return text
    if anchor not in text:
        raise RuntimeError(f"Missing mode anchor for {label}: {anchor}")
    return text.replace(anchor, f"{MODE_CONST}\n\n{anchor}", 1)


def wrap_demo_only(path: Path, export_name: str, anchor: str, live_component: str) -> None:
    text = read(path)
    text = insert_mode_const(text, anchor, export_name)
    demo_name = f"Demo{export_name}"
    export_marker = f"export const {export_name}"
    if export_marker not in text:
        raise RuntimeError(f"Missing export marker for {export_name}")
    text = text.replace(export_marker, f"const {demo_name}", 1)
    if f'data-live-pilot-truth="{export_name}"' not in text:
        text = text.rstrip() + "\n\n" + live_component.strip() + "\n\n" + dedent(f'''
        export const {export_name} = (): JSX.Element =>
          isLivePilotMode ? <Live{export_name} /> : <{demo_name} />;
        ''').strip() + "\n"
    write(path, text)


def add_live_banner(text: str, component_export: str, message: str) -> str:
    marker = f"export const {component_export}"
    start = text.find(marker)
    if start < 0:
        raise RuntimeError(f"Missing component export {component_export}")
    header_end = text.find("</header>", start)
    if header_end < 0:
        raise RuntimeError(f"Missing first header close for {component_export}")
    header_end += len("</header>")
    banner_id = f'data-live-pilot-truth="{component_export}"'
    if banner_id in text:
        return text
    banner = dedent(f'''
        {{isLivePilotMode ? (
          <div {banner_id} className="w-full rounded-xl border border-blue-500/25 bg-blue-500/[0.07] px-4 py-3">
            <p className="text-sm font-semibold text-blue-200">Read-only live pilot</p>
            <p className="mt-1 text-xs leading-5 text-slate-400">{message}</p>
          </div>
        ) : null}}
    ''')
    return text[:header_end] + "\n\n" + banner.rstrip() + text[header_end:]


def disable_button_with_label(text: str, label: str) -> str:
    escaped = re.escape(label)
    patterns = [
        re.compile(rf'(<Button\b(?![^>]*disabled=\{{isLivePilotMode\}})[^>]*)(>[\s\S]{{0,320}}?{escaped}[\s\S]{{0,120}}?</Button>)'),
        re.compile(rf'(<button\b(?![^>]*disabled=\{{isLivePilotMode\}})[^>]*)(>[\s\S]{{0,420}}?{escaped}[\s\S]{{0,160}}?</button>)'),
    ]
    for pattern in patterns:
        match = pattern.search(text)
        if match:
            return text[:match.start()] + match.group(1) + ' disabled={isLivePilotMode} aria-disabled={isLivePilotMode}' + match.group(2) + text[match.end():]
    raise RuntimeError(f"Could not find button labelled {label}")


def patch_engineers() -> None:
    path = find_unique("EngineersSection.tsx")
    text = read(path)
    text = insert_mode_const(text, "const TABLE_PAGE_SIZE = 10;", "EngineersSection")

    calendar_pattern = re.compile(
        r'(?P<indent>\s*)<ShiftCalendar\s*\n'
        r'\s*title="Team Availability & Coverage Calendar"\s*\n'
        r'\s*events=\{MM_CALENDAR_EVENTS\}\s*\n'
        r'\s*role="engineer"\s*\n'
        r'\s*/>',
        re.MULTILINE,
    )
    match = calendar_pattern.search(text)
    if not match:
        raise RuntimeError("Could not locate Engineers mock ShiftCalendar")
    indent = match.group("indent")
    replacement = dedent('''
      {!isLivePilotMode ? (
        <ShiftCalendar
          title="Team Availability & Coverage Calendar"
          events={MM_CALENDAR_EVENTS}
          role="engineer"
        />
      ) : (
        <div data-live-pilot-truth="EngineersSection" className="flex w-full flex-col gap-3 rounded-xl border border-blue-500/25 bg-blue-500/[0.07] p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-blue-200">Coverage is managed in Shift Cover</p>
            <p className="mt-1 max-w-3xl text-xs leading-5 text-slate-400">
              The live pilot does not display the demonstration availability calendar or fixed coverage counts. Open Shift Cover for verified rota, gap and contractor-cover evidence.
            </p>
          </div>
          <a
            href="/shift-cover"
            className="inline-flex h-9 shrink-0 items-center justify-center rounded-lg border border-blue-500/30 bg-blue-500/10 px-4 text-xs font-semibold text-blue-300 transition-colors hover:bg-blue-500/20"
          >
            Open Shift Cover
          </a>
        </div>
      )}
    ''').rstrip()
    text = text[:match.start()] + indent + replacement.replace("\n", "\n" + indent) + text[match.end():]

    coverage_pattern = re.compile(
        r'(?P<comment>\s*\{/\* ── Coverage summary KPIs[\s\S]*?\*/\}\s*)'
        r'(?P<section><section className="grid w-full grid-cols-2 gap-4 sm:grid-cols-4">[\s\S]*?</section>)',
        re.MULTILINE,
    )
    match = coverage_pattern.search(text)
    if not match:
        raise RuntimeError("Could not locate Engineers fixed coverage KPI section")
    guarded = match.group("comment") + "{!isLivePilotMode ? (\n" + match.group("section") + "\n) : null}"
    text = text[:match.start()] + guarded + text[match.end():]
    write(path, text)


def patch_training() -> None:
    path = find_unique("TrainingSection.tsx")
    text = read(path)
    text = insert_mode_const(text, "const PRIORITY_PAGE_SIZE = 10;", "TrainingSection")
    text = replace_once(
        text,
        "{(canApprove || canComplete || canReject) && (",
        "{!isLivePilotMode && (canApprove || canComplete || canReject) && (",
        "Training booking local actions",
    )
    text = add_live_banner(
        text,
        "TrainingSection",
        "Training evidence remains available, but booking approvals, completion changes and plan creation are disabled until a persistent write workflow is intentionally introduced.",
    )
    text = disable_button_with_label(text, "Export")
    text = disable_button_with_label(text, "Create Training Plan")
    write(path, text)


def patch_ai_matching() -> None:
    path = find_unique("AiMatchingSection.tsx")
    text = read(path)
    text = insert_mode_const(text, "const PAGE_SIZE = 10;", "AiMatchingSection")
    text = add_live_banner(
        text,
        "AiMatchingSection",
        "Match scores and recommendations are available for review. Accept, dismiss, assignment and export controls are disabled because the MVP remains read-only.",
    )
    for label in ["Run AI Match", "Export Report", "Accept Recommendation", "Dismiss"]:
        text = disable_button_with_label(text, label)
    text = re.sub(
        r'(<button\b)(?![^>]*disabled=\{isLivePilotMode\})([^>]*onClick=\{\(\) => \{ onAccept)',
        r'\1 disabled={isLivePilotMode} aria-disabled={isLivePilotMode}\2',
        text,
    )
    text = re.sub(
        r'(<button\b)(?![^>]*disabled=\{isLivePilotMode\})([^>]*onClick=\{\(\) => \{ onDismiss)',
        r'\1 disabled={isLivePilotMode} aria-disabled={isLivePilotMode}\2',
        text,
    )
    write(path, text)


def patch_training_providers() -> None:
    path = find_unique("TrainingProvidersSection.tsx")
    text = read(path)
    text = insert_mode_const(text, "// ─── Helpers", "TrainingProvidersSection")
    text = add_live_banner(
        text,
        "TrainingProvidersSection",
        "Provider and course evidence is available for discovery. Shortlists, availability requests, exports and provider creation are disabled until those transactions can be persisted.",
    )
    for label in ["Export list", "Add provider", "Request Availability"]:
        text = disable_button_with_label(text, label)
    text = re.sub(
        r'(<button\b)(?![^>]*disabled=\{isLivePilotMode\})([^>]*onClick=\{\(\) => (?:onShortlist|handleShortlist))',
        r'\1 disabled={isLivePilotMode} aria-disabled={isLivePilotMode}\2',
        text,
    )
    write(path, text)


def patch_demo_only_pages() -> None:
    wrap_demo_only(
        find_unique("CareerSection.tsx"),
        "CareerSection",
        "const READINESS = 66;",
        dedent('''
        const LiveCareerSection = (): JSX.Element => (
          <section data-live-pilot-truth="CareerSection" className="relative flex min-w-0 w-full max-w-full flex-1 grow flex-col gap-6 overflow-x-hidden px-4 pb-12 pt-0 md:px-6 xl:px-8">
            <header className="py-5">
              <p className="text-xs font-medium text-slate-400">Career development</p>
              <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-50">My Career</h1>
            </header>
            <div className="rounded-xl border border-amber-500/25 bg-[#141820] p-6">
              <p className="text-sm font-semibold text-amber-200">Career profile not enabled for the live pilot</p>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
                Demonstration qualifications, readiness scores and named user records have been withheld. This page will be enabled only when the signed-in manager’s verified profile and role requirements are available.
              </p>
            </div>
          </section>
        );
        '''),
    )
    wrap_demo_only(
        find_unique("SupportSection.tsx"),
        "SupportSection",
        "// ─── Types",
        dedent('''
        const LiveSupportSection = (): JSX.Element => (
          <section data-live-pilot-truth="SupportSection" className="relative flex min-w-0 w-full max-w-full flex-1 grow flex-col gap-6 overflow-x-hidden px-4 pb-12 pt-0 md:px-6 xl:px-8">
            <header className="py-5">
              <p className="text-xs font-medium text-slate-400">Pilot support</p>
              <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-50">Support</h1>
              <p className="mt-1 text-sm text-slate-400">Contact Vorta without creating a simulated ticket record.</p>
            </header>
            <div className="rounded-xl border border-blue-500/25 bg-[#141820] p-6">
              <p className="text-sm font-semibold text-slate-100">Email Vorta Support</p>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
                The live pilot does not display demonstration ticket history or claim that a request was persisted when no ticketing integration exists.
              </p>
              <a href="mailto:support@vorta.network" className="mt-5 inline-flex h-10 items-center justify-center rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-500">
                support@vorta.network
              </a>
            </div>
          </section>
        );
        '''),
    )
    wrap_demo_only(
        find_unique("SettingsSection.tsx"),
        "SettingsSection",
        "// ─── Toast",
        dedent('''
        const LiveSettingsSection = (): JSX.Element => (
          <section data-live-pilot-truth="SettingsSection" className="relative flex min-w-0 w-full max-w-full flex-1 grow flex-col gap-6 overflow-x-hidden px-4 pb-12 pt-0 md:px-6 xl:px-8">
            <header className="py-5">
              <p className="text-xs font-medium text-slate-400">Administration</p>
              <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-50">Settings</h1>
            </header>
            <div className="rounded-xl border border-amber-500/25 bg-[#141820] p-6">
              <p className="text-sm font-semibold text-amber-200">Configuration is read-only during the live pilot</p>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
                Demonstration site details, billing records, team members, invites and approval rules have been withheld. Pilot configuration changes are managed through the controlled deployment process until persistent administration workflows are available.
              </p>
            </div>
          </section>
        );
        '''),
    )


def add_contract() -> None:
    contract = ROOT / "scripts/live-pilot-truth-contracts.mjs"
    contract.write_text(dedent(r'''
        import { readFileSync, readdirSync, statSync } from "node:fs";
        import { dirname, join, resolve } from "node:path";
        import { fileURLToPath } from "node:url";

        const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

        function findFile(directory, filename) {
          for (const entry of readdirSync(directory)) {
            const path = join(directory, entry);
            if (statSync(path).isDirectory()) {
              const nested = findFile(path, filename);
              if (nested) return nested;
            } else if (entry === filename) {
              return path;
            }
          }
          return null;
        }

        function source(filename) {
          const path = findFile(join(root, "src"), filename);
          if (!path) throw new Error(`Could not locate ${filename}`);
          return readFileSync(path, "utf8");
        }

        function assertIncludes(text, value, label) {
          if (!text.includes(value)) throw new Error(`${label}: missing ${value}`);
        }

        for (const filename of ["CareerSection.tsx", "SupportSection.tsx", "SettingsSection.tsx"]) {
          const text = source(filename);
          assertIncludes(text, "isLivePilotMode", filename);
          assertIncludes(text, "data-live-pilot-truth", filename);
          assertIncludes(text, `Demo${filename.replace(".tsx", "")}`, filename);
        }

        const engineers = source("EngineersSection.tsx");
        assertIncludes(engineers, "Open Shift Cover", "Engineers live coverage");
        assertIncludes(engineers, "!isLivePilotMode", "Engineers live coverage");
        assertIncludes(engineers, 'data-live-pilot-truth="EngineersSection"', "Engineers live coverage");

        for (const filename of ["TrainingSection.tsx", "AiMatchingSection.tsx", "TrainingProvidersSection.tsx"]) {
          const text = source(filename);
          assertIncludes(text, "Read-only live pilot", filename);
          assertIncludes(text, "disabled={isLivePilotMode}", filename);
          assertIncludes(text, "data-live-pilot-truth", filename);
        }

        const runner = readFileSync(join(root, "scripts/run-contract-suite.mjs"), "utf8");
        assertIncludes(runner, "scripts/live-pilot-truth-contracts.mjs", "Contract runner");

        console.log("Live-pilot truth contracts passed.");
    ''').strip() + "\n", encoding="utf-8")

    runner = ROOT / "scripts/run-contract-suite.mjs"
    text = read(runner)
    entry = '  ["Live pilot truth", "scripts/live-pilot-truth-contracts.mjs"],\n'
    if entry not in text:
        text = replace_once(
            text,
            '  ["Repository hygiene", "scripts/repository-hygiene-contracts.mjs"],\n',
            '  ["Repository hygiene", "scripts/repository-hygiene-contracts.mjs"],\n' + entry,
            "contract runner insertion",
        )
        write(runner, text)


def main() -> None:
    patch_demo_only_pages()
    patch_engineers()
    patch_training()
    patch_ai_matching()
    patch_training_providers()
    add_contract()
    print("Applied live-pilot truth gates.")


if __name__ == "__main__":
    main()
