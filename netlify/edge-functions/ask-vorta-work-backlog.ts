type JsonRecord = Record<string, unknown>;

type EdgeContext = {
  next(request?: Request): Promise<Response>;
};

declare const Netlify: {
  env: {
    get(name: string): string | undefined;
  };
};

const RATE_LIMIT_WINDOW_MINUTES = 5;
const RATE_LIMIT_REQUESTS = 12;
const OPEN_WORK_PATTERN = /\b(?:backlog|open work|overdue work|unassigned work|work orders?)\b/i;
const CAPABILITY_PATTERN = /\b(?:one person deep|only one person|single[- ]person|single point|single[- ]point|backup sme|developed as backup|develop as backup)\b/i;
const EQUIPMENT_SPARE_FOLLOW_UP_PATTERN = /\b(?:(?:what|which) (?:spare|part)|(?:spare|part) (?:blocks?|blocking|stops?|stopping|holds?|holding)|what is (?:blocking|stopping|holding))\b/i;
const ACTIONABLE_EQUIPMENT_SPARE_FOLLOW_UP_PATTERN = /\b(?:fix(?:ing|ed)?|repair(?:ing|ed)?|properly|permanent|replace|replacement|required action|what (?:do|should))\b/i;
const MIXED_DECISION_PATTERN = /\b(?:shift|cover|rota|pm|calibration|spare|stock|part|contractor|handover|history|document|manual)\b/i;
const EQUIPMENT_CODE_PATTERN = /\b[A-Z]{2,}(?:-[A-Z0-9]+)*-?\d+[A-Z0-9-]*\b/;
const EQUIPMENT_REFERENCE_PATTERN = /\b[A-Z]{2,}(?:-[A-Z0-9]+)*-?\d+[A-Z0-9-]*\b/g;

