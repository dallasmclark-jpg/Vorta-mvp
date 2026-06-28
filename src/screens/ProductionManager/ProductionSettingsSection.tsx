import { useState } from "react";
import {
  Bell,
  Brain,
  CheckCircle2,
  Clock,
  Eye,
  Lock,
  Save,
  Settings,
  ShieldCheck,
  Users,
  Zap,
  LayoutDashboard,
  CalendarDays,
} from "lucide-react";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Card, CardContent } from "../../components/ui/card";
import { SyncIndicator } from "../../components/SyncIndicator";
import { ExplainWithAi } from "../../components/ExplainWithAi";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ToggleSetting {
  label: string;
  description: string;
  enabled: boolean;
}

// ─── Mock data ────────────────────────────────────────────────────────────────

const PROFILE_FIELDS = [
  { label: "Name",                   value: "Rachel Thompson"             },
  { label: "Job Title",              value: "Production Manager"          },
  { label: "Site / Department",      value: "Site A — Ambient Lines"      },
  { label: "Email",                  value: "rachel.thompson@vorta.co.uk" },
  { label: "Phone",                  value: "+44 7890 234567"             },
  { label: "Primary Production Area",value: "Lines 1–3, Mixing, Packing"  },
];

const SECURITY_ITEMS = [
  { label: "Role",                       status: "emerald" as const, note: "Production Manager"         },
  { label: "Portal Access",             status: "emerald" as const, note: "Production"                  },
  { label: "Operators",                  status: "emerald" as const, note: "Full Access"                 },
  { label: "Skills Matrix & Training",   status: "emerald" as const, note: "Full Access"                 },
  { label: "Shift Coverage",             status: "emerald" as const, note: "Full Access"                 },
  { label: "Compliance",                 status: "emerald" as const, note: "Full Access"                 },
  { label: "Production Risk",            status: "emerald" as const, note: "Full Access"                 },
  { label: "AI Improvements",           status: "emerald" as const, note: "Full Access"                 },
  { label: "Data Scope",                 status: "emerald" as const, note: "Assigned Site / Department"  },
  { label: "Supabase RLS Protection",    status: "emerald" as const, note: "Enforced"                    },
  { label: "Audit Trail",               status: "emerald" as const, note: "All actions logged"           },
  { label: "Session Management",        status: "emerald" as const, note: "Secure"                       },
];

const RECOMMENDED_ACTIONS = [
  { text: "Validate two additional Line 3 changeover operators before the late shift plan is finalised.", urgency: "high"   },
  { text: "Review AI confidence threshold — increasing to 80% will reduce lower-quality recommendations.", urgency: "medium" },
  { text: "Enable compliance risk alerts to ensure licence expiry warnings reach you in time to act.",    urgency: "medium" },
  { text: "Confirm shift coverage notifications are active for all managed lines and areas.",              urgency: "low"    },
  { text: "Review dashboard preferences — enabling AI recommendations by default surfaces daily actions.", urgency: "low"    },
];

// ─── Toggle helpers ───────────────────────────────────────────────────────────

const useToggles = (initial: ToggleSetting[]) => {
  const [items, setItems] = useState(initial);
  const toggle = (idx: number) =>
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, enabled: !it.enabled } : it)));
  return [items, toggle] as const;
};

const NOTIF_INITIAL: ToggleSetting[] = [
  { label: "Operator absence alerts",       description: "Get notified immediately when an operator absence is reported",         enabled: true  },
  { label: "Shift coverage risk alerts",    description: "Alerts when shift coverage drops below the configured threshold",       enabled: true  },
  { label: "Training expiry alerts",        description: "Early warnings when mandatory training is approaching expiry",          enabled: true  },
  { label: "Compliance risk alerts",        description: "Notifications when compliance items become overdue or at risk",         enabled: true  },
  { label: "AI recommendation updates",     description: "Vorta AI surfaces high-priority workforce actions to your dashboard",   enabled: true  },
  { label: "Production risk score changes", description: "Alerts when the AI recalculates and identifies a changed risk level",   enabled: true  },
  { label: "Weekly workforce summary",      description: "Sunday digest of operator readiness, compliance and training status",    enabled: false },
];

