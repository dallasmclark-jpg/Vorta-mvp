import { readFileSync, writeFileSync } from "node:fs";

function replaceOnce(source, before, after, label) {
  const first = source.indexOf(before);
  if (first < 0) throw new Error(`VOR-087 could not find ${label}`);
  if (source.indexOf(before, first + before.length) >= 0) {
    throw new Error(`VOR-087 found more than one ${label}`);
  }
  return source.slice(0, first) + after + source.slice(first + before.length);
}

function replaceRegexOnce(source, pattern, replacement, label) {
  const matches = [...source.matchAll(new RegExp(pattern.source, pattern.flags.includes("g") ? pattern.flags : pattern.flags + "g"))];
  if (matches.length !== 1) {
    throw new Error(`VOR-087 expected exactly one ${label}, found ${matches.length}`);
  }
  return source.replace(pattern, replacement);
}

const globalPath = "src/screens/AiOperations/GlobalMaintenanceAiAssistant.tsx";
const workspacePath = "src/screens/AiOperations/AskVortaWorkspaceBase.tsx";

let globalSource = readFileSync(globalPath, "utf8");
let workspaceSource = readFileSync(workspacePath, "utf8");

globalSource = replaceOnce(
  globalSource,
  `import {\n  AskVortaWorkspace,\n  type AskVortaWorkspaceAnswer,\n  type AskVortaWorkspaceMessage,\n} from "./AskVortaWorkspace";`,
  `import {\n  AskVortaWorkspace,\n  type AskVortaWorkspaceAnswer,\n  type AskVortaWorkspaceMessage,\n} from "./AskVortaWorkspace";\nimport { AskVortaLiveEvidenceActivity } from "./AskVortaLiveEvidenceActivity";`,
  "shared live-evidence import",
);

