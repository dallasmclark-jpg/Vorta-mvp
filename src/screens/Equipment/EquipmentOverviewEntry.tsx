import { getConfiguredDataMode } from "../../lib/dataTrust";
import { EquipmentOverview } from "./EquipmentOverview";
import { EquipmentOverviewLive } from "./EquipmentOverviewLive";

export function EquipmentOverviewEntry(): JSX.Element {
  return getConfiguredDataMode() === "demo" ? (
    <EquipmentOverview />
  ) : (
    <EquipmentOverviewLive />
  );
}
