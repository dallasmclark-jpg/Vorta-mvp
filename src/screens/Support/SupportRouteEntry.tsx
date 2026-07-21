import { DemoSimulationBanner } from "../../components/DemoSimulationBanner";
import { SupportSection as DemoSupportSection } from "./SupportSection";
import { LiveSupportSection } from "./LiveSupportSection";

const isLivePilotMode =
  String(import.meta.env.VITE_VORTA_DATA_MODE ?? "").trim().toLowerCase() === "live";

export function SupportRouteEntry(): JSX.Element {
  if (isLivePilotMode) return <LiveSupportSection />;

  return (
    <>
      <DemoSimulationBanner
        title="support desk"
        description="Ticket IDs, replies, statuses and submission confirmations on this page are illustrative. They do not create or update a Vorta support ticket."
      />
      <DemoSupportSection />
    </>
  );
}
