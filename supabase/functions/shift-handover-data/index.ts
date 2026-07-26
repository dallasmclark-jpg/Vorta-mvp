import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { context, preflight, response } from "./auth.ts";
import { buildShiftHandoverPayload } from "./transform.ts";

type WindowMode = "previous" | "latest";

type LocalParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

function localParts(value: Date, timeZone: string): LocalParts {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(value);
  const map = new Map(parts.map((part) => [part.type, part.value]));
  return {
    year: Number(map.get("year")),
    month: Number(map.get("month")),
    day: Number(map.get("day")),
    hour: Number(map.get("hour")),
    minute: Number(map.get("minute")),
    second: Number(map.get("second")),
  };
}

function timezoneOffsetMs(value: Date, timeZone: string): number {
  const parts = localParts(value, timeZone);
  const representedUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );
  return representedUtc - value.getTime();
}

function zonedToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  timeZone: string,
): Date {
  const localAsUtc = Date.UTC(year, month - 1, day, hour, 0, 0, 0);
  let candidate = localAsUtc;
  for (let index = 0; index < 3; index += 1) {
    candidate = localAsUtc - timezoneOffsetMs(new Date(candidate), timeZone);
  }
  return new Date(candidate);
}

function addLocalDays(parts: LocalParts, days: number): LocalParts {
  const next = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + days, parts.hour, parts.minute, parts.second));
  return {
    year: next.getUTCFullYear(),
    month: next.getUTCMonth() + 1,
    day: next.getUTCDate(),
    hour: next.getUTCHours(),
    minute: next.getUTCMinutes(),
    second: next.getUTCSeconds(),
  };
}

function shiftContaining(anchor: Date, timeZone: string) {
  const parts = localParts(anchor, timeZone);
  let startParts: LocalParts;
  let endParts: LocalParts;
  let shiftLabel: string;

  if (parts.hour >= 18) {
    startParts = { ...parts, hour: 18, minute: 0, second: 0 };
    endParts = { ...addLocalDays(parts, 1), hour: 6, minute: 0, second: 0 };
    shiftLabel = "Night shift";
  } else if (parts.hour >= 6) {
    startParts = { ...parts, hour: 6, minute: 0, second: 0 };
    endParts = { ...parts, hour: 18, minute: 0, second: 0 };
    shiftLabel = "Day shift";
  } else {
    startParts = { ...addLocalDays(parts, -1), hour: 18, minute: 0, second: 0 };
    endParts = { ...parts, hour: 6, minute: 0, second: 0 };
    shiftLabel = "Night shift";
  }

  return {
    start: zonedToUtc(startParts.year, startParts.month, startParts.day, startParts.hour, timeZone),
    end: zonedToUtc(endParts.year, endParts.month, endParts.day, endParts.hour, timeZone),
    shiftLabel,
  };
}

function previousCompletedShift(anchor: Date, timeZone: string) {
  const current = shiftContaining(anchor, timeZone);
  const previousAnchor = new Date(current.start.getTime() - 1);
  return shiftContaining(previousAnchor, timeZone);
}

function formatWindowLabel(start: Date, end: Date, timeZone: string, shiftLabel: string): string {
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
  return `${shiftLabel} · ${formatter.format(start)} to ${formatter.format(end)}`;
}

async function requestBody(req: Request): Promise<{ windowMode: WindowMode; limit: number }> {
  if (req.method !== "POST") return { windowMode: "previous", limit: 100 };
  try {
    const body = await req.json() as { windowMode?: unknown; limit?: unknown };
    const windowMode: WindowMode = body.windowMode === "latest" ? "latest" : "previous";
    const requestedLimit = Number(body.limit);
    const limit = Number.isFinite(requestedLimit)
      ? Math.max(1, Math.min(150, Math.round(requestedLimit)))
      : 100;
    return { windowMode, limit };
  } catch {
    return { windowMode: "previous", limit: 100 };
  }
}

