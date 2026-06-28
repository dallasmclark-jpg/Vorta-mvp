import { useState } from "react";
import {
  AlertTriangle,
  Brain,
  CheckCircle2,
  ChevronRight,
  Clock,
  FileText,
  Filter,
  MapPin,
  Receipt,
  RefreshCw,
  Search,
  ShieldCheck,
  Zap,
} from "lucide-react";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Card, CardContent } from "../../components/ui/card";
import { AiActionsPanel, AiAction } from "../../components/AiActionsPanel";
import { SyncIndicator } from "../../components/SyncIndicator";
import { ExplainWithAi } from "../../components/ExplainWithAi";

// ─── Types ────────────────────────────────────────────────────────────────────

type ReportStatus   = "Submitted" | "Under Review" | "Sent to Customer" | "Customer Approved" | "Overdue" | "Draft";
type ApprovalStatus = "Approved" | "Pending" | "Not Sent" | "Rejected";
type InvoiceReady   = "Ready" | "Blocked" | "Not Applicable" | "Invoiced";

interface JobReport {
  id: number;
  title: string;
  assignment: string;
  customer: string;
  location: string;
  engineer: string;
  engineerInitials: string;
  workType: string;
  submittedDate: string;
  status: ReportStatus;
  approvalStatus: ApprovalStatus;
  timesheetOk: boolean;
  invoiceReady: InvoiceReady;
  workCompleted: string;
  faultSummary: string;
  rootCause: string;
  partsUsed: string[];
  followUp: string;
  photosAttached: boolean;
  customerSignOff: boolean;
}

interface ReportRisk {
  severity: "critical" | "high" | "medium";
  report: string;
  description: string;
}

type WorkflowStep = "Assignment Complete" | "Report Drafted" | "Submitted" | "Reviewed" | "Sent to Customer" | "Customer Approved" | "Ready to Invoice";

// ─── Mock data ────────────────────────────────────────────────────────────────

