import { SkillsMatrixCoreAssetPreview } from "./SkillsMatrixCoreAssetPreview";
import { SkillsMatrixSection as SkillsMatrixNative } from "./SkillsMatrixNative";

// The evidence-backed split screen remains opt-in until its preview scores are reviewed.
export const CORE_ASSET_SKILLS_PREVIEW_ENABLED =
  import.meta.env.VITE_SKILLS_MATRIX_CORE_ASSET_PREVIEW === "true";

export const SkillsMatrixSection = CORE_ASSET_SKILLS_PREVIEW_ENABLED
  ? SkillsMatrixCoreAssetPreview
  : SkillsMatrixNative;
