import { supabase } from "../../lib/supabaseClient";

export type InventoryEvidenceStatus = "ready" | "empty" | "unavailable";
export type InventoryStockState =
  | "Out of stock"
  | "Below minimum"
  | "Below target"
  | "Covered"
  | "Excess";
export type InventoryExposureLevel =
  | "Critical"
  | "High"
  | "Medium"
  | "Low"
  | "Covered";

export interface StoresInventoryItem {
  id: string;
  equipmentId: string;
  equipmentName: string;
  equipmentCode: string;
  area: string;
  equipmentCriticality: string;
  partName: string;
  partNumber: string;
  oemPartNumber: string | null;
  supplier: string;
  manufacturer: string;
  storageLocation: string;
  imageUrl: string | null;
  imageAltText: string;
  imageSourceType: string | null;
  stock: number;
  minimum: number;
  target: number;
  unitCost: number | null;
  leadDays: number | null;
  componentCriticality: string;
  importedStatus: string;
  stockState: InventoryStockState;
  shortageUnits: number;
  targetGapUnits: number;
  stockValue: number | null;
  excessValue: number | null;
  longLeadShortage: boolean;
  assetRiskScore: number | null;
  assetRiskLevel: string | null;
  exposureScore: number;
  exposureLevel: InventoryExposureLevel;
  recommendedAction: string;
  sourceSystem: string;
  sourceUpdatedAt: string | null;
}

export interface StoresInventoryEvidence {
  status: InventoryEvidenceStatus;
  message: string | null;
}

export interface StoresInventoryPayload {
  items: StoresInventoryItem[];
  checkedAt: string;
  latestSourceAt: string | null;
  sourceSystems: string[];
  componentEvidence: StoresInventoryEvidence;
  assetEvidence: StoresInventoryEvidence;
  riskEvidence: StoresInventoryEvidence;
}

export type StoresInventoryLoadState =
  | { status: "ready"; data: StoresInventoryPayload }
  | { status: "empty"; message: string }
  | { status: "unavailable"; message: string };

interface ComponentRow {
  id: unknown;
  equipment_id: unknown;
  component_name: unknown;
  component_code: unknown;
  oem_part_number: unknown;
  vendor_name: unknown;
  maker_name: unknown;
  image_url: unknown;
  image_source_type: unknown;
  image_match_basis: unknown;
  image_alt_text: unknown;
  image_verification_status: unknown;
  quantity_available: unknown;
  quantity_target: unknown;
  minimum_quantity: unknown;
  unit_cost: unknown;
  lead_days: unknown;
  storage_location: unknown;
  availability_status: unknown;
  criticality: unknown;
  source_system: unknown;
  source_updated_at: unknown;
  updated_at: unknown;
}

interface AssetRow {
  id: unknown;
  equipment_code: unknown;
  name: unknown;
  area: unknown;
  criticality: unknown;
}

interface RiskRow {
  equipment_id: unknown;
  risk_score: unknown;
  risk_level: unknown;
  updated_at: unknown;
}

interface AssetEvidence {
  equipmentName: string;
  equipmentCode: string;
  area: string;
  criticality: string;
}

interface RiskEvidence {
  score: number;
  level: string;
  updatedAt: string | null;
}

const COMPONENT_SELECT = `
  id, equipment_id, component_name, component_code, oem_part_number,
  vendor_name, maker_name, image_url, image_source_type, image_match_basis,
  image_alt_text, image_verification_status, quantity_available,
  quantity_target, minimum_quantity, unit_cost, lead_days, storage_location,
  availability_status, criticality, source_system, source_updated_at, updated_at
`;

const ASSET_SELECT = `
  id, equipment_code, name, area, criticality
`;

const RISK_SELECT = `
  equipment_id, risk_score, risk_level, updated_at
`;

const textValue = (value: unknown, fallback = ""): string =>
  typeof value === "string" && value.trim() ? value.trim() : fallback;

