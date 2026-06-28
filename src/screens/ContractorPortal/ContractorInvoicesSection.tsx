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
  XCircle,
} from "lucide-react";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Card, CardContent } from "../../components/ui/card";
import { AiActionsPanel, AiAction } from "../../components/AiActionsPanel";
import { SyncIndicator } from "../../components/SyncIndicator";
import { ExplainWithAi } from "../../components/ExplainWithAi";

// ─── Types ────────────────────────────────────────────────────────────────────

type InvoiceStatus = "Draft" | "Submitted" | "Awaiting Payment" | "Paid" | "Overdue" | "Blocked";
type PaymentStatus = "Paid" | "Awaiting" | "Overdue" | "Not Sent" | "Disputed";

interface Invoice {
  id: number;
  number: string;
  customer: string;
  location: string;
  assignment: string;
  engineer: string;
  engineerInitials: string;
  invoiceDate: string;
  dueDate: string;
  standardHours: number;
  overtimeHours: number;
  calloutHours: number;
  travelChargeGBP: number;
  rateGBP: number;
  overtimeRateGBP: number;
  status: InvoiceStatus;
  paymentStatus: PaymentStatus;
  timesheetApproved: boolean;
  reportApproved: boolean;
  poNumber: string;
  blockers: string[];
}

interface InvoiceRisk {
  severity: "critical" | "high" | "medium";
  invoice: string;
  description: string;
}

// ─── Mock data ────────────────────────────────────────────────────────────────

const invoices: Invoice[] = [
  {
    id: 1,
    number: "INV-2026-041",
    customer: "Britvic PLC",
    location: "Hemel Hempstead",
    assignment: "Krones Filling Line 3 — PM",
    engineer: "James Patel",
    engineerInitials: "JP",
    invoiceDate: "23 Jun",
    dueDate: "23 Jul",
    standardHours: 40,
    overtimeHours: 0,
    calloutHours: 0,
    travelChargeGBP: 180,
    rateGBP: 65,
    overtimeRateGBP: 97.50,
    status: "Awaiting Payment",
    paymentStatus: "Awaiting",
    timesheetApproved: true,
    reportApproved: true,
    poNumber: "PO-BRV-8821",
    blockers: [],
  },
  {
    id: 2,
    number: "INV-2026-040",
    customer: "Heineken UK",
    location: "Manchester",
    assignment: "Siemens S7 PLC Upgrade — Lager Line",
    engineer: "Tom Briggs",
    engineerInitials: "TB",
    invoiceDate: "21 Jun",
    dueDate: "21 Jul",
    standardHours: 40,
    overtimeHours: 4,
    calloutHours: 4,
    travelChargeGBP: 140,
    rateGBP: 72,
    overtimeRateGBP: 108,
    status: "Paid",
    paymentStatus: "Paid",
    timesheetApproved: true,
    reportApproved: true,
    poNumber: "PO-HNK-5502",
    blockers: [],
  },
  {
    id: 3,
    number: "INV-2026-042",
    customer: "Heineken UK",
    location: "Manchester",
    assignment: "Siemens S7 PLC Upgrade W/E 27 Jun",
    engineer: "Tom Briggs",
    engineerInitials: "TB",
    invoiceDate: "—",
    dueDate: "—",
    standardHours: 40,
    overtimeHours: 6,
    calloutHours: 0,
    travelChargeGBP: 140,
    rateGBP: 72,
    overtimeRateGBP: 108,
    status: "Blocked",
    paymentStatus: "Not Sent",
    timesheetApproved: false,
    reportApproved: false,
    poNumber: "PO-HNK-5502",
    blockers: ["Timesheet awaiting Heineken approval", "Job report not yet customer-approved"],
  },
  {
    id: 4,
    number: "INV-2026-039",
    customer: "Diageo — Leven Distillery",
    location: "Fife, Scotland",
    assignment: "F-Gas Survey — Cold Store Inspection",
    engineer: "Dan Hurst",
    engineerInitials: "DH",
    invoiceDate: "—",
    dueDate: "—",
    standardHours: 8,
    overtimeHours: 0,
    calloutHours: 0,
    travelChargeGBP: 320,
    rateGBP: 68,
    overtimeRateGBP: 102,
    status: "Blocked",
    paymentStatus: "Not Sent",
    timesheetApproved: false,
    reportApproved: false,
    poNumber: "—",
    blockers: ["Customer sign-off pending", "PO number not received from Diageo"],
  },
  {
    id: 5,
    number: "INV-2026-043",
    customer: "Unilever — Port Sunlight",
    location: "Wirral",
    assignment: "ABB Robot Cell Calibration",
    engineer: "Raj Kumar",
    engineerInitials: "RK",
    invoiceDate: "—",
    dueDate: "—",
    standardHours: 16,
    overtimeHours: 0,
    calloutHours: 0,
    travelChargeGBP: 90,
    rateGBP: 70,
    overtimeRateGBP: 105,
    status: "Blocked",
    paymentStatus: "Not Sent",
    timesheetApproved: false,
    reportApproved: false,
    poNumber: "—",
    blockers: ["Timesheet not submitted by engineer", "Job report overdue — 2+ days"],
  },
  {
    id: 6,
    number: "INV-2026-038",
    customer: "Britvic PLC",
    location: "Hemel Hempstead",
    assignment: "Emergency Callout — Conveyor Fault",
    engineer: "James Patel",
    engineerInitials: "JP",
    invoiceDate: "14 May",
    dueDate: "14 Jun",
    standardHours: 0,
    overtimeHours: 0,
    calloutHours: 8,
    travelChargeGBP: 180,
    rateGBP: 65,
    overtimeRateGBP: 97.50,
    status: "Overdue",
    paymentStatus: "Overdue",
    timesheetApproved: true,
    reportApproved: true,
    poNumber: "PO-BRV-8799",
    blockers: ["Payment overdue by 14 days — chase required"],
  },
];

