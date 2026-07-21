import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { context, preflight, response } from "./auth.ts";

const CLOSED_STATUSES = new Set(["closed", "resolved", "completed"]);
const MATCHED_STATUSES = new Set(["matched", "accepted", "in_progress"]);

function text(value: unknown, fallback = "Not recorded"): string {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function nullableText(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function numberValue(value: unknown): number {
  const result = Number(value ?? 0);
  return Number.isFinite(result) ? result : 0;
}

Deno.serve(async (req: Request) => {
  const early = preflight(req);
  if (early) return early;
  if (!["GET", "POST"].includes(req.method)) {
    return response(req, { error: "Method not allowed" }, 405);
  }

  try {
    const { db, siteId, organisationId } = await context(req);

    const { data: requestRows, error: requestError } = await db
      .from("support_requests")
      .select("id,department_id,equipment_id,request_title,issue_description,issue_type,priority,production_stopped,estimated_downtime_minutes,required_support_type,preferred_contact_method,support_scope,status,opened_at,matched_at,closed_at,resolution_summary")
      .eq("site_id", siteId)
      .eq("organisation_id", organisationId)
      .order("opened_at", { ascending: false });
    if (requestError) throw requestError;

    const requestIds = (requestRows ?? []).map((row) => row.id as string);
    const equipmentIds = Array.from(new Set(
      (requestRows ?? []).map((row) => row.equipment_id as string | null).filter(Boolean),
    )) as string[];
    const departmentIds = Array.from(new Set(
      (requestRows ?? []).map((row) => row.department_id as string | null).filter(Boolean),
    )) as string[];

    const [equipmentResult, departmentResult, skillResult, matchResult, sessionResult, reportResult] = await Promise.all([
      equipmentIds.length
        ? db.from("equipment_assets").select("id,name").in("id", equipmentIds).eq("site_id", siteId)
        : Promise.resolve({ data: [], error: null }),
      departmentIds.length
        ? db.from("departments").select("id,name").in("id", departmentIds).eq("site_id", siteId)
        : Promise.resolve({ data: [], error: null }),
      requestIds.length
        ? db.from("support_request_skills").select("support_request_id,skill_name").in("support_request_id", requestIds)
        : Promise.resolve({ data: [], error: null }),
      requestIds.length
        ? db.from("support_request_matches").select("id,support_request_id,status").in("support_request_id", requestIds)
        : Promise.resolve({ data: [], error: null }),
      requestIds.length
        ? db.from("support_sessions").select("id,support_request_id,status,created_at").in("support_request_id", requestIds).order("created_at", { ascending: false })
        : Promise.resolve({ data: [], error: null }),
      requestIds.length
        ? db.from("support_reports").select("id,support_request_id,report_title,created_at").in("support_request_id", requestIds).order("created_at", { ascending: false })
        : Promise.resolve({ data: [], error: null }),
    ]);

    for (const result of [equipmentResult, departmentResult, skillResult, matchResult, sessionResult, reportResult]) {
      if (result.error) throw result.error;
    }

    const equipmentById = new Map(
      (equipmentResult.data ?? []).map((row) => [row.id as string, text(row.name, "Equipment name unavailable")]),
    );
    const departmentById = new Map(
      (departmentResult.data ?? []).map((row) => [row.id as string, text(row.name, "Department name unavailable")]),
    );

    const skillsByRequest = new Map<string, string[]>();
    for (const row of skillResult.data ?? []) {
      const requestId = row.support_request_id as string;
      const values = skillsByRequest.get(requestId) ?? [];
      const skillName = nullableText(row.skill_name);
      if (skillName && !values.includes(skillName)) values.push(skillName);
      skillsByRequest.set(requestId, values);
    }

    const matchCountByRequest = new Map<string, number>();
    for (const row of matchResult.data ?? []) {
      const requestId = row.support_request_id as string;
      matchCountByRequest.set(requestId, (matchCountByRequest.get(requestId) ?? 0) + 1);
    }

    const sessionCountByRequest = new Map<string, number>();
    const latestSessionByRequest = new Map<string, string>();
    for (const row of sessionResult.data ?? []) {
      const requestId = row.support_request_id as string;
      sessionCountByRequest.set(requestId, (sessionCountByRequest.get(requestId) ?? 0) + 1);
      if (!latestSessionByRequest.has(requestId)) {
        latestSessionByRequest.set(requestId, text(row.status, "unknown"));
      }
    }

    const reportCountByRequest = new Map<string, number>();
    const latestReportByRequest = new Map<string, string>();
    for (const row of reportResult.data ?? []) {
      const requestId = row.support_request_id as string;
      reportCountByRequest.set(requestId, (reportCountByRequest.get(requestId) ?? 0) + 1);
      if (!latestReportByRequest.has(requestId)) {
        latestReportByRequest.set(requestId, text(row.report_title, "Support report"));
      }
    }

    const requests = (requestRows ?? []).map((row) => ({
      id: row.id as string,
      requestTitle: text(row.request_title),
      issueDescription: nullableText(row.issue_description),
      issueType: nullableText(row.issue_type),
      priority: text(row.priority, "Unspecified"),
      productionStopped: row.production_stopped === true,
      estimatedDowntimeMinutes: row.estimated_downtime_minutes === null
        ? null
        : numberValue(row.estimated_downtime_minutes),
      requiredSupportType: nullableText(row.required_support_type),
      preferredContactMethod: nullableText(row.preferred_contact_method),
      supportScope: nullableText(row.support_scope),
      status: text(row.status, "unknown"),
      openedAt: text(row.opened_at, new Date(0).toISOString()),
      matchedAt: nullableText(row.matched_at),
      closedAt: nullableText(row.closed_at),
      resolutionSummary: nullableText(row.resolution_summary),
      equipmentName: row.equipment_id ? equipmentById.get(row.equipment_id as string) ?? null : null,
      departmentName: row.department_id ? departmentById.get(row.department_id as string) ?? null : null,
      skillNames: skillsByRequest.get(row.id as string) ?? [],
      matchCount: matchCountByRequest.get(row.id as string) ?? 0,
      sessionCount: sessionCountByRequest.get(row.id as string) ?? 0,
      reportCount: reportCountByRequest.get(row.id as string) ?? 0,
      latestSessionStatus: latestSessionByRequest.get(row.id as string) ?? null,
      latestReportTitle: latestReportByRequest.get(row.id as string) ?? null,
    }));

    const normalisedStatus = (value: string) => value.trim().toLowerCase();

    return response(req, {
      siteId,
      organisationId,
      generatedAt: new Date().toISOString(),
      stats: {
        totalRequests: requests.length,
        openRequests: requests.filter((row) => !CLOSED_STATUSES.has(normalisedStatus(row.status))).length,
        matchedRequests: requests.filter((row) => MATCHED_STATUSES.has(normalisedStatus(row.status))).length,
        closedRequests: requests.filter((row) => CLOSED_STATUSES.has(normalisedStatus(row.status))).length,
        productionStoppedRequests: requests.filter((row) => row.productionStopped).length,
        sessionCount: requests.reduce((total, row) => total + row.sessionCount, 0),
        reportCount: requests.reduce((total, row) => total + row.reportCount, 0),
      },
      requests,
    });
  } catch (error) {
    const status = typeof error === "object" && error && "status" in error
      ? Number((error as { status?: unknown }).status) || 500
      : 500;
    const message = error instanceof Error
      ? error.message
      : typeof error === "object" && error && "message" in error
        ? String((error as { message?: unknown }).message)
        : "Support evidence could not be loaded";
    console.error("support-evidence-data", error);
    return response(req, { error: message }, status);
  }
});
