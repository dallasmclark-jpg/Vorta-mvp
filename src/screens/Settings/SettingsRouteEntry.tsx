import { DemoSimulationBanner } from "../../components/DemoSimulationBanner";
import { useMediaQuery } from "../../hooks/useMediaQuery";
import { LiveSettingsSection } from "./LiveSettingsSection";
import { MobileSettingsSection } from "./MobileSettingsSection";
import { SettingsSection as DemoSettingsSection } from "./SettingsSection";

const isLivePilotMode =
  String(import.meta.env.VITE_VORTA_DATA_MODE ?? "").trim().toLowerCase() === "live";

export function SettingsRouteEntry(): JSX.Element {
  const isPhone = useMediaQuery("(max-width: 639px)");

  if (isPhone) {
    return (
      <>
        {!isLivePilotMode ? (
          <DemoSimulationBanner
            title="site settings"
            description="Appearance is saved locally. Site and approval controls remain demonstration-only."
          />
        ) : null}
        <MobileSettingsSection dataMode={isLivePilotMode ? "live" : "demo"} />
      </>
    );
  }

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
