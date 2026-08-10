import {
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  AlertTriangle,
  ChevronLeft,
  Clock3,
  FileSearch,
  ImagePlus,
  ListChecks,
  Loader2,
  MessageSquare,
  MessageSquarePlus,
  Mic,
  MicOff,
  PanelLeftClose,
  PanelLeftOpen,
  Send,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react";
import { Button } from "../../components/ui/button";
import {
  getAskVortaImagePreview,
  type PreparedAskVortaImage,
} from "./askVortaImageClient";
import type { VortaConversationContext } from "./vortaAgentService";

export type AskVortaWorkspaceTab = "conversation" | "evidence" | "actions";

export interface AskVortaWorkspaceAnswer {
  directAnswer: string;
  evidence?: string[];
  findings?: Array<{
    category: string;
    severity: string;
    title: string;
    detail: string;
  }>;
  coverOptions?: Array<{
    engineerNames: string[];
    shift: string;
    reason: string;
    projectedImpact: string;
    remainingRisk: string;
    caveat: string;
  }>;
  recommendedActions?: string[];
  actionPlan?: Array<{
    priority: string;
    action: string;
    owner: string;
    expectedImpact: string;
    verification: string;
  }>;
  sources?: string[];
  missingData?: string[];
  evidenceLinks?: Array<{
    label: string;
    path: string;
    recordType: string;
  }>;
  confidence?: number;
  evidenceGeneratedAt?: string;
  conversationContext?: VortaConversationContext;
}

export interface AskVortaWorkspaceMessage {
  id: string;
  role: "user" | "assistant";
  text?: string;
  loading?: boolean;
  answer?: AskVortaWorkspaceAnswer;
  error?: string;
  retryQuestion?: string;
  imageName?: string;
}

interface StoredConversation {
  id: string;
  title: string;
  updatedAt: string;
  messages: AskVortaWorkspaceMessage[];
}

interface AskVortaWorkspaceProps {
  messages: AskVortaWorkspaceMessage[];
  input: string;
  roleSubtitle: string;
  contextLine: string;
  contextReady: boolean;
  loadingContext: boolean;
  speechSupported: boolean;
  listening: boolean;
  speechError: string | null;
  pendingImage: PreparedAskVortaImage | null;
  imageError: string | null;
  onSelectImage: (file: File) => void;
  onRemoveImage: () => void;
  promptPlaceholder: string;
  welcomeDetail: string;
  suggestedPrompts: string[];
  onInputChange: (value: string) => void;
  onSubmit: (question: string) => void;
  onRetry: (messageId: string, question: string) => void;
  onToggleSpeech: () => void;
  onCollapse: () => void;
  onClose: () => void;
  onNewConversation: () => void;
  onLoadConversation: (messages: AskVortaWorkspaceMessage[]) => void;
  onOpenEvidenceLink: (path: string) => void;
  renderAnswer: (answer: AskVortaWorkspaceAnswer) => ReactNode;
}

const STORAGE_KEY = "vorta:ask-vorta:recent-conversations:v1";
const ACTIVE_STORAGE_KEY = "vorta:ask-vorta:active-conversation:v1";
const MAX_RECENTS = 12;
const MAX_STORED_MESSAGES = 18;

function conversationId(): string {
  return `ask-vorta-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function readActiveConversationId(): string {
  try {
    return window.sessionStorage.getItem(ACTIVE_STORAGE_KEY) ?? conversationId();
  } catch {
    return conversationId();
  }
}

function writeActiveConversationId(value: string): void {
  try {
    window.sessionStorage.setItem(ACTIVE_STORAGE_KEY, value);
  } catch {
    // The workspace still functions when browser session storage is unavailable.
  }
}

function conversationTitle(messages: AskVortaWorkspaceMessage[]): string {
  const question = messages.find(
    (message) => message.role === "user" && message.text?.trim(),
  )?.text?.trim();
  if (!question) return "New Ask Vorta conversation";

  const concise = question
    .replace(/^(what|which|who|where|when|why|how)\s+(are|is|do|does|did|can|could|should|would|will)?\s*/i, "")
    .replace(/^show\s+(me\s+)?/i, "")
    .replace(/^tell\s+me\s+/i, "")
    .replace(/[?.!]+$/, "")
    .trim();
  const title = concise || question.replace(/[?.!]+$/, "").trim();
  const capitalised = title ? title[0].toUpperCase() + title.slice(1) : "Ask Vorta conversation";
  return capitalised.length > 54 ? capitalised.slice(0, 51) + "…" : capitalised;
}

function readStoredConversations(): StoredConversation[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (item): item is StoredConversation =>
          Boolean(item) &&
          typeof item === "object" &&
          typeof (item as StoredConversation).id === "string" &&
          typeof (item as StoredConversation).title === "string" &&
          typeof (item as StoredConversation).updatedAt === "string" &&
          Array.isArray((item as StoredConversation).messages),
      )
      .slice(0, MAX_RECENTS);
  } catch {
    return [];
  }
}

function writeStoredConversations(conversations: StoredConversation[]): void {
  try {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(conversations.slice(0, MAX_RECENTS)),
    );
  } catch {
    // Conversation history is a local convenience. Ask Vorta still works if storage is unavailable.
  }
}

function formatRecentDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Recent";
  const today = new Date();
  const sameDay =
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate();
  return sameDay
    ? new Intl.DateTimeFormat("en-GB", {
        hour: "2-digit",
        minute: "2-digit",
      }).format(date)
    : new Intl.DateTimeFormat("en-GB", {
        day: "numeric",
        month: "short",
      }).format(date);
}

type RecentConversationGroup = {
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

function EmptyWorkspaceState({
  title,
  detail,
}: {
  title: string;
  detail: string;
}): JSX.Element {
  return (
    <div className="mx-auto flex max-w-xl flex-col items-center justify-center rounded-2xl border border-dashed border-gray-700 bg-gray-900/30 px-8 py-16 text-center">
      <Sparkles className="mb-4 h-7 w-7 text-blue-300" />
      <h3 className="text-lg font-bold text-slate-100">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-slate-400">{detail}</p>
    </div>
  );
}

export function AskVortaWorkspace({
  messages,
  input,
  roleSubtitle,
  contextLine,
  contextReady,
  loadingContext,
  speechSupported,
  listening,
  speechError,
  pendingImage,
  imageError,
  onSelectImage,
  onRemoveImage,
  promptPlaceholder,
  welcomeDetail,
  suggestedPrompts,
  onInputChange,
  onSubmit,
  onRetry,
  onToggleSpeech,
  onCollapse,
  onClose,
  onNewConversation,
  onLoadConversation,
  onOpenEvidenceLink,
  renderAnswer,
}: AskVortaWorkspaceProps): JSX.Element {
  const [activeTab, setActiveTab] = useState<AskVortaWorkspaceTab>("conversation");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [recents, setRecents] = useState<StoredConversation[]>(() =>
    readStoredConversations(),
  );
  const [currentConversationId, setCurrentConversationId] = useState(() =>
    readActiveConversationId(),
  );

  const hasUserQuestion = messages.some(
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
  const recentGroups = useMemo(() => groupStoredConversations(recents), [recents]);

  useEffect(() => {
    writeActiveConversationId(currentConversationId);
  }, [currentConversationId]);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 768px)");
    const protectMobile = (): void => {
      if (media.matches) onCollapse();
    };
    protectMobile();
    media.addEventListener("change", protectMobile);
    return () => media.removeEventListener("change", protectMobile);
  }, [onCollapse]);

  useEffect(() => {
    if (!hasUserQuestion) return;
    const next: StoredConversation = {
      id: currentConversationId,
      title: conversationTitle(messages),
      updatedAt: new Date().toISOString(),
      messages: messages.slice(-MAX_STORED_MESSAGES),
    };
    setRecents((current) => {
      const updated = [
        next,
        ...current.filter((item) => item.id !== currentConversationId),
      ].slice(0, MAX_RECENTS);
      writeStoredConversations(updated);
      return updated;
    });
  }, [currentConversationId, hasUserQuestion, messages]);

  const startConversation = (): void => {
    setCurrentConversationId(conversationId());
    setActiveTab("conversation");
    onNewConversation();
  };

  const restoreConversation = (conversation: StoredConversation): void => {
    setCurrentConversationId(conversation.id);
    setActiveTab("conversation");
    onLoadConversation(conversation.messages);
  };

  const tabs: Array<{
    id: AskVortaWorkspaceTab;
    label: string;
    icon: typeof MessageSquare;
  }> = [
    { id: "conversation", label: "Conversation", icon: MessageSquare },
    { id: "evidence", label: "Evidence", icon: FileSearch },
    { id: "actions", label: "Actions", icon: ListChecks },
  ];

  return (
    <div
      data-vorta-ai-workspace="true"
      className="fixed inset-0 z-[70] hidden min-h-0 bg-gray-950 md:flex"
    >
      <aside
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

      <main className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 shrink-0 items-center justify-between gap-2 border-b border-gray-800 bg-gray-950 px-3 lg:px-5">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <div className="flex shrink-0 items-center gap-1" role="tablist" aria-label="Ask Vorta workspace views">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                const selected = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    aria-selected={selected}
                    onClick={() => setActiveTab(tab.id)}
                    className={`inline-flex h-9 items-center gap-2 rounded-lg border px-3 text-sm font-semibold transition-colors ${
                      selected
                        ? "border-blue-400/60 bg-[#101722] text-blue-200"
                        : "border-transparent text-slate-400 hover:border-gray-700 hover:bg-white/5 hover:text-slate-200"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {tab.label}
                  </button>
                );
              })}
            </div>
            <div
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
          </div>

          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={onCollapse}
              className="inline-flex h-9 items-center gap-2 rounded-lg px-3 text-sm font-semibold text-slate-400 transition-colors hover:bg-white/[0.05] hover:text-white"
              aria-label="Return to compact Ask Vorta panel"
            >
              <ChevronLeft className="h-4 w-4" />
              Compact
            </button>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-white/[0.05] hover:text-white"
              aria-label="Close Ask Vorta"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {activeTab === "conversation" && (
            <div
              data-vorta-ai-workspace-conversation="true"
              className={
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
              {visibleConversationMessages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${
                    message.role === "user" ? "justify-end" : "justify-start"
                  }`}
                >
                  <div
                    className={
                      message.role === "user"
                        ? "max-w-3xl rounded-2xl bg-blue-600 px-4 py-3 text-white"
                        : message.answer
                          ? "w-full text-slate-200"
                          : "w-full rounded-2xl border border-gray-800 bg-gray-900 px-4 py-3 text-slate-200"
                    }
                  >
                    {message.loading ? (
                      <div className="flex items-center gap-2 text-sm text-slate-300">
                        <Loader2 className="h-4 w-4 animate-spin text-blue-400" />
                        Choosing and checking the relevant Vorta sources...
                      </div>
                    ) : message.error ? (
                      <div className="flex flex-col gap-3" role="alert">
                        <div className="flex items-start gap-2">
                          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
                          <div>
                            <p className="text-sm font-semibold text-amber-100">
                              Vorta could not complete this analysis
                            </p>
                            <p className="mt-1 text-sm leading-6 text-amber-100/70">
                              {message.error}
                            </p>
                          </div>
                        </div>
                        {message.retryQuestion && (
                          <Button
                            type="button"
                            variant="outline"
                            disabled={!contextReady}
                            onClick={() =>
                              onRetry(message.id, message.retryQuestion ?? "")
                            }
                            className="h-8 w-fit border-amber-500/30 bg-amber-500/10 px-3 text-xs font-semibold text-amber-200 hover:bg-amber-500/20 hover:text-amber-100"
                          >
                            Retry analysis
                          </Button>
                        )}
                      </div>
                    ) : message.answer ? (
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
                    ) : (
                      <div className="space-y-2">
                        {message.imageName && getAskVortaImagePreview(message.imageName) ? (
                          <img
                            src={getAskVortaImagePreview(message.imageName) ?? undefined}
                            alt="Submitted maintenance photo"
                            className="rounded-lg"
                            style={{
                              display: "block",
                              maxHeight: 224,
                              maxWidth: "100%",
                              width: "auto",
                              height: "auto",
                              objectFit: "contain",
                            }}
                          />
                        ) : message.imageName ? (
                          <p className="text-xs font-semibold text-blue-100/80">
                            Photo attached: {message.imageName}
                          </p>
                        ) : null}
                        <p className="text-sm leading-6">{message.text}</p>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeTab === "evidence" && (
            <div
              data-vorta-ai-workspace-evidence="true"
              className="mx-auto w-full max-w-5xl px-6 py-7 xl:px-10"
            >
              {!latestAnswer ? (
                <EmptyWorkspaceState
                  title="No evidence collected yet"
                  detail="Ask a maintenance question first. The verified sources, findings and missing-evidence notes will be collected here."
                />
              ) : (
                <div className="grid gap-5 lg:grid-cols-3">
                  <section className="space-y-5 lg:col-span-2">
                    <div className="rounded-2xl border border-gray-800 bg-gray-900 p-5">
                      <h3 className="text-base font-bold text-slate-100">Verified evidence</h3>
                      <p className="mt-1 text-sm leading-6 text-slate-400">
                        Evidence supporting the latest Ask Vorta decision.
                      </p>
                      <div className="mt-4 space-y-2">
                        {(latestAnswer.evidence ?? []).length > 0 ? (
                          latestAnswer.evidence?.map((item, index) => (
                            <div
                              key={`${item}-${index}`}
                              className="rounded-lg border border-gray-800 bg-gray-950 px-4 py-3 text-sm leading-6 text-slate-300"
                            >
                              {item}
                            </div>
                          ))
                        ) : (
                          <p className="text-sm text-slate-500">No separate evidence statements were returned.</p>
                        )}
                      </div>
                    </div>

                    {(latestAnswer.findings ?? []).length > 0 && (
                      <div className="rounded-2xl border border-gray-800 bg-gray-900 p-5">
                        <h3 className="text-base font-bold text-slate-100">Detailed findings</h3>
                        <div className="mt-4 space-y-3">
                          {latestAnswer.findings?.map((finding, index) => (
                            <article
                              key={`${finding.title}-${index}`}
                              className="rounded-xl border border-gray-800 bg-gray-950 p-4"
                            >
                              <div className="flex items-center justify-between gap-3">
                                <h4 className="text-sm font-bold text-slate-100">{finding.title}</h4>
                                <span className="rounded-full border border-gray-700 px-2 py-0.5 text-xs font-semibold uppercase text-slate-400">
                                  {finding.severity}
                                </span>
                              </div>
                              <p className="mt-2 text-sm leading-6 text-slate-300">{finding.detail}</p>
                            </article>
                          ))}
                        </div>
                      </div>
                    )}
                  </section>

                  <aside className="space-y-5">
                    <div className="rounded-2xl border border-gray-800 bg-gray-900 p-5">
                      <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400">Sources</h3>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {(latestAnswer.sources ?? []).map((source) => (
                          <span
                            key={source}
                            className="rounded-lg border border-gray-700 bg-gray-950 px-2.5 py-1.5 text-xs font-semibold text-slate-300"
                          >
                            {source}
                          </span>
                        ))}
                      </div>
                    </div>

                    {(latestAnswer.evidenceLinks ?? []).length > 0 && (
                      <div className="rounded-2xl border border-gray-800 bg-gray-900 p-5">
                        <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400">Open in Vorta</h3>
                        <div className="mt-3 space-y-2">
                          {latestAnswer.evidenceLinks?.map((link) => (
                            <button
                              key={`${link.path}-${link.label}`}
                              type="button"
                              onClick={() => onOpenEvidenceLink(link.path)}
                              className="flex w-full items-center justify-between rounded-lg border border-blue-500/20 bg-blue-500/10 px-3 py-2.5 text-left text-sm font-semibold text-blue-200 transition-colors hover:border-blue-400/50 hover:bg-blue-500/10"
                            >
                              {link.label}
                              <ChevronLeft className="h-4 w-4 rotate-180" />
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {(latestAnswer.missingData ?? []).length > 0 && (
                      <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-5">
                        <h3 className="text-sm font-bold uppercase tracking-wider text-amber-200">Missing or unverified</h3>
                        <ul className="mt-3 space-y-2 text-sm leading-6 text-amber-100/80">
                          {latestAnswer.missingData?.map((item) => (
                            <li key={item}>{item}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </aside>
                </div>
              )}
            </div>
          )}

          {activeTab === "actions" && (
            <div
              data-vorta-ai-workspace-actions="true"
              className="mx-auto w-full max-w-5xl px-6 py-7 xl:px-10"
            >
              {!latestAnswer ? (
                <EmptyWorkspaceState
                  title="No actions available yet"
                  detail="Ask a decision question first. Recommended actions, owners, expected impact and cover options will be collected here."
                />
              ) : (
                <div className="space-y-5">
                  <div className="rounded-2xl border border-gray-800 bg-gray-900 p-5">
                    <h3 className="text-base font-bold text-slate-100">Recommended actions</h3>
                    <div className="mt-4 grid gap-3 md:grid-cols-2">
                      {(latestAnswer.recommendedActions ?? []).map((action, index) => (
                        <div
                          key={`${action}-${index}`}
                          className="rounded-xl border border-blue-500/20 bg-blue-500/10 px-4 py-3"
                        >
                          <span className="text-xs font-bold uppercase tracking-wider text-blue-300">
                            Priority {index + 1}
                          </span>
                          <p className="mt-1 text-sm leading-6 text-slate-200">{action}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {(latestAnswer.actionPlan ?? []).length > 0 && (
                    <div className="rounded-2xl border border-gray-800 bg-gray-900 p-5">
                      <h3 className="text-base font-bold text-slate-100">Action plan</h3>
                      <div className="mt-4 space-y-3">
                        {latestAnswer.actionPlan?.map((item, index) => (
                          <article
                            key={`${item.action}-${index}`}
                            className="grid gap-3 rounded-xl border border-gray-800 bg-gray-950 p-4 lg:grid-cols-[120px_minmax(0,1fr)]"
                          >
                            <div>
                              <span className="rounded-full border border-blue-500/25 bg-blue-500/10 px-2 py-1 text-xs font-bold uppercase text-blue-200">
                                {item.priority.replace(/_/g, " ")}
                              </span>
                            </div>
                            <div>
                              <h4 className="text-sm font-bold text-slate-100">{item.action}</h4>
                              <dl className="mt-3 grid gap-3 text-sm md:grid-cols-3">
                                <div>
                                  <dt className="text-xs font-bold uppercase tracking-wider text-slate-500">Owner</dt>
                                  <dd className="mt-1 leading-5 text-slate-300">{item.owner}</dd>
                                </div>
                                <div>
                                  <dt className="text-xs font-bold uppercase tracking-wider text-slate-500">Expected impact</dt>
                                  <dd className="mt-1 leading-5 text-slate-300">{item.expectedImpact}</dd>
                                </div>
                                <div>
                                  <dt className="text-xs font-bold uppercase tracking-wider text-slate-500">Verify</dt>
                                  <dd className="mt-1 leading-5 text-slate-300">{item.verification}</dd>
                                </div>
                              </dl>
                            </div>
                          </article>
                        ))}
                      </div>
                    </div>
                  )}

                  {(latestAnswer.coverOptions ?? []).length > 0 && (
                    <div className="rounded-2xl border border-gray-800 bg-gray-900 p-5">
                      <h3 className="text-base font-bold text-slate-100">Cover options</h3>
                      <div className="mt-4 grid gap-3 lg:grid-cols-2">
                        {latestAnswer.coverOptions?.map((option, index) => (
                          <article
                            key={`${option.shift}-${option.engineerNames.join("-")}-${index}`}
                            className="rounded-xl border border-gray-800 bg-gray-950 p-4"
                          >
                            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                              {index === 0 ? "Recommended" : "Alternative"}
                            </span>
                            <h4 className="mt-1 text-sm font-bold text-blue-200">
                              {option.engineerNames.join(" + ")}
                            </h4>
                            <p className="mt-1 text-sm font-semibold text-slate-300">{option.shift}</p>
                            <p className="mt-3 text-sm leading-6 text-slate-400">{option.projectedImpact}</p>
                            <p className="mt-2 text-sm leading-6 text-amber-200/80">{option.remainingRisk}</p>
                          </article>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {activeTab === "conversation" && (
          <div className="shrink-0 border-t border-gray-800 bg-gray-950/95 px-6 py-4 backdrop-blur">
            <div className="mx-auto max-w-[1050px]">
              {pendingImage ? (
                <div className="mb-3 flex items-center gap-3 rounded-xl border border-blue-500/20 bg-blue-500/10 px-3 py-2.5">
                  <img
                    src={pendingImage.dataUrl}
                    alt="Selected maintenance evidence"
                    className="h-12 w-12 rounded-lg object-cover"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-200">{pendingImage.name}</p>
                    <p className="text-xs text-slate-500">
                      {pendingImage.width} × {pendingImage.height} · Analyzed once and not saved to Vorta records or Recent conversations
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={onRemoveImage}
                    className="rounded-md p-2 text-slate-400 hover:bg-white/10 hover:text-white"
                    aria-label="Remove attached photo"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : null}
              {imageError ? (
                <p className="mb-2 text-xs text-amber-300" role="alert">{imageError}</p>
              ) : null}
              <div className="flex gap-2 rounded-2xl border border-gray-700 bg-[#111722] p-2 shadow-lg shadow-black/20 focus-within:border-blue-500/50">
                <label
                  className="inline-flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-md border border-gray-700 bg-transparent text-slate-400 transition-colors hover:border-blue-500/40 hover:bg-blue-500/10 hover:text-blue-300"
                  aria-label="Attach equipment or fault photo"
                  title="Attach one JPEG, PNG or WebP photo"
                >
                  <ImagePlus className="h-4 w-4" />
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) onSelectImage(file);
                      event.target.value = "";
                    }}
                  />
                </label>
                <Button
                  type="button"
                  variant="outline"
                  onClick={onToggleSpeech}
                  disabled={!speechSupported}
                  aria-pressed={listening}
                  aria-label={listening ? "Stop voice dictation" : "Start voice dictation"}
                  className={`h-10 w-10 shrink-0 p-0 ${
                    listening
                      ? "border-red-500/40 bg-red-500/10 text-red-300 hover:bg-red-500/20 hover:text-red-200"
                      : "border-gray-700 bg-transparent text-slate-400 hover:border-blue-500/40 hover:bg-blue-500/10 hover:text-blue-300"
                  }`}
                >
                  {listening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                </Button>
                <input
                  data-vorta-ai-workspace-input="true"
                  type="text"
                  value={input}
                  onChange={(event) => onInputChange(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && contextReady) onSubmit(input);
                  }}
                  placeholder={
                    listening
                      ? "Listening..."
                      : contextReady
                        ? promptPlaceholder
                        : "An authorised site is required"
                  }
                  className="min-w-0 flex-1 bg-transparent px-2 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none"
                />
                <Button
                  type="button"
                  onClick={() => onSubmit(input)}
                  disabled={(!input.trim() && !pendingImage) || !contextReady}
                  className="h-10 shrink-0 gap-2 bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Send className="h-4 w-4" />
                  Send
                </Button>
              </div>
              {speechError && (
                <div className="mt-2 flex items-start gap-2 text-xs text-amber-200" role="alert">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  {speechError}
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
