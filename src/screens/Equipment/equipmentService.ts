// ─── Equipment Service ────────────────────────────────────────────────────────
// All data access for the Equipment section goes through this file.
// Currently returns mock data for detail pages; equipment list fetches from
// Supabase. Replace other function bodies with Supabase queries when ready.

import { supabase } from "../../lib/supabaseClient";
import {
  Equipment,
  WorkOrder,
  CompletedWorkOrder,
  PreventiveMaintenance,
  EquipmentSkill,
  Engineer,
  SparePart,
  EquipmentDocument,
  EquipmentActivity,
  AiInsight,
} from "./equipmentTypes";
import { getEquipmentById as getEquipmentByIdFallback, DEFAULT_EQUIPMENT_ID } from "./equipmentData";
import { EQUIPMENT_IMAGES, resolveEquipmentImage } from "./equipmentImages";

// ─── Mock equipment data ──────────────────────────────────────────────────────

const MOCK_EQUIPMENT: Equipment[] = [
  {
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
    image: EQUIPMENT_IMAGES.palletiser,
    riskScore: 71,
    riskLevel: "High",
    riskBreakdown: riskBreakdownFor("High", "Palletiser 2", "PALLETISER", "PL-02"),
  },
  {
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
    image: EQUIPMENT_IMAGES.vialFiller,
    riskScore: 92,
    riskLevel: "Critical",
    riskBreakdown: riskBreakdownFor("Critical", "Filling Line 3", "FILLING LINE", "FL-03"),
  },
];

// ─── Mock work orders ─────────────────────────────────────────────────────────

const MOCK_WORK_ORDERS: WorkOrder[] = [
  { id: "WO-10482", equipmentId: "pl-02", priority: "CRITICAL", description: "High vibration detected on main arm",    type: "Corrective",  status: "OPEN",         engineer: "James Wilson", requestedDate: "24 Apr 2025", dueDate: "25 Apr 2025", age: "1d", overdue: true },
  { id: "WO-10491", equipmentId: "pl-02", priority: "HIGH",     description: "Gripper alignment check required",       type: "Inspection",  status: "IN PROGRESS",  engineer: "Sarah Chen",   requestedDate: "20 Apr 2025", dueDate: "27 Apr 2025", age: "4d" },
  { id: "WO-10435", equipmentId: "pl-02", priority: "MEDIUM",   description: "PLC communication intermittent",         type: "Predictive",  status: "ON HOLD",       engineer: "Mike Torres",  requestedDate: "22 Apr 2025", dueDate: "29 Apr 2025", age: "2d" },
  { id: "WO-10412", equipmentId: "pl-02", priority: "LOW",      description: "Conveyor belt tension check",            type: "Preventive",  status: "WAITING PARTS", engineer: "Lisa Park",    requestedDate: "21 Apr 2025", dueDate: "30 Apr 2025", age: "3d" },
  { id: "WO-10398", equipmentId: "pl-02", priority: "HIGH",     description: "Motor overload protection trip",         type: "Corrective",  status: "OPEN",          engineer: "James Wilson", requestedDate: "19 Apr 2025", dueDate: "28 Apr 2025", age: "5d", overdue: true },
  { id: "WO-10374", equipmentId: "pl-02", priority: "MEDIUM",   description: "Sensor calibration required",            type: "Preventive",  status: "OPEN",          engineer: "Sarah Chen",   requestedDate: "18 Apr 2025", dueDate: "25 Apr 2025", age: "6d" },
  { id: "WO-10356", equipmentId: "pl-02", priority: "LOW",      description: "Pneumatic leak inspection",              type: "Inspection",  status: "OPEN",          engineer: "Mike Torres",  requestedDate: "17 Apr 2025", dueDate: "24 Apr 2025", age: "7d" },
  { id: "WO-10321", equipmentId: "pl-02", priority: "HIGH",     description: "Bearing inspection required",            type: "Preventive",  status: "OPEN",          engineer: "Lisa Park",    requestedDate: "16 Apr 2025", dueDate: "23 Apr 2025", age: "8d", overdue: true },
];

const MOCK_COMPLETED_WORK_ORDERS: CompletedWorkOrder[] = [
  { id: "WO-10420", equipmentId: "pl-02", description: "Routine lubrication", type: "Preventive", completedBy: "James Wilson", completionDate: "23 Apr 2025", mttr: "0.5h", outcome: "SUCCESS" },
  { id: "WO-10415", equipmentId: "pl-02", description: "Calibration check",   type: "Preventive", completedBy: "Sarah Chen",   completionDate: "21 Apr 2025", mttr: "1.2h", outcome: "SUCCESS" },
  { id: "WO-10409", equipmentId: "pl-02", description: "Sensor replacement",  type: "Preventive", completedBy: "Mike Torres",  completionDate: "19 Apr 2025", mttr: "2.4h", outcome: "PARTIAL" },
  { id: "WO-10402", equipmentId: "pl-02", description: "Bearing inspection",  type: "Preventive", completedBy: "Lisa Park",    completionDate: "18 Apr 2025", mttr: "3.1h", outcome: "SUCCESS" },
];

// ─── Mock PMs ─────────────────────────────────────────────────────────────────

const MOCK_PMS: PreventiveMaintenance[] = [
  { id: "PM-PL-02-DAILY",   equipmentId: "pl-02", name: "Daily Visual Inspection", code: "PM-PL-02-DAILY",   frequency: "Daily",     type: "Inspection",  lastCompleted: "24 Apr 2025", nextDue: "25 Apr 2025", status: "ON TRACK",  compliance: 90 },
  { id: "PM-PL-02-LUB-01",  equipmentId: "pl-02", name: "Conveyor Lubrication",    code: "PM-PL-02-LUB-01",  frequency: "Weekly",    type: "Lubrication", lastCompleted: "20 Apr 2025", nextDue: "27 Apr 2025", status: "DUE SOON",  compliance: 75 },
  { id: "PM-PL-02-BEAR-01", equipmentId: "pl-02", name: "Bearing Inspection",      code: "PM-PL-02-BEAR-01", frequency: "Monthly",   type: "Inspection",  lastCompleted: "15 Mar 2025", nextDue: "15 Apr 2025", status: "OVERDUE",   compliance: 45 },
  { id: "PM-PL-02-LOGIC",   equipmentId: "pl-02", name: "PLC Logic Review",        code: "PM-PL-02-LOGIC",   frequency: "Quarterly", type: "Test",        lastCompleted: "10 Jan 2025", nextDue: "10 Apr 2025", status: "COMPLETED", compliance: 100 },
  { id: "PM-PL-02-ALIGN",   equipmentId: "pl-02", name: "Drive-End Alignment",     code: "PM-PL-02-ALIGN",   frequency: "Monthly",   type: "Service",     lastCompleted: "05 Apr 2025", nextDue: "05 May 2025", status: "ON TRACK",  compliance: 95 },
];

