import {
  Award,
  BookOpen,
  Briefcase,
  Calendar,
  CheckCircle2,
  Clock,
  GraduationCap,
  ShieldCheck,
  Target,
  TrendingUp,
} from "lucide-react";
import { Badge } from "../../components/ui/badge";
import { Card, CardContent } from "../../components/ui/card";

const READINESS = 66;

const COMPLETED_TRAINING = [
  {
    title: "Reliability-Centred Maintenance II",
    provider: "Aladon Network",
    completed: "May 2025",
    category: "Reliability",
  },
  {
    title: "Maintenance Planning & Scheduling",
    provider: "Mobius Institute",
    completed: "November 2024",
    category: "Planning",
  },
  {
    title: "Root Cause Analysis Leader",
    provider: "Reliability Academy",
    completed: "July 2024",
    category: "Problem Solving",
  },
  {
    title: "SAP PM Advanced",
    provider: "SAP Learning",
    completed: "March 2024",
    category: "Systems",
  },
  {
    title: "IOSH Managing Safely",
    provider: "IOSH",
    completed: "October 2023",
    category: "Safety",
  },
  {
    title: "Lean Six Sigma Green Belt",
    provider: "The Manufacturing Institute",
    completed: "June 2023",
    category: "Continuous Improvement",
  },
  {
    title: "Leading High-Performance Maintenance Teams",
    provider: "Engineering Leadership Institute",
    completed: "February 2023",
    category: "Leadership",
  },
  {
    title: "Budgeting & Cost Control for Engineering",
    provider: "Cranfield Executive Development",
    completed: "September 2022",
    category: "Commercial",
  },
];

const CERTIFICATES = [
  {
    name: "IOSH Managing Safely",
    issuer: "IOSH",
    awarded: "October 2023",
    validity: "No expiry",
  },
  {
    name: "Lean Six Sigma Green Belt",
    issuer: "The Manufacturing Institute",
    awarded: "June 2023",
    validity: "No expiry",
  },
  {
    name: "RCM II Practitioner",
    issuer: "Aladon Network",
    awarded: "May 2025",
    validity: "Current",
  },
  {
    name: "SAP S/4HANA Asset Management",
    issuer: "SAP",
    awarded: "March 2024",
    validity: "Current",
  },
];

const REQUIRED_DEVELOPMENT = [
  {
    title: "Certified Maintenance & Reliability Professional",
    provider: "SMRP",
    detail: "Professional certification covering business, reliability, organisation, work management and manufacturing process reliability.",
    duration: "12–16 weeks",
    contribution: 10,
    priority: "High",
  },
  {
    title: "ISO 55001 Asset Management Lead Implementer",
    provider: "Approved ISO training partner",
    detail: "Build the governance and asset-management-system capability required for director-level accountability.",
    duration: "5 days",
    contribution: 8,
    priority: "High",
  },
  {
    title: "Finance for Senior Engineering Leaders",
    provider: "Executive education",
    detail: "Strengthen capital allocation, lifecycle cost, investment appraisal and board-level financial decision making.",
    duration: "6 weeks",
    contribution: 8,
    priority: "Medium",
  },
  {
    title: "Strategic Leadership & Organisational Change",
    provider: "Executive education",
    detail: "Develop enterprise leadership, transformation governance and executive stakeholder influence.",
    duration: "8 weeks",
    contribution: 8,
    priority: "Medium",
  },
];

const READINESS_BREAKDOWN = [
  { label: "Maintenance leadership", value: 82 },
  { label: "Reliability strategy", value: 76 },
  { label: "Asset management governance", value: 58 },
  { label: "Commercial & financial leadership", value: 48 },
  { label: "Executive influence", value: 64 },
];

function readinessBarClass(value: number): string {
  if (value >= 75) return "bg-emerald-500";
  if (value >= 60) return "bg-blue-500";
  return "bg-amber-400";
}

