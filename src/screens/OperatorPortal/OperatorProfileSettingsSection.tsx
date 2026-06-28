import { useState } from "react";
import {
  Bell,
  Briefcase,
  Building2,
  CheckCircle2,
  ClipboardList,
  MapPin,
  Save,
  ShieldCheck,
  Sparkles,
  User,
  Zap,
} from "lucide-react";
import { Button } from "../../components/ui/button";
import { Card, CardContent } from "../../components/ui/card";
import { Progress } from "../../components/ui/progress";
import { AiActionsPanel, AiAction } from "../../components/AiActionsPanel";
import { ExplainWithAi } from "../../components/ExplainWithAi";
import { SyncIndicator } from "../../components/SyncIndicator";

// ─── Shared primitives (scoped to this file) ──────────────────────────────────

function TextInput({ label, value, placeholder, type = "text", readOnly = false, onChange }: {
  label: string; value: string; placeholder: string; type?: string; readOnly?: boolean; onChange?: (v: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{label}</label>
      <input
        type={type}
        value={value}
        readOnly={readOnly}
        placeholder={placeholder}
        onChange={(e) => onChange?.(e.target.value)}
        className={`h-9 w-full rounded-lg border border-gray-700 bg-[#0b0e14] px-3 text-sm text-slate-200 placeholder:text-slate-600 focus:border-blue-500/50 focus:outline-none focus:ring-1 focus:ring-blue-500/30 transition-colors ${readOnly ? "opacity-60 cursor-not-allowed" : ""}`}
      />
    </div>
  );
}

function SelectInput({ label, value, options, onChange }: {
  label: string; value: string; options: { value: string; label: string }[]; onChange?: (v: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        className="h-9 w-full appearance-none rounded-lg border border-gray-700 bg-[#0b0e14] px-3 text-sm text-slate-200 focus:border-blue-500/50 focus:outline-none focus:ring-1 focus:ring-blue-500/30 transition-colors"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value} className="bg-[#0b0e14]">{o.label}</option>
        ))}
      </select>
    </div>
  );
}

