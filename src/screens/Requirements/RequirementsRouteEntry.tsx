import { LiveRequirementsSection } from "./LiveRequirementsSection";
import { RequirementsSection as DemoRequirementsSection } from "./RequirementsSection";

const isLivePilotMode =
  String(import.meta.env.VITE_VORTA_DATA_MODE ?? "").trim().toLowerCase() === "live";

export const RequirementsRouteEntry = (): JSX.Element =>
  isLivePilotMode ? <LiveRequirementsSection /> : <DemoRequirementsSection />;
