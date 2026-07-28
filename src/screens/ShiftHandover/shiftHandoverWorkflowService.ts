import { supabase } from "../../lib/supabaseClient";

export type ShiftHandoverWorkflowStatus =
  | "ready"
  | "acknowledged"
  | "carried_forward"
  | "closed";

export interface ShiftHandoverWorkflowEvent {
  id: string;
  eventType: "created" | "updated" | "acknowledged" | "carried_forward" | "closed";
  actionVersion: number;
  actorId: string;
  payload: Record<string, unknown>;
  createdAt: string;
}

export interface ShiftHandoverWorkflowAction {
  id: string;
  organisationId: string;
  siteId: string;
  workOrderId: string;
  windowStart: string;
  windowEnd: string;
  outgoingNote: string;
  nextAction: string;
  ownerName: string;
  dueAt: string;
  status: ShiftHandoverWorkflowStatus;
  version: number;
  acknowledgedBy: string | null;
  acknowledgedAt: string | null;
  carryForwardFrom: string | null;
  carriedForwardTo: string | null;
  createdBy: string;
  createdAt: string;
  updatedBy: string;
  updatedAt: string;
  events: ShiftHandoverWorkflowEvent[];
}

export interface SaveShiftHandoverActionInput {
  siteId: string;
  workOrderId: string;
  windowStart: string;
  windowEnd: string;
  outgoingNote: string;
  nextAction: string;
  ownerName: string;
  dueAt: string;
  expectedVersion: number | null;
}

function objectValue(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function nullableText(value: unknown): string | null {
  const result = text(value);
  return result || null;
}

function parseEvent(value: unknown): ShiftHandoverWorkflowEvent | null {
  const row = objectValue(value);
  if (!row || !text(row.id) || !text(row.eventType)) return null;
  return {
    id: text(row.id),
    eventType: text(row.eventType) as ShiftHandoverWorkflowEvent["eventType"],
    actionVersion: Number(row.actionVersion ?? 0),
    actorId: text(row.actorId),
    payload: objectValue(row.payload) ?? {},
    createdAt: text(row.createdAt),
  };
}

export function parseShiftHandoverWorkflowAction(
  value: unknown,
): ShiftHandoverWorkflowAction {
  const row = objectValue(value);
  if (!row || !text(row.id) || !text(row.workOrderId)) {
    throw new Error("Shift handover control returned an invalid action.");
  }
  const status = text(row.status);
  if (!["ready", "acknowledged", "carried_forward", "closed"].includes(status)) {
    throw new Error("Shift handover control returned an invalid status.");
  }

  return {
    id: text(row.id),
    organisationId: text(row.organisationId),
    siteId: text(row.siteId),
    workOrderId: text(row.workOrderId),
    windowStart: text(row.windowStart),
    windowEnd: text(row.windowEnd),
    outgoingNote: text(row.outgoingNote),
    nextAction: text(row.nextAction),
    ownerName: text(row.ownerName),
    dueAt: text(row.dueAt),
    status: status as ShiftHandoverWorkflowStatus,
    version: Number(row.version ?? 0),
    acknowledgedBy: nullableText(row.acknowledgedBy),
    acknowledgedAt: nullableText(row.acknowledgedAt),
    carryForwardFrom: nullableText(row.carryForwardFrom),
    carriedForwardTo: nullableText(row.carriedForwardTo),
    createdBy: text(row.createdBy),
    createdAt: text(row.createdAt),
    updatedBy: text(row.updatedBy),
    updatedAt: text(row.updatedAt),
    events: Array.isArray(row.events)
      ? row.events.map(parseEvent).filter((event): event is ShiftHandoverWorkflowEvent => Boolean(event))
      : [],
  };
}

function rpcError(error: unknown, fallback: string): Error {
  if (error instanceof Error) return error;
  if (error && typeof error === "object" && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message.trim()) return new Error(message);
  }
  return new Error(fallback);
}

export async function loadShiftHandoverActions(
  siteId: string,
  windowStart: string,
  windowEnd: string,
): Promise<Map<string, ShiftHandoverWorkflowAction>> {
  const { data, error } = await supabase.rpc("vorta_get_shift_handover_actions", {
    p_site_id: siteId,
    p_window_start: windowStart,
    p_window_end: windowEnd,
  });
  if (error) throw rpcError(error, "Shift handover controls could not be loaded.");

  const actions = (Array.isArray(data) ? data : [])
    .map(parseShiftHandoverWorkflowAction);
  return new Map(actions.map((action) => [action.workOrderId, action]));
}

export async function saveShiftHandoverAction(
  input: SaveShiftHandoverActionInput,
): Promise<ShiftHandoverWorkflowAction> {
  const { data, error } = await supabase.rpc("vorta_save_shift_handover_action", {
    p_site_id: input.siteId,
    p_work_order_id: input.workOrderId,
    p_window_start: input.windowStart,
    p_window_end: input.windowEnd,
    p_outgoing_note: input.outgoingNote,
    p_next_action: input.nextAction,
    p_owner_name: input.ownerName,
    p_due_at: input.dueAt,
    p_expected_version: input.expectedVersion,
  });
  if (error) throw rpcError(error, "Shift handover action could not be saved.");
  return parseShiftHandoverWorkflowAction(data);
}

export async function acknowledgeShiftHandoverAction(
  actionId: string,
  expectedVersion: number,
): Promise<ShiftHandoverWorkflowAction> {
  const { data, error } = await supabase.rpc(
    "vorta_acknowledge_shift_handover_action",
    {
      p_action_id: actionId,
      p_expected_version: expectedVersion,
    },
  );
  if (error) throw rpcError(error, "Shift handover acknowledgement could not be recorded.");
  return parseShiftHandoverWorkflowAction(data);
}

export async function carryForwardShiftHandoverAction(
  actionId: string,
  expectedVersion: number,
  nextWindowStart: string,
  nextWindowEnd: string,
  dueAt: string,
): Promise<{
  current: ShiftHandoverWorkflowAction;
  carriedForward: ShiftHandoverWorkflowAction;
}> {
  const { data, error } = await supabase.rpc(
    "vorta_carry_forward_shift_handover_action",
    {
      p_action_id: actionId,
      p_expected_version: expectedVersion,
      p_next_window_start: nextWindowStart,
      p_next_window_end: nextWindowEnd,
      p_due_at: dueAt,
    },
  );
  if (error) throw rpcError(error, "Shift handover carry-forward could not be recorded.");
  const row = objectValue(data);
  if (!row) throw new Error("Shift handover carry-forward returned an invalid response.");
  return {
    current: parseShiftHandoverWorkflowAction(row.current),
    carriedForward: parseShiftHandoverWorkflowAction(row.carriedForward),
  };
}
