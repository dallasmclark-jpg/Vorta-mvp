import { useNavigate, useParams } from "react-router-dom";
import {
  Bell,
  ChevronRight,
  Download,
  Edit,
  RefreshCw,
  UserCircle,
  Users,
  Zap,
  AlertTriangle,
  GraduationCap,
  ClipboardList,
  Calendar,
  TableProperties,
  UserPlus,
  FileDown,
  TrendingUp,
} from "lucide-react";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Card, CardContent } from "../../components/ui/card";

// ─── Shared equipment base ────────────────────────────────────────────────────

interface EquipmentBase {
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

const EQUIPMENT_BASE: Record<string, EquipmentBase> = {
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

const DEFAULT_ID = "pl-02";

// ─── Tabs ─────────────────────────────────────────────────────────────────────

const TABS = [
  { label: "Overview",           id: "overview" },
  { label: "Health",             id: "health" },
  { label: "Work Orders",        id: "wo",      badge: 12 },
  { label: "PMs",                id: "pm",      badge: 8 },
  { label: "History",            id: "history" },
  { label: "Skills & Engineers", id: "skills" },
  { label: "Spares",             id: "spares" },
  { label: "Documents",          id: "docs" },
  { label: "AI Insights",        id: "ai" },
];

// ─── Mock data ────────────────────────────────────────────────────────────────

const RISK_SKILLS = [
  { name: "Siemens S7 PLC",    covered: false },
  { name: "Safety Circuits",   covered: false },
  { name: "Vision Systems",    covered: true  },
  { name: "Hydraulics",        covered: true  },
  { name: "Robot Programming", covered: true  },
];

const ENGINEERS = [
  { initials: "JW", name: "James Wilson",  role: "Mechanical Engineer", match: 96, status: "Available",   shift: "Days",   statusClass: "bg-emerald-500/20 text-emerald-400", shiftClass: "bg-blue-500/20 text-blue-400" },
  { initials: "SJ", name: "Sarah Jones",   role: "Senior Technician",   match: 91, status: "Night Shift", shift: "Nights", statusClass: "bg-yellow-500/20 text-yellow-400", shiftClass: "bg-slate-600/40 text-slate-300" },
  { initials: "LE", name: "Liam Evans",    role: "Maintenance Lead",    match: 87, status: "Available",   shift: "Days",   statusClass: "bg-emerald-500/20 text-emerald-400", shiftClass: "bg-blue-500/20 text-blue-400" },
  { initials: "MC", name: "Mike Chen",     role: "Junior Technician",   match: 84, status: "Busy",        shift: "Days",   statusClass: "bg-orange-500/20 text-orange-400",  shiftClass: "bg-blue-500/20 text-blue-400" },
];

const AI_RANKED = [
  { name: "James Wilson",  role: "Mechanical Engineer", match: 96 },
  { name: "Sarah Chen",    role: "Senior Technician",   match: 88 },
  { name: "Michael Torres",role: "Maintenance Lead",    match: 74 },
];

const COVERAGE_BARS = [
  { label: "Experts",     count: 2, color: "#10b981", width: "17%" },
  { label: "Competent",   count: 5, color: "#3b82f6", width: "42%" },
  { label: "Developing",  count: 3, color: "#eab308", width: "25%" },
  { label: "No Training", count: 2, color: "#ef4444", width: "17%" },
];

const TRAINING_RECS = [
  { priority: "HIGH",   label: "Conveyor Systems",   sub: "1 engineer required",        priClass: "bg-red-500/20 text-red-400" },
  { priority: "MEDIUM", label: "Electrical Systems", sub: "Upskill 2 engineers",        priClass: "bg-yellow-500/20 text-yellow-400" },
  { priority: "LOW",    label: "Robot Programming",  sub: "Cross-training opportunity", priClass: "bg-emerald-500/20 text-emerald-400" },
];

const EXPIRIES = [
  { initials: "JW", name: "James Wilson", cert: "PLC Advanced",  days: 14, urgentClass: "bg-red-500/20 text-red-400"     },
  { initials: "SC", name: "Sarah Chen",   cert: "Robot Safety",  days: 28, urgentClass: "bg-orange-500/20 text-orange-400" },
  { initials: "MC", name: "Mike Chen",    cert: "Hydraulics",    days: 45, urgentClass: "bg-yellow-500/20 text-yellow-400" },
];

const QUICK_ACTIONS = [
  { Icon: UserPlus,        label: "Assign Best Engineer"  },
  { Icon: Calendar,        label: "Schedule Training"     },
  { Icon: TableProperties, label: "View Skills Matrix"    },
  { Icon: Users,           label: "Request Contractor"    },
  { Icon: FileDown,        label: "Export Skills Report"  },
];

// ─── Donut chart ──────────────────────────────────────────────────────────────

function SkillsDonut() {
  const size = 120;
  const sw   = 16;
  const r    = (size - sw) / 2;
  const circ = 2 * Math.PI * r;
  const segs = [
    { value: 7, color: "#10b981" },
    { value: 2, color: "#eab308" },
    { value: 1, color: "#ef4444" },
  ];
  const total = 10;
  let offset = 0;
  const arcs = segs.map((s) => {
    const len = (s.value / total) * circ;
    const a = { offset, len, color: s.color };
    offset += len + 2;
    return a;
  });
  const cx = size / 2;
  const cy = size / 2;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#1e2433" strokeWidth={sw} />
      {arcs.map((a, i) => (
        <circle key={i} cx={cx} cy={cy} r={r}
          fill="none" stroke={a.color} strokeWidth={sw}
          strokeDasharray={`${Math.max(0, a.len - 2)} ${circ}`}
          strokeDashoffset={-a.offset}
          transform={`rotate(-90 ${cx} ${cy})`}
        />
      ))}
      <text x="50%" y="46%" dominantBaseline="middle" textAnchor="middle"
        fill="white" fontSize="20" fontWeight="700">82%</text>
      <text x="50%" y="62%" dominantBaseline="middle" textAnchor="middle"
        fill="#94a3b8" fontSize="9">Covered</text>
    </svg>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export const EquipmentSkills = (): JSX.Element => {
  const navigate = useNavigate();
  const { equipmentId } = useParams<{ equipmentId?: string }>();

  const eq = (equipmentId && EQUIPMENT_BASE[equipmentId]) ?? EQUIPMENT_BASE[DEFAULT_ID];

  const riskBadgeClass =
    eq.riskLevel === "Critical" ? "bg-[#ef444420] text-red-400" :
    eq.riskLevel === "High"     ? "bg-[#f9731620] text-orange-400" :
    eq.riskLevel === "Medium"   ? "bg-[#eab30820] text-yellow-400" :
    "bg-[#10b98120] text-emerald-400";

  const statusDotClass =
    eq.status === "Running" ? "bg-emerald-500" :
    eq.status === "At Risk" ? "bg-orange-400" :
    eq.status === "Fault"   ? "bg-red-500" : "bg-yellow-400";

  const riskTotal = eq.riskBreakdown.reduce((s, b) => s + b.pct, 0) || 1;

  const handleTabClick = (tabId: string) => {
    const id = equipmentId ?? DEFAULT_ID;
    if (tabId === "overview") navigate(`/equipment/${id}/overview`);
    if (tabId === "health")   navigate(`/equipment/${id}/health`);
    if (tabId === "wo")       navigate(`/equipment/${id}/work-orders`);
    if (tabId === "pm")       navigate(`/equipment/${id}/pms`);
    if (tabId === "history")  navigate(`/equipment/${id}/history`);
    if (tabId === "spares")   navigate(`/equipment/${id}/spares`);
  };

  return (
    <section className="flex w-full flex-col gap-0 overflow-x-hidden pb-10">

      {/* ── Sticky Header ─────────────────────────────────────────────────── */}
      <div className="sticky top-0 z-10 border-b border-gray-800 bg-[#0b0e14] px-4 pb-4 pt-4 md:px-6">

        <div className="mb-4 flex items-center justify-between gap-4">
          <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-sm text-slate-500">
            <button type="button" onClick={() => navigate("/equipment")} className="transition-colors hover:text-slate-300">
              Equipment
            </button>
            <ChevronRight className="h-3.5 w-3.5" />
            <span className="text-slate-300">{eq.name} ({eq.assetNumber})</span>
          </nav>
          <div className="flex shrink-0 items-center gap-2">
            <Button type="button" variant="outline"
              className="h-auto gap-2 border-gray-700 bg-transparent px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-gray-800 hover:text-slate-100">
              <Edit className="h-3.5 w-3.5" /> Edit Equipment
            </Button>
            <button type="button" className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-400 hover:bg-gray-800 hover:text-slate-200 transition-colors">
              <Bell className="h-4 w-4" />
            </button>
            <button type="button" onClick={() => navigate("/settings")} className="inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-gray-800 hover:text-slate-200 transition-colors">
              <UserCircle className="h-7 w-7" />
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:gap-6">
          <div className="h-28 w-32 shrink-0 overflow-hidden rounded-xl border border-gray-800 bg-[#141820]">
            <img src={eq.image} alt={eq.name} className="h-full w-full object-cover"
              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-2xl font-bold tracking-tight text-slate-50">{eq.name}</h1>
              <Badge className={`inline-flex h-auto rounded px-2 py-0.5 text-[10px] font-bold uppercase shadow-none ${riskBadgeClass}`}>
                {eq.riskLevel} Risk
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              <span className={`h-2 w-2 rounded-full ${statusDotClass}`} aria-hidden="true" />
              <span className="text-sm font-semibold text-slate-200">{eq.status}</span>
              <span className="text-sm text-slate-500">{eq.statusNote}</span>
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-400">
              <span className="font-medium text-slate-300">{eq.assetNumber}</span>
              <span className="rounded bg-gray-800 px-1.5 py-0.5 font-medium tracking-wide">{eq.type}</span>
              <span>📍 {eq.area}</span>
              <span>Manufacturer: <span className="text-slate-300">{eq.manufacturer}</span></span>
              <span>Model: <span className="text-slate-300">{eq.model}</span></span>
              <span>Serial Number: <span className="text-slate-300">{eq.serialNumber}</span></span>
              <span>Install Date: <span className="text-slate-300">{eq.installDate}</span></span>
              <span>Warranty: <span className="text-orange-400">{eq.warranty}</span></span>
              <span>Criticality: <span className="text-slate-300">{eq.criticality}</span></span>
            </div>
          </div>
          <div className="flex shrink-0 flex-col gap-2 lg:w-52">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Risk Score</span>
            <div className="flex items-end gap-3">
              <span className="text-4xl font-bold text-slate-50">{eq.riskScore}%</span>
              <Badge className={`mb-1 inline-flex h-auto rounded px-2 py-0.5 text-[10px] font-bold uppercase shadow-none ${riskBadgeClass}`}>
                {eq.riskLevel}
              </Badge>
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-slate-500">Risk Breakdown</span>
              <div className="flex h-2 overflow-hidden rounded-full">
                {eq.riskBreakdown.map((b) => (
                  <div key={b.label} style={{ width: `${(b.pct / riskTotal) * 100}%`, backgroundColor: b.color }} />
                ))}
              </div>
              <div className="flex flex-wrap gap-x-2 gap-y-0.5">
                {eq.riskBreakdown.map((b) => (
                  <span key={b.label} className="inline-flex items-center gap-1 text-[10px] text-slate-400">
                    <span className={`h-1.5 w-1.5 rounded-full ${b.dotClass}`} />
                    {b.label} {b.pct}%
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-4 flex gap-0 overflow-x-auto">
          {TABS.map((tab) => (
            <button key={tab.id} type="button" onClick={() => handleTabClick(tab.id)}
              className={`flex shrink-0 items-center gap-1.5 border-b-2 px-4 py-2.5 text-xs font-semibold transition-colors ${
                tab.id === "skills"
                  ? "border-blue-500 text-blue-400"
                  : "border-transparent text-slate-500 hover:text-slate-300"
              }`}>
              {tab.label}
              {tab.badge && (
                <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-blue-500/20 px-1 text-[9px] font-bold text-blue-400">
                  {tab.badge}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ── Page Content ──────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-4 px-4 pt-4 md:px-6">

        {/* Page title + actions */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-slate-50">Skills & Engineers</h2>
            <p className="text-xs text-slate-500">View the skills required for this equipment and the engineers who are qualified to work on it.</p>
          </div>
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline"
              className="h-auto gap-1.5 border-gray-700 bg-transparent px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-gray-800 hover:text-slate-100 shadow-none">
              Skills Gap Report
            </Button>
            <Button type="button" variant="outline"
              className="h-auto gap-1.5 border-gray-700 bg-transparent px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-gray-800 hover:text-slate-100 shadow-none">
              <Download className="h-3.5 w-3.5" /> Export
            </Button>
          </div>
        </div>

        {/* ── Row 1: Skills Coverage | Knowledge Risk | AI Recommendation ── */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">

          {/* Skills Coverage */}
          <Card className="rounded-xl border border-gray-800 bg-[#141820] shadow-none">
            <CardContent className="p-4">
              <h3 className="mb-3 text-sm font-semibold text-slate-200">Skills Coverage</h3>
              <div className="flex items-center gap-4">
                <SkillsDonut />
                <div className="flex flex-col gap-1.5">
                  {[
                    { label: "Fully Covered", count: 7, color: "#10b981" },
                    { label: "Partial Gap",   count: 2, color: "#eab308" },
                    { label: "Not Covered",   count: 1, color: "#ef4444" },
                  ].map((l) => (
                    <div key={l.label} className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: l.color }} />
                        <span className="text-[11px] text-slate-400">{l.label}:</span>
                      </div>
                      <span className="text-[11px] font-bold text-slate-200">{l.count}</span>
                    </div>
                  ))}
                </div>
              </div>
              <p className="mt-3 text-[11px] text-slate-500">10 of 12 required skills covered</p>
              <button type="button"
                className="mt-3 rounded-lg border border-blue-500/30 bg-blue-500/10 px-3 py-1.5 text-xs font-semibold text-blue-400 hover:bg-blue-500/20 transition-colors">
                View Skills Matrix
              </button>
            </CardContent>
          </Card>

          {/* Knowledge Risk */}
          <Card className="rounded-xl border border-gray-800 bg-[#141820] shadow-none">
            <CardContent className="p-4">
              <h3 className="mb-3 text-sm font-semibold text-slate-200">Knowledge Risk</h3>
              <div className="mb-3 flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-orange-500/10">
                  <AlertTriangle className="h-4 w-4 text-orange-400" />
                </div>
                <div>
                  <p className="text-[11px] text-slate-500">Single Point of Failure:</p>
                  <p className="text-base font-bold text-slate-50">NO</p>
                </div>
              </div>
              <p className="mb-2 text-xs font-semibold text-slate-300">3 qualified engineers</p>
              <div className="mb-3 flex flex-col gap-1">
                {[
                  { dot: "bg-emerald-500", label: "2 Experts" },
                  { dot: "bg-blue-400",    label: "1 Developing" },
                  { dot: "bg-slate-600",   label: "0 Apprentices" },
                ].map((l) => (
                  <div key={l.label} className="flex items-center gap-2">
                    <span className={`h-2 w-2 rounded-full ${l.dot}`} />
                    <span className="text-[11px] text-slate-400">{l.label}</span>
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-2 rounded-lg bg-gray-800 px-3 py-2">
                <span className="text-[11px] text-slate-400">Retirement risk:</span>
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                <span className="text-[11px] font-semibold text-emerald-400">Low</span>
              </div>
            </CardContent>
          </Card>

          {/* AI Recommendation */}
          <Card className="rounded-xl border border-blue-500/20 bg-[#141820] shadow-none">
            <CardContent className="p-4">
              <div className="mb-3 flex items-center gap-2">
                <Zap className="h-4 w-4 text-blue-400" />
                <h3 className="text-sm font-semibold text-slate-200">AI Recommendation</h3>
              </div>
              <p className="mb-3 text-[11px] leading-relaxed text-slate-400">
                If this equipment fails, these engineers are the best suited to respond
              </p>
              <div className="flex flex-col gap-0 divide-y divide-gray-800">
                {AI_RANKED.map((eng, i) => (
                  <div key={eng.name} className="flex items-center gap-3 py-2.5">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-gray-800 text-[10px] font-bold text-slate-400">
                      {i + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-semibold text-slate-200">{eng.name}</p>
                      <p className="text-[10px] text-slate-500">{eng.role}</p>
                    </div>
                    <span className={`text-sm font-bold ${eng.match >= 90 ? "text-emerald-400" : eng.match >= 80 ? "text-yellow-400" : "text-orange-400"}`}>
                      {eng.match}%
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ── Row 2: Highest Risk Skills | Qualified Engineers ─────────── */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">

          {/* Highest Risk Skills */}
          <Card className="rounded-xl border border-gray-800 bg-[#141820] shadow-none">
            <CardContent className="p-4">
              <h3 className="mb-3 text-sm font-semibold text-slate-200">Highest Risk Skills</h3>
              <div className="flex flex-col gap-0 divide-y divide-gray-800">
                {RISK_SKILLS.map((skill) => (
                  <div key={skill.name} className="flex items-center justify-between py-3">
                    <span className="text-xs text-slate-200">{skill.name}</span>
                    <Badge className={`h-auto rounded px-2.5 py-0.5 text-[10px] font-bold uppercase shadow-none ${
                      skill.covered
                        ? "bg-[#10b98120] text-emerald-400"
                        : "bg-[#ef444420] text-red-400"
                    }`}>
                      {skill.covered ? "Covered" : "Gap"}
                    </Badge>
                  </div>
                ))}
              </div>
              <button type="button" className="mt-3 text-xs text-blue-400 hover:text-blue-300 transition-colors">
                View Full Skills Matrix →
              </button>
            </CardContent>
          </Card>

          {/* Qualified Engineers */}
          <Card className="rounded-xl border border-gray-800 bg-[#141820] shadow-none">
            <CardContent className="p-4">
              <h3 className="mb-3 text-sm font-semibold text-slate-200">Qualified Engineers</h3>
              <div className="flex flex-col gap-0 divide-y divide-gray-800">
                {ENGINEERS.map((eng) => (
                  <div key={eng.name} className="flex items-center gap-3 py-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-700 text-[11px] font-bold text-slate-200">
                      {eng.initials}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-slate-200">{eng.name}</p>
                      <p className="text-[10px] text-slate-500">{eng.role}</p>
                    </div>
                    <span className={`text-sm font-bold ${eng.match >= 90 ? "text-emerald-400" : eng.match >= 85 ? "text-yellow-400" : "text-orange-400"}`}>
                      {eng.match}%
                    </span>
                    <Badge className={`h-auto rounded px-2 py-0.5 text-[10px] font-semibold shadow-none ${eng.statusClass}`}>
                      {eng.status}
                    </Badge>
                    <Badge className={`h-auto rounded px-2 py-0.5 text-[10px] font-semibold shadow-none ${eng.shiftClass}`}>
                      {eng.shift}
                    </Badge>
                  </div>
                ))}
              </div>
              <button type="button" className="mt-3 text-xs text-blue-400 hover:text-blue-300 transition-colors">
                View All Engineers →
              </button>
            </CardContent>
          </Card>
        </div>

        {/* ── Row 3: Equipment Knowledge Coverage | Training Recommendations */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">

          {/* Equipment Knowledge Coverage */}
          <Card className="rounded-xl border border-gray-800 bg-[#141820] shadow-none">
            <CardContent className="p-4">
              <h3 className="mb-4 text-sm font-semibold text-slate-200">Equipment Knowledge Coverage</h3>
              <div className="flex flex-col gap-3">
                {COVERAGE_BARS.map((bar) => (
                  <div key={bar.label} className="flex items-center gap-3">
                    <span className="w-24 shrink-0 text-[11px] text-slate-400">{bar.label}</span>
                    <div className="flex-1 h-2 overflow-hidden rounded-full bg-gray-800">
                      <div className="h-full rounded-full transition-all"
                        style={{ width: bar.width, backgroundColor: bar.color }} />
                    </div>
                    <span className="w-4 shrink-0 text-right text-sm font-bold" style={{ color: bar.color }}>
                      {bar.count}
                    </span>
                  </div>
                ))}
              </div>
              <div className="mt-5 border-t border-gray-800 pt-4">
                <p className="text-[11px] text-slate-500">Average Skill Match</p>
                <div className="mt-1 flex items-center gap-2">
                  <span className="text-2xl font-bold text-slate-50">86%</span>
                  <span className="inline-flex items-center gap-1 rounded bg-emerald-500/15 px-2 py-0.5 text-[11px] font-semibold text-emerald-400">
                    <TrendingUp className="h-3 w-3" /> Trending Up
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Training Recommendations */}
          <Card className="rounded-xl border border-gray-800 bg-[#141820] shadow-none">
            <CardContent className="p-4">
              <h3 className="mb-3 text-sm font-semibold text-slate-200">Training Recommendations</h3>
              <div className="flex flex-col gap-0 divide-y divide-gray-800">
                {TRAINING_RECS.map((rec) => (
                  <div key={rec.label} className="flex items-center gap-3 py-3">
                    <Badge className={`h-auto shrink-0 rounded px-2 py-0.5 text-[10px] font-bold uppercase shadow-none ${rec.priClass}`}>
                      {rec.priority}
                    </Badge>
                    <div className="flex flex-col gap-0.5">
                      <span className="text-xs font-semibold text-slate-200">{rec.label}</span>
                      <span className="text-[11px] text-slate-500">{rec.sub}</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ── Row 4: Quick Actions | Upcoming Competency Expiry ────────── */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">

          {/* Quick Actions */}
          <Card className="rounded-xl border border-gray-800 bg-[#141820] shadow-none">
            <CardContent className="p-4">
              <h3 className="mb-3 text-sm font-semibold text-slate-200">Quick Actions</h3>
              <div className="flex flex-col gap-2">
                {QUICK_ACTIONS.map(({ Icon, label }) => (
                  <button key={label} type="button"
                    className="flex w-full items-center gap-3 rounded-lg border border-gray-800 bg-transparent px-3 py-2.5 text-left transition-colors hover:bg-[#1a2030]">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-gray-800">
                      <Icon className="h-3.5 w-3.5 text-slate-400" />
                    </div>
                    <span className="flex-1 text-xs font-medium text-slate-300">{label}</span>
                    <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-600" />
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Upcoming Competency Expiry */}
          <Card className="rounded-xl border border-gray-800 bg-[#141820] shadow-none">
            <CardContent className="p-4">
              <h3 className="mb-3 text-sm font-semibold text-slate-200">Upcoming Competency Expiry</h3>
              <div className="flex flex-col gap-0 divide-y divide-gray-800">
                {EXPIRIES.map((exp) => (
                  <div key={exp.name + exp.cert} className="flex items-center gap-3 py-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-700 text-[11px] font-bold text-slate-200">
                      {exp.initials}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-slate-200">{exp.name}</p>
                      <p className="text-[10px] text-slate-500">{exp.cert}</p>
                    </div>
                    <Badge className={`h-auto shrink-0 rounded px-2 py-0.5 text-[10px] font-semibold shadow-none ${exp.urgentClass}`}>
                      Expires in {exp.days} days
                    </Badge>
                  </div>
                ))}
              </div>
              <button type="button" className="mt-3 text-xs text-blue-400 hover:text-blue-300 transition-colors">
                View all expiries →
              </button>
            </CardContent>
          </Card>
        </div>

        {/* ── Footer ────────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between border-t border-gray-800 py-3 text-xs text-slate-500">
          <span>All data is synced from Vorta Network and SAP PM. Last updated: 24 Apr 2025, 14:45</span>
          <button type="button" aria-label="Refresh" className="text-slate-600 hover:text-slate-400 transition-colors">
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </section>
  );
};
