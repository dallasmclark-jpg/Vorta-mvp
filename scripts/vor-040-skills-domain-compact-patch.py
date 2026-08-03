from pathlib import Path


def replace_once(source: str, old: str, new: str, label: str) -> str:
    count = source.count(old)
    if count != 1:
        raise SystemExit(f"VOR-040 {label} anchor count {count}")
    return source.replace(old, new, 1)


assistant_path = Path("netlify/functions/ask-vorta.mts")
assistant = assistant_path.read_text()

assistant = replace_once(
    assistant,
    '''function collectDecisionFacts(
  value: unknown,''',
    '''function compactEquipmentSkillsDomain(result: ToolResult): JsonRecord {
  return {
    source: result.source,
    status: result.status,
    message: result.message,
    data: records(result.data).map((row) => ({
      equipment_code: row.equipment_code ?? row.equipmentCode,
      equipment_name: row.equipment_name ?? row.equipmentName,
      required_skills: records(row.required_skills ?? row.requiredSkills).map((skill) => ({
        name: skill.name ?? skill.skill_name ?? skill.skillName,
        required_level: skill.required_level ?? skill.requiredLevel,
        minimum_qualified_engineers:
          skill.minimum_qualified_engineers ?? skill.minimumQualifiedEngineers,
        criticality: skill.criticality,
        execution_authority: skill.execution_authority ?? skill.executionAuthority,
        validation_required: skill.validation_required ?? skill.validationRequired,
        qualified_engineers: records(
          skill.qualified_engineers ?? skill.qualifiedEngineers,
        )
          .slice(0, 12)
          .map((engineer) => ({
            engineer_name: engineer.engineer_name ?? engineer.engineerName,
            rating: engineer.rating ?? engineer.validated_rating ?? engineer.validatedRating,
            validation_status:
              engineer.validation_status ??
              engineer.validationStatus ??
              engineer.verification_status ??
              engineer.verificationStatus,
            capability_role: engineer.capability_role ?? engineer.capabilityRole,
            qualification_state:
              engineer.qualification_state ?? engineer.qualificationState,
            availability_status:
              engineer.availability_status ?? engineer.availabilityStatus,
          })),
      })),
    })),
  };
}

function collectDecisionFacts(
  value: unknown,''',
    "skills compact helper",
)

assistant = replace_once(
    assistant,
    '''      const domainEntries = await Promise.all(
        domainNames.map(async (toolName) => [
          toolName,
          compactToolDomain(
            await executeTool(
              toolName,
              { equipment_id: equipmentIdValue },
              supabase,
              request,
            ),
          ),
        ] as const),
      );''',
    '''      const domainEntries = await Promise.all(
        domainNames.map(async (toolName) => {
          const result = await executeTool(
            toolName,
            { equipment_id: equipmentIdValue },
            supabase,
            request,
          );
          return [
            toolName,
            toolName === "get_equipment_skills"
              ? compactEquipmentSkillsDomain(result)
              : compactToolDomain(result),
          ] as const;
        }),
      );''',
    "skills domain compaction",
)

assistant_path.write_text(assistant)

contract_path = Path("scripts/vor-040-natural-question-contracts.mjs")
contract = contract_path.read_text()
contract = replace_once(
    contract,
    '  "questionMatchedEquipmentFacts",\n',
    '''  "questionMatchedEquipmentFacts",
  "compactEquipmentSkillsDomain",
  'toolName === "get_equipment_skills"',
  "qualified_engineers: records(",
  "engineer_name: engineer.engineer_name",
''',
    "skills compact contracts",
)
contract_path.write_text(contract)

print("Applied purpose-built equipment-skills compaction.")
