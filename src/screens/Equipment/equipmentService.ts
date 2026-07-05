// ─── Equipment Service ────────────────────────────────────────────────────────
// All data access for the Equipment section goes through this file.
// Currently returns mock data. Replace function bodies with Supabase queries
// when ready — no page files need to change.

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

export function getAllEquipment(): Equipment[] {
  return MOCK_EQUIPMENT;
}

export function getEquipmentById(id: string | undefined): Equipment | undefined {
  return MOCK_EQUIPMENT.find((e) => e.id === id);
}

export function getEquipmentWorkOrders(equipmentId: string): {
  open: WorkOrder[];
  completed: CompletedWorkOrder[];
} {
  return {
    open:      MOCK_WORK_ORDERS.filter((w) => w.equipmentId === equipmentId),
    completed: MOCK_COMPLETED_WORK_ORDERS.filter((w) => w.equipmentId === equipmentId),
  };
}

export function getEquipmentPMs(equipmentId: string): PreventiveMaintenance[] {
  return MOCK_PMS.filter((p) => p.equipmentId === equipmentId);
}

export function getEquipmentSkills(equipmentId: string): {
  skills: EquipmentSkill[];
  engineers: Engineer[];
} {
  return {
    skills:    MOCK_SKILLS.filter((s) => s.equipmentId === equipmentId),
    engineers: MOCK_ENGINEERS,
  };
}

export function getEquipmentSpares(equipmentId: string): SparePart[] {
  return MOCK_SPARES.filter((s) => s.equipmentId === equipmentId);
}

export function getEquipmentDocuments(equipmentId: string): EquipmentDocument[] {
  return MOCK_DOCUMENTS.filter((d) => d.equipmentId === equipmentId);
}

export function getEquipmentActivity(equipmentId: string): EquipmentActivity[] {
  return MOCK_ACTIVITY.filter((a) => a.equipmentId === equipmentId);
}

export function getEquipmentAiInsights(equipmentId: string): AiInsight[] {
  return MOCK_AI_INSIGHTS.filter((i) => i.equipmentId === equipmentId);
}
