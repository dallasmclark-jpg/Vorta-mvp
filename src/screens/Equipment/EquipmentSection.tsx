import { useMemo, useState } from "react";
import {
  AlertTriangle,
  BookOpen,
  Brain,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleUser as UserCircle,
  Download,
  Plus,
  RefreshCw,
  Search,
  Shield,
  Upload,
  X,
  Zap,
} from "lucide-react";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Card, CardContent } from "../../components/ui/card";
import { Progress } from "../../components/ui/progress";
import { ContextHelp } from "../../components/ContextHelp";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Equipment {
  id: string;
  name: string;
  area: string;
  oem: string;
  model: string;
  criticality: "Critical" | "High" | "Medium" | "Low";
  status: "Healthy" | "Watch" | "At Risk" | "Offline";
  linkedSkills: string[];
  engineersCovered: number;
  engineersTotal: number;
  coverage: "Strong" | "Partial" | "Gap";
  riskLevel: "Low" | "Medium" | "High" | "Critical";
  nextAction: string;
  requiredSkills: string[];
  engineersNeedingTraining: number;
  recommendedTraining: string;
  linkedRequirements: string[];
  aiInsight: string;
}

// ─── Mock data ────────────────────────────────────────────────────────────────

const MOCK_EQUIPMENT: Equipment[] = [
  {
    id: "eq-01",
    name: "Siemens S7 PLC Line 3",
    area: "Production Line 3",
    oem: "Siemens",
    model: "S7-1500 Series",
    criticality: "Critical",
    status: "Watch",
    linkedSkills: ["Siemens PLC Fault Finding", "Automation & Controls", "SCADA Systems"],
    engineersCovered: 2,
    engineersTotal: 5,
    coverage: "Gap",
    riskLevel: "High",
    nextAction: "Book Siemens S7 training for 3 engineers",
    requiredSkills: ["Siemens S7 Programming", "PLC Fault Diagnosis", "HMI Configuration", "PROFIBUS/PROFINET"],
    engineersNeedingTraining: 3,
    recommendedTraining: "Siemens S7 Advanced Fault Finding — Automation Excellence Ltd",
    linkedRequirements: ["PLC Automation Coverage", "Controls Skill Gap"],
    aiInsight: "Line 3 PLC has limited cover on nights. Only 1 engineer is validated above Level 3. Recommend Siemens S7 refresher training for 2 engineers and cross-shift coverage review.",
  },
  {
    id: "eq-02",
    name: "Krones Filler",
    area: "Filling Hall",
    oem: "Krones",
    model: "Modulfill VFS",
    criticality: "Critical",
    status: "Healthy",
    linkedSkills: ["Krones OEM Operation", "Mechanical Maintenance", "Pneumatics"],
    engineersCovered: 4,
    engineersTotal: 5,
    coverage: "Strong",
    riskLevel: "Medium",
    nextAction: "Add backup engineer for night shift cover",
    requiredSkills: ["Krones Filler Operation", "Pneumatic Systems", "CIP Cleaning Procedures", "OEM Fault Diagnosis"],
    engineersNeedingTraining: 1,
    recommendedTraining: "Krones OEM Modulfill Training — Asset Reliability Partners",
    linkedRequirements: ["OEM Specialist Coverage"],
    aiInsight: "Filler coverage is strong across day shift. Night shift has one qualified engineer — consider cross-training one additional mechanical engineer for resilience.",
  },
  {
    id: "eq-03",
    name: "Atlas Copco Compressor",
    area: "Utilities",
    oem: "Atlas Copco",
    model: "GA 90 VSD+",
    criticality: "High",
    status: "Healthy",
    linkedSkills: ["Compressed Air Systems", "Mechanical Maintenance", "Electrical Maintenance"],
    engineersCovered: 3,
    engineersTotal: 4,
    coverage: "Partial",
    riskLevel: "Low",
    nextAction: "Review contractor support arrangement",
    requiredSkills: ["Compressed Air Systems", "Refrigeration Principles", "Preventive Maintenance"],
    engineersNeedingTraining: 1,
    recommendedTraining: "Compressed Air Systems Fundamentals",
    linkedRequirements: [],
    aiInsight: "Compressor is well-maintained with good contractor support in place. One additional internal engineer trained would eliminate contractor dependency risk.",
  },
  {
    id: "eq-04",
    name: "ABB Robot Cell",
    area: "Palletising",
    oem: "ABB",
    model: "IRB 660",
    criticality: "High",
    status: "At Risk",
    linkedSkills: ["Robotics Recovery", "Automation & Controls", "Safety Systems"],
    engineersCovered: 1,
    engineersTotal: 4,
    coverage: "Gap",
    riskLevel: "Critical",
    nextAction: "Validate robotics skill on night shift",
    requiredSkills: ["ABB RobotStudio", "Robot Recovery Procedures", "Safety Category 3 PLd", "Gripper Mechanics"],
    engineersNeedingTraining: 3,
    recommendedTraining: "ABB IRB Robotics Recovery — Asset Reliability Partners",
    linkedRequirements: ["Robotics Recovery Coverage"],
    aiInsight: "Critical SPOF risk: only 1 engineer across all shifts is validated on ABB robot recovery. Any absence creates immediate breakdown risk. Urgent cross-training required.",
  },
  {
    id: "eq-05",
    name: "Ishida Checkweigher",
    area: "Packaging Line 1",
    oem: "Ishida",
    model: "DACS-G",
    criticality: "Medium",
    status: "Healthy",
    linkedSkills: ["Weighing & Inspection Systems", "Electrical Maintenance", "GMP Compliance"],
    engineersCovered: 3,
    engineersTotal: 4,
    coverage: "Partial",
    riskLevel: "Low",
    nextAction: "Schedule annual OEM calibration",
    requiredSkills: ["Checkweigher Calibration", "Statistical Process Control", "GMP Documentation"],
    engineersNeedingTraining: 1,
    recommendedTraining: "Ishida OEM Operator & Maintenance Training",
    linkedRequirements: [],
    aiInsight: "Checkweigher is well-covered. Calibration records are up to date. One engineer pending GMP documentation refresher.",
  },
  {
    id: "eq-06",
    name: "Domino Printer",
    area: "Packaging Line 2",
    oem: "Domino",
    model: "A420i",
    criticality: "Medium",
    status: "Healthy",
    linkedSkills: ["Inkjet Printer Maintenance", "Electrical Maintenance"],
    engineersCovered: 4,
    engineersTotal: 5,
    coverage: "Strong",
    riskLevel: "Low",
    nextAction: "No immediate action required",
    requiredSkills: ["Domino Printer Fault Finding", "Ink System Maintenance", "Print Head Cleaning"],
    engineersNeedingTraining: 0,
    recommendedTraining: "—",
    linkedRequirements: [],
    aiInsight: "Good coverage across all shifts. No training gaps identified for current operational needs.",
  },
  {
    id: "eq-07",
    name: "Spirax Sarco Steam System",
    area: "Utilities",
    oem: "Spirax Sarco",
    model: "EasiHeat",
    criticality: "High",
    status: "Watch",
    linkedSkills: ["Steam Systems", "Mechanical Maintenance", "Pressure Systems"],
    engineersCovered: 2,
    engineersTotal: 4,
    coverage: "Partial",
    riskLevel: "Medium",
    nextAction: "Complete PSSR compliance check",
    requiredSkills: ["Steam Distribution", "Pressure Vessel Inspection", "Condensate Recovery", "Trap Testing"],
    engineersNeedingTraining: 2,
    recommendedTraining: "Steam System Optimisation & Safety — Asset Reliability Partners",
    linkedRequirements: ["Pressure Systems Coverage"],
    aiInsight: "Steam system is under watchlist due to upcoming PSSR inspection. Two engineers require updated pressure systems training before the next inspection window.",
  },
  {
    id: "eq-08",
    name: "Schneider MCC Panel",
    area: "Electrical Room",
    oem: "Schneider Electric",
    model: "Prisma G",
    criticality: "Critical",
    status: "Healthy",
    linkedSkills: ["Electrical Isolation", "LV Switchgear", "MCC Operation"],
    engineersCovered: 3,
    engineersTotal: 5,
    coverage: "Partial",
    riskLevel: "Medium",
    nextAction: "Renew electrical authorisation certificates",
    requiredSkills: ["HV/LV Isolation Procedures", "MCB/MCCB Testing", "18th Edition Wiring Regs", "LOTO Procedures"],
    engineersNeedingTraining: 2,
    recommendedTraining: "LV Switchgear & Isolation Refresher — Automation Excellence Ltd",
    linkedRequirements: ["Electrical Isolation Coverage"],
    aiInsight: "MCC panel coverage adequate for day shift but two electrical authorisation certificates expire within 60 days. Renewal training should be booked immediately.",
  },
];

