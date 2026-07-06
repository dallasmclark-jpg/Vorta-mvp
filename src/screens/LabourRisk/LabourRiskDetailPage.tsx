import { useState, useCallback, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ChevronRight,
  AlertTriangle,
  Users,
  X,
  Sparkles,
  TrendingUp,
  TrendingDown,
} from "lucide-react";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Card, CardContent } from "../../components/ui/card";
import { Progress } from "../../components/ui/progress";

// ─────────────────────────────────────────────────────────────────────────────
// SHIFT COVER — Types
// ─────────────────────────────────────────────────────────────────────────────

type CellStatus = "covered" | "partial" | "gap" | "off" | "contractor";
type FilterType = "all" | "day" | "night" | "electrical" | "mechanical" | "plc" | "contractors";
type DrawerMode = "risk-summary" | "shift-cell" | "month-day";
type ShiftPatternType = "day" | "night" | "off";

interface ScEngineer {
  initials: string;
  name: string;
  role: string;
  skills: string[];
}

interface RotaCell {
  status: CellStatus;
  engineers: string[];
  dotColor?: "red" | "amber" | "purple" | "blue";
  detailKey?: string;
}

interface MonthDayShiftSummary {
  shiftType: "Day" | "Night";
  teamLabel: string;
  shiftClass: string;
  status: CellStatus;
  engineers: ScEngineer[];
  riskLevel: ShiftCellDetail["riskLevel"];
  dotColor?: RotaCell["dotColor"];
  recommendedAction: string;
}

interface MonthDayDetail {
  dateLabel: string;
  dayOfMonth: number;
  shifts: MonthDayShiftSummary[];
}

interface ShiftCellDetail {
  day: string;
  shiftType: "Day" | "Night";
  coverage: string;
  riskLevel: "Critical" | "High" | "Med" | "Low" | "Clear";
  engineers: ScEngineer[];
  skillsCovered: string[];
  skillsMissing: string[];
  plannedWork: string;
  currentBreakdowns: string;
  recommendedActions: string;
}

interface CoverPoolRow {
  id: string;
  initials: string;
  name: string;
  role: string;
  avatarColor: string;
  currentShift: string;
  keySkills: string[];
  rating: number;
  availabilityText: string;
  risk: "Low" | "Medium" | "High" | "Critical";
  assignNote?: string;
}

interface CoverIssue {
  id: string;
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  title: string;
  location: string;
}

interface AiCoverAction {
  id: string;
  title: string;
  confidence: number;
  details: string[];
  actionLabel: "Open" | "Review" | "Risk";
}

// ─────────────────────────────────────────────────────────────────────────────
// SHIFT COVER — Static data
// ─────────────────────────────────────────────────────────────────────────────

const SC_ENGINEERS: Record<string, ScEngineer> = {
  JH:   { initials: "JH",   name: "James Hadley",   role: "Maint. Engineer",   skills: ["PLC", "CMMS"] },
  SM:   { initials: "SM",   name: "Sarah Mitchell", role: "Maint. Engineer",   skills: ["PLC", "Siemens S7", "Electrical"] },
  TO:   { initials: "TO",   name: "Tom Okafor",     role: "Maint. Engineer",   skills: ["Hydraulics", "Pneumatics"] },
  EP:   { initials: "EP",   name: "Emma Patel",     role: "Technician",        skills: ["CMMS", "H&S"] },
  LD:   { initials: "LD",   name: "Liam Donovan",   role: "Apprentice",        skills: ["Welding", "H&S"] },
  PK:   { initials: "PK",   name: "Paul Kenton",    role: "Senior Engineer",   skills: ["Mechanical", "SAP PM"] },
  AM:   { initials: "AM",   name: "Aisha Mensah",   role: "Lead Engineer",     skills: ["PLC", "Siemens S7"] },
  DF:   { initials: "DF",   name: "Dan Forsyth",    role: "Maint. Engineer",   skills: ["Mech Fit", "CMMS"] },
  BT:   { initials: "BT",   name: "Ben Thomas",     role: "Maint. Engineer",   skills: ["Electrical", "CMMS"] },
  CW:   { initials: "CW",   name: "Chloe Watts",    role: "Junior Tech",       skills: ["H&S", "CMMS"] },
  RT:   { initials: "RT",   name: "Ryan Tate",      role: "Maint. Engineer",   skills: ["Hydraulics", "Pneumatics"] },
  PS:   { initials: "PS",   name: "Priya Sharma",   role: "Senior Engineer",   skills: ["Electrical", "HV"] },
  CONT: { initials: "CO",   name: "Contractor",     role: "External",          skills: ["General"] },
};

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

const CONTINENTAL_CYCLE: ShiftPatternType[] = ["day", "day", "night", "night", "off", "off", "off", "off"];
const SHIFT_REF_DATE = new Date("2024-01-01T00:00:00Z");
const MS_PER_DAY = 24 * 60 * 60 * 1000;

function getWeekMonday(date: Date): Date {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  const dow = d.getUTCDay();
  d.setUTCDate(d.getUTCDate() + (dow === 0 ? -6 : 1 - dow));
  return d;
}

function getShiftType(date: Date, offset: number): ShiftPatternType {
  const daysSinceRef = Math.floor((date.getTime() - SHIFT_REF_DATE.getTime()) / MS_PER_DAY);
  const cycleIndex = ((daysSinceRef + offset) % 8 + 8) % 8;
  return CONTINENTAL_CYCLE[cycleIndex];
}

interface TeamConfig {
  id: string;
  label: string;
  shiftClass: string;
  type: "continental" | "days";
  offset: number;
  dayEngineers: string[];
  nightEngineers: string[];
}

const TEAM_CONFIGS: TeamConfig[] = [
  {
    id: "team-a", label: "Yellow Shift",
    shiftClass: "bg-yellow-500/20 text-yellow-300 border-yellow-500/30",
    type: "continental", offset: 0,
    dayEngineers: ["JH", "SM"], nightEngineers: ["PK", "LD"],
  },
  {
    id: "team-b", label: "Red Shift",
    shiftClass: "bg-red-500/20 text-red-300 border-red-500/30",
    type: "continental", offset: 2,
    dayEngineers: ["DF", "BT"], nightEngineers: ["SM", "JH", "TO"],
  },
  {
    id: "team-c", label: "Green Shift",
    shiftClass: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
    type: "continental", offset: 4,
    dayEngineers: ["PK", "AM"], nightEngineers: ["SM", "LD"],
  },
  {
    id: "team-d", label: "Blue Shift",
    shiftClass: "bg-blue-500/20 text-blue-300 border-blue-500/30",
    type: "continental", offset: 6,
    dayEngineers: ["EP", "AM"], nightEngineers: ["EP", "AM"],
  },
  {
    id: "team-e", label: "Days",
    shiftClass: "bg-slate-500/20 text-slate-300 border-slate-500/30",
    type: "days", offset: 0,
    dayEngineers: ["CW", "LD"], nightEngineers: [],
  },
];

const ROTA_OVERLAYS: Record<string, { status?: CellStatus; dotColor?: RotaCell["dotColor"]; engineers?: string[]; detailKey?: string }> = {
  "Red Shift-Tue-night":   { status: "partial",    dotColor: "amber",  detailKey: "team-b-Tue-night" },
  "Red Shift-Fri-night":   { status: "gap",         dotColor: "red",    engineers: [], detailKey: "team-b-Fri-night" },
  "Red Shift-Sat-night":   { status: "gap",         dotColor: "red",    engineers: [] },
  "Green Shift-Mon-night": { dotColor: "purple" },
  "Green Shift-Sat-night": { status: "partial",    dotColor: "amber",  engineers: ["SM"] },
  "Blue Shift-Fri-night":  { status: "contractor", dotColor: "blue",   engineers: ["CONT"] },
};

const CELL_DETAILS: Record<string, ShiftCellDetail> = {
  "team-b-Tue-night": {
    teamLabel: "Team B", day: "Tue", shiftType: "Night",
    coverage: "Partial Cover", riskLevel: "High",
    engineers: [SC_ENGINEERS.SM, SC_ENGINEERS.JH, SC_ENGINEERS.TO],
    skillsCovered: ["Mechanical", "Hydraulics", "SAP PM"],
    skillsMissing: ["PLC", "Electrical"],
    plannedWork: "PM10458, Case Packer inspection",
    currentBreakdowns: "Filling Line 2 PLC intermittent fault, Case Packer 4 gearbox issue",
    recommendedActions: "Assign Sarah Mitchell, Request contractor support, Move planned PM to day shift",
  },
  "team-b-Fri-night": {
    teamLabel: "Team B", day: "Fri", shiftType: "Night",
    coverage: "Critical Gap", riskLevel: "Critical",
    engineers: [],
    skillsCovered: [],
    skillsMissing: ["PLC", "Electrical", "Mechanical"],
    plannedWork: "PM10462 pending — unassigned",
    currentBreakdowns: "No active breakdowns — risk is unmanaged absence gap",
    recommendedActions: "Assign on-call contractor, alert shift manager, defer non-critical PMs",
  },
  "team-e-Fri-night": {
    teamLabel: "Team E", day: "Fri", shiftType: "Night",
    coverage: "Reduced Cover", riskLevel: "High",
    engineers: [SC_ENGINEERS.CW, SC_ENGINEERS.LD],
    skillsCovered: ["H&S", "CMMS"],
    skillsMissing: ["PLC", "Electrical", "Hydraulics"],
    plannedWork: "Line 3 lubrication and filter change",
    currentBreakdowns: "No active breakdowns — limited skill coverage overnight",
    recommendedActions: "Move James Hadley to Night Shift, escalate to Engineering Lead",
  },
};

const KPI_ITEMS = [
  { label: "Coverage Health",    value: "82%", changeText: "+2", positive: true,  sub: "4.4% vs last week"   },
  { label: "Open Shift Gaps",    value: "3",   changeText: "+1", positive: false, sub: "2 on Night Shift"    },
  { label: "Critical Night Gaps",value: "2",   changeText: "+1", positive: false, sub: "PLC + Electrical"    },
  { label: "Available Engineers", value: "17",  changeText: "−1", positive: false, sub: "3 available tonight" },
  { label: "AI Confidence",      value: "94%", changeText: "+1", positive: true,  sub: "Updated 4 mins ago"  },
];

const SHIFT_STATUS_LEGEND = [
  { label: "Fully Covered", color: "bg-emerald-500/20 border-emerald-500/30 text-emerald-400" },
  { label: "Reduced Cover", color: "bg-amber-500/20 border-amber-500/30 text-amber-400" },
  { label: "Critical Gap", color: "bg-red-500/20 border-red-500/30 text-red-400" },
  { label: "Contractor Cover", color: "bg-blue-500/20 border-blue-500/30 text-blue-400" },
  { label: "Off Shift", color: "bg-gray-700/40 border-gray-700 text-slate-500" },
];

