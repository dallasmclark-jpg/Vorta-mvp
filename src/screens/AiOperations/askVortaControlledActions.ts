import { supabase } from "../../lib/supabaseClient";
import type {
  VortaAgentAction,
  VortaConversationContext,
} from "./vortaAgentService";

export type AskVortaActionKind = "handover_note";

export interface AskVortaActionTarget {
  id: string;
  type: "work_order";
  label: string;
  detail: string;
  snapshot: Record<string, unknown>;
}

export interface AskVortaActionEvent {
  id: string;
  eventType: string;
  actorId: string;
  draftVersion: number;
  payload: Record<string, unknown>;
  createdAt: string;
}

export interface AskVortaControlledDraft {
  id: string;
  interactionId: string | null;
  siteId: string;
  priority: VortaAgentAction["priority"];
  action: string;
  owner: string;
  expectedImpact: string;
  verification: string;
  status: "draft" | "confirmed" | "cancelled" | "failed";
  actionKind: "handover_note" | "read_only";
  targetType: string | null;
  targetId: string | null;
  proposedChanges: Record<string, unknown>;
  evidence: Record<string, unknown>;
  version: number;
  supported: boolean;
  resultType: string | null;
  resultId: string | null;
  resultPayload: Record<string, unknown> | null;
  failureReason: string | null;
  events: AskVortaActionEvent[];
  createdAt: string;
  updatedAt: string;
}

export interface AskVortaActionReviewContext {
  siteId: string;
  responseId: string;
  action: VortaAgentAction;
  conversationContext?: VortaConversationContext;
  evidence: string[];
  sources: string[];
}

