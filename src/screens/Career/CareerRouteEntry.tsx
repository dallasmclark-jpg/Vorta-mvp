import { DemoSimulationBanner } from "../../components/DemoSimulationBanner";
import { CareerSection as DemoCareerSection } from "./CareerSection";
import { LiveCareerSection } from "./LiveCareerSection";

const isLivePilotMode =
  String(import.meta.env.VITE_VORTA_DATA_MODE ?? "").trim().toLowerCase() === "live";

export function CareerRouteEntry(): JSX.Element {
  if (isLivePilotMode) return <LiveCareerSection />;

  return (
    <>
      <DemoSimulationBanner
        title="career profile"
        description="The named manager profile, qualifications and 66% readiness score are illustrative demo data. They are not linked to the signed-in user or persisted career evidence."
      />
      <DemoCareerSection />
    </>
  );
}
