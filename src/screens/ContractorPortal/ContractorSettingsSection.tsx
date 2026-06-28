import { useState } from "react";
import {
  Bell,
  Brain,
  Building2,
  CheckCircle2,
  Clock,
  Eye,
  Lock,
  Save,
  Settings,
  ShieldCheck,
  Store,
  Users,
  Zap,
} from "lucide-react";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Card, CardContent } from "../../components/ui/card";
import { SyncIndicator } from "../../components/SyncIndicator";

// ─── Types ────────────────────────────────────────────────────────────────────

type UserRole   = "Contractor Owner" | "Operations Manager" | "Administrator" | "Contractor Engineer";
type UserStatus = "Active" | "Invited" | "Inactive";

interface PortalUser {
  name: string;
  initials: string;
  role: UserRole;
  email: string;
  accessLevel: "Full" | "Limited" | "Read Only";
  status: UserStatus;
  lastActive: string;
}

interface ToggleSetting {
  label: string;
  description: string;
  enabled: boolean;
}

// ─── Mock data ────────────────────────────────────────────────────────────────

const portalUsers: PortalUser[] = [
  { name: "Sarah Mitchell", initials: "SM", role: "Contractor Owner",    email: "sarah@vortaelectrical.co.uk",   accessLevel: "Full",      status: "Active",  lastActive: "Today"    },
  { name: "Mark Davies",    initials: "MD", role: "Operations Manager",  email: "mark@vortaelectrical.co.uk",    accessLevel: "Full",      status: "Active",  lastActive: "Today"    },
  { name: "Lisa Patel",     initials: "LP", role: "Administrator",       email: "lisa@vortaelectrical.co.uk",    accessLevel: "Limited",   status: "Active",  lastActive: "3 days ago" },
  { name: "Tom Briggs",     initials: "TB", role: "Contractor Engineer", email: "tom@vortaelectrical.co.uk",     accessLevel: "Read Only", status: "Active",  lastActive: "Today"    },
  { name: "James Patel",    initials: "JP", role: "Contractor Engineer", email: "james@vortaelectrical.co.uk",   accessLevel: "Read Only", status: "Active",  lastActive: "Yesterday" },
  { name: "Raj Kumar",      initials: "RK", role: "Contractor Engineer", email: "raj@vortaelectrical.co.uk",     accessLevel: "Read Only", status: "Active",  lastActive: "2 days ago" },
  { name: "Dan Hurst",      initials: "DH", role: "Contractor Engineer", email: "dan@vortaelectrical.co.uk",     accessLevel: "Read Only", status: "Active",  lastActive: "4 days ago" },
  { name: "Amy Clarke",     initials: "AC", role: "Contractor Engineer", email: "amy@vortaelectrical.co.uk",     accessLevel: "Read Only", status: "Invited", lastActive: "—"        },
];

const COMPANY_FIELDS = [
  { label: "Company Display Name",    value: "Vorta Electrical Ltd"       },
  { label: "Primary Contact",         value: "Sarah Mitchell"             },
  { label: "Contact Email",           value: "sarah@vortaelectrical.co.uk" },
  { label: "Phone",                   value: "+44 7890 123456"            },
  { label: "Service Region",          value: "North West, Scotland, Midlands" },
  { label: "Default Mobilisation",    value: "24 hours"                   },
];

// ─── Toggle sections ──────────────────────────────────────────────────────────

const useToggles = (initial: ToggleSetting[]) => {
  const [items, setItems] = useState(initial);
  const toggle = (idx: number) =>
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, enabled: !it.enabled } : it)));
  return [items, toggle] as const;
};

