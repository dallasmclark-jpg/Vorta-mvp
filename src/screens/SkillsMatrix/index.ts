import { createElement } from "react";
import { useMediaQuery } from "../../hooks/useMediaQuery";
import { useAuth } from "../../lib/auth";
import { getEffectiveDataMode } from "../../lib/dataTrust";
import { MobileCapabilitySummary } from "./MobileCapabilitySummary";
import { SkillsMatrixSection as NativeSkillsMatrixSection } from "./SkillsMatrixNative";

export function SkillsMatrixSection(): JSX.Element {
  const { siteContext } = useAuth();
  const dataMode = getEffectiveDataMode(Boolean(siteContext?.siteId));
  const isPhone = useMediaQuery("(max-width: 767px)");

  return isPhone
    ? createElement(MobileCapabilitySummary, { dataMode })
    : createElement(NativeSkillsMatrixSection);
}
