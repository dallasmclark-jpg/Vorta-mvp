import { useState } from "react";
import {
  AlertTriangle,
  Brain,
  CheckCircle2,
  FileText,
  Filter,
  MapPin,
  Search,
  ShieldCheck,
  ShieldAlert,
  Upload,
  Users,
  XCircle,
} from "lucide-react";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Card, CardContent } from "../../components/ui/card";
import { AiActionsPanel, AiAction } from "../../components/AiActionsPanel";
import { SyncIndicator } from "../../components/SyncIndicator";

// ─── Types ────────────────────────────────────────────────────────────────────

type DocStatus        = "Verified" | "Uploaded" | "Expiring" | "Expired" | "Missing";
type VerifyStatus     = "Verified" | "Pending" | "Not Required" | "Rejected";
type CertStatus       = "valid" | "expiring" | "expired" | "na";

interface ComplianceDoc {
  id: number;
  name: string;
  type: string;
  owner: string;
  ownerInitials: string;
  customer: string;
  expiryDate: string;
  daysToExpiry: number | null;
  status: DocStatus;
  verifyStatus: VerifyStatus;
  requiredForAssignment: boolean;
  riskLevel: "low" | "medium" | "high" | "critical";
}

interface EngineerCerts {
  name: string;
  initials: string;
  edition18th: CertStatus;
  ecscscs: CertStatus;
  ipaf: CertStatus;
  confinedSpace: CertStatus;
  rams: CertStatus;
  siteInduction: CertStatus;
  readiness: number;
}

interface ComplianceRisk {
  severity: "critical" | "high" | "medium";
  item: string;
  description: string;
}

// ─── Mock data ────────────────────────────────────────────────────────────────

const docs: ComplianceDoc[] = [
  {
    id: 1,
    name: "Public Liability Insurance",
    type: "Insurance",
    owner: "Vorta Electrical Ltd",
    ownerInitials: "VE",
    customer: "All Sites",
    expiryDate: "31 Oct 2026",
    daysToExpiry: 125,
    status: "Verified",
    verifyStatus: "Verified",
    requiredForAssignment: true,
    riskLevel: "low",
  },
  {
    id: 2,
    name: "Employer's Liability Insurance",
    type: "Insurance",
    owner: "Vorta Electrical Ltd",
    ownerInitials: "VE",
    customer: "All Sites",
    expiryDate: "31 Oct 2026",
    daysToExpiry: 125,
    status: "Verified",
    verifyStatus: "Verified",
    requiredForAssignment: true,
    riskLevel: "low",
  },
  {
    id: 3,
    name: "18th Edition (BS 7671)",
    type: "Certification",
    owner: "Raj Kumar",
    ownerInitials: "RK",
    customer: "Unilever — Port Sunlight",
    expiryDate: "14 Sep 2026",
    daysToExpiry: 78,
    status: "Expiring",
    verifyStatus: "Verified",
    requiredForAssignment: true,
    riskLevel: "high",
  },
  {
    id: 4,
    name: "IPAF Powered Access (PAL)",
    type: "Certification",
    owner: "Tom Briggs",
    ownerInitials: "TB",
    customer: "Heineken UK",
    expiryDate: "22 Aug 2026",
    daysToExpiry: 55,
    status: "Expiring",
    verifyStatus: "Verified",
    requiredForAssignment: true,
    riskLevel: "high",
  },
  {
    id: 5,
    name: "RAMS — Siemens PLC Upgrade",
    type: "RAMS",
    owner: "Tom Briggs",
    ownerInitials: "TB",
    customer: "Heineken UK",
    expiryDate: "—",
    daysToExpiry: null,
    status: "Verified",
    verifyStatus: "Verified",
    requiredForAssignment: true,
    riskLevel: "low",
  },
  {
    id: 6,
    name: "Confined Space Entry Certificate",
    type: "Certification",
    owner: "Dan Hurst",
    ownerInitials: "DH",
    customer: "Diageo — Leven Distillery",
    expiryDate: "03 Mar 2025",
    daysToExpiry: -117,
    status: "Expired",
    verifyStatus: "Rejected",
    requiredForAssignment: true,
    riskLevel: "critical",
  },
  {
    id: 7,
    name: "Heineken Site Induction",
    type: "Site Induction",
    owner: "James Patel",
    ownerInitials: "JP",
    customer: "Heineken UK",
    expiryDate: "Annual",
    daysToExpiry: null,
    status: "Missing",
    verifyStatus: "Pending",
    requiredForAssignment: true,
    riskLevel: "medium",
  },
  {
    id: 8,
    name: "ATEX Awareness Certificate",
    type: "Certification",
    owner: "Amy Clarke",
    ownerInitials: "AC",
    customer: "William Grant & Sons",
    expiryDate: "12 Jun 2028",
    daysToExpiry: 714,
    status: "Verified",
    verifyStatus: "Verified",
    requiredForAssignment: true,
    riskLevel: "low",
  },
];

