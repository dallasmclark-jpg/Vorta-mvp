import { useState } from "react";
import {
  AlertTriangle,
  Brain,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  FileText,
  MapPin,
  Receipt,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  TrendingUp,
  Users,
  Zap,
} from "lucide-react";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Card, CardContent } from "../../components/ui/card";
import { SyncIndicator } from "../../components/SyncIndicator";

// ─── Types ────────────────────────────────────────────────────────────────────

type Priority    = "critical" | "high" | "medium" | "low";
type RecCategory = "Opportunity" | "Workforce" | "Compliance" | "Revenue" | "Training";
type RecStatus   = "Action Required" | "In Progress" | "Resolved" | "Monitoring";

interface AiRec {
  id: number;
  priority: Priority;
  category: RecCategory;
  title: string;
  explanation: string;
  action: string;
  linkedTo: string;
  confidence: number;
  impact: string;
  status: RecStatus;
}

interface OppRec {
  opportunity: string;
  customer: string;
  location: string;
  matchScore: number;
  engineer: string;
  engineerInitials: string;
  availability: "Available" | "Partial" | "Unavailable";
  complianceReady: boolean;
  revenue: string;
  response: string;
}

interface WorkforceRec {
  engineer: string;
  initials: string;
  utilisation: number;
  action: string;
  actionType: "gap" | "skill" | "cert" | "training" | "availability";
}

interface RevenueInsight {
  label: string;
  value: string;
  sublabel: string;
  colour: string;
}

// ─── Mock data ────────────────────────────────────────────────────────────────

