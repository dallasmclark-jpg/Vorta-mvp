from pathlib import Path

path = Path("netlify/functions/ask-vorta/equipment-evidence.mts")
text = path.read_text()
old = '''  const diagnosticContrastAnswerIsDirect =
    /(?:instrument|sensor|probe|transmitter|dpt-\\d+)[^.]{0,140}(?:fault|drift|bias|unstable|fluctuat)|(?:fault|drift|bias|unstable|fluctuat)[^.]{0,140}(?:instrument|sensor|probe|transmitter|dpt-\\d+)|(?:cannot|can’t|can't|insufficient|not enough)[^.]{0,180}(?:distinguish|determine)/i.test(
      currentDirectAnswer,
    );
  const diagnosticContrastNeedsRepair =
    asksForDiagnosticContrast && !diagnosticContrastAnswerIsDirect;
'''
new = '''  const diagnosticContrastAnswerIsDirect =
    /(?:instrument|sensor|probe|transmitter|dpt-\\d+)[^.]{0,140}(?:fault|drift|bias|unstable|fluctuat)|(?:fault|drift|bias|unstable|fluctuat)[^.]{0,140}(?:instrument|sensor|probe|transmitter|dpt-\\d+)|(?:cannot|can’t|can't|insufficient|not enough)[^.]{0,180}(?:distinguish|determine)/i.test(
      currentDirectAnswer,
    );
  const diagnosticContrastAnswerIsExplicitlyUncertain =
    /(?:cannot|can’t|can't|insufficient|not enough)[^.]{0,180}(?:distinguish|determine)/i.test(
      currentDirectAnswer,
    );
  const diagnosticContrastNeedsRepair =
    asksForDiagnosticContrast &&
    (!diagnosticContrastAnswerIsDirect ||
      diagnosticContrastAnswerIsExplicitlyUncertain);
'''
if text.count(old) != 1:
    raise SystemExit(f"expected one contrast directness block, found {text.count(old)}")
path.write_text(text.replace(old, new, 1))