const NOTIF_INITIAL: ToggleSetting[] = [
  { label: "New opportunity alerts",     description: "Get notified when new matching opportunities are posted",              enabled: true  },
  { label: "Assignment updates",         description: "Status changes, customer feedback and assignment approvals",           enabled: true  },
  { label: "Compliance expiry alerts",   description: "Early warnings when certifications or documents are approaching expiry", enabled: true  },
  { label: "Timesheet reminders",        description: "Weekly reminders when engineer timesheets are pending",               enabled: true  },
  { label: "Invoice blockers",           description: "Alerts when invoices are blocked by missing approvals",               enabled: true  },
  { label: "AI recommendations",        description: "Vorta AI surface high-priority actions to your dashboard",             enabled: true  },
  { label: "Weekly performance summary", description: "Sunday digest of utilisation, revenue and compliance status",         enabled: false },
];

const MARKETPLACE_INITIAL: ToggleSetting[] = [
  { label: "Visible to manufacturing sites",      description: "Allow sites to find and shortlist your company",        enabled: true  },
  { label: "Available for emergency breakdowns",  description: "Accept emergency and rapid-response callouts",         enabled: true  },
  { label: "Available for planned maintenance",   description: "Accept scheduled PM and inspection work",              enabled: true  },
  { label: "Available for shutdown work",         description: "Accept annual shutdown and overhaul assignments",      enabled: false },
  { label: "Remote support available",            description: "Offer remote troubleshooting and diagnostics",        enabled: true  },
];

const AI_INITIAL: ToggleSetting[] = [
  { label: "AI recommendations enabled",    description: "Surface prioritised actions from Vorta intelligence",        enabled: true  },
  { label: "Opportunity matching enabled",  description: "Auto-rank open opportunities by engineer fit",              enabled: true  },
  { label: "Compliance risk detection",     description: "Proactively flag expiry and documentation risks",           enabled: true  },
  { label: "Utilisation suggestions",       description: "Identify under-utilised engineers and suggest actions",     enabled: true  },
  { label: "Revenue forecasting enabled",   description: "Estimate monthly revenue from pipeline and assignments",    enabled: false },
];

const DATA_ITEMS = [
  { label: "Role-based access enabled",         status: "emerald" as const, note: "Active"                  },
  { label: "Supabase RLS protection",           status: "emerald" as const, note: "Enforced"                },
  { label: "Audit trail enabled",               status: "emerald" as const, note: "All actions logged"      },
  { label: "Session management",                status: "emerald" as const, note: "Secure"                  },
  { label: "Document visibility rules",         status: "yellow"  as const, note: "Review recommended"      },
  { label: "Engineer profile visibility",       status: "yellow"  as const, note: "Pending configuration"   },
];

const SETTINGS_ACTIONS = [
  { text: "Invite a second admin user to avoid single-point dependency",                       urgency: "medium"   },
  { text: "Confirm marketplace visibility is set to active before next requirement goes live", urgency: "medium"   },
  { text: "Review notification settings for new admins — defaults may not be optimal",        urgency: "low"      },
  { text: "Configure engineer profile visibility rules for marketplace exposure",              urgency: "high"     },
  { text: "Confirm compliance document visibility — ensure only verified docs are shared",     urgency: "medium"   },
];

// ─── Config maps ──────────────────────────────────────────────────────────────

const roleCls: Record<UserRole, string> = {
  "Contractor Owner":    "bg-[#3b82f620] text-blue-400",
  "Operations Manager":  "bg-[#10b98120] text-emerald-400",
  "Administrator":       "bg-[#facc1520] text-yellow-400",
  "Contractor Engineer": "bg-[#ffffff0f] text-slate-400",
};

const accessCls: Record<PortalUser["accessLevel"], string> = {
  "Full":      "text-emerald-400",
  "Limited":   "text-yellow-400",
  "Read Only": "text-slate-400",
};

const statusCls: Record<UserStatus, string> = {
  "Active":  "bg-[#10b98120] text-emerald-400",
  "Invited": "bg-[#facc1520] text-yellow-400",
  "Inactive":"bg-[#ffffff0f] text-slate-500",
};

