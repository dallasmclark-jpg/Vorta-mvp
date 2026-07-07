// ─── Shared equipment identity data ──────────────────────────────────────────
// All equipment detail pages import from here. Do NOT add page-specific data.

const PALLETISER_IMAGE = `data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='400' height='280' viewBox='0 0 400 280'><rect width='400' height='280' fill='%230a0f1e'/><defs><pattern id='g' width='32' height='32' patternUnits='userSpaceOnUse'><path d='M 32 0 L 0 0 0 32' fill='none' stroke='%23162040' stroke-width='0.8'/></pattern></defs><rect width='400' height='280' fill='url(%23g)'/><rect x='60' y='160' width='100' height='12' rx='2' fill='%231e3a5f' stroke='%232d5a8e' stroke-width='1'/><rect x='80' y='148' width='60' height='14' rx='2' fill='%231e3a5f' stroke='%232d5a8e' stroke-width='1'/><rect x='90' y='136' width='40' height='14' rx='2' fill='%231e3a5f' stroke='%232d5a8e' stroke-width='1'/><rect x='50' y='170' width='120' height='8' rx='1' fill='%230d2040' stroke='%231a3a6e' stroke-width='1'/><rect x='160' y='100' width='16' height='80' rx='3' fill='%23213d6b' stroke='%232d5a8e' stroke-width='1.2'/><line x1='168' y1='100' x2='240' y2='60' stroke='%232d5a8e' stroke-width='2.5' stroke-linecap='round'/><circle cx='240' cy='60' r='8' fill='%23162f55' stroke='%233a72b0' stroke-width='1.5'/><line x1='240' y1='68' x2='240' y2='136' stroke='%232d5a8e' stroke-width='1.5' stroke-dasharray='4 3'/><rect x='220' y='136' width='40' height='28' rx='3' fill='%23162f55' stroke='%232d5a8e' stroke-width='1.2'/><rect x='280' y='155' width='60' height='26' rx='3' fill='%23162f55' stroke='%232d5a8e' stroke-width='1.2'/><rect x='290' y='143' width='40' height='14' rx='2' fill='%231a3660' stroke='%232d5a8e' stroke-width='1'/><rect x='300' y='131' width='20' height='14' rx='2' fill='%231a3660' stroke='%232d5a8e' stroke-width='1'/><line x1='30' y1='178' x2='370' y2='178' stroke='%231e3a5f' stroke-width='2'/><text x='200' y='220' font-family='system-ui,sans-serif' font-size='11' font-weight='600' fill='%234a90d9' text-anchor='middle' letter-spacing='3'>PALLETISER CELL</text><text x='200' y='238' font-family='system-ui,sans-serif' font-size='9' fill='%23334f7a' text-anchor='middle' letter-spacing='2'>KUKA KR 210 R2700</text></svg>`;

const VIAL_FILLER_IMAGE = `data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='400' height='280' viewBox='0 0 400 280'><rect width='400' height='280' fill='%230a0f1e'/><defs><pattern id='g' width='32' height='32' patternUnits='userSpaceOnUse'><path d='M 32 0 L 0 0 0 32' fill='none' stroke='%23162040' stroke-width='0.8'/></pattern></defs><rect width='400' height='280' fill='url(%23g)'/><rect x='30' y='90' width='340' height='16' rx='3' fill='%230d2040' stroke='%231e3a5f' stroke-width='1.2'/><rect x='28' y='155' width='344' height='20' rx='3' fill='%230d2040' stroke='%231e3a5f' stroke-width='1.2'/><g><rect x='55' y='66' width='18' height='90' rx='3' fill='%23162f55' stroke='%232d5a8e' stroke-width='1.2'/><rect x='60' y='58' width='8' height='10' rx='1' fill='%23213d6b' stroke='%232d5a8e' stroke-width='1'/><rect x='57' y='154' width='14' height='22' rx='2' fill='%230d2040' stroke='%231e3a5f' stroke-width='1'/></g><g><rect x='110' y='66' width='18' height='90' rx='3' fill='%23162f55' stroke='%232d5a8e' stroke-width='1.2'/><rect x='115' y='58' width='8' height='10' rx='1' fill='%23213d6b' stroke='%232d5a8e' stroke-width='1'/><rect x='112' y='154' width='14' height='22' rx='2' fill='%230d2040' stroke='%231e3a5f' stroke-width='1'/></g><g><rect x='165' y='66' width='18' height='90' rx='3' fill='%23162f55' stroke='%232d5a8e' stroke-width='1.2'/><rect x='170' y='58' width='8' height='10' rx='1' fill='%23213d6b' stroke='%232d5a8e' stroke-width='1'/><rect x='167' y='154' width='14' height='22' rx='2' fill='%230d2040' stroke='%231e3a5f' stroke-width='1'/></g><g><rect x='220' y='66' width='18' height='90' rx='3' fill='%23162f55' stroke='%232d5a8e' stroke-width='1.2'/><rect x='225' y='58' width='8' height='10' rx='1' fill='%23213d6b' stroke='%232d5a8e' stroke-width='1'/><rect x='222' y='154' width='14' height='22' rx='2' fill='%230d2040' stroke='%231e3a5f' stroke-width='1'/></g><g><rect x='275' y='66' width='18' height='90' rx='3' fill='%23162f55' stroke='%232d5a8e' stroke-width='1.2'/><rect x='280' y='58' width='8' height='10' rx='1' fill='%23213d6b' stroke='%232d5a8e' stroke-width='1'/><rect x='277' y='154' width='14' height='22' rx='2' fill='%230d2040' stroke='%231e3a5f' stroke-width='1'/></g><g><rect x='330' y='66' width='18' height='90' rx='3' fill='%23162f55' stroke='%232d5a8e' stroke-width='1.2'/><rect x='335' y='58' width='8' height='10' rx='1' fill='%23213d6b' stroke='%232d5a8e' stroke-width='1'/><rect x='332' y='154' width='14' height='22' rx='2' fill='%230d2040' stroke='%231e3a5f' stroke-width='1'/></g><rect x='140' y='42' width='120' height='50' rx='4' fill='%23101e3a' stroke='%232d5a8e' stroke-width='1.4'/><rect x='150' y='50' width='30' height='6' rx='1' fill='%231e3a5f'/><rect x='188' y='50' width='30' height='6' rx='1' fill='%231e3a5f'/><rect x='226' y='50' width='20' height='6' rx='1' fill='%231e3a5f'/><rect x='150' y='62' width='96' height='4' rx='1' fill='%230d2040' stroke='%23163060' stroke-width='0.8'/><text x='200' y='220' font-family='system-ui,sans-serif' font-size='11' font-weight='600' fill='%234a90d9' text-anchor='middle' letter-spacing='3'>VIAL FILLING LINE</text><text x='200' y='238' font-family='system-ui,sans-serif' font-size='9' fill='%23334f7a' text-anchor='middle' letter-spacing='2'>BOSCH VF-01</text></svg>`;

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
    image: PALLETISER_IMAGE,
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
    image: VIAL_FILLER_IMAGE,
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
