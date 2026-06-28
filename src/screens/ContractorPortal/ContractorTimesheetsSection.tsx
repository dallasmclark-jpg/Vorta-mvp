import { useState } from "react";
import {
  AlertTriangle,
  Brain,
  CheckCircle2,
  Clock,
  FileText,
  Filter,
  MapPin,
  Receipt,
  Search,
  TrendingUp,
  Users,
  Zap,
} from "lucide-react";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Card, CardContent } from "../../components/ui/card";
import { AiActionsPanel, AiAction } from "../../components/AiActionsPanel";
import { SyncIndicator } from "../../components/SyncIndicator";

// ─── Types ────────────────────────────────────────────────────────────────────

type TimesheetStatus = "Submitted" | "Approved" | "Pending" | "Missing" | "Rejected";
type ApprovalStatus  = "Approved" | "Awaiting" | "Not Required" | "Rejected";
type InvoiceReady    = "Ready" | "Blocked" | "Not Applicable" | "Invoiced";

interface Timesheet {
  id: number;
  week: string;
  assignment: string;
  customer: string;
  location: string;
  engineer: string;
  engineerInitials: string;
  standardHours: number;
  overtimeHours: number;
  calloutHours: number;
  travelHours: number;
  status: TimesheetStatus;
  approvalStatus: ApprovalStatus;
  reportStatus: "Submitted" | "Overdue" | "Not Required" | "Draft";
  invoiceReady: InvoiceReady;
}

interface EngineerSummary {
  name: string;
  initials: string;
  assignedHours: number;
  submittedHours: number;
  approvedHours: number;
  overtimeHours: number;
  utilisation: number;
  missing: number;
}

interface TimesheetRisk {
  severity: "critical" | "high" | "medium";
  timesheet: string;
  description: string;
}

// ─── Mock data ────────────────────────────────────────────────────────────────

const timesheets: Timesheet[] = [
  {
    id: 1,
    week: "W/E 27 Jun",
    assignment: "Siemens S7 PLC Upgrade — Lager Line",
    customer: "Heineken UK",
    location: "Manchester",
    engineer: "Tom Briggs",
    engineerInitials: "TB",
    standardHours: 40,
    overtimeHours: 6,
    calloutHours: 0,
    travelHours: 4,
    status: "Submitted",
    approvalStatus: "Awaiting",
    reportStatus: "Submitted",
    invoiceReady: "Blocked",
  },
  {
    id: 2,
    week: "W/E 27 Jun",
    assignment: "ABB Robot Cell Calibration",
    customer: "Unilever — Port Sunlight",
    location: "Wirral",
    engineer: "Raj Kumar",
    engineerInitials: "RK",
    standardHours: 16,
    overtimeHours: 0,
    calloutHours: 0,
    travelHours: 3,
    status: "Missing",
    approvalStatus: "Not Required",
    reportStatus: "Overdue",
    invoiceReady: "Blocked",
  },
  {
    id: 3,
    week: "W/E 20 Jun",
    assignment: "Krones Filling Line 3 — PM",
    customer: "Britvic PLC",
    location: "Hemel Hempstead",
    engineer: "James Patel",
    engineerInitials: "JP",
    standardHours: 40,
    overtimeHours: 0,
    calloutHours: 0,
    travelHours: 5,
    status: "Approved",
    approvalStatus: "Approved",
    reportStatus: "Submitted",
    invoiceReady: "Ready",
  },
  {
    id: 4,
    week: "W/E 27 Jun",
    assignment: "F-Gas Survey — Cold Store Inspection",
    customer: "Diageo — Leven Distillery",
    location: "Fife, Scotland",
    engineer: "Dan Hurst",
    engineerInitials: "DH",
    standardHours: 8,
    overtimeHours: 0,
    calloutHours: 0,
    travelHours: 6,
    status: "Submitted",
    approvalStatus: "Awaiting",
    reportStatus: "Submitted",
    invoiceReady: "Blocked",
  },
  {
    id: 5,
    week: "W/E 20 Jun",
    assignment: "Siemens S7 PLC Upgrade — Lager Line",
    customer: "Heineken UK",
    location: "Manchester",
    engineer: "Tom Briggs",
    engineerInitials: "TB",
    standardHours: 40,
    overtimeHours: 4,
    calloutHours: 4,
    travelHours: 4,
    status: "Approved",
    approvalStatus: "Approved",
    reportStatus: "Submitted",
    invoiceReady: "Invoiced",
  },
  {
    id: 6,
    week: "W/E 27 Jun",
    assignment: "CIP System Overhaul — Dairy Processing",
    customer: "Müller UK",
    location: "Market Drayton",
    engineer: "Lisa Tong",
    engineerInitials: "LT",
    standardHours: 0,
    overtimeHours: 0,
    calloutHours: 0,
    travelHours: 0,
    status: "Pending",
    approvalStatus: "Not Required",
    reportStatus: "Not Required",
    invoiceReady: "Not Applicable",
  },
];

