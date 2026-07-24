import { DemoSimulationBanner } from "../../components/DemoSimulationBanner";
import { useMediaQuery } from "../../hooks/useMediaQuery";
import { useAuth } from "../../lib/auth";
import { getEffectiveDataMode } from "../../lib/dataTrust";
import { LiveTrainingSection } from "./LiveTrainingSection";
import { MobileTrainingSection } from "./MobileTrainingSection";
import { TrainingSection as DemoTrainingSection } from "./TrainingSection";

export function TrainingRouteEntry(): JSX.Element {
  const { siteContext } = useAuth();
  const dataMode = getEffectiveDataMode(Boolean(siteContext?.siteId));
  const isPhone = useMediaQuery("(max-width: 639px)");

  if (isPhone) return <MobileTrainingSection dataMode={dataMode} />;
  if (dataMode === "live") return <LiveTrainingSection />;

  return (
    <>
      <DemoSimulationBanner
        title="Training workflow"
        description="Booking approvals, completion changes and plan creation affect this browser session only. No source-system record or provider booking is changed."
      />
      <DemoTrainingSection />
    </>
  );
}