const reports: JobReport[] = [
  {
    id: 1,
    title: "ABB Robot Cell Calibration — Report",
    assignment: "ABB Robot Cell Calibration",
    customer: "Unilever — Port Sunlight",
    location: "Wirral",
    engineer: "Raj Kumar",
    engineerInitials: "RK",
    workType: "Calibration",
    submittedDate: "—",
    status: "Overdue",
    approvalStatus: "Not Sent",
    timesheetOk: false,
    invoiceReady: "Blocked",
    workCompleted: "Robot cell recalibrated across 3 axes. Gripper tolerances verified. Safety interlocks tested and confirmed operational.",
    faultSummary: "Axis 2 encoder drift identified during initial survey. Replaced encoder, re-zeroed and validated.",
    rootCause: "Not completed",
    partsUsed: ["ABB Encoder x1", "Calibration fixture"],
    followUp: "Schedule annual recalibration no later than Jun 2027. Customer to monitor axis 2 drift monthly.",
    photosAttached: false,
    customerSignOff: false,
  },
  {
    id: 2,
    title: "Siemens S7 PLC Upgrade — Report",
    assignment: "Siemens S7 PLC Upgrade — Lager Line",
    customer: "Heineken UK",
    location: "Manchester",
    engineer: "Tom Briggs",
    engineerInitials: "TB",
    workType: "Controls Upgrade",
    submittedDate: "27 Jun",
    status: "Under Review",
    approvalStatus: "Pending",
    timesheetOk: true,
    invoiceReady: "Blocked",
    workCompleted: "S7-300 replaced with S7-1500. HMI migrated to TIA Portal V17. Full I/O test completed.",
    faultSummary: "Legacy analogue card incompatible with new PLC backplane — substituted with updated Siemens card.",
    rootCause: "Outdated hardware specification on original design drawings.",
    partsUsed: ["Siemens S7-1500 CPU", "Analogue I/O card", "24V PSU"],
    followUp: "Customer to arrange full production trial run within 7 days. Update BMS drawings to reflect new hardware.",
    photosAttached: true,
    customerSignOff: false,
  },
  {
    id: 3,
    title: "Krones Filling Line — Quarterly PM Report",
    assignment: "Krones Filling Line 3 — Preventative Maintenance",
    customer: "Britvic PLC",
    location: "Hemel Hempstead",
    engineer: "James Patel",
    engineerInitials: "JP",
    workType: "Preventative Maintenance",
    submittedDate: "18 Jun",
    status: "Customer Approved",
    approvalStatus: "Approved",
    timesheetOk: true,
    invoiceReady: "Ready",
    workCompleted: "Full quarterly PM completed per OEM schedule. All wear items inspected. 2 items replaced.",
    faultSummary: "Conveyor drive bearing showing early wear. Replaced proactively to avoid in-service failure.",
    rootCause: "Normal service life — bearing was at 90% of rated cycle count.",
    partsUsed: ["Bearing SKF 6204-2RS x2", "O-ring kit"],
    followUp: "Next PM due Oct 2026. Note: star wheel insert approaching end of life — order for October visit.",
    photosAttached: true,
    customerSignOff: true,
  },
  {
    id: 4,
    title: "F-Gas Survey — Cold Store Inspection",
    assignment: "HVAC Annual Compliance Inspection",
    customer: "Diageo — Leven Distillery",
    location: "Fife, Scotland",
    engineer: "Dan Hurst",
    engineerInitials: "DH",
    workType: "Compliance Survey",
    submittedDate: "20 Jun",
    status: "Sent to Customer",
    approvalStatus: "Pending",
    timesheetOk: true,
    invoiceReady: "Blocked",
    workCompleted: "Annual F-Gas inspection carried out across 6 units. Leak test performed on all. Certificate issued.",
    faultSummary: "Minor refrigerant undercharge on Unit 3. Topped up to specification.",
    rootCause: "Slow leak at brazed joint — repaired and pressure-tested.",
    partsUsed: ["R410A refrigerant 500g", "Braze rod x3"],
    followUp: "Customer to action Unit 3 repair confirmation in CAFM. Reinspect in 3 months.",
    photosAttached: true,
    customerSignOff: false,
  },
  {
    id: 5,
    title: "ATEX Calibration Survey — Distillery Instruments",
    assignment: "Instrumentation Survey — Distillery Process",
    customer: "William Grant & Sons",
    location: "Girvan, Scotland",
    engineer: "Amy Clarke",
    engineerInitials: "AC",
    workType: "Instrumentation",
    submittedDate: "—",
    status: "Draft",
    approvalStatus: "Not Sent",
    timesheetOk: true,
    invoiceReady: "Not Applicable",
    workCompleted: "Assignment starts 03 Jul — report not yet due.",
    faultSummary: "—",
    rootCause: "—",
    partsUsed: [],
    followUp: "—",
    photosAttached: false,
    customerSignOff: false,
  },
];

const reportRisks: ReportRisk[] = [
  { severity: "critical", report: "ABB Robot Cell Calibration", description: "Report overdue by 2 days. Timesheet also missing. Invoice is blocked — both must be submitted today." },
  { severity: "high",     report: "F-Gas Survey — Diageo",      description: "Report sent to customer 8 days ago. No sign-off received. Invoice is blocked until Diageo approves." },
  { severity: "medium",   report: "Siemens PLC Upgrade",        description: "Report under internal review. Root cause documented but customer sign-off still required before invoicing." },
];

const aiActions: AiAction[] = [
  { label: "Chase Raj Kumar for overdue ABB report",      description: "Report is 2+ days overdue. Send automated nudge to Raj and flag to account manager — invoicing is blocked.",              priority: "critical", icon: FileText    },
  { label: "Escalate Diageo approval — 8 days no reply", description: "F-Gas report was sent 8 days ago. Chase Diageo site contact and copy in contractor account manager.",                      priority: "high",    icon: AlertTriangle },
  { label: "Krones PM report ready — raise invoice",      description: "Britvic have approved the Krones PM report. All docs complete. Invoice can be raised now.",                               priority: "high",    icon: Receipt      },
  { label: "Spot pattern: Heineken recurring PLC faults", description: "3 of the last 4 Heineken jobs have involved legacy analogue hardware. Recommend proactive hardware audit to Heineken.", priority: "medium",  icon: Brain        },
];

// ─── Config maps (exhaustive) ─────────────────────────────────────────────────