function Toggle({ label, sub, checked, onChange }: {
  label: string; sub: string; checked: boolean; onChange: () => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5 border-b border-gray-800/60 last:border-0">
      <div className="flex flex-col gap-0.5 min-w-0">
        <p className="text-xs font-medium text-slate-200">{label}</p>
        <p className="text-[11px] text-slate-500">{sub}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={onChange}
        className={`relative shrink-0 h-5 w-9 rounded-full transition-colors ${checked ? "bg-blue-500" : "bg-gray-700"}`}
      >
        <span className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${checked ? "translate-x-4" : "translate-x-0"}`} />
      </button>
    </div>
  );
}

function SectionCard({ title, sub, badge, children }: {
  title: string; sub?: string; badge?: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <Card className="min-w-0 w-full rounded-xl border border-gray-800 bg-[#141820] shadow-none">
      <CardContent className="flex min-w-0 flex-col gap-4 p-5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex flex-col gap-0.5">
            <h2 className="text-sm font-semibold text-slate-200">{title}</h2>
            {sub && <p className="text-[11px] text-slate-500">{sub}</p>}
          </div>
          {badge}
        </div>
        {children}
      </CardContent>
    </Card>
  );
}

// ─── Static data ──────────────────────────────────────────────────────────────

const COMPLETION_ITEMS = [
  { label: "Full name",           done: true  },
  { label: "Employee ID",         done: true  },
  { label: "Phone number",        done: true  },
  { label: "Primary area",        done: true  },
  { label: "Shift pattern",       done: true  },
  { label: "Skills profile",      done: true  },
  { label: "Emergency contact",   done: false },
  { label: "Profile photo",       done: false },
];

const AI_ACTIONS: AiAction[] = [
  {
    label: "Add emergency contact details to complete your profile",
    description: "Emergency contact is required for certain production areas and work permits. Adding it now ensures your profile is complete and doesn't block future training or site access requests.",
    priority: "medium",
    icon: User,
  },
  {
    label: "Set availability to Available to appear in shift planning",
    description: "Your availability is currently set to Limited. Changing it to Available means the Production Manager can include you in shift coverage and cross-training plans.",
    priority: "high",
    icon: Zap,
  },
  {
    label: "Enable compliance expiry alerts to stay ahead of renewals",
    description: "Compliance expiry notifications are currently off. Turning them on gives you 90, 60 and 30-day reminders before any certificate or competency expires.",
    priority: "medium",
    icon: ShieldCheck,
  },
  {
    label: "Review your shift preferences so they match your current pattern",
    description: "Your preferred shift is set to Early Shift but your profile shows flexibility is available. Confirming your actual preference helps the Production Manager plan coverage accurately.",
    priority: "low",
    icon: ClipboardList,
  },
];

// ─── Main component ───────────────────────────────────────────────────────────

export const OperatorProfileSettingsSection = (): JSX.Element => {
  const [saved, setSaved] = useState(false);

  // Personal
  const [fullName,   setFullName]   = useState("David Clarke");
  const [jobTitle,   setJobTitle]   = useState("Production Operator");
  const [email,      setEmail]      = useState("d.clarke@alpha-mfg.com");
  const [phone,      setPhone]      = useState("+44 7700 900456");
  const [empId,      setEmpId]      = useState("OPR-1042");
  const [dept,       setDept]       = useState("Production");

  // Shift preferences
  const [shiftPref,   setShiftPref]   = useState("early");
  const [overtime,    setOvertime]    = useState("available");
  const [changeover,  setChangeover]  = useState("available");
  const [training,    setTraining]    = useState("available");
  const [devArea,     setDevArea]     = useState("quality");
  const [notifTime,   setNotifTime]   = useState("shift-start");
  const [availability,setAvailability]= useState("available");

  // Toggles
  const [visibility, setVisibility] = useState<Record<string, boolean>>({
    skills_to_manager:   true,
    training_to_lead:    true,
    compliance_to_manager: true,
    dev_interests:       false,
    overtime_interest:   true,
    cross_training:      false,
  });

  const [notifs, setNotifs] = useState<Record<string, boolean>>({
    shift_tasks:        true,
    training_due:       true,
    compliance_expiry:  false,
    manager_signoff:    true,
    ai_guidance:        true,
    knowledge_recs:     false,
    handover_reminders: true,
  });

  const completionDone = COMPLETION_ITEMS.filter((i) => i.done).length;
  const completionPct  = Math.round((completionDone / COMPLETION_ITEMS.length) * 100);

  const toggleVisibility = (k: string) => setVisibility((v) => ({ ...v, [k]: !v[k] }));
  const toggleNotif      = (k: string) => setNotifs((n) => ({ ...n, [k]: !n[k] }));

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  return (
    <section className="flex min-w-0 w-full flex-col gap-6 overflow-x-hidden px-4 pb-12 pt-0 md:px-6 xl:px-8">

      {/* ── Header ── */}
      <header className="flex flex-col gap-3 py-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-1 min-w-0">
          <p className="text-xs font-medium text-slate-500">Operator Portal</p>
          <h1 className="mt-1 text-xl font-semibold text-slate-50">Profile Settings</h1>
          <p className="mt-1 max-w-xl text-sm text-slate-400">
            Manage your operator profile, contact details, shift preferences, skills visibility and notification settings used across Vorta.
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <SyncIndicator source="Vorta" confidence={94} syncedAt={new Date(Date.now() - 120000)} />
          <ExplainWithAi pageId="operator-profile-settings" />
          <Button
            size="sm"
            onClick={handleSave}
            className={`h-8 gap-1.5 text-xs font-medium transition-colors ${saved ? "bg-emerald-600 hover:bg-emerald-600 text-white" : "bg-blue-600 hover:bg-blue-500 text-white"}`}
          >
            {saved ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Save className="h-3.5 w-3.5" />}
            {saved ? "Saved" : "Save Changes"}
          </Button>
        </div>
      </header>

      {/* ── Profile Completion ── */}
      <SectionCard
        title="Profile Completion"
        sub="A complete profile improves shift planning and AI guidance accuracy"
        badge={
          <span className={`text-sm font-bold tabular-nums ${completionPct >= 90 ? "text-emerald-400" : completionPct >= 70 ? "text-yellow-400" : "text-orange-400"}`}>
            {completionPct}%
          </span>
        }
      >
        <div className="flex flex-col gap-3">
          <Progress
            value={completionPct}
            className={`h-2 bg-gray-800 ${completionPct >= 90 ? "[&>div]:bg-emerald-500" : completionPct >= 70 ? "[&>div]:bg-yellow-400" : "[&>div]:bg-orange-500"}`}
          />
          <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 sm:grid-cols-4">
            {COMPLETION_ITEMS.map(({ label, done }) => (
              <div key={label} className="flex items-center gap-1.5">
                <CheckCircle2 className={`h-3.5 w-3.5 shrink-0 ${done ? "text-emerald-400" : "text-gray-700"}`} />
                <span className={`truncate text-[11px] ${done ? "text-slate-400" : "text-slate-600"}`}>{label}</span>
              </div>
            ))}
          </div>
        </div>
      </SectionCard>

      {/* ── Personal Details + Production Profile ── */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">

        <SectionCard title="Personal Details" sub="Your identity and contact information" badge={<User className="h-4 w-4 shrink-0 text-slate-600" />}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <TextInput label="Full Name"   value={fullName} placeholder="Full name"       onChange={setFullName} />
            <TextInput label="Job Title"   value={jobTitle} placeholder="Job title"       onChange={setJobTitle} />
            <TextInput label="Employee ID" value={empId}    placeholder="e.g. OPR-1042"   onChange={setEmpId}    />
            <TextInput label="Department"  value={dept}     placeholder="Department"       onChange={setDept}     />
            <TextInput label="Email"       value={email}    placeholder="Email"  type="email" onChange={setEmail} />
            <TextInput label="Phone"       value={phone}    placeholder="+44 …"  type="tel"   onChange={setPhone} />
          </div>
        </SectionCard>

        <SectionCard title="Production Profile" sub="Your site assignment and reporting structure" badge={<Building2 className="h-4 w-4 shrink-0 text-slate-600" />}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <TextInput label="Site"               value="Manchester Plant"    placeholder="—" readOnly />
            <TextInput label="Primary Line / Area" value="Line 2 Filling"    placeholder="—" readOnly />
            <TextInput label="Secondary Areas"    value="Packing, Quality Checks" placeholder="—" readOnly />
            <TextInput label="Current Role"       value="Production Operator" placeholder="—" readOnly />
            <TextInput label="Line Lead / Manager" value="Production Manager" placeholder="—" readOnly />
            <TextInput label="Employment Type"    value="Full Time"           placeholder="—" readOnly />
          </div>
          <div className="flex items-center justify-between rounded-lg border border-gray-800 bg-[#0f1318] px-3 py-2.5">
            <div className="flex flex-col gap-0.5">
              <p className="text-[11px] font-medium text-slate-400">Restricted Duties</p>
              <p className="text-[10px] text-slate-600">Site-managed — contact your manager to update</p>
            </div>
            <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold bg-[#10b98118] text-emerald-400 border border-emerald-500/20">
              No Restrictions
            </span>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Availability Status</label>
            <select
              value={availability}
              onChange={(e) => setAvailability(e.target.value)}
              className="h-9 w-full appearance-none rounded-lg border border-gray-700 bg-[#0b0e14] px-3 text-sm text-slate-200 focus:border-blue-500/50 focus:outline-none focus:ring-1 focus:ring-blue-500/30 transition-colors"
            >
              <option value="available" className="bg-[#0b0e14]">Available</option>
              <option value="limited"   className="bg-[#0b0e14]">Limited</option>
              <option value="unavailable" className="bg-[#0b0e14]">Not Available</option>
            </select>
          </div>
          <p className="text-[11px] text-slate-600">Site, area and manager details are managed by your administrator.</p>
        </SectionCard>
      </div>

      {/* ── Shift Preferences ── */}
      <SectionCard title="Shift Preferences" sub="Controls how you appear in shift planning and scheduling" badge={<Briefcase className="h-4 w-4 shrink-0 text-slate-600" />}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <SelectInput
            label="Preferred Shift"
            value={shiftPref}
            onChange={setShiftPref}
            options={[
              { value: "early",   label: "Early Shift"  },
              { value: "late",    label: "Late Shift"   },
              { value: "night",   label: "Night Shift"  },
              { value: "flexible",label: "Flexible"     },
            ]}
          />
          <SelectInput
            label="Overtime Availability"
            value={overtime}
            onChange={setOvertime}
            options={[
              { value: "available",   label: "Available"     },
              { value: "limited",     label: "Limited"       },
              { value: "unavailable", label: "Not Available" },
            ]}
          />
          <SelectInput
            label="Changeover Support"
            value={changeover}
            onChange={setChangeover}
            options={[
              { value: "available",   label: "Available"     },
              { value: "limited",     label: "Limited"       },
              { value: "unavailable", label: "Not Available" },
            ]}
          />
          <SelectInput
            label="Training Availability"
            value={training}
            onChange={setTraining}
            options={[
              { value: "available",   label: "Available"     },
              { value: "limited",     label: "Limited"       },
              { value: "unavailable", label: "Not Available" },
            ]}
          />
          <SelectInput
            label="Preferred Development Area"
            value={devArea}
            onChange={setDevArea}
            options={[
              { value: "quality",     label: "Quality Checks"      },
              { value: "changeover",  label: "Changeover Skills"   },
              { value: "sap",         label: "SAP"                 },
              { value: "safety",      label: "Safety & Compliance" },
              { value: "leadership",  label: "Line Leading"        },
            ]}
          />
          <SelectInput
            label="Notification Time"
            value={notifTime}
            onChange={setNotifTime}
            options={[
              { value: "shift-start", label: "At Shift Start"  },
              { value: "30-min",      label: "30 min before"   },
              { value: "1-hour",      label: "1 hour before"   },
              { value: "morning",     label: "8:00 AM daily"   },
            ]}
          />
        </div>
      </SectionCard>

      {/* ── Skills Visibility + Notification Preferences ── */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">

        <SectionCard title="Skills Visibility" sub="Control what your manager and lead can see about your profile" badge={<MapPin className="h-4 w-4 shrink-0 text-slate-600" />}>
          <div className="flex flex-col">
            {([
              { k: "skills_to_manager",      label: "Show validated skills to Production Manager",    sub: "Manager sees skill levels and sign-off status"       },
              { k: "training_to_lead",        label: "Show training progress to Line Lead",           sub: "Lead sees course progress and upcoming due dates"     },
              { k: "compliance_to_manager",   label: "Show compliance status to Production Manager", sub: "Manager sees certification and compliance record"     },
              { k: "dev_interests",           label: "Show development interests",                    sub: "Visible in skills matrix and planning tools"          },
              { k: "overtime_interest",       label: "Show availability for overtime",               sub: "Visible to Production Manager in shift coverage view"  },
              { k: "cross_training",          label: "Show interest in cross-training",               sub: "Visible in AI matching and opportunity suggestions"   },
            ] as { k: string; label: string; sub: string }[]).map(({ k, label, sub }) => (
              <Toggle key={k} label={label} sub={sub} checked={visibility[k]} onChange={() => toggleVisibility(k)} />
            ))}
          </div>
        </SectionCard>

        <SectionCard title="Notification Preferences" sub="Choose what alerts and updates you receive" badge={<Bell className="h-4 w-4 shrink-0 text-slate-600" />}>
          <div className="flex flex-col">
            {([
              { k: "shift_tasks",        label: "Shift task reminders",          sub: "Reminders for tasks due during your shift"                },
              { k: "training_due",       label: "Training due reminders",        sub: "Alerts before training courses reach their due date"      },
              { k: "compliance_expiry",  label: "Compliance expiry alerts",      sub: "Alerts 90, 60 and 30 days before a compliance item expires"},
              { k: "manager_signoff",    label: "Manager sign-off updates",      sub: "Notifications when a sign-off is approved or needs review" },
              { k: "ai_guidance",        label: "AI guidance updates",           sub: "Daily AI-generated shift and skill guidance"              },
              { k: "knowledge_recs",     label: "Knowledge base recommendations",sub: "AI-suggested articles relevant to your shift and tasks"   },
              { k: "handover_reminders", label: "Handover reminders",            sub: "Reminders to complete handover before end of shift"       },
            ] as { k: string; label: string; sub: string }[]).map(({ k, label, sub }) => (
              <Toggle key={k} label={label} sub={sub} checked={notifs[k]} onChange={() => toggleNotif(k)} />
            ))}
          </div>
        </SectionCard>
      </div>

      {/* ── Security / Access ── */}
      <SectionCard title="Security & Access" sub="Your role permissions within Vorta — managed by your administrator" badge={<ShieldCheck className="h-4 w-4 shrink-0 text-slate-600" />}>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[
            { label: "Role",          value: "Operator",                                      valueClass: "text-blue-400"    },
            { label: "Portal Access", value: "Operator Portal",                               valueClass: "text-slate-200"   },
            { label: "Data Scope",    value: "Personal profile, own shift, skills, training", valueClass: "text-slate-400"   },
            { label: "Permissions",   value: "View records, update preferences, view AI guidance", valueClass: "text-slate-400" },
          ].map(({ label, value, valueClass }) => (
            <div key={label} className="flex flex-col gap-1 rounded-lg border border-gray-800 bg-[#0f1318] p-3">
              <p className="text-[10px] font-medium uppercase tracking-wide text-slate-500">{label}</p>
              <p className={`text-xs font-semibold leading-snug ${valueClass}`}>{value}</p>
            </div>
          ))}
        </div>
        <p className="text-[11px] text-slate-600">Role and permissions are managed by your site administrator and cannot be changed from this page.</p>
      </SectionCard>

      {/* ── AI Profile Recommendations ── */}
      <Card className="min-w-0 w-full rounded-xl border border-gray-800 bg-[#141820] shadow-none">
        <CardContent className="flex min-w-0 flex-col gap-4 p-5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex flex-col gap-0.5">
              <h2 className="text-sm font-semibold text-slate-200">AI Profile Recommendations</h2>
              <p className="text-[11px] text-slate-500">Actions to keep your operator profile complete and accurate</p>
            </div>
            <span className="inline-flex items-center gap-1.5 rounded bg-[#3b82f620] px-2 py-1 text-[10px] font-medium text-blue-400">
              <Sparkles className="h-2.5 w-2.5" />Live
            </span>
          </div>
          <AiActionsPanel actions={AI_ACTIONS} />
        </CardContent>
      </Card>

      {/* ── Save / Reset Actions ── */}
      <Card className="min-w-0 rounded-xl border border-gray-800 bg-[#141820] shadow-none">
        <CardContent className="flex flex-col gap-4 p-5">
          <h2 className="text-sm font-semibold text-slate-200">Save Changes</h2>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              onClick={handleSave}
              className={`h-8 gap-1.5 text-xs font-medium transition-colors ${saved ? "bg-emerald-600 hover:bg-emerald-600 text-white" : "bg-blue-600 hover:bg-blue-500 text-white"}`}
            >
              {saved ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Save className="h-3.5 w-3.5" />}
              {saved ? "Saved" : "Save Changes"}
            </Button>
            <Button size="sm" variant="outline" className="h-8 gap-1.5 border-gray-700 bg-transparent text-slate-400 hover:border-gray-600 hover:text-slate-200 text-xs">
              Reset Preferences
            </Button>
            <Button size="sm" variant="outline" className="h-8 gap-1.5 border-gray-700 bg-transparent text-slate-400 hover:border-gray-600 hover:text-slate-200 text-xs">
              Cancel
            </Button>
          </div>
          {saved && (
            <div className="flex items-center gap-2 rounded-lg border border-emerald-500/20 bg-[#10b98108] px-3 py-2.5">
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
              <p className="text-[11px] text-emerald-400">Profile settings saved successfully.</p>
            </div>
          )}
        </CardContent>
      </Card>

    </section>
  );
};