const invoiceRisks: InvoiceRisk[] = [
  { severity: "critical", invoice: "INV-2026-038 — Britvic Emergency Callout", description: "Payment is 14 days overdue. Invoice was approved and submitted. Escalate to Britvic finance contact immediately." },
  { severity: "high",     invoice: "INV-2026-043 — Unilever ABB Calibration",  description: "Blocked by missing timesheet and overdue job report. Both must be submitted before invoice can be raised." },
  { severity: "high",     invoice: "INV-2026-039 — Diageo F-Gas Survey",       description: "Customer sign-off pending 8 days. No PO received from Diageo. Cannot invoice without PO and approval." },
  { severity: "medium",   invoice: "INV-2026-042 — Heineken W/E 27 Jun",       description: "Timesheet submitted but not yet approved by Heineken. Overtime uplift also requires customer confirmation." },
];

const aiActions: AiAction[] = [
  { label: "Chase Britvic overdue payment — INV-2026-038",  description: "Payment is 14 days overdue. Send formal payment reminder to Britvic finance. Cc account manager.",                      priority: "critical", icon: AlertTriangle },
  { label: "Chase Diageo for PO and sign-off",              description: "No PO and no report sign-off from Diageo after 8 days. Escalate to site contact and account manager today.",              priority: "high",    icon: Receipt       },
  { label: "Raise Britvic Krones PM invoice now",           description: "INV-2026-041 is ready — timesheet approved, report signed. Invoice is outstanding. Raise and send to Britvic now.",       priority: "high",    icon: FileText      },
  { label: "Forecast June revenue vs pipeline",             description: "2 invoices totalling ~£3,200 are ready or awaiting payment. £4,850 is blocked. June close rate likely ~40% of pipeline.", priority: "medium",  icon: Brain         },
];

// ─── Config maps (exhaustive) ─────────────────────────────────────────────────

const statusConfig: Record<InvoiceStatus, { badge: string }> = {
  "Draft":            { badge: "bg-[#ffffff0f] text-slate-400"   },
  "Submitted":        { badge: "bg-[#3b82f620] text-blue-400"    },
  "Awaiting Payment": { badge: "bg-[#facc1520] text-yellow-400"  },
  "Paid":             { badge: "bg-[#10b98120] text-emerald-400" },
  "Overdue":          { badge: "bg-[#ef444420] text-red-400"     },
  "Blocked":          { badge: "bg-[#f9731620] text-orange-400"  },
};