const aiRecs: AiRec[] = [
  {
    id: 1, priority: "critical", category: "Compliance",
    title: "Dan Hurst blocked from Diageo confined-space work",
    explanation: "Dan's confined-space certificate expired March 2025. He is scheduled on the Diageo Leven Distillery assignment which mandates confined-space entry. Mobilisation will be refused on site.",
    action: "Remove Dan from the Diageo assignment shortlist and arrange renewal training before re-booking.",
    linkedTo: "Dan Hurst / Diageo Leven Distillery",
    confidence: 99, impact: "Assignment delay — 3 days mobilisation risk", status: "Action Required",
  },
  {
    id: 2, priority: "critical", category: "Revenue",
    title: "Britvic emergency callout invoice overdue 14 days",
    explanation: "INV-2026-038 (£972.00) was submitted on 14 May, payment terms 30 days. Payment has not been received. Risk of bad debt if not chased this week.",
    action: "Send formal payment reminder to Britvic finance. Escalate to account manager if no response in 48 hours.",
    linkedTo: "INV-2026-038 / Britvic PLC",
    confidence: 98, impact: "£972 revenue at risk", status: "Action Required",
  },
  {
    id: 3, priority: "high", category: "Compliance",
    title: "Tom Briggs IPAF renewal — expires 22 Aug",
    explanation: "IPAF PAL expires in 55 days. Tom is the lead engineer on the Heineken PLC Upgrade and re-mobilisation is scheduled for mid-August. Non-renewal will block the assignment.",
    action: "Book IPAF renewal with approved provider this week. 3–5 day lead time typically required.",
    linkedTo: "Tom Briggs / Heineken UK",
    confidence: 96, impact: "Assignment blocked mid-August if not renewed", status: "Action Required",
  },
  {
    id: 4, priority: "high", category: "Opportunity",
    title: "William Grant & Sons distillery — Amy Clarke is best fit",
    explanation: "New open requirement at William Grant & Sons (ATEX instrumentation). Amy Clarke holds valid ATEX certification and is available from 7 Jul. Match score 91%. Only two other contractors have responded so far.",
    action: "Submit Amy Clarke's profile to William Grant & Sons. Window closes in ~5 days.",
    linkedTo: "Amy Clarke / William Grant & Sons",
    confidence: 91, impact: "£4,200 revenue opportunity", status: "Action Required",
  },
  {
    id: 5, priority: "high", category: "Revenue",
    title: "James Patel Britvic timesheet approved — raise invoice",
    explanation: "James's timesheet and job report for the Krones PM visit (W/E 20 Jun) are both fully approved. Invoice INV-2026-041 can be raised and submitted immediately.",
    action: "Submit INV-2026-041 to Britvic PLC today. Expected payment within 30 days.",
    linkedTo: "James Patel / Britvic PLC",
    confidence: 100, impact: "£2,780 invoiceable now", status: "Action Required",
  },
  {
    id: 6, priority: "high", category: "Compliance",
    title: "Raj Kumar 18th Edition expiry — 14 Sep",
    explanation: "18th Edition (BS 7671) certificate expires in 78 days. Raj is the primary electrical engineer on the Unilever robot cell project. Renewal takes 8–10 weeks via City & Guilds.",
    action: "Book City & Guilds 18th Edition renewal course immediately. Must complete before Sep.",
    linkedTo: "Raj Kumar / Unilever Port Sunlight",
    confidence: 95, impact: "Engineer unavailable from Sep if not renewed", status: "In Progress",
  },
  {
    id: 7, priority: "medium", category: "Workforce",
    title: "Raj Kumar missing timesheet blocking Unilever invoice",
    explanation: "Raj has not submitted his timesheet for W/E 27 Jun. The job report is also overdue. Invoice cannot be raised and revenue is being delayed.",
    action: "Chase Raj Kumar for timesheet and job report submission. Invoice blocked until resolved.",
    linkedTo: "Raj Kumar / Unilever Port Sunlight",
    confidence: 97, impact: "£1,190 invoice blocked", status: "Action Required",
  },
  {
    id: 8, priority: "medium", category: "Workforce",
    title: "Amy Clarke under-utilised — 0% bookings this month",
    explanation: "Amy has been available for 4 weeks with no bookings. Her ATEX and F-Gas skills are in demand but she is not appearing on shortlists. Likely caused by missing site-specific induction records.",
    action: "Complete Vorta profile and add recent induction records. Submit to 2 open ATEX opportunities.",
    linkedTo: "Amy Clarke",
    confidence: 83, impact: "Potential £5,600/month additional revenue", status: "Monitoring",
  },
  {
    id: 9, priority: "medium", category: "Opportunity",
    title: "Diageo cold store inspection — apply now",
    explanation: "Follow-on cold store inspection opportunity at Diageo (Fife). Diageo were satisfied with the F-Gas survey. Early submission significantly improves award probability.",
    action: "Apply to Diageo requirement within 48 hours before it opens to wider market.",
    linkedTo: "Dan Hurst / Diageo Leven Distillery",
    confidence: 76, impact: "£2,400 revenue opportunity", status: "Action Required",
  },
  {
    id: 10, priority: "low", category: "Training",
    title: "James Patel — recommend ATEX refresher for distillery pipeline",
    explanation: "Multiple upcoming distillery and chemical site requirements require ATEX awareness. James has core electrical skills but no current ATEX qualification on record.",
    action: "Book ATEX refresher training. Will increase marketplace match rate by ~18%.",
    linkedTo: "James Patel",
    confidence: 68, impact: "+18% opportunity match rate", status: "Monitoring",
  },
];

const oppRecs: OppRec[] = [
  { opportunity: "ATEX Instrumentation Survey", customer: "William Grant & Sons", location: "Dufftown, Scotland", matchScore: 91, engineer: "Amy Clarke",  engineerInitials: "AC", availability: "Available",  complianceReady: true,  revenue: "£4,200", response: "Submit profile today — window closes in ~5 days" },
  { opportunity: "Cold Store Follow-on Inspection", customer: "Diageo — Leven",   location: "Fife",              matchScore: 78, engineer: "Dan Hurst",   engineerInitials: "DH", availability: "Partial",   complianceReady: false, revenue: "£2,400", response: "Resolve confined-space cert before submitting Dan" },
  { opportunity: "ABB Robot Cell Phase 2",         customer: "Unilever — Wirral", location: "Port Sunlight",     matchScore: 85, engineer: "Raj Kumar",   engineerInitials: "RK", availability: "Available",  complianceReady: true,  revenue: "£3,800", response: "Submit Raj Kumar — high repeat-client win rate" },
];