const DASHBOARD_INITIAL: ToggleSetting[] = [
  { label: "Show AI recommendations by default", description: "Display the AI action panel on the production dashboard",          enabled: true  },
  { label: "Show high-risk alerts first",         description: "Sort all tables and cards by risk level — highest first",        enabled: true  },
  { label: "Show shift coverage on dashboard",    description: "Display shift readiness card on the main dashboard view",        enabled: true  },
  { label: "Show compliance warnings",            description: "Surface compliance expiry and overdue items on the dashboard",    enabled: true  },
  { label: "Show training reminders",             description: "Include upcoming training deadlines in the dashboard summary",    enabled: false },
];

const SHIFT_INITIAL: ToggleSetting[] = [
  { label: "Include agency operators",             description: "Show agency workers alongside directly employed operators",     enabled: true  },
  { label: "Include contractors in coverage",      description: "Count contractor headcount towards shift coverage targets",     enabled: false },
  { label: "Highlight single-point dependencies", description: "Flag tasks with only one validated operator",                   enabled: true  },
  { label: "Show restricted-duty operators",       description: "Display operators on modified duties in coverage planning",    enabled: true  },
];

const AI_INITIAL: ToggleSetting[] = [
  { label: "AI recommendations enabled",              description: "Surface prioritised actions from Vorta workforce intelligence", enabled: true  },
  { label: "Show AI risk explanations",               description: "Display the reasoning behind each AI risk score",              enabled: true  },
  { label: "Show recommended actions",                description: "Include suggested next steps on each AI insight",             enabled: true  },
  { label: "Allow AI to prioritise shift risks",      description: "Let AI rank shift gaps as highest-priority actions",          enabled: true  },
  { label: "Include training actions in AI",          description: "Surface training expiry and gaps in AI recommendations",      enabled: true  },
  { label: "Include compliance actions in AI",        description: "Include compliance risks in the AI improvement queue",        enabled: false },
];

// ─── Style maps ───────────────────────────────────────────────────────────────

const dataStatusCls: Record<"emerald" | "yellow", string> = {
  emerald: "text-emerald-400",
  yellow:  "text-yellow-400",
};

const urgencyCls: Record<string, string> = {
  high:   "text-orange-400",
  medium: "text-yellow-400",
  low:    "text-slate-400",
};

// ─── Toggle row ───────────────────────────────────────────────────────────────

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

