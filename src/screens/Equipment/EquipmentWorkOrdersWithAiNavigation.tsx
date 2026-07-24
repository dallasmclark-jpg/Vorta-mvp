import { useEffect } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { useMediaQuery } from "../../hooks/useMediaQuery";
import { openWorkOrderDetail } from "../../lib/maintenanceActions";
import { DEFAULT_EQUIPMENT_ID } from "./equipmentData";
import { EquipmentWorkOrdersWithExecution } from "./EquipmentWorkOrdersWithExecution";
import { MobileEquipmentWorkOrders } from "./MobileEquipmentWorkOrders";

export function EquipmentWorkOrdersWithAiNavigation(): JSX.Element {
  const { equipmentId } = useParams<{ equipmentId?: string }>();
  const [searchParams] = useSearchParams();
  const workOrderNumber = searchParams.get("workOrder")?.trim() ?? "";
  const isPhone = useMediaQuery("(max-width: 639px)");

  useEffect(() => {
    if (!workOrderNumber) return;

    openWorkOrderDetail({
      equipmentId: equipmentId ?? DEFAULT_EQUIPMENT_ID,
      workOrderNumber,
    });
  }, [equipmentId, workOrderNumber]);

  return isPhone ? <MobileEquipmentWorkOrders /> : <EquipmentWorkOrdersWithExecution />;
}