globalSource = replaceRegexOnce(
  globalSource,
  /      \{!workspacePresentation && \(\n        <div className="flex flex-wrap items-center gap-1\.5">[\s\S]*?\n        <\/div>\n      \)\}\n\n      \{workspacePresentation \? \(/,
  `      {workspacePresentation ? (`,
  "compact response badges",
);

globalSource = replaceOnce(
  globalSource,
  `        <section className="rounded-2xl border border-blue-500/20 bg-blue-500/[0.06] p-5">\n          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-blue-300">\n            Direct answer\n          </p>\n          <p className="mt-2 text-lg font-semibold leading-8 text-slate-100">\n            {answer.directAnswer}\n          </p>\n        </section>`,
  `        <section\n          data-vorta-ai-primary-answer="true"\n          className="rounded-xl border border-gray-800 bg-gray-900/45 px-4 py-4"\n        >\n          <p className="text-lg font-semibold leading-8 text-slate-100">\n            {answer.directAnswer}\n          </p>\n        </section>`,
  "workspace primary answer",
);

globalSource = replaceRegexOnce(
  globalSource,
  /      \{answer\.decisionSummary && answer\.decisionSummary\.length > 0 && \([\s\S]*?\n      \)\}\n\n      \{hasStructuredFindings/,
  `      {answer.decisionSummary && answer.decisionSummary.length > 0 && (\n        sparePhotoIdentification ? (\n          <section\n            aria-labelledby="ask-vorta-decision-summary"\n            className="rounded-lg border border-blue-500/20 bg-blue-500/[0.06] px-3 py-3"\n          >\n            <h4\n              id="ask-vorta-decision-summary"\n              className="mb-2 flex items-center justify-between gap-2 text-[15px] font-bold uppercase tracking-wider text-blue-200 sm:text-sm"\n            >\n              <span>Closest stock matches</span>\n              {decisionSeverity && (\n                <span className="rounded-full border border-orange-500/30 bg-orange-500/10 px-2 py-0.5 text-xs font-bold normal-case tracking-normal text-orange-200">\n                  {decisionSeverity}\n                </span>\n              )}\n            </h4>\n            <ul className="flex flex-col gap-2.5">\n              {answer.decisionSummary.slice(0, decisionSummaryLimit).map((item, index) => (\n                <li\n                  key={\`${"${item.label}-${index}"}\`}\n                  className="flex items-start gap-2 text-[15px] leading-6 text-slate-200 sm:text-sm"\n                >\n                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400" />\n                  <span>\n                    <span className="font-bold text-slate-100">{item.label}:</span>{" "}\n                    {item.value}\n                  </span>\n                </li>\n              ))}\n            </ul>\n          </section>\n        ) : (\n          <div data-vorta-ai-progressive-decision="true" className="space-y-2">\n            <section\n              data-vorta-ai-primary-priority="true"\n              className="rounded-xl border border-blue-500/20 bg-blue-500/[0.045] px-3 py-3"\n            >\n              <div className="flex items-start justify-between gap-3">\n                <div className="min-w-0">\n                  <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">\n                    Priority\n                  </p>\n                  <p className="mt-1 text-sm font-bold leading-6 text-slate-100">\n                    {answer.decisionSummary[0].label}\n                  </p>\n                  <p className="mt-0.5 text-sm leading-6 text-slate-300">\n                    {answer.decisionSummary[0].value}\n                  </p>\n                </div>\n                {decisionSeverity && (\n                  <span className="shrink-0 rounded-full border border-orange-500/30 bg-orange-500/10 px-2 py-0.5 text-xs font-bold text-orange-200">\n                    {decisionSeverity}\n                  </span>\n                )}\n              </div>\n            </section>\n\n            {answer.decisionSummary.length > 1 && (\n              <details\n                data-vorta-ai-next-priorities="true"\n                className="group rounded-lg border border-gray-800 bg-gray-900/35"\n              >\n                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-3 text-sm font-bold text-slate-200">\n                  <span>Next priorities</span>\n                  <span className="flex items-center gap-2 text-xs font-medium text-slate-500">\n                    {Math.min(answer.decisionSummary.length - 1, Math.max(0, decisionSummaryLimit - 1))} more\n                    <ChevronDown className="h-4 w-4 text-blue-300 transition-transform group-open:rotate-180" />\n                  </span>\n                </summary>\n                <ul className="space-y-2 border-t border-gray-800 px-3 py-3">\n                  {answer.decisionSummary.slice(1, decisionSummaryLimit).map((item, index) => (\n                    <li\n                      key={\`${"${item.label}-${index}"}\`}\n                      className="flex items-start gap-2 text-sm leading-6 text-slate-300"\n                    >\n                      <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-400" />\n                      <span>\n                        <span className="font-bold text-slate-100">{item.label}:</span>{" "}\n                        {item.value}\n                      </span>\n                    </li>\n                  ))}\n                </ul>\n              </details>\n            )}\n          </div>\n        )\n      )}\n\n      {hasStructuredFindings`,
  "decision summary hierarchy",
);

globalSource = replaceOnce(
  globalSource,
  `<span>Detailed cover evidence</span>`,
  `<span>Supporting evidence</span>`,
  "structured evidence label",
);

globalSource = replaceRegexOnce(
  globalSource,
  /      \{!hasStructuredFindings && answer\.evidence\.length > 0 && \([\s\S]*?\n      \)\}\n\n      \{\(hasStructuredActions/,
  `      {!hasStructuredFindings && answer.evidence.length > 0 && (\n        <details\n          data-vorta-ai-supporting-evidence="true"\n          className="group rounded-lg border border-gray-800 bg-gray-900/35"\n        >\n          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-3 text-sm font-bold text-slate-200">\n            <span>Supporting evidence</span>\n            <span className="flex items-center gap-2 text-xs font-medium text-slate-500">\n              {answer.evidence.length} items\n              <ChevronDown className="h-4 w-4 text-blue-300 transition-transform group-open:rotate-180" />\n            </span>\n          </summary>\n          <ul className="space-y-2 border-t border-gray-800 px-3 py-3">\n            {answer.evidence.slice(0, 8).map((item) => (\n              <li key={item} className="flex gap-2 text-xs leading-relaxed text-slate-400">\n                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-blue-400" />\n                {item}\n              </li>\n            ))}\n          </ul>\n        </details>\n      )}\n\n      {(hasStructuredActions`,
  "generic evidence disclosure",
);

globalSource = replaceOnce(
  globalSource,
  `<span>Risk-reduction plan</span>`,
  `<span>Recommended actions</span>`,
  "recommended actions label",
);

globalSource = replaceOnce(
  globalSource,
  `      {answer.knowledgeChunks && answer.knowledgeChunks.length > 0 && (\n        <GlobalSourceCards chunks={answer.knowledgeChunks} />\n      )}`,
  `      {answer.knowledgeChunks && answer.knowledgeChunks.length > 0 && (\n        <details\n          data-vorta-ai-source-disclosure="true"\n          className="group rounded-lg border border-gray-800 bg-gray-900/35"\n        >\n          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-3 text-sm font-bold text-slate-200">\n            <span>Sources</span>\n            <span className="flex items-center gap-2 text-xs font-medium text-slate-500">\n              {answer.knowledgeChunks.length} verified\n              <ChevronDown className="h-4 w-4 text-blue-300 transition-transform group-open:rotate-180" />\n            </span>\n          </summary>\n          <div className="border-t border-gray-800 p-2">\n            <GlobalSourceCards chunks={answer.knowledgeChunks} />\n          </div>\n        </details>\n      )}`,
  "knowledge source disclosure",
);

globalSource = replaceRegexOnce(
  globalSource,
  /      \{!workspacePresentation && answer\.sources\.length > 0 && \([\s\S]*?\n      \)\}\n\n      \{answer\.roleNote/,
  `      {!workspacePresentation &&\n        answer.sources.length > 0 &&\n        (!answer.knowledgeChunks || answer.knowledgeChunks.length === 0) && (\n          <details\n            data-vorta-ai-source-disclosure="true"\n            className="group rounded-lg border border-gray-800 bg-gray-900/35"\n          >\n            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2.5 text-xs font-bold text-slate-300">\n              <span>Sources</span>\n              <span className="flex items-center gap-2 font-medium text-slate-500">\n                {answer.sources.length} verified\n                <ChevronDown className="h-3.5 w-3.5 text-blue-300 transition-transform group-open:rotate-180" />\n              </span>\n            </summary>\n            <div className="flex flex-wrap gap-1 border-t border-gray-800 px-3 py-2.5">\n              {answer.sources.slice(0, 8).map((source) => (\n                <Badge\n                  key={source}\n                  className="h-auto rounded border border-gray-700 bg-gray-800/70 px-1.5 py-0 text-xs font-medium text-slate-300 shadow-none"\n                >\n                  {source}\n                </Badge>\n              ))}\n            </div>\n          </details>\n        )}\n\n      {answer.roleNote`,
  "compact source badges",
);

globalSource = replaceOnce(
  globalSource,
  `                    <div className="flex items-center gap-2 text-xs text-slate-300">\n                      <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-400" />\n                      Choosing and checking the relevant Vorta sources...\n                    </div>`,
  `                    <AskVortaLiveEvidenceActivity />`,
  "compact loading state",
);

workspaceSource = replaceOnce(
  workspaceSource,
  `import {\n  ASK_VORTA_PROGRESS_EVENT,\n  ASK_VORTA_PROGRESS_RESET_EVENT,\n  type VortaAgentProgressEvent,\n  type VortaConversationContext,\n} from "./vortaAgentService";`,
  `import {\n  ASK_VORTA_PROGRESS_EVENT,\n  ASK_VORTA_PROGRESS_RESET_EVENT,\n  type VortaAgentProgressEvent,\n  type VortaConversationContext,\n} from "./vortaAgentService";\nimport { AskVortaLiveEvidenceActivity as SharedAskVortaLiveEvidenceActivity } from "./AskVortaLiveEvidenceActivity";`,
  "workspace live-evidence import",
);

workspaceSource = replaceRegexOnce(
  workspaceSource,
  /function AskVortaLiveEvidenceActivity\(\{[\s\S]*?\n\}\n\nfunction EmptyWorkspaceState/,
  `function AskVortaLiveEvidenceActivity({\n  steps,\n}: {\n  steps: VortaAgentProgressEvent[];\n}): JSX.Element {\n  void steps;\n  return <SharedAskVortaLiveEvidenceActivity />;\n}\n\nfunction EmptyWorkspaceState`,
  "workspace live-evidence renderer",
);

writeFileSync(globalPath, globalSource);
writeFileSync(workspacePath, workspaceSource);
console.log("VOR-087 universal Ask Vorta progressive-disclosure transform applied.");
