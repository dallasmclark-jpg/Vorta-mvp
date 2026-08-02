import { Route, Routes } from "react-router-dom";
import { useMediaQuery } from "../../hooks/useMediaQuery";
import { useAuth } from "../../lib/auth";
import { getEffectiveDataMode } from "../../lib/dataTrust";
import { LabourRiskDetailPage } from "../LabourRisk/LabourRiskDetailPage";
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

  return (
    <div className="contents" data-vorta-engineers-mode={dataMode}>
      {isPhone ? (
        <MobileEngineersSection dataMode={dataMode} />
      ) : (
        <OriginalShiftCoverRota />
      )}
    </div>
  );
}