function jsonResponse(body: unknown, status = 200): Response {
  return Response.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

function records(value: unknown): JsonRecord[] {
  return Array.isArray(value)
    ? value.filter(
        (item): item is JsonRecord =>
          Boolean(item) && typeof item === "object" && !Array.isArray(item),
      )
    : [];
}

function numberValue(value: unknown): number {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

function requiredText(value: unknown, maximumLength: number): string | null {
  if (typeof value !== "string") return null;
  const text = value.trim();
  return text && text.length <= maximumLength ? text : null;
}

function isFactualBacklogRequest(body: JsonRecord): boolean {
  const question = requiredText(body.question, 2_000);
  const history = Array.isArray(body.history) ? body.history : [];
  if (!question || history.length > 0) return false;
  if (!OPEN_WORK_PATTERN.test(question)) return false;
  if (MIXED_DECISION_PATTERN.test(question.replace(OPEN_WORK_PATTERN, ""))) return false;
  if (EQUIPMENT_CODE_PATTERN.test(question)) return false;
  return true;
}

function isCapabilityRequest(body: JsonRecord): boolean {
  const question = requiredText(body.question, 2_000);
  const history = Array.isArray(body.history) ? body.history : [];
  if (!question || history.length > 0) return false;
  if (!CAPABILITY_PATTERN.test(question)) return false;
  if (MIXED_DECISION_PATTERN.test(question)) return false;
  if (EQUIPMENT_CODE_PATTERN.test(question)) return false;
  return true;
}

function equipmentReferenceFromRequest(body: JsonRecord): string | null {
  const history = Array.isArray(body.history) ? body.history : [];
  const historyText = history
    .map((item) =>
      item && typeof item === "object" && !Array.isArray(item)
        ? requiredText((item as JsonRecord).content, 4_000) || ""
        : "",
    )
    .join(" ");
  const question = requiredText(body.question, 2_000) || "";
  const matches = `${historyText} ${question}`.toUpperCase().match(EQUIPMENT_REFERENCE_PATTERN);
  return matches?.at(-1) || null;
}

function isEquipmentSpareFollowUp(body: JsonRecord): boolean {
  const question = requiredText(body.question, 2_000);
  const history = Array.isArray(body.history) ? body.history : [];
  if (!question || history.length === 0) return false;
  if (!EQUIPMENT_SPARE_FOLLOW_UP_PATTERN.test(question)) return false;
  if (ACTIONABLE_EQUIPMENT_SPARE_FOLLOW_UP_PATTERN.test(question)) return false;
  return Boolean(equipmentReferenceFromRequest(body));
}

function componentConstraintScore(component: JsonRecord): number {
  const available = numberValue(component.quantity_available);
  const minimum = numberValue(component.minimum_quantity);
  const target = numberValue(component.quantity_target);
  const shortfall = Math.max(minimum, target) - available;
  const availability = String(component.availability_status ?? "").toLowerCase();
  const criticality = String(component.criticality ?? "").toLowerCase();
  return (
    (availability.includes("out") ? 100 : 0) +
    (availability.includes("low") ? 60 : 0) +
    Math.max(0, shortfall) * 12 +
    (criticality === "critical" ? 30 : criticality === "high" ? 20 : 0) +
    Math.min(numberValue(component.lead_days), 90) / 3
  );
}

function formatEvidenceDate(value: unknown, timezone: string): string {
  if (typeof value !== "string" || !value.trim()) return "date not recorded";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function assetLabel(order: JsonRecord): string {
  const code = requiredText(order.equipmentCode, 120);
  const name = requiredText(order.equipmentName, 240);
  return code || name || "an unidentified asset";
}

async function sha256Fingerprint(value: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function supabaseHeaders(anonKey: string, bearer: string, extra: HeadersInit = {}): Headers {
  const headers = new Headers(extra);
  headers.set("apikey", anonKey);
  headers.set("authorization", `Bearer ${bearer}`);
  return headers;
}

async function postgrestJson(
  supabaseUrl: string,
  path: string,
  anonKey: string,
  bearer: string,
): Promise<{ ok: boolean; data: unknown; response: Response }> {
  const response = await fetch(`${supabaseUrl}/rest/v1/${path}`, {
    headers: supabaseHeaders(anonKey, bearer, { accept: "application/json" }),
  });
  return {
    ok: response.ok,
    data: await response.json().catch(() => null),
    response,
  };
}

async function patchInteraction(
  supabaseUrl: string,
  anonKey: string,
  bearer: string,
  interactionId: string,
  userId: string,
  payload: JsonRecord,
): Promise<void> {
  const query = new URLSearchParams({
    id: `eq.${interactionId}`,
    user_id: `eq.${userId}`,
  });
  await fetch(`${supabaseUrl}/rest/v1/ask_vorta_interactions?${query}`, {
    method: "PATCH",
    headers: supabaseHeaders(anonKey, bearer, {
      "content-type": "application/json",
      prefer: "return=minimal",
    }),
    body: JSON.stringify(payload),
  });
}

export default async function handler(request: Request, context: EdgeContext): Promise<Response> {
  if (request.method !== "POST") return context.next(request);

  const body = await request.clone().json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return context.next(request);
  }
  const record = body as JsonRecord;
  const requestKind = isEquipmentSpareFollowUp(record)
    ? "equipment_spare"
    : isFactualBacklogRequest(record)
      ? "backlog"
      : isCapabilityRequest(record)
        ? "capability"
        : null;
  if (!requestKind) return context.next(request);

  const question = requiredText(record.question, 2_000);
  const siteId = requiredText(record.siteId, 100);
  const role = requiredText(record.role, 80);
  const rawPageContext =
    record.pageContext && typeof record.pageContext === "object" && !Array.isArray(record.pageContext)
      ? (record.pageContext as JsonRecord)
      : {};
  const timezone = requiredText(rawPageContext.timezone, 100) || "Europe/London";
  const bearer = request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1]?.trim();
  const supabaseUrl = Netlify.env.get("VITE_SUPABASE_URL");
  const anonKey = Netlify.env.get("VITE_SUPABASE_ANON_KEY");
  if (!question || !siteId || !role || !bearer || !supabaseUrl || !anonKey) {
    return context.next(request);
  }

  const startedAt = Date.now();
  try {
    const userResponse = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: supabaseHeaders(anonKey, bearer, { accept: "application/json" }),
    });
    const user = (await userResponse.json().catch(() => null)) as JsonRecord | null;
    const userId = requiredText(user?.id, 100);
    if (!userResponse.ok || !userId) return context.next(request);

    const accessQuery = new URLSearchParams({
      select: "site_id",
      user_id: `eq.${userId}`,
      site_id: `eq.${siteId}`,
      active: "eq.true",
      limit: "1",
    });
    const access = await postgrestJson(
      supabaseUrl,
      `user_site_access?${accessQuery}`,
      anonKey,
      bearer,
    );
    if (!access.ok || records(access.data).length === 0) return context.next(request);

    const rateWindowStart = new Date(
      startedAt - RATE_LIMIT_WINDOW_MINUTES * 60_000,
    ).toISOString();
    const rateQuery = new URLSearchParams({
      select: "id",
      user_id: `eq.${userId}`,
      created_at: `gte.${rateWindowStart}`,
    });
    const rateResponse = await fetch(
      `${supabaseUrl}/rest/v1/ask_vorta_interactions?${rateQuery}`,
      {
        method: "HEAD",
        headers: supabaseHeaders(anonKey, bearer, {
          prefer: "count=exact",
        }),
      },
    );
    if (!rateResponse.ok) return context.next(request);
    const recentRequestCount = Number(
      (rateResponse.headers.get("content-range") || "*/0").split("/").pop(),
    );
    if (Number.isFinite(recentRequestCount) && recentRequestCount >= RATE_LIMIT_REQUESTS) {
      return jsonResponse(
        {
          error: `Ask Vorta allows ${RATE_LIMIT_REQUESTS} analyses every ${RATE_LIMIT_WINDOW_MINUTES} minutes. Wait briefly and try again.`,
        },
        429,
      );
    }

    if (requestKind === "equipment_spare") {
      const equipmentReference = equipmentReferenceFromRequest(record);
      if (!equipmentReference) return context.next(request);

      const equipmentQuery = new URLSearchParams({
        select: "id,name,equipment_code,area,criticality",
        site_id: `eq.${siteId}`,
        equipment_code: `eq.${equipmentReference}`,
        limit: "2",
      });
      const equipmentResult = await postgrestJson(
        supabaseUrl,
        `equipment_assets?${equipmentQuery}`,
        anonKey,
        bearer,
      );
      const equipment = records(equipmentResult.data)[0];
      const equipmentId = requiredText(equipment?.id, 100);
      const equipmentCode = requiredText(equipment?.equipment_code, 120) || equipmentReference;
      const equipmentName = requiredText(equipment?.name, 240) || "asset name not recorded";
      if (!equipmentResult.ok || !equipmentId) return context.next(request);

      const componentsQuery = new URLSearchParams({
        select:
          "component_name,component_code,quantity_available,quantity_target,minimum_quantity,availability_status,vendor_name,maker_name,storage_location,criticality,unit_cost,lead_days,updated_at",
        site_id: `eq.${siteId}`,
        equipment_id: `eq.${equipmentId}`,
        limit: "100",
      });
      const componentResult = await postgrestJson(
        supabaseUrl,
        `equipment_components?${componentsQuery}`,
        anonKey,
        bearer,
      );
      if (!componentResult.ok) return context.next(request);
      const rankedComponents = records(componentResult.data)
        .sort((left, right) => componentConstraintScore(right) - componentConstraintScore(left));
      const topComponent = rankedComponents[0];
      const componentCode = requiredText(topComponent?.component_code, 160);
      const componentName = requiredText(topComponent?.component_name, 260);
      if (!topComponent || (!componentCode && !componentName)) return context.next(request);

      const available = numberValue(topComponent.quantity_available);
      const minimum = numberValue(topComponent.minimum_quantity);
      const target = numberValue(topComponent.quantity_target);
      const leadDays = numberValue(topComponent.lead_days);
      const availability = requiredText(topComponent.availability_status, 120) || "status not recorded";
      const criticality = requiredText(topComponent.criticality, 120) || "criticality not recorded";
      const storageLocation = requiredText(topComponent.storage_location, 240);
      const partLabel = [componentCode, componentName].filter(Boolean).join(" · ");
      const interactionId = crypto.randomUUID();
      const questionFingerprint = await sha256Fingerprint(question.toLowerCase());

      const startResponse = await fetch(`${supabaseUrl}/rest/v1/ask_vorta_interactions`, {
        method: "POST",
        headers: supabaseHeaders(anonKey, bearer, {
          "content-type": "application/json",
          prefer: "return=minimal",
        }),
        body: JSON.stringify({
          id: interactionId,
          site_id: siteId,
          user_id: userId,
          role,
          question_fingerprint: questionFingerprint,
          status: "started",
        }),
      });
      if (!startResponse.ok) return context.next(request);

      const missingData = [
        ...(leadDays > 0 ? [] : ["A verified supplier lead time is not recorded for this spare."]),
        ...(storageLocation ? [] : ["A storage location is not recorded for this spare."]),
      ];
      const directAnswer = `${partLabel} is the highest-ranked spare constraint for ${equipmentCode} (${equipmentName}). Recorded stock is ${available} against minimum ${minimum}${target ? ` and target ${target}` : ""}; status is ${availability}${leadDays ? ` with a ${leadDays}-day lead time` : ""}.`;
      const answer = {
        directAnswer,
        decisionSummary: [
          { label: "Asset", value: `${equipmentCode} · ${equipmentName}.` },
          { label: "Blocking spare", value: partLabel },
          {
            label: "Stock position",
            value: `${available} recorded against minimum ${minimum}${target ? ` and target ${target}` : ""}; ${availability}.`,
          },
          {
            label: "Supply constraint",
            value: `${criticality}${leadDays ? ` · ${leadDays}-day lead time` : " · lead time not recorded"}${storageLocation ? ` · location ${storageLocation}` : ""}.`,
          },
        ],
        evidence: [
          `${equipmentCode}: ${partLabel}; recorded quantity ${available}, minimum ${minimum}, target ${target || "not recorded"}, availability ${availability}, criticality ${criticality}, lead time ${leadDays || "not recorded"} days.`,
        ],
        findings: [
          {
            category: "spare",
            severity: availability.toLowerCase().includes("out") ? "critical" : "high",
            title: `${equipmentCode} · ${componentCode || componentName}`,
            detail: `This is the highest-ranked recorded spare constraint for the asset based on shortage, criticality and lead time.`,
          },
        ],
        coverOptions: [],
        recommendedActions: [],
        actionPlan: [],
        followUpQuestions: [],
        sources: ["Equipment spares inventory"],
        missingData,
        confidence: missingData.length ? 78 : 88,
        intentLabel: "equipment_spare_blocker",
        toolsUsed: ["get_equipment_spares"],
        evidenceGeneratedAt:
          requiredText(topComponent.updated_at, 100) || new Date().toISOString(),
        evidenceLinks: [
          {
            label: "Open equipment spares",
            path: `/equipment/${equipmentId}?tab=spares`,
            recordType: "spare",
          },
        ],
        responseId: interactionId,
      };

      await patchInteraction(supabaseUrl, anonKey, bearer, interactionId, userId, {
        intent_label: "equipment_spare_blocker",
        tools_used: ["get_equipment_spares"],
        sources: ["Equipment spares inventory"],
        confidence: answer.confidence,
        missing_data_count: missingData.length,
        duration_ms: Date.now() - startedAt,
        status: "completed",
        completed_at: new Date().toISOString(),
      });
      return jsonResponse(answer);
    }

    if (requestKind === "capability") {
      const capabilityResponse = await fetch(
        `${supabaseUrl}/rest/v1/rpc/vorta_get_capability_reconciliation_report`,
        {
          method: "POST",
          headers: supabaseHeaders(anonKey, bearer, {
            "content-type": "application/json",
          }),
          body: JSON.stringify({ p_site_id: siteId, p_limit: 15 }),
        },
      );
      const capabilityReport = (await capabilityResponse.json().catch(() => null)) as JsonRecord | null;
      if (!capabilityResponse.ok || !capabilityReport) return context.next(request);

      const allActions = records(capabilityReport.actions);
      const backupActions = allActions.filter(
        (action) => String(action.actionType ?? "") === "BACKUP_SME_DEVELOPMENT",
      );
      const rankedActions = [...backupActions, ...allActions.filter((action) => !backupActions.includes(action))].slice(0, 4);
      const topAction = rankedActions[0];
      if (!topAction) return context.next(request);

      const equipment =
        topAction.equipment && typeof topAction.equipment === "object" && !Array.isArray(topAction.equipment)
          ? (topAction.equipment as JsonRecord)
          : {};
      const primarySme =
        topAction.primarySme && typeof topAction.primarySme === "object" && !Array.isArray(topAction.primarySme)
          ? (topAction.primarySme as JsonRecord)
          : {};
      const backupSme =
        topAction.backupSme && typeof topAction.backupSme === "object" && !Array.isArray(topAction.backupSme)
          ? (topAction.backupSme as JsonRecord)
          : {};
      const candidate =
        topAction.candidate && typeof topAction.candidate === "object" && !Array.isArray(topAction.candidate)
          ? (topAction.candidate as JsonRecord)
          : {};
      const requirement =
        topAction.requirement && typeof topAction.requirement === "object" && !Array.isArray(topAction.requirement)
          ? (topAction.requirement as JsonRecord)
          : {};
      const equipmentCode = requiredText(equipment.code, 120) || "the highest-ranked asset";
      const equipmentName = requiredText(equipment.name, 240) || "asset name not recorded";
      const primaryName = requiredText(primarySme.name, 200);
      const backupName = requiredText(backupSme.name, 200);
      const candidateName = requiredText(candidate.name, 200);
      const skillName = requiredText(requirement.skillName, 240);
      const recommendedAction =
        requiredText(topAction.recommendedAction, 1_000) ||
        "Complete the limiting skills and equipment validation, then designate an active backup SME.";
      const rationale = requiredText(topAction.rationale, 1_000);
      const interactionId = crypto.randomUUID();
      const questionFingerprint = await sha256Fingerprint(question.toLowerCase());

      const startResponse = await fetch(`${supabaseUrl}/rest/v1/ask_vorta_interactions`, {
        method: "POST",
        headers: supabaseHeaders(anonKey, bearer, {
          "content-type": "application/json",
          prefer: "return=minimal",
        }),
        body: JSON.stringify({
          id: interactionId,
          site_id: siteId,
          user_id: userId,
          role,
          question_fingerprint: questionFingerprint,
          status: "started",
        }),
      });
      if (!startResponse.ok) return context.next(request);

      const missingData = rankedActions
        .flatMap((action) =>
          Array.isArray(action.missingEvidence)
            ? action.missingEvidence.filter((item): item is string => typeof item === "string")
            : [],
        )
        .filter((item, index, values) => values.indexOf(item) === index)
        .slice(0, 5);
      const findings = rankedActions.map((action) => {
        const actionEquipment =
          action.equipment && typeof action.equipment === "object" && !Array.isArray(action.equipment)
            ? (action.equipment as JsonRecord)
            : {};
        const actionCandidate =
          action.candidate && typeof action.candidate === "object" && !Array.isArray(action.candidate)
            ? (action.candidate as JsonRecord)
            : {};
        return {
          category: "skills",
          severity: /critical/i.test(String(action.priorityLevel))
            ? "critical"
            : /high/i.test(String(action.priorityLevel))
              ? "high"
              : "medium",
          title: `${String(actionEquipment.code ?? "Asset")} · ${String(action.actionType ?? "Capability action")}`,
          detail: `${String(action.rationale ?? "Capability dependency recorded")}${actionCandidate.name ? ` Candidate: ${String(actionCandidate.name)}.` : ""} ${String(action.recommendedAction ?? "")}`.trim(),
        };
      });
      const evidence = rankedActions.map(
        (action) =>
          `${String((action.equipment as JsonRecord | undefined)?.code ?? "Asset")}: ${String(action.rationale ?? "Capability dependency recorded")}. Recommended action: ${String(action.recommendedAction ?? "not recorded")}.`,
      );
      const directAnswer = `${equipmentCode} (${equipmentName}) is the highest-ranked single-person capability dependency. ${primaryName ? `${primaryName} is the recorded primary SME; ` : ""}${backupName ? `${backupName} is the active backup SME.` : "no active validated backup SME is recorded."}${candidateName ? ` Develop ${candidateName} as the nearest recorded backup candidate.` : " No named backup candidate is currently proven."}`;
      const decisionSummary = [
        {
          label: "Highest dependency",
          value: `${equipmentCode} · ${String(topAction.priorityLevel ?? "priority not recorded")} · score ${String(topAction.priorityScore ?? "not recorded")}.`,
        },
        {
          label: "Current SME",
          value: primaryName || "No active validated primary SME is recorded.",
        },
        {
          label: "Backup candidate",
          value: candidateName
            ? `${candidateName}${skillName ? ` · limiting skill: ${skillName}` : ""}.`
            : "No named candidate is currently proven.",
        },
        {
          label: "Required action",
          value: recommendedAction,
        },
      ];
      const answer = {
        directAnswer,
        decisionSummary,
        evidence,
        findings,
        coverOptions: [],
        recommendedActions: [recommendedAction],
        actionPlan: [
          {
            priority: "now",
            action: recommendedAction,
            owner: String(topAction.actionOwner ?? "Maintenance Manager"),
            expectedImpact: `Reduces the single-person dependency on ${equipmentCode} by developing and validating a named backup.`,
            verification: `Confirm the candidate's limiting skill, equipment-specific evidence and active backup-SME designation in the Skills Matrix.`,
          },
        ],
        followUpQuestions: [],
        sources: ["Site capability risk actions"],
        missingData,
        confidence: candidateName ? 83 : 72,
        intentLabel: "capability_risk",
        toolsUsed: ["get_site_capability_actions"],
        evidenceGeneratedAt:
          requiredText(capabilityReport.generatedAt, 100) || new Date().toISOString(),
        evidenceLinks: [
          {
            label: "Open Skills Matrix",
            path: "/skills-matrix",
            recordType: "skill",
          },
        ],
        responseId: interactionId,
      };

      await patchInteraction(supabaseUrl, anonKey, bearer, interactionId, userId, {
        intent_label: "capability_risk",
        tools_used: ["get_site_capability_actions"],
        sources: ["Site capability risk actions"],
        confidence: answer.confidence,
        missing_data_count: missingData.length,
        duration_ms: Date.now() - startedAt,
        status: "completed",
        completed_at: new Date().toISOString(),
      });
      return jsonResponse(answer);
    }

    const equipmentQuery = new URLSearchParams({
      select: "id,name,equipment_code,area,criticality",
      site_id: `eq.${siteId}`,
      limit: "500",
    });
    const workQuery = new URLSearchParams({
      select:
        "equipment_id,wo_number,priority,description,work_type,status,assigned_engineer,requested_date,due_date,is_overdue,fault_code,order_type_code,order_type_description,scheduled_start_at,scheduled_finish_at,updated_at",
      site_id: `eq.${siteId}`,
      limit: "300",
    });
    const [equipmentResult, workResult] = await Promise.all([
      postgrestJson(supabaseUrl, `equipment_assets?${equipmentQuery}`, anonKey, bearer),
      postgrestJson(supabaseUrl, `work_orders?${workQuery}`, anonKey, bearer),
    ]);
    if (!equipmentResult.ok || !workResult.ok) return context.next(request);

    const equipment = new Map(
      records(equipmentResult.data).map((item) => [String(item.id), item]),
    );
    const closed = /completed|closed|cancel|teco|business complete/i;
    const priorityRank = (value: unknown): number => {
      const rank = ["critical", "high", "medium", "low"].indexOf(
        String(value ?? "").toLowerCase(),
      );
      return rank === -1 ? 99 : rank;
    };
    const workOrders = records(workResult.data)
      .filter((item) => !closed.test(String(item.status ?? "")))
      .map((item) => {
        const asset = equipment.get(String(item.equipment_id));
        return {
          equipmentName: requiredText(asset?.name, 240) || "Unknown asset",
          equipmentCode: requiredText(asset?.equipment_code, 120),
          area: requiredText(asset?.area, 160),
          equipmentCriticality: requiredText(asset?.criticality, 80),
          workOrderNumber: item.wo_number,
          priority: item.priority,
          description: item.description,
          workType: item.work_type,
          status: item.status,
          assignedEngineer: item.assigned_engineer,
          requestedDate: item.requested_date,
          dueDate: item.due_date,
          overdue: item.is_overdue === true,
          faultCode: item.fault_code,
          updatedAt: item.updated_at,
        } as JsonRecord;
      })
      .sort((left, right) => {
        const overdueDifference = Number(right.overdue) - Number(left.overdue);
        if (overdueDifference) return overdueDifference;
        return priorityRank(left.priority) - priorityRank(right.priority);
      });

    const overdueOrders = workOrders.filter((item) => item.overdue === true);
    const rankedOrders = (overdueOrders.length ? overdueOrders : workOrders).slice(0, 4);
    const overdueCount = overdueOrders.length;
    const unassignedCount = workOrders.filter((item) => !item.assignedEngineer).length;
    const criticalOrHighCount = workOrders.filter((item) =>
      /critical|high/i.test(String(item.priority ?? "")),
    ).length;
    const top = rankedOrders[0];
    const topOrderNumber = requiredText(top?.workOrderNumber, 120) || "the highest-ranked order";
    const topAsset = top ? assetLabel(top) : "the affected asset";
    const topPriority = requiredText(top?.priority, 80) || "unclassified";
    const topDueDate = top
      ? formatEvidenceDate(top.dueDate, timezone)
      : "date not recorded";
    const interactionId = crypto.randomUUID();
    const questionFingerprint = await sha256Fingerprint(question.toLowerCase());

    const startResponse = await fetch(`${supabaseUrl}/rest/v1/ask_vorta_interactions`, {
      method: "POST",
      headers: supabaseHeaders(anonKey, bearer, {
        "content-type": "application/json",
        prefer: "return=minimal",
      }),
      body: JSON.stringify({
        id: interactionId,
        site_id: siteId,
        user_id: userId,
        role,
        question_fingerprint: questionFingerprint,
        status: "started",
      }),
    });
    if (!startResponse.ok) return context.next(request);

    const missingData = [
      ...(unassignedCount > 0
        ? [`${unassignedCount} open work order${unassignedCount === 1 ? " has" : "s have"} no recorded assignee.`]
        : []),
      ...(rankedOrders.some((item) => !item.dueDate)
        ? ["At least one ranked work order has no recorded due date."]
        : []),
    ].slice(0, 5);
    const findings = rankedOrders.length
      ? rankedOrders.map((item) => ({
          category: "work",
          severity: /critical/i.test(String(item.priority))
            ? "critical"
            : /high/i.test(String(item.priority))
              ? "high"
              : "medium",
          title: `${String(item.workOrderNumber ?? "Work order")} · ${assetLabel(item)}`,
          detail: `${String(item.description ?? "Description not recorded")}. Priority ${String(item.priority ?? "not recorded")}; due ${formatEvidenceDate(item.dueDate, timezone)}; assigned to ${String(item.assignedEngineer ?? "no engineer recorded")}.`,
        }))
      : [
          {
            category: "work",
            severity: "info",
            title: "No open work backlog",
            detail: "No open work orders were returned for the authorised site.",
          },
        ];
    const evidence = rankedOrders.map(
      (item) =>
        `${String(item.workOrderNumber ?? "Work order number not recorded")} on ${assetLabel(item)}: ${String(item.status ?? "status not recorded")}, ${item.overdue === true ? "overdue" : "not marked overdue"}, due ${formatEvidenceDate(item.dueDate, timezone)}.`,
    );
    const decisionSummary = top
      ? [
          {
            label: "Highest priority",
            value: `${topOrderNumber} · ${topAsset} · ${topPriority} · due ${topDueDate}.`,
          },
          ...(rankedOrders[1]
            ? [
                {
                  label: "Next overdue",
                  value: `${String(rankedOrders[1].workOrderNumber ?? "Order number not recorded")} · ${assetLabel(rankedOrders[1])} · ${String(rankedOrders[1].priority ?? "priority not recorded")} · due ${formatEvidenceDate(rankedOrders[1].dueDate, timezone)}.`,
                },
              ]
            : []),
          {
            label: "Backlog",
            value: `${workOrders.length} open; ${overdueCount} overdue; ${criticalOrHighCount} critical or high priority.`,
          },
          {
            label: "Assignment",
            value: unassignedCount
              ? `${unassignedCount} open work order${unassignedCount === 1 ? " is" : "s are"} unassigned.`
              : "Every returned open work order has a recorded assignee.",
          },
        ].slice(0, 4)
      : [
          {
            label: "Backlog",
            value: "No open work orders are present in the returned site evidence.",
          },
        ];
    const updatedTimes = workOrders
      .map((item) =>
        typeof item.updatedAt === "string" ? Date.parse(item.updatedAt) : Number.NaN,
      )
      .filter(Number.isFinite);
    const answer = {
      directAnswer: top
        ? `${overdueCount} overdue work order${overdueCount === 1 ? "" : "s"} need management attention; start with ${topOrderNumber} on ${topAsset}, a ${topPriority} priority order due ${topDueDate}.`
        : "No open maintenance work orders are recorded in the authorised site backlog.",
      decisionSummary,
      evidence,
      findings,
      coverOptions: [],
      recommendedActions: [],
      actionPlan: [],
      followUpQuestions: [],
      sources: ["Site maintenance work backlog"],
      missingData,
      confidence: missingData.length ? 78 : 83,
      intentLabel: "work_backlog",
      toolsUsed: ["get_site_work_backlog"],
      evidenceGeneratedAt: updatedTimes.length
        ? new Date(Math.max(...updatedTimes)).toISOString()
        : undefined,
      evidenceLinks: [
        {
          label: "Open work plan",
          path: "/dashboard?focus=work-plan",
          recordType: "work",
        },
      ],
      responseId: interactionId,
    };

    await patchInteraction(supabaseUrl, anonKey, bearer, interactionId, userId, {
      intent_label: "work_backlog",
      tools_used: ["get_site_work_backlog"],
      sources: ["Site maintenance work backlog"],
      confidence: answer.confidence,
      missing_data_count: missingData.length,
      duration_ms: Date.now() - startedAt,
      status: "completed",
      completed_at: new Date().toISOString(),
    });
    return jsonResponse(answer);
  } catch (error) {
    console.warn("Ask Vorta backlog edge fast path failed; delegating to the main assistant", {
      error: error instanceof Error ? error.message : String(error),
    });
    return context.next(request);
  }
}

export const config = {
  path: "/api/ask-vorta",
  method: "POST",
};
