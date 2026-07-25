import { useMediaQuery } from "../../hooks/useMediaQuery";
import { useAuth } from "../../lib/auth";
import { getEffectiveDataMode } from "../../lib/dataTrust";
import { EquipmentOverviewTrustedEntry } from "./EquipmentLiveRoutes";
import { MobileEquipmentOverview } from "./MobileEquipmentOverview";

export function EquipmentOverviewRouteEntry(): JSX.Element {
  const { siteContext } = useAuth();
  const dataMode = getEffectiveDataMode(Boolean(siteContext?.siteId));
  const isPhone = useMediaQuery("(max-width: 639px)");

  if (isPhone && dataMode === "demo") {
    return <MobileEquipmentOverview />;
  }

  return <EquipmentOverviewTrustedEntry />;
}
