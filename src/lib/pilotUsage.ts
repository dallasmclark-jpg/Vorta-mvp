import { supabase } from "./supabaseClient";

export type PilotUsageEventType =
  | "dashboard_review"
  | "pilot_impact_review"
  | "equipment_view"
  | "work_order_view"
  | "ask_vorta_query"
  | "recommendation_opened"
  | "capability_review"
  | "pilot_report_range_applied"
  | "pilot_report_downloaded";

interface PilotUsageEventInput {
  siteId: string | null | undefined;
  eventType: PilotUsageEventType;
  pathname?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  metadata?: Record<string, string | number | boolean | null | undefined>;
}

const SESSION_KEY = "vorta-pilot-usage-session";

function fallbackUuid(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (character) => {
    const random = Math.floor(Math.random() * 16);
    const value = character === "x" ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
}

function getSessionId(): string | null {
  if (typeof window === "undefined") return null;

  try {
    const existing = window.sessionStorage.getItem(SESSION_KEY);
    if (existing) return existing;

    const next = window.crypto?.randomUUID?.() ?? fallbackUuid();
    window.sessionStorage.setItem(SESSION_KEY, next);
    return next;
  } catch {
    return null;
  }
}

function cleanMetadata(
  metadata: PilotUsageEventInput["metadata"],
): Record<string, string | number | boolean | null> {
  if (!metadata) return {};

  return Object.fromEntries(
    Object.entries(metadata)
      .filter(([, value]) => value !== undefined)
      .map(([key, value]) => [key, value ?? null]),
  );
}

export async function trackPilotUsageEvent({
  siteId,
  eventType,
  pathname = typeof window === "undefined" ? null : window.location.pathname,
  entityType = null,
  entityId = null,
  metadata,
}: PilotUsageEventInput): Promise<void> {
  if (!siteId) return;

  try {
    const { error } = await supabase.rpc("vorta_track_pilot_usage_event", {
      p_site_id: siteId,
      p_event_type: eventType,
      p_pathname: pathname,
      p_entity_type: entityType,
      p_entity_id: entityId,
      p_session_id: getSessionId(),
      p_metadata: cleanMetadata(metadata),
    });

    if (error) {
      console.warn("Pilot usage event could not be recorded:", error.message);
    }
  } catch (trackingError) {
    console.warn("Pilot usage event could not be recorded:", trackingError);
  }
}