function priorityClass(priority: string): string {
  return priority === "High"
    ? "border-orange-500/20 bg-orange-500/10 text-orange-300"
    : "border-blue-500/20 bg-blue-500/10 text-blue-300";
}

function SummaryCard({
  icon: Icon,
  label,
  value,
  detail,
}: {
  icon: typeof Award;
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <Card className="rounded-xl border border-gray-800 bg-[#141820] shadow-none">
      <CardContent className="flex items-start gap-3 p-4">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-500/10">
          <Icon className="h-4 w-4 text-blue-400" />
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
            {label}
          </p>
          <p className="mt-1 text-xl font-bold text-slate-50">{value}</p>
          <p className="mt-0.5 text-xs text-slate-500">{detail}</p>
        </div>
      </CardContent>
    </Card>
  );
}

export const CareerSection = (): JSX.Element => (
  <section className="relative flex min-w-0 w-full max-w-full flex-1 grow flex-col gap-6 overflow-x-hidden px-4 pb-12 pt-0 md:gap-8 md:px-6 xl:px-8">
    <header className="flex w-full flex-col justify-between gap-4 py-5 lg:flex-row lg:items-center">
      <div className="flex flex-col items-start gap-1">
        <p className="text-xs font-medium text-slate-500">Maintenance leadership</p>
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold tracking-tight text-slate-50">My Career</h1>
          <Badge className="h-auto rounded border border-blue-500/20 bg-blue-500/10 px-2 py-0.5 text-[10px] font-bold text-blue-300 shadow-none">
            Management Track
          </Badge>
        </div>
        <p className="text-sm text-slate-400">
          Track completed development and close the eligibility gap to your next leadership role.
        </p>
      </div>
      <div className="rounded-lg border border-gray-800 bg-[#10141b] px-4 py-2.5 text-right">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
          Career profile
        </p>
        <p className="mt-0.5 text-sm font-semibold text-slate-200">Dallas Clark</p>
      </div>
    </header>

    <Card className="overflow-hidden rounded-xl border border-gray-800 bg-[#141820] shadow-none">
      <CardContent className="p-4 md:p-6">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
              Leadership progression
            </p>
            <h2 className="mt-1 text-lg font-bold text-slate-50">
              Maintenance leadership pathway
            </h2>
          </div>
          <div className="text-right">
            <p className="text-3xl font-bold text-amber-400">{READINESS}%</p>
            <p className="text-xs font-medium text-slate-400">ready for next role</p>
          </div>
        </div>

        <div className="overflow-x-auto pb-2">
          <div className="flex min-w-[780px] items-stretch">
            <div className="w-[260px] shrink-0 rounded-xl border border-blue-500/30 bg-blue-500/10 p-5">
              <div className="flex items-center justify-between">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-500/15">
                  <Briefcase className="h-4 w-4 text-blue-300" />
                </div>
                <Badge className="h-auto rounded bg-blue-500/15 px-2 py-0.5 text-[9px] font-bold text-blue-300 shadow-none">
                  Current
                </Badge>
              </div>
              <p className="mt-5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                Current position
              </p>
              <h3 className="mt-1 text-lg font-bold text-slate-50">Maintenance Manager</h3>
              <p className="mt-2 text-xs leading-5 text-slate-400">
                Site maintenance delivery, team capability, safety, cost and equipment reliability.
              </p>
            </div>

            <div className="relative flex min-w-[260px] flex-1 items-center px-6">
              <div className="relative h-2 w-full overflow-hidden rounded-full bg-gray-800">
                <div className="h-full rounded-full bg-gradient-to-r from-amber-600 to-amber-400" style={{ width: `${READINESS}%` }} />
              </div>
              <div
                className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2"
                style={{ left: `${READINESS}%` }}
              >
                <div className="flex h-11 w-11 items-center justify-center rounded-full border-4 border-[#141820] bg-amber-500 text-xs font-bold text-slate-950 shadow-[0_0_24px_rgba(245,158,11,0.4)]">
                  {READINESS}%
                </div>
              </div>
              <span className="absolute bottom-5 left-6 text-[10px] font-medium text-slate-500">
                Current capability
              </span>
              <span className="absolute bottom-5 right-6 text-[10px] font-medium text-slate-500">
                Full eligibility
              </span>
            </div>

            <div className="w-[280px] shrink-0 rounded-xl border border-violet-500/30 bg-violet-500/10 p-5">
              <div className="flex items-center justify-between">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-500/15">
                  <Target className="h-4 w-4 text-violet-300" />
                </div>
                <Badge className="h-auto rounded bg-violet-500/15 px-2 py-0.5 text-[9px] font-bold text-violet-300 shadow-none">
                  Next role
                </Badge>
              </div>
              <p className="mt-5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                Target position
              </p>
              <h3 className="mt-1 text-lg font-bold text-slate-50">
                Maintenance & Reliability Director
              </h3>
              <p className="mt-2 text-xs leading-5 text-slate-400">
                Enterprise reliability strategy, asset governance, investment and organisational leadership.
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>

    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <SummaryCard icon={BookOpen} label="Training completed" value="8" detail="Across six capability areas" />
      <SummaryCard icon={Award} label="Certificates held" value="4" detail="All currently valid" />
      <SummaryCard icon={Target} label="Requirements remaining" value="4" detail="34% eligibility gap" />
      <SummaryCard icon={Clock} label="Estimated timeframe" value="9–12 months" detail="With planned development" />
    </div>

    <div className="grid gap-4 xl:grid-cols-[1.35fr_0.65fr]">
      <Card className="rounded-xl border border-gray-800 bg-[#141820] shadow-none">
        <CardContent className="p-0">
          <div className="flex items-center justify-between border-b border-gray-800 px-5 py-4">
            <div className="flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-blue-400" />
              <h2 className="text-sm font-semibold text-slate-100">Completed training</h2>
            </div>
            <span className="text-xs text-slate-500">{COMPLETED_TRAINING.length} records</span>
          </div>
          <div className="divide-y divide-gray-800">
            {COMPLETED_TRAINING.map((training) => (
              <div key={training.title} className="grid gap-3 px-5 py-3.5 sm:grid-cols-[1fr_auto] sm:items-center">
                <div className="flex min-w-0 gap-3">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-200">{training.title}</p>
                    <p className="mt-0.5 text-xs text-slate-500">{training.provider}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 pl-7 sm:pl-0">
                  <Badge className="h-auto rounded bg-slate-500/10 px-2 py-0.5 text-[9px] font-medium text-slate-400 shadow-none">
                    {training.category}
                  </Badge>
                  <span className="w-24 text-right text-xs text-slate-500">{training.completed}</span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-xl border border-gray-800 bg-[#141820] shadow-none">
        <CardContent className="p-5">
          <div className="mb-5 flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-blue-400" />
            <h2 className="text-sm font-semibold text-slate-100">Readiness breakdown</h2>
          </div>
          <div className="space-y-5">
            {READINESS_BREAKDOWN.map((item) => (
              <div key={item.label}>
                <div className="mb-1.5 flex items-center justify-between gap-3">
                  <span className="text-xs font-medium text-slate-400">{item.label}</span>
                  <span className="text-xs font-bold text-slate-200">{item.value}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-gray-800">
                  <div className={`h-full rounded-full ${readinessBarClass(item.value)}`} style={{ width: `${item.value}%` }} />
                </div>
              </div>
            ))}
          </div>
          <div className="mt-6 rounded-lg border border-blue-500/20 bg-blue-500/5 p-4">
            <p className="text-xs font-semibold text-blue-300">Strongest evidence</p>
            <p className="mt-1 text-xs leading-5 text-slate-400">
              Maintenance leadership and reliability strategy already meet the expected director-level threshold.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>

    <Card className="rounded-xl border border-gray-800 bg-[#141820] shadow-none">
      <CardContent className="p-0">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-800 px-5 py-4">
          <div className="flex items-center gap-2">
            <Award className="h-4 w-4 text-emerald-400" />
            <h2 className="text-sm font-semibold text-slate-100">Training certificates</h2>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-emerald-400">
            <ShieldCheck className="h-3.5 w-3.5" />
            All credentials current
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[680px] text-left">
            <thead className="border-b border-gray-800 bg-[#10141b] text-[10px] uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-5 py-3 font-semibold">Certificate</th>
                <th className="px-4 py-3 font-semibold">Issuer</th>
                <th className="px-4 py-3 font-semibold">Awarded</th>
                <th className="px-4 py-3 font-semibold">Validity</th>
                <th className="px-5 py-3 text-right font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {CERTIFICATES.map((certificate) => (
                <tr key={certificate.name} className="border-b border-gray-800 last:border-0">
                  <td className="px-5 py-3.5 text-sm font-semibold text-slate-200">{certificate.name}</td>
                  <td className="px-4 py-3.5 text-xs text-slate-400">{certificate.issuer}</td>
                  <td className="px-4 py-3.5 text-xs text-slate-400">{certificate.awarded}</td>
                  <td className="px-4 py-3.5 text-xs text-slate-400">{certificate.validity}</td>
                  <td className="px-5 py-3.5 text-right">
                    <Badge className="h-auto rounded bg-emerald-500/10 px-2 py-0.5 text-[9px] font-bold text-emerald-300 shadow-none">
                      Current
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>

    <Card className="rounded-xl border border-amber-500/20 bg-[#141820] shadow-none">
      <CardContent className="p-0">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-800 px-5 py-4">
          <div>
            <div className="flex items-center gap-2">
              <GraduationCap className="h-4 w-4 text-amber-400" />
              <h2 className="text-sm font-semibold text-slate-100">Required development for 100% eligibility</h2>
            </div>
            <p className="mt-1 text-xs text-slate-500">Complete all four requirements to close the remaining 34% readiness gap.</p>
          </div>
          <Badge className="h-auto rounded border border-amber-500/20 bg-amber-500/10 px-2 py-1 text-[10px] font-bold text-amber-300 shadow-none">
            4 remaining
          </Badge>
        </div>
        <div className="divide-y divide-gray-800">
          {REQUIRED_DEVELOPMENT.map((requirement, index) => (
            <div key={requirement.title} className="grid gap-4 px-5 py-5 lg:grid-cols-[auto_1fr_auto] lg:items-center">
              <div className="flex h-9 w-9 items-center justify-center rounded-full border border-amber-500/20 bg-amber-500/10 text-xs font-bold text-amber-300">
                {index + 1}
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-sm font-semibold text-slate-100">{requirement.title}</h3>
                  <Badge className={`h-auto rounded border px-2 py-0.5 text-[9px] font-bold shadow-none ${priorityClass(requirement.priority)}`}>
                    {requirement.priority} priority
                  </Badge>
                </div>
                <p className="mt-1 text-xs text-slate-500">{requirement.provider}</p>
                <p className="mt-2 max-w-3xl text-xs leading-5 text-slate-400">{requirement.detail}</p>
              </div>
              <div className="flex items-center gap-5 lg:justify-end">
                <div>
                  <p className="flex items-center gap-1 text-[10px] font-medium text-slate-500">
                    <Calendar className="h-3 w-3" /> Duration
                  </p>
                  <p className="mt-1 text-xs font-semibold text-slate-300">{requirement.duration}</p>
                </div>
                <div className="min-w-16 text-right">
                  <p className="text-[10px] font-medium text-slate-500">Readiness</p>
                  <p className="mt-1 text-sm font-bold text-emerald-400">+{requirement.contribution}%</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>

    <p className="text-[11px] leading-5 text-slate-600">
      Career readiness is a development-planning view. It does not represent a promotion decision or live HR-system eligibility.
    </p>
  </section>
);

