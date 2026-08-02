from pathlib import Path

workspace_path = Path("src/screens/AiOperations/AskVortaWorkspace.tsx")
contract_path = Path("scripts/vor-041-ask-vorta-workspace-contracts.mjs")
test_path = Path("tests/browser/vor-041-ask-vorta-workspace.spec.ts")

workspace = workspace_path.read_text()
contract = contract_path.read_text()
test = test_path.read_text()


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected one match, found {count}")
    return text.replace(old, new, 1)


workspace = replace_once(
    workspace,
    'const STORAGE_KEY = "vorta:ask-vorta:recent-conversations:v1";\n',
    'const STORAGE_KEY = "vorta:ask-vorta:recent-conversations:v1";\nconst ACTIVE_STORAGE_KEY = "vorta:ask-vorta:active-conversation:v1";\n',
    "active storage key",
)
workspace = replace_once(
    workspace,
    '''function conversationId(): string {
  return `ask-vorta-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
''',
    '''function conversationId(): string {
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
''',
    "active conversation helpers",
)
workspace = replace_once(
    workspace,
    '''  const [currentConversationId, setCurrentConversationId] = useState(() =>
    conversationId(),
  );
''',
    '''  const [currentConversationId, setCurrentConversationId] = useState(() =>
    readActiveConversationId(),
  );
''',
    "active conversation state",
)
workspace = replace_once(
    workspace,
    '''  const hasUserQuestion = messages.some(
    (message) => message.role === "user" && message.text?.trim(),
  );

  useEffect(() => {
''',
    '''  const hasUserQuestion = messages.some(
    (message) => message.role === "user" && message.text?.trim(),
  );

  useEffect(() => {
    writeActiveConversationId(currentConversationId);
  }, [currentConversationId]);

  useEffect(() => {
''',
    "active conversation persistence effect",
)

if "active conversation survives compact workspace remounts" not in contract:
    contract = contract.replace(
        'assert.match(\n  workspace,\n  /vorta:ask-vorta:recent-conversations:v1/,\n  "Recent conversations must use the bounded local workspace store.",\n);\n',
        'assert.match(\n  workspace,\n  /vorta:ask-vorta:recent-conversations:v1/,\n  "Recent conversations must use the bounded local workspace store.",\n);\nassert.match(\n  workspace,\n  /vorta:ask-vorta:active-conversation:v1[\\s\\S]*sessionStorage.getItem[\\s\\S]*sessionStorage.setItem/,\n  "The active conversation survives compact workspace remounts without duplicating Recents.",\n);\n',
        1,
    )

session_clear = '    await page.evaluate(() => window.sessionStorage.removeItem("vorta:ask-vorta:active-conversation:v1"));\n'
if session_clear not in test:
    test = test.replace(
        '    await page.evaluate(() => window.localStorage.removeItem("vorta:ask-vorta:recent-conversations:v1"));\n',
        '    await page.evaluate(() => window.localStorage.removeItem("vorta:ask-vorta:recent-conversations:v1"));\n' + session_clear,
    )

workspace_path.write_text(workspace)
contract_path.write_text(contract)
test_path.write_text(test)