const engineerCerts: EngineerCerts[] = [
  { name: "Tom Briggs",  initials: "TB", edition18th: "valid",    ecscscs: "valid",    ipaf: "expiring", confinedSpace: "na",    rams: "valid",    siteInduction: "valid",    readiness: 85 },
  { name: "James Patel", initials: "JP", edition18th: "valid",    ecscscs: "valid",    ipaf: "valid",    confinedSpace: "valid", rams: "valid",    siteInduction: "expiring", readiness: 80 },
  { name: "Raj Kumar",   initials: "RK", edition18th: "expiring", ecscscs: "valid",    ipaf: "na",       confinedSpace: "na",    rams: "valid",    siteInduction: "valid",    readiness: 75 },
  { name: "Dan Hurst",   initials: "DH", edition18th: "valid",    ecscscs: "valid",    ipaf: "valid",    confinedSpace: "expired", rams: "valid",  siteInduction: "valid",    readiness: 60 },
  { name: "Amy Clarke",  initials: "AC", edition18th: "valid",    ecscscs: "valid",    ipaf: "na",       confinedSpace: "na",    rams: "na",       siteInduction: "na",       readiness: 100 },
];

const complianceRisks: ComplianceRisk[] = [
  { severity: "critical", item: "Dan Hurst — Confined Space",      description: "Certificate expired Mar 2025. Dan is blocked from all confined-space work including the Diageo distillery assignment." },
  { severity: "high",     item: "Tom Briggs — IPAF expires 22 Aug", description: "IPAF PAL expires in 55 days. Tom is on the Heineken Lager Line assignment which requires powered-access certification." },
  { severity: "high",     item: "Raj Kumar — 18th Edition expires", description: "18th Edition expires 14 Sep 2026. Renewal booking required before next Unilever assignment starts." },
  { severity: "medium",   item: "James Patel — Heineken induction", description: "Site induction not recorded for Heineken Manchester. Required before any future Heineken site attendance." },
];

const aiActions: AiAction[] = [
  { label: "Block Dan Hurst from Diageo confined-space work", description: "Dan's confined-space cert is expired. Remove him from the Diageo shortlist and flag to account manager before mobilisation.", priority: "critical", icon: ShieldAlert },
  { label: "Book Tom Briggs IPAF renewal — Aug deadline",     description: "IPAF PAL expires 22 Aug. Book renewal with approved training provider now before Heineken re-mobilisation.",                  priority: "high",    icon: FileText    },
  { label: "Book Raj Kumar 18th Edition renewal",             description: "Certificate expires 14 Sep. Book City & Guilds renewal course — 8–10 week lead time means booking needed this week.",         priority: "high",    icon: FileText    },
  { label: "Improve marketplace compliance score",            description: "Current compliance score 74%. Resolving the 2 expired/expiring certs and missing induction would push this to 92%+.",         priority: "medium",  icon: Brain       },
];