const RISK_INDICATOR_LEGEND = [
  { label: "Missing Skill", color: "bg-red-500" },
  { label: "Reduced Resilience", color: "bg-amber-400" },
  { label: "SME Dependency", color: "bg-purple-400" },
  { label: "Contractor Involved", color: "bg-blue-400" },
];

const COVER_ISSUES: CoverIssue[] = [
  { id: "1", severity: "CRITICAL", title: "No PLC Engineer available tonight",      location: "Press Line • Night Shift"  },
  { id: "2", severity: "HIGH",     title: "Electrical night shift only has one engineer", location: "Fabrication • Night Shift" },
  { id: "3", severity: "HIGH",     title: "Weekend callout rota incomplete",        location: "All Sites • Weekend"       },
  { id: "4", severity: "MEDIUM",   title: "Mechanical cover reduced Friday",        location: "Assembly • Day Shift"      },
  { id: "5", severity: "LOW",      title: "Extra cover available Monday",           location: "Press Line • Day Shift"    },
];

const AI_ACTIONS: AiCoverAction[] = [
  {
    id: "1", title: "Assign James Hadley to Night Shift",
    confidence: 96, details: ["Mitigates PLC gap", "Mitigates PLC gap issues"], actionLabel: "Open",
  },
  {
    id: "2", title: "Move planned PM to Day Shift",
    confidence: 89, details: ["Restores Night Cover", "Reduces mechanical load Friday"], actionLabel: "Review",
  },
  {
    id: "3", title: "Approve overtime for Sarah Mitchell",
    confidence: 74, details: ["Balances Overtime", "Critical: no cover after 16:00"], actionLabel: "Risk",
  },
  {
    id: "4", title: "Request contractor support Friday",
    confidence: 91, details: ["Suitable for Q3 programme"], actionLabel: "Open",
  },
  {
    id: "5", title: "Escalate Filling Line 2 cover",
    confidence: 82, details: ["Restores Night Cover", "6 skills below threshold"], actionLabel: "Open",
  },
];

const COVER_POOL: CoverPoolRow[] = [
  { id: "jh", initials: "JH", name: "James Hadley",  role: "Maint. Engineer",  avatarColor: "bg-orange-500",  currentShift: "Day Shift",   keySkills: ["PLC", "CMMS"],        rating: 3.9, availabilityText: "—",      risk: "Medium" },
  { id: "sm", initials: "SM", name: "Sarah Mitchell",role: "Maint. Engineer",  avatarColor: "bg-teal-500",    currentShift: "Night Shift", keySkills: ["PLC", "Siemens S7"],  rating: 4.7, availabilityText: "—",      risk: "Low"    },
  { id: "to", initials: "TO", name: "Tom Okafor",    role: "Maint. Engineer",  avatarColor: "bg-emerald-600", currentShift: "Night Shift", keySkills: ["Hydraulics", "Pneum"],rating: 3.5, availabilityText: "1 needed",risk: "Medium", assignNote: "+Overtime" },
  { id: "ep", initials: "EP", name: "Emma Patel",    role: "Technician",       avatarColor: "bg-blue-500",    currentShift: "Day Shift",   keySkills: ["CMMS", "H&S"],        rating: 3.6, availabilityText: "2 needed",risk: "Medium" },
  { id: "ld", initials: "LD", name: "Liam Donovan",  role: "Apprentice",       avatarColor: "bg-purple-500",  currentShift: "Day Shift",   keySkills: ["Welding", "H&S"],     rating: 2.5, availabilityText: "4 needed",risk: "High",   assignNote: "+Approval" },
  { id: "ps", initials: "PS", name: "Priya Sharma",  role: "Senior Engineer",  avatarColor: "bg-pink-500",    currentShift: "Night Shift", keySkills: ["Electrical", "HV"],   rating: 4.1, availabilityText: "—",      risk: "Low"    },
  { id: "df", initials: "DF", name: "Dan Forsyth",   role: "Maint. Engineer",  avatarColor: "bg-slate-500",   currentShift: "Night Shift", keySkills: ["Mech Fit", "CMMS"],   rating: 3.3, availabilityText: "2 needed",risk: "Medium", assignNote: "+Travel ID" },
  { id: "am", initials: "AM", name: "Aisha Mensah",  role: "Lead Engineer",    avatarColor: "bg-teal-600",    currentShift: "Day Shift",   keySkills: ["PLC", "Siemens S7"],  rating: 4.6, availabilityText: "—",      risk: "Low"    },
  { id: "rt", initials: "RT", name: "Ryan Tate",     role: "Maint. Engineer",  avatarColor: "bg-blue-600",    currentShift: "Night Shift", keySkills: ["Hydraulics", "Pneum"],rating: 3.4, availabilityText: "1 needed",risk: "Medium", assignNote: "+Overtime" },
  { id: "cw", initials: "CW", name: "Chloe Watts",   role: "Junior Tech",      avatarColor: "bg-yellow-600",  currentShift: "Day Shift",   keySkills: ["H&S", "CMMS"],        rating: 2.1, availabilityText: "6 needed",risk: "Critical", assignNote: "+Approval" },
];

const RISK_SUMMARY_FIELDS: Array<{ label: string; value: string; valueClass?: string; isSkills?: boolean }> = [
  { label: "Overall Risk",        value: "Critical",                    valueClass: "text-red-400"     },
  { label: "Current Exposure",    value: "Night Shift"                                                  },
  { label: "Affected Areas",      value: "Filling Line 2, Case Packer 4"                               },
  { label: "Next Exposed Shift",  value: "Tonight 18:00",               valueClass: "text-red-400"     },
  { label: "Best Available Cover",value: "Sarah Mitchell"                                               },
  { label: "Escalation Status",   value: "Not Assigned",                valueClass: "text-amber-400"   },
  { label: "Current Cover",       value: "86%"                                                          },
  { label: "Cover Confidence",    value: "High",                        valueClass: "text-emerald-400" },
  { label: "Estimated Response",  value: "12 mins"                                                      },
  { label: "Escalation Level",    value: "Level 2",                     valueClass: "text-red-400"     },
  { label: "Open Actions",        value: "3"                                                            },
  { label: "Risk Trend",          value: "Increasing",                  valueClass: "text-red-400"     },
];

// ─────────────────────────────────────────────────────────────────────────────
// SHIFT COVER — Style maps
// ─────────────────────────────────────────────────────────────────────────────

const CELL_BG: Record<CellStatus, string> = {
  covered:    "bg-emerald-500/20 border border-emerald-500/30",
  partial:    "bg-amber-500/20 border border-amber-500/30",
  gap:        "bg-red-500/20 border border-red-500/30",
  off:        "",
  contractor: "bg-blue-500/20 border border-blue-500/30",
};

const CELL_TEXT: Record<CellStatus, string> = {
  covered:    "text-emerald-400",
  partial:    "text-amber-400",
  gap:        "text-red-400",
  off:        "text-slate-700",
  contractor: "text-blue-400",
};

const DOT_BG: Record<NonNullable<RotaCell["dotColor"]>, string> = {
  red:    "bg-red-500",
  amber:  "bg-amber-400",
  purple: "bg-purple-400",
  blue:   "bg-blue-400",
};

const SEVERITY_STYLES: Record<CoverIssue["severity"], string> = {
  CRITICAL: "bg-red-500/20 text-red-400",
  HIGH:     "bg-amber-500/20 text-amber-400",
  MEDIUM:   "bg-yellow-500/20 text-yellow-400",
  LOW:      "bg-slate-500/20 text-slate-400",
};

const RISK_BADGE: Record<CoverPoolRow["risk"], string> = {
  Low:      "bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20",
  Medium:   "bg-amber-500/20 text-amber-400 hover:bg-amber-500/20",
  High:     "bg-red-500/20 text-red-400 hover:bg-red-500/20",
  Critical: "bg-red-600/30 text-red-300 hover:bg-red-600/30",
};

const AI_ACTION_STYLE: Record<AiCoverAction["actionLabel"], string> = {
  Open:   "bg-emerald-500/20 text-emerald-400",
  Review: "bg-amber-500/20 text-amber-400",
  Risk:   "bg-red-500/20 text-red-400",
};

const RISK_LEVEL_TEXT: Record<ShiftCellDetail["riskLevel"], string> = {
  Critical: "text-red-400",
  High:     "text-amber-400",
  Med:      "text-yellow-400",
  Low:      "text-emerald-400",
  Clear:    "text-emerald-400",
};

// ─────────────────────────────────────────────────────────────────────────────
// SHIFT COVER — RotaCellView
// ─────────────────────────────────────────────────────────────────────────────

interface RotaCellViewProps {
  cell: RotaCell | null;
  shiftType: "Day" | "Night";
  teamId: string;
  dayIndex: number;
  onCellClick: (args: { teamId: string; dayIndex: number; shiftType: "Day" | "Night"; detailKey?: string }) => void;
  onEngineerClick: (eng: ScEngineer, e: React.MouseEvent) => void;
}

const RotaCellView = ({
  cell, shiftType, teamId, dayIndex, onCellClick, onEngineerClick,
}: RotaCellViewProps): JSX.Element => {
  if (!cell || cell.status === "off") {
    return (
      <div className="flex h-[46px] w-full items-center justify-center rounded">
        <span className="text-[10px] text-slate-700">OFF</span>
      </div>
    );
  }

  const engineers = cell.engineers.map(k => SC_ENGINEERS[k]).filter(Boolean);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onCellClick({ teamId, dayIndex, shiftType, detailKey: cell.detailKey })}
      onKeyDown={(e) => { if (e.key === "Enter") onCellClick({ teamId, dayIndex, shiftType, detailKey: cell.detailKey }); }}
      className={`relative flex h-[46px] w-full cursor-pointer flex-col gap-0.5 rounded px-1.5 py-1 transition-opacity hover:opacity-75 ${CELL_BG[cell.status]}`}
    >
      {cell.dotColor && (
        <span className={`absolute right-1 top-1 h-1.5 w-1.5 rounded-full ${DOT_BG[cell.dotColor]}`} aria-hidden="true" />
      )}
      <span className={`text-[9px] font-semibold leading-none opacity-60 ${CELL_TEXT[cell.status]}`}>
        {shiftType === "Day" ? "DAY" : "NIGHT"}
      </span>
      <div className="flex items-center gap-0.5 leading-none">
        {cell.status === "gap" ? (
          <span className="text-[10px] font-bold text-red-400">GAP</span>
        ) : engineers.length === 0 ? (
          <span className={`text-[10px] font-semibold ${CELL_TEXT[cell.status]}`}>—</span>
        ) : (
          engineers.map((eng, i) => (
            <span key={eng.initials} className="flex items-center">
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onEngineerClick(eng, e); }}
                className={`text-[10px] font-semibold leading-none hover:underline ${CELL_TEXT[cell.status]}`}
              >
                {eng.initials}
              </button>
              {i < engineers.length - 1 && (
                <span className={`mx-0.5 text-[9px] ${CELL_TEXT[cell.status]}`}>+</span>
              )}
            </span>
          ))
        )}
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// SHIFT COVER — Drawers
// ─────────────────────────────────────────────────────────────────────────────

