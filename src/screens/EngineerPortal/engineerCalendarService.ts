import { supabase } from "../../lib/supabaseClient";

export type EngineerCalendarEntryType =
  | "note"
  | "training"
  | "overtime"
  | "annual_leave"
  | "appointment"
  | "shift_cover"
  | "development"
  | "other";

export type EngineerCalendarEntryStatus = "planned" | "completed" | "cancelled";

export interface EngineerCalendarEntry {
  id: string;
  entryDate: string;
  entryType: EngineerCalendarEntryType;
  title: string;
  notes: string | null;
  hours: number | null;
  shiftType: "day" | "night" | null;
  status: EngineerCalendarEntryStatus;
  courseId: string | null;
  equipmentName: string | null;
  createdAt?: string;
  updatedAt?: string;
  source?: "vorta" | "training_booking";
  bookingStatus?: string;
}

export interface EngineerCalendarSnapshot {
  engineerId: string;
  startDate: string;
  endDate: string;
  entries: EngineerCalendarEntry[];
  formalTraining: EngineerCalendarEntry[];
}

export interface SaveEngineerCalendarEntryInput {
  id?: string | null;
  entryDate: string;
  entryType: EngineerCalendarEntryType;
  title: string;
  notes?: string | null;
  hours?: number | null;
  shiftType?: "day" | "night" | null;
  status?: EngineerCalendarEntryStatus;
  courseId?: string | null;
  equipmentName?: string | null;
}

export interface AskMyCalendarResult {
  answer: string;
  year: number;
  engineerId: string;
  scope: "self";
}

type EngineerCalendarSaveBridge = {
  entryId?: string | null;
  equipmentName?: string | null;
};

let pendingSaveBridge: EngineerCalendarSaveBridge | null = null;

export function primeEngineerCalendarSaveBridge(value: EngineerCalendarSaveBridge): void {
  pendingSaveBridge = { ...(pendingSaveBridge ?? {}), ...value };
}

export function clearEngineerCalendarSaveBridge(): void {
  pendingSaveBridge = null;
}

function toEntry(value: unknown, source: EngineerCalendarEntry["source"]): EngineerCalendarEntry {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Engineer calendar evidence is invalid.");
  }
  const row = value as Record<string, unknown>;
  return {
    id: String(row.id ?? ""),
    entryDate: String(row.entryDate ?? row.entry_date ?? ""),
    entryType: String(row.entryType ?? row.entry_type ?? "other") as EngineerCalendarEntryType,
    title: String(row.title ?? "Calendar entry"),
    notes: typeof row.notes === "string" ? row.notes : null,
    hours: row.hours === null || row.hours === undefined ? null : Number(row.hours),
    shiftType:
      row.shiftType === "day" || row.shift_type === "day"
        ? "day"
        : row.shiftType === "night" || row.shift_type === "night"
          ? "night"
          : null,
    status: String(row.status ?? "planned") as EngineerCalendarEntryStatus,
    courseId:
      typeof row.courseId === "string"
        ? row.courseId
        : typeof row.course_id === "string"
          ? row.course_id
          : null,
    equipmentName:
      typeof row.equipmentName === "string"
        ? row.equipmentName
        : typeof row.equipment_name === "string"
          ? row.equipment_name
          : null,
    createdAt: typeof row.createdAt === "string" ? row.createdAt : undefined,
    updatedAt: typeof row.updatedAt === "string" ? row.updatedAt : undefined,
    source,
    bookingStatus: typeof row.bookingStatus === "string" ? row.bookingStatus : undefined,
  };
}

export async function getMyEngineerCalendar(
  siteId: string,
  startDate: string,
  endDate: string,
): Promise<EngineerCalendarSnapshot> {
  const { data, error } = await supabase.rpc("vorta_get_my_engineer_calendar", {
    p_site_id: siteId,
    p_start_date: startDate,
    p_end_date: endDate,
  });
  if (error) throw error;
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("Your Engineer calendar could not be loaded.");
  }
  const row = data as Record<string, unknown>;
  const entries = Array.isArray(row.entries) ? row.entries.map((item) => toEntry(item, "vorta")) : [];
  const formalTraining = Array.isArray(row.formalTraining)
    ? row.formalTraining.map((item) => toEntry(item, "training_booking"))
    : [];
  return {
    engineerId: String(row.engineerId ?? ""),
    startDate: String(row.startDate ?? startDate),
    endDate: String(row.endDate ?? endDate),
    entries,
    formalTraining,
  };
}

export async function saveMyEngineerCalendarEntry(
  siteId: string,
  input: SaveEngineerCalendarEntryInput,
): Promise<EngineerCalendarEntry> {
  const bridge = pendingSaveBridge;
  pendingSaveBridge = null;
  const { data, error } = await supabase.rpc("vorta_save_my_engineer_calendar_entry_v2", {
    p_site_id: siteId,
    p_entry_date: input.entryDate,
    p_entry_type: input.entryType,
    p_title: input.title,
    p_notes: input.notes ?? null,
    p_hours: input.hours ?? null,
    p_shift_type: input.shiftType ?? null,
    p_status: input.status ?? "planned",
    p_course_id: input.courseId ?? null,
    p_entry_id: input.id ?? bridge?.entryId ?? null,
    p_equipment_name: input.equipmentName ?? bridge?.equipmentName ?? null,
  });
  if (error) throw error;
  return toEntry(data, "vorta");
}

export async function askMyEngineerCalendar(siteId: string, question: string): Promise<AskMyCalendarResult> {
  const { data, error } = await supabase.rpc("vorta_ask_my_calendar", {
    p_site_id: siteId,
    p_question: question,
  });
  if (error) throw error;
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("Vorta could not read your calendar activity.");
  }
  const row = data as Record<string, unknown>;
  return {
    answer: String(row.answer ?? "No calendar answer was returned."),
    year: Number(row.year ?? new Date().getFullYear()),
    engineerId: String(row.engineerId ?? ""),
    scope: "self",
  };
}

export async function deleteMyEngineerCalendarEntry(
  siteId: string,
  entryId: string,
): Promise<void> {
  const { data, error } = await supabase.rpc("vorta_delete_my_engineer_calendar_entry", {
    p_site_id: siteId,
    p_entry_id: entryId,
  });
  if (error) throw error;
  if (data !== true) throw new Error("The calendar entry could not be deleted.");
}
