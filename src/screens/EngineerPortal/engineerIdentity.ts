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

function normalizeHumanName(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleLowerCase("en-GB");
  return normalized || null;
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

export async function resolveAuthenticatedEngineerIdentity(
  session: Session | null,
): Promise<EngineerRosterIdentity | null> {
  const displayName = authenticatedEngineerDisplayName(session);
  const normalizedDisplayName = normalizeHumanName(displayName);
  if (!normalizedDisplayName) return null;

  try {
    const { data, error } = await supabase.functions.invoke("engineers-data");
    if (error) throw error;

    const engineers = Array.isArray(data?.engineers) ? data.engineers : [];
    const matches = engineers.filter(
      (engineer: any) => normalizeHumanName(engineer?.full_name) === normalizedDisplayName,
    );

    // Personal Engineer screens must fail closed on missing or ambiguous identity.
    if (matches.length !== 1) return null;

    const engineer = matches[0];
    return {
      id: String(engineer.id),
      fullName: String(engineer.full_name),
      siteId: engineer.site_id ? String(engineer.site_id) : null,
      departmentId: engineer.department_id ? String(engineer.department_id) : null,
      discipline: engineer.discipline ? String(engineer.discipline) : null,
      shiftPattern: engineer.shift_pattern ? String(engineer.shift_pattern) : null,
      certifications: Array.isArray(engineer.certifications)
        ? engineer.certifications
        : [],
    };
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