const statusConfig: Record<ReportStatus, { badge: string }> = {
  "Submitted":         { badge: "bg-[#3b82f620] text-blue-400"    },
  "Under Review":      { badge: "bg-[#3b82f620] text-blue-300"    },
  "Sent to Customer":  { badge: "bg-[#facc1520] text-yellow-400"  },
  "Customer Approved": { badge: "bg-[#10b98120] text-emerald-400" },
  "Overdue":           { badge: "bg-[#ef444420] text-red-400"     },
  "Draft":             { badge: "bg-[#ffffff0f] text-slate-400"   },
};

const approvalConfig: Record<ApprovalStatus, { cls: string }> = {
  "Approved":      { cls: "text-emerald-400" },
  "Pending":       { cls: "text-yellow-400"  },
  "Not Sent":      { cls: "text-slate-500"   },
  "Rejected":      { cls: "text-red-400"     },
};

const invoiceConfig: Record<InvoiceReady, { cls: string }> = {
  "Ready":          { cls: "text-emerald-400" },
  "Blocked":        { cls: "text-red-400"     },
  "Not Applicable": { cls: "text-slate-500"   },
  "Invoiced":       { cls: "text-blue-400"    },
};

const riskCls: Record<ReportRisk["severity"], { card: string; icon: string; label: string }> = {
  critical: { card: "border-red-500/20 bg-[#ef444408]",    icon: "text-red-400",    label: "Critical" },
  high:     { card: "border-orange-400/20 bg-[#f9731608]", icon: "text-orange-400", label: "High"     },
  medium:   { card: "border-yellow-400/20 bg-[#facc1508]", icon: "text-yellow-400", label: "Medium"   },
};

const WORKFLOW_STEPS: WorkflowStep[] = [
  "Assignment Complete", "Report Drafted", "Submitted", "Reviewed", "Sent to Customer", "Customer Approved", "Ready to Invoice",
];

const STATUS_WORKFLOW_IDX: Record<ReportStatus, number> = {
  "Draft":             1,
  "Submitted":         2,
  "Under Review":      3,
  "Sent to Customer":  4,
  "Customer Approved": 5,
  "Overdue":           1,
};

const ALL_STATUSES: Array<"All" | ReportStatus> = ["All", "Overdue", "Draft", "Submitted", "Under Review", "Sent to Customer", "Customer Approved"];

// ─── Sub-components ───────────────────────────────────────────────────────────

function WorkflowBar({ status }: { status: ReportStatus }) {
  const activeIdx = STATUS_WORKFLOW_IDX[status] ?? 0;
  return (
    <div className="flex flex-wrap items-center gap-0.5">
      {WORKFLOW_STEPS.map((step, i) => {
        const done   = i < activeIdx;
        const active = i === activeIdx;
        return (
          <div key={step} className="flex items-center gap-0.5">
            <div className={`flex h-6 items-center rounded px-2 text-[10px] font-medium ${
              done   ? "bg-[#10b98120] text-emerald-400" :
              active ? "bg-blue-500/20 text-blue-300"    :
                       "bg-[#ffffff08] text-slate-600"
            }`}>
              {done && <CheckCircle2 className="mr-1 h-3 w-3" />}
              {step}
            </div>
            {i < WORKFLOW_STEPS.length - 1 && (
              <ChevronRight className="h-3 w-3 shrink-0 text-slate-700" />
            )}
          </div>
        );
      })}
    </div>
  );
}

