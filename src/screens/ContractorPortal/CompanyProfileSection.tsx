import {
  AlertTriangle,
  Award,
  Brain,
  Building2,
  CheckCircle2,
  Clock,
  FileText,
  Globe,
  Mail,
  MapPin,
  Phone,
  ShieldCheck,
  Sparkles,
  Star,
  TrendingUp,
  Users,
  Wrench,
  Zap,
} from "lucide-react";
import { Badge } from "../../components/ui/badge";
import { Card, CardContent } from "../../components/ui/card";
import { AiActionsPanel, AiAction } from "../../components/AiActionsPanel";
import { SyncIndicator } from "../../components/SyncIndicator";
import { ExplainWithAi } from "../../components/ExplainWithAi";

// ─── Mock data ────────────────────────────────────────────────────────────────

const company = {
  name:               "Apex Industrial Services Ltd",
  type:               "Multi-discipline Contractor",
  contact:            "Marcus Webb",
  email:              "marcus.webb@apexindustrial.co.uk",
  phone:              "+44 7700 900142",
  location:           "Leeds, West Yorkshire",
  serviceRegion:      "North of England",
  verified:           true,
  marketplace:        "Active",
  founded:            "2009",
  vatNumber:          "GB 123 4567 89",
  description:        "Specialist multi-discipline industrial maintenance contractor with 17 years of experience supporting food & beverage, FMCG and chemical processing plants across Northern England.",
};

const stats = [
  { label: "Engineers Listed",       value: "24",  icon: Users,     valueClass: "text-slate-50"    },
  { label: "Verified Skills",        value: "87",  icon: Award,     valueClass: "text-blue-400"    },
  { label: "Active Certifications",  value: "112", icon: ShieldCheck,valueClass: "text-emerald-400" },
  { label: "Service Regions",        value: "3",   icon: MapPin,    valueClass: "text-slate-50"    },
  { label: "Avg Response Time",      value: "4h",  icon: Clock,     valueClass: "text-emerald-400" },
  { label: "Assignment Success",     value: "96%", icon: Star,      valueClass: "text-emerald-400" },
];

const services = [
  { label: "Breakdown Support",        active: true  },
  { label: "Planned Maintenance",       active: true  },
  { label: "Shutdown Support",          active: true  },
  { label: "PLC / Automation",          active: true  },
  { label: "Mechanical Support",        active: true  },
  { label: "Electrical Support",        active: true  },
  { label: "Project Engineering",       active: true  },
  { label: "Remote Technical Support",  active: false },
  { label: "Hydraulics & Pneumatics",   active: true  },
  { label: "HVAC / Refrigeration",      active: false },
  { label: "Instrumentation",           active: true  },
  { label: "Welding & Fabrication",     active: false },
];

const coverage = [
  { label: "Primary Region",             value: "Yorkshire & Humber"  },
  { label: "Secondary Regions",          value: "North West, North East" },
  { label: "Travel Radius",              value: "Up to 150 miles"     },
  { label: "Emergency Callout",          value: "24/7 available",       status: "good"    },
  { label: "Weekend Availability",       value: "Yes — weekend premium", status: "good"    },
  { label: "Night Shifts",               value: "Yes — 12-hr shifts",    status: "good"    },
  { label: "Typical Mobilisation",       value: "4–8 hours",             status: "neutral" },
];

const compliance = [
  { label: "Public Liability Insurance",  value: "£10m cover",            expiry: "31 Mar 2027", status: "valid"    },
  { label: "Employers Liability",          value: "£5m cover",             expiry: "31 Mar 2027", status: "valid"    },
  { label: "RAMS Available",              value: "Template library",       expiry: null,          status: "valid"    },
  { label: "Site Induction Docs",         value: "8 site packs",           expiry: null,          status: "valid"    },
  { label: "ISO 9001 Quality",            value: "Certified",              expiry: "14 Nov 2026", status: "expiring" },
  { label: "Health & Safety Policy",      value: "Current",                expiry: "01 Jan 2027", status: "valid"    },
  { label: "COSHH Assessment",            value: "Not uploaded",           expiry: null,          status: "missing"  },
  { label: "Construction Phase Plan",     value: "Not applicable",         expiry: null,          status: "neutral"  },
];