// ─── Mock skills ──────────────────────────────────────────────────────────────

const MOCK_SKILLS: EquipmentSkill[] = [
  { equipmentId: "pl-02", name: "Siemens S7 PLC",    covered: false },
  { equipmentId: "pl-02", name: "Safety Circuits",   covered: false },
  { equipmentId: "pl-02", name: "Vision Systems",    covered: true  },
  { equipmentId: "pl-02", name: "Hydraulics",        covered: true  },
  { equipmentId: "pl-02", name: "Robot Programming", covered: true  },
];

const MOCK_ENGINEERS: Engineer[] = [
  { id: "jw-01", initials: "JW", name: "James Wilson",  role: "Mechanical Engineer", match: 96, status: "Available",   shift: "Days"   },
  { id: "sj-01", initials: "SJ", name: "Sarah Jones",   role: "Senior Technician",   match: 91, status: "Night Shift", shift: "Nights" },
  { id: "le-01", initials: "LE", name: "Liam Evans",    role: "Maintenance Lead",    match: 87, status: "Available",   shift: "Days"   },
  { id: "mc-01", initials: "MC", name: "Mike Chen",     role: "Junior Technician",   match: 84, status: "Busy",        shift: "Days"   },
];

// ─── Mock spare parts ─────────────────────────────────────────────────────────

const MOCK_SPARES: SparePart[] = [
  { id: "sp-01", equipmentId: "pl-02", name: "Encoder Rotary 1024",      partNumber: "EN-2205", stock: 0, max: 2, status: "Out of Stock" },
  { id: "sp-02", equipmentId: "pl-02", name: "Servo Motor AC 3kW",       partNumber: "SM-4521", stock: 2, max: 3, status: "Low Stock"    },
  { id: "sp-03", equipmentId: "pl-02", name: "Pneumatic Cylinder 50mm",  partNumber: "PC-3301", stock: 1, max: 2, status: "Low Stock"    },
  { id: "sp-04", equipmentId: "pl-02", name: "Drive Belt Poly-V 1200mm", partNumber: "DB-1192", stock: 4, max: 4, status: "OK"           },
  { id: "sp-05", equipmentId: "pl-02", name: "Bearing Kit 6205-2RS",     partNumber: "BK-411C", stock: 6, max: 4, status: "OK"           },
  { id: "sp-06", equipmentId: "pl-02", name: "Filter Hydraulic 10µm",    partNumber: "FT-160",  stock: 3, max: 2, status: "OK"           },
];

// ─── Mock documents ───────────────────────────────────────────────────────────

const MOCK_DOCUMENTS: EquipmentDocument[] = [
  { id: "doc-01", equipmentId: "pl-02", name: "Operation Manual v4.2",        category: "Manual",      date: "24 Apr 2025", size: "4.2 MB",  status: "Current"    },
  { id: "doc-02", equipmentId: "pl-02", name: "Electrical Schematic Rev.C",   category: "Schematic",   date: "18 Apr 2025", size: "8.1 MB",  status: "Current"    },
  { id: "doc-03", equipmentId: "pl-02", name: "Safety Certificate ISO-14001", category: "Certificate", date: "12 Apr 2025", size: "1.2 MB",  status: "Expiring"   },
  { id: "doc-04", equipmentId: "pl-02", name: "Hydraulic Assembly Drawing",   category: "Drawing",     date: "05 Apr 2025", size: "12.4 MB", status: "Current"    },
  { id: "doc-05", equipmentId: "pl-02", name: "PM Procedure — Quarterly",     category: "Procedure",   date: "28 Mar 2025", size: "2.8 MB",  status: "Current"    },
  { id: "doc-06", equipmentId: "pl-02", name: "Risk Assessment v2.1",         category: "Compliance",  date: "15 Mar 2025", size: "3.1 MB",  status: "Review Due" },
  { id: "doc-07", equipmentId: "pl-02", name: "PLC Program Backup",           category: "Other",       date: "10 Mar 2025", size: "18.6 MB", status: "Current"    },
  { id: "doc-08", equipmentId: "pl-02", name: "Calibration Certificate",      category: "Certificate", date: "01 Mar 2025", size: "0.8 MB",  status: "Expired"    },
];

// ─── Mock activity / history ──────────────────────────────────────────────────

const MOCK_ACTIVITY: EquipmentActivity[] = [
  { id: "ha-01", equipmentId: "pl-02", date: "24 Apr 2025", woNumber: "WO-10482", type: "BREAKDOWN",  priority: "CRITICAL", description: "High vibration on main arm — emergency stop triggered",  downtime: "3h 20m", outcome: "RESOLVED" },
  { id: "ha-02", equipmentId: "pl-02", date: "23 Apr 2025", woNumber: "WO-10435", type: "CORRECTIVE", priority: "HIGH",     description: "PLC communication intermittent — board reseated",         downtime: "1h 45m", outcome: "PARTIAL"  },
  { id: "ha-03", equipmentId: "pl-02", date: "21 Apr 2025", woNumber: "WO-10491", type: "PREVENTIVE", priority: "MEDIUM",   description: "Gripper alignment check — within tolerance",               downtime: "0h 00m", outcome: "RESOLVED" },
  { id: "ha-04", equipmentId: "pl-02", date: "20 Apr 2025", woNumber: "WO-10478", type: "INSPECTION", priority: "MEDIUM",   description: "Monthly visual inspection — no defects found",             downtime: "0h 00m", outcome: "RESOLVED" },
  { id: "ha-05", equipmentId: "pl-02", date: "18 Apr 2025", woNumber: "WO-10465", type: "PARTS",      priority: "MEDIUM",   description: "Drive belt replaced — worn beyond 80% threshold",          downtime: "0h 30m", outcome: "RESOLVED" },
  { id: "ha-06", equipmentId: "pl-02", date: "15 Apr 2025", woNumber: "WO-10452", type: "BREAKDOWN",  priority: "CRITICAL", description: "Bearing failure on arm joint — partial bearing replacement", downtime: "6h 10m", outcome: "PARTIAL"  },
];

// ─── Mock AI insights ─────────────────────────────────────────────────────────

