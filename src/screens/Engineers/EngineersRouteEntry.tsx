import { useMediaQuery } from "../../hooks/useMediaQuery";
import { useAuth } from "../../lib/auth";
import { getEffectiveDataMode } from "../../lib/dataTrust";
import { LiveEngineersSection } from "./LiveEngineersSection";
import { MobileEngineersSection } from "./MobileEngineersSection";
import { OperationalRotaRiskMap } from "./OperationalRotaRiskMap";

function VerifiedOperationalRota(): JSX.Element {
  return (
    <div
      className="contents"
      data-vorta-original-shift-rota="true"
      data-vorta-verified-operational-rota="true"
    >
      <OperationalRotaRiskMap />
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
  const usesOperationalRota =
    isNarrowTablet || hasTouchPoints || hasCoarsePointer || hasNoHover;

  return (
    <div className="contents" data-vorta-engineers-mode={dataMode}>
      {isPhone ? (
        <MobileEngineersSection dataMode={dataMode} />
      ) : usesOperationalRota ? (
        <VerifiedOperationalRota />
      ) : (
        <LiveEngineersSection />
      )}
    </div>
  );
}
