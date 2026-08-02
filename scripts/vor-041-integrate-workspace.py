from pathlib import Path

assistant_path = Path("src/screens/AiOperations/GlobalMaintenanceAiAssistant.tsx")
contract_runner_path = Path("scripts/run-contract-suite.mjs")

assistant = assistant_path.read_text()
runner = contract_runner_path.read_text()


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected one match, found {count}")
    return text.replace(old, new, 1)


if 'type AskVortaWorkspaceMessage' not in assistant:
    assistant = replace_once(
        assistant,
        "  Loader2,\n  Mic,",
        "  Loader2,\n  Maximize2,\n  Mic,",
        "Maximize2 import",
    )
    assistant = replace_once(
        assistant,
        '} from "./vortaAgentService";\n',
        '} from "./vortaAgentService";\nimport {\n  AskVortaWorkspace,\n  type AskVortaWorkspaceAnswer,\n  type AskVortaWorkspaceMessage,\n} from "./AskVortaWorkspace";\n',
        "workspace import",
    )

if "const navigate = useNavigate();\n  const { siteContext }" not in assistant:
    assistant = replace_once(
        assistant,
        "  const roleProfile = getRoleProfile(role);\n  const { siteContext } = useAuth();",
        "  const roleProfile = getRoleProfile(role);\n  const navigate = useNavigate();\n  const { siteContext } = useAuth();",
        "main navigate hook",
    )

if "const [workspaceOpen, setWorkspaceOpen]" not in assistant:
    assistant = replace_once(
        assistant,
        '  const [open, setOpen] = useState(false);\n  const [minimised, setMinimised] = useState(false);\n  const [input, setInput] = useState("");',
        '  const [open, setOpen] = useState(false);\n  const [minimised, setMinimised] = useState(false);\n  const [workspaceOpen, setWorkspaceOpen] = useState(false);\n  const [input, setInput] = useState("");',
        "workspace state",
    )

if "const hasActiveConversation" not in assistant:
    marker = "  ]);\n\n  useEffect(() => {\n    const speechWindow ="
    replacement = "  ]);\n\n  const hasActiveConversation = messages.some(\n    (message) => message.role === \"user\" && Boolean(message.text?.trim()),\n  );\n\n  useEffect(() => {\n    const speechWindow ="
    assistant = replace_once(
        assistant,
        marker,
        replacement,
        "active conversation marker",
    )

if "const resetWorkspaceConversation" not in assistant:
    insertion = '''
  const resetWorkspaceConversation = (): void => {
    stopSpeechRecognition(true);
    setInput("");
    setMessages([
      {
        id: `global-mm-intro-${Date.now()}`,
        role: "assistant",
        answer: {
          directAnswer: roleProfile.introAnswer,
          decisionSummary: [],
          evidence: [],
          recommendedActions: [roleProfile.defaultAction],
          sources: [],
          confidence: 70,
          roleLabel: roleProfile.label,
          responseBadge: roleProfile.responseBadge,
          intentLabel: "Introduction",
          roleNote: roleAwareNote(roleProfile),
        },
      },
    ]);
  };

  const loadWorkspaceConversation = (
    nextMessages: AskVortaWorkspaceMessage[],
  ): void => {
    stopSpeechRecognition(true);
    setInput("");
    setMessages(nextMessages as GlobalAiMessage[]);
  };

  if (open && workspaceOpen) {
    return (
      <AskVortaWorkspace
        messages={messages as AskVortaWorkspaceMessage[]}
        input={input}
        roleSubtitle={roleProfile.subtitle}
        contextLine={
          shiftSkillsContext
            ? `${roleProfile.contextLine} Shift skills context loaded: ${shiftSkillsContext.shiftLabel}.`
            : roleProfile.contextLine
        }
        contextReady={agentContextReady}
        loadingContext={loadingContext}
        speechSupported={speechSupported}
        listening={listening}
        speechError={speechError}
        promptPlaceholder={roleProfile.promptPlaceholder}
        onInputChange={setInput}
        onSubmit={submitQuestion}
        onRetry={retryFailedQuestion}
        onToggleSpeech={toggleSpeechRecognition}
        onCollapse={() => setWorkspaceOpen(false)}
        onClose={() => {
          stopSpeechRecognition(true);
          setWorkspaceOpen(false);
          setOpen(false);
        }}
        onNewConversation={resetWorkspaceConversation}
        onLoadConversation={loadWorkspaceConversation}
        onOpenEvidenceLink={(path) => {
          navigate(path);
          setWorkspaceOpen(false);
        }}
        renderAnswer={(answer: AskVortaWorkspaceAnswer) => (
          <AnswerBlock
            answer={answer as GlobalAiAnswer}
            onFollowUp={submitQuestion}
          />
        )}
      />
    );
  }

'''
    render_anchor = "  }, [open, agentContextReady, pendingPrompt]);\n\n  if (!open) {\n"
    assistant = replace_once(
        assistant,
        render_anchor,
        "  }, [open, agentContextReady, pendingPrompt]);\n\n" + insertion + "  if (!open) {\n",
        "workspace render insertion",
    )

if 'data-vorta-global-ai-expand="true"' not in assistant:
    expand_button = '''          <button
            type="button"
            onClick={() => setWorkspaceOpen(true)}
            data-vorta-global-ai-expand="true"
            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-white/10 hover:text-slate-200 max-md:hidden"
            aria-label="Expand Ask Vorta workspace"
            title="Open full Ask Vorta workspace"
          >
            <Maximize2 className="h-4 w-4" />
          </button>
'''
    assistant = replace_once(
        assistant,
        '''          <button
            type="button"
            onClick={() => {
              if (!minimised) {''',
        expand_button + '''          <button
            type="button"
            onClick={() => {
              if (!minimised) {''',
        "expand button",
    )

assistant = assistant.replace(
    "w-[min(420px,calc(100vw-2rem))]",
    "w-[min(500px,calc(100vw-2rem))]",
    1,
)
assistant = assistant.replace(
    'className="border-b border-gray-800 px-4 py-3"',
    'className={`border-b border-gray-800 px-4 py-3 ${hasActiveConversation ? "md:hidden" : ""}`}',
    1,
)
assistant = assistant.replace(
    'className="flex max-h-[380px] flex-col gap-3 overflow-y-auto px-4 py-3 max-md:min-h-0 max-md:max-h-none max-md:flex-1"',
    'className="flex max-h-[min(56vh,560px)] flex-col gap-3 overflow-y-auto px-4 py-3 max-md:min-h-0 max-md:max-h-none max-md:flex-1"',
    1,
)

if "VOR-041 Ask Vorta workspace" not in runner:
    runner = replace_once(
        runner,
        '  ["VOR-039 Ask Vorta confidence and latency", "scripts/vor-039-ask-vorta-confidence-latency-contracts.mjs"],\n',
        '  ["VOR-039 Ask Vorta confidence and latency", "scripts/vor-039-ask-vorta-confidence-latency-contracts.mjs"],\n  ["VOR-041 Ask Vorta workspace", "scripts/vor-041-ask-vorta-workspace-contracts.mjs"],\n',
        "contract runner registration",
    )

assistant_path.write_text(assistant)
contract_runner_path.write_text(runner)
