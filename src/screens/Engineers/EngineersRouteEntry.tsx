import { useAuth } from "../../lib/auth";
import { getEffectiveDataMode } from "../../lib/dataTrust";
import { useMediaQuery } from "../../hooks/useMediaQuery";
import { EngineersSection as DesktopDemoEngineersSection } from "./EngineersSection";
import { LiveEngineersSection as DesktopLiveEngineersSection } from "./LiveEngineersSection";
import { MobileEngineersSection } from "./MobileEngineersSection";

function MobileDemoEngineersSection(): JSX.Element {
  return <MobileEngineersSection dataMode="demo" />;
}

function MobileLiveEngineersSection(): JSX.Element {
  return <MobileEngineersSection dataMode="live" />;
}

export function EngineersRouteEntry(): JSX.Element {
  const { siteContext } = useAuth();
  const dataMode = getEffectiveDataMode(Boolean(siteContext?.siteId));
  const isPhone = useMediaQuery("(max-width: 639px)");
  const DemoEngineersSection = isPhone
    ? MobileDemoEngineersSection
    : DesktopDemoEngineersSection;
  const LiveEngineersSection = isPhone
    ? MobileLiveEngineersSection
    : DesktopLiveEngineersSection;

  return (
    <div className="contents" data-vorta-engineers-mode={dataMode}>
      {dataMode === "demo" ? <DemoEngineersSection /> : <LiveEngineersSection />}
    </div>
  );
}