const RiskSummaryDrawer = ({ onClose }: { onClose: () => void }): JSX.Element => (
  <div className="flex h-full flex-col">
    <div className="flex items-center justify-between border-b border-gray-800 p-5">
      <div className="flex items-center gap-3">
        <h2 className="text-lg font-bold text-slate-50">Tonight's Risk Summary</h2>
        <Badge variant="secondary" className="rounded bg-red-500/20 px-2 py-1 text-[10px] font-bold text-red-400 shadow-none hover:bg-red-500/20">
          CRITICAL
        </Badge>
      </div>
      <button
        type="button"
        onClick={onClose}
        className="rounded p-1 text-slate-400 hover:bg-white/10 hover:text-slate-200"
        aria-label="Close"
      >
        <X className="h-5 w-5" />
      </button>
    </div>

    <div className="flex flex-1 flex-col overflow-y-auto">
      {RISK_SUMMARY_FIELDS.map((field) => (
        <div
          key={field.label}
          className="flex items-center justify-between gap-4 border-b border-gray-800/50 px-5 py-3 last:border-0"
        >
          <span className="text-sm text-slate-400">{field.label}</span>
          <span className={`text-right text-sm font-semibold ${field.valueClass ?? "text-slate-50"}`}>
            {field.value}
          </span>
        </div>
      ))}
      {/* Missing skills row */}
      <div className="flex items-center justify-between gap-4 border-b border-gray-800/50 px-5 py-3">
        <span className="text-sm text-slate-400">Missing Skills</span>
        <div className="flex gap-1.5">
          <Badge variant="secondary" className="rounded bg-red-500/20 px-2 py-0.5 text-xs font-medium text-red-400 shadow-none hover:bg-red-500/20">PLC</Badge>
          <Badge variant="secondary" className="rounded bg-amber-500/20 px-2 py-0.5 text-xs font-medium text-amber-400 shadow-none hover:bg-amber-500/20">Electrical</Badge>
        </div>
      </div>
    </div>

    <div className="flex gap-3 border-t border-gray-800 p-5">
      <Button className="flex-1 bg-red-500 text-sm font-semibold text-white hover:bg-red-600">
        Resolve Tonight's Cover
      </Button>
      <Button
        variant="secondary"
        className="flex-1 border border-white/10 bg-white/10 text-sm font-semibold text-slate-50 hover:bg-white/15"
      >
        Assign Cover
      </Button>
    </div>
  </div>
);

