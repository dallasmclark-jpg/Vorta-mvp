import { useMediaQuery } from "../../hooks/useMediaQuery";
import { LiveRequirementsSection as DesktopLiveRequirementsSection } from "./LiveRequirementsSection";
import { MobileRequirementsSection } from "./MobileRequirementsSection";
import { RequirementsSection as DesktopDemoRequirementsSection } from "./RequirementsSection";

const isLivePilotMode =
  String(import.meta.env.VITE_VORTA_DATA_MODE ?? "").trim().toLowerCase() === "live";

function MobileDemoRequirementsSection(): JSX.Element {
  return <MobileRequirementsSection dataMode="demo" />;
}

function MobileLiveRequirementsSection(): JSX.Element {
  return <MobileRequirementsSection dataMode="live" />;
}

export const RequirementsRouteEntry = (): JSX.Element => {
  const isPhone = useMediaQuery("(max-width: 639px)");
  const DemoRequirementsSection = isPhone
    ? MobileDemoRequirementsSection
    : DesktopDemoRequirementsSection;
  const LiveRequirementsSection = isPhone
    ? MobileLiveRequirementsSection
    : DesktopLiveRequirementsSection;

  return isLivePilotMode ? <LiveRequirementsSection /> : <DemoRequirementsSection />;
};