// Skill coverage data (mock)
const SKILL_COVERAGE = [
  { label: "PLC / Automation",       covered: 2, total: 5, pct: 40  },
  { label: "Mechanical",             covered: 5, total: 6, pct: 83  },
  { label: "Electrical",             covered: 3, total: 5, pct: 60  },
  { label: "Pneumatics",             covered: 4, total: 5, pct: 80  },
  { label: "Hydraulics",             covered: 2, total: 4, pct: 50  },
  { label: "Robotics",               covered: 1, total: 4, pct: 25  },
  { label: "Instrumentation",        covered: 3, total: 5, pct: 60  },
  { label: "OEM Specialist",         covered: 3, total: 6, pct: 50  },
];

// Priority actions (mock)
const PRIORITY_ACTIONS = [
  { icon: Zap,           cls: "text-red-500",    bg: "bg-[#ef444408]", border: "border-red-500/20",    title: "Train 2 engineers on Siemens S7 fault finding",          sub: "ABB Robot Cell and Line 3 PLC at critical cover risk"        },
  { icon: AlertTriangle, cls: "text-orange-400", bg: "bg-[#f9731608]", border: "border-orange-400/20", title: "Validate robotics skill level on night shift",            sub: "Only 1 engineer validated — SPOF risk across all shifts"     },
  { icon: AlertTriangle, cls: "text-orange-400", bg: "bg-[#f9731608]", border: "border-orange-400/20", title: "Add backup cover for Krones filler",                      sub: "Night shift resilience at minimum required threshold"        },
  { icon: Brain,         cls: "text-yellow-400", bg: "bg-[#facc1508]", border: "border-yellow-400/20", title: "Renew electrical authorisation certs for Schneider panel", sub: "2 certs expiring within 60 days — block dates now"           },
  { icon: BookOpen,      cls: "text-yellow-400", bg: "bg-[#facc1508]", border: "border-yellow-400/20", title: "Review compressor contractor support arrangement",         sub: "Reduce external dependency — train 1 additional internal eng" },
  { icon: CheckCircle2,  cls: "text-blue-400",   bg: "bg-[#3b82f608]", border: "border-blue-400/20",   title: "Link OEM documentation to critical assets",               sub: "Siemens S7, Krones Filler and ABB Robot missing doc links"    },
];