const MOCK_AI_INSIGHTS: AiInsight[] = [
  { id: "ai-01", equipmentId: "pl-02", type: "risk",           title: "Bearing Wear",                   description: "High probability of bearing failure based on vibration trend and failure history.", severity: "HIGH",   confidence: 86, createdAt: "24 Apr 2025" },
  { id: "ai-02", equipmentId: "pl-02", type: "recommendation", title: "Schedule Bearing Inspection",    description: "Inspect drive-end bearing and check alignment within 3 days.",                      severity: "HIGH",   confidence: 91, createdAt: "24 Apr 2025" },
  { id: "ai-03", equipmentId: "pl-02", type: "risk",           title: "Overdue PM Compliance",          description: "PM compliance is 67%. Schedule quarterly inspection to prevent warranty impact.",    severity: "MEDIUM", confidence: 88, createdAt: "24 Apr 2025" },
  { id: "ai-04", equipmentId: "pl-02", type: "pattern",        title: "Vibration Spike Detected",       description: "Unusual vibration pattern on drive-end bearing matches pre-failure signature.",       severity: "HIGH",   confidence: 88, createdAt: "24 Apr 2025" },
  { id: "ai-05", equipmentId: "pl-02", type: "opportunity",    title: "Spare Network Opportunity",      description: "Connect with Palletiser 4 spare pool to reduce stockholding by £3,200/yr.",          severity: "LOW",    confidence: 75, createdAt: "24 Apr 2025" },
  { id: "ai-06", equipmentId: "pl-02", type: "opportunity",    title: "PM Optimisation",                description: "AI suggests extending oil change interval from 3 to 4 months based on oil analysis.", severity: "LOW",    confidence: 82, createdAt: "24 Apr 2025" },
];

// ─── Service functions ────────────────────────────────────────────────────────
// Replace each function body with a Supabase query when ready.

// ─── equipment_assets row shape (matches DB columns) ─────────────────────────

interface EquipmentRiskProfileRow {
  risk_score: number | null;
  risk_level: Equipment["riskLevel"] | null;
  pm_backlog_pct: number | null;
  asset_criticality_pct: number | null;
  calibration_pct: number | null;
  skills_pct: number | null;
  spares_pct: number | null;
  calibration_overdue_count: number | null;
  overdue_pm_count: number | null;
  open_work_order_count: number | null;
  repeat_breakdown_count: number | null;
  single_point_skill_gap: boolean | null;
  critical_spares_missing: number | null;
  risk_summary: string | null;
  priority_action: string | null;
}

interface EquipmentAssetRow {
  id: string;
  equipment_code: string | null;
  name: string;
  equipment_type: string | null;
  area: string | null;
  oem: string | null;
  model: string | null;
  criticality: string | null;
  status: string | null;
  image_url: string | null;
  equipment_risk_profiles?: EquipmentRiskProfileRow[] | EquipmentRiskProfileRow | null;
}

function getRiskProfile(row: EquipmentAssetRow): EquipmentRiskProfileRow | null {
  const profile = row.equipment_risk_profiles;
  if (Array.isArray(profile)) return profile[0] ?? null;
  return profile ?? null;
}

// Risk Drivers show the leading factors increasing the likelihood of future equipment risk.
function riskBreakdownFromProfile(profile: EquipmentRiskProfileRow): Equipment["riskBreakdown"] {
  const items: Equipment["riskBreakdown"] = [
    { label: "PM Backlog",        pct: profile.pm_backlog_pct         ?? 0, color: "#f97316", dotClass: "bg-orange-500" },
    { label: "Asset Criticality", pct: profile.asset_criticality_pct  ?? 0, color: "#dc2626", dotClass: "bg-red-600"    },
    { label: "Calibration",       pct: profile.calibration_pct        ?? 0, color: "#06b6d4", dotClass: "bg-cyan-400"   },
    { label: "Skills",            pct: profile.skills_pct             ?? 0, color: "#eab308", dotClass: "bg-yellow-400" },
    { label: "Spares",            pct: profile.spares_pct             ?? 0, color: "#6366f1", dotClass: "bg-indigo-500" },
  ];
  return items.filter((item) => item.pct > 0);
}

// Maps a DB criticality value to a risk level + derived score.
function mapCriticality(
  criticality: string | null,
  name?: string | null,
  type?: string | null,
  code?: string | null,
): { riskLevel: Equipment["riskLevel"]; riskScore: number } {
  const c = criticality?.toLowerCase();
  const h = `${name ?? ""} ${type ?? ""} ${code ?? ""}`.toLowerCase();

  let riskLevel: Equipment["riskLevel"];
  let baseScore: number;

  switch (c) {
    case "critical": riskLevel = "Critical"; baseScore = 88; break;
    case "high":     riskLevel = "High";     baseScore = 71; break;
    case "medium":   riskLevel = "Medium";   baseScore = 45; break;
    case "low":      riskLevel = "Low";      baseScore = 22; break;
    default:         riskLevel = "Medium";   baseScore = 45;
  }

  let adjustment = 0;
  if (h.includes("vial") || h.includes("filler") || h.includes("filling") || h.includes("vf-")) adjustment += 4;
  if (h.includes("hvac") || h.includes("ahu") || h.includes("cleanroom")) adjustment += 6;
  if (h.includes("boiler") || h.includes("steam")) adjustment += 3;
  if (h.includes("case pack") || h.includes("case-pack")) adjustment += 5;
  if (h.includes("plc") || h.includes("automation")) adjustment += 2;
  if (h.includes("compressor")) adjustment -= 4;
  if (h.includes("forklift") || h.includes("warehouse")) adjustment -= 6;
  if (h.includes("lighting")) adjustment -= 10;

  return { riskLevel, riskScore: Math.max(5, Math.min(96, baseScore + adjustment)) };
}

