import { supabase } from "../../lib/supabaseClient";
import {
  buildFaultIntelligence,
  type EngineerShiftState,
  type FaultEngineerRecommendation,
  type FaultIntelligenceResult,
} from "./faultIntelligenceData";

interface EngineerIdentityRow {
  id: string;
  profile_id: string | null;
  avatar_url: string | null;
}

interface EquipmentCapabilityRow {
  engineer_id: string;
  capability_role: string | null;
  capability_status: string | null;
  competency_level: number | null;
  practice_authority: string | null;
  validation_status: string | null;
  specialism: string | null;
}

interface SmeEngineerRow {
  id: string;
  profile_id: string | null;
  full_name: string;
  discipline: string | null;
  avatar_url: string | null;
  availability_status: string | null;
  shift_pattern: string | null;
}

export interface FaultEngineerRecommendationWithIdentity
  extends FaultEngineerRecommendation {
  avatarUrl: string | null;
  profileId: string | null;
  isEquipmentSme: boolean;
  capabilityRole: string | null;
}

export interface EquipmentSmeRecommendation {
  id: string;
  profileId: string | null;
  name: string;
  discipline: string;
  avatarUrl: string | null;
  capabilityRole: string;
  capabilityStatus: string;
  competencyLevel: number;
  practiceAuthority: string;
  validationStatus: string;
  specialism: string;
  availabilityStatus: string;
  shiftPattern: string;
  shiftState: EngineerShiftState;
}

export interface FaultIntelligenceWithIdentityResult
  extends Omit<FaultIntelligenceResult, "engineers"> {
  engineers: FaultEngineerRecommendationWithIdentity[];
  equipmentSme: EquipmentSmeRecommendation | null;
}

function normalise(value: string | null | undefined): string {
  return (value ?? "").toLowerCase().replace(/[\s_/-]+/g, " ").trim();
}

function isUnavailable(status: string | null | undefined): boolean {
  return /unavailable|off shift|leave|sick|away/.test(normalise(status));
}

function isConfirmedOnShift(status: string | null | undefined): boolean {
  const value = normalise(status);
  return (
    value === "on shift" ||
    value.includes("on site") ||
    value.includes("onsite") ||
    value.includes("active shift")
  );
}

function matchesCurrentShiftPattern(
  shiftPattern: string | null | undefined,
  isDayShift: boolean,
): boolean {
  const value = normalise(shiftPattern);
  if (!value) return false;
  if (isDayShift && (value.includes("day") || value.includes("days"))) return true;
  if (!isDayShift && (value.includes("night") || value.includes("nights"))) return true;
  return false;
}

function getShiftState(
  availabilityStatus: string | null | undefined,
  shiftPattern: string | null | undefined,
): EngineerShiftState {
  if (isConfirmedOnShift(availabilityStatus)) return "confirmed";

  const hour = new Date().getHours();
  const isDayShift = hour >= 6 && hour < 18;
  if (
    !isUnavailable(availabilityStatus) &&
    matchesCurrentShiftPattern(shiftPattern, isDayShift)
  ) {
    return "scheduled";
  }

  return "available";
}

function capabilityPriority(role: string | null): number {
  const value = normalise(role);
  if (value === "primary sme") return 0;
  if (value === "backup sme") return 1;
  if (value.includes("sme")) return 2;
  return 3;
}

function isActiveCapability(row: EquipmentCapabilityRow): boolean {
  const status = normalise(row.capability_status);
  return !status || status === "active" || status === "current";
}

async function loadEngineerIdentities(
  engineers: FaultEngineerRecommendation[],
): Promise<{
  identities: Map<string, EngineerIdentityRow>;
  error: string | null;
}> {
  if (engineers.length === 0) {
    return { identities: new Map(), error: null };
  }

  const { data, error } = await supabase
    .from("engineers")
    .select("id, profile_id, avatar_url")
    .in(
      "id",
      engineers.map((engineer) => engineer.id),
    );

  if (error) {
    return {
      identities: new Map(),
      error: `Engineer profile images could not be loaded: ${error.message}`,
    };
  }

  return {
    identities: new Map(
      ((data ?? []) as EngineerIdentityRow[]).map((row) => [row.id, row]),
    ),
    error: null,
  };
}

