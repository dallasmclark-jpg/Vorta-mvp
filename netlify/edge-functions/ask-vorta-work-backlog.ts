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
const MIXED_DECISION_PATTERN = /\b(?:shift|cover|rota|pm|calibration|spare|stock|part|skill|contractor|handover|history|document|manual)\b/i;
const EQUIPMENT_CODE_PATTERN = /\b[A-Z]{2,}(?:-[A-Z0-9]+)*-?\d+[A-Z0-9-]*\b/;

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
  if (!isFactualBacklogRequest(record)) return context.next(request);

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
