import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";

function replaceOnce(source, search, replacement, label) {
  const first = source.indexOf(search);
  assert.notEqual(first, -1, `Missing ${label}`);
  assert.equal(source.indexOf(search, first + search.length), -1, `Duplicate ${label}`);
  return source.slice(0, first) + replacement + source.slice(first + search.length);
}

function replaceRegexOnce(source, pattern, replacement, label) {
  const matches = [...source.matchAll(new RegExp(pattern.source, pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`))];
  assert.equal(matches.length, 1, `Expected one ${label}; found ${matches.length}`);
  return source.replace(pattern, replacement);
}

const workspacePath = "src/screens/AiOperations/AskVortaWorkspace.tsx";
let workspace = readFileSync(workspacePath, "utf8");

workspace = replaceOnce(
  workspace,
  "  PanelLeftClose,\n  Send,",
  "  PanelLeftClose,\n  PanelLeftOpen,\n  Send,",
  "workspace sidebar icons",
);

workspace = replaceOnce(
  workspace,
  "  promptPlaceholder: string;\n  onInputChange: (value: string) => void;",
  "  promptPlaceholder: string;\n  welcomeDetail: string;\n  suggestedPrompts: string[];\n  onInputChange: (value: string) => void;",
  "workspace prompt props",
);

workspace = replaceRegexOnce(
  workspace,
  /function conversationTitle\(messages: AskVortaWorkspaceMessage\[\]\): string \{[\s\S]*?\n\}/,
  `function conversationTitle(messages: AskVortaWorkspaceMessage[]): string {
  const question = messages.find(
    (message) => message.role === "user" && message.text?.trim(),
  )?.text?.trim();
  if (!question) return "New Ask Vorta conversation";

  const concise = question
    .replace(/^(what|which|who|where|when|why|how)\\s+(are|is|do|does|did|can|could|should|would|will)?\\s*/i, "")
    .replace(/^show\\s+(me\\s+)?/i, "")
    .replace(/^tell\\s+me\\s+/i, "")
    .replace(/[?.!]+$/, "")
    .trim();
  const title = concise || question.replace(/[?.!]+$/, "").trim();
  const capitalised = title ? title[0].toUpperCase() + title.slice(1) : "Ask Vorta conversation";
  return capitalised.length > 54 ? capitalised.slice(0, 51) + "…" : capitalised;
}`,
  "conversation title helper",
);

workspace = replaceOnce(
  workspace,
  "function EmptyWorkspaceState({",
  `type RecentConversationGroup = {
  label: "Today" | "Yesterday" | "Previous 7 days" | "Older";
  conversations: StoredConversation[];
};

function groupStoredConversations(conversations: StoredConversation[]): RecentConversationGroup[] {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const yesterdayStart = todayStart - 86_400_000;
  const sevenDaysStart = todayStart - 6 * 86_400_000;
  const buckets = new Map<RecentConversationGroup["label"], StoredConversation[]>([
    ["Today", []],
    ["Yesterday", []],
    ["Previous 7 days", []],
    ["Older", []],
  ]);

  conversations.forEach((conversation) => {
    const timestamp = new Date(conversation.updatedAt).getTime();
    const label: RecentConversationGroup["label"] =
      Number.isNaN(timestamp) || timestamp < sevenDaysStart
        ? "Older"
        : timestamp >= todayStart
          ? "Today"
          : timestamp >= yesterdayStart
            ? "Yesterday"
            : "Previous 7 days";
    buckets.get(label)?.push(conversation);
  });

  return (["Today", "Yesterday", "Previous 7 days", "Older"] as const)
    .map((label) => ({ label, conversations: buckets.get(label) ?? [] }))
    .filter((group) => group.conversations.length > 0);
}

function evidenceSourceCount(answer: AskVortaWorkspaceAnswer): number {
  return new Set(answer.sources ?? []).size;
}

function EmptyWorkspaceState({`,
  "recent grouping helpers",
);

workspace = replaceOnce(
  workspace,
  "  promptPlaceholder,\n  onInputChange,",
  "  promptPlaceholder,\n  welcomeDetail,\n  suggestedPrompts,\n  onInputChange,",
  "workspace prop destructuring",
);

workspace = replaceOnce(
  workspace,
  "  const [activeTab, setActiveTab] = useState<AskVortaWorkspaceTab>(\"conversation\");\n  const [recents, setRecents]",
  "  const [activeTab, setActiveTab] = useState<AskVortaWorkspaceTab>(\"conversation\");\n  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);\n  const [recents, setRecents]",
  "workspace sidebar state",
);

workspace = replaceRegexOnce(
  workspace,
  /  const latestAnswer = useMemo\([\s\S]*?  const visibleConversationMessages = hasUserQuestion[\s\S]*?    : messages;/,
  `  const hasUserQuestion = messages.some(
    (message) => message.role === "user" && message.text?.trim(),
  );
  const latestAnswer = useMemo(
    () =>
      hasUserQuestion
        ? [...messages].reverse().find((message) => message.answer)?.answer ?? null
        : null,
    [hasUserQuestion, messages],
  );
  const visibleConversationMessages = hasUserQuestion
    ? messages.filter(
        (message, index) =>
          !(
            index === 0 &&
            message.role === "assistant" &&
            Boolean(message.answer)
          ),
      )
    : [];
  const recentGroups = useMemo(() => groupStoredConversations(recents), [recents]);`,
  "workspace derived conversation state",
);

workspace = replaceRegexOnce(
  workspace,
  /      <aside className="flex w-64 shrink-0 flex-col border-r border-gray-800 bg-gray-950">[\s\S]*?      <\/aside>\n\n      <main/,
  `      <aside
        className={
          "flex shrink-0 flex-col border-r border-gray-800 bg-gray-950 transition-[width] duration-200 " +
          (sidebarCollapsed ? "w-16" : "w-64")
        }
      >
        <div
          className={
            "flex h-16 items-center border-b border-gray-800 " +
            (sidebarCollapsed ? "justify-center px-2" : "gap-3 px-4")
          }
        >
          {!sidebarCollapsed ? (
            <>
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-500/15">
                <Sparkles className="h-4 w-4 text-blue-300" />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="truncate text-sm font-bold text-slate-100">Ask Vorta</h2>
                <p className="truncate text-xs text-slate-500">{roleSubtitle}</p>
              </div>
            </>
          ) : null}
          <button
            type="button"
            onClick={() => setSidebarCollapsed((current) => !current)}
            aria-label={sidebarCollapsed ? "Expand recent conversations" : "Collapse recent conversations"}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-white/[0.05] hover:text-white"
          >
            {sidebarCollapsed ? (
              <PanelLeftOpen className="h-4 w-4" />
            ) : (
              <PanelLeftClose className="h-4 w-4" />
            )}
          </button>
        </div>

        <div className={sidebarCollapsed ? "p-2" : "p-3"}>
          <Button
            type="button"
            onClick={startConversation}
            aria-label="New conversation"
            className={
              "h-10 bg-blue-600 text-sm font-semibold text-white hover:bg-blue-500 " +
              (sidebarCollapsed
                ? "w-10 justify-center p-0"
                : "w-full justify-start gap-2 px-3")
            }
          >
            <MessageSquarePlus className="h-4 w-4" />
            {!sidebarCollapsed ? <span>New conversation</span> : null}
          </Button>
        </div>

        {!sidebarCollapsed ? (
          <div className="flex min-h-0 flex-1 flex-col px-3 pb-3">
            <div className="mb-2 flex items-center gap-2 px-2 text-xs font-bold uppercase tracking-widest text-slate-500">
              <Clock3 className="h-3.5 w-3.5" />
              Recents
            </div>
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
              {recentGroups.length === 0 ? (
                <p className="rounded-lg border border-dashed border-gray-800 px-3 py-4 text-xs leading-5 text-slate-500">
                  Recent conversations will appear here after the first question.
                </p>
              ) : (
                recentGroups.map((group) => (
                  <section key={group.label} aria-label={group.label}>
                    <h3 className="mb-1.5 px-2 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-600">
                      {group.label}
                    </h3>
                    <div className="space-y-1">
                      {group.conversations.map((conversation) => (
                        <button
                          key={conversation.id}
                          type="button"
                          onClick={() => restoreConversation(conversation)}
                          aria-current={
                            conversation.id === currentConversationId ? "page" : undefined
                          }
                          className={
                            "w-full rounded-lg border px-3 py-2.5 text-left transition-colors " +
                            (conversation.id === currentConversationId
                              ? "border-blue-500/35 bg-blue-500/10 text-slate-100"
                              : "border-transparent text-slate-300 hover:border-gray-700 hover:bg-white/5")
                          }
                        >
                          <span className="block line-clamp-2 text-sm font-semibold leading-5">
                            {conversation.title}
                          </span>
                          <span className="mt-1 block text-xs text-slate-500">
                            {formatRecentDate(conversation.updatedAt)}
                          </span>
                        </button>
                      ))}
                    </div>
                  </section>
                ))
              )}
            </div>
          </div>
        ) : null}
      </aside>

      <main`,
  "workspace sidebar",
);

workspace = replaceRegexOnce(
  workspace,
  /            <div className="hidden min-w-0 items-center gap-2 text-xs text-slate-500 xl:flex">[\s\S]*?            <\/div>\n          <\/div>/,
  `            <div
              className={
                "hidden h-8 items-center gap-2 rounded-full border px-2.5 text-xs font-semibold lg:inline-flex " +
                (contextReady
                  ? "border-emerald-500/20 bg-emerald-500/[0.06] text-emerald-200"
                  : loadingContext
                    ? "border-blue-500/20 bg-blue-500/[0.06] text-blue-200"
                    : "border-amber-500/20 bg-amber-500/[0.06] text-amber-200")
              }
              title={contextLine}
              aria-live="polite"
            >
              {loadingContext ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : contextReady ? (
                <span className="h-2 w-2 rounded-full bg-emerald-400" aria-hidden="true" />
              ) : (
                <AlertTriangle className="h-3.5 w-3.5" />
              )}
              <span>
                {loadingContext
                  ? "Loading evidence"
                  : contextReady
                    ? "Live evidence"
                    : "Evidence unavailable"}
              </span>
            </div>
          </div>`,
  "workspace evidence status",
);

workspace = replaceOnce(
  workspace,
  `              className="mx-auto flex w-full max-w-4xl flex-col gap-5 px-6 py-7 xl:px-10"
            >
              {visibleConversationMessages.map((message) => (`,
  `              className={
                "mx-auto flex w-full max-w-[1050px] flex-col px-6 xl:px-10 " +
                (hasUserQuestion ? "gap-5 py-7" : "min-h-full justify-center py-10")
              }
            >
              {!hasUserQuestion ? (
                <section
                  data-vorta-ai-workspace-welcome="true"
                  className="mx-auto flex w-full max-w-3xl flex-col items-center text-center"
                >
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-blue-500/20 bg-blue-500/10">
                    <Sparkles className="h-5 w-5 text-blue-300" />
                  </div>
                  <h2 className="mt-5 text-3xl font-semibold tracking-tight text-slate-50">
                    What can I help with?
                  </h2>
                  <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">
                    {welcomeDetail}
                  </p>
                  <div className="mt-8 grid w-full gap-3 sm:grid-cols-2">
                    {suggestedPrompts.slice(0, 4).map((prompt) => (
                      <button
                        key={prompt}
                        type="button"
                        disabled={!contextReady}
                        onClick={() => onSubmit(prompt)}
                        className="group flex min-h-16 items-center justify-between gap-3 rounded-xl border border-gray-800 bg-gray-900/70 px-4 py-3 text-left text-sm font-semibold leading-5 text-slate-200 transition-colors hover:border-blue-500/35 hover:bg-blue-500/[0.07] disabled:cursor-not-allowed disabled:opacity-45"
                      >
                        <span>{prompt}</span>
                        <ChevronLeft className="h-4 w-4 shrink-0 rotate-180 text-slate-600 transition-colors group-hover:text-blue-300" />
                      </button>
                    ))}
                  </div>
                </section>
              ) : null}
              {visibleConversationMessages.map((message) => (`,
  "workspace welcome",
);

workspace = replaceOnce(
  workspace,
  `                  <div
                    className={\`rounded-2xl px-4 py-3 \${
                      message.role === "user"
                        ? "max-w-3xl bg-blue-600 text-white"
                        : "w-full border border-gray-800 bg-gray-900 text-slate-200"
                    }\`}
                  >`,
  `                  <div
                    className={
                      message.role === "user"
                        ? "max-w-3xl rounded-2xl bg-blue-600 px-4 py-3 text-white"
                        : message.answer
                          ? "w-full text-slate-200"
                          : "w-full rounded-2xl border border-gray-800 bg-gray-900 px-4 py-3 text-slate-200"
                    }
                  >`,
  "workspace message surfaces",
);

workspace = replaceOnce(
  workspace,
  `                    ) : message.answer ? (
                      renderAnswer(message.answer)
                    ) : (`,
  `                    ) : message.answer ? (
                      <div className="space-y-4">
                        {renderAnswer(message.answer)}
                        <button
                          type="button"
                          data-vorta-ai-workspace-source-summary="true"
                          onClick={() => setActiveTab("evidence")}
                          className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/[0.06] px-3 py-2 text-xs font-semibold text-emerald-200 transition-colors hover:border-emerald-400/40 hover:bg-emerald-500/[0.1]"
                        >
                          <ShieldCheck className="h-3.5 w-3.5" />
                          {evidenceSourceCount(message.answer) > 0
                            ? evidenceSourceCount(message.answer) === 1
                              ? "1 verified Vorta source"
                              : evidenceSourceCount(message.answer) + " verified Vorta sources"
                            : "Open evidence details"}
                          <ChevronLeft className="h-3.5 w-3.5 rotate-180" />
                        </button>
                      </div>
                    ) : (`,
  "workspace source summary",
);

workspace = replaceOnce(
  workspace,
  `          <div className="shrink-0 border-t border-gray-800 bg-gray-950 px-6 py-4">
            <div className="mx-auto max-w-4xl">`,
  `          <div className="shrink-0 border-t border-gray-800 bg-gray-950/95 px-6 py-4 backdrop-blur">
            <div className="mx-auto max-w-[1050px]">`,
  "workspace composer width",
);

workspace = replaceOnce(
  workspace,
  `              <div className="flex gap-2 rounded-xl border border-gray-700 bg-gray-900 p-2 focus-within:border-blue-500/50">`,
  `              <div className="flex gap-2 rounded-2xl border border-gray-700 bg-[#111722] p-2 shadow-lg shadow-black/20 focus-within:border-blue-500/50">`,
  "workspace composer surface",
);

writeFileSync(workspacePath, workspace);

const assistantPath = "src/screens/AiOperations/GlobalMaintenanceAiAssistant.tsx";
let assistant = readFileSync(assistantPath, "utf8");

assistant = replaceOnce(
  assistant,
  `    quickQuestions: [
      "Who is off and who can cover next week?",
      "Which spares could delay a repair?",
      "Where are our single-person skill risks?",
      "What previous work was done on FD-03?",
      "What actions reduce risk most?",
    ],`,
  `    quickQuestions: [
      "What are my highest site risks?",
      "What shift-cover issues do I have next week?",
      "Which maintenance action reduces risk the most?",
      "Show equipment that needs attention",
    ],`,
  "maintenance manager suggested prompts",
);

assistant = replaceOnce(
  assistant,
  `        promptPlaceholder={roleProfile.promptPlaceholder}
        onInputChange={setInput}`,
  `        promptPlaceholder={roleProfile.promptPlaceholder}
        welcomeDetail={
          roleProfile.role === "maintenance-manager"
            ? "Ask about risk, equipment, maintenance history, skills, spares or documents."
            : roleProfile.contextLine
        }
        suggestedPrompts={roleProfile.quickQuestions}
        onInputChange={setInput}`,
  "workspace welcome props",
);

assistant = replaceOnce(
  assistant,
  `  return (
    <div className="flex flex-col gap-2">`,
  `  return (
    <div className={workspacePresentation ? "flex flex-col gap-4" : "flex flex-col gap-2"}>`,
  "answer block spacing",
);

assistant = replaceOnce(
  assistant,
  `      <p
        className={
          workspacePresentation
            ? "border-l-2 border-blue-400/70 pl-4 text-lg font-semibold leading-8 text-slate-100"
            : "text-base leading-7 text-slate-200 sm:text-sm sm:leading-6"
        }
      >
        {answer.directAnswer}
      </p>`,
  `      {workspacePresentation ? (
        <section className="rounded-2xl border border-blue-500/20 bg-blue-500/[0.06] p-5">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-blue-300">
            Direct answer
          </p>
          <p className="mt-2 text-lg font-semibold leading-8 text-slate-100">
            {answer.directAnswer}
          </p>
        </section>
      ) : (
        <p className="text-base leading-7 text-slate-200 sm:text-sm sm:leading-6">
          {answer.directAnswer}
        </p>
      )}`,
  "workspace direct answer hero",
);

assistant = replaceOnce(
  assistant,
  `      {answer.sources.length > 0 && (`,
  `      {!workspacePresentation && answer.sources.length > 0 && (`,
  "workspace source badges",
);

assistant = replaceRegexOnce(
  assistant,
  /      <div className="flex items-start justify-between gap-3 border-t border-gray-800 pt-2 text-xs text-slate-500">[\s\S]*?      <\/div>\n      \{answer\.responseId && \(/,
  `      <div className="flex items-start justify-between gap-3 border-t border-gray-800 pt-2 text-xs text-slate-500">
        {workspacePresentation ? (
          <span>
            {evidenceUpdatedLabel ? `Evidence updated ${evidenceUpdatedLabel}` : "Evidence checked for this response"}
          </span>
        ) : (
          <span>
            <span className="inline-flex items-center gap-1.5">
              <ShieldCheck className="h-3 w-3 text-emerald-400" />
              Source-backed response
            </span>
            {evidenceUpdatedLabel && (
              <span className="mt-0.5 block pl-[18px]">
                Evidence updated {evidenceUpdatedLabel}
              </span>
            )}
          </span>
        )}
        <span className="shrink-0 font-semibold text-blue-400">
          {workspacePresentation ? "Confidence " : ""}{answer.confidence}%{" "}
          {workspacePresentation ? "· " : ""}
          {answer.confidence >= 90
            ? "High"
            : answer.confidence >= 75
              ? "Medium"
              : "Low"}
          {!workspacePresentation ? " confidence" : ""}
        </span>
      </div>
      {answer.responseId && (`,
  "answer evidence footer",
);

writeFileSync(assistantPath, assistant);

const cssPath = "src/screens/AiOperations/mobilePortalHardening.css";
let css = readFileSync(cssPath, "utf8");
css = replaceRegexOnce(
  css,
  /  \/\* Quick-question chips and the verbose verified-context sentence stay out of the default mobile view\. \*\/[\s\S]*?  \/\* Conversation area\. \*\//,
  `  /* Keep the mobile landing clean while surfacing three useful prompt chips above the composer. */
  [data-vorta-global-ai-panel="true"] > div:has(> div.mb-2) {
    order: 3;
    display: block !important;
    padding: 0.35rem 0.75rem 0.25rem !important;
    border-bottom: 0 !important;
    background: rgb(11 14 20) !important;
  }

  [data-vorta-global-ai-panel="true"] > div:has(> div.mb-2):has(+ [data-vorta-global-ai-messages="true"] > div:nth-child(2)) {
    display: none !important;
  }

  [data-vorta-global-ai-panel="true"] > div:has(> div.mb-2) > div.mb-2 {
    display: flex !important;
    gap: 0.5rem !important;
    margin: 0 !important;
    overflow-x: auto;
    padding-bottom: 0.15rem;
    scrollbar-width: none;
  }

  [data-vorta-global-ai-panel="true"] > div:has(> div.mb-2) > div.mb-2::-webkit-scrollbar {
    display: none;
  }

  [data-vorta-global-ai-panel="true"] > div:has(> div.mb-2) > div.mb-2 > button {
    min-height: 2rem;
    flex: 0 0 auto;
    padding: 0.35rem 0.65rem !important;
    white-space: nowrap;
  }

  [data-vorta-global-ai-panel="true"] > div:has(> div.mb-2) > div.mb-2 > button:nth-child(n+4) {
    display: none !important;
  }

  [data-vorta-global-ai-panel="true"] > div:has(> div.mb-2) > div.text-xs {
    display: none !important;
  }

  [data-vorta-global-ai-panel="true"] > div:has(> div.mb-2):has(button:not([title])) > div.text-xs {
    display: block !important;
    margin-top: 0.5rem;
  }

  /* Conversation area. */`,
  "mobile suggested prompts",
);
css = replaceOnce(
  css,
  `  [data-vorta-global-ai-messages="true"] {
    min-height: 0 !important;`,
  `  [data-vorta-global-ai-messages="true"] {
    order: 2;
    min-height: 0 !important;`,
  "mobile message order",
);
css = replaceOnce(
  css,
  "    min-height: calc(100dvh - 10rem);",
  "    min-height: calc(100dvh - 13.5rem);",
  "mobile welcome height",
);
css = replaceOnce(
  css,
  `  [data-vorta-global-ai-composer="true"] {
    padding: 0.625rem 0.75rem max(0.75rem, env(safe-area-inset-bottom)) !important;`,
  `  [data-vorta-global-ai-composer="true"] {
    order: 4;
    padding: 0.625rem 0.75rem max(0.75rem, env(safe-area-inset-bottom)) !important;`,
  "mobile composer order",
);
writeFileSync(cssPath, css);

const contractPath = "scripts/vor-041-ask-vorta-workspace-contracts.mjs";
let contract = readFileSync(contractPath, "utf8");
contract = replaceRegexOnce(
  contract,
  /assert\.match\(\n  workspace,\n  \/justify-between gap-2[\s\S]*?\n\);/,
  `assert.match(
  workspace,
  /What can I help with\?[\\s\\S]*data-vorta-ai-workspace-welcome/,
  "The full workspace must use the maintenance-first welcome state before the first question.",
);
assert.match(
  workspace,
  /Collapse recent conversations[\\s\\S]*Expand recent conversations/,
  "The Recent conversations rail must be collapsible without leaving the workspace.",
);
assert.ok(
  !workspace.includes("Return to compact panel"),
  "The duplicate sidebar compact-panel action must be removed.",
);
assert.match(
  workspace,
  /data-vorta-ai-workspace-source-summary="true"/,
  "Workspace answers must expose a direct route to their source evidence.",
);`,
  "workspace visual contract",
);
contract = replaceOnce(
  contract,
  `for (const rule of [
  "height: 100dvh !important",
  'content: "What can I help with?"',
  "font-size: 0 !important",
  '[data-vorta-global-ai-composer-row="true"]',
]) {`,
  `for (const rule of [
  "height: 100dvh !important",
  'content: "What can I help with?"',
  "font-size: 0 !important",
  '[data-vorta-global-ai-composer-row="true"]',
  "button:nth-child(n+4)",
  "order: 3",
]) {`,
  "mobile visual contract rules",
);
writeFileSync(contractPath, contract);

const browserPath = "tests/browser/vor-041-ask-vorta-workspace.spec.ts";
let browser = readFileSync(browserPath, "utf8");
browser = replaceOnce(
  browser,
  `    await expect(page.getByRole("tab", { name: "Actions" })).toBeVisible();

    const question = "Can the current shift cover the planned work?";`,
  `    await expect(page.getByRole("tab", { name: "Actions" })).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "What can I help with?", exact: true }),
    ).toBeVisible();
    await expect(
      workspace.getByRole("button", { name: "What are my highest site risks?", exact: true }),
    ).toBeVisible();
    await expect(
      workspace.getByRole("button", { name: "Collapse recent conversations", exact: true }),
    ).toBeVisible();

    const question = "Can the current shift cover the planned work?";`,
  "workspace browser welcome assertions",
);
browser = replaceOnce(
  browser,
  `    const liveEvidenceStatus = workspace.getByText("Live evidence loaded", {
      exact: true,
    });`,
  `    const liveEvidenceStatus = workspace.getByText("Live evidence", {
      exact: true,
    });`,
  "workspace live evidence browser assertion",
);
browser = replaceOnce(
  browser,
  `    await expect(
      workspace.getByText(question, { exact: true }).last(),
    ).toBeVisible();

    await page.getByRole("tab", { name: "Evidence" }).click();`,
  `    await expect(
      workspace.getByText(question, { exact: true }).last(),
    ).toBeVisible();
    const sourceSummary = workspace.getByRole("button", {
      name: "1 verified Vorta source",
      exact: true,
    });
    await expect(sourceSummary).toBeVisible();
    await sourceSummary.click();`,
  "workspace source summary browser journey",
);
browser = replaceOnce(
  browser,
  `    await expect(
      page.locator('[data-vorta-ai-workspace="true"]'),
    ).toHaveCount(0);

    const box = await panel.boundingBox();`,
  `    await expect(
      page.locator('[data-vorta-ai-workspace="true"]'),
    ).toHaveCount(0);
    for (const prompt of [
      "What are my highest site risks?",
      "What shift-cover issues do I have next week?",
      "Which maintenance action reduces risk the most?",
    ]) {
      await expect(panel.getByRole("button", { name: prompt, exact: true })).toBeVisible();
    }
    await expect(
      panel.getByRole("button", { name: "Show equipment that needs attention", exact: true }),
    ).toBeHidden();

    const box = await panel.boundingBox();`,
  "mobile prompt browser assertions",
);
writeFileSync(browserPath, browser);

console.log("Ask Vorta visual refinement applied with exact-source assertions.");