const urgencyCls: Record<string, string> = {
  high:   "text-orange-400",
  medium: "text-yellow-400",
  low:    "text-slate-400",
};

const dataStatusCls: Record<"emerald" | "yellow", string> = {
  emerald: "text-emerald-400",
  yellow:  "text-yellow-400",
};

// ─── Reusable toggle row ──────────────────────────────────────────────────────

function ToggleRow({ item, onToggle }: { item: ToggleSetting; onToggle: () => void }) {
  return (
    <div className="flex items-center justify-between border-b border-gray-800/60 py-3 last:border-b-0">
      <div>
        <p className="text-sm font-medium text-slate-200">{item.label}</p>
        <p className="text-[11px] text-slate-500">{item.description}</p>
      </div>
      <button
        type="button"
        onClick={onToggle}
        className={`relative ml-4 h-5 w-9 shrink-0 rounded-full transition-colors ${item.enabled ? "bg-blue-600" : "bg-gray-700"}`}
        aria-pressed={item.enabled}
      >
        <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${item.enabled ? "translate-x-4" : "translate-x-0.5"}`} />
      </button>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export const ContractorSettingsSection = (): JSX.Element => {
  const [notifs,      toggleNotif]      = useToggles(NOTIF_INITIAL);
  const [marketplace, toggleMarketplace] = useToggles(MARKETPLACE_INITIAL);
  const [aiSettings,  toggleAi]         = useToggles(AI_INITIAL);
  const [aiThreshold, setAiThreshold]   = useState(75);

  const activeUsers = portalUsers.filter((u) => u.status === "Active").length;
  const adminCount  = portalUsers.filter((u) => u.role === "Contractor Owner" || u.role === "Administrator").length;
  const notifsOn    = notifs.filter((n) => n.enabled).length;

  const kpis = [
    { label: "Active Users",          value: String(activeUsers),              valueClass: "text-blue-400",    icon: Users      },
    { label: "Admins",                value: String(adminCount),               valueClass: "text-emerald-400", icon: ShieldCheck },
    { label: "Marketplace Status",    value: "Active",                         valueClass: "text-emerald-400", icon: Store      },
    { label: "Notifications Enabled", value: `${notifsOn}/${notifs.length}`,   valueClass: "text-blue-400",    icon: Bell       },
  ];

  return (
    <section className="flex min-w-0 w-full flex-col gap-6 px-4 pb-16 pt-0 md:px-6 xl:px-8">

      {/* Header */}
      <header className="flex w-full flex-col justify-between gap-4 py-5 lg:flex-row lg:items-start">
        <div>
          <p className="text-xs font-medium text-slate-500">Contractor Portal</p>
          <h1 className="mt-1 text-xl font-semibold text-slate-50">Settings</h1>
          <p className="mt-1 text-sm text-slate-400">Manage contractor portal preferences, permissions and marketplace configuration.</p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-3">
          <SyncIndicator source="Vorta" confidence={100} syncedAt={new Date(Date.now() - 30000)} />
          <Button className="bg-blue-600 text-white hover:bg-blue-500">
            <Save className="h-4 w-4" />Save Changes
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

      {/* Two-column layout for company + notifications */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">

        {/* Company settings */}
        <Card className="rounded-xl border border-gray-800 bg-[#141820] shadow-none">
          <CardContent className="p-5">
            <div className="mb-4 flex items-center gap-2 border-b border-gray-800 pb-4">
              <Building2 className="h-4 w-4 text-blue-400" />
              <span className="text-sm font-semibold text-slate-200">Company Settings</span>
            </div>
            <div className="flex flex-col gap-0">
              {COMPANY_FIELDS.map(({ label, value }) => (
                <div key={label} className="flex items-center justify-between border-b border-gray-800/60 py-2.5 last:border-b-0">
                  <span className="text-xs text-slate-500">{label}</span>
                  <span className="max-w-[180px] truncate text-right text-xs font-medium text-slate-200">{value}</span>
                </div>
              ))}
              <div className="flex items-center justify-between border-b border-gray-800/60 py-2.5">
                <span className="text-xs text-slate-500">Emergency Callout</span>
                <Badge className="inline-flex h-auto rounded bg-[#10b98120] px-2 py-0.5 text-[10px] font-medium text-emerald-400 shadow-none">Enabled</Badge>
              </div>
              <div className="flex items-center justify-between py-2.5">
                <span className="text-xs text-slate-500">Marketplace Visibility</span>
                <Badge className="inline-flex h-auto rounded bg-[#3b82f620] px-2 py-0.5 text-[10px] font-medium text-blue-400 shadow-none">Active</Badge>
              </div>
            </div>
            <div className="mt-4 border-t border-gray-800 pt-4">
              <Button variant="outline" className="w-full border-[#ffffff20] bg-[#ffffff0a] text-slate-200 hover:bg-[#ffffff18] hover:text-slate-50">
                <Settings className="h-4 w-4" />Edit Company Details
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Notification preferences */}
        <Card className="rounded-xl border border-gray-800 bg-[#141820] shadow-none">
          <CardContent className="p-5">
            <div className="mb-4 flex items-center gap-2 border-b border-gray-800 pb-4">
              <Bell className="h-4 w-4 text-blue-400" />
              <span className="text-sm font-semibold text-slate-200">Notification Preferences</span>
            </div>
            {notifs.map((item, idx) => (
              <ToggleRow key={item.label} item={item} onToggle={() => toggleNotif(idx)} />
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Users and permissions */}
      <Card className="rounded-xl border border-gray-800 bg-[#141820] shadow-none">
        <CardContent className="p-0">
          <div className="flex items-center justify-between border-b border-gray-800 px-5 py-4">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-blue-400" />
              <span className="text-sm font-semibold text-slate-200">Users &amp; Permissions</span>
            </div>
            <Button variant="outline" className="border-[#ffffff20] bg-[#ffffff0a] px-3 py-1.5 text-xs text-slate-300 hover:bg-[#ffffff18] hover:text-slate-50 h-auto">
              Invite User
            </Button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[620px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-gray-800 bg-[#0f1318]">
                  {["User", "Role", "Email", "Access", "Status", "Last Active", ""].map((h) => (
                    <th key={h} className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {portalUsers.map((user, idx) => (
                  <tr key={user.email} className={`border-b border-gray-800/50 ${idx % 2 === 0 ? "bg-[#141820]" : "bg-[#111620]"}`}>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-blue-500/20 text-[10px] font-bold text-blue-300">
                          {user.initials}
                        </div>
                        <span className="font-medium text-slate-100">{user.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5">
                      <Badge className={`inline-flex h-auto rounded px-2 py-0.5 text-[10px] font-medium shadow-none ${roleCls[user.role]}`}>
                        {user.role}
                      </Badge>
                    </td>
                    <td className="px-4 py-2.5 text-xs text-slate-400">{user.email}</td>
                    <td className="px-4 py-2.5">
                      <span className={`text-xs font-medium ${accessCls[user.accessLevel]}`}>{user.accessLevel}</span>
                    </td>
                    <td className="px-4 py-2.5">
                      <Badge className={`inline-flex h-auto rounded px-2 py-0.5 text-[10px] font-medium shadow-none ${statusCls[user.status]}`}>
                        {user.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-2.5 text-xs text-slate-500">{user.lastActive}</td>
                    <td className="px-4 py-2.5">
                      <button
                        type="button"
                        className="rounded-lg border border-gray-700 px-2.5 py-1 text-[10px] font-medium text-slate-400 transition-colors hover:border-gray-600 hover:bg-[#ffffff0a] hover:text-slate-200"
                      >
                        Manage
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Marketplace + AI settings */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">

        {/* Marketplace preferences */}
        <Card className="rounded-xl border border-gray-800 bg-[#141820] shadow-none">
          <CardContent className="p-5">
            <div className="mb-4 flex items-center gap-2 border-b border-gray-800 pb-4">
              <Store className="h-4 w-4 text-blue-400" />
              <span className="text-sm font-semibold text-slate-200">Marketplace Preferences</span>
            </div>
            {marketplace.map((item, idx) => (
              <ToggleRow key={item.label} item={item} onToggle={() => toggleMarketplace(idx)} />
            ))}
            <div className="mt-4 grid grid-cols-2 gap-0">
              <div className="flex flex-col gap-0.5 border-r border-gray-800 pr-4">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Min Notice</p>
                <p className="text-sm font-semibold text-slate-200">24 hours</p>
              </div>
              <div className="flex flex-col gap-0.5 pl-4">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Preferred Regions</p>
                <p className="text-sm font-semibold text-slate-200">NW · Scotland · Midlands</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* AI settings */}
        <Card className="rounded-xl border border-gray-800 bg-[#141820] shadow-none">
          <CardContent className="p-5">
            <div className="mb-4 flex items-center gap-2 border-b border-gray-800 pb-4">
              <Brain className="h-4 w-4 text-blue-400" />
              <span className="text-sm font-semibold text-slate-200">AI Settings</span>
            </div>
            {aiSettings.map((item, idx) => (
              <ToggleRow key={item.label} item={item} onToggle={() => toggleAi(idx)} />
            ))}
            <div className="mt-4 border-t border-gray-800 pt-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-medium text-slate-400">Confidence Threshold</p>
                <span className="tabular-nums text-xs font-semibold text-blue-400">{aiThreshold}%</span>
              </div>
              <input
                type="range"
                min={50}
                max={99}
                value={aiThreshold}
                onChange={(e) => setAiThreshold(Number(e.target.value))}
                className="w-full accent-blue-500"
              />
              <p className="mt-1 text-[11px] text-slate-600">Only show recommendations with AI confidence above this threshold.</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Data and security */}
      <Card className="rounded-xl border border-gray-800 bg-[#141820] shadow-none">
        <CardContent className="p-5">
          <div className="mb-4 flex items-center gap-2 border-b border-gray-800 pb-4">
            <Lock className="h-4 w-4 text-blue-400" />
            <span className="text-sm font-semibold text-slate-200">Data &amp; Security</span>
          </div>
          <div className="grid grid-cols-1 gap-0 sm:grid-cols-2">
            {DATA_ITEMS.map(({ label, status, note }) => (
              <div key={label} className="flex items-center justify-between border-b border-gray-800/60 py-2.5 last:border-b-0 sm:even:pl-6 sm:odd:pr-6">
                <div className="flex items-center gap-2">
                  {status === "emerald"
                    ? <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
                    : <Eye className="h-3.5 w-3.5 shrink-0 text-yellow-400" />}
                  <span className="text-xs text-slate-300">{label}</span>
                </div>
                <span className={`text-xs font-medium ${dataStatusCls[status]}`}>{note}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Settings actions */}
      <Card className="rounded-xl border border-gray-800 bg-[#141820] shadow-none">
        <CardContent className="p-5">
          <div className="mb-4 flex items-center gap-2 border-b border-gray-800 pb-4">
            <Zap className="h-4 w-4 text-blue-400" />
            <span className="text-sm font-semibold text-slate-200">Recommended Actions</span>
          </div>
          <div className="flex flex-col gap-2">
            {SETTINGS_ACTIONS.map(({ text, urgency }, i) => (
              <div key={i} className="flex items-start gap-2.5 rounded-lg border border-gray-800 bg-[#0f1318] px-3 py-2.5">
                <Clock className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${urgencyCls[urgency]}`} />
                <p className="text-[11px] leading-relaxed text-slate-400">{text}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

    </section>
  );
};
