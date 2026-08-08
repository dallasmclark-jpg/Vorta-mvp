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
  const diagnosticContrastHasObservedEvidence = Boolean(
    diagnosticInstrumentFact || diagnosticProcessFact,
  );
  const diagnosticContrastNeedsRepair =
    asksForDiagnosticContrast &&
    (!diagnosticContrastAnswerIsDirect ||
      (diagnosticContrastAnswerIsExplicitlyUncertain &&
        diagnosticContrastHasObservedEvidence));
'''
if text.count(old) != 1:
    raise SystemExit(f"expected one contrast directness block, found {text.count(old)}")
text = text.replace(old, new, 1)
old_branch = '''  if (diagnosticContrastNeedsRepair) {
'''
new_branch = '''  if (
    asksForDiagnosticContrast &&
    diagnosticContrastAnswerIsExplicitlyUncertain &&
    !diagnosticContrastHasObservedEvidence
  ) {
    return;
  }

  if (diagnosticContrastNeedsRepair) {
'''
if text.count(old_branch) != 1:
    raise SystemExit(f"expected one contrast repair branch, found {text.count(old_branch)}")
path.write_text(text.replace(old_branch, new_branch, 1))
