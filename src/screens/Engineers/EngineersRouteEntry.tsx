import { useMediaQuery } from "../../hooks/useMediaQuery";
import { useAuth } from "../../lib/auth";
import { getEffectiveDataMode } from "../../lib/dataTrust";
import { EngineersSection as DemoEngineersSection } from "./EngineersSection";
import { LiveEngineersSection } from "./LiveEngineersSection";
import { MobileEngineersSection } from "./MobileEngineersSection";

export function EngineersRouteEntry(): JSX.Element {
  const { siteContext } = useAuth();
  const dataMode = getEffectiveDataMode(Boolean(siteContext?.siteId));
  const isPhone = useMediaQuery("(max-width: 639px)");

  if (isPhone && dataMode !== "unavailable") {
    return (
      <div className="contents" data-vorta-engineers-mode={dataMode}>
        <MobileEngineersSection dataMode={dataMode} />
      </div>
    );
  }

  return (
    <div className="contents" data-vorta-engineers-mode={dataMode}>
      {dataMode === "demo" ? <DemoEngineersSection /> : <LiveEngineersSection />}
    </div>
  );
}
