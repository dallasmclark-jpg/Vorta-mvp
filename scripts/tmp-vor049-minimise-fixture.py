from pathlib import Path

path = Path("tests/evals/vor-033-demo-golden.json")
text = path.read_text()
old = '''    "mustMentionAny": ["calibrated reference", "transmitter drift", "pressure cascade"],
    "mustNotMention": ["room definitely failed"]
'''
new = '''    "mustMentionAny": ["calibrated reference", "transmitter drift", "pressure cascade"],
    "mustNotMention": ["room definitely failed"],
    "directAnswerMustMention": ["instrument fault", "not proven"],
    "directAnswerMustMentionAny": ["DPT-17", "calibrated reference", "transmitter drift"],
    "directAnswerMustNotMention": ["the authorised diagnosis is supported by"]
'''
if text.count(old) != 1:
    raise SystemExit(f"expected one AHU fixture anchor, found {text.count(old)}")
path.write_text(text.replace(old, new, 1))
