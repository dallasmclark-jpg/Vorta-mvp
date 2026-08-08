from pathlib import Path

# 1. Normalize punctuation/whitespace before direct-answer phrase assertions.
eval_path = Path("scripts/ask-vorta-live-evals.mjs")
eval_text = eval_path.read_text()
old = '    const directAnswerText = String(payload.directAnswer ?? "").toLowerCase();\n'
new = '''    const directAnswerText = String(payload.directAnswer ?? "")
      .toLowerCase()
      .replace(/[-–—]+/g, " ")
      .replace(/\\s+/g, " ")
      .trim();
'''
if eval_text.count(old) != 1:
    raise SystemExit(f"expected one directAnswerText assignment, found {eval_text.count(old)}")
eval_path.write_text(eval_text.replace(old, new, 1))

# 2. Accept semantically equivalent uncertainty wording in the AHU direct answer.
fixture_path = Path("tests/evals/vor-033-demo-golden.json")
fixture = fixture_path.read_text()
old = '    "directAnswerMustMentionAny": ["not confirmed", "not proven", "not demonstrated"],\n'
new = '    "directAnswerMustMentionAny": ["not confirmed", "not proven", "not demonstrated", "rather than confirmed"],\n'
if fixture.count(old) != 1:
    raise SystemExit(f"expected one AHU directAnswerMustMentionAny list, found {fixture.count(old)}")
fixture_path.write_text(fixture.replace(old, new, 1))

# 3. Keep the permanent source contract aligned with the semantic fixture and evaluator normalization.
contract_path = Path("scripts/vor-049-decision-ready-equipment-contracts.mjs")
contract = contract_path.read_text()
old = '''assert.deepEqual(ahuDiagnosis?.directAnswerMustMentionAny, [
  "not confirmed",
  "not proven",
  "not demonstrated",
]);
'''
new = '''assert.deepEqual(ahuDiagnosis?.directAnswerMustMentionAny, [
  "not confirmed",
  "not proven",
  "not demonstrated",
  "rather than confirmed",
]);
assert.match(
  liveEvalSurface,
  /directAnswerText[\\s\\S]*?replace\\(\\/\\[-–—\\]\\+\\/g, " "\\)[\\s\\S]*?replace\\(\\/\\\\s\\+\\/g, " "\\)/,
  "Direct-answer phrase assertions must normalize punctuation and whitespace",
);
'''
if contract.count(old) != 1:
    raise SystemExit(f"expected one AHU semantic contract list, found {contract.count(old)}")
contract_path.write_text(contract.replace(old, new, 1))
