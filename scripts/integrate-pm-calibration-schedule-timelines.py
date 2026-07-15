from pathlib import Path


work_orders_path = Path("src/screens/Equipment/EquipmentWorkOrders.tsx")
work_orders = work_orders_path.read_text()

navigation_import = 'import { EquipmentTabNavigation } from "./EquipmentTabNavigation";\n'
work_order_imports = (
    'import { EquipmentScheduleTimeline } from "./EquipmentScheduleTimeline";\n'
    'import {\n'
    '  getEquipmentMaintenanceSchedules,\n'
    '  type MaintenanceScheduleRecord,\n'
    '} from "./equipmentScheduleService";\n'
)
if work_order_imports not in work_orders:
    if navigation_import not in work_orders:
        raise SystemExit("Work Orders navigation import marker not found")
    work_orders = work_orders.replace(
        navigation_import,
        navigation_import + work_order_imports,
        1,
    )

risk_state_marker = """  const [riskQueue, setRiskQueue] =
    useState<EquipmentRecommendedWorkQueue | null>(null);
"""
pm_state = """  const [pmSchedules, setPmSchedules] = useState<MaintenanceScheduleRecord[]>([]);
"""
if pm_state not in work_orders:
    if risk_state_marker not in work_orders:
        raise SystemExit("Work Orders risk state marker not found")
    work_orders = work_orders.replace(
        risk_state_marker,
        risk_state_marker + pm_state,
        1,
    )

old_promise = """      const [identity, workOrders, queue] = await Promise.all([
        getEquipmentIdentityById(resolvedId),
        getEquipmentWorkOrders(resolvedId),
        getEquipmentRecommendedWorkQueue(resolvedId),
      ]);
"""
new_promise = """      const [identity, workOrders, queue, schedules] = await Promise.all([
        getEquipmentIdentityById(resolvedId),
        getEquipmentWorkOrders(resolvedId),
        getEquipmentRecommendedWorkQueue(resolvedId),
        getEquipmentMaintenanceSchedules(resolvedId, "pm"),
      ]);
"""
if new_promise not in work_orders:
    if old_promise not in work_orders:
        raise SystemExit("Work Orders load promise marker not found")
    work_orders = work_orders.replace(old_promise, new_promise, 1)

queue_assignment = """      setRiskQueue(queue);
      setLastUpdated(new Date());
"""
schedule_assignment = """      setRiskQueue(queue);
      setPmSchedules(schedules);
      setLastUpdated(new Date());
"""
if schedule_assignment not in work_orders:
    if queue_assignment not in work_orders:
        raise SystemExit("Work Orders queue assignment marker not found")
    work_orders = work_orders.replace(
        queue_assignment,
        schedule_assignment,
        1,
    )

catch_marker = """    } catch (error) {
      console.error("Failed to load equipment work-order intelligence", error);
      setLoadError(
"""
catch_replacement = """    } catch (error) {
      console.error("Failed to load equipment work-order intelligence", error);
      setPmSchedules([]);
      setLoadError(
"""
if catch_replacement not in work_orders:
    if catch_marker not in work_orders:
        raise SystemExit("Work Orders catch marker not found")
    work_orders = work_orders.replace(catch_marker, catch_replacement, 1)

work_orders_card_marker = """        </Card>

        <Card className="rounded-2xl border border-emerald-500/20 bg-[#141820] shadow-none">
"""
pm_timeline_card = """        </Card>

        <Card className="rounded-2xl border border-violet-500/20 bg-[#141820] shadow-none">
          <CardContent className="p-5 md:p-6">
            <EquipmentScheduleTimeline
              mode="pm"
              records={pmSchedules}
              loading={loading}
              onOpenWorkOrder={(workOrderNumber) => {
                setRegisterView("OPEN");
                setFilter("PREVENTIVE");
                setSearch(workOrderNumber);
                setSearchParams(
                  { workOrder: workOrderNumber },
                  { replace: true },
                );
                requestAnimationFrame(() => {
                  document
                    .getElementById("work-order-register")
                    ?.scrollIntoView({ behavior: "smooth", block: "start" });
                });
              }}
            />
          </CardContent>
        </Card>

        <Card className="rounded-2xl border border-emerald-500/20 bg-[#141820] shadow-none">
"""
if '<EquipmentScheduleTimeline\n              mode="pm"' not in work_orders:
    if work_orders_card_marker not in work_orders:
        raise SystemExit("Work Orders briefing-to-queue card marker not found")
    work_orders = work_orders.replace(
        work_orders_card_marker,
        pm_timeline_card,
        1,
    )

