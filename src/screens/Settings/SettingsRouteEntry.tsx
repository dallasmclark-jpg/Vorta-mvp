import { DemoSimulationBanner } from "../../components/DemoSimulationBanner";
import { SettingsSection as DemoSettingsSection } from "./SettingsSection";
import { LiveSettingsSection } from "./LiveSettingsSection";

const isLivePilotMode =
  String(import.meta.env.VITE_VORTA_DATA_MODE ?? "").trim().toLowerCase() === "live";

export function SettingsRouteEntry(): JSX.Element {
  if (isLivePilotMode) return <LiveSettingsSection />;

  return (
    <>
      <DemoSimulationBanner
        title="site settings"
        description="Site values, team members, notifications, approval rules and billing controls are illustrative. Save, invite and toggle actions do not persist configuration."
      />
      <DemoSettingsSection />
    </>
  );
}
