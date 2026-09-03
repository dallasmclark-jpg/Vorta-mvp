import type { Session } from "@supabase/supabase-js";
import { supabase } from "../../lib/supabaseClient";

export interface EngineerRosterIdentity {
  id: string;
  fullName: string;
  siteId: string | null;
  departmentId: string | null;
  discipline: string | null;
  shiftPattern: string | null;
  certifications: Array<Record<string, unknown>>;
}

interface EngineerIdentityRow {
  id: string;
  full_name: string;
  site_id: string | null;
  department_id: string | null;
  discipline: string | null;
  shift_pattern: string | null;
}

function normalizeHumanName(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleLowerCase("en-GB");
  return normalized || null;
}

function normalizeIdentifier(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized || null;
}

function toRosterIdentity(engineer: EngineerIdentityRow): EngineerRosterIdentity {
  return {
    id: String(engineer.id),
    fullName: String(engineer.full_name),
    siteId: engineer.site_id ? String(engineer.site_id) : null,
    departmentId: engineer.department_id ? String(engineer.department_id) : null,
    discipline: engineer.discipline ? String(engineer.discipline) : null,
    shiftPattern: engineer.shift_pattern ? String(engineer.shift_pattern) : null,
    certifications: [],
  };
}

export function authenticatedEngineerDisplayName(session: Session | null): string | null {
  if (!session?.user) return null;
  const metadata = session.user.user_metadata ?? {};
  const candidates = [
    metadata.full_name,
    metadata.name,
    metadata.display_name,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim()) {
      return candidate.trim().replace(/\s+/g, " ");
    }
  }

  return null;
}

export function authenticatedEngineerId(session: Session | null): string | null {
  if (!session?.user) return null;

  // Engineer ownership is deliberately taken only from app_metadata because
  // user_metadata is user-editable. RLS then limits the engineers row to an
  // authorised site before it can be returned.
  return normalizeIdentifier(session.user.app_metadata?.engineer_id);
}

async function loadEngineerById(engineerId: string): Promise<EngineerRosterIdentity | null> {
  const { data, error } = await supabase
    .from("engineers")
    .select("id, full_name, site_id, department_id, discipline, shift_pattern")
    .eq("id", engineerId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;
  return toRosterIdentity(data as EngineerIdentityRow);
}

async function loadEngineerByExactName(
  displayName: string,
): Promise<EngineerRosterIdentity | null> {
  const expected = normalizeHumanName(displayName);
  if (!expected) return null;

  // The engineers table is site-scoped by RLS. Filtering after the authorised
  // read avoids fuzzy ownership and handles harmless case/spacing differences.
  const { data, error } = await supabase
    .from("engineers")
    .select("id, full_name, site_id, department_id, discipline, shift_pattern")
    .limit(100);

  if (error) throw error;

  const matches = ((data ?? []) as EngineerIdentityRow[]).filter(
    (engineer) => normalizeHumanName(engineer.full_name) === expected,
  );

  if (matches.length !== 1) return null;
  return toRosterIdentity(matches[0]);
}

export async function resolveAuthenticatedEngineerIdentity(
  session: Session | null,
): Promise<EngineerRosterIdentity | null> {
  if (!session?.user) return null;

  try {
    const engineerId = authenticatedEngineerId(session);
    if (engineerId) {
      return await loadEngineerById(engineerId);
    }

    const displayName = authenticatedEngineerDisplayName(session);
    if (!displayName) return null;
    return await loadEngineerByExactName(displayName);
  } catch (error) {
    console.warn("Authenticated engineer identity could not be resolved:", error);
    return null;
  }
}

export function workOrderIsAssignedToEngineer(
  assignedEngineer: unknown,
  identity: EngineerRosterIdentity | null,
): boolean {
  if (!identity || typeof assignedEngineer !== "string") return false;
  const assigned = normalizeHumanName(assignedEngineer);
  const fullName = normalizeHumanName(identity.fullName);
  if (!assigned || !fullName) return false;

  // Do not use fuzzy matching for personal work ownership. The source assignment
  // must resolve to the authenticated engineer exactly.
  return assigned === fullName;
}
