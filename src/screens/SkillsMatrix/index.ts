import { createElement } from "react";
import { useMediaQuery } from "../../hooks/useMediaQuery";
import { useAuth } from "../../lib/auth";
import { getEffectiveDataMode } from "../../lib/dataTrust";
import { MobileSkillsMatrix } from "./MobileSkillsMatrix";
import { SkillsMatrixSection as NativeSkillsMatrixSection } from "./SkillsMatrixNative";

export function SkillsMatrixSection(): JSX.Element {
  const { siteContext } = useAuth();
  const dataMode = getEffectiveDataMode(Boolean(siteContext?.siteId));
  const isPhone = useMediaQuery("(max-width: 639px)");

  return isPhone && dataMode === "demo"
    ? createElement(MobileSkillsMatrix, { dataMode })
    : createElement(NativeSkillsMatrixSection);
}