// Produces asset-specific Risk Drivers (leading indicators only). Percentages always total 100%.
// Calibration = 0 drivers are omitted via .filter().
function riskBreakdownFor(
  riskLevel: Equipment["riskLevel"],
  name?: string | null,
  type?: string | null,
  code?: string | null,
): Equipment["riskBreakdown"] {
  const h = `${name ?? ""} ${type ?? ""} ${code ?? ""}`.toLowerCase();

  const colours = {
    pm:          { color: "#f97316", dotClass: "bg-orange-500" },
    criticality: { color: "#dc2626", dotClass: "bg-red-600" },
    calibration: { color: "#06b6d4", dotClass: "bg-cyan-400" },
    skills:      { color: "#eab308", dotClass: "bg-yellow-400" },
    spares:      { color: "#6366f1", dotClass: "bg-indigo-500" },
  };

  const createBreakdown = (
    pmBacklog: number,
    assetCriticality: number,
    calibration: number,
    skills: number,
    spares: number,
  ): Equipment["riskBreakdown"] => [
    { label: "PM Backlog",        pct: pmBacklog,        ...colours.pm },
    { label: "Asset Criticality", pct: assetCriticality, ...colours.criticality },
    { label: "Calibration",       pct: calibration,      ...colours.calibration },
    { label: "Skills",            pct: skills,           ...colours.skills },
    { label: "Spares",            pct: spares,           ...colours.spares },
  ].filter((item) => item.pct > 0);

  if (h.includes("vial") || h.includes("filler") || h.includes("filling") || h.includes("vf-") || h.includes("fl-"))
    return createBreakdown(20, 35, 25, 15, 5);

  if (h.includes("hvac") || h.includes("ahu") || h.includes("cleanroom"))
    return createBreakdown(25, 35, 25, 10, 5);

  if (h.includes("boiler") || h.includes("steam") || h.includes("bl-"))
    return createBreakdown(35, 35, 5, 10, 15);

  if (h.includes("palletis") || h.includes("palletiz") || h.includes("pl-") || h.includes("case pack") || h.includes("case-pack") || h.includes("cp-"))
    return createBreakdown(40, 25, 5, 10, 20);

  if (h.includes("plc") || h.includes("automation"))
    return createBreakdown(25, 20, 0, 40, 15);

  if (h.includes("conveyor") || h.includes("cv-"))
    return createBreakdown(45, 20, 0, 10, 25);

  if (h.includes("motor") || h.includes("drive") || h.includes("press line") || h.includes("pm-"))
    return createBreakdown(35, 20, 0, 10, 35);

  if (h.includes("compressor") || h.includes("air comp") || h.includes("ac-"))
    return createBreakdown(40, 25, 0, 10, 25);

  if (h.includes("forklift") || h.includes("warehouse") || h.includes("wf-"))
    return createBreakdown(40, 20, 0, 20, 20);

  if (h.includes("lighting") || h.includes("light") || h.includes("lt-"))
    return createBreakdown(35, 15, 0, 15, 35);

  if (riskLevel === "Critical") return createBreakdown(30, 35, 20, 10,  5);
  if (riskLevel === "High")     return createBreakdown(35, 30, 15, 10, 10);
  if (riskLevel === "Low")      return createBreakdown(35, 20,  0, 20, 25);
  return                               createBreakdown(35, 25, 10, 15, 15);
}

// ─── EquipmentListItem — UI shape for the equipment list page ────────────────

export interface EquipmentListItem {
  id: string;
  name: string;
  assetNumber: string;
  type: string;
  area: string;
  riskScore: number;
  riskLevel: "Critical" | "High" | "Medium" | "Low" | "Minimal";
  breakdown: { label: string; pct: number; color: string; dotClass: string }[];
}

// Fallback list used when Supabase is unavailable.
const MOCK_LIST: EquipmentListItem[] = [
  { id: "fl-03",  name: "Filling Line 3",      assetNumber: "FL-03",  type: "FILLING LINE", area: "Building 2", riskScore: 92, riskLevel: "Critical", breakdown: riskBreakdownFor("Critical", "Filling Line 3",      "FILLING LINE", "FL-03") },
  { id: "cp-04",  name: "Case Packer 4",        assetNumber: "CP-04",  type: "PACKING",      area: "Packing",    riskScore: 88, riskLevel: "Critical", breakdown: riskBreakdownFor("Critical", "Case Packer 4",        "PACKING",      "CP-04") },
  { id: "bl-01",  name: "Boiler 1",             assetNumber: "BL-01",  type: "UTILITIES",    area: "Utilities",  riskScore: 74, riskLevel: "High",     breakdown: riskBreakdownFor("High",     "Boiler 1",             "UTILITIES",    "BL-01") },
  { id: "pl-02",  name: "Palletiser 2",         assetNumber: "PL-02",  type: "PALLETISER",   area: "Building 2", riskScore: 71, riskLevel: "High",     breakdown: riskBreakdownFor("High",     "Palletiser 2",         "PALLETISER",   "PL-02") },
  { id: "l2-plc", name: "Line 2 PLC",           assetNumber: "L2-PLC", type: "AUTOMATION",   area: "Packing",    riskScore: 68, riskLevel: "High",     breakdown: riskBreakdownFor("High",     "Line 2 PLC",           "AUTOMATION",   "L2-PLC") },
  { id: "cv-04",  name: "Conveyor 4",           assetNumber: "CV-04",  type: "CONVEYOR",     area: "Building 2", riskScore: 58, riskLevel: "Medium",   breakdown: riskBreakdownFor("Medium",   "Conveyor 4",           "CONVEYOR",     "CV-04") },
  { id: "pm-01",  name: "Press Line Motor",     assetNumber: "PM-01",  type: "PROCESSING",   area: "Processing", riskScore: 52, riskLevel: "Medium",   breakdown: riskBreakdownFor("Medium",   "Press Line Motor",     "PROCESSING",   "PM-01") },
  { id: "ac-01",  name: "Air Compressor 1",     assetNumber: "AC-01",  type: "COMPRESSOR",   area: "Building 2", riskScore: 33, riskLevel: "Low",      breakdown: riskBreakdownFor("Low",      "Air Compressor 1",     "COMPRESSOR",   "AC-01") },
  { id: "wf-03",  name: "Warehouse Forklift 3", assetNumber: "WF-03",  type: "WAREHOUSE",    area: "Warehouse",  riskScore: 28, riskLevel: "Low",      breakdown: riskBreakdownFor("Low",      "Warehouse Forklift 3", "WAREHOUSE",    "WF-03") },
  { id: "lt-01",  name: "Lighting System",      assetNumber: "LT-01",  type: "FACILITIES",   area: "Building 2", riskScore: 12, riskLevel: "Minimal",  breakdown: riskBreakdownFor("Minimal",  "Lighting System",      "FACILITIES",   "LT-01") },
];

function rowToListItem(row: EquipmentAssetRow): EquipmentListItem {
  const fallback = mapCriticality(row.criticality, row.name, row.equipment_type, row.equipment_code);
  const profile  = getRiskProfile(row);
  const riskLevel = profile?.risk_level ?? fallback.riskLevel;
  const riskScore = profile?.risk_score ?? fallback.riskScore;
  return {
    id:          row.id,
    name:        row.name,
    assetNumber: row.equipment_code ?? row.id.slice(0, 8).toUpperCase(),
    type:        (row.equipment_type ?? "EQUIPMENT").toUpperCase(),
    area:        row.area ?? "—",
    riskScore,
    riskLevel,
    breakdown: profile
      ? riskBreakdownFromProfile(profile)
      : riskBreakdownFor(riskLevel, row.name, row.equipment_type, row.equipment_code),
  };
}

function isStaleDemoImage(imageUrl: string | null | undefined): boolean {
  if (!imageUrl) return true;
  const v = imageUrl.toLowerCase();
  return (
    v.includes("pexels.com") ||
    v.includes("palletiser%20cell") ||
    v.includes("palletiser cell") ||
    v.includes("kuka%20kr%20210") ||
    v.includes("kuka kr 210") ||
    (v.includes("data:image/svg+xml") && v.includes("palletiser"))
  );
}

function resolveEquipmentDisplayImage(row: EquipmentAssetRow): string {
  const placeholder = resolveEquipmentImage(row.name, row.equipment_type, row.equipment_code);
  return isStaleDemoImage(row.image_url) ? placeholder : row.image_url!;
}

