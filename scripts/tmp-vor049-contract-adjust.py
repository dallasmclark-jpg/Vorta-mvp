from pathlib import Path

path = Path("scripts/vor-049-decision-ready-equipment-contracts.mjs")
text = path.read_text()
old = '''assert.match(
  answerRepairTemplate,
  /if \\(!originalUnavailable\\)/,
  "Valid model prose must still be enriched with decisive verified facts",
);
'''
new = '''assert.match(
  answerRepairTemplate,
  /if \\(!originalUnavailable && !diagnosticContrastNeedsRepair\\)/,
  "Valid non-contrast model prose must still be enriched with decisive verified facts",
);
'''
if text.count(old) != 1:
    raise SystemExit(f"expected one stale valid-answer contract, found {text.count(old)}")
path.write_text(text.replace(old, new, 1))
