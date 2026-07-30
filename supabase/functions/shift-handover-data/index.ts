import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { context, preflight, response } from "./auth.ts";
import { buildShiftHandoverPayload } from "./transform.ts";
import { attachMaintenanceTeamAttribution } from "./teamAttribution.ts";
import {
  attachShiftCalendarAssignments,
  reviewCalendarDateRange,
} from "./rotaAssignments.ts";
import {
  buildReviewPeriods,
  REVIEW_HOURS,
  reviewWindow,
  shiftContaining,
  type ReviewHours,
  type WindowMode,
} from "./shiftWindows.ts";

type AnyRow = Record<string, any>;
const PAGE_SIZE = 500;
const MAX_CONFIRMATIONS = 10_000;
const ID_BATCH_SIZE = 200;

async function requestBody(
  req: Request,
): Promise<{ windowMode: WindowMode; reviewHours: ReviewHours }> {
  if (req.method !== "POST") return { windowMode: "previous", reviewHours: 12 };
  try {
    const body = await req.json() as { windowMode?: unknown; reviewHours?: unknown };
    const requestedHours = Number(body.reviewHours);
    return {
      windowMode: body.windowMode === "latest" ? "latest" : "previous",
      reviewHours: REVIEW_HOURS.has(requestedHours)
        ? requestedHours as ReviewHours
        : 12,
    };
  } catch {
    return { windowMode: "previous", reviewHours: 12 };
  }
}