function rowToEquipment(row: EquipmentAssetRow): Equipment {
  const fallback  = mapCriticality(row.criticality, row.name, row.equipment_type, row.equipment_code);
  const profile   = getRiskProfile(row);
  const riskLevel = profile?.risk_level ?? fallback.riskLevel;
  const riskScore = profile?.risk_score ?? fallback.riskScore;
  return {
    id:           row.id,
    name:         row.name,
    assetNumber:  row.equipment_code ?? row.id.slice(0, 8).toUpperCase(),
    type:         (row.equipment_type ?? "EQUIPMENT").toUpperCase(),
    area:         row.area ?? "—",
    manufacturer: row.oem ?? "—",
    model:        row.model ?? "—",
    serialNumber: "—",
    installDate:  "—",
    warranty:     "—",
    criticality:  row.criticality ?? "—",
    status:       (row.status as Equipment["status"]) ?? "Running",
    statusNote:   profile?.risk_summary ?? "",
    image:        resolveEquipmentDisplayImage(row),
    riskScore,
    riskLevel,
    riskBreakdown: profile
      ? riskBreakdownFromProfile(profile)
      : riskBreakdownFor(riskLevel, row.name, row.equipment_type, row.equipment_code),
  };
}

// ─── Equipment identity cache ─────────────────────────────────────────────────
// Populated on first fetch per ID so tab navigation never shows a stale flash.
const equipmentIdentityCache: Record<string, Equipment> = {};

export function getCachedEquipmentIdentity(id: string): Equipment | null {
  return equipmentIdentityCache[id] ?? null;
}

export async function getEquipmentIdentityById(id: string): Promise<Equipment> {
  if (equipmentIdentityCache[id]) return equipmentIdentityCache[id];
  try {
    const { data, error } = await supabase
      .from("equipment_assets")
      .select(`
        id,
        equipment_code,
        name,
        equipment_type,
        area,
        oem,
        model,
        criticality,
        status,
        image_url,
        equipment_risk_profiles (
          risk_score,
          risk_level,
          pm_backlog_pct,
          asset_criticality_pct,
          calibration_pct,
          skills_pct,
          spares_pct,
          calibration_overdue_count,
          overdue_pm_count,
          open_work_order_count,
          repeat_breakdown_count,
          single_point_skill_gap,
          critical_spares_missing,
          risk_summary,
          priority_action
        )
      `)
      .eq("id", id)
      .maybeSingle();

    if (!error && data) {
      const result = rowToEquipment(data as EquipmentAssetRow);
      equipmentIdentityCache[id] = result;
      return result;
    }
    if (error) console.warn("getEquipmentIdentityById failed, using fallback:", error.message);
  } catch (e) {
    console.warn("getEquipmentIdentityById threw, using fallback:", e);
  }
  const fallback = getEquipmentByIdFallback(id);
  equipmentIdentityCache[id] = fallback;
  return fallback;
}

export async function getEquipmentList(): Promise<EquipmentListItem[]> {
  const { data, error } = await supabase
    .from("equipment_assets")
    .select(`
      id,
      equipment_code,
      name,
      equipment_type,
      area,
      oem,
      model,
      criticality,
      status,
      image_url,
      equipment_risk_profiles (
        risk_score,
        risk_level,
        pm_backlog_pct,
        asset_criticality_pct,
        calibration_pct,
        skills_pct,
        spares_pct,
        calibration_overdue_count,
        overdue_pm_count,
        open_work_order_count,
        repeat_breakdown_count,
        single_point_skill_gap,
        critical_spares_missing,
        risk_summary,
        priority_action
      )
    `)
    .order("name");

  if (error || !data || data.length === 0) {
    if (error) console.warn("equipment_assets fetch failed, using mock fallback:", error.message);
    return MOCK_LIST;
  }

  return (data as EquipmentAssetRow[]).map(rowToListItem);
}

// ─── Service functions (mock — replace with Supabase when ready) ──────────────

export function getAllEquipment(): Equipment[] {
  return MOCK_EQUIPMENT;
}

export function getEquipmentById(id: string | undefined): Equipment | undefined {
  return MOCK_EQUIPMENT.find((e) => e.id === id);
}

// ─── work_orders row shape (matches DB columns) ──────────────────────────────

interface WorkOrderRow {
  id: string;
  equipment_id: string | null;
  priority: string | null;
  description: string | null;
  work_type: string | null;
  status: string | null;
  assigned_engineer: string | null;
  requested_date: string | null;
  due_date: string | null;
  completed_date: string | null;
  mttr_hours: number | null;
  outcome: string | null;
  wo_number: string | null;
  age_label: string | null;
  is_overdue: boolean | null;
}

function rowToWorkOrder(row: WorkOrderRow): WorkOrder {
  const priority = (row.priority?.toUpperCase() ?? "LOW") as WorkOrder["priority"];
  const status   = (row.status?.toUpperCase()   ?? "OPEN") as WorkOrder["status"];
  return {
    id:            row.wo_number ?? row.id,
    equipmentId:   row.equipment_id ?? "",
    priority,
    description:   row.description ?? "",
    type:          row.work_type ?? "—",
    status,
    engineer:      row.assigned_engineer ?? "—",
    requestedDate: row.requested_date ?? "",
    dueDate:       row.due_date ?? "",
    age:           row.age_label ?? "—",
    overdue:       row.is_overdue ?? false,
  };
}

function rowToCompletedWorkOrder(row: WorkOrderRow): CompletedWorkOrder {
  return {
    id:             row.wo_number ?? row.id,
    equipmentId:    row.equipment_id ?? "",
    description:    row.description ?? "",
    type:           row.work_type ?? "—",
    completedBy:    row.assigned_engineer ?? "—",
    completionDate: row.completed_date ?? "",
    mttr:           row.mttr_hours != null ? `${row.mttr_hours}h` : "—",
    outcome:        (row.outcome?.toUpperCase() ?? "SUCCESS") as CompletedWorkOrder["outcome"],
  };
}

