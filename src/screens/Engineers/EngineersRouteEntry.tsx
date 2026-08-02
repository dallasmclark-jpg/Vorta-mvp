import { Route, Routes } from "react-router-dom";
import { useMediaQuery } from "../../hooks/useMediaQuery";
import { useAuth } from "../../lib/auth";
import { getEffectiveDataMode } from "../../lib/dataTrust";
import { LabourRiskDetailPage } from "../LabourRisk/LabourRiskDetailPage";
import { LiveEngineersSection } from "./LiveEngineersSection";
import { MobileEngineersSection } from "./MobileEngineersSection";

function OriginalShiftCoverRota(): JSX.Element {
  return (
    <div className="contents" data-vorta-original-shift-rota="true">
      <Routes location="/engineers/shift-cover">
        <Route path=":riskType" element={<LabourRiskDetailPage />} />
      </Routes>
    </div>
  );
}

export function EngineersRouteEntry(): JSX.Element {
  const { siteContext } = useAuth();
  const dataMode = getEffectiveDataMode(Boolean(siteContext?.siteId));
  const isPhone = useMediaQuery("(max-width: 767px)");
  const isNarrowTablet = useMediaQuery("(min-width: 768px) and (max-width: 1439px)");
  const hasCoarsePointer = useMediaQuery("(any-pointer: coarse)");
  const hasNoHover = useMediaQuery("(hover: none)");
  const hasTouchPoints =
    typeof navigator !== "undefined" && navigator.maxTouchPoints > 0;
  const usesOriginalRota =
    isNarrowTablet || hasTouchPoints || hasCoarsePointer || hasNoHover;

  return (
    <div className="contents" data-vorta-engineers-mode={dataMode}>
      {isPhone ? (
        <MobileEngineersSection dataMode={dataMode} />
      ) : usesOriginalRota ? (
        <OriginalShiftCoverRota />
      ) : (
        <LiveEngineersSection />
      )}
    </div>
  );
}
