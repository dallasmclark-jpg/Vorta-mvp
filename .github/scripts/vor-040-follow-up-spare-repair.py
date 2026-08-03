from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{label}: expected exactly one anchor, found {count}")
    return text.replace(old, new, 1)


edge_path = Path("netlify/edge-functions/ask-vorta-work-backlog.ts")
assistant_path = Path("netlify/functions/ask-vorta.mts")
contract_path = Path("scripts/vor-040-natural-question-contracts.mjs")
edge = edge_path.read_text()
assistant = assistant_path.read_text()
contract = contract_path.read_text()

edge = replace_once(
    edge,
    '''const EQUIPMENT_SPARE_FOLLOW_UP_PATTERN = /\\b(?:(?:what|which) (?:spare|part)|(?:spare|part) (?:blocks?|blocking|stops?|stopping|holds?|holding)|what is (?:blocking|stopping|holding))\\b/i;
const MIXED_DECISION_PATTERN''',
    '''const EQUIPMENT_SPARE_FOLLOW_UP_PATTERN = /\\b(?:(?:what|which) (?:spare|part)|(?:spare|part) (?:blocks?|blocking|stops?|stopping|holds?|holding)|what is (?:blocking|stopping|holding))\\b/i;
const ACTIONABLE_EQUIPMENT_SPARE_FOLLOW_UP_PATTERN = /\\b(?:fix(?:ing|ed)?|repair(?:ing|ed)?|properly|permanent|replace|replacement|required action|what (?:do|should))\\b/i;
const MIXED_DECISION_PATTERN''',
    "add actionable spare follow-up discriminator",
)

edge = replace_once(
    edge,
    '''  if (!question || history.length === 0) return false;
  if (!EQUIPMENT_SPARE_FOLLOW_UP_PATTERN.test(question)) return false;
  return Boolean(equipmentReferenceFromRequest(body));
}''',
    '''  if (!question || history.length === 0) return false;
  if (!EQUIPMENT_SPARE_FOLLOW_UP_PATTERN.test(question)) return false;
  if (ACTIONABLE_EQUIPMENT_SPARE_FOLLOW_UP_PATTERN.test(question)) return false;
  return Boolean(equipmentReferenceFromRequest(body));
}''',
    "defer actionable spare follow-ups to the cross-domain assistant",
)

assistant = replace_once(
    assistant,
    '''|fix|stopping|block(?:ing|ed)?|preventing''',
    '''|fix(?:ing|ed)?|repair(?:ing|ed)?|stopping|block(?:ing|ed)?|preventing''',
    "recognise inflected repair language as action-oriented",
)

contract = replace_once(
    contract,
    '''  "EQUIPMENT_SPARE_FOLLOW_UP_PATTERN",
  "isEquipmentSpareFollowUp",''',
    '''  "EQUIPMENT_SPARE_FOLLOW_UP_PATTERN",
  "ACTIONABLE_EQUIPMENT_SPARE_FOLLOW_UP_PATTERN",
  "ACTIONABLE_EQUIPMENT_SPARE_FOLLOW_UP_PATTERN.test(question)",
  "isEquipmentSpareFollowUp",''',
    "protect actionable edge fallthrough",
)

contract = replace_once(
    contract,
    '''  "confirm(?:ed|ing)?|after repair|evidence (?:is )?required|required evidence",
  'toolName === "get_equipment_skills"',''',
    '''  "confirm(?:ed|ing)?|after repair|evidence (?:is )?required|required evidence",
  "fix(?:ing|ed)?|repair(?:ing|ed)?",
  'toolName === "get_equipment_skills"',''',
    "protect inflected repair action routing",
)

edge_path.write_text(edge)
assistant_path.write_text(assistant)
contract_path.write_text(contract)
