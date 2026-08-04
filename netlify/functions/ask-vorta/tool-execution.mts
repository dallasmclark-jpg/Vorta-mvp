import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { AskVortaRequest, EvidenceLink, JsonRecord, ToolResult } from "./contracts.mjs";
import { ALL_EQUIPMENT_DECISION_DOMAINS, compactDecisionData, compactEquipmentSkillsDomain, compactShiftCoverData, compactToolDomain, equipmentDecisionDomains, equipmentDecisionFacts } from "./equipment-evidence.mjs";
import { equipmentId, equipmentReferenceMatches, normaliseEquipmentReference, numberValue, records, requiredText, validDateRange } from "./utilities.mjs";

export async function rpcTool(
  supabase: SupabaseClient,
  source: string,
  rpcName: string,
  parameters: JsonRecord = {},
): Promise<ToolResult> {
  const { data, error } = await supabase.rpc(rpcName, parameters);
  if (error) {
    return { source, status: "unavailable", message: error.message };
  }
  if (data === null || data === undefined || (Array.isArray(data) && data.length === 0)) {
    return { source, status: "empty", data: [] };
  }
  return { source, status: "ok", data };
}

export function evidenceLinkForTool(name: string, args: JsonRecord): EvidenceLink | null {
  const equipment = equipmentId(args);
  const equipmentPath = equipment ? `/equipment/${encodeURIComponent(equipment)}` : null;
  const links: Record<string, EvidenceLink> = {
    get_site_risk: { label: "Open site risk", path: "/dashboard", recordType: "risk" },
    get_site_operational_snapshot: { label: "Open operational dashboard", path: "/dashboard", recordType: "risk" },
    get_equipment_decision_pack: { label: "Open equipment register", path: "/equipment", recordType: "equipment" },
    get_equipment_risk: { label: "Open equipment", path: "/equipment", recordType: "equipment" },
    get_shift_cover: { label: "Open Shift Cover", path: "/shift-cover", recordType: "shift" },
    get_shift_handover: { label: "Open Shift Handover", path: "/shift-handover", recordType: "handover" },
    get_contractor_availability: { label: "Open Engineers", path: "/engineers", recordType: "skill" },
    get_site_work_backlog: { label: "Open work plan", path: "/dashboard?focus=work-plan", recordType: "work" },
    get_site_maintenance_plan: { label: "Open maintenance plan", path: "/dashboard?focus=work-plan", recordType: "work" },
    get_site_spares_risk: { label: "Open equipment spares", path: "/equipment", recordType: "spare" },
    get_site_capability_actions: { label: "Open Skills Matrix", path: "/skills-matrix", recordType: "skill" },
  };
  if (links[name]) return links[name];
  if (!equipmentPath) return null;
  if (name === "get_equipment_work") {
    return { label: "Open asset work orders", path: `${equipmentPath}/work-orders`, recordType: "work" };
  }
  if (name === "get_equipment_calibrations") {
    return { label: "Open asset PMs", path: `${equipmentPath}/pms`, recordType: "work" };
  }
  if (name === "get_equipment_skills") {
    return { label: "Open asset skills", path: `${equipmentPath}/skills`, recordType: "skill" };
  }
  if (name === "get_equipment_spares") {
    return { label: "Open asset spares", path: `${equipmentPath}/spares`, recordType: "spare" };
  }
  if (name === "get_equipment_history") {
    return { label: "Open asset history", path: `${equipmentPath}/history`, recordType: "work" };
  }
  if (name === "get_equipment_documents" || name === "search_maintenance_documents") {
    return { label: "Open asset documents", path: `${equipmentPath}/documents`, recordType: "document" };
  }
  if (name === "get_equipment_risk_actions") {
    return { label: "Open asset risk", path: `${equipmentPath}/overview`, recordType: "risk" };
  }
  return null;
}