Deno.serve(async (req: Request) => {
  const options = preflight(req);
  if (options) return options;
  if (!["GET", "POST"].includes(req.method)) {
    return response(req, { error: "Method not allowed" }, 405);
  }

  try {
    const { db, siteId, organisationId } = await context(req);
    const { windowMode, limit } = await requestBody(req);

    const { data: site, error: siteError } = await db
      .from("sites")
      .select("id,name,timezone,organisation_id")
      .eq("id", siteId)
      .eq("organisation_id", organisationId)
      .maybeSingle();
    if (siteError || !site) {
      throw { status: 403, message: "Active site could not be verified" };
    }

    const timeZone = typeof site.timezone === "string" && site.timezone.trim()
      ? site.timezone.trim()
      : "Europe/London";

    let anchor = new Date();
    if (windowMode === "latest") {
      const { data: latestConfirmation, error: latestError } = await db
        .from("work_order_confirmations")
        .select("confirmation_timestamp,created_at")
        .eq("site_id", siteId)
        .eq("reversal", false)
        .order("confirmation_timestamp", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (latestError) throw latestError;
      const latestValue = latestConfirmation?.confirmation_timestamp ?? latestConfirmation?.created_at;
      if (latestValue) anchor = new Date(latestValue);
    }

    const shift = windowMode === "latest"
      ? shiftContaining(anchor, timeZone)
      : previousCompletedShift(anchor, timeZone);
    const window = {
      start: shift.start.toISOString(),
      end: shift.end.toISOString(),
      label: formatWindowLabel(shift.start, shift.end, timeZone, shift.shiftLabel),
      mode: windowMode,
    } as const;

    const { data: confirmations, error: confirmationsError } = await db
      .from("work_order_confirmations")
      .select("id,site_id,work_order_id,confirmation_number,operation_number,confirmation_text,confirmed_by,work_center,posting_date,confirmation_timestamp,actual_work,work_unit,actual_duration,duration_unit,final_confirmation,reversal,reason_code,source_system,source_updated_at,created_at")
      .eq("site_id", siteId)
      .eq("reversal", false)
      .gte("confirmation_timestamp", window.start)
      .lt("confirmation_timestamp", window.end)
      .order("confirmation_timestamp", { ascending: false })
      .limit(limit * 5);
    if (confirmationsError) throw confirmationsError;

    const workOrderIds = [...new Set((confirmations ?? []).map((row: { work_order_id: string }) => row.work_order_id).filter(Boolean))]
      .slice(0, limit);

    if (workOrderIds.length === 0) {
      return response(req, {
        site: { id: site.id, name: site.name, timezone: timeZone },
        window,
        items: [],
        scopeOptions: { buildings: [], areas: [], disciplines: ["mechanical", "electrical", "controls", "facilities"] },
        summary: {
          total: 0,
          ongoing: 0,
          completed: 0,
          waitingOnParts: 0,
          externalContractor: 0,
          unavailableEquipment: 0,
          totalBreakdownMinutes: 0,
          sparesUsed: 0,
        },
        generatedAt: new Date().toISOString(),
      });
    }

    const { data: workOrders, error: workOrdersError } = await db
      .from("work_orders")
      .select("id,site_id,equipment_id,wo_number,priority,description,work_type,status,assigned_engineer,requested_date,due_date,completed_date,downtime_minutes,mttr_hours,outcome,created_at,updated_at,fault_code,source_system,source_record_key,source_updated_at,order_type_code,order_type_description,maintenance_activity_type_code,maintenance_activity_type_description,priority_code,functional_location_code,maintenance_plant,planner_group,main_work_center,scheduled_start_at,scheduled_finish_at,actual_start_at,actual_finish_at,technical_completion_at,business_completion_at,system_status_codes,user_status_codes,primary_notification_number")
      .eq("site_id", siteId)
      .in("id", workOrderIds);
    if (workOrdersError) throw workOrdersError;

    const equipmentIds = [...new Set((workOrders ?? []).map((row: { equipment_id: string }) => row.equipment_id).filter(Boolean))];
    const [equipmentResult, movementsResult, reservationsResult] = await Promise.all([
      equipmentIds.length
        ? db.from("equipment_assets").select("id,site_id,department_id,equipment_code,name,equipment_type,category,area,line,criticality,status,source_system,source_updated_at").eq("site_id", siteId).in("id", equipmentIds)
        : Promise.resolve({ data: [], error: null }),
      db.from("work_order_goods_movements").select("id,site_id,work_order_id,component_id,material_document_number,movement_type,posting_date,entry_timestamp,material_number,material_description,quantity,base_unit,debit_credit_indicator,plant_code,storage_location,reservation_number,entered_by,reversal,source_system,source_updated_at").eq("site_id", siteId).in("work_order_id", workOrderIds),
      db.from("work_order_material_reservations").select("id,site_id,work_order_id,component_id,material_number,reservation_number,requirement_date,required_quantity,reserved_quantity,withdrawn_quantity,base_unit,storage_location,reservation_status,final_issue,source_system,source_updated_at").eq("site_id", siteId).in("work_order_id", workOrderIds),
    ]);
    const detailError = equipmentResult.error ?? movementsResult.error ?? reservationsResult.error;
    if (detailError) throw detailError;

    const departmentIds = [...new Set((equipmentResult.data ?? []).map((row: { department_id?: string | null }) => row.department_id).filter(Boolean))] as string[];
    const departmentsResult = departmentIds.length
      ? await db.from("departments").select("id,site_id,name").eq("site_id", siteId).in("id", departmentIds)
      : { data: [], error: null };
    if (departmentsResult.error) throw departmentsResult.error;

    const payload = buildShiftHandoverPayload({
      site,
      window,
      workOrders: workOrders ?? [],
      confirmations: confirmations ?? [],
      equipment: equipmentResult.data ?? [],
      departments: departmentsResult.data ?? [],
      movements: movementsResult.data ?? [],
      reservations: reservationsResult.data ?? [],
    });

    return response(req, {
      siteId,
      organisationId,
      ...payload,
    });
  } catch (error) {
    const status = Number((error as { status?: unknown })?.status) || 500;
    if (status >= 500) console.error("shift-handover-data failed", error);
    return response(
      req,
      {
        error: status < 500
          ? String((error as { message?: unknown })?.message ?? "Access denied")
          : "Shift handover evidence could not be loaded",
      },
      status,
    );
  }
});