const ShiftCellDrawer = ({
  detail,
  onClose,
}: {
  detail: ShiftCellDetail;
  onClose: () => void;
}): JSX.Element => (
  <div className="flex h-full flex-col">
    <div className="flex items-center justify-between border-b border-gray-800 p-5">
      <h2 className="text-base font-bold text-slate-50">
        {detail.teamLabel} — {detail.day} {detail.shiftType}
      </h2>
      <button
        type="button"
        onClick={onClose}
        className="rounded p-1 text-slate-400 hover:bg-white/10 hover:text-slate-200"
        aria-label="Close"
      >
        <X className="h-5 w-5" />
      </button>
    </div>

    <div className="flex flex-1 flex-col gap-5 overflow-y-auto p-5">
      {/* Shift overview */}
      <section>
        <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-slate-500">Shift Overview</p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-xs text-slate-500">Team</p>
            <p className="text-sm font-semibold text-slate-50">{detail.teamLabel}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Shift</p>
            <p className="text-sm font-semibold text-slate-50">{detail.shiftType}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Coverage</p>
            <p className="text-sm text-slate-50">{detail.coverage}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Risk Level</p>
            <p className={`text-sm font-bold ${RISK_LEVEL_TEXT[detail.riskLevel]}`}>
              {detail.riskLevel}
            </p>
          </div>
        </div>
      </section>

      {detail.engineers.length > 0 && (
        <section>
          <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-slate-500">Assigned Engineers</p>
          <div className="flex flex-col gap-2">
            {detail.engineers.map((eng) => (
              <div key={eng.initials} className="flex items-center gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/10 text-xs font-bold text-slate-200">
                  {eng.initials}
                </div>
                <span className="text-sm text-slate-50">{eng.name}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {detail.skillsCovered.length > 0 && (
        <section>
          <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-slate-500">Skills Covered</p>
          <div className="flex flex-wrap gap-1.5">
            {detail.skillsCovered.map((s) => (
              <Badge key={s} variant="secondary" className="rounded bg-emerald-500/20 px-2 py-0.5 text-xs font-medium text-emerald-400 shadow-none hover:bg-emerald-500/20">
                {s}
              </Badge>
            ))}
          </div>
        </section>
      )}

      {detail.skillsMissing.length > 0 && (
        <section>
          <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-slate-500">Skills Missing</p>
          <div className="flex flex-wrap gap-1.5">
            {detail.skillsMissing.map((s) => (
              <Badge key={s} variant="secondary" className="rounded bg-red-500/20 px-2 py-0.5 text-xs font-medium text-red-400 shadow-none hover:bg-red-500/20">
                {s}
              </Badge>
            ))}
          </div>
        </section>
      )}

      <section>
        <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-slate-500">Planned Work</p>
        <p className="text-sm text-slate-300">{detail.plannedWork}</p>
      </section>

      <section>
        <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-slate-500">Current Breakdowns</p>
        <p className={`text-sm ${detail.currentBreakdowns.startsWith("No active") ? "text-slate-400" : "text-red-400"}`}>
          {detail.currentBreakdowns}
        </p>
      </section>

      <section>
        <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-slate-500">Recommended Actions</p>
        <p className="text-sm text-slate-300">{detail.recommendedActions}</p>
      </section>
    </div>

    <div className="flex flex-wrap items-center gap-3 border-t border-gray-800 p-5">
      <Button className="flex-1 bg-blue-600 text-sm font-semibold text-white hover:bg-blue-700">
        Assign Engineer
      </Button>
      <Button
        variant="secondary"
        className="flex-1 border border-white/10 bg-white/10 text-sm font-semibold text-slate-50 hover:bg-white/15"
      >
        Request Contractor
      </Button>
      <button type="button" className="w-full text-center text-sm font-medium text-blue-400 hover:text-blue-300">
        View Engineer Profiles
      </button>
    </div>
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// SHIFT COVER — Month Day Drawer
// ─────────────────────────────────────────────────────────────────────────────

const STATUS_LABEL: Record<CellStatus, string> = {
  covered:    "Full Cover",
  partial:    "Reduced Cover",
  gap:        "Critical Gap",
  off:        "Off Shift",
  contractor: "Contractor Cover",
};

const MonthDayDrawer = ({
  detail,
  onClose,
}: {
  detail: MonthDayDetail;
  onClose: () => void;
}): JSX.Element => (
  <div className="flex h-full flex-col">
    <div className="flex items-center justify-between border-b border-gray-800 p-5">
      <div>
        <h2 className="text-base font-bold text-slate-50">{detail.dateLabel}</h2>
        <p className="text-xs text-slate-400">Shift Cover Summary</p>
      </div>
      <button
        type="button"
        onClick={onClose}
        className="rounded p-1 text-slate-400 hover:bg-white/10 hover:text-slate-200"
        aria-label="Close"
      >
        <X className="h-5 w-5" />
      </button>
    </div>

    <div className="flex flex-1 flex-col gap-5 overflow-y-auto p-5">
      {detail.shifts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <p className="text-sm text-slate-400">No active shifts scheduled for this date.</p>
        </div>
      ) : detail.shifts.map((s, idx) => (
        <section key={`${s.teamLabel}-${s.shiftType}-${idx}`} className="rounded-lg border border-gray-800 bg-[#0f1318] p-4">
          <div className="mb-3 flex items-center gap-2">
            <span className={`rounded border px-2 py-0.5 text-xs font-semibold ${s.shiftClass}`}>
              {s.teamLabel}
            </span>
            <span className="text-xs font-semibold text-slate-400">{s.shiftType} Shift</span>
            {s.dotColor && (
              <span className={`ml-auto h-2 w-2 rounded-full ${DOT_BG[s.dotColor]}`} aria-hidden="true" />
            )}
          </div>

          <div className="mb-3 grid grid-cols-2 gap-3">
            <div>
              <p className="text-[10px] text-slate-500">Status</p>
              <p className={`text-sm font-semibold ${CELL_TEXT[s.status]}`}>
                {STATUS_LABEL[s.status]}
              </p>
            </div>
            <div>
              <p className="text-[10px] text-slate-500">Risk Level</p>
              <p className={`text-sm font-bold ${RISK_LEVEL_TEXT[s.riskLevel]}`}>{s.riskLevel}</p>
            </div>
          </div>

          {s.engineers.length > 0 ? (
            <div className="mb-3">
              <p className="mb-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-500">Engineers</p>
              <div className="flex flex-wrap gap-1.5">
                {s.engineers.map((eng) => (
                  <div key={eng.initials} className="flex items-center gap-1.5 rounded bg-white/5 px-2 py-1">
                    <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/10 text-[9px] font-bold text-slate-200">
                      {eng.initials}
                    </div>
                    <span className="text-xs text-slate-300">{eng.name}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="mb-3 text-xs text-red-400">No engineers assigned</p>
          )}

          <div>
            <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-slate-500">Recommended Action</p>
            <p className="text-xs text-slate-300">{s.recommendedAction}</p>
          </div>
        </section>
      ))}
    </div>

    <div className="flex gap-3 border-t border-gray-800 p-5">
      <Button className="flex-1 bg-blue-600 text-sm font-semibold text-white hover:bg-blue-700">
        Assign Engineer
      </Button>
      <Button
        variant="secondary"
        className="flex-1 border border-white/10 bg-white/10 text-sm font-semibold text-slate-50 hover:bg-white/15"
      >
        Request Contractor
      </Button>
    </div>
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// SHIFT COVER — Main page component
// ─────────────────────────────────────────────────────────────────────────────

const FILTERS: { id: FilterType; label: string }[] = [
  { id: "all",         label: "All Teams"   },
  { id: "day",         label: "Day"         },
  { id: "night",       label: "Night"       },
  { id: "electrical",  label: "Electrical"  },
  { id: "mechanical",  label: "Mechanical"  },
  { id: "plc",         label: "PLC"         },
  { id: "contractors", label: "Contractors" },
];

const ShiftCoverRiskPage = (): JSX.Element => {
  const navigate = useNavigate();
  const [activeFilter, setActiveFilter] = useState<FilterType>("all");
  const [drawerMode, setDrawerMode] = useState<DrawerMode | null>(null);
  const [cellDetail, setCellDetail] = useState<ShiftCellDetail | null>(null);
  const [monthDayDetail, setMonthDayDetail] = useState<MonthDayDetail | null>(null);
  const [tooltipEng, setTooltipEng] = useState<{ eng: ScEngineer; x: number; y: number } | null>(null);
  const [selectedView, setSelectedView] = useState<"week" | "month">("week");
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());

  const periodLabel =
    selectedView === "week"
      ? `Week of ${selectedDate.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}`
      : selectedDate.toLocaleDateString("en-GB", { month: "long", year: "numeric" });
  const goToToday = () => setSelectedDate(new Date());
  const goToPreviousPeriod = () => {
    setSelectedDate((d) => {
      const next = new Date(d);
      if (selectedView === "week") {
        next.setDate(next.getDate() - 7);
      } else {
        next.setMonth(next.getMonth() - 1);
      }
      return next;
    });
  };
  const goToNextPeriod = () => {
    setSelectedDate((d) => {
      const next = new Date(d);
      if (selectedView === "week") {
        next.setDate(next.getDate() + 7);
      } else {
        next.setMonth(next.getMonth() + 1);
      }
      return next;
    });
  };

  const rotaTeams = useMemo(() => {
    const monday = getWeekMonday(selectedDate);
    return TEAM_CONFIGS.map((team) => {
      const day: (RotaCell | null)[] = [];
      const night: (RotaCell | null)[] = [];
      for (let di = 0; di < 7; di++) {
        const date = new Date(monday.getTime() + di * MS_PER_DAY);
        const dayLabel = DAYS[di];
        const shiftType: ShiftPatternType =
          team.type === "days"
            ? di < 5 ? "day" : "off"
            : getShiftType(date, team.offset);
        if (shiftType === "day") {
          const ov = ROTA_OVERLAYS[`${team.label}-${dayLabel}-day`];
          day.push({
            status: ov?.status ?? "covered",
            engineers: ov?.engineers ?? team.dayEngineers,
            dotColor: ov?.dotColor,
            detailKey: ov?.detailKey,
          });
        } else {
          day.push(null);
        }
        if (shiftType === "night") {
          const ov = ROTA_OVERLAYS[`${team.label}-${dayLabel}-night`];
          night.push({
            status: ov?.status ?? "covered",
            engineers: ov?.engineers ?? team.nightEngineers,
            dotColor: ov?.dotColor,
            detailKey: ov?.detailKey,
          });
        } else {
          night.push(null);
        }
      }
      return { id: team.id, label: team.label, shiftClass: team.shiftClass, day, night };
    });
  }, [selectedDate]);

  const openRiskSummary = useCallback(() => {
    setTooltipEng(null);
    setDrawerMode("risk-summary");
    setCellDetail(null);
  }, []);

  const handleCellClick = useCallback(
    (args: { teamId: string; dayIndex: number; shiftType: "Day" | "Night"; detailKey?: string }) => {
      setTooltipEng(null);
      if (args.detailKey && CELL_DETAILS[args.detailKey]) {
        setCellDetail(CELL_DETAILS[args.detailKey]);
      } else {
        const team = rotaTeams.find((t) => t.id === args.teamId);
        if (!team) return;
        const cell = args.shiftType === "Day" ? team.day[args.dayIndex] : team.night[args.dayIndex];
        if (!cell) return;
        const engineers = cell.engineers.map((k) => SC_ENGINEERS[k]).filter(Boolean);
        const coverageMap: Record<CellStatus, string> = {
          covered: "Full Cover",
          partial: "Partial Cover",
          gap: "Critical Gap",
          off: "Off",
          contractor: "Contractor Cover",
        };
        const riskMap: Record<CellStatus, ShiftCellDetail["riskLevel"]> = {
          covered: "Clear",
          partial: "Med",
          gap: "Critical",
          off: "Clear",
          contractor: "Low",
        };
        setCellDetail({
          teamLabel: team.label,
          day: DAYS[args.dayIndex],
          shiftType: args.shiftType,
          coverage: coverageMap[cell.status],
          riskLevel: riskMap[cell.status],
          engineers,
          skillsCovered: engineers.flatMap((e) => e.skills),
          skillsMissing: [],
          plannedWork: "No critical planned work scheduled",
          currentBreakdowns: "No active breakdowns",
          recommendedActions: cell.status === "covered" ? "No immediate action required" : "Review coverage and assign additional engineers if needed",
        });
      }
      setDrawerMode("shift-cell");
    },
    [rotaTeams],
  );

  const handleEngineerClick = useCallback((eng: ScEngineer, e: React.MouseEvent) => {
    e.stopPropagation();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setTooltipEng((prev) =>
      prev?.eng.initials === eng.initials ? null : { eng, x: rect.left, y: rect.bottom + 6 },
    );
  }, []);

  const closeDrawer = useCallback(() => {
    setDrawerMode(null);
    setCellDetail(null);
    setMonthDayDetail(null);
  }, []);

  const openMonthDay = useCallback((date: Date, dayNum: number) => {
    setTooltipEng(null);
    const dateLabel = date.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
    const shifts: MonthDayShiftSummary[] = [];
    const riskMap: Record<CellStatus, ShiftCellDetail["riskLevel"]> = {
      covered: "Clear", partial: "Med", gap: "Critical", off: "Clear", contractor: "Low",
    };
    const dayLabel = DAYS[date.getUTCDay() === 0 ? 6 : date.getUTCDay() - 1];

    for (const team of TEAM_CONFIGS) {
      const shiftType: ShiftPatternType =
        team.type === "days"
          ? (date.getUTCDay() >= 1 && date.getUTCDay() <= 5 ? "day" : "off")
          : getShiftType(date, team.offset);

      if (shiftType === "day") {
        const ov = ROTA_OVERLAYS[`${team.label}-${dayLabel}-day`];
        const status = ov?.status ?? "covered";
        const engKeys = ov?.engineers ?? team.dayEngineers;
        const engineers = engKeys.map((k) => SC_ENGINEERS[k]).filter(Boolean);
        shifts.push({
          shiftType: "Day",
          teamLabel: team.label,
          shiftClass: team.shiftClass,
          status,
          engineers,
          riskLevel: riskMap[status],
          dotColor: ov?.dotColor,
          recommendedAction:
            status === "covered"    ? "No action required — shift is fully covered."
            : status === "gap"      ? "Assign on-call contractor or request overtime cover immediately."
            : status === "partial"  ? "Review skill gaps and consider moving planned PMs to reduce load."
            : status === "contractor" ? "Confirm contractor availability and site induction status."
            : "No action required.",
        });
      } else if (shiftType === "night" && team.type !== "days") {
        const ov = ROTA_OVERLAYS[`${team.label}-${dayLabel}-night`];
        const status = ov?.status ?? "covered";
        const engKeys = ov?.engineers ?? team.nightEngineers;
        const engineers = engKeys.map((k) => SC_ENGINEERS[k]).filter(Boolean);
        shifts.push({
          shiftType: "Night",
          teamLabel: team.label,
          shiftClass: team.shiftClass,
          status,
          engineers,
          riskLevel: riskMap[status],
          dotColor: ov?.dotColor,
          recommendedAction:
            status === "covered"    ? "No action required — night shift is fully covered."
            : status === "gap"      ? "Critical: assign on-call engineer or escalate to shift manager."
            : status === "partial"  ? "Move critical PMs to day shift, assign additional engineer if available."
            : status === "contractor" ? "Confirm contractor night-shift clearance and emergency contacts."
            : "No action required.",
        });
      }
      // skip "off" teams — do not push them into the shifts array
    }

    setMonthDayDetail({ dateLabel, dayOfMonth: dayNum, shifts });
    setDrawerMode("month-day");
    setCellDetail(null);
  }, []);

  const showDay   = activeFilter === "all" || activeFilter === "day"   || !["day", "night"].includes(activeFilter);
  const showNight = activeFilter === "all" || activeFilter === "night" || !["day", "night"].includes(activeFilter);

  return (
    <>
      {/* Engineer tooltip backdrop */}
      {tooltipEng && (
        <div className="fixed inset-0 z-30" onClick={() => setTooltipEng(null)} aria-hidden="true" />
      )}

      {/* Engineer tooltip */}
      {tooltipEng && (
        <div
          className="fixed z-40 min-w-[160px] rounded-lg border border-gray-700 bg-[#1a2030] p-3 shadow-2xl"
          style={{ left: tooltipEng.x, top: tooltipEng.y }}
        >
          <p className="text-sm font-semibold text-slate-50">{tooltipEng.eng.name}</p>
          <p className="text-xs text-slate-400">{tooltipEng.eng.role}</p>
          <div className="mt-1.5 flex flex-wrap gap-1">
            {tooltipEng.eng.skills.map((s) => (
              <span key={s} className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] text-slate-300">{s}</span>
            ))}
          </div>
        </div>
      )}

      {/* Drawer overlay */}
      {drawerMode && (
        <div className="fixed inset-0 z-40 bg-black/60" onClick={closeDrawer} aria-hidden="true" />
      )}

      {/* Right drawer */}
      <div
        className={`fixed right-0 top-0 z-50 h-screen w-full max-w-[440px] transform overflow-hidden border-l border-gray-800 bg-[#0f1318] shadow-2xl transition-transform duration-300 ${
          drawerMode ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {drawerMode === "risk-summary" && <RiskSummaryDrawer onClose={closeDrawer} />}
        {drawerMode === "shift-cell" && cellDetail && (
          <ShiftCellDrawer detail={cellDetail} onClose={closeDrawer} />
        )}
        {drawerMode === "month-day" && monthDayDetail && (
          <MonthDayDrawer detail={monthDayDetail} onClose={closeDrawer} />
        )}
      </div>

      {/* ── Page content ─────────────────────────────────────────────── */}
      <section className="flex w-full flex-col gap-6 px-4 pb-12 pt-4 md:px-6 xl:px-8">

        {/* Breadcrumb */}
        <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-sm text-slate-400">
          <button
            type="button"
            onClick={() => navigate("/dashboard")}
            className="transition-colors hover:text-slate-200"
          >
            Dashboard
          </button>
          <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
          <span className="text-slate-400">Labour Risk</span>
          <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
          <span className="text-slate-200">Shift Cover</span>
        </nav>

        {/* Page header */}
        <header className="flex w-full flex-col justify-between gap-4 border-b border-white/10 pb-5 md:flex-row md:items-start">
          <div className="flex flex-col gap-1">
            <h1 className="text-xl font-semibold tracking-tight text-slate-50">Shift Cover Risk</h1>
            <p className="text-sm text-slate-400">Maintenance Coverage &amp; Shift Availability</p>
          </div>
          <Button
            type="button"
            variant="secondary"
            className="h-auto shrink-0 border border-white/10 bg-white/10 px-4 py-2 text-sm font-semibold text-slate-50 shadow-none hover:bg-white/15 hover:text-slate-50"
          >
            Review Cover Options
          </Button>
        </header>

        {/* KPI cards */}
        <div className="grid w-full grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {KPI_ITEMS.map((kpi) => (
            <Card key={kpi.label} className="rounded-xl border border-gray-800 bg-[#141820] shadow-none">
              <CardContent className="flex flex-col gap-1.5 p-4">
                <p className="text-xs text-slate-400">{kpi.label}</p>
                <p className="text-2xl font-semibold text-slate-50">{kpi.value}</p>
                <div className="flex items-center gap-1">
                  {kpi.positive
                    ? <TrendingUp className="h-3 w-3 text-emerald-500" aria-hidden="true" />
                    : <TrendingDown className="h-3 w-3 text-red-400" aria-hidden="true" />
                  }
                  <span className={`text-xs ${kpi.positive ? "text-emerald-500" : "text-red-400"}`}>
                    {kpi.changeText}
                  </span>
                </div>
                <p className="text-xs text-slate-500">{kpi.sub}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Tonight's Risk banner */}
        <div className="flex w-full flex-wrap items-center gap-4 rounded-xl border border-red-500/30 bg-red-500/10 px-5 py-4">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-red-500/20">
            <AlertTriangle className="h-4 w-4 text-red-400" aria-hidden="true" />
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-1.5 sm:flex-row sm:flex-wrap sm:items-center sm:gap-4">
            <div className="flex flex-col gap-0.5">
              <span className="text-[10px] font-bold uppercase tracking-widest text-red-400">Tonight's Risk</span>
              <p className="text-sm font-semibold text-slate-50">Night Shift B — PLC Engineer Missing</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary" className="rounded bg-amber-500/20 px-2 py-1 text-xs font-medium text-amber-400 shadow-none hover:bg-amber-500/20">
                Electrical Cover Reduced
              </Badge>
              <Badge variant="secondary" className="rounded bg-red-500/20 px-2 py-1 text-xs font-medium text-red-400 shadow-none hover:bg-red-500/20">
                Production Risk: Filling Line 2
              </Badge>
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-3">
            <Button
              type="button"
              className="h-auto bg-red-500 px-3 py-2 text-xs font-semibold text-white hover:bg-red-600"
              onClick={openRiskSummary}
            >
              Resolve Tonight's Cover
            </Button>
            <button
              type="button"
              className="text-xs font-medium text-blue-400 hover:text-blue-300"
              onClick={openRiskSummary}
            >
              View Risk Summary →
            </button>
          </div>
        </div>

        {/* Rota Risk Map */}
        <Card className="w-full rounded-xl border border-gray-800 bg-[#141820] shadow-none">
          <CardContent className="p-5">
            <div className="mb-4 flex flex-col gap-3">
              {/* Title + legend */}
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <h2 className="text-sm font-semibold text-slate-50">Operational Rota Risk Map</h2>
                  <span className="rounded bg-blue-500/20 px-2 py-0.5 text-[10px] font-bold text-blue-400">
                    7-DAY LOOKAHEAD
                  </span>
                </div>
                <div className="flex flex-wrap items-start gap-6">
                  <div className="flex flex-col gap-2">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Shift Status</p>
                    <div className="flex flex-wrap gap-3">
                      {SHIFT_STATUS_LEGEND.map((item) => (
                        <div key={item.label} className="flex items-center gap-1.5">
                          <span className={`inline-flex h-5 min-w-[92px] items-center justify-center rounded border px-2 text-[10px] font-semibold ${item.color}`}>
                            {item.label}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="flex flex-col gap-2">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Risk Indicators</p>
                    <div className="flex flex-wrap gap-3">
                      {RISK_INDICATOR_LEGEND.map((item) => (
                        <div key={item.label} className="flex items-center gap-1.5">
                          <span className={`h-2.5 w-2.5 rounded-full ${item.color}`} />
                          <span className="text-[11px] text-slate-400">{item.label}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="flex flex-col gap-2">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Interaction</p>
                    <div className="flex items-center gap-1.5">
                      <span className="h-2.5 w-2.5 rounded-full border border-blue-400 bg-transparent" />
                      <span className="text-[11px] text-slate-400">Selected Shift</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Filter tabs */}
              <div className="flex flex-wrap items-center gap-2">
                {FILTERS.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setActiveFilter(f.id)}
                    className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                      activeFilter === f.id
                        ? "bg-blue-600 text-white"
                        : "bg-white/10 text-slate-400 hover:bg-white/15 hover:text-slate-200"
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              {/* Date navigation */}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={goToToday}
                  className="rounded border border-white/10 bg-white/10 px-3 py-1 text-xs font-semibold text-slate-50 hover:bg-white/15"
                >
                  Today
                </button>
                <button
                  type="button"
                  onClick={goToPreviousPeriod}
                  className="flex h-7 w-7 items-center justify-center rounded border border-white/10 bg-white/10 text-slate-400 hover:bg-white/15 hover:text-slate-200"
                  aria-label="Previous week"
                >
                  ‹
                </button>
                <span className="min-w-[150px] text-center text-xs font-semibold text-slate-200">
                  {periodLabel}
                </span>
                <button
                  type="button"
                  onClick={goToNextPeriod}
                  className="flex h-7 w-7 items-center justify-center rounded border border-white/10 bg-white/10 text-slate-400 hover:bg-white/15 hover:text-slate-200"
                  aria-label="Next week"
                >
                  ›
                </button>
                <div className="ml-auto flex overflow-hidden rounded border border-white/10">
                  <button
                    type="button"
                    onClick={() => setSelectedView("week")}
                    className={`px-3 py-1 text-xs font-semibold transition-colors ${
                      selectedView === "week"
                        ? "bg-blue-600 text-white"
                        : "bg-white/10 text-slate-400 hover:bg-white/15 hover:text-slate-200"
                    }`}
                  >
                    Week
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedView("month")}
                    className={`px-3 py-1 text-xs font-semibold transition-colors ${
                      selectedView === "month"
                        ? "bg-blue-600 text-white"
                        : "bg-white/10 text-slate-400 hover:bg-white/15 hover:text-slate-200"
                    }`}
                  >
                    Month
                  </button>
                </div>
              </div>

              {selectedView === "week" && (
                <p className="text-xs text-slate-500">
                  💡 Click a shift cell to view cover, skills, gaps and recommended actions.
                </p>
              )}
            </div>

            {selectedView === "month" ? (() => {
              // Build calendar grid for the selected month (Monday-start)
              const year = selectedDate.getFullYear();
              const month = selectedDate.getMonth();
              const firstDay = new Date(Date.UTC(year, month, 1));
              const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
              const startOffset = (firstDay.getUTCDay() + 6) % 7; // Mon=0…Sun=6

              // Status severity for worst-case comparison
              const STATUS_RANK: Record<CellStatus, number> = { gap: 4, partial: 3, contractor: 2, covered: 1, off: 0 };

              // For a given date, compute:
              //   activeDay  = { teamLabel, status } | null
              //   activeNight = { teamLabel, status } | null
              //   worstRag (for card border colour)
              type DayInfo = {
                activeDay:   { teamLabel: string; status: CellStatus } | null;
                activeNight: { teamLabel: string; status: CellStatus } | null;
                worstRag:    CellStatus;
              };

              const getDayInfo = (date: Date): DayInfo => {
                const dl = DAYS[date.getUTCDay() === 0 ? 6 : date.getUTCDay() - 1];
                let activeDay:   DayInfo["activeDay"]   = null;
                let activeNight: DayInfo["activeNight"] = null;
                let worstRank = 0;

                for (const team of TEAM_CONFIGS) {
                  const st: ShiftPatternType =
                    team.type === "days"
                      ? (date.getUTCDay() >= 1 && date.getUTCDay() <= 5 ? "day" : "off")
                      : getShiftType(date, team.offset);

                  if (st === "day") {
                    const ov = ROTA_OVERLAYS[`${team.label}-${dl}-day`];
                    const status = ov?.status ?? "covered";
                    if (!activeDay || STATUS_RANK[status] > STATUS_RANK[activeDay.status]) {
                      activeDay = { teamLabel: team.label, status };
                    }
                    if (STATUS_RANK[status] > worstRank) worstRank = STATUS_RANK[status];
                  } else if (st === "night" && team.type !== "days") {
                    const ov = ROTA_OVERLAYS[`${team.label}-${dl}-night`];
                    const status = ov?.status ?? "covered";
                    if (!activeNight || STATUS_RANK[status] > STATUS_RANK[activeNight.status]) {
                      activeNight = { teamLabel: team.label, status };
                    }
                    if (STATUS_RANK[status] > worstRank) worstRank = STATUS_RANK[status];
                  }
                }

                const RANK_TO_STATUS: Record<number, CellStatus> = { 0: "off", 1: "covered", 2: "contractor", 3: "partial", 4: "gap" };
                return { activeDay, activeNight, worstRag: RANK_TO_STATUS[worstRank] ?? "off" };
              };

              // Build weeks array
              type CalCell = { dayNum: number; date: Date } | null;
              const cells: CalCell[] = [
                ...Array<CalCell>(startOffset).fill(null),
                ...Array.from({ length: daysInMonth }, (_, i) => ({
                  dayNum: i + 1,
                  date: new Date(Date.UTC(year, month, i + 1)),
                })),
              ];
              while (cells.length % 7 !== 0) cells.push(null);
              const weeks: CalCell[][] = [];
              for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));

              const RAG_BORDER: Record<CellStatus, string> = {
                gap:        "border-red-500/40",
                partial:    "border-amber-500/40",
                contractor: "border-blue-500/40",
                covered:    "border-emerald-500/30",
                off:        "border-white/5",
              };
              const RAG_CHIP: Record<CellStatus, string> = {
                covered:    "bg-emerald-500/20 text-emerald-300",
                partial:    "bg-amber-500/20 text-amber-300",
                gap:        "bg-red-500/20 text-red-300",
                contractor: "bg-blue-500/20 text-blue-300",
                off:        "bg-slate-700/40 text-slate-500",
              };
              const STATUS_SHORT: Record<CellStatus, string> = {
                covered: "Covered", partial: "Reduced", gap: "Gap", contractor: "Contractor", off: "Off",
              };

              return (
                <div className="overflow-x-auto">
                  <div className="min-w-[560px]">
                    {/* Column headers */}
                    <div className="mb-2 grid grid-cols-7 gap-1">
                      {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
                        <div key={d} className="py-1 text-center text-xs font-semibold uppercase tracking-wide text-slate-400">
                          {d}
                        </div>
                      ))}
                    </div>
                    {/* Calendar weeks */}
                    {weeks.map((week, wi) => (
                      <div key={wi} className="mb-1 grid grid-cols-7 gap-1">
                        {week.map((cell, ci) => {
                          if (!cell) {
                            return <div key={`blank-${wi}-${ci}`} className="rounded-lg border border-transparent bg-slate-900/30 p-2" />;
                          }
                          const { activeDay, activeNight, worstRag } = getDayInfo(cell.date);
                          return (
                            <button
                              key={cell.dayNum}
                              type="button"
                              onClick={() => openMonthDay(cell.date, cell.dayNum)}
                              className={`flex flex-col items-start gap-1 rounded-lg border bg-slate-800/50 p-2 text-left transition-colors hover:bg-slate-700/50 ${RAG_BORDER[worstRag]}`}
                            >
                              <span className="text-xs font-semibold text-slate-300">{cell.dayNum}</span>
                              <div className="flex w-full flex-col gap-0.5">
                                <div className="flex items-center gap-1">
                                  <span className="text-[9px] text-slate-500 shrink-0">Day</span>
                                  {activeDay ? (
                                    <span className={`rounded px-1 py-px text-[9px] font-medium leading-none ${RAG_CHIP[activeDay.status]}`}>
                                      {STATUS_SHORT[activeDay.status]}
                                    </span>
                                  ) : (
                                    <span className="text-[9px] text-slate-600">Off</span>
                                  )}
                                </div>
                                <div className="flex items-center gap-1">
                                  <span className="text-[9px] text-slate-500 shrink-0">Night</span>
                                  {activeNight ? (
                                    <span className={`rounded px-1 py-px text-[9px] font-medium leading-none ${RAG_CHIP[activeNight.status]}`}>
                                      {STATUS_SHORT[activeNight.status]}
                                    </span>
                                  ) : (
                                    <span className="text-[9px] text-slate-600">Off</span>
                                  )}
                                </div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })() : (
            <div className="overflow-x-auto">
              <div className="min-w-[780px]">
                {/* Day headers */}
                <div
                  className="mb-2 grid gap-1"
                  style={{ gridTemplateColumns: "110px repeat(7, minmax(0, 1fr))" }}
                >
                  <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                    Team / Shift
                  </div>
                  {DAYS.map((d) => (
                    <div key={d} className="text-center text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                      {d}
                    </div>
                  ))}
                </div>

                {/* Team rows */}
                <div className="flex flex-col gap-0.5">
                  {rotaTeams.map((team, teamIdx) => (
                    <div key={team.id}>
                      {showDay && (
                        <div
                          className="grid items-center gap-1"
                          style={{ gridTemplateColumns: "110px repeat(7, minmax(0, 1fr))" }}
                        >
                          <div className="flex flex-col">
                            <span className={`w-fit rounded border px-2 py-1 text-xs font-semibold ${team.shiftClass}`}>
                              {team.label}
                            </span>
                            <span className="mt-1 text-[9px] text-slate-600">Day</span>
                          </div>
                          {team.day.map((cell, di) => (
                            <RotaCellView
                              key={`${team.id}-day-${di}`}
                              cell={cell}
                              shiftType="Day"
                              teamId={team.id}
                              dayIndex={di}
                              onCellClick={handleCellClick}
                              onEngineerClick={handleEngineerClick}
                            />
                          ))}
                        </div>
                      )}
                      {showNight && (
                        <div
                          className="mt-0.5 grid items-center gap-1"
                          style={{ gridTemplateColumns: "110px repeat(7, minmax(0, 1fr))" }}
                        >
                          <div>
                            <span className="text-[9px] text-slate-600">Night</span>
                          </div>
                          {team.night.map((cell, di) => (
                            <RotaCellView
                              key={`${team.id}-night-${di}`}
                              cell={cell}
                              shiftType="Night"
                              teamId={team.id}
                              dayIndex={di}
                              onCellClick={handleCellClick}
                              onEngineerClick={handleEngineerClick}
                            />
                          ))}
                        </div>
                      )}
                      {teamIdx < rotaTeams.length - 1 && (
                        <div className="my-2 border-b border-gray-800/60" />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
            )}
          </CardContent>
        </Card>

        {/* Critical Issues + AI Intelligence */}
        <div className="grid w-full grid-cols-1 gap-4 lg:grid-cols-[1fr_360px]">

          {/* Critical Shift Cover Issues */}
          <Card className="rounded-xl border border-gray-800 bg-[#141820] shadow-none">
            <CardContent className="p-5">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-slate-50">Critical Shift Cover Issues</h2>
                <button type="button" className="text-xs font-medium text-blue-400 hover:text-blue-300">
                  View All
                </button>
              </div>
              <div className="flex flex-col">
                {COVER_ISSUES.map((issue, idx) => (
                  <div
                    key={issue.id}
                    className={`flex items-center justify-between gap-4 py-3.5 ${
                      idx < COVER_ISSUES.length - 1 ? "border-b border-gray-800" : ""
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className={`inline-flex w-[72px] shrink-0 items-center justify-center rounded px-1.5 py-1 text-[10px] font-bold ${SEVERITY_STYLES[issue.severity]}`}
                      >
                        {issue.severity}
                      </span>
                      <div className="flex flex-col gap-0.5">
                        <p className="text-sm font-medium text-slate-50">{issue.title}</p>
                        <p className="text-xs text-slate-400">{issue.location}</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      className="shrink-0 rounded border border-gray-700 px-3 py-1.5 text-xs font-medium text-slate-300 transition-colors hover:border-gray-600 hover:text-slate-100"
                    >
                      Review
                    </button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Vorta AI Cover Intelligence */}
          <Card className="rounded-xl border border-gray-800 bg-[#141820] shadow-none">
            <CardContent className="p-5">
              <div className="mb-1 flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-blue-400" aria-hidden="true" />
                <h2 className="text-sm font-semibold text-slate-50">Vorta AI Cover Intelligence</h2>
                <Badge
                  variant="secondary"
                  className="ml-auto rounded bg-emerald-500/20 px-2 py-0.5 text-[10px] font-semibold text-emerald-400 shadow-none hover:bg-emerald-500/20"
                >
                  84% confidence
                </Badge>
              </div>
              <p className="mb-4 text-xs text-slate-500">Live analysis · 48 engineers, 7-day lookahead</p>
              <div className="flex flex-col">
                {AI_ACTIONS.map((action, idx) => (
                  <div
                    key={action.id}
                    className={`flex flex-col gap-1.5 py-3.5 ${
                      idx < AI_ACTIONS.length - 1 ? "border-b border-gray-800" : ""
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium text-slate-50">{action.title}</p>
                      <button
                        type="button"
                        className={`shrink-0 rounded px-2.5 py-1 text-[10px] font-semibold ${AI_ACTION_STYLE[action.actionLabel]}`}
                      >
                        {action.actionLabel}
                      </button>
                    </div>
                    <p className="text-[10px] text-slate-500">{action.confidence}% confidence</p>
                    {action.details.map((d) => (
                      <p key={d} className="text-xs text-slate-400">• {d}</p>
                    ))}
                  </div>
                ))}
              </div>
              <Button
                type="button"
                className="mt-4 h-auto w-full bg-blue-600 py-2 text-sm font-semibold text-white hover:bg-blue-700"
              >
                + Generate Cover Plan
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Available Cover Pool */}
        <Card className="w-full rounded-xl border border-gray-800 bg-[#141820] shadow-none">
          <CardContent className="p-5">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-50">Available Cover Pool</h2>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  className="h-auto border border-white/10 bg-white/10 px-3 py-1.5 text-xs font-semibold text-slate-50 shadow-none hover:bg-white/15"
                >
                  Assign
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  className="h-auto border border-white/10 bg-white/10 px-3 py-1.5 text-xs font-semibold text-slate-50 shadow-none hover:bg-white/15"
                >
                  Reserve
                </Button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] border-collapse">
                <thead>
                  <tr className="border-b border-gray-800">
                    <th className="pb-3 pr-4 text-left text-[10px] font-semibold uppercase tracking-wide text-slate-500">Name / Role</th>
                    <th className="pb-3 pr-4 text-left text-[10px] font-semibold uppercase tracking-wide text-slate-500">Current Shift</th>
                    <th className="pb-3 pr-4 text-left text-[10px] font-semibold uppercase tracking-wide text-slate-500">Key Skills</th>
                    <th className="pb-3 pr-4 text-left text-[10px] font-semibold uppercase tracking-wide text-slate-500">Availability</th>
                    <th className="pb-3 pr-4 text-left text-[10px] font-semibold uppercase tracking-wide text-slate-500">Risk</th>
                    <th className="pb-3 text-left text-[10px] font-semibold uppercase tracking-wide text-slate-500">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {COVER_POOL.map((eng, idx) => (
                    <tr
                      key={eng.id}
                      className={`transition-colors hover:bg-white/[0.02] ${idx < COVER_POOL.length - 1 ? "border-b border-gray-800/50" : ""}`}
                    >
                      <td className="py-4 pr-4">
                        <div className="flex items-center gap-3">
                          <div
                            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white ${eng.avatarColor}`}
                          >
                            {eng.initials}
                          </div>
                          <div className="flex flex-col gap-0.5">
                            <p className="text-sm font-semibold text-slate-50">{eng.name}</p>
                            <p className="text-xs text-slate-400">{eng.role}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 pr-4">
                        <span className="text-sm text-slate-300">{eng.currentShift}</span>
                      </td>
                      <td className="py-4 pr-4">
                        <div className="flex flex-wrap gap-1">
                          {eng.keySkills.map((s) => (
                            <span key={s} className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] text-slate-300">
                              {s}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="py-4 pr-4">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-sm font-semibold text-slate-50">{eng.rating}</span>
                          <span className="text-xs text-slate-500">/5</span>
                          {eng.availabilityText !== "—" && (
                            <span className="text-xs text-slate-400">{eng.availabilityText}</span>
                          )}
                        </div>
                      </td>
                      <td className="py-4 pr-4">
                        <Badge
                          variant="secondary"
                          className={`rounded px-2 py-0.5 text-xs font-medium shadow-none ${RISK_BADGE[eng.risk]}`}
                        >
                          {eng.risk}
                        </Badge>
                      </td>
                      <td className="py-4">
                        <div className="flex items-start gap-2">
                          <div className="flex flex-col gap-0.5">
                            <button
                              type="button"
                              className="rounded bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700"
                            >
                              Assign
                            </button>
                            {eng.assignNote && (
                              <span className="text-[10px] font-medium text-blue-400">{eng.assignNote}</span>
                            )}
                          </div>
                          <button
                            type="button"
                            className="rounded border border-gray-700 px-3 py-1.5 text-xs font-medium text-slate-300 transition-colors hover:border-gray-600 hover:text-white"
                          >
                            Reserve
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="mt-5 flex items-center justify-between">
              <p className="text-xs text-slate-400">Showing 10 of 48 engineers</p>
              <div className="flex items-center gap-1">
                <button type="button" className="flex h-7 w-7 items-center justify-center rounded text-xs text-slate-400 hover:bg-white/10">‹</button>
                {[1, 2, 3].map((p) => (
                  <button
                    key={p}
                    type="button"
                    className={`flex h-7 w-7 items-center justify-center rounded text-xs ${
                      p === 1 ? "bg-blue-600 text-white" : "text-slate-400 hover:bg-white/10"
                    }`}
                  >
                    {p}
                  </button>
                ))}
                <span className="px-1 text-xs text-slate-600">…</span>
                <button type="button" className="flex h-7 w-7 items-center justify-center rounded text-xs text-slate-400 hover:bg-white/10">5</button>
                <button type="button" className="flex h-7 w-7 items-center justify-center rounded text-xs text-slate-400 hover:bg-white/10">›</button>
              </div>
            </div>
          </CardContent>
        </Card>

      </section>
    </>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// GENERIC PAGES — Types
// ─────────────────────────────────────────────────────────────────────────────

interface KeyDriver {
  label: string;
  detail: string;
}

interface AffectedPerson {
  name: string;
  role: string;
  note: string;
}

interface RecommendedAction {
  title: string;
  priority: "High" | "Med" | "Low";
  category: string;
  status: "Open" | "In Progress" | "Review";
}

interface ActionQueueItem {
  title: string;
  owner: string;
  due: string;
}

interface RiskDetail {
  slug: string;
  title: string;
  score: number;
  level: "Critical" | "High" | "Med" | "Low";
  summary: string;
  keyDrivers: KeyDriver[];
  affected: AffectedPerson[];
  recommendedActions: RecommendedAction[];
  actionQueue: ActionQueueItem[];
}

// ─────────────────────────────────────────────────────────────────────────────
// GENERIC PAGES — Static data
// ─────────────────────────────────────────────────────────────────────────────

const RISK_DATA: Record<string, RiskDetail> = {
  "single-point-failure": {
    slug: "single-point-failure",
    title: "Single Point of Failure",
    score: 72,
    level: "High",
    summary:
      "Only one engineer in the team holds sufficient competency for Siemens S7 PLC fault diagnosis on the main production lines. If this individual is absent, any PLC-related fault on Lines 1–3 will require external support, increasing MTTR significantly.",
    keyDrivers: [
      { label: "Single PLC SME",      detail: "Only Tom Reeves is trained to Siemens S7 Level 3" },
      { label: "Lines 1–3 dependency",detail: "All three production lines rely on the same PLC architecture" },
      { label: "No backup trained",   detail: "Cross-training programme not yet started" },
      { label: "Contractor gap",      detail: "No approved contractor holds equivalent PLC certification on site" },
    ],
    affected: [
      { name: "Tom Reeves",          role: "Senior Electrical Engineer", note: "Sole S7 PLC qualified engineer" },
      { name: "Line 1 / Line 2 / Line 3", role: "Production Lines",    note: "All depend on S7 PLC architecture" },
      { name: "Liam Burke",          role: "Electrical Engineer",       note: "Nominated for cross-training — not yet started" },
    ],
    recommendedActions: [
      { title: "Initiate Siemens S7 cross-training for Liam Burke",        priority: "High", category: "Training",   status: "Open" },
      { title: "Identify an approved PLC contractor as emergency backup",   priority: "High", category: "Resourcing", status: "Open" },
      { title: "Document fault-diagnosis procedures for common PLC faults", priority: "Med",  category: "Knowledge",  status: "Open" },
    ],
    actionQueue: [
      { title: "Enrol Liam Burke on Siemens S7 training course",    owner: "Training Coordinator", due: "This week"    },
      { title: "Contact preferred PLC contractor and confirm SLA",   owner: "Maintenance Manager",  due: "This week"    },
      { title: "Create S7 fault runbook in knowledge base",          owner: "Tom Reeves",           due: "Next 2 weeks" },
    ],
  },

  "annual-leave": {
    slug: "annual-leave",
    title: "Annual Leave",
    score: 68,
    level: "Med",
    summary:
      "Three engineers are on annual leave this week with partial overlap. Cover has been arranged for two of the three, leaving one mechanical shift partially exposed. Risk is manageable but warrants monitoring throughout the week.",
    keyDrivers: [
      { label: "Three concurrent absences",       detail: "Priya Nair, Gareth Owen, and Chloe Armstrong all absent this week" },
      { label: "Partial cover only",              detail: "Contractor booked for Wed–Fri; Mon–Tue has reduced capacity" },
      { label: "Shutdown period approaching",     detail: "Annual leave overlapping with pre-shutdown preparation window" },
      { label: "No formal deconfliction policy",  detail: "Leave approvals not cross-checked against risk threshold" },
    ],
    affected: [
      { name: "Priya Nair",      role: "Electrical Engineer",    note: "On leave Tue–Thu" },
      { name: "Gareth Owen",     role: "Mechanical Engineer",    note: "On leave Mon–Wed" },
      { name: "Chloe Armstrong", role: "Instrumentation Tech",   note: "On leave all week" },
    ],
    recommendedActions: [
      { title: "Confirm contractor cover for Mon–Tue electrical gap",      priority: "High", category: "Resourcing", status: "In Progress" },
      { title: "Introduce leave deconfliction checks in rota system",      priority: "Med",  category: "Process",    status: "Open"        },
      { title: "Assign PM backlog tasks before engineers leave",           priority: "Med",  category: "Planning",   status: "Open"        },
    ],
    actionQueue: [
      { title: "Confirm Mon–Tue electrical cover",                owner: "Shift Manager",      due: "Today"      },
      { title: "Reschedule Chloe Armstrong calibration tasks",    owner: "Maintenance Planner",due: "Today"      },
      { title: "Review leave policy for concurrent absences",     owner: "Engineering Lead",   due: "This month" },
    ],
  },

  "training-expiring": {
    slug: "training-expiring",
    title: "Training Expiring",
    score: 54,
    level: "Med",
    summary:
      "Two engineers have safety-critical certifications expiring within 14 days. If not renewed, they will be restricted from working on specific equipment, creating a skill coverage gap on pressure systems and high-voltage assets.",
    keyDrivers: [
      { label: "PSSR certification expiry",   detail: "James Holloway's Pressure Systems Safety Regulations cert expires in 7 days" },
      { label: "HV authorisation renewal",    detail: "Kezia Mutasa's high-voltage authorisation expires in 12 days" },
      { label: "Booking not confirmed",       detail: "Renewal training not yet booked for either engineer" },
      { label: "No temporary cover arranged", detail: "No other engineer on shift holds equivalent authorisation" },
    ],
    affected: [
      { name: "James Holloway", role: "Mechanical Engineer",  note: "PSSR cert expires in 7 days"    },
      { name: "Kezia Mutasa",   role: "Electrical Engineer",  note: "HV authorisation expires in 12 days" },
    ],
    recommendedActions: [
      { title: "Book PSSR renewal course for James Holloway immediately",  priority: "High", category: "Training", status: "Open" },
      { title: "Confirm HV reauthorisation date for Kezia Mutasa",        priority: "High", category: "Training", status: "Open" },
      { title: "Set automatic 30-day cert expiry alerts in training system",priority: "Low", category: "Process",  status: "Open" },
    ],
    actionQueue: [
      { title: "Book James Holloway PSSR renewal",        owner: "Training Coordinator", due: "Today"    },
      { title: "Book Kezia Mutasa HV reauthorisation",    owner: "Training Coordinator", due: "Tomorrow" },
      { title: "Enable cert expiry alerts in training system", owner: "System Admin",    due: "This week"},
    ],
  },

  "skill-gaps": {
    slug: "skill-gaps",
    title: "Skill Gaps",
    score: 46,
    level: "Low",
    summary:
      "The maintenance team has identified gaps in PLC programming competency and hydraulic systems diagnostics. These gaps are not immediately critical but limit the team's ability to handle complex faults without external assistance.",
    keyDrivers: [
      { label: "PLC programming gap",       detail: "3 engineers rated below competency threshold for PLC fault diagnosis" },
      { label: "Hydraulics knowledge",      detail: "Only 1 engineer qualified for hydraulic press servicing on Line 4" },
      { label: "Training plan not formalised", detail: "Skill gap training has not been scheduled in the annual plan" },
      { label: "New equipment arriving",    detail: "Hydraulic press upgrade due next quarter — current team not yet trained" },
    ],
    affected: [
      { name: "Liam Burke",  role: "Electrical Engineer",  note: "Below threshold on PLC fault diagnosis" },
      { name: "Sofia Brennan",role:"Mechanical Engineer",   note: "Below threshold on hydraulics diagnostics" },
      { name: "Dan Yates",   role: "Multi-skilled Tech",   note: "Below threshold on both PLC and hydraulics" },
    ],
    recommendedActions: [
      { title: "Schedule PLC Level 2 training for Liam Burke and Dan Yates",  priority: "Med", category: "Training", status: "Open" },
      { title: "Arrange hydraulics awareness session for Sofia Brennan",       priority: "Med", category: "Training", status: "Open" },
      { title: "Add skill gap actions to annual training plan",               priority: "Low", category: "Planning", status: "Open" },
    ],
    actionQueue: [
      { title: "Identify PLC Level 2 course dates and provider", owner: "Training Coordinator", due: "This week"  },
      { title: "Add hydraulics training to Q3 training plan",    owner: "Engineering Lead",     due: "This week"  },
      { title: "Update skills matrix with current ratings",      owner: "Maintenance Manager",  due: "This month" },
    ],
  },

  "contractor-reliance": {
    slug: "contractor-reliance",
    title: "Contractor Reliance",
    score: 32,
    level: "Low",
    summary:
      "Contractor usage is currently within acceptable limits. Two specialist contractors are engaged for periodic maintenance tasks. Reliance is stable but should be monitored as internal training develops.",
    keyDrivers: [
      { label: "Specialist contractors in use",   detail: "Contractor A covers refrigeration; Contractor B covers HV switching" },
      { label: "Within approved threshold",       detail: "Contractor spend and hours within agreed annual budget" },
      { label: "SLAs in place",                   detail: "Both contractors have signed response SLAs for emergency call-out" },
      { label: "Internal capability developing",  detail: "One engineer currently undergoing HV authorisation training" },
    ],
    affected: [
      { name: "Contractor A — RefriTech Ltd",  role: "Refrigeration Specialist", note: "Quarterly PM visits and reactive call-out" },
      { name: "Contractor B — PowerSafe UK",   role: "HV Switching Specialist",  note: "Planned and reactive HV switching operations" },
    ],
    recommendedActions: [
      { title: "Continue monitoring contractor hours against budget threshold",        priority: "Low", category: "Governance", status: "Open"       },
      { title: "Progress internal HV training to reduce Contractor B dependency",     priority: "Med", category: "Training",   status: "In Progress" },
      { title: "Review contractor SLAs at next contract renewal",                     priority: "Low", category: "Governance", status: "Open"        },
    ],
    actionQueue: [
      { title: "Review contractor usage report at monthly ops meeting", owner: "Maintenance Manager",  due: "End of month" },
      { title: "Track HV training progress for internal engineer",      owner: "Training Coordinator", due: "This month"   },
      { title: "Prepare contractor renewal briefing",                   owner: "Maintenance Manager",  due: "Next month"   },
    ],
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// GENERIC PAGES — Helpers
// ─────────────────────────────────────────────────────────────────────────────

function getLevelColors(level: RiskDetail["level"]) {
  switch (level) {
    case "Critical": return { badge: "bg-[#ef444420] text-red-500 hover:bg-[#ef444420]",     progress: "bg-red-500"     };
    case "High":     return { badge: "bg-[#f9731620] text-orange-400 hover:bg-[#f9731620]",  progress: "bg-orange-400"  };
    case "Med":      return { badge: "bg-[#facc1520] text-yellow-400 hover:bg-[#facc1520]",  progress: "bg-yellow-400"  };
    case "Low":      return { badge: "bg-[#10b98120] text-emerald-500 hover:bg-[#10b98120]", progress: "bg-emerald-500" };
  }
}

function getPriorityClass(priority: RecommendedAction["priority"]) {
  switch (priority) {
    case "High": return "text-red-400";
    case "Med":  return "text-yellow-400";
    case "Low":  return "text-emerald-500";
  }
}

function getStatusClass(status: RecommendedAction["status"]) {
  switch (status) {
    case "Open":        return { badge: "bg-[#10b98120] text-emerald-500", dot: "bg-emerald-500" };
    case "In Progress": return { badge: "bg-[#3b82f620] text-blue-400",   dot: "bg-blue-400"    };
    case "Review":      return { badge: "bg-[#facc1520] text-yellow-400",  dot: "bg-yellow-400"  };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// GENERIC PAGES — Component
// ─────────────────────────────────────────────────────────────────────────────

const GenericRiskDetailPage = ({
  detail,
  navigate,
}: {
  detail: RiskDetail;
  navigate: ReturnType<typeof useNavigate>;
}): JSX.Element => {
  const colors = getLevelColors(detail.level);

  return (
    <section className="flex w-full flex-col gap-6 px-4 pb-12 pt-4 md:px-6 xl:px-8">

      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-sm text-slate-400">
        <button type="button" onClick={() => navigate("/dashboard")} className="transition-colors hover:text-slate-200">
          Dashboard
        </button>
        <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
        <span className="text-slate-400">Labour Risk</span>
        <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
        <span className="text-slate-200">{detail.title}</span>
      </nav>

      {/* Page header */}
      <header className="flex w-full flex-col justify-between gap-4 border-b border-white/10 pb-5 md:flex-row md:items-start">
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-xl font-semibold tracking-tight text-slate-50">{detail.title}</h1>
            <Badge variant="secondary" className={`rounded px-2 py-1 text-xs font-medium shadow-none ${colors.badge}`}>
              {detail.level}
            </Badge>
          </div>
          <p className="text-sm text-slate-400">Labour Risk Detail</p>
        </div>
        <Button
          type="button"
          variant="secondary"
          className="h-auto shrink-0 border border-white/10 bg-white/10 px-4 py-2 text-sm font-semibold text-slate-50 shadow-none hover:bg-white/15 hover:text-slate-50"
          onClick={() => navigate("/dashboard")}
        >
          Back to Dashboard
        </Button>
      </header>

      {/* Score + summary */}
      <div className="grid w-full grid-cols-1 gap-4 lg:grid-cols-[200px_1fr]">
        <Card className="rounded-xl border border-gray-800 bg-[#141820] shadow-none">
          <CardContent className="flex h-full flex-col items-start gap-3 p-5">
            <p className="text-xs text-slate-400">Risk Score</p>
            <p className="text-4xl font-semibold text-slate-50">{detail.score}</p>
            <div className="flex w-full flex-col gap-1.5">
              <div className="relative h-2 w-full overflow-hidden rounded bg-gray-800">
                <div className={`h-full rounded ${colors.progress}`} style={{ width: `${detail.score}%` }} />
              </div>
              <Badge variant="secondary" className={`w-fit rounded px-2 py-1 text-xs font-medium shadow-none ${colors.badge}`}>
                {detail.level} Risk
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-xl border border-gray-800 bg-[#141820] shadow-none">
          <CardContent className="flex h-full flex-col gap-2 p-5">
            <h2 className="text-sm font-semibold text-slate-50">Summary</h2>
            <p className="text-sm leading-relaxed text-slate-400">{detail.summary}</p>
          </CardContent>
        </Card>
      </div>

      {/* Key drivers */}
      <section className="flex w-full flex-col gap-4">
        <h2 className="text-base font-semibold text-slate-50">Key Drivers</h2>
        <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {detail.keyDrivers.map((driver) => (
            <Card key={driver.label} className="rounded-xl border border-gray-800 bg-[#141820] shadow-none">
              <CardContent className="flex flex-col gap-1.5 p-4">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-yellow-400" aria-hidden="true" />
                  <p className="text-sm font-semibold text-slate-50">{driver.label}</p>
                </div>
                <p className="pl-[22px] text-xs text-slate-400">{driver.detail}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Affected engineers */}
      <section className="flex w-full flex-col gap-4">
        <h2 className="text-base font-semibold text-slate-50">Affected Engineers / Roles</h2>
        {detail.affected.length === 0 ? (
          <Card className="rounded-xl border border-gray-800 bg-[#141820] shadow-none">
            <CardContent className="flex items-center justify-center p-8">
              <p className="text-sm text-slate-400">No affected individuals identified.</p>
            </CardContent>
          </Card>
        ) : (
          <Card className="rounded-xl border border-gray-800 bg-[#141820] shadow-none">
            <CardContent className="p-0">
              <div className="flex w-full flex-col">
                {detail.affected.map((person, index) => (
                  <div
                    key={person.name}
                    className={`flex w-full flex-col gap-1 px-5 py-4 sm:flex-row sm:items-center sm:gap-4 ${
                      index !== detail.affected.length - 1 ? "border-b border-gray-800" : ""
                    }`}
                  >
                    <div className="flex items-center gap-3 sm:w-[220px] sm:shrink-0">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/10">
                        <Users className="h-4 w-4 text-slate-400" aria-hidden="true" />
                      </div>
                      <span className="text-sm font-semibold text-slate-50">{person.name}</span>
                    </div>
                    <span className="pl-11 text-sm text-slate-400 sm:w-[200px] sm:shrink-0 sm:pl-0">{person.role}</span>
                    <span className="pl-11 text-sm text-slate-400 sm:pl-0">{person.note}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </section>

      {/* Recommended actions + action queue */}
      <div className="grid w-full grid-cols-1 gap-4 lg:grid-cols-[1fr_360px]">
        <section className="flex flex-col gap-4">
          <h2 className="text-base font-semibold text-slate-50">Recommended Actions</h2>
          {detail.recommendedActions.length === 0 ? (
            <Card className="rounded-xl border border-gray-800 bg-[#141820] shadow-none">
              <CardContent className="flex items-center justify-center p-8">
                <p className="text-sm text-slate-400">No recommended actions at this time.</p>
              </CardContent>
            </Card>
          ) : (
            <Card className="rounded-xl border border-gray-800 bg-[#141820] shadow-none">
              <CardContent className="p-0">
                <div className="flex w-full flex-col">
                  {detail.recommendedActions.map((action, index) => {
                    const sc = getStatusClass(action.status);
                    return (
                      <div
                        key={action.title}
                        className={`flex flex-col gap-2 px-5 py-4 ${
                          index !== detail.recommendedActions.length - 1 ? "border-b border-gray-800" : ""
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <p className="text-sm font-semibold leading-snug text-slate-50">{action.title}</p>
                          <span className={`shrink-0 text-sm font-semibold ${getPriorityClass(action.priority)}`}>
                            {action.priority}
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge
                            variant="secondary"
                            className={`inline-flex h-auto items-center gap-1.5 rounded px-2 py-1 text-xs font-medium shadow-none ${sc.badge}`}
                          >
                            <span className={`h-1.5 w-1.5 rounded-full ${sc.dot}`} />
                            {action.status}
                          </Badge>
                          <Badge
                            variant="secondary"
                            className="h-auto rounded bg-white/10 px-2 py-1 text-xs font-medium text-slate-300 shadow-none hover:bg-white/10"
                          >
                            {action.category}
                          </Badge>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </section>

        <section className="flex flex-col gap-4">
          <h2 className="text-base font-semibold text-slate-50">Action Queue</h2>
          {detail.actionQueue.length === 0 ? (
            <Card className="rounded-xl border border-gray-800 bg-[#141820] shadow-none">
              <CardContent className="flex items-center justify-center p-8">
                <p className="text-sm text-slate-400">Action queue is empty.</p>
              </CardContent>
            </Card>
          ) : (
            <Card className="rounded-xl border border-gray-800 bg-[#141820] shadow-none">
              <CardContent className="p-0">
                <div className="flex w-full flex-col">
                  {detail.actionQueue.map((item, index) => (
                    <div
                      key={item.title}
                      className={`flex flex-col gap-1.5 px-5 py-4 ${
                        index !== detail.actionQueue.length - 1 ? "border-b border-gray-800" : ""
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <p className="text-sm font-semibold leading-snug text-slate-50">{item.title}</p>
                        <span className="shrink-0 text-xs font-medium text-slate-400">{item.due}</span>
                      </div>
                      <p className="text-xs text-slate-400">{item.owner}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </section>
      </div>
    </section>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Root export
// ─────────────────────────────────────────────────────────────────────────────

export const LabourRiskDetailPage = (): JSX.Element => {
  const { riskType } = useParams<{ riskType: string }>();
  const navigate = useNavigate();

  if (riskType === "shift-cover") {
    return <ShiftCoverRiskPage />;
  }

  const detail = riskType ? RISK_DATA[riskType] : undefined;

  if (!detail) {
    return (
      <section className="flex w-full flex-col gap-6 px-4 pb-12 pt-4 md:px-6 xl:px-8">
        <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-sm text-slate-400">
          <button type="button" onClick={() => navigate("/dashboard")} className="transition-colors hover:text-slate-200">
            Dashboard
          </button>
          <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
          <span className="text-slate-200">Labour Risk</span>
        </nav>
        <div className="flex flex-col items-center justify-center gap-3 py-24 text-center">
          <AlertTriangle className="h-8 w-8 text-slate-500" aria-hidden="true" />
          <p className="text-base font-semibold text-slate-50">Risk type not found</p>
          <p className="text-sm text-slate-400">The risk category you are looking for does not exist.</p>
          <Button
            type="button"
            variant="secondary"
            className="mt-2 h-auto border border-white/10 bg-white/10 px-4 py-2 text-sm font-semibold text-slate-50 hover:bg-white/15"
            onClick={() => navigate("/dashboard")}
          >
            Back to Dashboard
          </Button>
        </div>
      </section>
    );
  }

  return <GenericRiskDetailPage detail={detail} navigate={navigate} />;
};
