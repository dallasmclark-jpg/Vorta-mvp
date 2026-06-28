import { useState } from "react";
import {
  Award,
  Bell,
  BookOpen,
  Briefcase,
  Building2,
  CheckCircle2,
  GraduationCap,
  Mail,
  MapPin,
  MessageSquare,
  Network,
  Phone,
  Save,
  ShoppingBag,
  Sparkles,
  TrendingUp,
  Upload,
  User,
  Zap,
} from "lucide-react";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Card, CardContent } from "../../components/ui/card";
import { Progress } from "../../components/ui/progress";
import { AiActionsPanel, AiAction } from "../../components/AiActionsPanel";
import { ExplainWithAi } from "../../components/ExplainWithAi";
import { SyncIndicator } from "../../components/SyncIndicator";

// ─── Types ────────────────────────────────────────────────────────────────────

interface TextField { label: string; value: string; placeholder: string; type?: string; readOnly?: boolean }
interface ToggleField { label: string; sub: string; key: string }

// ─── Static seed data ─────────────────────────────────────────────────────────

const COMPLETION_ITEMS = [
  { label: "Full name",                done: true  },
  { label: "Phone number",             done: true  },
  { label: "Years of experience",      done: true  },
  { label: "Location",                 done: true  },
  { label: "Skills profile",           done: true  },
  { label: "Profile photo",            done: false },
  { label: "LinkedIn / external URL",  done: false },
  { label: "Emergency contact",        done: false },
];

const AI_ACTIONS: AiAction[] = [
  { label: "Add a profile photo",                     description: "Engineers with photos receive 2× more opportunity views. Takes 30 seconds to upload.",          priority: "medium",   icon: User      },
  { label: "Add LinkedIn URL to increase visibility", description: "Recruiters and managers use external profiles to verify experience. Boosts AI match score.",    priority: "medium",   icon: TrendingUp },
  { label: "Update availability to 'Available'",      description: "Status is set to 'Limited'. Changing to Available opens 4 additional matched opportunities.",   priority: "high",     icon: Zap        },
  { label: "Enable opportunity matching notifications", description: "You have matching turned on but email alerts disabled. Missing real-time opportunity alerts.", priority: "low",      icon: Bell       },
  { label: "Add emergency contact details",           description: "Required for offshore and confined space work permits. Needed for 3 current opportunities.",    priority: "medium",   icon: Phone      },
];

// ─── Input primitives ─────────────────────────────────────────────────────────