const engineerSummaries: EngineerSummary[] = [
  { name: "Tom Briggs",  initials: "TB", assignedHours: 80, submittedHours: 80, approvedHours: 44, overtimeHours: 10, utilisation: 100, missing: 0 },
  { name: "James Patel", initials: "JP", assignedHours: 40, submittedHours: 40, approvedHours: 40, overtimeHours: 0,  utilisation: 100, missing: 0 },
  { name: "Raj Kumar",   initials: "RK", assignedHours: 16, submittedHours: 0,  approvedHours: 0,  overtimeHours: 0,  utilisation: 0,   missing: 1 },
  { name: "Dan Hurst",   initials: "DH", assignedHours: 8,  submittedHours: 8,  approvedHours: 0,  overtimeHours: 0,  utilisation: 100, missing: 0 },
  { name: "Amy Clarke",  initials: "AC", assignedHours: 32, submittedHours: 0,  approvedHours: 0,  overtimeHours: 0,  utilisation: 0,   missing: 0 },
];

const timesheetRisks: TimesheetRisk[] = [
  { severity: "critical", timesheet: "Raj Kumar — ABB Robot Cell",   description: "Timesheet missing for W/E 27 Jun. Job report also overdue. Invoice is blocked until both are submitted." },
  { severity: "high",     timesheet: "Tom Briggs — Heineken W/E 27", description: "6 hours overtime submitted. Customer approval outstanding. Cannot invoice until Heineken signs off." },
  { severity: "medium",   timesheet: "Dan Hurst — Diageo Survey",    description: "Timesheet submitted but customer approval still pending from Diageo. Invoice will remain blocked." },
];

const aiActions: AiAction[] = [
  { label: "Chase Raj Kumar for missing timesheet",      description: "Timesheet for W/E 27 Jun is missing. Send reminder and link to submission portal — invoice blocked.",                   priority: "critical", icon: AlertTriangle },
  { label: "Flag Tom Briggs overtime for approval",      description: "6 overtime hours submitted on the Heineken job. These require customer sign-off before the week can be invoiced.",      priority: "high",    icon: Zap           },
  { label: "James Patel ready — raise Britvic invoice",  description: "James's timesheet is approved, job report signed off. Invoice can be raised for the Krones PM visit today.",           priority: "high",    icon: Receipt       },
  { label: "Hours mismatch on Heineken W/E 20",          description: "Tom's approved timesheet (W/E 20) shows 44h billable but the assignment schedule quoted 40h standard. Confirm scope.", priority: "medium",  icon: Brain         },
];

// ─── Config maps (exhaustive) ─────────────────────────────────────────────────

const statusConfig: Record<TimesheetStatus, { badge: string }> = {
  "Submitted": { badge: "bg-[#3b82f620] text-blue-400"    },
  "Approved":  { badge: "bg-[#10b98120] text-emerald-400" },
  "Pending":   { badge: "bg-[#facc1520] text-yellow-400"  },
  "Missing":   { badge: "bg-[#ef444420] text-red-400"     },
  "Rejected":  { badge: "bg-[#ef444420] text-red-400"     },
};

const approvalCls: Record<ApprovalStatus, string> = {
  "Approved":     "text-emerald-400",
  "Awaiting":     "text-yellow-400",
  "Not Required": "text-slate-500",
  "Rejected":     "text-red-400",
};

const invoiceCls: Record<InvoiceReady, string> = {
  "Ready":          "text-emerald-400",
  "Blocked":        "text-red-400",
  "Not Applicable": "text-slate-500",
  "Invoiced":       "text-blue-400",
};

const reportCls: Record<Timesheet["reportStatus"], string> = {
  "Submitted":    "text-emerald-400",
  "Overdue":      "text-red-400",
  "Not Required": "text-slate-500",
  "Draft":        "text-yellow-400",
};

const riskCls: Record<TimesheetRisk["severity"], { card: string; icon: string; label: string }> = {
  critical: { card: "border-red-500/20 bg-[#ef444408]",    icon: "text-red-400",    label: "Critical" },
  high:     { card: "border-orange-400/20 bg-[#f9731608]", icon: "text-orange-400", label: "High"     },
  medium:   { card: "border-yellow-400/20 bg-[#facc1508]", icon: "text-yellow-400", label: "Medium"   },
};