async function loadConfirmations(
  db: any,
  siteId: string,
  windowStart: string,
  windowEnd: string,
): Promise<AnyRow[]> {
  const rows: AnyRow[] = [];
  for (let offset = 0; offset < MAX_CONFIRMATIONS; offset += PAGE_SIZE) {
    const { data, error } = await db
      .from("work_order_confirmations")
      .select("id,site_id,work_order_id,confirmation_number,operation_number,confirmation_text,confirmed_by,personnel_number,work_center,posting_date,confirmation_timestamp,actual_work,work_unit,actual_duration,duration_unit,final_confirmation,reversal,reason_code,source_system,source_updated_at,created_at")
      .eq("site_id", siteId)
      .eq("reversal", false)
      .gte("confirmation_timestamp", windowStart)
      .lt("confirmation_timestamp", windowEnd)
      .order("confirmation_timestamp", { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1);
    if (error) throw error;
    const page = data ?? [];
    rows.push(...page);
    if (page.length < PAGE_SIZE) return rows;
  }
  throw new Error("Shift handover review period exceeds the verified evidence limit");
}

async function loadInBatches(
  ids: string[],
  loader: (batch: string[]) => Promise<{ data: AnyRow[] | null; error: unknown }>,
): Promise<AnyRow[]> {
  const rows: AnyRow[] = [];
  for (let offset = 0; offset < ids.length; offset += ID_BATCH_SIZE) {
    const result = await loader(ids.slice(offset, offset + ID_BATCH_SIZE));
    if (result.error) throw result.error;
    rows.push(...(result.data ?? []));
  }
  return rows;
}

Deno.serve(async (req: Request) => {
  const options = preflight(req);
  if (options) return options;
  if (!["GET", "POST"].includes(req.method)) {
    return response(req, { error: "Method not allowed" }, 405);
  }

  try {
    const { db, siteId, organisationId } = await context(req);
    const { windowMode, reviewHours } = await requestBody(req);

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

    const baseReviewPeriods = buildReviewPeriods(anchor, timeZone, windowMode);
    const calendarRange = reviewCalendarDateRange(baseReviewPeriods, timeZone);
    const [calendarResult, teamResult] = await Promise.all([
      db.rpc("vorta_get_shift_calendar_internal", {
        p_site_id: siteId,
        p_start_date: calendarRange.startDate,
        p_end_date: calendarRange.endDate,
      }),
      db
        .from("maintenance_shift_teams")
        .select("id,code,name,pattern_type,active")
        .eq("site_id", siteId),
    ]);
    if (calendarResult.error) throw calendarResult.error;
    if (teamResult.error) throw teamResult.error;

    const reviewPeriods = attachShiftCalendarAssignments(
      baseReviewPeriods,
      calendarResult.data ?? [],
      (teamResult.data ?? []).filter((row: AnyRow) => row.active),
      timeZone,
    );
    const window = reviewPeriods.find((period) => period.reviewHours === reviewHours)
      ?? reviewPeriods[0];
    if (!window) throw new Error("Shift handover review period could not be resolved");
    const rawConfirmations = await loadConfirmations(db, siteId, window.start, window.end);
    const workOrderIds = [...new Set(
      rawConfirmations
        .map((row: AnyRow) => String(row.work_order_id ?? ""))
        .filter(Boolean),
    )];

    if (workOrderIds.length === 0) {
      return response(req, {
        siteId,
        organisationId,
        site: { id: site.id, name: site.name, timezone: timeZone },
        window,
        reviewPeriods,
        items: [],
        scopeOptions: {
          buildings: [],
          areas: [],
          disciplines: ["mechanical", "electrical", "controls", "facilities"],
        },
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

    const workOrders = await loadInBatches(workOrderIds, async (batch) => {
      const result = await db
        .from("work_orders")
        .select("id,site_id,equipment_id,wo_number,priority,description,work_type,status,assigned_engineer,requested_date,due_date,completed_date,downtime_minutes,mttr_hours,outcome,created_at,updated_at,fault_code,source_system,source_record_key,source_updated_at,order_type_code,order_type_description,maintenance_activity_type_code,maintenance_activity_type_description,priority_code,functional_location_code,maintenance_plant,planner_group,main_work_center,scheduled_start_at,scheduled_finish_at,actual_start_at,actual_finish_at,technical_completion_at,business_completion_at,system_status_codes,user_status_codes,primary_notification_number")
        .eq("site_id", siteId)
        .in("id", batch);
      return result as { data: AnyRow[] | null; error: unknown };
    });

    const equipmentIds = [...new Set(
      workOrders
        .map((row: AnyRow) => String(row.equipment_id ?? ""))
        .filter(Boolean),
    )];

    const [equipment, movements, reservations] = await Promise.all([
      loadInBatches(equipmentIds, async (batch) => {
        const result = await db
          .from("equipment_assets")
          .select("id,site_id,department_id,equipment_code,name,equipment_type,category,area,line,criticality,status,source_system,source_updated_at")
          .eq("site_id", siteId)
          .in("id", batch);
        return result as { data: AnyRow[] | null; error: unknown };
      }),
      loadInBatches(workOrderIds, async (batch) => {
        const result = await db
          .from("work_order_goods_movements")
          .select("id,site_id,work_order_id,component_id,material_document_number,movement_type,posting_date,entry_timestamp,material_number,material_description,quantity,base_unit,debit_credit_indicator,plant_code,storage_location,reservation_number,entered_by,reversal,source_system,source_updated_at")
          .eq("site_id", siteId)
          .in("work_order_id", batch);
        return result as { data: AnyRow[] | null; error: unknown };
      }),
      loadInBatches(workOrderIds, async (batch) => {
        const result = await db
          .from("work_order_material_reservations")
          .select("id,site_id,work_order_id,component_id,material_number,reservation_number,requirement_date,required_quantity,reserved_quantity,withdrawn_quantity,base_unit,storage_location,reservation_status,final_issue,source_system,source_updated_at")
          .eq("site_id", siteId)
          .in("work_order_id", batch);
        return result as { data: AnyRow[] | null; error: unknown };
      }),
    ]);

    const departmentIds = [...new Set(
      equipment
        .map((row: AnyRow) => String(row.department_id ?? ""))
        .filter(Boolean),
    )];
    const departments = await loadInBatches(departmentIds, async (batch) => {
      const result = await db
        .from("departments")
        .select("id,site_id,name")
        .eq("site_id", siteId)
        .in("id", batch);
      return result as { data: AnyRow[] | null; error: unknown };
    });

    const { data: engineers, error: engineersError } = await db
      .from("engineers")
      .select("id,site_id,organisation_id,full_name,discipline")
      .eq("site_id", siteId)
      .eq("organisation_id", organisationId);
    if (engineersError) throw engineersError;

    const engineerIds = (engineers ?? []).map((row: AnyRow) => String(row.id));
    const [identityResult, membershipResult] = await Promise.all([
      db
        .from("engineer_source_identities")
        .select("engineer_id,site_id,source_system,identity_type,source_identity,mapping_status,confidence_score,valid_from,valid_until,verified_at")
        .eq("site_id", siteId)
        .eq("source_system", "SAP")
        .eq("identity_type", "personnel_number")
        .eq("mapping_status", "verified"),
      engineerIds.length
        ? db
            .from("maintenance_shift_team_members")
            .select("team_id,engineer_id,active_from,active_to")
            .in("engineer_id", engineerIds)
        : Promise.resolve({ data: [], error: null }),
    ]);
    if (identityResult.error) throw identityResult.error;
    if (membershipResult.error) throw membershipResult.error;

    const confirmations = attachMaintenanceTeamAttribution({
      confirmations: rawConfirmations,
      engineers: engineers ?? [],
      identities: identityResult.data ?? [],
      memberships: membershipResult.data ?? [],
      teams: teamResult.data ?? [],
    });

    const payload = buildShiftHandoverPayload({
      site,
      window,
      workOrders,
      confirmations,
      equipment,
      departments,
      movements,
      reservations,
    });

    const items = payload.items.map((item: AnyRow) => {
      const activityAt = item.lastActivityAt
        ? new Date(item.lastActivityAt)
        : new Date(new Date(window.end).getTime() - 1);
      const itemShift = shiftContaining(activityAt, timeZone);
      return {
        ...item,
        handoverWindowStart: itemShift.start.toISOString(),
        handoverWindowEnd: itemShift.end.toISOString(),
      };
    });

    return response(req, {
      siteId,
      organisationId,
      ...payload,
      reviewPeriods,
      items,
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