const paymentCls: Record<PaymentStatus, string> = {
  "Paid":     "text-emerald-400",
  "Awaiting": "text-yellow-400",
  "Overdue":  "text-red-400",
  "Not Sent": "text-slate-500",
  "Disputed": "text-orange-400",
};

const riskCls: Record<InvoiceRisk["severity"], { card: string; icon: string; label: string }> = {
  critical: { card: "border-red-500/20 bg-[#ef444408]",    icon: "text-red-400",    label: "Critical" },
  high:     { card: "border-orange-400/20 bg-[#f9731608]", icon: "text-orange-400", label: "High"     },
  medium:   { card: "border-yellow-400/20 bg-[#facc1508]", icon: "text-yellow-400", label: "Medium"   },
};

const ALL_STATUSES: Array<"All" | InvoiceStatus> = ["All", "Blocked", "Draft", "Submitted", "Awaiting Payment", "Overdue", "Paid"];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function calcTotal(inv: Invoice): number {
  return (
    inv.standardHours * inv.rateGBP +
    inv.overtimeHours * inv.overtimeRateGBP +
    inv.calloutHours  * inv.overtimeRateGBP +
    inv.travelChargeGBP
  );
}

function fmtGBP(n: number): string {
  return `£${n.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// ─── Readiness checklist ──────────────────────────────────────────────────────

function ReadinessChecklist({ inv }: { inv: Invoice }) {
  const items = [
    { label: "Assignment complete",      done: inv.status !== "Draft" && inv.status !== "Blocked" || inv.timesheetApproved },
    { label: "Job report submitted",     done: inv.reportApproved },
    { label: "Customer sign-off",        done: inv.reportApproved },
    { label: "Timesheet approved",       done: inv.timesheetApproved },
    { label: "Rates confirmed",          done: inv.rateGBP > 0 },
    { label: "PO number received",       done: inv.poNumber !== "—" },
  ];
  return (
    <div className="flex flex-col gap-1.5">
      {items.map(({ label, done }) => (
        <div key={label} className="flex items-center gap-2.5">
          {done
            ? <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
            : <XCircle      className="h-3.5 w-3.5 shrink-0 text-slate-600"   />}
          <span className={`text-xs ${done ? "text-slate-300" : "text-slate-500"}`}>{label}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Detail panel ─────────────────────────────────────────────────────────────

function DetailPanel({ inv }: { inv: Invoice }) {
  const sCfg  = statusConfig[inv.status];
  const total = calcTotal(inv);
  const allReady = inv.timesheetApproved && inv.reportApproved && inv.poNumber !== "—";
  return (
    <Card className="rounded-xl border border-gray-800 bg-[#141820] shadow-none">
      <CardContent className="p-5">
        <div className="mb-4 flex items-start gap-2 border-b border-gray-800 pb-4">
          <Receipt className="mt-0.5 h-4 w-4 shrink-0 text-blue-400" />
          <div>
            <p className="text-sm font-semibold text-slate-200">Invoice Detail</p>
            <p className="text-[11px] text-slate-500">Click any row to preview</p>
          </div>
        </div>

        {/* Header */}
        <div className="mb-4 flex flex-col gap-2">
          <div className="flex items-start justify-between gap-2">
            <p className="font-mono text-sm font-semibold text-slate-100">{inv.number}</p>
            <Badge className={`inline-flex h-auto shrink-0 rounded px-2 py-0.5 text-[10px] font-medium shadow-none ${sCfg.badge}`}>{inv.status}</Badge>
          </div>
          <p className="text-sm text-slate-300">{inv.assignment}</p>
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
            <span>{inv.customer}</span>
            <span className="text-slate-700">·</span>
            <span className="flex items-center gap-1"><MapPin className="h-3 w-3 text-slate-600" />{inv.location}</span>
          </div>
        </div>

        {/* Engineer */}
        <div className="mb-4 flex items-center gap-3 rounded-lg border border-gray-800 bg-[#0f1318] p-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-500/20 text-[10px] font-bold text-blue-300">
            {inv.engineerInitials}
          </div>
          <div>
            <p className="text-sm font-medium text-slate-100">{inv.engineer}</p>
            <p className="text-[11px] text-slate-500">PO: {inv.poNumber}</p>
          </div>
        </div>

        {/* Charges */}
        <div className="mb-4">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Charge Breakdown</p>
          <div className="flex flex-col gap-0">
            {[
              { label: `Standard (${inv.standardHours}h × ${fmtGBP(inv.rateGBP)})`, value: inv.standardHours * inv.rateGBP,               show: inv.standardHours > 0 },
              { label: `Overtime (${inv.overtimeHours}h × ${fmtGBP(inv.overtimeRateGBP)})`, value: inv.overtimeHours * inv.overtimeRateGBP, show: inv.overtimeHours > 0 },
              { label: `Callout (${inv.calloutHours}h × ${fmtGBP(inv.overtimeRateGBP)})`,   value: inv.calloutHours  * inv.overtimeRateGBP, show: inv.calloutHours > 0  },
              { label: "Travel",                                                             value: inv.travelChargeGBP,                    show: inv.travelChargeGBP > 0 },
            ].filter((r) => r.show).map(({ label, value }) => (
              <div key={label} className="flex items-center justify-between border-b border-gray-800/50 py-1.5">
                <span className="text-[11px] text-slate-400">{label}</span>
                <span className="tabular-nums text-[11px] text-slate-300">{fmtGBP(value)}</span>
              </div>
            ))}
          </div>
          <div className="mt-2 flex items-center justify-between rounded-lg border border-blue-500/20 bg-blue-500/5 px-3 py-2">
            <span className="text-xs font-semibold text-slate-300">Total</span>
            <span className="text-sm font-bold tabular-nums text-blue-300">{fmtGBP(total)}</span>
          </div>
        </div>

        {/* Status items */}
        <div className="mb-4 flex flex-col gap-0">
          <div className="flex items-center justify-between border-b border-gray-800/60 py-1.5">
            <span className="text-xs text-slate-500">Timesheet</span>
            <span className={`text-xs font-medium ${inv.timesheetApproved ? "text-emerald-400" : "text-red-400"}`}>
              {inv.timesheetApproved ? "Approved" : "Blocked"}
            </span>
          </div>
          <div className="flex items-center justify-between border-b border-gray-800/60 py-1.5">
            <span className="text-xs text-slate-500">Job Report</span>
            <span className={`text-xs font-medium ${inv.reportApproved ? "text-emerald-400" : "text-red-400"}`}>
              {inv.reportApproved ? "Approved" : "Blocked"}
            </span>
          </div>
          <div className="flex items-center justify-between border-b border-gray-800/60 py-1.5">
            <span className="text-xs text-slate-500">Payment</span>
            <span className={`text-xs font-medium ${paymentCls[inv.paymentStatus]}`}>{inv.paymentStatus}</span>
          </div>
          <div className="flex items-center justify-between py-1.5">
            <span className="text-xs text-slate-500">Dates</span>
            <span className="text-xs text-slate-400">{inv.invoiceDate} → {inv.dueDate}</span>
          </div>
        </div>

        {/* Readiness */}
        <div className="mb-4">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Invoice Readiness</p>
          <ReadinessChecklist inv={inv} />
        </div>

        {/* Blockers */}
        {inv.blockers.length > 0 && (
          <div className="mb-4 flex flex-col gap-1.5 rounded-lg border border-orange-400/20 bg-[#f9731608] p-3">
            {inv.blockers.map((b) => (
              <div key={b} className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-orange-400" />
                <p className="text-[11px] leading-relaxed text-orange-300">{b}</p>
              </div>
            ))}
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-col gap-2 border-t border-gray-800 pt-4">
          <Button
            className={`w-full text-white ${allReady ? "bg-blue-600 hover:bg-blue-500" : "cursor-not-allowed bg-gray-700 opacity-60"}`}
            disabled={!allReady}
          >
            <Receipt className="h-4 w-4" />Submit Invoice
          </Button>
          <Button variant="outline" className="w-full border-[#ffffff20] bg-[#ffffff0a] text-slate-200 hover:bg-[#ffffff18] hover:text-slate-50">
            <FileText className="h-4 w-4" />View Details
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export const ContractorInvoicesSection = (): JSX.Element => {
  const [search,   setSearch]   = useState("");
  const [status,   setStatus]   = useState<"All" | InvoiceStatus>("All");
  const [selected, setSelected] = useState<Invoice>(invoices[0]);

  const filtered = invoices.filter((inv) => {
    const q  = search.toLowerCase();
    const mQ = q === "" || inv.number.toLowerCase().includes(q) || inv.customer.toLowerCase().includes(q) || inv.assignment.toLowerCase().includes(q) || inv.engineer.toLowerCase().includes(q);
    const mS = status === "All" || inv.status === status;
    return mQ && mS;
  });

  const totalPipeline = invoices.filter((i) => i.status !== "Paid").reduce((s, i) => s + calcTotal(i), 0);
  const totalPaid     = invoices.filter((i) => i.status === "Paid").reduce((s, i) => s + calcTotal(i), 0);

  const kpis = [
    { label: "Ready to Invoice",   value: String(invoices.filter((i) => i.timesheetApproved && i.reportApproved && i.status !== "Paid" && i.status !== "Awaiting Payment").length), valueClass: "text-blue-400",    icon: Receipt      },
    { label: "Draft / Blocked",    value: String(invoices.filter((i) => i.status === "Draft" || i.status === "Blocked").length),                                                   valueClass: "text-orange-400",  icon: FileText     },
    { label: "Awaiting Payment",   value: String(invoices.filter((i) => i.paymentStatus === "Awaiting").length),                                                                   valueClass: "text-yellow-400",  icon: Clock        },
    { label: "Overdue Payments",   value: String(invoices.filter((i) => i.paymentStatus === "Overdue").length),                                                                    valueClass: "text-red-400",     icon: AlertTriangle },
  ];

  return (
    <section className="flex min-w-0 w-full flex-col gap-6 px-4 pb-16 pt-0 md:px-6 xl:px-8">

      {/* Header */}
      <header className="flex w-full flex-col justify-between gap-4 py-5 lg:flex-row lg:items-start">
        <div>
          <p className="text-xs font-medium text-slate-500">Contractor Portal</p>
          <h1 className="mt-1 text-xl font-semibold text-slate-50">Invoices</h1>
          <p className="mt-1 text-sm text-slate-400">Track invoice readiness, submitted invoices and payment status across contractor assignments.</p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-3">
          <SyncIndicator source="Vorta" confidence={90} syncedAt={new Date(Date.now() - 75000)} />
          <ExplainWithAi pageId="contractor-invoices" />
          <Button className="bg-blue-600 text-white hover:bg-blue-500">
            <Receipt className="h-4 w-4" />Create Invoice
          </Button>
        </div>
      </header>

      {/* Pipeline summary */}
      <div className="flex flex-wrap gap-4 rounded-xl border border-gray-800 bg-[#141820] px-5 py-4">
        <div className="flex flex-col gap-0.5">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Pipeline</p>
          <p className="text-xl font-semibold tabular-nums text-yellow-400">{fmtGBP(totalPipeline)}</p>
        </div>
        <div className="w-px bg-gray-800" />
        <div className="flex flex-col gap-0.5">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Received (MTD)</p>
          <p className="text-xl font-semibold tabular-nums text-emerald-400">{fmtGBP(totalPaid)}</p>
        </div>
        <div className="w-px bg-gray-800" />
        <div className="flex flex-col gap-0.5">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Blocked</p>
          <p className="text-xl font-semibold tabular-nums text-orange-400">
            {fmtGBP(invoices.filter((i) => i.status === "Blocked").reduce((s, i) => s + calcTotal(i), 0))}
          </p>
        </div>
        <div className="flex-1" />
        <div className="flex items-center gap-1.5 text-xs text-slate-500">
          <TrendingUp className="h-3.5 w-3.5" />June 2026
        </div>
      </div>

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
            placeholder="Search invoices, customers, assignments…"
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
              <table className="w-full min-w-[700px] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-gray-800 bg-[#0f1318]">
                    {["Invoice", "Engineer", "Dates", "Amount", "Payment", "Timesheet", "Report", "Status", ""].map((h) => (
                      <th key={h} className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-500">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-4 py-10 text-center text-sm text-slate-500">
                        No invoices match the current filters.
                      </td>
                    </tr>
                  ) : (
                    filtered.map((inv, idx) => {
                      const isSelected = selected.id === inv.id;
                      const sCfg  = statusConfig[inv.status];
                      const total = calcTotal(inv);
                      return (
                        <tr
                          key={inv.id}
                          onClick={() => setSelected(inv)}
                          className={`cursor-pointer border-b border-gray-800/50 transition-colors hover:bg-[#1a2030] ${
                            isSelected ? "bg-[#1a2030] ring-1 ring-inset ring-blue-500/20" :
                            idx % 2 === 0 ? "bg-[#141820]" : "bg-[#111620]"
                          }`}
                        >
                          <td className="px-4 py-2.5">
                            <p className="font-mono text-xs font-semibold text-slate-100">{inv.number}</p>
                            <p className="max-w-[160px] truncate text-[10px] text-slate-400">{inv.customer}</p>
                            <div className="mt-0.5 flex items-center gap-1 text-[10px] text-slate-600">
                              <MapPin className="h-2.5 w-2.5" />{inv.location}
                            </div>
                          </td>
                          <td className="px-4 py-2.5">
                            <div className="flex items-center gap-1.5">
                              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-blue-500/20 text-[9px] font-bold text-blue-300">
                                {inv.engineerInitials}
                              </div>
                              <span className="text-xs text-slate-300">{inv.engineer.split(" ")[0]}</span>
                            </div>
                          </td>
                          <td className="px-4 py-2.5 text-xs tabular-nums text-slate-400">
                            <p>{inv.invoiceDate}</p>
                            <p className="text-[10px] text-slate-600">Due {inv.dueDate}</p>
                          </td>
                          <td className="px-4 py-2.5 font-semibold tabular-nums text-xs text-slate-200">
                            {fmtGBP(total)}
                          </td>
                          <td className="px-4 py-2.5">
                            <span className={`text-xs font-medium ${paymentCls[inv.paymentStatus]}`}>{inv.paymentStatus}</span>
                          </td>
                          <td className="px-4 py-2.5">
                            <span className={`text-xs font-medium ${inv.timesheetApproved ? "text-emerald-400" : "text-red-400"}`}>
                              {inv.timesheetApproved ? "OK" : "Blocked"}
                            </span>
                          </td>
                          <td className="px-4 py-2.5">
                            <span className={`text-xs font-medium ${inv.reportApproved ? "text-emerald-400" : "text-red-400"}`}>
                              {inv.reportApproved ? "OK" : "Blocked"}
                            </span>
                          </td>
                          <td className="px-4 py-2.5">
                            <Badge className={`inline-flex h-auto rounded px-2 py-0.5 text-[10px] font-medium shadow-none ${sCfg.badge}`}>
                              {inv.status}
                            </Badge>
                          </td>
                          <td className="px-4 py-2.5">
                            <button
                              type="button"
                              onClick={(ev) => { ev.stopPropagation(); setSelected(inv); }}
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
        <DetailPanel inv={selected} />
      </div>

      {/* Blockers & risks */}
      <Card className="rounded-xl border border-gray-800 bg-[#141820] shadow-none">
        <CardContent className="p-5">
          <div className="mb-4 flex items-center justify-between border-b border-gray-800 pb-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-orange-400" />
              <span className="text-sm font-semibold text-slate-200">Blockers &amp; Risks</span>
            </div>
            <Badge className="inline-flex h-auto rounded bg-[#f9731620] px-2 py-0.5 text-[10px] font-medium text-orange-400 shadow-none">
              {invoiceRisks.length} issues
            </Badge>
          </div>
          <div className="flex flex-col gap-2">
            {invoiceRisks.map((risk, i) => {
              const cfg = riskCls[risk.severity];
              return (
                <div key={i} className={`flex items-start gap-2.5 rounded-lg border p-3 ${cfg.card}`}>
                  <AlertTriangle className={`mt-0.5 h-4 w-4 shrink-0 ${cfg.icon}`} />
                  <div>
                    <p className={`text-xs font-semibold ${cfg.icon}`}>{cfg.label} — {risk.invoice}</p>
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