export const ProductionSettingsSection = (): JSX.Element => {
  const [notifs,      toggleNotif]     = useToggles(NOTIF_INITIAL);
  const [dashboard,   toggleDashboard] = useToggles(DASHBOARD_INITIAL);
  const [shiftOpts,   toggleShift]     = useToggles(SHIFT_INITIAL);
  const [aiSettings,  toggleAi]        = useToggles(AI_INITIAL);
  const [aiThreshold, setAiThreshold]  = useState(75);

  const notifsOn   = notifs.filter((n) => n.enabled).length;
  const dashOn     = dashboard.filter((d) => d.enabled).length;

  const kpis = [
    { label: "Notifications Enabled", value: `${notifsOn}/${notifs.length}`,   valueClass: "text-blue-400",    icon: Bell         },
    { label: "Dashboard Options On",  value: `${dashOn}/${dashboard.length}`,  valueClass: "text-emerald-400", icon: LayoutDashboard },
    { label: "Portal Access",         value: "Production",                      valueClass: "text-emerald-400", icon: ShieldCheck  },
    { label: "AI Confidence",         value: `${aiThreshold}%`,                 valueClass: "text-blue-400",    icon: Brain        },
  ];

  return (
    <section className="flex min-w-0 w-full flex-col gap-6 px-4 pb-16 pt-0 md:px-6 xl:px-8">

      {/* ── Header ── */}
      <header className="flex w-full flex-col justify-between gap-4 py-5 lg:flex-row lg:items-start">
        <div>
          <p className="text-xs font-medium text-slate-500">Production Manager</p>
          <h1 className="mt-1 text-xl font-semibold text-slate-50">Settings</h1>
          <p className="mt-1 max-w-xl text-sm text-slate-400">
            Manage Production Manager preferences for shift visibility, operator alerts, compliance notifications, AI recommendations and dashboard behaviour.
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-3">
          <SyncIndicator source="Vorta" confidence={100} syncedAt={new Date(Date.now() - 30000)} />
          <ExplainWithAi pageId="production-settings" />
          <Button className="bg-blue-600 text-white hover:bg-blue-500">
            <Save className="h-4 w-4" />Save Changes
          </Button>
        </div>
      </header>

      {/* ── KPIs ── */}
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

      {/* ── Profile + Notifications ── */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">

        {/* Profile */}
        <Card className="rounded-xl border border-gray-800 bg-[#141820] shadow-none">
          <CardContent className="p-5">
            <div className="mb-4 flex items-center gap-2 border-b border-gray-800 pb-4">
              <Users className="h-4 w-4 text-blue-400" />
              <span className="text-sm font-semibold text-slate-200">Profile Settings</span>
            </div>
            <div className="flex flex-col gap-0">
              {PROFILE_FIELDS.map(({ label, value }) => (
                <div key={label} className="flex items-center justify-between border-b border-gray-800/60 py-2.5 last:border-b-0">
                  <span className="text-xs text-slate-500">{label}</span>
                  <span className="max-w-[200px] truncate text-right text-xs font-medium text-slate-200">{value}</span>
                </div>
              ))}
            </div>
            <div className="mt-4 border-t border-gray-800 pt-4">
              <Button variant="outline" className="w-full border-[#ffffff20] bg-[#ffffff0a] text-slate-200 hover:bg-[#ffffff18] hover:text-slate-50">
                <Settings className="h-4 w-4" />Edit Profile
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Notifications */}
        <Card className="rounded-xl border border-gray-800 bg-[#141820] shadow-none">
          <CardContent className="p-5">
            <div className="mb-4 flex items-center gap-2 border-b border-gray-800 pb-4">
              <Bell className="h-4 w-4 text-blue-400" />
              <span className="text-sm font-semibold text-slate-200">Notification Settings</span>
            </div>
            {notifs.map((item, idx) => (
              <ToggleRow key={item.label} item={item} onToggle={() => toggleNotif(idx)} />
            ))}
          </CardContent>
        </Card>
      </div>

      {/* ── Dashboard Preferences + Shift & Workforce Settings ── */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">

        {/* Dashboard */}
        <Card className="rounded-xl border border-gray-800 bg-[#141820] shadow-none">
          <CardContent className="p-5">
            <div className="mb-4 flex items-center gap-2 border-b border-gray-800 pb-4">
              <LayoutDashboard className="h-4 w-4 text-blue-400" />
              <span className="text-sm font-semibold text-slate-200">Dashboard Preferences</span>
            </div>
            {dashboard.map((item, idx) => (
              <ToggleRow key={item.label} item={item} onToggle={() => toggleDashboard(idx)} />
            ))}
            <div className="mt-4 border-t border-gray-800 pt-4">
              <div className="flex items-center justify-between">
                <p className="text-xs text-slate-500">Default landing page</p>
                <span className="text-xs font-medium text-slate-200">Dashboard</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Shift & Workforce */}
        <Card className="rounded-xl border border-gray-800 bg-[#141820] shadow-none">
          <CardContent className="p-5">
            <div className="mb-4 flex items-center gap-2 border-b border-gray-800 pb-4">
              <CalendarDays className="h-4 w-4 text-blue-400" />
              <span className="text-sm font-semibold text-slate-200">Shift &amp; Workforce Settings</span>
            </div>
            {shiftOpts.map((item, idx) => (
              <ToggleRow key={item.label} item={item} onToggle={() => toggleShift(idx)} />
            ))}
            <div className="mt-4 grid grid-cols-2 gap-0 border-t border-gray-800 pt-4">
              <div className="flex flex-col gap-0.5 border-r border-gray-800 pr-4">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Default Shift View</p>
                <p className="text-sm font-semibold text-slate-200">All Shifts</p>
              </div>
              <div className="flex flex-col gap-0.5 pl-4">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Areas Managed</p>
                <p className="text-sm font-semibold text-slate-200">Lines 1–3 + Mixing</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── AI Settings ── */}
      <Card className="rounded-xl border border-gray-800 bg-[#141820] shadow-none">
        <CardContent className="p-5">
          <div className="mb-4 flex items-center gap-2 border-b border-gray-800 pb-4">
            <Brain className="h-4 w-4 text-blue-400" />
            <span className="text-sm font-semibold text-slate-200">AI Settings</span>
          </div>
          <div className="grid grid-cols-1 gap-x-8 xl:grid-cols-2">
            <div>
              {aiSettings.slice(0, 3).map((item, idx) => (
                <ToggleRow key={item.label} item={item} onToggle={() => toggleAi(idx)} />
              ))}
            </div>
            <div>
              {aiSettings.slice(3).map((item, idx) => (
                <ToggleRow key={item.label} item={item} onToggle={() => toggleAi(idx + 3)} />
              ))}
            </div>
          </div>
          <div className="mt-4 border-t border-gray-800 pt-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-medium text-slate-400">AI Confidence Threshold</p>
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

      {/* ── Security / Access ── */}
      <Card className="rounded-xl border border-gray-800 bg-[#141820] shadow-none">
        <CardContent className="p-5">
          <div className="mb-4 flex items-center gap-2 border-b border-gray-800 pb-4">
            <Lock className="h-4 w-4 text-blue-400" />
            <span className="text-sm font-semibold text-slate-200">Security &amp; Access</span>
            <Badge className="ml-2 inline-flex h-auto rounded bg-[#10b98120] px-2 py-0.5 text-[10px] font-medium text-emerald-400 shadow-none">
              Production Manager
            </Badge>
          </div>
          <div className="grid grid-cols-1 gap-0 sm:grid-cols-2">
            {SECURITY_ITEMS.map(({ label, status, note }) => (
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

      {/* ── Recommended Actions ── */}
      <Card className="rounded-xl border border-gray-800 bg-[#141820] shadow-none">
        <CardContent className="p-5">
          <div className="mb-4 flex items-center gap-2 border-b border-gray-800 pb-4">
            <Zap className="h-4 w-4 text-blue-400" />
            <span className="text-sm font-semibold text-slate-200">Recommended Actions</span>
          </div>
          <div className="flex flex-col gap-2">
            {RECOMMENDED_ACTIONS.map(({ text, urgency }, i) => (
              <div key={i} className="flex items-start gap-2.5 rounded-lg border border-gray-800 bg-[#0f1318] px-3 py-2.5">
                <Clock className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${urgencyCls[urgency]}`} />
                <p className="text-[11px] leading-relaxed text-slate-400">{text}</p>
              </div>
            ))}
          </div>
          <div className="mt-4 flex gap-3 border-t border-gray-800 pt-4">
            <Button className="bg-blue-600 text-white hover:bg-blue-500">
              <Save className="h-4 w-4" />Save Changes
            </Button>
            <Button variant="outline" className="border-[#ffffff20] bg-[#ffffff0a] text-slate-200 hover:bg-[#ffffff18] hover:text-slate-50">
              Reset Preferences
            </Button>
            <Button variant="outline" className="border-[#ffffff20] bg-[#ffffff0a] text-slate-400 hover:bg-[#ffffff18] hover:text-slate-200">
              Cancel
            </Button>
          </div>
        </CardContent>
      </Card>

    </section>
  );
};