export async function getEquipmentWorkOrders(equipmentId: string): Promise<{
  open: WorkOrder[];
  completed: CompletedWorkOrder[];
}> {
  try {
    const { data, error } = await supabase
      .from("work_orders")
      .select("id, equipment_id, priority, description, work_type, status, assigned_engineer, requested_date, due_date, completed_date, mttr_hours, outcome, wo_number, age_label, is_overdue")
      .eq("equipment_id", equipmentId);

    if (!error && data && data.length > 0) {
      const rows = data as WorkOrderRow[];
      return {
        open:      rows.filter((r) => r.status?.toUpperCase() !== "COMPLETED").map(rowToWorkOrder),
        completed: rows.filter((r) => r.status?.toUpperCase() === "COMPLETED").map(rowToCompletedWorkOrder),
      };
    }
    if (error) console.warn("getEquipmentWorkOrders Supabase error, using mock:", error.message);
  } catch (e) {
    console.warn("getEquipmentWorkOrders threw, using mock:", e);
  }
  const openMock = MOCK_WORK_ORDERS.filter((w) => w.equipmentId === equipmentId);
  const completedMock = MOCK_COMPLETED_WORK_ORDERS.filter((w) => w.equipmentId === equipmentId);
  return {
    open:      openMock.length > 0 ? openMock : MOCK_WORK_ORDERS.filter((w) => w.equipmentId === DEFAULT_EQUIPMENT_ID),
    completed: completedMock.length > 0 ? completedMock : MOCK_COMPLETED_WORK_ORDERS.filter((w) => w.equipmentId === DEFAULT_EQUIPMENT_ID),
  };
}

export async function getEquipmentPMs(equipmentId: string): Promise<PreventiveMaintenance[]> {
  try {
    const { data, error } = await supabase
      .from("preventive_maintenance")
      .select("id, equipment_id, title, pm_number, frequency, pm_type, last_completed_date, next_due_date, status, completion_percentage")
      .eq("equipment_id", equipmentId);

    if (!error && data && data.length > 0) {
      return data.map((row) => ({
        id:            row.id,
        equipmentId:   row.equipment_id ?? "",
        name:          row.title ?? "",
        code:          row.pm_number ?? "",
        frequency:     row.frequency ?? "",
        type:          row.pm_type ?? "",
        lastCompleted: row.last_completed_date ?? "",
        nextDue:       row.next_due_date ?? "",
        status:        (row.status as PreventiveMaintenance["status"]) ?? "ON TRACK",
        compliance:    row.completion_percentage ?? 0,
      }));
    }
    if (error) console.warn("getEquipmentPMs Supabase error, using mock:", error.message);
  } catch (e) {
    console.warn("getEquipmentPMs threw, using mock:", e);
  }
  const pmMock = MOCK_PMS.filter((p) => p.equipmentId === equipmentId);
  return pmMock.length > 0
    ? pmMock
    : MOCK_PMS.filter((p) => p.equipmentId === DEFAULT_EQUIPMENT_ID);
}

export interface SkillCoverage {
  skillId: string;
  name: string;
  requiredLevel: number;
  highestValidatedLevel: number;
  coverage: "green" | "amber" | "red";
  engineerCount: number;
}

export interface EngineerMatch {
  id: string;
  initials: string;
  name: string;
  role: string;
  availability: string;
  shift: string;
  matchPercent: number;
  relevantSkillCount: number;
}

export interface SkillsCoverageSummary {
  covered: number;
  atRisk: number;
  missing: number;
  coveragePercent: number;
}

export async function getEquipmentSkills(equipmentId: string): Promise<{
  skills: SkillCoverage[];
  engineers: EngineerMatch[];
  coverageSummary: SkillsCoverageSummary;
  legacySkills: EquipmentSkill[];
  legacyEngineers: Engineer[];
}> {
  try {
    // 1. Required skills for this equipment
    const { data: reqRows, error: reqErr } = await supabase
      .from("equipment_required_skills")
      .select("skill_id, required_level")
      .eq("equipment_id", equipmentId);

    if (reqErr) throw reqErr;
    if (!reqRows || reqRows.length === 0) throw new Error("no rows");

    const skillIds: string[] = reqRows.map((r: any) => r.skill_id);

    // 2. Skill names
    const { data: skillRows, error: skillErr } = await supabase
      .from("skills")
      .select("id, name")
      .in("id", skillIds);
    if (skillErr) throw skillErr;

    const skillNameMap: Record<string, string> = {};
    for (const s of skillRows ?? []) skillNameMap[s.id] = s.name;

    // 3. All engineer_skills for these skill IDs
    const { data: engSkillRows, error: esErr } = await supabase
      .from("engineer_skills")
      .select("engineer_id, skill_id, validated_rating, manager_rating")
      .in("skill_id", skillIds);
    if (esErr) throw esErr;

    // Build map: skill_id -> list of {engineer_id, level}
    const skillToEngineers: Record<string, { engineerId: string; level: number }[]> = {};
    for (const es of engSkillRows ?? []) {
      const level = es.validated_rating ?? es.manager_rating ?? 0;
      if (!skillToEngineers[es.skill_id]) skillToEngineers[es.skill_id] = [];
      skillToEngineers[es.skill_id].push({ engineerId: es.engineer_id, level });
    }

    // 4. All unique engineer IDs that have at least one relevant skill
    const allEngIds = [...new Set((engSkillRows ?? []).map((r: any) => r.engineer_id))];

    // 5. Engineer details
    const { data: engRows, error: engErr } = await supabase
      .from("engineers")
      .select("id, full_name, discipline, employment_type, availability_status, shift_pattern")
      .in("id", allEngIds);
    if (engErr) throw engErr;

    const engMap: Record<string, any> = {};
    for (const e of engRows ?? []) engMap[e.id] = e;

    // 6. Build SkillCoverage[]
    const skills: SkillCoverage[] = reqRows.map((req: any) => {
      const reqLevel: number = req.required_level ?? 1;
      const engineers = skillToEngineers[req.skill_id] ?? [];
      const highestLevel = engineers.reduce((max, e) => Math.max(max, e.level), 0);
      let coverage: "green" | "amber" | "red";
      if (highestLevel >= reqLevel)          coverage = "green";
      else if (highestLevel === reqLevel - 1) coverage = "amber";
      else                                    coverage = "red";
      return {
        skillId:               req.skill_id,
        name:                  skillNameMap[req.skill_id] ?? req.skill_id,
        requiredLevel:         reqLevel,
        highestValidatedLevel: highestLevel,
        coverage,
        engineerCount:         engineers.length,
      };
    });

    // 7. Build EngineerMatch[]
    // For each engineer count how many required skills they hold at >= required level
    const engineers: EngineerMatch[] = allEngIds.map((eid) => {
      const eng = engMap[eid];
      const name: string = eng?.full_name ?? eid;
      const initials = name.split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase();
      // Count relevant skills (any rating > 0 for a required skill)
      const relevantSkillCount = (engSkillRows ?? []).filter(
        (es: any) => es.engineer_id === eid && (es.validated_rating ?? es.manager_rating ?? 0) > 0,
      ).length;
      // Match % = (skills this engineer covers at or above required level) / total required skills * 100
      const matchCount = reqRows.filter((req: any) => {
        const es = (engSkillRows ?? []).find(
          (e: any) => e.engineer_id === eid && e.skill_id === req.skill_id,
        );
        const myLevel = es ? (es.validated_rating ?? es.manager_rating ?? 0) : 0;
        return myLevel >= (req.required_level ?? 1);
      }).length;
      const matchPercent = Math.round((matchCount / reqRows.length) * 100);
      const avail: string = eng?.availability_status ?? "Unknown";
      const shift: string = eng?.shift_pattern ?? "Days";
      return { id: eid, initials, name, role: eng?.discipline ?? eng?.employment_type ?? "", availability: avail, shift, matchPercent, relevantSkillCount };
    }).sort((a, b) => b.matchPercent - a.matchPercent);

    // 8. Coverage summary
    const covered = skills.filter((s) => s.coverage === "green").length;
    const atRisk  = skills.filter((s) => s.coverage === "amber").length;
    const missing = skills.filter((s) => s.coverage === "red").length;
    const coveragePercent = Math.round((covered / skills.length) * 100);

    // 9. Legacy shapes for unchanged parts of the UI
    const legacySkills: EquipmentSkill[] = skills.map((s) => ({
      equipmentId,
      name:    s.name,
      covered: s.coverage === "green",
    }));
    const legacyEngineers: Engineer[] = engineers.map((e) => ({
      id:       e.id,
      initials: e.initials,
      name:     e.name,
      role:     e.role,
      match:    e.matchPercent,
      status:   e.availability,
      shift:    e.shift,
    }));

    return { skills, engineers, coverageSummary: { covered, atRisk, missing, coveragePercent }, legacySkills, legacyEngineers };
  } catch (e: any) {
    if (e?.message !== "no rows") console.warn("getEquipmentSkills Supabase error, using mock:", e?.message ?? e);
    const mockResult = {
      skills:    MOCK_SKILLS.filter((s) => s.equipmentId === equipmentId),
      engineers: MOCK_ENGINEERS,
    };
    const fallbackSkills = mockResult.skills;
    const fallbackEngineers = MOCK_ENGINEERS;
    return {
      skills: [],
      engineers: [],
      coverageSummary: { covered: 0, atRisk: 0, missing: 0, coveragePercent: 0 },
      legacySkills:    fallbackSkills.length > 0
        ? fallbackSkills
        : MOCK_SKILLS.filter((s) => s.equipmentId === DEFAULT_EQUIPMENT_ID),
      legacyEngineers: fallbackEngineers,
    };
  }
}

