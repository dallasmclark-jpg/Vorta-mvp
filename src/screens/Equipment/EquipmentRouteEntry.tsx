import { useMediaQuery } from "../../hooks/useMediaQuery";
import { useAuth } from "../../lib/auth";
import { getEffectiveDataMode } from "../../lib/dataTrust";
import { EquipmentLiveListEntry } from "./EquipmentLiveListEntry";
import { MobileEquipmentSection } from "./MobileEquipmentSection";

export function EquipmentRouteEntry(): JSX.Element {
  const { siteContext } = useAuth();
  const dataMode = getEffectiveDataMode(Boolean(siteContext?.siteId));
  const isPhone = useMediaQuery("(max-width: 639px)");

  if (isPhone && dataMode === "demo") {
    return <MobileEquipmentSection />;
  }

  return <EquipmentLiveListEntry />;
}