const utilisationBarCls = (u: number): string => {
  if (u >= 80) return "bg-blue-500";
  if (u >= 40) return "bg-yellow-400";
  return "bg-red-500";
};

const ALL_STATUSES: Array<"All" | TimesheetStatus> = ["All", "Missing", "Pending", "Submitted", "Approved", "Rejected"];

// ─── Detail panel ─────────────────────────────────────────────────────────────

function DetailPanel({ t }: { t: Timesheet }) {
  const sCfg   = statusConfig[t.status];
  const totalBillable = t.standardHours + t.overtimeHours + t.calloutHours + t.travelHours;
  return (
    <Card className="rounded-xl border border-gray-800 bg-[#141820] shadow-none">
      <CardContent className="p-5">
        <div className="mb-4 flex items-start gap-2 border-b border-gray-800 pb-4">
          <Clock className="mt-0.5 h-4 w-4 shrink-0 text-blue-400" />
          <div>
            <p className="text-sm font-semibold text-slate-200">Timesheet Detail</p>
            <p className="text-[11px] text-slate-500">Click any row to preview</p>
          </div>
        </div>

        {/* Summary */}
        <div className="mb-4 flex flex-col gap-2">
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-semibold text-slate-100">{t.assignment}</p>
            <Badge className={`inline-flex h-auto shrink-0 rounded px-2 py-0.5 text-[10px] font-medium shadow-none ${sCfg.badge}`}>{t.status}</Badge>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
            <span>{t.customer}</span>
            <span className="text-slate-700">·</span>
            <span className="flex items-center gap-1"><MapPin className="h-3 w-3 text-slate-600" />{t.location}</span>
          </div>
          <p className="text-xs text-slate-500">{t.week}</p>
        </div>

        {/* Engineer */}
        <div className="mb-4 flex items-center gap-3 rounded-lg border border-gray-800 bg-[#0f1318] p-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-500/20 text-[10px] font-bold text-blue-300">
            {t.engineerInitials}
          </div>
          <div>
            <p className="text-sm font-medium text-slate-100">{t.engineer}</p>
            <p className="text-[11px] text-slate-500">{t.week}</p>
          </div>
        </div>

        {/* Hours breakdown */}
        <div className="mb-4">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Hours Breakdown</p>
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: "Standard",  value: t.standardHours },
              { label: "Overtime",  value: t.overtimeHours },
              { label: "Callout",   value: t.calloutHours  },
              { label: "Travel",    value: t.travelHours   },
            ].map(({ label, value }) => (
              <div key={label} className="rounded-lg border border-gray-800 bg-[#0f1318] p-2.5 text-center">
                <p className="text-[10px] text-slate-500">{label}</p>
                <p className="mt-0.5 text-lg font-semibold tabular-nums text-slate-100">{value}h</p>
              </div>
            ))}
          </div>
          <div className="mt-2 flex items-center justify-between rounded-lg border border-blue-500/20 bg-blue-500/5 px-3 py-2">
            <span className="text-xs font-semibold text-slate-300">Total Billable</span>
            <span className="text-sm font-bold tabular-nums text-blue-300">{totalBillable}h</span>
          </div>
        </div>

        {/* Status items */}
        <div className="mb-4 flex flex-col gap-0">
          <div className="flex items-center justify-between border-b border-gray-800/60 py-1.5">
            <span className="text-xs text-slate-500">Approval</span>
            <span className={`text-xs font-medium ${approvalCls[t.approvalStatus]}`}>{t.approvalStatus}</span>
          </div>
          <div className="flex items-center justify-between border-b border-gray-800/60 py-1.5">
            <span className="text-xs text-slate-500">Job Report</span>
            <span className={`text-xs font-medium ${reportCls[t.reportStatus]}`}>{t.reportStatus}</span>
          </div>
          <div className="flex items-center justify-between py-1.5">
            <span className="text-xs text-slate-500">Invoice</span>
            <span className={`text-xs font-medium ${invoiceCls[t.invoiceReady]}`}>{t.invoiceReady}</span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-2 border-t border-gray-800 pt-4">
          <Button className="w-full bg-blue-600 text-white hover:bg-blue-500">
            <CheckCircle2 className="h-4 w-4" />Approve Timesheet
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