export interface EquipmentComponent {
  name: string;
  partNumber: string;
  stock: number;
  max: number;
  status: string;
  supplier: string;
  manufacturer: string;
  location: string;
  criticality: string;
  unitCost: number;
  leadDays: number;
}

export interface EquipmentComponentsResult {
  inventory: EquipmentComponent[];
  criticalComponents: EquipmentComponent[];
  stockSummary: {
    totalComponents: number;
    outOfStock: number;
    lowStock: number;
    okStock: number;
  };
}

export async function getEquipmentComponents(equipmentId: string): Promise<EquipmentComponentsResult> {
  const empty: EquipmentComponentsResult = {
    inventory: [],
    criticalComponents: [],
    stockSummary: { totalComponents: 0, outOfStock: 0, lowStock: 0, okStock: 0 },
  };
  try {
    const { data, error } = await supabase
      .from("equipment_components")
      .select("component_name, component_code, quantity_available, quantity_target, availability_status, vendor_name, maker_name, storage_location, criticality, unit_cost, lead_days")
      .eq("equipment_id", equipmentId)
      .order("component_name");

    if (error) {
      console.warn("getEquipmentComponents failed:", error.message);
      return empty;
    }

    const inventory: EquipmentComponent[] = (data ?? []).map((r) => ({
      name:         r.component_name ?? "",
      partNumber:   r.component_code ?? "",
      stock:        r.quantity_available ?? 0,
      max:          r.quantity_target ?? 0,
      status:       r.availability_status ?? "",
      supplier:     r.vendor_name ?? "",
      manufacturer: r.maker_name ?? "",
      location:     r.storage_location ?? "",
      criticality:  r.criticality ?? "",
      unitCost:     r.unit_cost ?? 0,
      leadDays:     r.lead_days ?? 0,
    }));

    const criticalComponents = inventory.filter(
      (c) => c.status === "Out of Stock" || c.status === "Low Stock"
    );

    const outOfStock = inventory.filter((c) => c.status === "Out of Stock").length;
    const lowStock   = inventory.filter((c) => c.status === "Low Stock").length;

    return {
      inventory,
      criticalComponents,
      stockSummary: {
        totalComponents: inventory.length,
        outOfStock,
        lowStock,
        okStock: inventory.length - outOfStock - lowStock,
      },
    };
  } catch (e) {
    console.warn("getEquipmentComponents threw:", e);
    return empty;
  }
}

export function getEquipmentSpares(equipmentId: string): SparePart[] {
  return MOCK_SPARES.filter((s) => s.equipmentId === equipmentId);
}

export function getEquipmentDocuments(equipmentId: string): EquipmentDocument[] {
  return MOCK_DOCUMENTS.filter((d) => d.equipmentId === equipmentId);
}

