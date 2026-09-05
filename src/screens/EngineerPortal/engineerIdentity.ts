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
  profile_id?: string | null;
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

  // Server-controlled app metadata is retained only as a migration-safe fallback.
  // The authoritative identity is engineers.profile_id -> auth.users.id.
  return normalizeIdentifier(session.user.app_metadata?.engineer_id);
}

async function loadEngineerByProfileId(
  profileId: string,
): Promise<EngineerRosterIdentity | null> {
  const { data, error } = await supabase
    .from("engineers")
    .select("id, full_name, site_id, department_id, discipline, shift_pattern, profile_id")
    .eq("profile_id", profileId)
    .limit(2);

  if (error) throw error;
  if (!data || data.length !== 1) return null;
  return toRosterIdentity(data[0] as EngineerIdentityRow);
}

async function loadEngineerById(engineerId: string): Promise<EngineerRosterIdentity | null> {
  const { data, error } = await supabase
    .from("engineers")
    .select("id, full_name, site_id, department_id, discipline, shift_pattern, profile_id")
    .eq("id", engineerId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;
  return toRosterIdentity(data as EngineerIdentityRow);
}

export async function resolveAuthenticatedEngineerIdentity(
  session: Session | null,
): Promise<EngineerRosterIdentity | null> {
  if (!session?.user) return null;

  try {
    const linkedIdentity = await loadEngineerByProfileId(session.user.id);
    const metadataEngineerId = authenticatedEngineerId(session);

    if (linkedIdentity) {
      if (
        metadataEngineerId &&
        metadataEngineerId !== linkedIdentity.id
      ) {
        console.warn(
          "Authenticated engineer identity is inconsistent between profile link and app metadata.",
        );
        return null;
      }
      return linkedIdentity;
    }

    if (!metadataEngineerId) return null;

    // Temporary compatibility path for a server-controlled app_metadata mapping
    // that has not yet been backfilled into engineers.profile_id. Never fall back
    // to user_metadata or a human-name match for ownership.
    return await loadEngineerById(metadataEngineerId);
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

  // Work orders currently store a source-system assignee label rather than a
  // foreign key. Until that import contract is normalised, require an exact
  // normalised full-name match after identity itself has been resolved from the
  // authoritative profile link.
  return assigned === fullName;
}
