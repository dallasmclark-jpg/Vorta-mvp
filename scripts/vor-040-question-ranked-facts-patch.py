from pathlib import Path
import re

path = Path("netlify/functions/ask-vorta.mts")
source = path.read_text()

old_guard = '''  if (depth > 6 || value === null || value === undefined) return [];
  if (Array.isArray(value)) {
'''
new_guard = '''  if (depth > 6 || value === null || value === undefined) return [];
  if (typeof value !== "object") {
    const text = String(value).trim();
    if (!text || !path) return [];
    const pathSegments = path.split(/[.[\\]]/).filter(Boolean);
    const leafKey =
      [...pathSegments].reverse().find((segment) => !/^\\d+$/.test(segment)) ?? path;
    const keyScore = /code|number|reference|fault|component|part|skill|engineer|name/i.test(leafKey)
      ? 8
      : /title|summary|description|action|outcome|status|quantity|stock|lead|risk|validation|calibration|cause|text|note|specialism|evidence/i.test(leafKey)
        ? 5
        : 1;
    const valueScore = /[A-Z]{2,}[-0-9]{2,}/.test(text) ? 5 : 0;
    return keyScore + valueScore >= 5
      ? [{ score: keyScore + valueScore, text: `${path}: ${text.slice(0, 500)}` }]
      : [];
  }
  if (Array.isArray(value)) {
'''
if old_guard not in source:
    raise SystemExit("collectDecisionFacts guard anchor missing")
source = source.replace(old_guard, new_guard, 1)

pattern = re.compile(
    r'''function equipmentDecisionFacts\(\n  selected: JsonRecord,\n  domains: Record<string, JsonRecord>,\n\): string\[\] \{.*?\n\}\n\nfunction relevantEquipmentDecisionFacts''',
    re.S,
)
replacement = '''function equipmentDecisionFacts(
  selected: JsonRecord,
  domains: Record<string, JsonRecord>,
  question: string,
): string[] {
  const identity = [
    selected.equipment_code,
    selected.equipment_name,
    selected.code,
    selected.name,
    selected.area,
  ]
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .map((value) => `equipment: ${value}`);
  const rankedFacts = collectDecisionFacts(domains)
    .sort((first, second) => second.score - first.score)
    .map((item) => item.text);
  const questionRanked = relevantEquipmentDecisionFacts(question, rankedFacts);
  return [
    ...new Set([
      ...identity,
      ...questionRanked,
      ...rankedFacts.slice(0, 28),
    ]),
  ].slice(0, 48);
}

function relevantEquipmentDecisionFacts'''
source, count = pattern.subn(replacement, source, count=1)
if count != 1:
    raise SystemExit(f"equipmentDecisionFacts replacement count {count}")

old_call = "decisionFacts: equipmentDecisionFacts(selected, domains),"
new_call = "decisionFacts: equipmentDecisionFacts(selected, domains, request.question),"
if old_call not in source:
    raise SystemExit("equipmentDecisionFacts call anchor missing")
source = source.replace(old_call, new_call, 1)

old_slice = '''    .slice(0, 12)
    .map((item) => item.fact);
}'''
new_slice = '''    .slice(0, 16)
    .map((item) => item.fact);
}'''
if old_slice not in source:
    raise SystemExit("relevant fact slice anchor missing")
source = source.replace(old_slice, new_slice, 1)

path.write_text(source)
print("Applied question-ranked equipment fact extraction.")