// ─── Config maps (exhaustive) ─────────────────────────────────────────────────

const docStatusConfig: Record<DocStatus, { badge: string }> = {
  "Verified": { badge: "bg-[#10b98120] text-emerald-400" },
  "Uploaded": { badge: "bg-[#3b82f620] text-blue-400"    },
  "Expiring": { badge: "bg-[#facc1520] text-yellow-400"  },
  "Expired":  { badge: "bg-[#ef444420] text-red-400"     },
  "Missing":  { badge: "bg-[#f9731620] text-orange-400"  },
};

const verifyCls: Record<VerifyStatus, string> = {
  "Verified":     "text-emerald-400",
  "Pending":      "text-yellow-400",
  "Not Required": "text-slate-500",
  "Rejected":     "text-red-400",
};

const certCls: Record<CertStatus, { bg: string; text: string; label: string }> = {
  valid:    { bg: "bg-emerald-500/20", text: "text-emerald-400", label: "OK"  },
  expiring: { bg: "bg-yellow-400/20",  text: "text-yellow-400",  label: "Exp" },
  expired:  { bg: "bg-red-500/20",     text: "text-red-400",     label: "!"   },
  na:       { bg: "bg-[#ffffff08]",    text: "text-slate-600",   label: "—"   },
};

const riskCls: Record<ComplianceRisk["severity"], { card: string; icon: string; label: string }> = {
  critical: { card: "border-red-500/20 bg-[#ef444408]",    icon: "text-red-400",    label: "Critical" },
  high:     { card: "border-orange-400/20 bg-[#f9731608]", icon: "text-orange-400", label: "High"     },
  medium:   { card: "border-yellow-400/20 bg-[#facc1508]", icon: "text-yellow-400", label: "Medium"   },
};

const ALL_STATUSES: Array<"All" | DocStatus> = ["All", "Missing", "Expired", "Expiring", "Uploaded", "Verified"];

// ─── Site readiness checklist ─────────────────────────────────────────────────

const SITE_CHECKLIST = [
  { label: "Public liability insurance valid",  done: true  },
  { label: "RAMS uploaded and verified",        done: true  },
  { label: "Engineer certifications valid",     done: false },
  { label: "Site inductions complete",          done: false },
  { label: "Permits available",                 done: true  },
  { label: "Customer-specific requirements met",done: false },
];

// ─── Detail panel ─────────────────────────────────────────────────────────────

