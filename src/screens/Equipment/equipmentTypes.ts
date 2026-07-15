// ─── Core enums / union types ─────────────────────────────────────────────────

export type EquipmentStatus = "Running" | "At Risk" | "Offline" | "Maintenance";

export type EquipmentRiskLevel = "Low" | "Medium" | "High" | "Critical";

// ─── Equipment identity ───────────────────────────────────────────────────────

export interface EquipmentRiskBreakdown {
  label: string;
  pct: number;
  color: string;
  dotClass: string;
}

export interface Equipment {
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
  status: EquipmentStatus;
  statusNote: string;
  image: string;
  riskScore: number;
  riskLevel: EquipmentRiskLevel;
  riskBreakdown: EquipmentRiskBreakdown[];
}

// ─── Work Orders ──────────────────────────────────────────────────────────────

export type WorkOrderPriority = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
export type WorkOrderStatus = "OPEN" | "IN PROGRESS" | "ON HOLD" | "WAITING PARTS";
export type WorkOrderOutcome = "SUCCESS" | "PARTIAL" | "FAILED";

export interface WorkOrder {
  id: string;
  equipmentId: string;
  priority: WorkOrderPriority;
  description: string;
  type: string;
  status: WorkOrderStatus;
  engineer: string;
  requestedDate: string;
  dueDate: string;
  age: string;
  overdue?: boolean;
}

export interface CompletedWorkOrder {
  id: string;
  equipmentId: string;
  description: string;
  type: string;
  completedBy: string;
  completionDate: string;
  mttr: string;
  outcome: WorkOrderOutcome;
}

// ─── Preventive Maintenance ───────────────────────────────────────────────────

export type PmStatus = "ON TRACK" | "DUE SOON" | "OVERDUE" | "COMPLETED";

export interface PreventiveMaintenance {
  id: string;
  equipmentId: string;
  name: string;
  code: string;
  frequency: string;
  type: string;
  lastCompleted: string;
  nextDue: string;
  status: PmStatus;
  compliance: number;
}

// ─── Skills & Engineers ───────────────────────────────────────────────────────

export interface EquipmentSkill {
  equipmentId: string;
  name: string;
  covered: boolean;
}

export interface Engineer {
  id: string;
  initials: string;
  name: string;
  role: string;
  match: number;
  status: string;
  shift: string;
}

// ─── Spare Parts ──────────────────────────────────────────────────────────────

export type StockStatus = "Out of Stock" | "Low Stock" | "OK";

export interface SparePart {
  id: string;
  equipmentId: string;
  name: string;
  partNumber: string;
  stock: number;
  max: number;
  status: StockStatus;
}

// ─── Documents ────────────────────────────────────────────────────────────────

export type DocumentStatus =
  | "Current"
  | "Expiring"
  | "Review Due"
  | "Expired"
  | "active"
  | "draft"
  | "archived"
  | "superseded"
  | "review_due";

export interface EquipmentDocument {
  id: string;
  equipmentId: string;
  siteId?: string | null;

  name: string;
  category: string;
  date: string;
  size: string;
  status: DocumentStatus;

  title?: string;
  documentType?: string;
  sourceSystem?: string;
  sourceUrl?: string | null;
  originalSourceUrl?: string | null;
  fileId?: string | null;
  externalReference?: string | null;
  drawingNumber?: string | null;
  sheetNumber?: string | null;
  manualSection?: string | null;
  pageNumber?: number | null;
  revision?: string | null;
  faultCodes?: string[];
  componentTags?: string[];
  oem?: string | null;
  description?: string | null;
  extractedSummary?: string | null;
  lastIndexedAt?: string | null;
  aiIndexed?: boolean;
}

// ─── Activity / History ───────────────────────────────────────────────────────

export type HistoryType = "BREAKDOWN" | "CORRECTIVE" | "PREVENTIVE" | "INSPECTION" | "PARTS";
export type HistoryOutcome = "RESOLVED" | "PARTIAL" | "OPEN";

export interface EquipmentActivity {
  id: string;
  equipmentId: string;
  date: string;
  woNumber: string;
  type: HistoryType;
  priority: WorkOrderPriority;
  description: string;
  downtime: string;
  outcome: HistoryOutcome;
}

// ─── AI Insights ─────────────────────────────────────────────────────────────

export type AiInsightSeverity = "HIGH" | "MEDIUM" | "LOW";

export interface AiInsight {
  id: string;
  equipmentId: string;
  type: "risk" | "recommendation" | "pattern" | "opportunity";
  title: string;
  description: string;
  severity: AiInsightSeverity;
  confidence: number;
  createdAt: string;
}
