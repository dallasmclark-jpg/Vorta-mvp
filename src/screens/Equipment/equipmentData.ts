// ─── Shared equipment identity data ──────────────────────────────────────────
// All equipment detail pages import from here. Do NOT add page-specific data.

export interface EquipmentBase {
  id: string;
  name: string;
  assetNumber: string;
  type: string;
  area: string;
  manufacturer: string;
  model: string;
  serialNumber: string;
  installDate: string;
  warranty: string;
  criticality: string;
  status: string;
  statusNote: string;
  image: string;
  riskScore: number;
  riskLevel: string;
  riskBreakdown: { label: string; pct: number; color: string; dotClass: string }[];
}

const EQUIPMENT_MAP: Record<string, EquipmentBase> = {
  "pl-02": {
    id: "pl-02",
    name: "Palletiser 2",
    assetNumber: "PL-02",
    type: "PALLETISER",
    area: "Packaging Area",
    manufacturer: "KUKA",
    model: "KR 210 R2700",
    serialNumber: "PL-02-2019-7731",
    installDate: "12 Mar 2019",
    warranty: "Expired",
    criticality: "High",
    status: "Running",
    statusNote: "Operating normally",
    image: "https://images.pexels.com/photos/3912981/pexels-photo-3912981.jpeg?auto=compress&cs=tinysrgb&w=400",
    riskScore: 71,
    riskLevel: "High",
    riskBreakdown: [
      { label: "High",     pct: 71, color: "#f97316", dotClass: "bg-orange-400" },
      { label: "Critical", pct: 24, color: "#ef4444", dotClass: "bg-red-500" },
      { label: "Skills",   pct: 16, color: "#eab308", dotClass: "bg-yellow-400" },
      { label: "Spares",   pct: 8,  color: "#6366f1", dotClass: "bg-indigo-500" },
    ],
  },
  "fl-03": {
    id: "fl-03",
    name: "Filling Line 3",
    assetNumber: "FL-03",
    type: "FILLING LINE",
    area: "Building 2",
    manufacturer: "Krones",
    model: "Modulfill VFS 32",
    serialNumber: "FL-03-2017-4421",
    installDate: "8 Jun 2017",
    warranty: "Expired",
    criticality: "Critical",
    status: "At Risk",
    statusNote: "Fault detected",
    image: "https://images.pexels.com/photos/1267338/pexels-photo-1267338.jpeg?auto=compress&cs=tinysrgb&w=400",
    riskScore: 92,
    riskLevel: "Critical",
    riskBreakdown: [
      { label: "Breakdowns", pct: 40, color: "#ef4444", dotClass: "bg-red-500" },
      { label: "PMs",        pct: 25, color: "#f97316", dotClass: "bg-orange-500" },
      { label: "Skills",     pct: 15, color: "#eab308", dotClass: "bg-yellow-400" },
      { label: "Spares",     pct: 10, color: "#6366f1", dotClass: "bg-indigo-500" },
    ],
  },
};

export const DEFAULT_EQUIPMENT_ID = "pl-02";

export function getEquipmentById(id: string | undefined): EquipmentBase {
  return (id && EQUIPMENT_MAP[id]) ?? EQUIPMENT_MAP[DEFAULT_EQUIPMENT_ID];
}

export function getAllEquipment(): EquipmentBase[] {
  return Object.values(EQUIPMENT_MAP);
}