function TextInput({ label, value, placeholder, type = "text", readOnly = false, onChange }: TextField & { onChange?: (v: string) => void }) {
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

function Toggle({ label, sub, checked, onChange }: { label: string; sub: string; checked: boolean; onChange: () => void }) {
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

// ─── Main ─────────────────────────────────────────────────────────────────────

export function ProfileSettingsSection(): JSX.Element {
  const [saved, setSaved]   = useState(false);

  // Personal
  const [fullName,    setFullName]    = useState("James Mitchell");
  const [jobTitle,    setJobTitle]    = useState("Maintenance Engineer");
  const [email,       setEmail]       = useState("j.mitchell@alpha-mfg.com");
  const [phone,       setPhone]       = useState("+44 7700 900123");
  const [yearsExp,    setYearsExp]    = useState("8");
  const [location,    setLocation]    = useState("Manchester, UK");

  // Availability
  const [availability, setAvailability] = useState("limited");
  const [shiftPref,    setShiftPref]    = useState("days");
  const [travelRadius, setTravelRadius] = useState("50");
  const [remote,       setRemote]       = useState("yes");
  const [overtime,     setOvertime]     = useState("yes");
  const [matching,     setMatching]     = useState(true);

  // Notifications
  const [notifs, setNotifs] = useState<Record<string, boolean>>({
    training_reminders:     true,
    cert_expiry:            true,
    opportunity_matches:    false,
    validation_updates:     true,
    ai_recommendations:     true,
  });

  const completionDone  = COMPLETION_ITEMS.filter((i) => i.done).length;
  const completionPct   = Math.round((completionDone / COMPLETION_ITEMS.length) * 100);

  const toggleNotif = (key: string) => setNotifs((n) => ({ ...n, [key]: !n[key] }));

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const NOTIF_FIELDS: ToggleField[] = [
    { label: "Training reminders",          sub: "Reminders for upcoming booked courses",        key: "training_reminders"  },
    { label: "Certification expiry alerts", sub: "Alerts 90, 60 and 30 days before expiry",      key: "cert_expiry"         },
    { label: "Opportunity matches",         sub: "New roles and shifts matching your profile",    key: "opportunity_matches" },
    { label: "Manager validation updates",  sub: "When a manager validates or updates a skill",  key: "validation_updates"  },
    { label: "AI recommendations",         sub: "Weekly AI-generated profile improvement tips", key: "ai_recommendations"  },
  ];

  return (
    <section className="flex min-w-0 w-full flex-col gap-6 overflow-x-hidden px-4 pb-12 pt-5 md:px-6 xl:px-8">

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-1 min-w-0">
          <h1 className="text-xl font-semibold text-slate-50">Profile Settings</h1>
          <p className="text-sm text-slate-400">Manage your engineer profile, availability and account preferences.</p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <SyncIndicator />
          <ExplainWithAi pageId="engineer-settings" />
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

      {/* ── Profile Completion ───────────────────────────────────────────────── */}
      <SectionCard
        title="Profile Completion"
        sub="A complete profile improves AI match accuracy and opportunity visibility"
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
          {completionPct < 100 && (
            <div className="flex items-start gap-2.5 rounded-lg border border-[#3b82f625] bg-[#3b82f608] px-4 py-3">
              <Sparkles className="h-4 w-4 shrink-0 text-blue-400 mt-0.5" />
              <p className="text-[11px] leading-relaxed text-slate-400">
                Completing your profile can increase your AI match score by up to <span className="font-semibold text-blue-400">+8 pts</span>.
                Add a profile photo, LinkedIn URL and emergency contact to reach 100%.
              </p>
            </div>
          )}
        </div>
      </SectionCard>

      {/* ── Personal + Company (2-col on xl) ────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">

        {/* Personal Details */}
        <SectionCard
          title="Personal Details"
          sub="Your identity and contact information"
          badge={<User className="h-4 w-4 shrink-0 text-slate-600" />}
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <TextInput label="Full Name"          value={fullName}  placeholder="Full name"         onChange={setFullName}  />
            <TextInput label="Job Title / Role"   value={jobTitle}  placeholder="Job title"         onChange={setJobTitle}  />
            <TextInput label="Email"              value={email}     placeholder="Email address"      type="email" onChange={setEmail} />
            <TextInput label="Phone"              value={phone}     placeholder="+44 …"              type="tel"   onChange={setPhone} />
            <TextInput label="Years Experience"   value={yearsExp}  placeholder="e.g. 8"            type="number" onChange={setYearsExp} />
            <TextInput label="Location"           value={location}  placeholder="City, Country"      onChange={setLocation}  />
          </div>
        </SectionCard>

        {/* Company & Site */}
        <SectionCard
          title="Company & Site Details"
          sub="Your current assignment and reporting structure"
          badge={<Building2 className="h-4 w-4 shrink-0 text-slate-600" />}
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <TextInput label="Company"           value="Alpha Manufacturing" placeholder="—" readOnly />
            <TextInput label="Site"              value="Manchester Plant"     placeholder="—" readOnly />
            <TextInput label="Department"        value="Mechanical Maintenance" placeholder="—" readOnly />
            <TextInput label="Employment Type"   value="Permanent Full-Time"  placeholder="—" readOnly />
            <div className="sm:col-span-2">
              <TextInput label="Line Manager"    value="Sarah Thompson"       placeholder="—" readOnly />
            </div>
          </div>
          <p className="text-[11px] text-slate-600">Company, site and manager details are managed by your administrator.</p>
        </SectionCard>
      </div>

      {/* ── Availability & Preferences ──────────────────────────────────────── */}
      <SectionCard
        title="Availability & Preferences"
        sub="Controls what opportunities and shifts you are matched against"
        badge={<Briefcase className="h-4 w-4 shrink-0 text-slate-600" />}
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <SelectInput
            label="Availability Status"
            value={availability}
            onChange={setAvailability}
            options={[
              { value: "available", label: "Available"         },
              { value: "limited",   label: "Limited"           },
              { value: "unavailable", label: "Not Available"   },
            ]}
          />
          <SelectInput
            label="Shift Preference"
            value={shiftPref}
            onChange={setShiftPref}
            options={[
              { value: "days",      label: "Days Only"         },
              { value: "nights",    label: "Nights Only"       },
              { value: "rotating",  label: "Rotating Shifts"   },
              { value: "flexible",  label: "Flexible"          },
            ]}
          />
          <SelectInput
            label="Travel Radius (miles)"
            value={travelRadius}
            onChange={setTravelRadius}
            options={[
              { value: "10",  label: "Up to 10 miles"  },
              { value: "25",  label: "Up to 25 miles"  },
              { value: "50",  label: "Up to 50 miles"  },
              { value: "100", label: "Up to 100 miles" },
              { value: "any", label: "No limit"        },
            ]}
          />
          <SelectInput
            label="Remote Support"
            value={remote}
            onChange={setRemote}
            options={[
              { value: "yes", label: "Available for remote" },
              { value: "no",  label: "On-site only"         },
            ]}
          />
          <SelectInput
            label="Overtime Availability"
            value={overtime}
            onChange={setOvertime}
            options={[
              { value: "yes",      label: "Available"       },
              { value: "limited",  label: "Limited"         },
              { value: "no",       label: "Not available"   },
            ]}
          />
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Opportunity Matching</label>
            <div
              className={`flex h-9 cursor-pointer items-center justify-between rounded-lg border px-3 transition-colors ${matching ? "border-blue-500/40 bg-[#3b82f610]" : "border-gray-700 bg-[#0b0e14]"}`}
              onClick={() => setMatching((m) => !m)}
            >
              <span className={`text-sm font-medium ${matching ? "text-blue-400" : "text-slate-500"}`}>{matching ? "Enabled" : "Disabled"}</span>
              <div className={`relative h-5 w-9 rounded-full transition-colors ${matching ? "bg-blue-500" : "bg-gray-700"}`}>
                <span className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${matching ? "translate-x-4" : "translate-x-0"}`} />
              </div>
            </div>
          </div>
        </div>
        {availability !== "available" && (
          <div className="flex items-start gap-2.5 rounded-lg border border-[#f9731625] bg-[#f9731608] px-4 py-3">
            <Zap className="h-4 w-4 shrink-0 text-orange-400 mt-0.5" />
            <p className="text-[11px] leading-relaxed text-slate-400">
              Availability is set to <span className="font-semibold text-orange-400">{availability === "limited" ? "Limited" : "Not Available"}</span>.
              Changing to <span className="font-semibold text-emerald-400">Available</span> opens additional matched opportunities.
            </p>
          </div>
        )}
      </SectionCard>

      {/* ── Skills Summary + Notifications (2-col on xl) ─────────────────────── */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">

        {/* Skills & Cert Summary */}
        <SectionCard
          title="Skills & Certification Summary"
          sub="Read-only overview — manage from dedicated pages"
        >
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "Skills Score",         value: "74%",  sub: "Overall",                   cls: "text-yellow-400" },
              { label: "Validated Skills",      value: "6",    sub: "Manager verified",           cls: "text-emerald-400" },
              { label: "Expiring Certs",        value: "2",    sub: "In next 90 days",            cls: "text-orange-400" },
              { label: "Training Readiness",    value: "71%",  sub: "Courses complete",           cls: "text-blue-400"   },
            ].map(({ label, value, sub, cls }) => (
              <div key={label} className="flex flex-col gap-1 rounded-lg border border-gray-800 bg-[#0f1318] p-3">
                <p className="text-[11px] text-slate-500">{label}</p>
                <p className={`text-lg font-bold tabular-nums ${cls}`}>{value}</p>
                <p className="text-[10px] text-slate-600">{sub}</p>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap gap-2 pt-1">
            <Button size="sm" variant="outline"
              className="h-7 gap-1.5 border-gray-700 bg-transparent text-slate-400 hover:border-blue-500/40 hover:text-blue-400 text-xs">
              <Network className="h-3.5 w-3.5" />Go to My Skills
            </Button>
            <Button size="sm" variant="outline"
              className="h-7 gap-1.5 border-gray-700 bg-transparent text-slate-400 hover:border-blue-500/40 hover:text-blue-400 text-xs">
              <Award className="h-3.5 w-3.5" />Go to Certifications
            </Button>
          </div>
        </SectionCard>

        {/* Notification Preferences */}
        <SectionCard
          title="Notification Preferences"
          sub="Choose what alerts and updates you receive"
          badge={<Bell className="h-4 w-4 shrink-0 text-slate-600" />}
        >
          <div className="flex flex-col">
            {NOTIF_FIELDS.map(({ label, sub, key }) => (
              <Toggle
                key={key}
                label={label}
                sub={sub}
                checked={notifs[key]}
                onChange={() => toggleNotif(key)}
              />
            ))}
          </div>
        </SectionCard>
      </div>

      {/* ── AI Profile Recommendations ───────────────────────────────────────── */}
      <Card className="min-w-0 w-full rounded-xl border border-gray-800 bg-[#141820] shadow-none">
        <CardContent className="flex min-w-0 flex-col gap-4 p-5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex flex-col gap-0.5">
              <h2 className="text-sm font-semibold text-slate-200">AI Profile Recommendations</h2>
              <p className="text-[11px] text-slate-500">Personalised actions to improve your profile completeness and match score</p>
            </div>
            <Badge className="inline-flex h-auto shrink-0 items-center gap-1.5 rounded bg-[#3b82f620] px-2 py-1 text-xs font-medium text-blue-400 shadow-none hover:bg-[#3b82f620]">
              <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />Live
            </Badge>
          </div>
          <AiActionsPanel actions={AI_ACTIONS} />
        </CardContent>
      </Card>

      {/* ── Quick Actions ────────────────────────────────────────────────────── */}
      <Card className="min-w-0 rounded-xl border border-gray-800 bg-[#141820] shadow-none">
        <CardContent className="flex flex-col gap-4 p-5">
          <h2 className="text-sm font-semibold text-slate-200">Quick Actions</h2>
          <div className="flex flex-wrap gap-2">
            {[
              { label: "Update Skills",      icon: Sparkles      },
              { label: "Upload Certificate", icon: Upload        },
              { label: "Book Training",      icon: GraduationCap },
              { label: "View Opportunities", icon: ShoppingBag   },
              { label: "Contact Manager",    icon: MessageSquare },
            ].map(({ label, icon: Icon }) => (
              <Button key={label} size="sm" variant="outline"
                className="h-8 gap-1.5 border-gray-700 bg-transparent text-slate-400 hover:border-blue-500/40 hover:text-blue-400 text-xs">
                <Icon className="h-3.5 w-3.5 shrink-0" />{label}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

    </section>
  );
}