export const ContractorTimesheetsSection = (): JSX.Element => {
  const [search,   setSearch]   = useState("");
  const [status,   setStatus]   = useState<"All" | TimesheetStatus>("All");
  const [selected, setSelected] = useState<Timesheet>(timesheets[0]);

  const filtered = timesheets.filter((t) => {
    const q  = search.toLowerCase();
    const mQ = q === "" || t.assignment.toLowerCase().includes(q) || t.customer.toLowerCase().includes(q) || t.engineer.toLowerCase().includes(q);
    const mS = status === "All" || t.status === status;
    return mQ && mS;
  });

  const kpis = [
    { label: "Submitted This Week",  value: String(timesheets.filter((t) => t.status === "Submitted" || t.status === "Approved").length), valueClass: "text-blue-400",    icon: FileText    },
    { label: "Awaiting Approval",    value: String(timesheets.filter((t) => t.approvalStatus === "Awaiting").length),                     valueClass: "text-yellow-400",  icon: Clock       },
    { label: "Missing Timesheets",   value: String(timesheets.filter((t) => t.status === "Missing").length),                              valueClass: "text-red-400",     icon: AlertTriangle },
    { label: "Ready for Invoice",    value: String(timesheets.filter((t) => t.invoiceReady === "Ready").length),                          valueClass: "text-emerald-400", icon: Receipt     },
  ];

  return (
    <section className="flex min-w-0 w-full flex-col gap-6 px-4 pb-16 pt-0 md:px-6 xl:px-8">

      {/* Header */}
      <header className="flex w-full flex-col justify-between gap-4 py-5 lg:flex-row lg:items-start">
        <div>
          <p className="text-xs font-medium text-slate-500">Contractor Portal</p>
          <h1 className="mt-1 text-xl font-semibold text-slate-50">Timesheets</h1>
          <p className="mt-1 text-sm text-slate-400">Track engineer hours, approvals and invoice readiness across contractor assignments.</p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-3">
          <SyncIndicator source="Vorta" confidence={93} syncedAt={new Date(Date.now() - 60000)} />
          <Button className="bg-blue-600 text-white hover:bg-blue-500">
            <Clock className="h-4 w-4" />Add Timesheet
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
            placeholder="Search timesheets, engineers, customers…"
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
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_340px]">

        {/* Table */}
        <Card className="min-w-0 rounded-xl border border-gray-800 bg-[#141820] shadow-none">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[700px] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-gray-800 bg-[#0f1318]">
                    {["Week / Assignment", "Engineer", "Std h", "OT h", "Total h", "Approval", "Report", "Invoice", "Status", ""].map((h) => (
                      <th key={h} className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-500">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="px-4 py-10 text-center text-sm text-slate-500">
                        No timesheets match the current filters.
                      </td>
                    </tr>
                  ) : (
                    filtered.map((t, idx) => {
                      const isSelected = selected.id === t.id;
                      const sCfg = statusConfig[t.status];
                      const total = t.standardHours + t.overtimeHours + t.calloutHours + t.travelHours;
                      return (
                        <tr
                          key={t.id}
                          onClick={() => setSelected(t)}
                          className={`cursor-pointer border-b border-gray-800/50 transition-colors hover:bg-[#1a2030] ${
                            isSelected ? "bg-[#1a2030] ring-1 ring-inset ring-blue-500/20" :
                            idx % 2 === 0 ? "bg-[#141820]" : "bg-[#111620]"
                          }`}
                        >
                          <td className="px-4 py-2.5">
                            <p className="max-w-[180px] truncate font-medium text-slate-100">{t.assignment}</p>
                            <p className="text-[10px] text-slate-500">{t.customer}</p>
                            <p className="text-[10px] text-slate-600">{t.week}</p>
                          </td>
                          <td className="px-4 py-2.5">
                            <div className="flex items-center gap-1.5">
                              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-blue-500/20 text-[9px] font-bold text-blue-300">
                                {t.engineerInitials}
                              </div>
                              <span className="text-xs text-slate-300">{t.engineer.split(" ")[0]}</span>
                            </div>
                          </td>
                          <td className="px-4 py-2.5 tabular-nums text-xs text-slate-400">{t.standardHours}h</td>
                          <td className="px-4 py-2.5 tabular-nums text-xs">
                            <span className={t.overtimeHours > 0 ? "text-yellow-400" : "text-slate-600"}>
                              {t.overtimeHours}h
                            </span>
                          </td>
                          <td className="px-4 py-2.5 tabular-nums text-xs font-semibold text-slate-200">{total}h</td>
                          <td className="px-4 py-2.5">
                            <span className={`text-xs font-medium ${approvalCls[t.approvalStatus]}`}>{t.approvalStatus}</span>
                          </td>
                          <td className="px-4 py-2.5">
                            <span className={`text-xs font-medium ${reportCls[t.reportStatus]}`}>{t.reportStatus}</span>
                          </td>
                          <td className="px-4 py-2.5">
                            <span className={`text-xs font-medium ${invoiceCls[t.invoiceReady]}`}>{t.invoiceReady}</span>
                          </td>
                          <td className="px-4 py-2.5">
                            <Badge className={`inline-flex h-auto rounded px-2 py-0.5 text-[10px] font-medium shadow-none ${sCfg.badge}`}>
                              {t.status}
                            </Badge>
                          </td>
                          <td className="px-4 py-2.5">
                            <button
                              type="button"
                              onClick={(ev) => { ev.stopPropagation(); setSelected(t); }}
                              className="rounded-lg border border-gray-700 px-2.5 py-1 text-[10px] font-medium text-slate-400 transition-colors hover:border-gray-600 hover:bg-[#ffffff0a] hover:text-slate-200"
                            >
                              View
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
        <DetailPanel t={selected} />
      </div>

      {/* Weekly engineer summary */}
      <Card className="rounded-xl border border-gray-800 bg-[#141820] shadow-none">
        <CardContent className="p-0">
          <div className="flex items-center justify-between border-b border-gray-800 px-5 py-4">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-blue-400" />
              <span className="text-sm font-semibold text-slate-200">Weekly Hours Summary</span>
            </div>
            <span className="text-[11px] text-slate-500">W/E 27 Jun</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[580px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-gray-800 bg-[#0f1318]">
                  {["Engineer", "Assigned h", "Submitted h", "Approved h", "Overtime", "Utilisation", "Missing"].map((h) => (
                    <th key={h} className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {engineerSummaries.map((e, idx) => (
                  <tr key={e.name} className={`border-b border-gray-800/50 ${idx % 2 === 0 ? "bg-[#141820]" : "bg-[#111620]"}`}>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-blue-500/20 text-[10px] font-bold text-blue-300">
                          {e.initials}
                        </div>
                        <span className="font-medium text-slate-100">{e.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 tabular-nums text-xs text-slate-400">{e.assignedHours}h</td>
                    <td className="px-4 py-2.5 tabular-nums text-xs text-slate-300">{e.submittedHours}h</td>
                    <td className="px-4 py-2.5 tabular-nums text-xs">
                      <span className={e.approvedHours === e.submittedHours && e.submittedHours > 0 ? "text-emerald-400" : "text-slate-400"}>
                        {e.approvedHours}h
                      </span>
                    </td>
                    <td className="px-4 py-2.5 tabular-nums text-xs">
                      <span className={e.overtimeHours > 0 ? "text-yellow-400" : "text-slate-600"}>{e.overtimeHours}h</span>
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <div className="relative h-1.5 w-14 overflow-hidden rounded bg-gray-800">
                          <div
                            className={`absolute left-0 top-0 h-full rounded ${utilisationBarCls(e.utilisation)}`}
                            style={{ width: `${e.utilisation}%` }}
                          />
                        </div>
                        <span className="tabular-nums text-xs text-slate-400">{e.utilisation}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5">
                      {e.missing > 0
                        ? <span className="rounded bg-[#ef444420] px-2 py-0.5 text-[10px] font-medium text-red-400">{e.missing} missing</span>
                        : <span className="text-xs text-emerald-400">OK</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Risks */}
      <Card className="rounded-xl border border-gray-800 bg-[#141820] shadow-none">
        <CardContent className="p-5">
          <div className="mb-4 flex items-center justify-between border-b border-gray-800 pb-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-orange-400" />
              <span className="text-sm font-semibold text-slate-200">Exceptions &amp; Risks</span>
            </div>
            <Badge className="inline-flex h-auto rounded bg-[#f9731620] px-2 py-0.5 text-[10px] font-medium text-orange-400 shadow-none">
              {timesheetRisks.length} issues
            </Badge>
          </div>
          <div className="flex flex-col gap-2">
            {timesheetRisks.map((risk, i) => {
              const cfg = riskCls[risk.severity];
              return (
                <div key={i} className={`flex items-start gap-2.5 rounded-lg border p-3 ${cfg.card}`}>
                  <AlertTriangle className={`mt-0.5 h-4 w-4 shrink-0 ${cfg.icon}`} />
                  <div>
                    <p className={`text-xs font-semibold ${cfg.icon}`}>{cfg.label} — {risk.timesheet}</p>
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
