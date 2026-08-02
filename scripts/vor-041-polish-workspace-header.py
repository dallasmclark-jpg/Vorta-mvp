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
    '<header className="flex h-16 shrink-0 items-center justify-between border-b border-gray-800 bg-gray-950 px-5">',
    '<header className="flex h-16 shrink-0 items-center justify-between gap-2 border-b border-gray-800 bg-gray-950 px-3 lg:px-5">',
    "workspace header",
)
workspace = replace_once(
    workspace,
    '<div className="flex items-center gap-4">\n            <div className="flex items-center gap-1" role="tablist"',
    '<div className="flex min-w-0 flex-1 items-center gap-3">\n            <div className="flex shrink-0 items-center gap-1" role="tablist"',
    "workspace header left group",
)
workspace = replace_once(
    workspace,
    '<div className="hidden items-center gap-2 text-xs text-slate-500 lg:flex">',
    '<div className="hidden min-w-0 items-center gap-2 text-xs text-slate-500 xl:flex">',
    "workspace context breakpoint",
)
workspace = replace_once(
    workspace,
    '<div className="flex items-center gap-1">\n            <button\n              type="button"\n              onClick={onCollapse}',
    '<div className="flex shrink-0 items-center gap-1">\n            <button\n              type="button"\n              onClick={onCollapse}',
    "workspace exit controls",
)

if "portrait workspace header keeps exit controls visible" not in contract:
    contract = contract.replace(
        'assert.match(\n  workspace,\n  /data-vorta-ai-workspace-actions="true"/,\n  "The workspace must expose a semantic actions region.",\n);\n',
        'assert.match(\n  workspace,\n  /data-vorta-ai-workspace-actions="true"/,\n  "The workspace must expose a semantic actions region.",\n);\nassert.match(\n  workspace,\n  /justify-between gap-2[\\s\\S]*px-3 lg:px-5[\\s\\S]*min-w-0 flex-1[\\s\\S]*xl:flex[\\s\\S]*shrink-0 items-center gap-1/,\n  "The portrait workspace header keeps exit controls visible while deferring context text to wider screens.",\n);\n',
        1,
    )

clear_line = '    await page.evaluate(() => window.localStorage.removeItem("vorta:ask-vorta:recent-conversations:v1"));\n'
if clear_line not in test:
    test = test.replace(
        '    await signInMaintenanceManager(page);\n    await openAskVorta(page, testInfo.project.name);',
        '    await signInMaintenanceManager(page);\n' + clear_line + '    await openAskVorta(page, testInfo.project.name);',
    )

workspace_path.write_text(workspace)
contract_path.write_text(contract)
test_path.write_text(test)
