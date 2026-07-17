import { useEffect } from "react";
import { supabase } from "../../lib/supabaseClient";
import { SkillsMatrixSection as SkillsMatrixSelectionExperience } from "./SkillsMatrixSelectionExperience";

const SKILLS_MATRIX_FUNCTION = "skills-matrix-data";

export const SkillsMatrixSection = (): JSX.Element => {
  useEffect(() => {
    const refreshPayload = window.setTimeout(() => {
      void supabase.functions.invoke(SKILLS_MATRIX_FUNCTION, {
        body: { schemaVersion: "capability-v3" },
      });
    }, 100);

    return () => window.clearTimeout(refreshPayload);
  }, []);

  return <SkillsMatrixSelectionExperience />;
};