function formatDowntime(minutes: number | null): string {
  if (minutes == null) return "0h 00m";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h ${String(m).padStart(2, "0")}m`;
}

export async function getEquipmentActivity(equipmentId: string): Promise<EquipmentActivity[]> {
  try {
    const { data, error } = await supabase
      .from("work_orders")
      .select("id, equipment_id, wo_number, work_type, priority, description, downtime_minutes, outcome, status, completed_date, requested_date")
      .eq("equipment_id", equipmentId)
      .order("completed_date", { ascending: false, nullsFirst: false })
      .order("requested_date", { ascending: false });

    if (!error && data && data.length > 0) {
      return data.map((row) => ({
        id:          row.id,
        equipmentId: row.equipment_id ?? "",
        date:        row.completed_date ?? row.requested_date ?? "",
        woNumber:    row.wo_number ?? row.id,
        type:        (row.work_type?.toUpperCase() ?? "CORRECTIVE") as EquipmentActivity["type"],
        priority:    (row.priority?.toUpperCase() ?? "MEDIUM") as EquipmentActivity["priority"],
        description: row.description ?? "",
        downtime:    formatDowntime(row.downtime_minutes),
        outcome:     (row.outcome?.toUpperCase() ?? row.status?.toUpperCase() ?? "OPEN") as EquipmentActivity["outcome"],
      }));
    }
    if (error) console.warn("getEquipmentActivity Supabase error, using mock:", error.message);
  } catch (e) {
    console.warn("getEquipmentActivity threw, using mock:", e);
  }
  const activityMock = MOCK_ACTIVITY.filter((a) => a.equipmentId === equipmentId);
  return activityMock.length > 0
    ? activityMock
    : MOCK_ACTIVITY.filter((a) => a.equipmentId === DEFAULT_EQUIPMENT_ID);
}

export function getEquipmentAiInsights(equipmentId: string): AiInsight[] {
  return MOCK_AI_INSIGHTS.filter((i) => i.equipmentId === equipmentId);
}

// ─── Shared equipment summary ─────────────────────────────────────────────────

export interface EquipmentSummary {
  equipment: Equipment;
  workOrders: Awaited<ReturnType<typeof getEquipmentWorkOrders>>;
  pms: PreventiveMaintenance[];
  skills: Awaited<ReturnType<typeof getEquipmentSkills>>;
  components: EquipmentComponentsResult;
  documents: EquipmentDocument[];
  activity: EquipmentActivity[];
  aiInsights: AiInsight[];
}

export async function getEquipmentSummary(equipmentId: string): Promise<EquipmentSummary> {
  const [
    equipment,
    workOrders,
    pms,
    skills,
    components,
    documents,
    activity,
    aiInsights,
  ] = await Promise.all([
    getEquipmentIdentityById(equipmentId),
    getEquipmentWorkOrders(equipmentId),
    getEquipmentPMs(equipmentId),
    getEquipmentSkills(equipmentId),
    getEquipmentComponents(equipmentId),
    Promise.resolve(getEquipmentDocuments(equipmentId)),
    getEquipmentActivity(equipmentId),
    Promise.resolve(getEquipmentAiInsights(equipmentId)),
  ]);
  return {
    equipment,
    workOrders,
    pms,
    skills,
    components,
    documents,
    activity,
    aiInsights,
  };
}

// ─── Building group definitions ───────────────────────────────────────────────

export const BUILDING_GROUPS: Record<string, { label: string; areas: string[] }> = {
  B1: { label: "Building 1",   areas: ["Biologics", "Media Prep", "Sterile Prep"] },
  B2: { label: "Building 2",   areas: ["Packaging", "Fill-Finish", "Inspection"] },
  BU: { label: "Utilities",    areas: ["Utilities"] },
  BW: { label: "Warehouse",    areas: ["Warehouse"] },
  BP: { label: "Purification", areas: ["Purification", "Lyophilisation"] },
};

export function resolveBuilding(code: string): { label: string; areas: string[] } | null {
  return BUILDING_GROUPS[code] ?? null;
}

export interface BuildingGroupStats {
  code: string;
  label: string;
  totalAssets: number;
  highestRiskScore: number;
  criticalCount: number;
  openWorkOrders: number;
  overduePms: number;
}

export const MOCK_BUILDING_STATS: BuildingGroupStats[] = [
  { code: "B1", label: "Building 1",   totalAssets: 28, highestRiskScore: 45, criticalCount: 3,  openWorkOrders: 2,  overduePms: 1 },
  { code: "B2", label: "Building 2",   totalAssets: 34, highestRiskScore: 92, criticalCount: 12, openWorkOrders: 8,  overduePms: 4 },
  { code: "BU", label: "Utilities",    totalAssets: 18, highestRiskScore: 64, criticalCount: 5,  openWorkOrders: 3,  overduePms: 1 },
  { code: "BW", label: "Warehouse",    totalAssets: 12, highestRiskScore: 42, criticalCount: 2,  openWorkOrders: 1,  overduePms: 0 },
  { code: "BP", label: "Purification", totalAssets: 22, highestRiskScore: 28, criticalCount: 1,  openWorkOrders: 1,  overduePms: 0 },
];

export async function getBuildingGroupStats(): Promise<BuildingGroupStats[]> {
  try {
    const [assetsResult, woResult] = await Promise.all([
      supabase.from("equipment_assets").select("id, area, criticality"),
      supabase.from("work_orders").select("equipment_id, status, is_overdue, priority"),
    ]);

    const assets = (assetsResult.data ?? []) as {
      id: string;
      area: string | null;
      criticality: string | null;
    }[];

    const workOrders = (woResult.data ?? []) as {
      equipment_id: string | null;
      status: string | null;
      is_overdue: boolean | null;
      priority: string | null;
    }[];

    // No data at all → fall back to mock
    if (assets.length === 0) return MOCK_BUILDING_STATS;

    // Build per-asset open-WO summary for risk score enrichment
    const woMap = new Map<string, { open: number; overdue: number; criticalOpen: number }>();
    for (const wo of workOrders) {
      if (!wo.equipment_id) continue;
      const isOpen = (wo.status ?? "").toLowerCase() !== "completed";
      if (!isOpen) continue;
      const entry = woMap.get(wo.equipment_id) ?? { open: 0, overdue: 0, criticalOpen: 0 };
      entry.open += 1;
      if (wo.is_overdue === true) entry.overdue += 1;
      if ((wo.priority ?? "").toLowerCase() === "critical") entry.criticalOpen += 1;
      woMap.set(wo.equipment_id, entry);
    }

    // Per-asset composite risk score: criticality base + work-order pressure
    function assetRiskScore(criticality: string | null, wos: { open: number; overdue: number; criticalOpen: number }): number {
      let base: number;
      switch (criticality?.toLowerCase()) {
        case "critical": base = 80; break;
        case "high":     base = 60; break;
        case "medium":   base = 40; break;
        case "low":      base = 20; break;
        default:         base = 10;
      }
      const woBonus = Math.min(20, wos.open * 3 + wos.overdue * 5 + wos.criticalOpen * 4);
      return Math.min(100, base + woBonus);
    }

    const stats = Object.entries(BUILDING_GROUPS).map(([code, group]) => {
      const groupAssets = assets.filter((a) => group.areas.includes(a.area ?? ""));
      const groupIdSet  = new Set(groupAssets.map((a) => a.id));
      const groupWOs    = workOrders.filter((wo) => wo.equipment_id && groupIdSet.has(wo.equipment_id));

      const scores = groupAssets.map((a) =>
        assetRiskScore(a.criticality, woMap.get(a.id) ?? { open: 0, overdue: 0, criticalOpen: 0 })
      );

      return {
        code,
        label:            group.label,
        totalAssets:      groupAssets.length,
        highestRiskScore: scores.reduce((max, s) => Math.max(max, s), 0),
        criticalCount:    groupAssets.filter((a) => a.criticality?.toLowerCase() === "critical").length,
        openWorkOrders:   groupWOs.filter((wo) => (wo.status ?? "").toLowerCase() !== "completed").length,
        overduePms:       groupWOs.filter((wo) => wo.is_overdue === true).length,
      };
    });

    // If no group matched any area (e.g. live areas use different names), fall back to mock
    const hasData = stats.some((s) => s.totalAssets > 0);
    return hasData ? stats : MOCK_BUILDING_STATS;
  } catch (e) {
    console.warn("getBuildingGroupStats failed, using mock:", e);
    return MOCK_BUILDING_STATS;
  }
}
