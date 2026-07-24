import { useMediaQuery } from "../../hooks/useMediaQuery";
import { useAuth } from "../../lib/auth";
import { getEffectiveDataMode } from "../../lib/dataTrust";
import { LiveRequirementsSection } from "./LiveRequirementsSection";
import { MobileRequirementsSection } from "./MobileRequirementsSection";
import { RequirementsSection as DemoRequirementsSection } from "./RequirementsSection";

export const RequirementsRouteEntry = (): JSX.Element => {
  const { siteContext } = useAuth();
  const dataMode = getEffectiveDataMode(Boolean(siteContext?.siteId));
  const isPhone = useMediaQuery("(max-width: 639px)");

  if (isPhone) return <MobileRequirementsSection dataMode={dataMode} />;
  return dataMode === "live" ? <LiveRequirementsSection /> : <DemoRequirementsSection />;
};
