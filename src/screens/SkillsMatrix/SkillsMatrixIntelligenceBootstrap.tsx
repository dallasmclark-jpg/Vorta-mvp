import { useEffect } from "react";
import { supabase } from "../../lib/supabaseClient";
import { SkillsMatrixSection as SkillsMatrixSelectionExperience } from "./SkillsMatrixSelectionExperience";

const SKILLS_MATRIX_FUNCTION = "skills-matrix-data";
const SKILLS_MATRIX_OPTIONS = {
  body: { schemaVersion: "capability-v3" },
};

export const SkillsMatrixSection = (): JSX.Element => {
  useEffect(() => {
    const replayPayload = window.setTimeout(() => {
      void supabase.functions.invoke(
        SKILLS_MATRIX_FUNCTION,
        SKILLS_MATRIX_OPTIONS,
      );
    }, 50);

    return () => window.clearTimeout(replayPayload);
  }, []);

  return <SkillsMatrixSelectionExperience />;
};