export async function getSiteEquipmentIndex(
  supabase: SupabaseClient,
  siteId: string,
): Promise<Map<string, JsonRecord>> {
  const { data, error } = await supabase
    .from("equipment_assets")
    .select("id,name,equipment_code,area,criticality")
    .eq("site_id", siteId)
    .limit(500);
  if (error) throw new Error(error.message);
  return new Map(
    (data ?? []).map((item) => {
      const row = item as JsonRecord;
      return [String(row.id), row];
    }),
  );
}

export function assetLabel(asset: JsonRecord | undefined): JsonRecord {
  return {
    equipmentName: typeof asset?.name === "string" ? asset.name : "Unknown asset",
    equipmentCode:
      typeof asset?.equipment_code === "string" ? asset.equipment_code : null,
    area: typeof asset?.area === "string" ? asset.area : null,
    equipmentCriticality:
      typeof asset?.criticality === "string" ? asset.criticality : null,
  };
}

export async function executeTool(
  name: string,
  args: JsonRecord,
  supabase: SupabaseClient,
  request: AskVortaRequest,
): Promise<ToolResult> {
  switch (name) {
    case "get_site_risk":
      return rpcTool(supabase, "Current risk dashboard", "vorta_get_operational_dashboard_snapshot");

    case "get_site_ranked_actions":
      return rpcTool(
        supabase,
        "Site operational-value ranking",
        "vorta_get_ranked_operational_actions",
        { p_limit: 10 },
      );

    case "get_site_operational_snapshot": {
      const domainDefinitions: Array<[string, Promise<ToolResult>]> = [
        ["siteRisk", executeTool("get_site_risk", {}, supabase, request)],
        ["rankedActions", executeTool("get_site_ranked_actions", {}, supabase, request)],
        ["workBacklog", executeTool("get_site_work_backlog", {}, supabase, request)],
        ["sparesRisk", executeTool("get_site_spares_risk", {}, supabase, request)],
        ["capability", executeTool("get_site_capability_actions", {}, supabase, request)],
        ["shiftHandover", executeTool("get_shift_handover", {}, supabase, request)],
      ];
      const domainEntries = await Promise.all(
        domainDefinitions.map(async ([key, pending]) => [
          key,
          compactToolDomain(await pending),
        ] as const),
      );
      const domains = Object.fromEntries(domainEntries) as Record<string, JsonRecord>;
      const statuses = Object.values(domains).map((item) => item.status);
      const status: ToolResult["status"] = statuses.some((item) => item === "ok")
        ? "ok"
        : statuses.some((item) => item === "empty")
          ? "empty"
          : "unavailable";
      return {
        source: "Cross-domain operational decision snapshot",
        status,
        data: {
          generatedAt: new Date().toISOString(),
          domains,
          caveat:
            "This snapshot combines decision evidence from several Vorta sources. Use a specialist tool as well when the question needs a date range, a named shift, a named person or one exact equipment record.",
        },
      };
    }

    case "get_equipment_risk": {
      const result = await rpcTool(
        supabase,
        "Equipment risk register",
        "vorta_get_demo_equipment_risk_list",
      );
      const query = typeof args.query === "string" ? args.query.trim() : "";
      if (!query || result.status !== "ok" || !Array.isArray(result.data)) return result;
      const rows = result.data.filter((item) => {
        const row = item as JsonRecord;
        return [row.equipment_name, row.equipment_code, row.area]
          .some((value) => equipmentReferenceMatches(value, query));
      });
      return { ...result, status: rows.length ? "ok" : "empty", data: rows };
    }


    case "get_equipment_decision_pack": {
      const query = requiredText(args.query, 300);
      if (!query) {
        return {
          source: "Equipment cross-domain decision pack",
          status: "unavailable",
          message: "A natural-language equipment name or code is required.",
        };
      }
      const riskResult = await executeTool(
        "get_equipment_risk",
        { query },
        supabase,
        request,
      );
      const matches = records(riskResult.data);
      if (riskResult.status !== "ok" || matches.length === 0) {
        return {
          source: "Equipment cross-domain decision pack",
          status: riskResult.status,
          data: { query, matches: compactDecisionData(matches) },
          message: riskResult.message ?? "No authorised equipment matched the reference.",
        };
      }
      const normalisedQuery = normaliseEquipmentReference(query);
      const exactMatch = matches.find((item) =>
        [item.equipment_name, item.equipment_code, item.name, item.code]
          .some((value) => {
            const normalisedCandidate = normaliseEquipmentReference(value);
            return Boolean(
              normalisedCandidate &&
                (normalisedCandidate === normalisedQuery ||
                  normalisedQuery.includes(normalisedCandidate)),
            );
          }),
      );
      const selected = exactMatch ?? (matches.length === 1 ? matches[0] : null);
      if (!selected) {
        return {
          source: "Equipment cross-domain decision pack",
          status: "ok",
          data: {
            query,
            ambiguous: true,
            matches: compactDecisionData(matches.slice(0, 8)),
            instruction:
              "Several authorised assets match. Ask one focused clarification using the displayed name or equipment code; do not choose an asset silently.",
          },
        };
      }
      const equipmentIdValue = [
        selected.equipment_id,
        selected.equipmentId,
        selected.id,
      ].find((value) => typeof value === "string" && value.trim().length > 0);
      if (typeof equipmentIdValue !== "string") {
        return {
          source: "Equipment cross-domain decision pack",
          status: "unavailable",
          data: { query, equipment: compactDecisionData(selected) },
          message: "The matched equipment record did not expose its authorised identifier.",
        };
      }
      const domainNames = equipmentDecisionDomains(request.question);
      const domainEntries = await Promise.all(
        domainNames.map(async (toolName) => {
          const result = await executeTool(
            toolName,
            { equipment_id: equipmentIdValue },
            supabase,
            request,
          );
          return [
            toolName,
            toolName === "get_equipment_skills"
              ? compactEquipmentSkillsDomain(result)
              : compactToolDomain(result),
          ] as const;
        }),
      );
      const domains = Object.fromEntries(domainEntries) as Record<string, JsonRecord>;
      const documentSearchRequested =
        /\b(?:fault|diagnos|cause(?:d|s)?|root cause|excursion|credible|reading|bias|document|manual|guide|approved|procedure|drawing|history|evidence|verify|verification|release|before acting)\b/i.test(
          request.question,
        );
      if (documentSearchRequested) {
        domains.search_maintenance_documents = compactToolDomain(
          await executeTool(
            "search_maintenance_documents",
            {
              equipment_id: equipmentIdValue,
              query: request.question,
              limit: 8,
            },
            supabase,
            request,
          ),
        );
      }
      const coveredTools = [
        "get_equipment_risk",
        ...domainNames,
        ...(documentSearchRequested ? ["search_maintenance_documents"] : []),
      ];
      return {
        source: "Equipment cross-domain decision pack",
        status: "ok",
        data: {
          query,
          equipment: compactDecisionData(selected),
          coveredTools,
          includedDomains: domainNames,
          omittedDomains: ALL_EQUIPMENT_DECISION_DOMAINS.filter(
            (domain) => !domainNames.includes(domain),
          ),
          decisionFacts: equipmentDecisionFacts(selected, domains, request.question),
          domains,
          caveat: documentSearchRequested
            ? "Approved maintenance knowledge search was included for this technical evidence question."
            : "The pack contains the authorised equipment risk, work, capability, spares, history, risk-action and document-register domains.",
        },
      };
    }

    case "get_shift_cover": {
      const startDate = args.start_date;
      const endDate = args.end_date;
      if (!validDateRange(startDate, endDate)) {
        return {
          source: "Shift cover calendar, exceptions and skills",
          status: "unavailable",
          message: "Dates must use YYYY-MM-DD and cover no more than 31 days.",
        };
      }
      const result = await rpcTool(
        supabase,
        "Shift Cover decision pack",
        "vorta_get_shift_cover_ai_brief",
        {
          p_site_id: request.siteId,
          p_start_date: startDate,
          p_end_date: endDate,
        },
      );
      return result.status === "ok"
        ? { ...result, data: compactShiftCoverData(result.data) }
        : result;
    }

    case "get_shift_handover": {
      const latestResult = await supabase
        .from("work_order_confirmations")
        .select("confirmation_timestamp,created_at")
        .eq("site_id", request.siteId)
        .eq("reversal", false)
        .order("confirmation_timestamp", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (latestResult.error) {
        return {
          source: "Latest shift handover and SAP confirmations",
          status: "unavailable",
          message: latestResult.error.message,
        };
      }
      const anchorValue =
        latestResult.data?.confirmation_timestamp ?? latestResult.data?.created_at;
      if (!anchorValue) {
        return {
          source: "Latest shift handover and SAP confirmations",
          status: "empty",
          data: { summary: { itemCount: 0 }, items: [] },
        };
      }
      const anchor = new Date(anchorValue);
      const windowEnd = new Date(anchor.getTime() + 1).toISOString();
      const windowStart = new Date(anchor.getTime() - 12 * 60 * 60 * 1_000).toISOString();
      const confirmationResult = await supabase
        .from("work_order_confirmations")
        .select(
          "id,work_order_id,confirmation_number,confirmation_text,confirmed_by,work_center,confirmation_timestamp,actual_work,work_unit,actual_duration,duration_unit,final_confirmation,source_system",
        )
        .eq("site_id", request.siteId)
        .eq("reversal", false)
        .gte("confirmation_timestamp", windowStart)
        .lte("confirmation_timestamp", windowEnd)
        .order("confirmation_timestamp", { ascending: false })
        .limit(150);
      if (confirmationResult.error) {
        return {
          source: "Latest shift handover and SAP confirmations",
          status: "unavailable",
          message: confirmationResult.error.message,
        };
      }
      const confirmations = confirmationResult.data ?? [];
      const workOrderIds = [
        ...new Set(confirmations.map((item) => String(item.work_order_id)).filter(Boolean)),
      ];
      const workResult = workOrderIds.length
        ? await supabase
            .from("work_orders")
            .select(
              "id,equipment_id,wo_number,priority,description,work_type,status,assigned_engineer,outcome,downtime_minutes,fault_code,system_status_codes,user_status_codes,primary_notification_number,updated_at",
            )
            .eq("site_id", request.siteId)
            .in("id", workOrderIds)
        : { data: [], error: null };
      if (workResult.error) {
        return {
          source: "Latest shift handover and SAP confirmations",
          status: "unavailable",
          message: workResult.error.message,
        };
      }
      const equipment = await getSiteEquipmentIndex(supabase, request.siteId);
      const orderMap = new Map((workResult.data ?? []).map((item) => [String(item.id), item]));
      const grouped = new Map<string, typeof confirmations>();
      confirmations.forEach((confirmation) => {
        const id = String(confirmation.work_order_id);
        grouped.set(id, [...(grouped.get(id) ?? []), confirmation]);
      });
      const items = [...grouped.entries()].map(([workOrderId, orderConfirmations]) => {
        const order = orderMap.get(workOrderId);
        const latest = orderConfirmations[0];
        const evidence = `${order?.status ?? ""} ${order?.outcome ?? ""} ${order?.assigned_engineer ?? ""} ${latest?.confirmation_text ?? ""}`.toLowerCase();
        const contractor = /contractor|external|vendor|oem support|specialist/.test(evidence);
        const waitingOnParts = /waiting parts|waiting on parts|awaiting spare|awaiting material|material shortage/.test(evidence);
        const temporary = /temporary|temporarily|running with restriction|restored pending/.test(evidence);
        const complete =
          Boolean(latest?.final_confirmation) ||
          /completed|closed|teco|returned to service/.test(evidence);
        return {
          workOrderNumber: order?.wo_number,
          notificationNumber: order?.primary_notification_number,
          ...assetLabel(equipment.get(String(order?.equipment_id))),
          priority: order?.priority,
          description: order?.description,
          faultCode: order?.fault_code,
          assignedEngineer: order?.assigned_engineer ?? latest?.confirmed_by,
          latestConfirmation: latest?.confirmation_text,
          confirmedBy: latest?.confirmed_by,
          lastActivityAt: latest?.confirmation_timestamp,
          actualWork: latest?.actual_work,
          workUnit: latest?.work_unit,
          downtimeMinutes: order?.downtime_minutes,
          status: waitingOnParts
            ? "waiting_on_parts"
            : contractor
              ? "external_contractor"
              : temporary
                ? "temporarily_restored"
                : complete
                  ? "completed"
                  : "ongoing",
          contractor,
          nextAction: waitingOnParts
            ? "Confirm the required material, reservation and expected issue time."
            : contractor
              ? "Confirm contractor attendance, site access and agreed technical scope."
              : temporary
                ? "Monitor the next operating cycle and complete the permanent repair plan."
                : complete
                  ? "Confirm the repair remains stable on the incoming shift."
                  : "Review the latest confirmation and continue the outstanding scope.",
        };
      });
      return {
        source: "Latest shift handover and SAP confirmations",
        status: items.length ? "ok" : "empty",
        data: {
          window: { start: windowStart, end: windowEnd },
          summary: {
            itemCount: items.length,
            completedCount: items.filter((item) => item.status === "completed").length,
            ongoingCount: items.filter((item) => item.status !== "completed").length,
            waitingOnPartsCount: items.filter((item) => item.status === "waiting_on_parts").length,
            contractorCount: items.filter((item) => item.contractor).length,
          },
          items: items.slice(0, 30),
        },
      };
    }

    case "get_contractor_availability": {
      const engineerResult = await supabase
        .from("engineers")
        .select(
          "id,full_name,employment_type,discipline,availability_status,verified,shift_pattern,source_updated_at",
        )
        .eq("site_id", request.siteId)
        .ilike("employment_type", "%contract%")
        .order("full_name")
        .limit(100);
      if (engineerResult.error) {
        return {
          source: "Contractor availability and validated capability",
          status: "unavailable",
          message: engineerResult.error.message,
        };
      }
      const engineers = engineerResult.data ?? [];
      const engineerIds = engineers.map((item) => item.id);
      const [availabilityResult, skillsResult] = await Promise.all([
        engineerIds.length
          ? supabase
              .from("engineer_availability")
              .select(
                "engineer_id,availability_status,available_now,available_from,available_until,on_shift,on_call,remote_support_available,onsite_support_available,phone_available,video_available,current_location,notes,last_updated_at",
              )
              .eq("site_id", request.siteId)
              .in("engineer_id", engineerIds)
          : Promise.resolve({ data: [], error: null }),
        engineerIds.length
          ? supabase
              .from("engineer_skills")
              .select("engineer_id,validated_rating,verification_status,skills(name,category)")
              .in("engineer_id", engineerIds)
              .gte("validated_rating", 3)
              .limit(300)
          : Promise.resolve({ data: [], error: null }),
      ]);
      const detailError = availabilityResult.error ?? skillsResult.error;
      if (detailError) {
        return {
          source: "Contractor availability and validated capability",
          status: "unavailable",
          message: detailError.message,
        };
      }
      const availability = new Map(
        (availabilityResult.data ?? []).map((item) => [String(item.engineer_id), item]),
      );
      const skills = new Map<string, unknown[]>();
      (skillsResult.data ?? []).forEach((item) => {
        const id = String(item.engineer_id);
        skills.set(id, [...(skills.get(id) ?? []), item]);
      });
      const rows = engineers.map((engineer) => {
        const availabilityRow = availability.get(String(engineer.id));
        return {
          engineerName: engineer.full_name,
          discipline: engineer.discipline,
          verified: engineer.verified,
          employmentType: engineer.employment_type,
          availabilityStatus:
            availabilityRow?.availability_status ?? engineer.availability_status ?? "not_recorded",
          availableNow: availabilityRow?.available_now ?? null,
          availableFrom: availabilityRow?.available_from ?? null,
          availableUntil: availabilityRow?.available_until ?? null,
          onShift: availabilityRow?.on_shift ?? null,
          onCall: availabilityRow?.on_call ?? null,
          remoteSupport: availabilityRow?.remote_support_available ?? null,
          onsiteSupport: availabilityRow?.onsite_support_available ?? null,
          location: availabilityRow?.current_location ?? null,
          availabilityUpdatedAt: availabilityRow?.last_updated_at ?? null,
          validatedSkills: (skills.get(String(engineer.id)) ?? []).slice(0, 12),
        };
      });
      return {
        source: "Contractor availability and validated capability",
        status: rows.length ? "ok" : "empty",
        data: {
          summary: {
            contractorCount: rows.length,
            recordedAvailableNowCount: rows.filter((item) => item.availableNow === true).length,
            missingCurrentAvailabilityCount: rows.filter(
              (item) => item.availableNow === null,
            ).length,
          },
          contractors: rows,
          caveat:
            "Recorded availability is evidence only; confirm acceptance, access, certification and fatigue controls before assignment.",
        },
      };
    }

    case "get_site_work_backlog": {
      const [equipment, workResult] = await Promise.all([
        getSiteEquipmentIndex(supabase, request.siteId),
        supabase
          .from("work_orders")
          .select(
            "equipment_id,wo_number,priority,description,work_type,status,assigned_engineer,requested_date,due_date,is_overdue,fault_code,order_type_code,order_type_description,scheduled_start_at,scheduled_finish_at,updated_at",
          )
          .eq("site_id", request.siteId)
          .limit(300),
      ]);
      if (workResult.error) {
        return {
          source: "Site maintenance work backlog",
          status: "unavailable",
          message: workResult.error.message,
        };
      }
      const closed = /completed|closed|cancel|teco|business complete/i;
      const rows = (workResult.data ?? [])
        .filter((item) => !closed.test(String(item.status ?? "")))
        .map((item) => ({
          ...assetLabel(equipment.get(String(item.equipment_id))),
          workOrderNumber: item.wo_number,
          priority: item.priority,
          description: item.description,
          workType: item.work_type,
          status: item.status,
          assignedEngineer: item.assigned_engineer,
          requestedDate: item.requested_date,
          dueDate: item.due_date,
          overdue: Boolean(item.is_overdue),
          faultCode: item.fault_code,
          orderTypeCode: item.order_type_code,
          orderTypeDescription: item.order_type_description,
          scheduledStartAt: item.scheduled_start_at,
          scheduledFinishAt: item.scheduled_finish_at,
          updatedAt: item.updated_at,
        }))
        .sort((left, right) => {
          const overdueDifference = Number(right.overdue) - Number(left.overdue);
          if (overdueDifference) return overdueDifference;
          const priorities = ["critical", "high", "medium", "low"];
          return (
            priorities.indexOf(String(left.priority).toLowerCase()) -
            priorities.indexOf(String(right.priority).toLowerCase())
          );
        });
      return {
        source: "Site maintenance work backlog",
        status: rows.length ? "ok" : "empty",
        data: {
          summary: {
            openCount: rows.length,
            overdueCount: rows.filter((item) => item.overdue).length,
            unassignedCount: rows.filter((item) => !item.assignedEngineer).length,
            criticalOrHighCount: rows.filter((item) =>
              /critical|high/i.test(String(item.priority)),
            ).length,
          },
          workOrders: rows.slice(0, 35),
        },
      };
    }

    case "get_site_maintenance_plan": {
      const startDate = args.start_date;
      const endDate = args.end_date;
      if (!validDateRange(startDate, endDate)) {
        return {
          source: "Site PM and calibration plan",
          status: "unavailable",
          message: "Dates must use YYYY-MM-DD and cover no more than 31 days.",
        };
      }
      const [equipment, planResult] = await Promise.all([
        getSiteEquipmentIndex(supabase, request.siteId),
        supabase
          .from("preventive_maintenance")
          .select(
            "equipment_id,pm_number,title,pm_type,estimated_duration_minutes,last_completed_date,next_due_date,status,assigned_engineer,completion_percentage,criticality,procedure_ref,calibration_point,tolerance_specification,last_calibration_result,certificate_reference",
          )
          .eq("site_id", request.siteId)
          .gte("next_due_date", startDate as string)
          .lte("next_due_date", endDate as string)
          .order("next_due_date")
          .limit(200),
      ]);
      if (planResult.error) {
        return {
          source: "Site PM and calibration plan",
          status: "unavailable",
          message: planResult.error.message,
        };
      }
      const rows = (planResult.data ?? []).map((item) => ({
        ...assetLabel(equipment.get(String(item.equipment_id))),
        pmNumber: item.pm_number,
        title: item.title,
        pmType: item.pm_type,
        estimatedDurationMinutes: item.estimated_duration_minutes,
        lastCompletedDate: item.last_completed_date,
        nextDueDate: item.next_due_date,
        status: item.status,
        assignedEngineer: item.assigned_engineer,
        completionPercentage: item.completion_percentage,
        criticality: item.criticality,
        procedureReference: item.procedure_ref,
        calibrationPoint: item.calibration_point,
        tolerance: item.tolerance_specification,
        lastCalibrationResult: item.last_calibration_result,
        certificateReference: item.certificate_reference,
      }));
      return {
        source: "Site PM and calibration plan",
        status: rows.length ? "ok" : "empty",
        data: {
          summary: {
            dueCount: rows.length,
            unassignedCount: rows.filter((item) => !item.assignedEngineer).length,
            estimatedHours: Math.round(
              rows.reduce(
                (total, item) => total + numberValue(item.estimatedDurationMinutes),
                0,
              ) / 6,
            ) / 10,
            calibrationCount: rows.filter((item) =>
              /calibration/i.test(`${item.pmType ?? ""} ${item.calibrationPoint ?? ""}`),
            ).length,
          },
          plannedMaintenance: rows,
        },
      };
    }

    case "get_site_spares_risk": {
      const [equipment, spareResult] = await Promise.all([
        getSiteEquipmentIndex(supabase, request.siteId),
        supabase
          .from("equipment_components")
          .select(
            "equipment_id,component_name,component_code,quantity_available,quantity_target,minimum_quantity,availability_status,vendor_name,maker_name,storage_location,criticality,unit_cost,lead_days,updated_at",
          )
          .eq("site_id", request.siteId)
          .limit(500),
      ]);
      if (spareResult.error) {
        return {
          source: "Site critical spares exposure",
          status: "unavailable",
          message: spareResult.error.message,
        };
      }
      const rows = (spareResult.data ?? [])
        .map((item) => {
          const available = numberValue(item.quantity_available);
          const minimum = numberValue(item.minimum_quantity);
          const target = numberValue(item.quantity_target);
          const minimumShortfall = Math.max(minimum - available, 0);
          const targetShortfall = Math.max(target - available, 0);
          const criticality = String(item.criticality ?? "").toLowerCase();
          const outOfStock =
            available <= 0 || /out.?of.?stock|unavailable/i.test(String(item.availability_status));
          const riskRank =
            (outOfStock ? 1000 : 0) +
            (minimumShortfall > 0 ? 500 : 0) +
            (criticality === "critical" ? 200 : criticality === "high" ? 100 : 0) +
            numberValue(item.lead_days);
          return {
            ...assetLabel(equipment.get(String(item.equipment_id))),
            componentName: item.component_name,
            componentCode: item.component_code,
            availableQuantity: available,
            minimumQuantity: minimum,
            targetQuantity: target,
            minimumShortfall,
            targetShortfall,
            outOfStock,
            availabilityStatus: item.availability_status,
            componentCriticality: item.criticality,
            leadDays: item.lead_days,
            vendor: item.vendor_name,
            maker: item.maker_name,
            storageLocation: item.storage_location,
            unitCost: item.unit_cost,
            updatedAt: item.updated_at,
            riskRank,
          };
        })
        .filter(
          (item) =>
            item.outOfStock ||
            item.minimumShortfall > 0 ||
            /critical|high/i.test(String(item.componentCriticality)),
        )
        .sort((left, right) => right.riskRank - left.riskRank);
      return {
        source: "Site critical spares exposure",
        status: rows.length ? "ok" : "empty",
        data: {
          summary: {
            riskItemCount: rows.length,
            outOfStockCount: rows.filter((item) => item.outOfStock).length,
            belowMinimumCount: rows.filter((item) => item.minimumShortfall > 0).length,
            longLeadCount: rows.filter((item) => numberValue(item.leadDays) >= 30).length,
          },
          spares: rows.slice(0, 40).map(({ riskRank: _riskRank, ...item }) => item),
        },
      };
    }

    case "get_site_capability_actions":
      return rpcTool(
        supabase,
        "Site capability risk actions",
        "vorta_get_capability_reconciliation_report",
        { p_site_id: request.siteId, p_limit: 15 },
      );

    case "get_equipment_work":
    case "get_equipment_calibrations":
    case "get_equipment_skills":
    case "get_equipment_history":
    case "get_equipment_documents": {
      const id = equipmentId(args);
      if (!id) {
        return { source: name, status: "unavailable", message: "A valid equipment ID is required." };
      }
      const mappings: Record<string, [string, string]> = {
        get_equipment_work: ["Equipment work orders and PM links", "vorta_get_equipment_work_items"],
        get_equipment_calibrations: ["Equipment calibrations", "vorta_get_equipment_calibrations"],
        get_equipment_skills: ["Equipment skills and engineer resilience", "vorta_get_equipment_skills_showcase"],
        get_equipment_history: ["Equipment maintenance history", "vorta_get_equipment_history"],
        get_equipment_documents: ["Equipment document register", "vorta_get_equipment_documents"],
      };
      const [source, rpcName] = mappings[name];
      return rpcTool(supabase, source, rpcName, { p_equipment_id: id });
    }

    case "get_equipment_spares": {
      const id = equipmentId(args);
      if (!id) {
        return {
          source: "Equipment spares inventory",
          status: "unavailable",
          message: "A valid equipment ID is required.",
        };
      }
      const { data, error } = await supabase
        .from("equipment_components")
        .select(
          "component_name,component_code,quantity_available,quantity_target,minimum_quantity,availability_status,vendor_name,maker_name,storage_location,criticality,unit_cost,lead_days,updated_at",
        )
        .eq("site_id", request.siteId)
        .eq("equipment_id", id)
        .order("component_name")
        .limit(100);
      if (error) {
        return { source: "Equipment spares inventory", status: "unavailable", message: error.message };
      }
      return {
        source: "Equipment spares inventory",
        status: data?.length ? "ok" : "empty",
        data: data ?? [],
      };
    }

    case "get_equipment_risk_actions": {
      const id = equipmentId(args);
      if (!id) {
        return {
          source: "Equipment calculated risk-reduction actions",
          status: "unavailable",
          message: "A valid equipment ID is required.",
        };
      }
      return rpcTool(
        supabase,
        "Equipment operational-value ranking",
        "vorta_get_ranked_operational_actions",
        { p_equipment_id: id, p_limit: 10 },
      );
    }

    case "search_maintenance_documents": {
      const id = equipmentId(args);
      const query = requiredText(args.query, 1_000);
      const limit = Number(args.limit);
      if (!id || !query || !Number.isInteger(limit) || limit < 1 || limit > 8) {
        return {
          source: "Approved maintenance document search",
          status: "unavailable",
          message: "Equipment, query and a result limit from 1 to 8 are required.",
        };
      }
      return rpcTool(
        supabase,
        "Approved maintenance document search",
        "vorta_search_equipment_knowledge",
        { p_equipment_id: id, p_query: query, p_limit: limit },
      );
    }

    default:
      return { source: name, status: "unavailable", message: "This tool is not available." };
  }
}
