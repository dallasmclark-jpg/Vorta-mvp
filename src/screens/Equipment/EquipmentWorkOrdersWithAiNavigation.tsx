import { useEffect } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { openWorkOrderDetail } from "../../lib/maintenanceActions";
import { DEFAULT_EQUIPMENT_ID } from "./equipmentData";
import { EquipmentWorkOrdersWithExecution } from "./EquipmentWorkOrdersWithExecution";

export function EquipmentWorkOrdersWithAiNavigation(): JSX.Element {
  const { equipmentId } = useParams<{ equipmentId?: string }>();
  const [searchParams] = useSearchParams();
  const workOrderNumber = searchParams.get("workOrder")?.trim() ?? "";

  useEffect(() => {
    if (!workOrderNumber) return;

    openWorkOrderDetail({
      equipmentId: equipmentId ?? DEFAULT_EQUIPMENT_ID,
      workOrderNumber,
    });
  }, [equipmentId, workOrderNumber]);

  return <EquipmentWorkOrdersWithExecution />;
}