const workforceRecs: WorkforceRec[] = [
  { engineer: "Amy Clarke",  initials: "AC", utilisation: 0,   action: "Zero bookings — complete profile and apply to open ATEX opportunities", actionType: "availability" },
  { engineer: "Raj Kumar",   initials: "RK", utilisation: 45,  action: "18th Edition renewal required before Sep — book immediately",           actionType: "cert"        },
  { engineer: "Dan Hurst",   initials: "DH", utilisation: 60,  action: "Confined-space cert expired — blocked from Diageo work",                actionType: "cert"        },
  { engineer: "James Patel", initials: "JP", utilisation: 100, action: "ATEX refresher recommended — expands distillery pipeline",              actionType: "training"    },
  { engineer: "Tom Briggs",  initials: "TB", utilisation: 90,  action: "IPAF renewal due Aug — book now before Heineken re-mobilisation",       actionType: "cert"        },
];

const revenueInsights: RevenueInsight[] = [
  { label: "Open Opportunity Pipeline", value: "£10,400",  sublabel: "3 opportunities to apply",      colour: "text-blue-400"    },
  { label: "Invoiceable Now",           value: "£2,780",   sublabel: "1 invoice ready to raise",      colour: "text-emerald-400" },
  { label: "Blocked Revenue",           value: "£4,850",   sublabel: "3 invoices pending resolution", colour: "text-orange-400"  },
  { label: "Overdue Payments",          value: "£972",     sublabel: "1 invoice 14 days overdue",     colour: "text-red-400"     },
];

const AI_FACTORS = [
  { label: "Skills match",          weight: 28 },
  { label: "Availability",          weight: 22 },
  { label: "Certifications",        weight: 18 },
  { label: "Assignment urgency",    weight: 12 },
  { label: "Customer priority",     weight: 10 },
  { label: "Revenue value",         weight: 6  },
  { label: "Risk level",            weight: 4  },
];

// ─── Config maps ──────────────────────────────────────────────────────────────

const priorityConfig: Record<Priority, { badge: string; border: string; label: string; dot: string }> = {
  critical: { badge: "bg-[#ef444420] text-red-400",    border: "border-red-500/20",    label: "Critical", dot: "bg-red-400"    },
  high:     { badge: "bg-[#f9731620] text-orange-400", border: "border-orange-400/20", label: "High",     dot: "bg-orange-400" },
  medium:   { badge: "bg-[#facc1520] text-yellow-400", border: "border-yellow-400/20", label: "Medium",   dot: "bg-yellow-400" },
  low:      { badge: "bg-[#3b82f620] text-blue-400",   border: "border-blue-500/20",   label: "Low",      dot: "bg-blue-400"   },
};

const categoryConfig: Record<RecCategory, { icon: React.ComponentType<{ className?: string }> }> = {
  Opportunity: { icon: TrendingUp   },
  Workforce:   { icon: Users        },
  Compliance:  { icon: ShieldAlert  },
  Revenue:     { icon: Receipt      },
  Training:    { icon: FileText     },
};

const statusConfig: Record<RecStatus, string> = {
  "Action Required": "bg-[#ef444420] text-red-400",
  "In Progress":     "bg-[#3b82f620] text-blue-400",
  "Resolved":        "bg-[#10b98120] text-emerald-400",
  "Monitoring":      "bg-[#facc1520] text-yellow-400",
};

const availabilityCls: Record<OppRec["availability"], string> = {
  "Available":   "text-emerald-400",
  "Partial":     "text-yellow-400",
  "Unavailable": "text-red-400",
};

const actionTypeCls: Record<WorkforceRec["actionType"], { bg: string; text: string }> = {
  availability: { bg: "bg-[#3b82f620]",    text: "text-blue-400"    },
  skill:        { bg: "bg-[#10b98120]",    text: "text-emerald-400" },
  cert:         { bg: "bg-[#ef444420]",    text: "text-red-400"     },
  training:     { bg: "bg-[#facc1520]",    text: "text-yellow-400"  },
  gap:          { bg: "bg-[#f9731620]",    text: "text-orange-400"  },
};