const TABLE_PAGE_SIZE = 6;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function critBadge(c: string) {
  switch (c) {
    case "Critical": return "bg-[#ef444420] text-red-500";
    case "High":     return "bg-[#f9731620] text-orange-400";
    case "Medium":   return "bg-[#facc1520] text-yellow-400";
    default:         return "bg-[#10b98120] text-emerald-500";
  }
}

function statusBadge(s: string) {
  switch (s) {
    case "Healthy":  return "bg-[#10b98120] text-emerald-500";
    case "Watch":    return "bg-[#facc1520] text-yellow-400";
    case "At Risk":  return "bg-[#f9731620] text-orange-400";
    case "Offline":  return "bg-[#ef444420] text-red-500";
    default:         return "bg-gray-800 text-slate-400";
  }
}

function coverageBadge(c: string) {
  switch (c) {
    case "Strong":  return "bg-[#10b98120] text-emerald-500";
    case "Partial": return "bg-[#facc1520] text-yellow-400";
    default:        return "bg-[#ef444420] text-red-500";
  }
}

function riskBadge(r: string) {
  switch (r) {
    case "Critical": return "bg-[#ef444420] text-red-500";
    case "High":     return "bg-[#f9731620] text-orange-400";
    case "Medium":   return "bg-[#facc1520] text-yellow-400";
    default:         return "bg-[#10b98120] text-emerald-500";
  }
}

function coverageBarClass(pct: number): string {
  if (pct >= 75) return "[&>div]:bg-emerald-500";
  if (pct >= 50) return "[&>div]:bg-yellow-400";
  return "[&>div]:bg-red-500";
}

function coverageTextClass(pct: number): string {
  if (pct >= 75) return "text-emerald-400";
  if (pct >= 50) return "text-yellow-400";
  return "text-red-400";
}

// ─── Detail Drawer ────────────────────────────────────────────────────────────