function DetailPanel({ r }: { r: JobReport }) {
  const sCfg  = statusConfig[r.status];
  const apCfg = approvalConfig[r.approvalStatus];
  const invCfg = invoiceConfig[r.invoiceReady];
  return (
    <Card className="rounded-xl border border-gray-800 bg-[#141820] shadow-none">
      <CardContent className="p-5">
        <div className="mb-4 flex items-start gap-2 border-b border-gray-800 pb-4">
          <FileText className="mt-0.5 h-4 w-4 shrink-0 text-blue-400" />
          <div>
            <p className="text-sm font-semibold text-slate-200">Report Preview</p>
            <p className="text-[11px] text-slate-500">Click any report row to preview</p>
          </div>
        </div>

        {/* Summary */}
        <div className="mb-4 flex flex-col gap-2">
          <p className="text-sm font-semibold text-slate-100">{r.title}</p>
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
            <span>{r.customer}</span>
            <span className="text-slate-700">·</span>
            <span className="flex items-center gap-1"><MapPin className="h-3 w-3 text-slate-600" />{r.location}</span>
          </div>
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <Badge className={`inline-flex h-auto rounded px-2 py-0.5 text-[10px] font-medium shadow-none ${sCfg.badge}`}>{r.status}</Badge>
          </div>
        </div>

        {/* Engineer */}
        <div className="mb-4 rounded-lg border border-gray-800 bg-[#0f1318] p-3">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Engineer</p>
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-500/20 text-[10px] font-bold text-blue-300">
              {r.engineerInitials}
            </div>
            <div>
              <p className="text-sm font-medium text-slate-100">{r.engineer}</p>
              <p className="text-[11px] text-slate-500">{r.workType}</p>
            </div>
          </div>
        </div>

        {/* Work detail */}
        {r.workCompleted !== "—" && (
          <div className="mb-4 flex flex-col gap-2.5">
            <div>
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Work Completed</p>
              <p className="text-[11px] leading-relaxed text-slate-300">{r.workCompleted}</p>
            </div>
            {r.faultSummary !== "—" && (
              <div>
                <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Fault / Issue</p>
                <p className="text-[11px] leading-relaxed text-slate-300">{r.faultSummary}</p>
              </div>
            )}
            {r.rootCause !== "—" && (
              <div>
                <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Root Cause</p>
                <p className={`text-[11px] leading-relaxed ${r.rootCause === "Not completed" ? "text-red-400" : "text-slate-300"}`}>{r.rootCause}</p>
              </div>
            )}
            {r.partsUsed.length > 0 && (
              <div>
                <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Parts Used</p>
                <div className="flex flex-wrap gap-1">
                  {r.partsUsed.map((p) => (
                    <span key={p} className="rounded bg-[#ffffff08] px-2 py-0.5 text-[10px] text-slate-400">{p}</span>
                  ))}
                </div>
              </div>
            )}
            {r.followUp !== "—" && (
              <div>
                <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Follow-up Actions</p>
                <p className="text-[11px] leading-relaxed text-slate-300">{r.followUp}</p>
              </div>
            )}
          </div>
        )}

        {/* Status items */}
        <div className="mb-4 flex flex-col gap-0">
          <div className="flex items-center justify-between border-b border-gray-800/60 py-1.5">
            <span className="text-xs text-slate-500">Photos / Evidence</span>
            <span className={`text-xs font-medium ${r.photosAttached ? "text-emerald-400" : "text-orange-400"}`}>
              {r.photosAttached ? "Attached" : "Missing"}
            </span>
          </div>
          <div className="flex items-center justify-between border-b border-gray-800/60 py-1.5">
            <span className="text-xs text-slate-500">Customer Sign-off</span>
            <span className={`text-xs font-medium ${r.customerSignOff ? "text-emerald-400" : "text-yellow-400"}`}>
              {r.customerSignOff ? "Signed" : "Awaiting"}
            </span>
          </div>
          <div className="flex items-center justify-between border-b border-gray-800/60 py-1.5">
            <span className="text-xs text-slate-500">Timesheet</span>
            <span className={`text-xs font-medium ${r.timesheetOk ? "text-emerald-400" : "text-red-400"}`}>
              {r.timesheetOk ? "Submitted" : "Missing"}
            </span>
          </div>
          <div className="flex items-center justify-between border-b border-gray-800/60 py-1.5">
            <span className="text-xs text-slate-500">Customer Approval</span>
            <span className={`text-xs font-medium ${apCfg.cls}`}>{r.approvalStatus}</span>
          </div>
          <div className="flex items-center justify-between py-1.5">
            <span className="text-xs text-slate-500">Invoice</span>
            <span className={`text-xs font-medium ${invCfg.cls}`}>{r.invoiceReady}</span>
          </div>
        </div>

        {/* Workflow */}
        <div className="mb-4">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Report Workflow</p>
          <div className="overflow-x-auto pb-1">
            <WorkflowBar status={r.status} />
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-2 border-t border-gray-800 pt-4">
          <Button className="w-full bg-blue-600 text-white hover:bg-blue-500">
            <FileText className="h-4 w-4" />Send to Customer
          </Button>
          <Button variant="outline" className="w-full border-[#ffffff20] bg-[#ffffff0a] text-slate-200 hover:bg-[#ffffff18] hover:text-slate-50">
            <Receipt className="h-4 w-4" />Raise Invoice
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export const ContractorJobReportsSection = (): JSX.Element => {
  const [search,   setSearch]   = useState("");
  const [status,   setStatus]   = useState<"All" | ReportStatus>("All");
  const [selected, setSelected] = useState<JobReport>(reports[0]);

  const filtered = reports.filter((r) => {
    const q  = search.toLowerCase();
    const mQ = q === "" || r.title.toLowerCase().includes(q) || r.customer.toLowerCase().includes(q) || r.engineer.toLowerCase().includes(q);
    const mS = status === "All" || r.status === status;
    return mQ && mS;
  });

  const kpis = [
    { label: "Reports Submitted",   value: String(reports.filter((r) => r.status !== "Draft" && r.status !== "Overdue").length), valueClass: "text-blue-400",    icon: FileText    },
    { label: "Awaiting Review",     value: String(reports.filter((r) => r.status === "Under Review" || r.status === "Sent to Customer").length), valueClass: "text-yellow-400", icon: Clock      },
    { label: "Overdue Reports",     value: String(reports.filter((r) => r.status === "Overdue").length),                         valueClass: "text-red-400",     icon: AlertTriangle },
    { label: "Ready for Invoice",   value: String(reports.filter((r) => r.invoiceReady === "Ready").length),                     valueClass: "text-emerald-400", icon: Receipt     },
  ];

  return (
    <section className="flex min-w-0 w-full flex-col gap-6 px-4 pb-16 pt-0 md:px-6 xl:px-8">

      {/* Header */}
      <header className="flex w-full flex-col justify-between gap-4 py-5 lg:flex-row lg:items-start">
        <div>
          <p className="text-xs font-medium text-slate-500">Contractor Portal</p>
          <h1 className="mt-1 text-xl font-semibold text-slate-50">Job Reports</h1>
          <p className="mt-1 text-sm text-slate-400">Review completed work, outstanding reports and site delivery evidence.</p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-3">
          <SyncIndicator source="Vorta" confidence={88} syncedAt={new Date(Date.now() - 120000)} />
          <ExplainWithAi pageId="contractor-job-reports" />
          <Button className="bg-blue-600 text-white hover:bg-blue-500">
            <FileText className="h-4 w-4" />Create Report
          </Button>
        </div>
      </header>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {kpis.map(({ label, value, valueClass, icon: Icon }) => (
          <Card key={label} className="rounded-xl border border-gray-800 bg-[#141820] shadow-none">
            <CardContent className="flex flex-col gap-3 p-5">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-medium text-slate-400">{label}</p>
                <Icon className="h-4 w-4 shrink-0 text-slate-600" />
              </div>
              <p className={`text-2xl font-semibold tabular-nums ${valueClass}`}>{value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            placeholder="Search reports, engineers, customers…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 w-full rounded-lg border border-gray-800 bg-[#0b0e14] pl-9 pr-3 text-sm text-slate-200 placeholder:text-slate-600 focus:border-blue-500/50 focus:outline-none focus:ring-1 focus:ring-blue-500/30"
          />
        </div>
        <div className="flex items-center gap-1 rounded-lg border border-gray-800 bg-[#0b0e14] p-1">
          <Filter className="ml-1.5 h-3.5 w-3.5 text-slate-500" />
          {ALL_STATUSES.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStatus(s)}
              className={`rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${status === s ? "bg-[#1a2030] text-slate-200 shadow-sm" : "text-slate-500 hover:text-slate-300"}`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Main: table + detail panel */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_360px]">

        {/* Table */}
        <Card className="min-w-0 rounded-xl border border-gray-800 bg-[#141820] shadow-none">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[680px] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-gray-800 bg-[#0f1318]">
                    {["Report", "Engineer", "Work Type", "Submitted", "Approval", "Invoice", "Status", ""].map((h) => (
                      <th key={h} className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-500">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-10 text-center text-sm text-slate-500">
                        No reports match the current filters.
                      </td>
                    </tr>
                  ) : (
                    filtered.map((r, idx) => {
                      const isSelected = selected.id === r.id;
                      const sCfg  = statusConfig[r.status];
                      const apCfg = approvalConfig[r.approvalStatus];
                      const invCfg = invoiceConfig[r.invoiceReady];
                      return (
                        <tr
                          key={r.id}
                          onClick={() => setSelected(r)}
                          className={`cursor-pointer border-b border-gray-800/50 transition-colors hover:bg-[#1a2030] ${
                            isSelected ? "bg-[#1a2030] ring-1 ring-inset ring-blue-500/20" :
                            idx % 2 === 0 ? "bg-[#141820]" : "bg-[#111620]"
                          }`}
                        >
                          <td className="px-4 py-2.5">
                            <p className="max-w-[200px] truncate font-medium text-slate-100">{r.title}</p>
                            <p className="text-[10px] text-slate-500">{r.customer}</p>
                            <div className="mt-0.5 flex items-center gap-1 text-[10px] text-slate-600">
                              <MapPin className="h-2.5 w-2.5" />{r.location}
                            </div>
                          </td>
                          <td className="px-4 py-2.5">
                            <div className="flex items-center gap-1.5">
                              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-blue-500/20 text-[9px] font-bold text-blue-300">
                                {r.engineerInitials}
                              </div>
                              <span className="text-xs text-slate-300">{r.engineer.split(" ")[0]}</span>
                            </div>
                          </td>
                          <td className="px-4 py-2.5 text-xs text-slate-400">{r.workType}</td>
                          <td className="px-4 py-2.5 tabular-nums text-xs text-slate-400">{r.submittedDate}</td>
                          <td className="px-4 py-2.5">
                            <span className={`text-xs font-medium ${apCfg.cls}`}>{r.approvalStatus}</span>
                          </td>
                          <td className="px-4 py-2.5">
                            <span className={`text-xs font-medium ${invCfg.cls}`}>{r.invoiceReady}</span>
                          </td>
                          <td className="px-4 py-2.5">
                            <Badge className={`inline-flex h-auto rounded px-2 py-0.5 text-[10px] font-medium shadow-none ${sCfg.badge}`}>
                              {r.status}
                            </Badge>
                          </td>
                          <td className="px-4 py-2.5">
                            <button
                              type="button"
                              onClick={(ev) => { ev.stopPropagation(); setSelected(r); }}
                              className="rounded-lg border border-gray-700 px-2.5 py-1 text-[10px] font-medium text-slate-400 transition-colors hover:border-gray-600 hover:bg-[#ffffff0a] hover:text-slate-200"
                            >
                              Preview
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Detail panel */}
        <DetailPanel r={selected} />
      </div>

      {/* Risks */}
      <Card className="rounded-xl border border-gray-800 bg-[#141820] shadow-none">
        <CardContent className="p-5">
          <div className="mb-4 flex items-center justify-between border-b border-gray-800 pb-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-orange-400" />
              <span className="text-sm font-semibold text-slate-200">Exceptions &amp; Risks</span>
            </div>
            <Badge className="inline-flex h-auto rounded bg-[#f9731620] px-2 py-0.5 text-[10px] font-medium text-orange-400 shadow-none">
              {reportRisks.length} issues
            </Badge>
          </div>
          <div className="flex flex-col gap-2">
            {reportRisks.map((risk, i) => {
              const cfg = riskCls[risk.severity];
              return (
                <div key={i} className={`flex items-start gap-2.5 rounded-lg border p-3 ${cfg.card}`}>
                  <AlertTriangle className={`mt-0.5 h-4 w-4 shrink-0 ${cfg.icon}`} />
                  <div>
                    <p className={`text-xs font-semibold ${cfg.icon}`}>{cfg.label} — {risk.report}</p>
                    <p className="mt-0.5 text-[11px] leading-relaxed text-slate-400">{risk.description}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* AI recommendations */}
      <AiActionsPanel actions={aiActions} />

    </section>
  );
};
