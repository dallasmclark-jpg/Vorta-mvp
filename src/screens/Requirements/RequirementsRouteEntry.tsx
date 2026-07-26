import { useMediaQuery } from "../../hooks/useMediaQuery";
import { LiveRequirementsSection } from "./LiveRequirementsSection";
import { MobileRequirementsSection } from "./MobileRequirementsSection";
import { RequirementsSection as DemoRequirementsSection } from "./RequirementsSection";

const isLivePilotMode =
  String(import.meta.env.VITE_VORTA_DATA_MODE ?? "").trim().toLowerCase() === "live";

export const RequirementsRouteEntry = (): JSX.Element => {
  const isPhone = useMediaQuery("(max-width: 767px)");

  if (isPhone) {
    return <MobileRequirementsSection dataMode={isLivePilotMode ? "live" : "demo"} />;
  }

  return isLivePilotMode ? <LiveRequirementsSection /> : <DemoRequirementsSection />;
};