const ACTION_TYPE_LABELS: Record<WorkforceRec["actionType"], string> = {
  availability: "Availability",
  skill: "Skill Gap",
  cert: "Certification",
  training: "Training",
  gap: "Coverage Gap",
};

const PRIORITY_ORDER: Priority[] = ["critical", "high", "medium", "low"];

// ─── Sub-components ───────────────────────────────────────────────────────────

function ConfidenceBar({ value }: { value: number }) {
  return (
    <div className="flex items-center gap-2">
      <div className="relative h-1 w-16 overflow-hidden rounded bg-gray-800">
        <div
          className={`absolute left-0 top-0 h-full rounded ${
            value >= 90 ? "bg-emerald-500" : value >= 70 ? "bg-blue-500" : "bg-yellow-400"
          }`}
          style={{ width: `${value}%` }}
        />
      </div>
      <span className="tabular-nums text-[11px] text-slate-400">{value}%</span>
    </div>
  );
}

function RecCard({ rec }: { rec: AiRec }) {
  const [expanded, setExpanded] = useState(false);
  const pCfg  = priorityConfig[rec.priority];
  const cCfg  = categoryConfig[rec.category];
  const Icon  = cCfg.icon;
  return (
    <div className={`rounded-xl border bg-[#111620] p-4 ${pCfg.border}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${pCfg.badge}`}>
            <Icon className="h-3.5 w-3.5" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5 mb-1">
              <Badge className={`inline-flex h-auto rounded px-2 py-0.5 text-[10px] font-medium shadow-none ${pCfg.badge}`}>{pCfg.label}</Badge>
              <Badge className="inline-flex h-auto rounded bg-[#ffffff0f] px-2 py-0.5 text-[10px] font-medium text-slate-400 shadow-none">{rec.category}</Badge>
              <Badge className={`inline-flex h-auto rounded px-2 py-0.5 text-[10px] font-medium shadow-none ${statusConfig[rec.status]}`}>{rec.status}</Badge>
            </div>
            <p className="text-sm font-semibold text-slate-100">{rec.title}</p>
            <p className="mt-0.5 text-[11px] text-slate-500">{rec.linkedTo}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="shrink-0 rounded-lg border border-gray-700 p-1 text-slate-500 transition-colors hover:border-gray-600 hover:bg-[#ffffff0a] hover:text-slate-300"
        >
          {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </button>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-4">
        <div>
          <p className="text-[10px] text-slate-600">AI Confidence</p>
          <ConfidenceBar value={rec.confidence} />
        </div>
        <div>
          <p className="text-[10px] text-slate-600">Impact</p>
          <p className="text-[11px] font-medium text-slate-300">{rec.impact}</p>
        </div>
      </div>

      {expanded && (
        <div className="mt-3 border-t border-gray-800 pt-3">
          <p className="mb-2 text-[11px] leading-relaxed text-slate-400">{rec.explanation}</p>
          <div className="flex items-start gap-2 rounded-lg border border-blue-500/20 bg-blue-500/5 p-2.5">
            <Zap className="mt-0.5 h-3.5 w-3.5 shrink-0 text-blue-400" />
            <p className="text-[11px] leading-relaxed text-blue-300">{rec.action}</p>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export const ContractorAiRecommendationsSection = (): JSX.Element => {
  const kpis = [
    { label: "Critical Actions",  value: String(aiRecs.filter((r) => r.priority === "critical").length),                            valueClass: "text-red-400",    icon: AlertTriangle },
    { label: "Opportunity Wins",  value: String(aiRecs.filter((r) => r.category === "Opportunity").length),                          valueClass: "text-emerald-400", icon: TrendingUp    },
    { label: "Compliance Risks",  value: String(aiRecs.filter((r) => r.category === "Compliance").length),                           valueClass: "text-orange-400",  icon: ShieldAlert   },
    { label: "Revenue Uplift",    value: "£10,400",                                                                                   valueClass: "text-blue-400",    icon: Receipt       },
  ];

  return (
    <section className="flex min-w-0 w-full flex-col gap-6 px-4 pb-16 pt-0 md:px-6 xl:px-8">

      {/* Header */}
      <header className="flex w-full flex-col justify-between gap-4 py-5 lg:flex-row lg:items-start">
        <div>
          <p className="text-xs font-medium text-slate-500">Contractor Portal</p>
          <h1 className="mt-1 text-xl font-semibold text-slate-50">AI Recommendations</h1>
          <p className="mt-1 text-sm text-slate-400">Prioritise workforce actions, opportunity responses and compliance risks using Vorta intelligence.</p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-3">
          <SyncIndicator source="Vorta AI" confidence={94} syncedAt={new Date(Date.now() - 45000)} />
          <Button className="bg-blue-600 text-white hover:bg-blue-500">
            <RefreshCw className="h-4 w-4" />Run AI Review
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

      {/* Priority board */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_300px]">
        <div className="flex flex-col gap-6">
          {PRIORITY_ORDER.map((priority) => {
            const group = aiRecs.filter((r) => r.priority === priority);
            if (group.length === 0) return null;
            const pCfg = priorityConfig[priority];
            return (
              <div key={priority}>
                <div className="mb-3 flex items-center gap-2">
                  <span className={`h-2 w-2 rounded-full ${pCfg.dot}`} />
                  <h2 className="text-sm font-semibold text-slate-300">{pCfg.label}</h2>
                  <Badge className={`inline-flex h-auto rounded px-2 py-0.5 text-[10px] font-medium shadow-none ${pCfg.badge}`}>{group.length}</Badge>
                </div>
                <div className="flex flex-col gap-2">
                  {group.map((rec) => <RecCard key={rec.id} rec={rec} />)}
                </div>
              </div>
            );
          })}
        </div>

        {/* AI explanation sidebar */}
        <div className="flex flex-col gap-4">
          <Card className="rounded-xl border border-blue-500/20 bg-[#141820] shadow-none">
            <CardContent className="p-5">
              <div className="mb-4 flex items-center gap-2 border-b border-gray-800 pb-4">
                <Brain className="h-4 w-4 text-blue-400" />
                <span className="text-sm font-semibold text-slate-200">How Vorta Prioritises</span>
              </div>
              <p className="mb-4 text-[11px] leading-relaxed text-slate-400">
                Vorta weighs each recommendation using a multi-factor scoring model. The following factors determine ranking order and AI confidence.
              </p>
              <div className="flex flex-col gap-2.5">
                {AI_FACTORS.map(({ label, weight }) => (
                  <div key={label}>
                    <div className="mb-1 flex items-center justify-between">
                      <span className="text-[11px] text-slate-400">{label}</span>
                      <span className="tabular-nums text-[11px] text-slate-500">{weight}%</span>
                    </div>
                    <div className="relative h-1.5 w-full overflow-hidden rounded bg-gray-800">
                      <div className="absolute left-0 top-0 h-full rounded bg-blue-500/60" style={{ width: `${weight * 3}%` }} />
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-4 rounded-lg border border-blue-500/20 bg-blue-500/5 p-3">
                <p className="text-[11px] leading-relaxed text-blue-300">
                  Recommendations are refreshed every 30 minutes. Run AI Review to force a real-time analysis.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Revenue insights */}
          <Card className="rounded-xl border border-gray-800 bg-[#141820] shadow-none">
            <CardContent className="p-5">
              <div className="mb-4 flex items-center gap-2 border-b border-gray-800 pb-4">
                <TrendingUp className="h-4 w-4 text-blue-400" />
                <span className="text-sm font-semibold text-slate-200">Revenue Insights</span>
              </div>
              <div className="flex flex-col gap-3">
                {revenueInsights.map(({ label, value, sublabel, colour }) => (
                  <div key={label} className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-xs text-slate-400">{label}</p>
                      <p className="text-[11px] text-slate-600">{sublabel}</p>
                    </div>
                    <p className={`shrink-0 text-sm font-semibold tabular-nums ${colour}`}>{value}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Opportunity recommendations */}
      <Card className="rounded-xl border border-gray-800 bg-[#141820] shadow-none">
        <CardContent className="p-0">
          <div className="flex items-center justify-between border-b border-gray-800 px-5 py-4">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-blue-400" />
              <span className="text-sm font-semibold text-slate-200">Opportunity Recommendations</span>
            </div>
            <Badge className="inline-flex h-auto rounded bg-[#3b82f620] px-2 py-0.5 text-[10px] font-medium text-blue-400 shadow-none">
              {oppRecs.length} ranked
            </Badge>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-gray-800 bg-[#0f1318]">
                  {["Opportunity", "Engineer", "Match", "Availability", "Compliant", "Revenue", "Recommended Action"].map((h) => (
                    <th key={h} className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {oppRecs.map((opp, idx) => (
                  <tr key={opp.opportunity} className={`border-b border-gray-800/50 ${idx % 2 === 0 ? "bg-[#141820]" : "bg-[#111620]"}`}>
                    <td className="px-4 py-2.5">
                      <p className="max-w-[160px] truncate font-medium text-slate-100">{opp.opportunity}</p>
                      <p className="text-[10px] text-slate-400">{opp.customer}</p>
                      <div className="mt-0.5 flex items-center gap-1 text-[10px] text-slate-600">
                        <MapPin className="h-2.5 w-2.5" />{opp.location}
                      </div>
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-1.5">
                        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-blue-500/20 text-[9px] font-bold text-blue-300">{opp.engineerInitials}</div>
                        <span className="text-xs text-slate-300">{opp.engineer.split(" ")[0]}</span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <div className="relative h-1.5 w-10 overflow-hidden rounded bg-gray-800">
                          <div className={`absolute left-0 top-0 h-full rounded ${opp.matchScore >= 85 ? "bg-emerald-500" : "bg-blue-500"}`} style={{ width: `${opp.matchScore}%` }} />
                        </div>
                        <span className="tabular-nums text-xs text-slate-300">{opp.matchScore}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={`text-xs font-medium ${availabilityCls[opp.availability]}`}>{opp.availability}</span>
                    </td>
                    <td className="px-4 py-2.5">
                      {opp.complianceReady
                        ? <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                        : <AlertTriangle className="h-4 w-4 text-orange-400" />}
                    </td>
                    <td className="px-4 py-2.5 font-semibold tabular-nums text-xs text-slate-200">{opp.revenue}</td>
                    <td className="px-4 py-2.5 max-w-[200px]">
                      <p className="text-[11px] leading-snug text-slate-400">{opp.response}</p>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Workforce recommendations */}
      <Card className="rounded-xl border border-gray-800 bg-[#141820] shadow-none">
        <CardContent className="p-0">
          <div className="flex items-center justify-between border-b border-gray-800 px-5 py-4">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-blue-400" />
              <span className="text-sm font-semibold text-slate-200">Workforce Recommendations</span>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-gray-800 bg-[#0f1318]">
                  {["Engineer", "Utilisation", "Type", "Recommended Action"].map((h) => (
                    <th key={h} className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {workforceRecs.map((wr, idx) => {
                  const typeCfg = actionTypeCls[wr.actionType];
                  return (
                    <tr key={wr.engineer} className={`border-b border-gray-800/50 ${idx % 2 === 0 ? "bg-[#141820]" : "bg-[#111620]"}`}>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-blue-500/20 text-[10px] font-bold text-blue-300">{wr.initials}</div>
                          <span className="font-medium text-slate-100">{wr.engineer}</span>
                        </div>
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          <div className="relative h-1.5 w-12 overflow-hidden rounded bg-gray-800">
                            <div className={`absolute left-0 top-0 h-full rounded ${wr.utilisation >= 80 ? "bg-blue-500" : wr.utilisation >= 40 ? "bg-yellow-400" : "bg-red-500"}`} style={{ width: `${wr.utilisation}%` }} />
                          </div>
                          <span className="tabular-nums text-xs text-slate-400">{wr.utilisation}%</span>
                        </div>
                      </td>
                      <td className="px-4 py-2.5">
                        <span className={`inline-flex h-auto rounded px-2 py-0.5 text-[10px] font-medium ${typeCfg.bg} ${typeCfg.text}`}>
                          {ACTION_TYPE_LABELS[wr.actionType]}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 max-w-[280px]">
                        <p className="text-[11px] leading-snug text-slate-400">{wr.action}</p>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

    </section>
  );
};