const aiActions: AiAction[] = [
  { label: "Upload COSHH assessment",               description: "COSHH documentation is missing. Some manufacturing clients require this before awarding contracts.",     priority: "high",     icon: FileText      },
  { label: "Add remote technical support capability", description: "3 open opportunities requiring remote support are currently not visible to you. Enable this service.",  priority: "medium",   icon: Globe         },
  { label: "Improve automation engineer certifications", description: "Your PLC coverage has only 4 certified engineers. Adding 2 more would increase win rate by ~18%.",   priority: "medium",   icon: Brain         },
  { label: "Renew ISO 9001 before November",         description: "ISO 9001 expires 14 Nov 2026 — start renewal 6 weeks in advance to avoid marketplace listing impact.",   priority: "high",     icon: TrendingUp    },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const complianceBadge: Record<string, { cls: string; label: string }> = {
  valid:    { cls: "bg-[#10b98120] text-emerald-400",  label: "Valid"    },
  expiring: { cls: "bg-[#facc1520] text-yellow-400",   label: "Expiring" },
  missing:  { cls: "bg-[#ef444420] text-red-400",      label: "Missing"  },
  neutral:  { cls: "bg-[#ffffff0f] text-slate-400",    label: "N/A"      },
};

const coverageIcon: Record<string, string> = {
  good:    "text-emerald-400",
  neutral: "text-slate-400",
};

// ─── Main ─────────────────────────────────────────────────────────────────────

export const CompanyProfileSection = (): JSX.Element => (
  <section className="flex min-w-0 w-full flex-col gap-6 px-4 pb-16 pt-0 md:px-6 xl:px-8">

    {/* Header */}
    <header className="flex w-full flex-col justify-between gap-4 py-5 lg:flex-row lg:items-start">
      <div>
        <p className="text-xs font-medium text-slate-500">Contractor Portal</p>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <h1 className="text-xl font-semibold text-slate-50">Company Profile</h1>
          <Badge className="inline-flex h-auto items-center gap-1.5 rounded bg-[#10b98120] px-2 py-1 text-xs font-medium text-emerald-400 shadow-none">
            <CheckCircle2 className="h-3 w-3" />Verified Contractor
          </Badge>
          <Badge className="inline-flex h-auto items-center gap-1.5 rounded bg-[#3b82f620] px-2 py-1 text-xs font-medium text-blue-400 shadow-none">
            <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />Marketplace Active
          </Badge>
        </div>
        <p className="mt-1 text-sm text-slate-400">Manage your company details, capabilities and Vorta marketplace presence.</p>
      </div>
      <div className="flex shrink-0 items-center">
        <SyncIndicator source="Vorta" confidence={94} syncedAt={new Date(Date.now() - 180000)} />
        <ExplainWithAi pageId="contractor-company-profile" />
      </div>
    </header>

    {/* Top row — overview + capability stats */}
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">

      {/* Company overview */}
      <Card className="xl:col-span-2 rounded-xl border border-gray-800 bg-[#141820] shadow-none">
        <CardContent className="p-5">
          <div className="mb-4 flex items-center gap-2 border-b border-gray-800 pb-4">
            <Building2 className="h-4 w-4 text-blue-400" />
            <span className="text-sm font-semibold text-slate-200">Company Overview</span>
          </div>
          <div className="flex items-start gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-blue-500/20 text-xl font-bold text-blue-300">
              {company.name.split(" ").slice(0, 2).map((w) => w[0]).join("")}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-base font-semibold text-slate-50">{company.name}</p>
              <p className="text-sm text-slate-400">{company.type}</p>
              <p className="mt-2 text-xs leading-relaxed text-slate-500">{company.description}</p>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {[
              { icon: Users,   label: "Primary Contact", value: company.contact  },
              { icon: Mail,    label: "Email",           value: company.email    },
              { icon: Phone,   label: "Phone",           value: company.phone    },
              { icon: MapPin,  label: "Location",        value: company.location },
              { icon: Globe,   label: "Service Region",  value: company.serviceRegion },
              { icon: Award,   label: "Founded",         value: company.founded  },
            ].map(({ icon: Icon, label, value }) => (
              <div key={label} className="flex items-start gap-2.5 rounded-lg border border-gray-800 bg-[#0f1318] px-3 py-2.5">
                <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-600" />
                <div className="min-w-0">
                  <p className="text-[10px] font-medium uppercase tracking-wider text-slate-600">{label}</p>
                  <p className="truncate text-xs font-medium text-slate-300">{value}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Capability stats */}
      <Card className="rounded-xl border border-gray-800 bg-[#141820] shadow-none">
        <CardContent className="p-5">
          <div className="mb-4 flex items-center gap-2 border-b border-gray-800 pb-4">
            <Sparkles className="h-4 w-4 text-blue-400" />
            <span className="text-sm font-semibold text-slate-200">Capability Summary</span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {stats.map(({ label, value, icon: Icon, valueClass }) => (
              <div key={label} className="flex flex-col gap-2 rounded-lg border border-gray-800 bg-[#0f1318] p-3">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-medium uppercase tracking-wider text-slate-600">{label}</p>
                  <Icon className="h-3.5 w-3.5 text-slate-700" />
                </div>
                <p className={`text-xl font-semibold tabular-nums ${valueClass}`}>{value}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>

    {/* Services + Coverage */}
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">

      {/* Services offered */}
      <Card className="rounded-xl border border-gray-800 bg-[#141820] shadow-none">
        <CardContent className="p-5">
          <div className="mb-4 flex items-center justify-between border-b border-gray-800 pb-4">
            <div className="flex items-center gap-2">
              <Wrench className="h-4 w-4 text-blue-400" />
              <span className="text-sm font-semibold text-slate-200">Services Offered</span>
            </div>
            <span className="text-[11px] text-slate-500">
              {services.filter((s) => s.active).length} of {services.length} active
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {services.map(({ label, active }) => (
              <span
                key={label}
                className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors ${
                  active
                    ? "border-blue-500/25 bg-[#3b82f610] text-blue-300"
                    : "border-gray-800 bg-[#0f1318] text-slate-600"
                }`}
              >
                {active
                  ? <CheckCircle2 className="h-3 w-3 text-blue-400" />
                  : <span className="h-3 w-3 rounded-full border border-slate-700" />}
                {label}
              </span>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Coverage and availability */}
      <Card className="rounded-xl border border-gray-800 bg-[#141820] shadow-none">
        <CardContent className="p-5">
          <div className="mb-4 flex items-center gap-2 border-b border-gray-800 pb-4">
            <MapPin className="h-4 w-4 text-blue-400" />
            <span className="text-sm font-semibold text-slate-200">Coverage &amp; Availability</span>
          </div>
          <div className="flex flex-col divide-y divide-gray-800/60">
            {coverage.map(({ label, value, status }) => (
              <div key={label} className="flex items-center justify-between py-2.5 first:pt-0 last:pb-0">
                <p className="text-xs font-medium text-slate-400">{label}</p>
                <div className="flex items-center gap-2">
                  {status === "good" && <Zap className={`h-3 w-3 ${coverageIcon.good}`} />}
                  <p className={`text-xs font-medium ${status === "good" ? "text-emerald-400" : "text-slate-300"}`}>
                    {value}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>

    {/* Compliance + Marketplace preview */}
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">

      {/* Compliance profile */}
      <Card className="xl:col-span-2 rounded-xl border border-gray-800 bg-[#141820] shadow-none">
        <CardContent className="p-0">
          <div className="flex items-center justify-between border-b border-gray-800 px-5 py-4">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-blue-400" />
              <span className="text-sm font-semibold text-slate-200">Compliance Profile</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-slate-500">
                {compliance.filter((c) => c.status === "valid").length}/{compliance.length} compliant
              </span>
              {compliance.some((c) => c.status === "missing" || c.status === "expiring") && (
                <Badge className="inline-flex h-auto rounded bg-[#facc1520] px-2 py-0.5 text-[10px] font-medium text-yellow-400 shadow-none">
                  Action needed
                </Badge>
              )}
            </div>
          </div>
          <div className="w-full overflow-x-auto">
            <table className="w-full min-w-[480px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-gray-800 bg-[#0f1318]">
                  {["Document / Certification", "Details", "Expiry", "Status"].map((h) => (
                    <th key={h} className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {compliance.map((c, idx) => {
                  const badge = complianceBadge[c.status];
                  return (
                    <tr key={c.label} className={`border-b border-gray-800/50 transition-colors hover:bg-[#1a2030] ${idx % 2 === 0 ? "bg-[#141820]" : "bg-[#111620]"}`}>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          {c.status === "missing"
                            ? <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-red-400" />
                            : c.status === "expiring"
                            ? <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-yellow-400" />
                            : <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-500" />}
                          <span className="font-medium text-slate-200">{c.label}</span>
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-slate-400">{c.value}</td>
                      <td className="px-4 py-2.5 text-slate-500 tabular-nums">{c.expiry ?? "—"}</td>
                      <td className="px-4 py-2.5">
                        <Badge className={`inline-flex h-auto rounded px-2 py-0.5 text-[10px] font-medium shadow-none ${badge.cls}`}>
                          {badge.label}
                        </Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Marketplace preview */}
      <Card className="rounded-xl border border-gray-800 bg-[#141820] shadow-none">
        <CardContent className="p-5">
          <div className="mb-4 flex items-center gap-2 border-b border-gray-800 pb-4">
            <Globe className="h-4 w-4 text-blue-400" />
            <span className="text-sm font-semibold text-slate-200">Marketplace Preview</span>
          </div>
          <p className="mb-3 text-[11px] font-medium uppercase tracking-wider text-slate-500">How sites see you</p>

          {/* Preview card */}
          <div className="rounded-lg border border-[#3b82f625] bg-[#0d1523] p-4">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-500/20 text-sm font-bold text-blue-300">
                {company.name.split(" ").slice(0, 2).map((w) => w[0]).join("")}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <p className="text-sm font-semibold text-slate-100">{company.name}</p>
                  <Badge className="inline-flex h-auto rounded bg-[#10b98120] px-1.5 py-0.5 text-[9px] font-medium text-emerald-400 shadow-none">
                    Verified
                  </Badge>
                </div>
                <p className="mt-0.5 text-[11px] text-slate-400">{company.type} · {company.serviceRegion}</p>
              </div>
            </div>
            <p className="mt-3 text-[11px] leading-relaxed text-slate-500 line-clamp-3">{company.description}</p>
            <div className="mt-3 flex flex-wrap gap-1">
              {["PLC/Automation", "Electrical", "Breakdown", "Planned Maint."].map((cap) => (
                <span key={cap} className="rounded bg-blue-500/15 px-1.5 py-0.5 text-[10px] font-medium text-blue-400">{cap}</span>
              ))}
            </div>
            <div className="mt-3 flex items-center justify-between border-t border-gray-800/60 pt-3 text-[11px]">
              <span className="flex items-center gap-1 text-emerald-400">
                <Clock className="h-3 w-3" />4h response
              </span>
              <span className="flex items-center gap-1 text-yellow-400">
                <Star className="h-3 w-3 fill-yellow-400" />96% success
              </span>
              <span className="text-slate-500">24 engineers</span>
            </div>
          </div>

          <p className="mt-3 text-[10px] leading-relaxed text-slate-600">
            This is how your profile appears to manufacturing sites searching the Vorta marketplace. Keep compliance and certifications current to maintain visibility.
          </p>
        </CardContent>
      </Card>
    </div>

    {/* AI recommendations */}
    <AiActionsPanel actions={aiActions} />

  </section>
);
