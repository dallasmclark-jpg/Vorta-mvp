import { Route, Routes } from "react-router-dom";
import { useMediaQuery } from "../../hooks/useMediaQuery";
import { useAuth } from "../../lib/auth";
import { getEffectiveDataMode } from "../../lib/dataTrust";
import { LabourRiskDetailPage } from "../LabourRisk/LabourRiskDetailPage";
import { LiveEngineersSection } from "./LiveEngineersSection";
import { MobileEngineersSection } from "./MobileEngineersSection";

function OriginalShiftCoverRota(): JSX.Element {
  // The invalid nested route location="/labour-risk/shift-cover" sits outside
  // the Engineers route context and renders nothing. Keep the synthetic child
  // location beneath /engineers so LabourRiskDetailPage receives riskType.
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
  const isTablet = useMediaQuery("(min-width: 768px) and (max-width: 1439px)");

  return (
    <div className="contents" data-vorta-engineers-mode={dataMode}>
      {isPhone ? (
        <MobileEngineersSection dataMode={dataMode} />
      ) : isTablet ? (
        <OriginalShiftCoverRota />
      ) : (
        <LiveEngineersSection />
      )}
    </div>
  );
}