async function loadEquipmentSme(
  equipmentId: string | null,
): Promise<{
  sme: EquipmentSmeRecommendation | null;
  error: string | null;
}> {
  if (!equipmentId) {
    return {
      sme: null,
      error: "Equipment SME lookup was skipped because no equipment record matched.",
    };
  }

  const { data: capabilityData, error: capabilityError } = await supabase
    .from("equipment_engineer_capabilities")
    .select(
      "engineer_id, capability_role, capability_status, competency_level, practice_authority, validation_status, specialism",
    )
    .eq("equipment_id", equipmentId);

  if (capabilityError) {
    return {
      sme: null,
      error: `Equipment SME capability records could not be loaded: ${capabilityError.message}`,
    };
  }

  const capability = ((capabilityData ?? []) as EquipmentCapabilityRow[])
    .filter(
      (row) =>
        normalise(row.capability_role).includes("sme") &&
        isActiveCapability(row),
    )
    .sort(
      (left, right) =>
        capabilityPriority(left.capability_role) -
          capabilityPriority(right.capability_role) ||
        Number(right.competency_level ?? 0) - Number(left.competency_level ?? 0),
    )[0];

  if (!capability) {
    return {
      sme: null,
      error: "No active PRIMARY_SME or BACKUP_SME capability record exists for this equipment.",
    };
  }

  const { data: engineerData, error: engineerError } = await supabase
    .from("engineers")
    .select(
      "id, profile_id, full_name, discipline, avatar_url, availability_status, shift_pattern",
    )
    .eq("id", capability.engineer_id)
    .maybeSingle();

  if (engineerError || !engineerData) {
    return {
      sme: null,
      error: `The equipment SME engineer profile could not be loaded${
        engineerError ? `: ${engineerError.message}` : "."
      }`,
    };
  }

  const engineer = engineerData as SmeEngineerRow;
  return {
    sme: {
      id: engineer.id,
      profileId: engineer.profile_id,
      name: engineer.full_name,
      discipline: engineer.discipline ?? "Maintenance engineering",
      avatarUrl: engineer.avatar_url,
      capabilityRole: capability.capability_role ?? "SME",
      capabilityStatus: capability.capability_status ?? "Active",
      competencyLevel: Number(capability.competency_level ?? 0),
      practiceAuthority: capability.practice_authority ?? "Not recorded",
      validationStatus: capability.validation_status ?? "Not recorded",
      specialism: capability.specialism ?? "Equipment subject matter expertise",
      availabilityStatus: engineer.availability_status ?? "Unknown",
      shiftPattern: engineer.shift_pattern ?? "Not recorded",
      shiftState: getShiftState(
        engineer.availability_status,
        engineer.shift_pattern,
      ),
    },
    error: null,
  };
}

export async function buildFaultIntelligenceWithIdentity(
  question: string,
): Promise<FaultIntelligenceWithIdentityResult> {
  const base = await buildFaultIntelligence(question);
  const [identityResult, smeResult] = await Promise.all([
    loadEngineerIdentities(base.engineers),
    loadEquipmentSme(base.primaryEquipment?.id ?? null),
  ]);

  const engineers = base.engineers.map(
    (engineer): FaultEngineerRecommendationWithIdentity => {
      const identity = identityResult.identities.get(engineer.id);
      const isEquipmentSme = smeResult.sme?.id === engineer.id;

      return {
        ...engineer,
        avatarUrl: identity?.avatar_url ?? null,
        profileId: identity?.profile_id ?? null,
        isEquipmentSme,
        capabilityRole: isEquipmentSme
          ? smeResult.sme?.capabilityRole ?? "SME"
          : null,
      };
    },
  );

  const extraErrors = [identityResult.error, smeResult.error].filter(
    (item): item is string => Boolean(item),
  );

  return {
    ...base,
    engineers,
    equipmentSme: smeResult.sme,
    sourceErrors: [...new Set([...base.sourceErrors, ...extraErrors])],
  };
}