function DetailPanel({ doc }: { doc: ComplianceDoc }) {
  const sCfg = docStatusConfig[doc.status];
  return (
    <Card className="rounded-xl border border-gray-800 bg-[#141820] shadow-none">
      <CardContent className="p-5">
        <div className="mb-4 flex items-start gap-2 border-b border-gray-800 pb-4">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-blue-400" />
          <div>
            <p className="text-sm font-semibold text-slate-200">Document Detail</p>
            <p className="text-[11px] text-slate-500">Click any row to preview</p>
          </div>
        </div>

        {/* Doc header */}
        <div className="mb-4 flex flex-col gap-2">
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-semibold text-slate-100">{doc.name}</p>
            <Badge className={`inline-flex h-auto shrink-0 rounded px-2 py-0.5 text-[10px] font-medium shadow-none ${sCfg.badge}`}>{doc.status}</Badge>
          </div>
          <p className="text-xs text-slate-400">{doc.type}</p>
        </div>

        {/* Owner */}
        <div className="mb-4 flex items-center gap-3 rounded-lg border border-gray-800 bg-[#0f1318] p-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-500/20 text-[10px] font-bold text-blue-300">
            {doc.ownerInitials}
          </div>
          <div>
            <p className="text-sm font-medium text-slate-100">{doc.owner}</p>
            <p className="text-[11px] text-slate-500">{doc.customer}</p>
          </div>
        </div>

        {/* Status items */}
        <div className="mb-4 flex flex-col gap-0">
          <div className="flex items-center justify-between border-b border-gray-800/60 py-1.5">
            <span className="text-xs text-slate-500">Expiry</span>
            <span className={`text-xs font-medium ${
              doc.daysToExpiry !== null && doc.daysToExpiry < 0 ? "text-red-400" :
              doc.daysToExpiry !== null && doc.daysToExpiry < 90 ? "text-yellow-400" :
              "text-slate-300"
            }`}>{doc.expiryDate}</span>
          </div>
          <div className="flex items-center justify-between border-b border-gray-800/60 py-1.5">
            <span className="text-xs text-slate-500">Verification</span>
            <span className={`text-xs font-medium ${verifyCls[doc.verifyStatus]}`}>{doc.verifyStatus}</span>
          </div>
          <div className="flex items-center justify-between border-b border-gray-800/60 py-1.5">
            <span className="text-xs text-slate-500">Assignment Required</span>
            <span className={`text-xs font-medium ${doc.requiredForAssignment ? "text-slate-200" : "text-slate-500"}`}>
              {doc.requiredForAssignment ? "Yes" : "No"}
            </span>
          </div>
          <div className="flex items-center justify-between py-1.5">
            <span className="text-xs text-slate-500">Risk Level</span>
            <span className={`text-xs font-semibold capitalize ${
              doc.riskLevel === "critical" ? "text-red-400" :
              doc.riskLevel === "high"     ? "text-orange-400" :
              doc.riskLevel === "medium"   ? "text-yellow-400" :
              "text-emerald-400"
            }`}>{doc.riskLevel}</span>
          </div>
        </div>

        {/* Site readiness */}
        <div className="mb-4">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Site Readiness</p>
          <div className="flex flex-col gap-1.5">
            {SITE_CHECKLIST.map(({ label, done }) => (
              <div key={label} className="flex items-center gap-2.5">
                {done
                  ? <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
                  : <XCircle      className="h-3.5 w-3.5 shrink-0 text-slate-600"   />}
                <span className={`text-xs ${done ? "text-slate-300" : "text-slate-500"}`}>{label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-2 border-t border-gray-800 pt-4">
          <Button className="w-full bg-blue-600 text-white hover:bg-blue-500">
            <Upload className="h-4 w-4" />Upload Renewal
          </Button>
          <Button variant="outline" className="w-full border-[#ffffff20] bg-[#ffffff0a] text-slate-200 hover:bg-[#ffffff18] hover:text-slate-50">
            <FileText className="h-4 w-4" />View Document
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export const ContractorComplianceSection = (): JSX.Element => {
  const [search,   setSearch]   = useState("");
  const [status,   setStatus]   = useState<"All" | DocStatus>("All");
  const [selected, setSelected] = useState<ComplianceDoc>(docs[0]);

  const filtered = docs.filter((d) => {
    const q  = search.toLowerCase();
    const mQ = q === "" || d.name.toLowerCase().includes(q) || d.owner.toLowerCase().includes(q) || d.type.toLowerCase().includes(q) || d.customer.toLowerCase().includes(q);
    const mS = status === "All" || d.status === status;
    return mQ && mS;
  });

  const kpis = [
    { label: "Compliant Engineers",  value: String(engineerCerts.filter((e) => e.readiness >= 90).length),                        valueClass: "text-emerald-400", icon: ShieldCheck  },
    { label: "Expiring Soon",        value: String(docs.filter((d) => d.status === "Expiring").length),                           valueClass: "text-yellow-400",  icon: AlertTriangle },
    { label: "Missing / Expired",    value: String(docs.filter((d) => d.status === "Missing" || d.status === "Expired").length),  valueClass: "text-red-400",     icon: XCircle      },
    { label: "Site Ready",           value: `${SITE_CHECKLIST.filter((i) => i.done).length}/${SITE_CHECKLIST.length}`,            valueClass: "text-blue-400",    icon: ShieldCheck  },
  ];

  return (
    <section className="flex min-w-0 w-full flex-col gap-6 px-4 pb-16 pt-0 md:px-6 xl:px-8">

      {/* Header */}
      <header className="flex w-full flex-col justify-between gap-4 py-5 lg:flex-row lg:items-start">
        <div>
          <p className="text-xs font-medium text-slate-500">Contractor Portal</p>
          <h1 className="mt-1 text-xl font-semibold text-slate-50">Compliance</h1>
          <p className="mt-1 text-sm text-slate-400">Monitor contractor documents, engineer certifications and site readiness.</p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-3">
          <SyncIndicator source="Vorta" confidence={86} syncedAt={new Date(Date.now() - 90000)} />
          <Button className="bg-blue-600 text-white hover:bg-blue-500">
            <Upload className="h-4 w-4" />Upload Document
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
            placeholder="Search documents, engineers, types…"
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
              <table className="w-full min-w-[660px] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-gray-800 bg-[#0f1318]">
                    {["Document", "Owner", "Type", "Expiry", "Verification", "Assignment", "Status", ""].map((h) => (
                      <th key={h} className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-500">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-10 text-center text-sm text-slate-500">
                        No documents match the current filters.
                      </td>
                    </tr>
                  ) : (
                    filtered.map((doc, idx) => {
                      const isSelected = selected.id === doc.id;
                      const sCfg = docStatusConfig[doc.status];
                      return (
                        <tr
                          key={doc.id}
                          onClick={() => setSelected(doc)}
                          className={`cursor-pointer border-b border-gray-800/50 transition-colors hover:bg-[#1a2030] ${
                            isSelected ? "bg-[#1a2030] ring-1 ring-inset ring-blue-500/20" :
                            idx % 2 === 0 ? "bg-[#141820]" : "bg-[#111620]"
                          }`}
                        >
                          <td className="px-4 py-2.5">
                            <p className="max-w-[160px] truncate font-medium text-slate-100">{doc.name}</p>
                            <p className="text-[10px] text-slate-500">{doc.customer}</p>
                          </td>
                          <td className="px-4 py-2.5">
                            <div className="flex items-center gap-1.5">
                              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-blue-500/20 text-[9px] font-bold text-blue-300">
                                {doc.ownerInitials}
                              </div>
                              <span className="max-w-[80px] truncate text-xs text-slate-300">{doc.owner.split(" ")[0]}</span>
                            </div>
                          </td>
                          <td className="px-4 py-2.5 text-xs text-slate-400">{doc.type}</td>
                          <td className="px-4 py-2.5 tabular-nums text-xs">
                            <span className={
                              doc.daysToExpiry !== null && doc.daysToExpiry < 0  ? "text-red-400" :
                              doc.daysToExpiry !== null && doc.daysToExpiry < 90 ? "text-yellow-400" :
                              "text-slate-400"
                            }>{doc.expiryDate}</span>
                            {doc.daysToExpiry !== null && doc.daysToExpiry >= 0 && (
                              <p className="text-[10px] text-slate-600">{doc.daysToExpiry}d</p>
                            )}
                          </td>
                          <td className="px-4 py-2.5">
                            <span className={`text-xs font-medium ${verifyCls[doc.verifyStatus]}`}>{doc.verifyStatus}</span>
                          </td>
                          <td className="px-4 py-2.5 text-xs">
                            <span className={doc.requiredForAssignment ? "text-slate-300" : "text-slate-600"}>
                              {doc.requiredForAssignment ? "Required" : "Optional"}
                            </span>
                          </td>
                          <td className="px-4 py-2.5">
                            <Badge className={`inline-flex h-auto rounded px-2 py-0.5 text-[10px] font-medium shadow-none ${sCfg.badge}`}>
                              {doc.status}
                            </Badge>
                          </td>
                          <td className="px-4 py-2.5">
                            <button
                              type="button"
                              onClick={(ev) => { ev.stopPropagation(); setSelected(doc); }}
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
        <DetailPanel doc={selected} />
      </div>

      {/* Engineer certification matrix */}
      <Card className="rounded-xl border border-gray-800 bg-[#141820] shadow-none">
        <CardContent className="p-0">
          <div className="flex items-center justify-between border-b border-gray-800 px-5 py-4">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-blue-400" />
              <span className="text-sm font-semibold text-slate-200">Engineer Certification Matrix</span>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[620px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-gray-800 bg-[#0f1318]">
                  {["Engineer", "18th Ed", "ECS / CSCS", "IPAF", "Confined Space", "RAMS", "Site Induction", "Readiness"].map((h) => (
                    <th key={h} className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {engineerCerts.map((e, idx) => {
                  const cols: CertStatus[] = [e.edition18th, e.ecscscs, e.ipaf, e.confinedSpace, e.rams, e.siteInduction];
                  return (
                    <tr key={e.name} className={`border-b border-gray-800/50 ${idx % 2 === 0 ? "bg-[#141820]" : "bg-[#111620]"}`}>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-blue-500/20 text-[10px] font-bold text-blue-300">
                            {e.initials}
                          </div>
                          <span className="font-medium text-slate-100">{e.name}</span>
                        </div>
                      </td>
                      {cols.map((cs, ci) => {
                        const cfg = certCls[cs];
                        return (
                          <td key={ci} className="px-4 py-2.5">
                            <span className={`inline-flex h-5 min-w-[28px] items-center justify-center rounded px-1.5 text-[10px] font-bold ${cfg.bg} ${cfg.text}`}>
                              {cfg.label}
                            </span>
                          </td>
                        );
                      })}
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          <div className="relative h-1.5 w-14 overflow-hidden rounded bg-gray-800">
                            <div
                              className={`absolute left-0 top-0 h-full rounded ${
                                e.readiness >= 90 ? "bg-emerald-500" :
                                e.readiness >= 70 ? "bg-yellow-400" : "bg-red-500"
                              }`}
                              style={{ width: `${e.readiness}%` }}
                            />
                          </div>
                          <span className="tabular-nums text-xs text-slate-400">{e.readiness}%</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap items-center gap-4 border-t border-gray-800 px-5 py-3">
            {(["valid", "expiring", "expired", "na"] as CertStatus[]).map((cs) => {
              const cfg = certCls[cs];
              return (
                <div key={cs} className="flex items-center gap-1.5">
                  <span className={`inline-flex h-4 w-6 items-center justify-center rounded text-[9px] font-bold ${cfg.bg} ${cfg.text}`}>{cfg.label}</span>
                  <span className="text-[11px] capitalize text-slate-500">{cs === "na" ? "Not applicable" : cs}</span>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Compliance risks */}
      <Card className="rounded-xl border border-gray-800 bg-[#141820] shadow-none">
        <CardContent className="p-5">
          <div className="mb-4 flex items-center justify-between border-b border-gray-800 pb-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-orange-400" />
              <span className="text-sm font-semibold text-slate-200">Compliance Risks</span>
            </div>
            <Badge className="inline-flex h-auto rounded bg-[#f9731620] px-2 py-0.5 text-[10px] font-medium text-orange-400 shadow-none">
              {complianceRisks.length} issues
            </Badge>
          </div>
          <div className="flex flex-col gap-2">
            {complianceRisks.map((risk, i) => {
              const cfg = riskCls[risk.severity];
              return (
                <div key={i} className={`flex items-start gap-2.5 rounded-lg border p-3 ${cfg.card}`}>
                  <AlertTriangle className={`mt-0.5 h-4 w-4 shrink-0 ${cfg.icon}`} />
                  <div>
                    <p className={`text-xs font-semibold ${cfg.icon}`}>{cfg.label} — {risk.item}</p>
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
