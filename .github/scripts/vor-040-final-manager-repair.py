from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{label}: expected exactly one anchor, found {count}")
    return text.replace(old, new, 1)


assistant_path = Path("netlify/functions/ask-vorta.mts")
contract_path = Path("scripts/vor-040-natural-question-contracts.mjs")
assistant = assistant_path.read_text()
contract = contract_path.read_text()

assistant = replace_once(
    assistant,
    r'''            availability_status:
              engineer.availability_status ?? engineer.availabilityStatus,
          })),''',
    r'''            availability_status:
              engineer.availability_status ?? engineer.availabilityStatus,
            discipline: engineer.discipline,
            shift_pattern: engineer.shift_pattern ?? engineer.shiftPattern,
          })),''',
    "retain discipline and shift context in the compact skills domain",
)

assistant = replace_once(
    assistant,
    r'''          const rating = decisionField(engineer, [
            "rating",
            "validated_rating",
            "validatedRating",
          ]);
          const score =
            (/primary_sme/i.test(role) ? 120 : /backup_sme/i.test(role) ? 80 : 0) +
            (engineerName && workContext.includes(engineerName.toLowerCase()) ? 90 : 0) +
            (/validated/i.test(validation) ? 30 : 0) +
            numberValue(rating) * 8;
          return { engineerName, role, validation, rating, score, index };''',
    r'''          const rating = decisionField(engineer, [
            "rating",
            "validated_rating",
            "validatedRating",
          ]);
          const availability = decisionField(engineer, [
            "availability_status",
            "availabilityStatus",
          ]);
          const discipline = decisionField(engineer, ["discipline"]);
          const calibrationContext =
            /\b(?:calibrat|instrument|transmitter|pressure|sensor)\b/.test(
              loweredQuestion,
            );
          const disciplineMatch =
            calibrationContext && /instrument|calibration/i.test(discipline);
          const score =
            (/primary_sme/i.test(role) ? 120 : /backup_sme/i.test(role) ? 80 : 0) +
            (engineerName && workContext.includes(engineerName.toLowerCase()) ? 90 : 0) +
            (/validated/i.test(validation) ? 30 : 0) +
            (/on_shift/i.test(availability)
              ? 70
              : /available/i.test(availability)
                ? 20
                : 0) +
            (disciplineMatch ? 90 : 0) +
            numberValue(rating) * 8;
          return {
            engineerName,
            role,
            validation,
            rating,
            availability,
            discipline,
            score,
            index,
          };''',
    "rank capability by question-matched discipline and current availability",
)

assistant = replace_once(
    assistant,
    r'''      const documentSearchRequested =
        /\b(?:fault|diagnos|document|manual|guide|approved|procedure|drawing|history|evidence|verify|verification|release|before acting)\b/i.test(
          request.question,
        );''',
    r'''      const documentSearchRequested =
        /\b(?:fault|diagnos|cause(?:d|s)?|root cause|excursion|credible|reading|bias|document|manual|guide|approved|procedure|drawing|history|evidence|verify|verification|release|before acting)\b/i.test(
          request.question,
        );''',
    "include technical-cause questions in approved knowledge search",
)

assistant = replace_once(
    assistant,
    r'''    const actionRequested = /\b(?:what (?:do|should)|do first|fix|stopping|block(?:ing|ed)?|preventing|let .* run|next shift|can we|qualified|diagnos(?:e|is)|before acting|safest|next action|release(?:d)?|authori[sz]e|risk reduction|required action|must be verified|verify|verification|intervention|return(?:ing)?|calibrat|checked next|repeats?|what caused|which reading|at risk|instrument fault|permanent correction)\b/.test(
      question,
    );''',
    r'''    const actionRequested = /\b(?:what (?:do|should)|do first|fix|stopping|block(?:ing|ed)?|preventing|let .* run|next shift|can we|qualified|diagnos(?:e|is)|before acting|safest|next action|release(?:d)?|authori[sz]e|risk reduction|required action|must be verified|verify|verification|confirm(?:ed|ing)?|after repair|evidence (?:is )?required|required evidence|intervention|return(?:ing)?|calibrat|checked next|repeats?|what caused|which reading|at risk|instrument fault|permanent correction)\b/.test(
      question,
    );''',
    "treat post-repair confirmation requests as actionable equipment decisions",
)

contract = replace_once(
    contract,
    '''  "compactEquipmentSkillsDomain",
  'toolName === "get_equipment_skills"',''',
    '''  "compactEquipmentSkillsDomain",
  "discipline: engineer.discipline",
  "shift_pattern: engineer.shift_pattern",
  "disciplineMatch",
  "/on_shift/i.test(availability)",
  "cause(?:d|s)?|root cause|excursion|credible|reading|bias",
  "confirm(?:ed|ing)?|after repair|evidence (?:is )?required|required evidence",
  'toolName === "get_equipment_skills"',''',
    "protect final manager repair behaviour in permanent contracts",
)

assistant_path.write_text(assistant)
contract_path.write_text(contract)