const numberValue = (value: unknown): number | null => {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const timestampValue = (value: unknown): string | null => {
  if (typeof value !== "string" || !value.trim()) return null;
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? value : null;
};

const normaliseCriticality = (value: string): string => {
  const normalised = value.trim().toLowerCase();
  if (normalised === "critical") return "Critical";
  if (normalised === "high") return "High";
  if (normalised === "medium") return "Medium";
  if (normalised === "low") return "Low";
  return value.trim() || "Unknown";
};

function deriveStockState(
  stock: number,
  minimum: number,
  target: number,
): InventoryStockState {
  if (stock <= 0) return "Out of stock";
  if (stock < minimum) return "Below minimum";
  if (stock < target) return "Below target";
  if (target > 0 && stock > target) return "Excess";
  return "Covered";
}

function exposureLevel(score: number): InventoryExposureLevel {
  if (score >= 75) return "Critical";
  if (score >= 55) return "High";
  if (score >= 30) return "Medium";
  if (score > 0) return "Low";
  return "Covered";
}

function calculateExposureScore({
  stockState,
  componentCriticality,
  equipmentCriticality,
  leadDays,
  assetRiskScore,
}: {
  stockState: InventoryStockState;
  componentCriticality: string;
  equipmentCriticality: string;
  leadDays: number | null;
  assetRiskScore: number | null;
}): number {
  if (stockState === "Covered" || stockState === "Excess") return 0;

  const stockPoints =
    stockState === "Out of stock"
      ? 45
      : stockState === "Below minimum"
        ? 32
        : 18;

  const strongestCriticality = [
    normaliseCriticality(componentCriticality),
    normaliseCriticality(equipmentCriticality),
  ].includes("Critical")
    ? "Critical"
    : [
          normaliseCriticality(componentCriticality),
          normaliseCriticality(equipmentCriticality),
        ].includes("High")
      ? "High"
      : "Medium";

  const criticalityPoints =
    strongestCriticality === "Critical"
      ? 25
      : strongestCriticality === "High"
        ? 16
        : 8;

  const leadTimePoints =
    leadDays !== null && leadDays >= 90
      ? 20
      : leadDays !== null && leadDays >= 42
        ? 14
        : leadDays !== null && leadDays >= 14
          ? 7
          : 0;

  const assetRiskPoints =
    assetRiskScore === null
      ? 0
      : Math.min(10, Math.max(0, assetRiskScore) / 10);

  return Math.min(
    100,
    Math.round(
      stockPoints +
        criticalityPoints +
        leadTimePoints +
        assetRiskPoints,
    ),
  );
}

function recommendationFor(
  stockState: InventoryStockState,
  stock: number,
  minimum: number,
  target: number,
): string {
  const minimumGap = Math.max(0, Math.ceil(minimum - stock));
  const targetGap = Math.max(0, Math.ceil(target - stock));
  const excessUnits = Math.max(0, Math.floor(stock - target));

  if (stockState === "Out of stock") {
    const replenishment = Math.max(minimumGap, targetGap, 1);
    return `Replenish ${replenishment} unit${replenishment === 1 ? "" : "s"} now`;
  }
  if (stockState === "Below minimum") {
    const replenishment = Math.max(minimumGap, 1);
    return `Replenish ${replenishment} unit${replenishment === 1 ? "" : "s"} to minimum`;
  }
  if (stockState === "Below target") {
    const replenishment = Math.max(targetGap, 1);
    return `Top up ${replenishment} unit${replenishment === 1 ? "" : "s"} to target`;
  }
  if (stockState === "Excess") {
    return `Review ${excessUnits} excess unit${excessUnits === 1 ? "" : "s"}`;
  }
  return "No immediate stores action";
}

function newestTimestamp(values: Array<string | null>): string | null {
  return values
    .filter((value): value is string => Boolean(value))
    .sort(
      (left, right) =>
        new Date(right).getTime() -
        new Date(left).getTime(),
    )[0] ?? null;
}

function latestRiskByEquipment(rows: RiskRow[]): Map<string, RiskEvidence> {
  const riskByEquipment = new Map<string, RiskEvidence>();

  for (const row of rows) {
    const equipmentId = textValue(row.equipment_id);
    const score = numberValue(row.risk_score);
    if (!equipmentId || score === null || score < 0 || score > 100) continue;

    const evidence: RiskEvidence = {
      score,
      level: textValue(row.risk_level, "Unknown"),
      updatedAt: timestampValue(row.updated_at),
    };
    const current = riskByEquipment.get(equipmentId);

    if (
      !current ||
      new Date(evidence.updatedAt ?? 0).getTime() >
        new Date(current.updatedAt ?? 0).getTime()
    ) {
      riskByEquipment.set(equipmentId, evidence);
    }
  }

  return riskByEquipment;
}

function mapInventoryItem(
  row: ComponentRow,
  assets: Map<string, AssetEvidence>,
  riskByEquipment: Map<string, RiskEvidence>,
): StoresInventoryItem | null {
  const id = textValue(row.id);
  const equipmentId = textValue(row.equipment_id);
  const partName = textValue(row.component_name);
  const partNumber = textValue(row.component_code);

  if (!id || !equipmentId || !partName || !partNumber) return null;

  const stock = Math.max(0, numberValue(row.quantity_available) ?? 0);
  const target = Math.max(0, numberValue(row.quantity_target) ?? 0);
  const minimum = Math.max(0, numberValue(row.minimum_quantity) ?? 0);
  const unitCost = numberValue(row.unit_cost);
  const leadDays = numberValue(row.lead_days);
  const stockState = deriveStockState(stock, minimum, target);
  const asset = assets.get(equipmentId);
  const risk = riskByEquipment.get(equipmentId);
  const manufacturer = textValue(row.maker_name, "Not recorded");
  const oemPartNumber = textValue(row.oem_part_number) || null;
  const imageVerificationStatus = textValue(row.image_verification_status);
  const imageMatchBasis = textValue(row.image_match_basis);
  const candidateImageUrl = textValue(row.image_url);
  const imageUrl =
    imageVerificationStatus === "verified" &&
    imageMatchBasis === "exact_part" &&
    Boolean(oemPartNumber) &&
    Boolean(candidateImageUrl)
      ? candidateImageUrl
      : null;
  const componentCriticality = normaliseCriticality(
    textValue(row.criticality, "Unknown"),
  );
  const equipmentCriticality = normaliseCriticality(
    asset?.criticality ?? "Unknown",
  );
  const exposureScore = calculateExposureScore({
    stockState,
    componentCriticality,
    equipmentCriticality,
    leadDays,
    assetRiskScore: risk?.score ?? null,
  });
  const shortageUnits = Math.max(0, Math.ceil(minimum - stock));
  const targetGapUnits = Math.max(0, Math.ceil(target - stock));
  const stockValue =
    unitCost === null ? null : Math.max(0, stock * unitCost);
  const excessValue =
    stockState !== "Excess" || unitCost === null
      ? null
      : Math.max(0, (stock - target) * unitCost);

  return {
    id,
    equipmentId,
    equipmentName: asset?.equipmentName ?? "Equipment record unavailable",
    equipmentCode: asset?.equipmentCode ?? equipmentId.slice(0, 8).toUpperCase(),
    area: asset?.area ?? "Unassigned",
    equipmentCriticality,
    partName,
    partNumber,
    oemPartNumber,
    supplier: textValue(row.vendor_name, "Not recorded"),
    manufacturer,
    storageLocation: textValue(row.storage_location, "Location not recorded"),
    imageUrl,
    imageAltText: imageUrl
      ? textValue(
          row.image_alt_text,
          `${manufacturer} ${oemPartNumber ?? partName} spare part`,
        )
      : "No verified image available",
    imageSourceType: imageUrl ? textValue(row.image_source_type) || null : null,
    stock,
    minimum,
    target,
    unitCost,
    leadDays,
    componentCriticality,
    importedStatus: textValue(row.availability_status, "Unknown"),
    stockState,
    shortageUnits,
    targetGapUnits,
    stockValue,
    excessValue,
    longLeadShortage:
      leadDays !== null &&
      leadDays >= 42 &&
      stock < target,
    assetRiskScore: risk?.score ?? null,
    assetRiskLevel: risk?.level ?? null,
    exposureScore,
    exposureLevel: exposureLevel(exposureScore),
    recommendedAction: recommendationFor(
      stockState,
      stock,
      minimum,
      target,
    ),
    sourceSystem: textValue(row.source_system, "Unknown"),
    sourceUpdatedAt:
      timestampValue(row.source_updated_at) ??
      timestampValue(row.updated_at),
  };
}

export async function loadStoresInventorySnapshot(
  siteId: string,
): Promise<StoresInventoryLoadState> {
  if (!siteId) {
    return {
      status: "unavailable",
      message: "No active site was supplied for Stores Inventory.",
    };
  }

  const [componentResult, assetResult] = await Promise.allSettled([
    supabase
      .from("equipment_components")
      .select(COMPONENT_SELECT)
      .eq("site_id", siteId)
      .order("component_name"),
    supabase
      .from("equipment_assets")
      .select(ASSET_SELECT)
      .eq("site_id", siteId)
      .order("name"),
  ]);

  if (componentResult.status === "rejected") {
    return {
      status: "unavailable",
      message: "Stores inventory evidence could not be loaded.",
    };
  }

  const componentResponse = componentResult.value;
  if (componentResponse.error) {
    return {
      status: "unavailable",
      message: `Stores inventory evidence could not be loaded: ${componentResponse.error.message}`,
    };
  }

  const componentRows = (componentResponse.data ?? []) as ComponentRow[];
  if (componentRows.length === 0) {
    return {
      status: "empty",
      message: "No stores inventory records are configured for the active site.",
    };
  }

  const assets = new Map<string, AssetEvidence>();
  let assetEvidence: StoresInventoryEvidence;

  if (assetResult.status === "fulfilled" && !assetResult.value.error) {
    for (const row of (assetResult.value.data ?? []) as AssetRow[]) {
      const id = textValue(row.id);
      if (!id) continue;
      assets.set(id, {
        equipmentName: textValue(row.name, "Unnamed equipment"),
        equipmentCode: textValue(
          row.equipment_code,
          id.slice(0, 8).toUpperCase(),
        ),
        area: textValue(row.area, "Unassigned"),
        criticality: textValue(row.criticality, "Unknown"),
      });
    }
    assetEvidence = assets.size > 0
      ? { status: "ready", message: null }
      : {
          status: "empty",
          message: "No linked equipment records were returned.",
        };
  } else {
    assetEvidence = {
      status: "unavailable",
      message: "Linked equipment and area evidence is unavailable.",
    };
  }

  const equipmentIds = Array.from(
    new Set(componentRows.map((row) => textValue(row.equipment_id)).filter(Boolean)),
  );
  let riskEvidence: StoresInventoryEvidence;
  let riskRows: RiskRow[] = [];

  if (equipmentIds.length > 0) {
    try {
      const riskResponse = await supabase
        .from("equipment_risk_profiles")
        .select(RISK_SELECT)
        .in("equipment_id", equipmentIds);

      if (riskResponse.error) {
        riskEvidence = {
          status: "unavailable",
          message: "Affected-asset risk evidence is unavailable.",
        };
      } else {
        riskRows = (riskResponse.data ?? []) as RiskRow[];
        riskEvidence = riskRows.length > 0
          ? { status: "ready", message: null }
          : {
              status: "empty",
              message: "No affected-asset risk profiles were returned.",
            };
      }
    } catch {
      riskEvidence = {
        status: "unavailable",
        message: "Affected-asset risk evidence is unavailable.",
      };
    }
  } else {
    riskEvidence = {
      status: "empty",
      message: "No linked equipment identifiers were available.",
    };
  }

  const riskByEquipment = latestRiskByEquipment(riskRows);
  const items = componentRows
    .map((row) => mapInventoryItem(row, assets, riskByEquipment))
    .filter((item): item is StoresInventoryItem => item !== null)
    .sort(
      (left, right) =>
        right.exposureScore - left.exposureScore ||
        left.partName.localeCompare(right.partName),
    );

  if (items.length === 0) {
    return {
      status: "unavailable",
      message: "Inventory records were returned but none passed validation.",
    };
  }

  return {
    status: "ready",
    data: {
      items,
      checkedAt: new Date().toISOString(),
      latestSourceAt: newestTimestamp(
        items.map((item) => item.sourceUpdatedAt),
      ),
      sourceSystems: Array.from(
        new Set(items.map((item) => item.sourceSystem)),
      ).sort(),
      componentEvidence: { status: "ready", message: null },
      assetEvidence,
      riskEvidence,
    },
  };
}

export interface StoresInventorySummary {
  riskScore: number;
  riskLevel: InventoryExposureLevel;
  criticalStockouts: number;
  belowMinimum: number;
  belowTarget: number;
  longLeadShortages: number;
  affectedAssets: number;
  stockValue: number | null;
  excessValue: number | null;
}

export function summariseStoresInventory(
  items: StoresInventoryItem[],
): StoresInventorySummary {
  const attentionItems = items.filter(
    (item) => item.exposureScore > 0,
  );
  const topScores = attentionItems
    .map((item) => item.exposureScore)
    .sort((left, right) => right - left)
    .slice(0, 5);
  const maximum = topScores[0] ?? 0;
  const topAverage =
    topScores.length === 0
      ? 0
      : topScores.reduce((total, score) => total + score, 0) /
        topScores.length;
  const riskScore = Math.round(
    Math.min(100, maximum * 0.7 + topAverage * 0.3),
  );

  const stockValues = items
    .map((item) => item.stockValue)
    .filter((value): value is number => value !== null);
  const excessValues = items
    .map((item) => item.excessValue)
    .filter((value): value is number => value !== null);

  return {
    riskScore,
    riskLevel: exposureLevel(riskScore),
    criticalStockouts: items.filter(
      (item) =>
        item.stockState === "Out of stock" &&
        item.exposureLevel === "Critical",
    ).length,
    belowMinimum: items.filter(
      (item) => item.stockState === "Below minimum",
    ).length,
    belowTarget: items.filter(
      (item) => item.stockState === "Below target",
    ).length,
    longLeadShortages: items.filter(
      (item) => item.longLeadShortage,
    ).length,
    affectedAssets: new Set(
      attentionItems.map((item) => item.equipmentId),
    ).size,
    stockValue:
      stockValues.length > 0
        ? stockValues.reduce((total, value) => total + value, 0)
        : null,
    excessValue:
      excessValues.length > 0
        ? excessValues.reduce((total, value) => total + value, 0)
        : null,
  };
}
