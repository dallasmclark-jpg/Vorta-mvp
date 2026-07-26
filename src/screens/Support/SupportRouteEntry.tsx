import { DemoSimulationBanner } from "../../components/DemoSimulationBanner";
import { useMediaQuery } from "../../hooks/useMediaQuery";
import { LiveSupportSection } from "./LiveSupportSection";
import { MobileSupportSection } from "./MobileSupportSection";
import { SupportSection as DemoSupportSection } from "./SupportSection";

const isLivePilotMode =
  String(import.meta.env.VITE_VORTA_DATA_MODE ?? "").trim().toLowerCase() === "live";

export function SupportRouteEntry(): JSX.Element {
  const isPhone = useMediaQuery("(max-width: 767px)");

  if (isLivePilotMode) return <LiveSupportSection />;

  if (isPhone) {
    return (
      <>
        <DemoSimulationBanner
          title="support desk"
          description="Tickets and responses are illustrative. This mobile view does not submit or update a support ticket."
        />
        <MobileSupportSection />
      </>
    );
  }

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