export interface CreateAskVortaControlledDraftInput
  extends AskVortaActionReviewContext {
  target: AskVortaActionTarget;
  proposedChanges: Record<string, unknown>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function numberValue(value: unknown, fallback = 0): number {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function parseDraft(value: unknown): AskVortaControlledDraft {
  if (!isRecord(value) || !text(value.id) || !text(value.siteId)) {
    throw new Error("Vorta returned an invalid controlled-action draft.");
  }

  return {
    id: text(value.id),
    interactionId: text(value.interactionId) || null,
    siteId: text(value.siteId),
    priority: text(value.priority) as VortaAgentAction["priority"],
    action: text(value.action),
    owner: text(value.owner),
    expectedImpact: text(value.expectedImpact),
    verification: text(value.verification),
    status: text(value.status) as AskVortaControlledDraft["status"],
    actionKind: text(value.actionKind) as AskVortaControlledDraft["actionKind"],
    targetType: text(value.targetType) || null,
    targetId: text(value.targetId) || null,
    proposedChanges: isRecord(value.proposedChanges) ? value.proposedChanges : {},
    evidence: isRecord(value.evidence) ? value.evidence : {},
    version: Math.max(1, Math.round(numberValue(value.version, 1))),
    supported: value.supported === true,
    resultType: text(value.resultType) || null,
    resultId: text(value.resultId) || null,
    resultPayload: isRecord(value.resultPayload) ? value.resultPayload : null,
    failureReason: text(value.failureReason) || null,
    events: Array.isArray(value.events)
      ? value.events.flatMap((item): AskVortaActionEvent[] => {
          if (!isRecord(item) || !text(item.id)) return [];
          return [{
            id: text(item.id),
            eventType: text(item.eventType),
            actorId: text(item.actorId),
            draftVersion: Math.max(1, Math.round(numberValue(item.draftVersion, 1))),
            payload: isRecord(item.payload) ? item.payload : {},
            createdAt: text(item.createdAt),
          }];
        })
      : [],
    createdAt: text(value.createdAt),
    updatedAt: text(value.updatedAt),
  };
}

function targetLabel(...parts: unknown[]): string {
  return parts.map(text).filter(Boolean).join(" · ");
}

export async function loadAskVortaHandoverTargets(
  siteId: string,
): Promise<AskVortaActionTarget[]> {
  const [{ data: workOrders, error: workError }, { data: handovers, error: handoverError }] =
    await Promise.all([
      supabase
        .from("work_orders")
        .select(
          "id,wo_number,description,status,priority,equipment_id,due_date,updated_at,technical_completion_at,business_completion_at,system_status_codes",
        )
        .eq("site_id", siteId)
        .order("updated_at", { ascending: false })
        .limit(300),
      supabase
        .from("shift_handover_actions")
        .select("work_order_id,version,status,window_start,window_end,updated_at")
        .eq("site_id", siteId)
        .order("updated_at", { ascending: false })
        .limit(500),
    ]);

  if (workError || handoverError) {
    throw new Error("Vorta could not load authorised handover targets.");
  }

  const latestVersion = new Map<string, number>();
  for (const item of handovers ?? []) {
    const id = String(item.work_order_id ?? "");
    if (id && !latestVersion.has(id)) {
      latestVersion.set(id, Number(item.version) || 0);
    }
  }

  const closed = /completed|closed|cancel|teco|clsd|business complete/i;
  return (workOrders ?? [])
    .filter((item) => {
      const systemStatuses = Array.isArray(item.system_status_codes)
        ? item.system_status_codes.join(" ")
        : "";
      return (
        !item.technical_completion_at &&
        !item.business_completion_at &&
        !closed.test(`${item.status ?? ""} ${systemStatuses}`)
      );
    })
    .map((item) => ({
      id: String(item.id),
      type: "work_order" as const,
      label: targetLabel(item.wo_number, item.description),
      detail: targetLabel(item.status, item.priority, item.due_date),
      snapshot: {
        ...item,
        expectedVersion: latestVersion.get(String(item.id)) ?? 0,
      },
    }));
}

export async function createAskVortaControlledDraft(
  input: CreateAskVortaControlledDraftInput,
): Promise<AskVortaControlledDraft> {
  const evidence = {
    answerEvidence: input.evidence.slice(0, 12),
    sources: input.sources.slice(0, 12),
    conversationContext: input.conversationContext ?? null,
    targetSnapshot: input.target.snapshot,
    sapBoundary: "Vorta is read-only from SAP; this draft can only create a Vorta shift-handover action.",
  };

  const { data, error } = await supabase.rpc(
    "vorta_create_ask_vorta_action_draft",
    {
      p_interaction_id: input.responseId,
      p_site_id: input.siteId,
      p_action_kind: "handover_note",
      p_target_type: input.target.type,
      p_target_id: input.target.id,
      p_priority: input.action.priority,
      p_action: input.action.action,
      p_owner: input.action.owner,
      p_expected_impact: input.action.expectedImpact,
      p_verification: input.action.verification,
      p_proposed_changes: input.proposedChanges,
      p_evidence: evidence,
      p_idempotency_key: null,
    },
  );

  if (error) {
    throw new Error(error.message || "Vorta could not prepare the handover action.");
  }

  const draft = parseDraft(data);
  if (!draft.supported || draft.actionKind !== "handover_note") {
    throw new Error("Vorta returned an unsupported action draft.");
  }
  return draft;
}

export async function confirmAskVortaControlledDraft(
  draft: AskVortaControlledDraft,
): Promise<AskVortaControlledDraft> {
  if (draft.actionKind !== "handover_note") {
    throw new Error("Only a Vorta shift-handover action can be confirmed.");
  }

  const { data, error } = await supabase.rpc(
    "vorta_confirm_ask_vorta_action",
    { p_draft_id: draft.id, p_expected_version: draft.version },
  );

  if (error) {
    throw new Error(error.message || "Vorta could not confirm the handover action.");
  }

  const confirmed = parseDraft(data);
  if (confirmed.status === "failed") {
    throw new Error(confirmed.failureReason || "The handover action failed closed.");
  }
  if (confirmed.status !== "confirmed") {
    throw new Error("The handover action was not confirmed.");
  }
  return confirmed;
}

export async function cancelAskVortaControlledDraft(
  draft: AskVortaControlledDraft,
): Promise<AskVortaControlledDraft> {
  const { data, error } = await supabase.rpc(
    "vorta_cancel_ask_vorta_action",
    { p_draft_id: draft.id, p_expected_version: draft.version },
  );

  if (error) {
    throw new Error(error.message || "Vorta could not cancel the handover action.");
  }
  return parseDraft(data);
}