work_orders_path.write_text(work_orders)


calibrations_path = Path("src/screens/Equipment/EquipmentPMs.tsx")
calibrations = calibrations_path.read_text()

calibration_imports = (
    'import { EquipmentScheduleTimeline } from "./EquipmentScheduleTimeline";\n'
    'import type { MaintenanceScheduleRecord } from "./equipmentScheduleService";\n'
)
if calibration_imports not in calibrations:
    if navigation_import not in calibrations:
        raise SystemExit("Calibrations navigation import marker not found")
    calibrations = calibrations.replace(
        navigation_import,
        navigation_import + calibration_imports,
        1,
    )

attention_marker = """  const attention = useMemo(
"""
calibration_mapping = """  const calibrationTimelineRecords = useMemo<MaintenanceScheduleRecord[]>(
    () =>
      calibrations.map((calibration) => ({
        id: calibration.calibrationId,
        reference: calibration.calibrationNumber,
        title: calibration.title,
        scheduleType: "Calibration",
        frequency: null,
        frequencyUnit: null,
        lastCompletedDate: calibration.lastCompletedDate,
        nextDueDate: calibration.nextDueDate,
        status: calibration.scheduleStatus,
        criticality: calibration.criticality,
        assignedEngineer: calibration.assignedEngineer,
        procedureReference: calibration.procedureReference,
        checklistReference: calibration.checklistReference,
        calibrationPoint: calibration.calibrationPoint,
        toleranceSpecification: calibration.toleranceSpecification,
        lastResult: calibration.lastResult,
        certificateReference: calibration.certificateReference,
        linkedWorkOrderNumber: calibration.linkedWorkOrderNumber,
        linkedWorkOrderStatus: calibration.linkedWorkOrderStatus,
        linkedWorkOrderDueDate: calibration.linkedWorkOrderDueDate,
      })),
    [calibrations],
  );

"""
if calibration_mapping not in calibrations:
    if attention_marker not in calibrations:
        raise SystemExit("Calibrations attention marker not found")
    calibrations = calibrations.replace(
        attention_marker,
        calibration_mapping + attention_marker,
        1,
    )

calibration_card_marker = """        </Card>

        <Card className="rounded-2xl border border-orange-500/20 bg-[#141820] shadow-none">
"""
calibration_timeline_card = """        </Card>

        <Card className="rounded-2xl border border-cyan-500/20 bg-[#141820] shadow-none">
          <CardContent className="p-5 md:p-6">
            <EquipmentScheduleTimeline
              mode="calibration"
              records={calibrationTimelineRecords}
              loading={loading}
              onOpenWorkOrder={(workOrderNumber) =>
                navigate(
                  `/equipment/${equipment.id}/work-orders?workOrder=${encodeURIComponent(
                    workOrderNumber,
                  )}#work-order-register`,
                )
              }
            />
          </CardContent>
        </Card>

        <Card className="rounded-2xl border border-orange-500/20 bg-[#141820] shadow-none">
"""
if '<EquipmentScheduleTimeline\n              mode="calibration"' not in calibrations:
    if calibration_card_marker not in calibrations:
        raise SystemExit("Calibration briefing-to-intervention marker not found")
    calibrations = calibrations.replace(
        calibration_card_marker,
        calibration_timeline_card,
        1,
    )

calibrations_path.write_text(calibrations)