function EquipmentDrawer({ eq, onClose }: { eq: Equipment; onClose: () => void }) {
  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/50 backdrop-blur-[2px]"
        onClick={onClose}
        aria-hidden="true"
      />
      <aside className="fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col border-l border-gray-800 bg-[#090b10] shadow-2xl">
        {/* Header */}
        <header className="flex items-center justify-between border-b border-gray-800 px-6 py-4">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-blue-400" />
            <span className="font-semibold text-slate-50">Equipment Detail</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-[#ffffff1a] hover:text-slate-200"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="flex flex-1 flex-col gap-5 overflow-y-auto px-6 py-5">
          {/* Name + status */}
          <div className="flex flex-col gap-2">
            <h2 className="text-base font-semibold text-slate-50">{eq.name}</h2>
            <div className="flex flex-wrap gap-2">
              <Badge className={`inline-flex h-auto rounded px-2 py-0.5 text-[10px] font-medium shadow-none ${critBadge(eq.criticality)}`}>
                {eq.criticality}
              </Badge>
              <Badge className={`inline-flex h-auto rounded px-2 py-0.5 text-[10px] font-medium shadow-none ${statusBadge(eq.status)}`}>
                {eq.status}
              </Badge>
              <Badge className={`inline-flex h-auto rounded px-2 py-0.5 text-[10px] font-medium shadow-none ${riskBadge(eq.riskLevel)}`}>
                {eq.riskLevel} Risk
              </Badge>
            </div>
          </div>

          {/* Key details grid */}
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "Site Area",   value: eq.area     },
              { label: "OEM",         value: eq.oem      },
              { label: "Model",       value: eq.model    },
              { label: "Coverage",    value: eq.coverage },
            ].map(({ label, value }) => (
              <div key={label} className="flex flex-col gap-0.5 rounded-lg border border-gray-800 bg-[#111620] p-3">
                <span className="text-[10px] font-medium uppercase tracking-wider text-slate-500">{label}</span>
                <span className="text-sm font-medium text-slate-200">{value}</span>
              </div>
            ))}
          </div>

          {/* Engineer coverage */}
          <div className="flex flex-col gap-2 rounded-lg border border-gray-800 bg-[#111620] p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Engineer Coverage</span>
              <span className={`text-sm font-semibold ${coverageTextClass(Math.round((eq.engineersCovered / eq.engineersTotal) * 100))}`}>
                {eq.engineersCovered} / {eq.engineersTotal}
              </span>
            </div>
            <Progress
              value={Math.round((eq.engineersCovered / eq.engineersTotal) * 100)}
              className={`h-2 overflow-hidden rounded bg-gray-800 ${coverageBarClass(Math.round((eq.engineersCovered / eq.engineersTotal) * 100))}`}
            />
            {eq.engineersNeedingTraining > 0 && (
              <p className="text-xs text-slate-500">
                {eq.engineersNeedingTraining} engineer{eq.engineersNeedingTraining !== 1 ? "s" : ""} require training
              </p>
            )}
          </div>

          {/* Required skills */}
          <div className="flex flex-col gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Required Skills</span>
            <div className="flex flex-wrap gap-1.5">
              {eq.requiredSkills.map((s) => (
                <Badge key={s} className="inline-flex h-auto rounded bg-[#3b82f620] px-2 py-0.5 text-[10px] font-medium text-blue-400 shadow-none hover:bg-[#3b82f620]">
                  {s}
                </Badge>
              ))}
            </div>
          </div>

          {/* Recommended training */}
          {eq.recommendedTraining !== "—" && (
            <div className="flex flex-col gap-1.5 rounded-lg border border-gray-800 bg-[#111620] p-4">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Recommended Training</span>
              <div className="flex items-start gap-2">
                <BookOpen className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
                <p className="text-sm text-slate-300">{eq.recommendedTraining}</p>
              </div>
            </div>
          )}

          {/* Linked requirements */}
          {eq.linkedRequirements.length > 0 && (
            <div className="flex flex-col gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Open Requirements</span>
              <div className="flex flex-col gap-1.5">
                {eq.linkedRequirements.map((r) => (
                  <div key={r} className="flex items-center gap-2 rounded-lg border border-gray-800 bg-[#111620] px-3 py-2">
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-orange-400" />
                    <span className="text-sm text-slate-300">{r}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* AI insight */}
          <div className="flex flex-col gap-2 rounded-lg border border-blue-500/20 bg-[#3b82f610] p-4">
            <div className="flex items-center gap-2">
              <Brain className="h-4 w-4 text-blue-400" />
              <span className="text-xs font-semibold text-blue-400">AI Insight</span>
            </div>
            <p className="text-xs leading-relaxed text-slate-300">{eq.aiInsight}</p>
          </div>

          {/* Next action */}
          <div className="flex flex-col gap-1.5 rounded-lg border border-gray-800 bg-[#111620] p-4">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Next Action</span>
            <p className="text-sm text-slate-200">{eq.nextAction}</p>
          </div>

          <button
            type="button"
            className="mt-auto h-10 w-full rounded-lg bg-blue-600 text-sm font-semibold text-white transition-colors hover:bg-blue-500"
          >
            Create Action Plan
          </button>
        </div>
      </aside>
    </>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export const EquipmentSection = (): JSX.Element => {
  const [search,         setSearch]         = useState("");
  const [filterArea,     setFilterArea]     = useState("all");
  const [filterCrit,     setFilterCrit]     = useState("all");
  const [filterOem,      setFilterOem]      = useState("all");
  const [filterStatus,   setFilterStatus]   = useState("all");
  const [filterCoverage, setFilterCoverage] = useState("all");
  const [tablePage,      setTablePage]      = useState(0);
  const [selected,       setSelected]       = useState<Equipment | null>(null);

  const areas = useMemo(() => [...new Set(MOCK_EQUIPMENT.map((e) => e.area))].sort(), []);
  const oems  = useMemo(() => [...new Set(MOCK_EQUIPMENT.map((e) => e.oem))].sort(), []);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return MOCK_EQUIPMENT.filter((e) => {
      if (search && !e.name.toLowerCase().includes(q) && !e.oem.toLowerCase().includes(q) && !e.area.toLowerCase().includes(q)) return false;
      if (filterArea     !== "all" && e.area        !== filterArea)     return false;
      if (filterCrit     !== "all" && e.criticality !== filterCrit)     return false;
      if (filterOem      !== "all" && e.oem         !== filterOem)      return false;
      if (filterStatus   !== "all" && e.status      !== filterStatus)   return false;
      if (filterCoverage !== "all" && e.coverage    !== filterCoverage) return false;
      return true;
    });
  }, [search, filterArea, filterCrit, filterOem, filterStatus, filterCoverage]);

  const hasFilters = !!(search || filterArea !== "all" || filterCrit !== "all" || filterOem !== "all" || filterStatus !== "all" || filterCoverage !== "all");

  function clearFilters() {
    setSearch(""); setFilterArea("all"); setFilterCrit("all");
    setFilterOem("all"); setFilterStatus("all"); setFilterCoverage("all");
    setTablePage(0);
  }

  const totalPages = Math.max(1, Math.ceil(filtered.length / TABLE_PAGE_SIZE));
  const paged      = filtered.slice(tablePage * TABLE_PAGE_SIZE, (tablePage + 1) * TABLE_PAGE_SIZE);

  // KPI calcs
  const totalEquipment   = MOCK_EQUIPMENT.length;
  const criticalCount    = MOCK_EQUIPMENT.filter((e) => e.criticality === "Critical").length;
  const withGaps         = MOCK_EQUIPMENT.filter((e) => e.coverage === "Gap").length;
  const highRisk         = MOCK_EQUIPMENT.filter((e) => e.riskLevel === "Critical" || e.riskLevel === "High").length;

  return (
    <section className="relative flex min-w-0 w-full max-w-full flex-1 grow flex-col items-start gap-6 overflow-x-hidden px-4 pb-12 pt-0 md:gap-8 md:px-6 xl:px-8">

      {selected && <EquipmentDrawer eq={selected} onClose={() => setSelected(null)} />}

      {/* ── Page header ─────────────────────────────────────────────────── */}
      <header className="flex w-full flex-col justify-between gap-4 py-5 lg:flex-row lg:items-center">
        <div className="flex flex-col items-start gap-1">
          <div className="flex items-center gap-2">
            <h1 className="mt-[-1.00px] font-text-xl-semibold text-[length:var(--text-xl-semibold-font-size)] font-[number:var(--text-xl-semibold-font-weight)] leading-[var(--text-xl-semibold-line-height)] tracking-[var(--text-xl-semibold-letter-spacing)] text-slate-50 [font-style:var(--text-xl-semibold-font-style)]">
              Equipment
            </h1>
            <ContextHelp content={{
              title: "Equipment",
              body:  "Manage your site's critical assets and understand capability coverage. Each asset is linked to the skills engineers need to operate and maintain it safely.",
              usage: "Click any asset row to open the detail panel. Use the filters to focus on gaps or high-risk assets. The Skills Coverage section shows how well your team covers each discipline.",
              aiNote: "Vorta AI analyses equipment criticality against current engineer skill coverage to surface SPOF risks and recommend training priorities.",
            }} />
          </div>
          <p className="text-sm text-slate-400">
            Track critical assets, capability coverage and equipment risk across your site.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3 self-start lg:self-auto">
          <Button type="button" className="h-auto gap-2 bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500">
            <Plus className="h-4 w-4" /> Add Equipment
          </Button>
          <Button type="button" variant="outline" className="h-auto gap-2 border-[#ffffff20] bg-[#ffffff1a] px-4 py-2 text-sm font-semibold text-slate-50 hover:bg-[#ffffff24] hover:text-slate-50">
            <Upload className="h-4 w-4" /> Import Asset List
          </Button>
          <Button type="button" variant="outline" className="h-auto gap-2 border-[#ffffff20] bg-[#ffffff1a] px-4 py-2 text-sm font-semibold text-slate-50 hover:bg-[#ffffff24] hover:text-slate-50">
            <Download className="h-4 w-4" /> Export Report
          </Button>
          <button type="button"
            className="inline-flex h-10 w-10 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-[#ffffff1a] hover:text-slate-200">
            <RefreshCw className="h-5 w-5" />
          </button>
          <button type="button"
            className="inline-flex h-10 w-10 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-[#ffffff1a] hover:text-slate-200">
            <UserCircle className="h-8 w-8" />
          </button>
        </div>
      </header>

      {/* ── KPI cards ─────────────────────────────────────────────────────── */}
      <div className="grid w-full grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Total Equipment",          value: totalEquipment, sub: "Assets registered on site",                     icon: Shield,        vc: "text-slate-50"    },
          { label: "Critical Assets",          value: criticalCount,  sub: "Assets rated critical criticality",             icon: Zap,           vc: "text-red-500"     },
          { label: "Equipment with Skill Gaps", value: withGaps,      sub: "Assets with coverage below threshold",          icon: AlertTriangle, vc: "text-orange-400"  },
          { label: "High-Risk Assets",         value: highRisk,       sub: "High or critical combined risk rating",         icon: Brain,         vc: "text-yellow-400"  },
        ].map(({ label, value, sub, icon: Icon, vc }) => (
          <Card key={label} className="rounded-xl border border-gray-800 bg-[#141820] shadow-none">
            <CardContent className="flex flex-col gap-3 p-5">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-medium text-slate-400">{label}</p>
                <Icon className="h-4 w-4 shrink-0 text-slate-600" />
              </div>
              <p className={`text-2xl font-semibold tabular-nums ${vc}`}>{value}</p>
              <p className="text-[11px] text-slate-500">{sub}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ── Filter bar ──────────────────────────────────────────────────────── */}
      <Card className="w-full rounded-xl border border-gray-800 bg-[#141820] shadow-none">
        <CardContent className="flex flex-wrap items-center gap-3 p-4">
          <div className="relative min-w-[160px] flex-1">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              placeholder="Search equipment…"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setTablePage(0); }}
              className="h-8 w-full rounded-lg border border-gray-800 bg-[#0b0e14] pl-8 pr-3 text-sm text-slate-200 placeholder:text-slate-600 focus:border-blue-500/50 focus:outline-none focus:ring-1 focus:ring-blue-500/30"
            />
          </div>
          {(
            [
              { label: "Area",          value: filterArea,     onChange: (v: string) => { setFilterArea(v);     setTablePage(0); }, options: areas,                                               placeholder: "All Areas"          },
              { label: "Criticality",   value: filterCrit,     onChange: (v: string) => { setFilterCrit(v);     setTablePage(0); }, options: ["Critical","High","Medium","Low"],                   placeholder: "All Criticalities"  },
              { label: "OEM",           value: filterOem,      onChange: (v: string) => { setFilterOem(v);      setTablePage(0); }, options: oems,                                                placeholder: "All OEMs"           },
              { label: "Status",        value: filterStatus,   onChange: (v: string) => { setFilterStatus(v);   setTablePage(0); }, options: ["Healthy","Watch","At Risk","Offline"],              placeholder: "All Statuses"       },
              { label: "Coverage",      value: filterCoverage, onChange: (v: string) => { setFilterCoverage(v); setTablePage(0); }, options: ["Strong","Partial","Gap"],                          placeholder: "All Coverage"       },
            ] as const
          ).map(({ label, value, onChange, options, placeholder }) => (
            <select key={label} value={value} onChange={(e) => onChange(e.target.value)}
              className="h-8 rounded-lg border border-gray-800 bg-[#0b0e14] px-3 text-sm text-slate-300 focus:outline-none">
              <option value="all">{placeholder}</option>
              {options.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          ))}
          {hasFilters && (
            <button type="button" onClick={clearFilters}
              className="flex items-center gap-1 text-xs font-medium text-slate-500 transition-colors hover:text-slate-200">
              <X className="h-3 w-3" /> Clear
            </button>
          )}
          <span className="ml-auto text-xs text-slate-500">
            {filtered.length} of {MOCK_EQUIPMENT.length} assets
            {hasFilters ? " (filtered)" : ""}
          </span>
        </CardContent>
      </Card>

      {/* ── Equipment table ─────────────────────────────────────────────────── */}
      <Card className="min-w-0 w-full rounded-xl border border-gray-800 bg-[#141820] shadow-none">
        <CardContent className="flex flex-col gap-4 p-0">
          <div className="flex items-center justify-between gap-3 px-5 pt-5">
            <div>
              <h2 className="font-semibold text-slate-50">Asset Register</h2>
              <p className="text-sm text-slate-400">
                {filtered.length} asset{filtered.length !== 1 ? "s" : ""}
                {totalPages > 1 ? ` · page ${tablePage + 1} of ${totalPages}` : ""}
              </p>
            </div>
            <div className="flex items-center gap-1">
              <button type="button" onClick={() => setTablePage((p) => Math.max(0, p - 1))} disabled={tablePage === 0}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-gray-800 text-slate-400 transition-colors hover:bg-[#ffffff1a] hover:text-slate-200 disabled:opacity-30">
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button type="button" onClick={() => setTablePage((p) => Math.min(totalPages - 1, p + 1))} disabled={tablePage >= totalPages - 1}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-gray-800 text-slate-400 transition-colors hover:bg-[#ffffff1a] hover:text-slate-200 disabled:opacity-30">
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="w-full overflow-x-auto">
            <table className="w-max min-w-[900px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-gray-800 bg-[#0f1318]">
                  {[
                    { label: "Equipment",         cls: "sticky left-0 z-10 bg-[#0f1318] min-w-[200px]" },
                    { label: "Area",              cls: "min-w-[140px]" },
                    { label: "OEM / Brand",       cls: "min-w-[150px]" },
                    { label: "Criticality",       cls: "min-w-[100px]" },
                    { label: "Status",            cls: "min-w-[90px]"  },
                    { label: "Linked Skills",     cls: "min-w-[200px]" },
                    { label: "Coverage",          cls: "min-w-[130px]" },
                    { label: "Risk",              cls: "min-w-[90px]"  },
                    { label: "Next Action",       cls: "min-w-[220px]" },
                    { label: "",                  cls: "min-w-[80px]"  },
                  ].map(({ label, cls }) => (
                    <th key={label + cls} className={`px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-500 ${cls}`}>
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paged.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="py-12 text-center text-sm text-slate-500">
                      No equipment matches the current filters.{" "}
                      {hasFilters && (
                        <button type="button" onClick={clearFilters} className="font-medium text-blue-400 hover:underline">
                          Clear filters
                        </button>
                      )}
                    </td>
                  </tr>
                ) : (
                  paged.map((eq, idx) => {
                    const rowBg   = idx % 2 === 0 ? "bg-[#141820]" : "bg-[#111620]";
                    const covPct  = Math.round((eq.engineersCovered / eq.engineersTotal) * 100);
                    const isSelected = selected?.id === eq.id;
                    return (
                      <tr
                        key={eq.id}
                        onClick={() => setSelected(eq)}
                        className={`border-b border-gray-800/50 cursor-pointer transition-colors hover:bg-[#1a2030] ${isSelected ? "bg-[#1c2338]" : rowBg}`}
                      >
                        {/* Equipment name — sticky */}
                        <td className={`sticky left-0 z-10 min-w-[200px] px-4 py-2.5 ${isSelected ? "bg-[#1c2338]" : rowBg}`}>
                          <div className="flex flex-col gap-0.5">
                            <span className="font-medium text-slate-100 leading-tight">{eq.name}</span>
                            <span className="text-[10px] text-slate-500">{eq.model}</span>
                          </div>
                        </td>
                        <td className="px-4 py-2.5 text-sm text-slate-400">{eq.area}</td>
                        <td className="px-4 py-2.5 text-sm text-slate-300">{eq.oem}</td>
                        <td className="px-4 py-2.5">
                          <Badge className={`inline-flex h-auto rounded px-2 py-0.5 text-[10px] font-medium shadow-none ${critBadge(eq.criticality)}`}>
                            {eq.criticality}
                          </Badge>
                        </td>
                        <td className="px-4 py-2.5">
                          <Badge className={`inline-flex h-auto rounded px-2 py-0.5 text-[10px] font-medium shadow-none ${statusBadge(eq.status)}`}>
                            {eq.status}
                          </Badge>
                        </td>
                        <td className="px-4 py-2.5">
                          <div className="flex flex-wrap gap-1">
                            {eq.linkedSkills.slice(0, 2).map((s) => (
                              <Badge key={s} className="inline-flex h-auto rounded bg-[#3b82f620] px-1.5 py-0.5 text-[10px] font-medium text-blue-400 shadow-none hover:bg-[#3b82f620]">
                                {s}
                              </Badge>
                            ))}
                            {eq.linkedSkills.length > 2 && (
                              <span className="text-[10px] text-slate-500">+{eq.linkedSkills.length - 2}</span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-2.5">
                          <div className="flex flex-col gap-1.5">
                            <div className="flex items-center justify-between gap-2">
                              <Badge className={`inline-flex h-auto rounded px-2 py-0.5 text-[10px] font-medium shadow-none ${coverageBadge(eq.coverage)}`}>
                                {eq.coverage}
                              </Badge>
                              <span className={`text-[10px] font-semibold tabular-nums ${coverageTextClass(covPct)}`}>
                                {eq.engineersCovered}/{eq.engineersTotal}
                              </span>
                            </div>
                            <Progress value={covPct} className={`h-1 overflow-hidden rounded bg-gray-800 ${coverageBarClass(covPct)}`} />
                          </div>
                        </td>
                        <td className="px-4 py-2.5">
                          <Badge className={`inline-flex h-auto rounded px-2 py-0.5 text-[10px] font-medium shadow-none ${riskBadge(eq.riskLevel)}`}>
                            {eq.riskLevel}
                          </Badge>
                        </td>
                        <td className="px-4 py-2.5 text-xs text-slate-400 max-w-[220px]">
                          <span className="line-clamp-2">{eq.nextAction}</span>
                        </td>
                        <td className="px-4 py-2.5">
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); setSelected(eq); }}
                            className="rounded-lg border border-gray-700 px-2.5 py-1 text-[10px] font-medium text-slate-400 transition-colors hover:border-gray-600 hover:bg-[#ffffff0a] hover:text-slate-200"
                          >
                            Review
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-gray-800 px-5 py-3 text-xs text-slate-500">
              <span>
                {tablePage * TABLE_PAGE_SIZE + 1}–{Math.min((tablePage + 1) * TABLE_PAGE_SIZE, filtered.length)} of {filtered.length}
              </span>
              <div className="flex items-center gap-1">
                {Array.from({ length: Math.min(totalPages, 8) }).map((_, i) => (
                  <button key={i} type="button" onClick={() => setTablePage(i)}
                    className={`inline-flex h-7 w-7 items-center justify-center rounded-lg text-xs transition-colors ${i === tablePage ? "bg-blue-500/20 font-semibold text-blue-400" : "text-slate-500 hover:bg-[#ffffff1a]"}`}>
                    {i + 1}
                  </button>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Two-column bottom section ────────────────────────────────────────── */}
      <div className="grid w-full grid-cols-1 gap-6 xl:grid-cols-2">

        {/* Skills Coverage by Type */}
        <Card className="rounded-xl border border-gray-800 bg-[#141820] shadow-none">
          <CardContent className="flex flex-col gap-5 p-5 md:p-6">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h2 className="font-semibold text-slate-50">Skills Coverage by Equipment Type</h2>
                <p className="text-sm text-slate-400">Engineer competency coverage for key equipment disciplines</p>
              </div>
              <Badge className="inline-flex h-auto items-center gap-1.5 rounded bg-[#3b82f620] px-2 py-1 text-[10px] font-medium text-blue-500 shadow-none hover:bg-[#3b82f620]">
                <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />Live
              </Badge>
            </div>

            <div className="flex flex-col gap-4">
              {SKILL_COVERAGE.map((row) => (
                <div key={row.label} className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-slate-200">{row.label}</span>
                      {row.pct < 50 && (
                        <span className="rounded bg-[#ef444415] px-1.5 py-0.5 text-[10px] font-medium text-red-500">
                          Gap
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-sm font-semibold tabular-nums ${coverageTextClass(row.pct)}`}>
                        {row.pct}%
                      </span>
                      <span className="text-[11px] text-slate-500">{row.covered}/{row.total}</span>
                    </div>
                  </div>
                  <Progress value={row.pct} className={`h-2 overflow-hidden rounded bg-gray-800 ${coverageBarClass(row.pct)}`} />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Priority Actions */}
        <Card className="rounded-xl border border-gray-800 bg-[#141820] shadow-none">
          <CardContent className="flex flex-col gap-5 p-5 md:p-6">
            <div className="flex items-center gap-2">
              <h2 className="font-semibold text-slate-50">Priority Actions</h2>
              <Badge className="inline-flex h-auto items-center gap-1.5 rounded bg-[#3b82f620] px-2 py-1 text-[10px] font-medium text-blue-500 shadow-none hover:bg-[#3b82f620]">
                <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />AI Ranked
              </Badge>
            </div>

            <div className="flex flex-col gap-3">
              {PRIORITY_ACTIONS.map((action, i) => {
                const Icon = action.icon;
                return (
                  <div key={i} className={`flex items-start gap-3 rounded-lg border ${action.border} ${action.bg} p-4`}>
                    <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${action.cls}`} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-slate-100">{action.title}</p>
                      <p className="mt-0.5 text-xs leading-relaxed text-slate-400">{action.sub}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

    </section>
  );
};
