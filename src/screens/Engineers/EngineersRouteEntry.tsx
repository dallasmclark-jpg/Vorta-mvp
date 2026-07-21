import { useAuth } from "../../lib/auth";
import { getEffectiveDataMode } from "../../lib/dataTrust";
import { EngineersSection as DemoEngineersSection } from "./EngineersSection";
import { LiveEngineersSection } from "./LiveEngineersSection";

export function EngineersRouteEntry(): JSX.Element {
  const { siteContext } = useAuth();
  const dataMode = getEffectiveDataMode(Boolean(siteContext?.siteId));

  return (
    <div className="contents" data-vorta-engineers-mode={dataMode}>
      {dataMode === "demo" ? <DemoEngineersSection /> : <LiveEngineersSection />}
    </div>
  );
}
