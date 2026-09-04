import { EquipmentCompetencyValidationPanel } from "./EquipmentCompetencyValidationPanel";
import { EquipmentSkills as EquipmentSkillsIntelligence } from "./EquipmentSkillsIntelligence";

export function EquipmentSkills(): JSX.Element {
  return (
    <>
      <EquipmentSkillsIntelligence />
      <EquipmentCompetencyValidationPanel />
    </>
  );
}
