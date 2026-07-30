type AnyRow = Record<string, any>;

export type HandoverStatus =
  | "completed"
  | "ongoing"
  | "temporarily_restored"
  | "waiting_on_parts"
  | "external_contractor"
  | "waiting_on_production"
  | "monitoring"
  | "deferred";

const STATUS_LABELS: Record<HandoverStatus, string> = {
  completed: "Completed",
  ongoing: "Ongoing",
  temporarily_restored: "Temporarily restored",
  waiting_on_parts: "Waiting on parts",
  external_contractor: "External contractor",
  waiting_on_production: "Waiting on production",
  monitoring: "Monitoring",
  deferred: "Deferred",
};

const CRITICALITY_ORDER: Record<string, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
  unknown: 0,
};

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function numeric(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function lowerJoined(values: unknown[]): string {
  return values
    .flatMap((value) => (Array.isArray(value) ? value : [value]))
    .map((value) => text(value).toLowerCase())
    .filter(Boolean)
    .join(" ");
}

function normaliseCriticality(equipmentCriticality: unknown, priority: unknown): string {
  const raw = text(equipmentCriticality || priority).toLowerCase();
  if (raw.includes("critical") || raw === "1") return "critical";
  if (raw.includes("high") || raw === "2") return "high";
  if (raw.includes("medium") || raw === "3") return "medium";
  if (raw.includes("low") || raw === "4") return "low";
  return "unknown";
}

function disciplineFor(order: AnyRow, confirmations: AnyRow[]): string {
  const evidence = lowerJoined([
    order.main_work_center,
    order.work_type,
    order.description,
    ...confirmations.map((row) => row.work_center),
    ...confirmations.map((row) => row.confirmation_text),
  ]);

  if (/\b(elec|electrical|electrician|power|motor|mcc|switchgear)\b/.test(evidence)) {
    return "electrical";
  }
  if (/\b(control|controls|automation|plc|hmi|instrument|sensor|servo|vision|scada|calibrat)\b/.test(evidence)) {
    return "controls";
  }
  if (/\b(util|utilities|facility|facilities|hvac|bms|boiler|steam|wfi|water|generator|compressor)\b/.test(evidence)) {
    return "facilities";
  }
  return "mechanical";
}

function buildingFor(order: AnyRow, equipment: AnyRow | undefined, department: AnyRow | undefined): string {
  const departmentName = text(department?.name);
  if (departmentName) return departmentName;

  const functionalLocation = text(order.functional_location_code);
  if (functionalLocation) {
    const parts = functionalLocation.split("-").filter(Boolean);
    if (parts.length >= 2) return parts.slice(0, Math.min(parts.length - 1, 3)).join(" · ");
  }

  return text(equipment?.area) || "Site";
}

function durationMinutes(order: AnyRow): number {
  const explicit = numeric(order.downtime_minutes);
  if (explicit > 0) return Math.round(explicit);

  const start = order.actual_start_at ? new Date(order.actual_start_at).getTime() : NaN;
  const finish = order.actual_finish_at ? new Date(order.actual_finish_at).getTime() : NaN;
  if (Number.isFinite(start) && Number.isFinite(finish) && finish > start) {
    return Math.round((finish - start) / 60_000);
  }
  return 0;
}

function workHours(confirmations: AnyRow[]): number {
  return confirmations.reduce((sum, row) => {
    const amount = numeric(row.actual_work || row.actual_duration);
    const unit = text(row.work_unit || row.duration_unit).toUpperCase();
    if (unit === "MIN" || unit === "M") return sum + amount / 60;
    return sum + amount;
  }, 0);
}

function hasFinalCompletionEvidence(
  order: AnyRow,
  confirmations: AnyRow[],
): boolean {
  const hasFinalConfirmation = confirmations.some(
    (row) => Boolean(row.final_confirmation) && !Boolean(row.reversal),
  );
  const statusCodes = lowerJoined([
    order.system_status_codes,
    order.user_status_codes,
    order.status,
  ]);
  const hasExplicitClosureCode = /\b(teco|clsd)\b/.test(statusCodes);
  const orderStatus = text(order.status)
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const hasExplicitClosedState = new Set([
    "complete",
    "completed",
    "closed",
    "technically complete",
    "technically completed",
    "business complete",
    "business completed",
  ]).has(orderStatus);
  const hasCompletionTimestamp = Boolean(
    order.technical_completion_at
    || order.business_completion_at
    || order.completed_at
    || order.completed_date
    || order.closed_at,
  );

  return hasFinalConfirmation
    || hasExplicitClosureCode
    || hasExplicitClosedState
    || hasCompletionTimestamp;
}

function statusFor(
  order: AnyRow,
  confirmations: AnyRow[],
  outstandingReservationCount: number,
): HandoverStatus {
  const latestText = confirmations[0]?.confirmation_text;
  const operationalEvidence = lowerJoined([
    order.status,
    order.outcome,
    order.system_status_codes,
    order.user_status_codes,
    order.assigned_engineer,
    order.main_work_center,
    latestText,
  ]);

  if (
    outstandingReservationCount > 0 ||
    /waiting parts|waiting on parts|parts required|material shortage|\bmspt\b|awaiting spare|awaiting material/.test(operationalEvidence)
  ) {
    return "waiting_on_parts";
  }
  if (/contractor|external|vendor|oem support|specialist/.test(operationalEvidence)) {
    return "external_contractor";
  }
  if (/waiting production|awaiting production|production access|line release|permit to work/.test(operationalEvidence)) {
    return "waiting_on_production";
  }
  if (/temporary|temporarily|temporary repair|running with restriction|restored pending/.test(operationalEvidence)) {
    return "temporarily_restored";
  }
  if (/monitor|observation|watching|trend/.test(operationalEvidence)) {
    return "monitoring";
  }
  if (/defer|deferred|postponed|shutdown scope/.test(operationalEvidence)) {
    return "deferred";
  }
  if (hasFinalCompletionEvidence(order, confirmations)) {
    return "completed";
  }
  return "ongoing";
}

function nextActionFor(status: HandoverStatus, item: {
  equipmentName: string;
  outstandingReservationCount: number;
  contractor: boolean;
}): string {
  switch (status) {
    case "completed":
      return `Confirm ${item.equipmentName} remains stable on the incoming shift.`;
    case "waiting_on_parts":
      return item.outstandingReservationCount > 0
        ? `Check the outstanding material reservation and confirm the expected issue time.`
        : "Confirm the required spare, reservation and expected delivery time.";
    case "external_contractor":
      return "Confirm contractor attendance, site access and the agreed technical scope.";
    case "waiting_on_production":
      return "Agree an access window with Production and record the next available intervention time.";
    case "temporarily_restored":
      return `Monitor ${item.equipmentName} and complete the permanent repair plan.`;
    case "monitoring":
      return `Review the next operating cycle and record whether the condition recurs.`;
    case "deferred":
      return "Confirm the approved deferment date, owner and risk controls.";
    default:
      return item.contractor
        ? "Confirm the next engineering and contractor action before the shift starts work."
        : "Review the latest confirmation and continue the outstanding work order scope.";
  }
}

function aggregateSpares(
  movements: AnyRow[],
  reservations: AnyRow[],
): {
  used: AnyRow[];
  outstanding: AnyRow[];
  outstandingCount: number;
} {
  const usedMap = new Map<string, AnyRow>();
  for (const row of movements) {
    if (row.reversal) continue;
    const key = text(row.material_number) || text(row.component_id) || text(row.material_description) || row.id;
    const current = usedMap.get(key) ?? {
      materialNumber: text(row.material_number) || "Unnumbered material",
      description: text(row.material_description) || "Material issued",
      quantity: 0,
      unit: text(row.base_unit),
      storageLocation: text(row.storage_location),
      postingDate: row.posting_date ?? null,
    };
    const sign = text(row.debit_credit_indicator).toUpperCase() === "H" ? -1 : 1;
    current.quantity += numeric(row.quantity) * sign;
    usedMap.set(key, current);
  }

  const outstanding = reservations
    .filter((row) => !row.final_issue && numeric(row.required_quantity) > numeric(row.withdrawn_quantity))
    .map((row) => ({
      materialNumber: text(row.material_number),
      requiredQuantity: numeric(row.required_quantity),
      withdrawnQuantity: numeric(row.withdrawn_quantity),
      outstandingQuantity: Math.max(0, numeric(row.required_quantity) - numeric(row.withdrawn_quantity)),
      unit: text(row.base_unit),
      requirementDate: row.requirement_date ?? null,
      storageLocation: text(row.storage_location),
      reservationStatus: text(row.reservation_status),
    }));

  return {
    used: [...usedMap.values()].filter((row) => Math.abs(row.quantity) > 0.0001),
    outstanding,
    outstandingCount: outstanding.length,
  };
}

export function buildShiftHandoverPayload(input: {
  site: AnyRow;
  window: { start: string; end: string; label: string; mode: "previous" | "latest" };
  workOrders: AnyRow[];
  confirmations: AnyRow[];
  equipment: AnyRow[];
  departments: AnyRow[];
  movements: AnyRow[];
  reservations: AnyRow[];
}) {
  const {
    site,
    window,
    workOrders,
    confirmations,
    equipment,
    departments,
    movements,
    reservations,
  } = input;

  const equipmentMap = new Map(equipment.map((row) => [row.id, row]));
  const departmentMap = new Map(departments.map((row) => [row.id, row]));
  const confirmationsByOrder = new Map<string, AnyRow[]>();
  const movementsByOrder = new Map<string, AnyRow[]>();
  const reservationsByOrder = new Map<string, AnyRow[]>();

  for (const row of confirmations) {
    const current = confirmationsByOrder.get(row.work_order_id) ?? [];
    current.push(row);
    confirmationsByOrder.set(row.work_order_id, current);
  }
  for (const rows of confirmationsByOrder.values()) {
    rows.sort((a, b) => new Date(b.confirmation_timestamp ?? b.created_at).getTime() - new Date(a.confirmation_timestamp ?? a.created_at).getTime());
  }
  for (const row of movements) {
    const current = movementsByOrder.get(row.work_order_id) ?? [];
    current.push(row);
    movementsByOrder.set(row.work_order_id, current);
  }
  for (const row of reservations) {
    const current = reservationsByOrder.get(row.work_order_id) ?? [];
    current.push(row);
    reservationsByOrder.set(row.work_order_id, current);
  }

  const items = workOrders.map((order) => {
    const orderConfirmations = confirmationsByOrder.get(order.id) ?? [];
    const orderMovements = movementsByOrder.get(order.id) ?? [];
    const orderReservations = reservationsByOrder.get(order.id) ?? [];
    const equipmentRow = equipmentMap.get(order.equipment_id) as AnyRow | undefined;
    const department = equipmentRow?.department_id
      ? departmentMap.get(equipmentRow.department_id) as AnyRow | undefined
      : undefined;
    const spares = aggregateSpares(orderMovements, orderReservations);
    const status = statusFor(order, orderConfirmations, spares.outstandingCount);
    const criticality = normaliseCriticality(equipmentRow?.criticality, order.priority);
    const discipline = disciplineFor(order, orderConfirmations);
    const breakdownMinutes = durationMinutes(order);
    const latestConfirmation = orderConfirmations[0];
    const contractor = status === "external_contractor";
    const equipmentName = text(equipmentRow?.name) || "Unknown equipment";

    return {
      id: order.id,
      workOrderNumber: text(order.wo_number),
      notificationNumber: text(order.primary_notification_number) || null,
      description: text(order.description),
      workType: text(order.work_type),
      priority: text(order.priority),
      criticality,
      criticalityRank: CRITICALITY_ORDER[criticality] ?? 0,
      status,
      statusLabel: STATUS_LABELS[status],
      sapStatus: text(order.status),
      systemStatusCodes: Array.isArray(order.system_status_codes) ? order.system_status_codes : [],
      userStatusCodes: Array.isArray(order.user_status_codes) ? order.user_status_codes : [],
      equipmentId: order.equipment_id,
      equipmentCode: text(equipmentRow?.equipment_code) || null,
      equipmentName,
      area: text(equipmentRow?.area) || "Unassigned area",
      line: text(equipmentRow?.line) || null,
      building: buildingFor(order, equipmentRow, department),
      department: text(department?.name) || null,
      functionalLocation: text(order.functional_location_code) || null,
      discipline,
      assignedEngineer: text(order.assigned_engineer) || text(latestConfirmation?.confirmed_by) || null,
      mainWorkCenter: text(order.main_work_center) || text(latestConfirmation?.work_center) || null,
      breakdownMinutes,
      confirmedWorkHours: Number(workHours(orderConfirmations).toFixed(2)),
      actualStartAt: order.actual_start_at ?? null,
      actualFinishAt: order.actual_finish_at ?? null,
      lastActivityAt: latestConfirmation?.confirmation_timestamp ?? latestConfirmation?.created_at ?? order.updated_at ?? null,
      latestConfirmationText: text(latestConfirmation?.confirmation_text) || null,
      confirmations: orderConfirmations.map((row) => ({
        id: row.id,
        timestamp: row.confirmation_timestamp ?? row.created_at ?? null,
        text: text(row.confirmation_text),
        confirmedBy: text(row.confirmed_by) || null,
        workCenter: text(row.work_center) || null,
        actualWork: numeric(row.actual_work),
        workUnit: text(row.work_unit) || null,
        actualDuration: numeric(row.actual_duration),
        durationUnit: text(row.duration_unit) || null,
        finalConfirmation: Boolean(row.final_confirmation),
      })),
      sparesUsed: spares.used,
      outstandingMaterials: spares.outstanding,
      contractor,
      nextAction: nextActionFor(status, {
        equipmentName,
        outstandingReservationCount: spares.outstandingCount,
        contractor,
      }),
      sourceSystem: text(order.source_system) || "SAP",
      sourceUpdatedAt: order.source_updated_at ?? order.updated_at ?? null,
    };
  }).sort((a, b) => {
    const statusPriority: Record<HandoverStatus, number> = {
      waiting_on_parts: 8,
      external_contractor: 7,
      waiting_on_production: 6,
      temporarily_restored: 5,
      ongoing: 4,
      monitoring: 3,
      deferred: 2,
      completed: 1,
    };
    return (
      statusPriority[b.status] - statusPriority[a.status] ||
      b.criticalityRank - a.criticalityRank ||
      b.breakdownMinutes - a.breakdownMinutes ||
      new Date(b.lastActivityAt ?? 0).getTime() - new Date(a.lastActivityAt ?? 0).getTime()
    );
  });

  const unique = (values: Array<string | null | undefined>) =>
    [...new Set(values.filter((value): value is string => Boolean(value && value.trim())).map((value) => value.trim()))].sort();

  return {
    site: {
      id: site.id,
      name: text(site.name),
      timezone: text(site.timezone) || "Europe/London",
    },
    window,
    items,
    scopeOptions: {
      buildings: unique(items.map((item) => item.building)),
      areas: unique(items.map((item) => item.area)),
      disciplines: ["mechanical", "electrical", "controls", "facilities"],
    },
    summary: {
      total: items.length,
      ongoing: items.filter((item) => item.status === "ongoing").length,
      completed: items.filter((item) => item.status === "completed").length,
      waitingOnParts: items.filter((item) => item.status === "waiting_on_parts").length,
      externalContractor: items.filter((item) => item.status === "external_contractor").length,
      unavailableEquipment: items.filter((item) => item.breakdownMinutes > 0 && item.status !== "completed").length,
      totalBreakdownMinutes: items.reduce((sum, item) => sum + item.breakdownMinutes, 0),
      sparesUsed: items.reduce((sum, item) => sum + item.sparesUsed.length, 0),
    },
    generatedAt: new Date().toISOString(),
  };
}
