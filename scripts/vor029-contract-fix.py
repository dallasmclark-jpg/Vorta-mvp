from pathlib import Path

path = Path("scripts/shift-handover-contracts.mjs")
text = path.read_text()
old = "getByLabel(\"Review period\")"
new = "getByRole(\"button\", { name: \"Review period\", exact: true })"
if text.count(old) != 1:
    raise SystemExit("expected one review-period contract selector")
path.write_text(text.replace(old, new, 1))
