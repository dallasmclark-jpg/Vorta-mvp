import { useNavigate, useParams } from "react-router-dom";
import { ChevronRight, AlertTriangle, Users, Wrench, BookOpen, ClipboardList } from "lucide-react";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Progress } from "../../components/ui/progress";

// ─── Types ────────────────────────────────────────────────────────────────────

interface KeyDriver {
  label: string;
  detail: string;
}

interface AffectedPerson {
  name: string;
  role: string;
  note: string;
}

interface RecommendedAction {
  title: string;
  priority: "High" | "Med" | "Low";
  category: string;
  status: "Open" | "In Progress" | "Review";
}

interface ActionQueueItem {
  title: string;
  owner: string;
  due: string;
}

interface RiskDetail {
  slug: string;
  title: string;
  score: number;
  level: "Critical" | "High" | "Med" | "Low";
  summary: string;
  keyDrivers: KeyDriver[];
  affected: AffectedPerson[];
  recommendedActions: RecommendedAction[];
  actionQueue: ActionQueueItem[];
}

// ─── Static data ──────────────────────────────────────────────────────────────

const RISK_DATA: Record<string, RiskDetail> = {
  "shift-cover": {
    slug: "shift-cover",
    title: "Shift Cover",
    score: 85,
    level: "Critical",
    summary:
      "Night shift is currently uncovered for mechanical and electrical roles. Two engineers finishing at 18:00 leaves no qualified cover from 18:00–06:00. This creates an unacceptable gap for reactive maintenance response on critical lines.",
    keyDrivers: [
      { label: "Night shift vacancy", detail: "No mechanical engineer scheduled 18:00–06:00" },
      { label: "Annual leave overlap", detail: "Two engineers on leave simultaneously this week" },
      { label: "Contractor lead time", detail: "Nearest on-call contractor has a 4-hour response window" },
      { label: "Critical line exposure", detail: "Case Packer 4 and Filling Line 2 both flagged as critical with no overnight cover" },
    ],
    affected: [
      { name: "James Holloway", role: "Mechanical Engineer", note: "Off shift at 18:00, no replacement booked" },
      { name: "Priya Nair", role: "Electrical Engineer", note: "Annual leave Tue–Thu" },
      { name: "Night Shift (unassigned)", role: "Reactive Maintenance", note: "No engineer allocated" },
    ],
    recommendedActions: [
      { title: "Book an on-call contractor for Tue–Thu nights", priority: "High", category: "Resourcing", status: "Open" },
      { title: "Offer overtime to James Holloway for Wed night", priority: "High", category: "Labour", status: "Open" },
      { title: "Set automated escalation alert for night shift faults", priority: "Med", category: "Process", status: "Review" },
    ],
    actionQueue: [
      { title: "Confirm contractor availability for Tue night", owner: "Maintenance Planner", due: "Today" },
      { title: "Update shift rota with confirmed cover", owner: "Shift Manager", due: "Tomorrow" },
      { title: "Brief night shift on escalation procedure", owner: "Engineering Lead", due: "This week" },
    ],
  },

  "single-point-failure": {
    slug: "single-point-failure",
    title: "Single Point of Failure",
    score: 72,
    level: "High",
    summary:
      "Only one engineer in the team holds sufficient competency for Siemens S7 PLC fault diagnosis on the main production lines. If this individual is absent, any PLC-related fault on Lines 1–3 will require external support, increasing MTTR significantly.",
    keyDrivers: [
      { label: "Single PLC SME", detail: "Only Tom Reeves is trained to Siemens S7 Level 3" },
      { label: "Lines 1–3 dependency", detail: "All three production lines rely on the same PLC architecture" },
      { label: "No backup trained", detail: "Cross-training programme not yet started" },
      { label: "Contractor gap", detail: "No approved contractor holds equivalent PLC certification on site" },
    ],
    affected: [
      { name: "Tom Reeves", role: "Senior Electrical Engineer", note: "Sole S7 PLC qualified engineer" },
      { name: "Line 1 / Line 2 / Line 3", role: "Production Lines", note: "All depend on S7 PLC architecture" },
      { name: "Liam Burke", role: "Electrical Engineer", note: "Nominated for cross-training — not yet started" },
    ],
    recommendedActions: [
      { title: "Initiate Siemens S7 cross-training for Liam Burke", priority: "High", category: "Training", status: "Open" },
      { title: "Identify an approved PLC contractor as emergency backup", priority: "High", category: "Resourcing", status: "Open" },
      { title: "Document fault-diagnosis procedures for common PLC faults", priority: "Med", category: "Knowledge", status: "Open" },
    ],
    actionQueue: [
      { title: "Enrol Liam Burke on Siemens S7 training course", owner: "Training Coordinator", due: "This week" },
      { title: "Contact preferred PLC contractor and confirm SLA", owner: "Maintenance Manager", due: "This week" },
      { title: "Create S7 fault runbook in knowledge base", owner: "Tom Reeves", due: "Next 2 weeks" },
    ],
  },

  "annual-leave": {
    slug: "annual-leave",
    title: "Annual Leave",
    score: 68,
    level: "Med",
    summary:
      "Three engineers are on annual leave this week with partial overlap. Cover has been arranged for two of the three, leaving one mechanical shift partially exposed. Risk is manageable but warrants monitoring throughout the week.",
    keyDrivers: [
      { label: "Three concurrent absences", detail: "Priya Nair, Gareth Owen, and Chloe Armstrong all absent this week" },
      { label: "Partial cover only", detail: "Contractor booked for Wed–Fri; Mon–Tue has reduced capacity" },
      { label: "Shutdown period approaching", detail: "Annual leave overlapping with pre-shutdown preparation window" },
      { label: "No formal deconfliction policy", detail: "Leave approvals not cross-checked against risk threshold" },
    ],
    affected: [
      { name: "Priya Nair", role: "Electrical Engineer", note: "On leave Tue–Thu" },
      { name: "Gareth Owen", role: "Mechanical Engineer", note: "On leave Mon–Wed" },
      { name: "Chloe Armstrong", role: "Instrumentation Tech", note: "On leave all week" },
    ],
    recommendedActions: [
      { title: "Confirm contractor cover for Mon–Tue electrical gap", priority: "High", category: "Resourcing", status: "In Progress" },
      { title: "Introduce leave deconfliction checks in rota system", priority: "Med", category: "Process", status: "Open" },
      { title: "Assign PM backlog tasks before engineers leave", priority: "Med", category: "Planning", status: "Open" },
    ],
    actionQueue: [
      { title: "Confirm Mon–Tue electrical cover", owner: "Shift Manager", due: "Today" },
      { title: "Reschedule Chloe Armstrong calibration tasks", owner: "Maintenance Planner", due: "Today" },
      { title: "Review leave policy for concurrent absences", owner: "Engineering Lead", due: "This month" },
    ],
  },

  "training-expiring": {
    slug: "training-expiring",
    title: "Training Expiring",
    score: 54,
    level: "Med",
    summary:
      "Two engineers have safety-critical certifications expiring within 14 days. If not renewed, they will be restricted from working on specific equipment, creating a skill coverage gap on pressure systems and high-voltage assets.",
    keyDrivers: [
      { label: "PSSR certification expiry", detail: "James Holloway's Pressure Systems Safety Regulations cert expires in 7 days" },
      { label: "HV authorisation renewal", detail: "Kezia Mutasa's high-voltage authorisation expires in 12 days" },
      { label: "Booking not confirmed", detail: "Renewal training not yet booked for either engineer" },
      { label: "No temporary cover arranged", detail: "No other engineer on shift holds equivalent authorisation" },
    ],
    affected: [
      { name: "James Holloway", role: "Mechanical Engineer", note: "PSSR cert expires in 7 days" },
      { name: "Kezia Mutasa", role: "Electrical Engineer", note: "HV authorisation expires in 12 days" },
    ],
    recommendedActions: [
      { title: "Book PSSR renewal course for James Holloway immediately", priority: "High", category: "Training", status: "Open" },
      { title: "Confirm HV reauthorisation date for Kezia Mutasa", priority: "High", category: "Training", status: "Open" },
      { title: "Set automatic 30-day cert expiry alerts in training system", priority: "Low", category: "Process", status: "Open" },
    ],
    actionQueue: [
      { title: "Book James Holloway PSSR renewal", owner: "Training Coordinator", due: "Today" },
      { title: "Book Kezia Mutasa HV reauthorisation", owner: "Training Coordinator", due: "Tomorrow" },
      { title: "Enable cert expiry alerts in training system", owner: "System Admin", due: "This week" },
    ],
  },

  "skill-gaps": {
    slug: "skill-gaps",
    title: "Skill Gaps",
    score: 46,
    level: "Low",
    summary:
      "The maintenance team has identified gaps in PLC programming competency and hydraulic systems diagnostics. These gaps are not immediately critical but limit the team's ability to handle complex faults without external assistance.",
    keyDrivers: [
      { label: "PLC programming gap", detail: "3 engineers rated below competency threshold for PLC fault diagnosis" },
      { label: "Hydraulics knowledge", detail: "Only 1 engineer qualified for hydraulic press servicing on Line 4" },
      { label: "Training plan not formalised", detail: "Skill gap training has not been scheduled in the annual plan" },
      { label: "New equipment arriving", detail: "Hydraulic press upgrade due next quarter — current team not yet trained" },
    ],
    affected: [
      { name: "Liam Burke", role: "Electrical Engineer", note: "Below threshold on PLC fault diagnosis" },
      { name: "Sofia Brennan", role: "Mechanical Engineer", note: "Below threshold on hydraulics diagnostics" },
      { name: "Dan Yates", role: "Multi-skilled Tech", note: "Below threshold on both PLC and hydraulics" },
    ],
    recommendedActions: [
      { title: "Schedule PLC Level 2 training for Liam Burke and Dan Yates", priority: "Med", category: "Training", status: "Open" },
      { title: "Arrange hydraulics awareness session for Sofia Brennan", priority: "Med", category: "Training", status: "Open" },
      { title: "Add skill gap actions to annual training plan", priority: "Low", category: "Planning", status: "Open" },
    ],
    actionQueue: [
      { title: "Identify PLC Level 2 course dates and provider", owner: "Training Coordinator", due: "This week" },
      { title: "Add hydraulics training to Q3 training plan", owner: "Engineering Lead", due: "This week" },
      { title: "Update skills matrix with current ratings", owner: "Maintenance Manager", due: "This month" },
    ],
  },

  "contractor-reliance": {
    slug: "contractor-reliance",
    title: "Contractor Reliance",
    score: 32,
    level: "Low",
    summary:
      "Contractor usage is currently within acceptable limits. Two specialist contractors are engaged for periodic maintenance tasks. Reliance is stable but should be monitored as internal training develops.",
    keyDrivers: [
      { label: "Specialist contractors in use", detail: "Contractor A covers refrigeration; Contractor B covers HV switching" },
      { label: "Within approved threshold", detail: "Contractor spend and hours within agreed annual budget" },
      { label: "SLAs in place", detail: "Both contractors have signed response SLAs for emergency call-out" },
      { label: "Internal capability developing", detail: "One engineer currently undergoing HV authorisation training" },
    ],
    affected: [
      { name: "Contractor A — RefriTech Ltd", role: "Refrigeration Specialist", note: "Quarterly PM visits and reactive call-out" },
      { name: "Contractor B — PowerSafe UK", role: "HV Switching Specialist", note: "Planned and reactive HV switching operations" },
    ],
    recommendedActions: [
      { title: "Continue monitoring contractor hours against budget threshold", priority: "Low", category: "Governance", status: "Open" },
      { title: "Progress internal HV training to reduce Contractor B dependency", priority: "Med", category: "Training", status: "In Progress" },
      { title: "Review contractor SLAs at next contract renewal", priority: "Low", category: "Governance", status: "Open" },
    ],
    actionQueue: [
      { title: "Review contractor usage report at monthly ops meeting", owner: "Maintenance Manager", due: "End of month" },
      { title: "Track HV training progress for internal engineer", owner: "Training Coordinator", due: "This month" },
      { title: "Prepare contractor renewal briefing", owner: "Maintenance Manager", due: "Next month" },
    ],
  },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getLevelColors(level: RiskDetail["level"]) {
  switch (level) {
    case "Critical": return { badge: "bg-[#ef444420] text-red-500 hover:bg-[#ef444420]", progress: "bg-red-500" };
    case "High":     return { badge: "bg-[#f9731620] text-orange-400 hover:bg-[#f9731620]", progress: "bg-orange-400" };
    case "Med":      return { badge: "bg-[#facc1520] text-yellow-400 hover:bg-[#facc1520]", progress: "bg-yellow-400" };
    case "Low":      return { badge: "bg-[#10b98120] text-emerald-500 hover:bg-[#10b98120]", progress: "bg-emerald-500" };
  }
}

function getPriorityClass(priority: RecommendedAction["priority"]) {
  switch (priority) {
    case "High": return "text-red-400";
    case "Med":  return "text-yellow-400";
    case "Low":  return "text-emerald-500";
  }
}

function getStatusClass(status: RecommendedAction["status"]) {
  switch (status) {
    case "Open":        return { badge: "bg-[#10b98120] text-emerald-500", dot: "bg-emerald-500" };
    case "In Progress": return { badge: "bg-[#3b82f620] text-blue-400",   dot: "bg-blue-400" };
    case "Review":      return { badge: "bg-[#facc1520] text-yellow-400",  dot: "bg-yellow-400" };
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

export const LabourRiskDetailPage = (): JSX.Element => {
  const { riskType } = useParams<{ riskType: string }>();
  const navigate = useNavigate();

  const detail = riskType ? RISK_DATA[riskType] : undefined;

  if (!detail) {
    return (
      <section className="flex w-full flex-col gap-6 px-4 pb-12 pt-4 md:px-6 xl:px-8">
        <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-sm text-slate-400">
          <button
            type="button"
            onClick={() => navigate("/dashboard")}
            className="transition-colors hover:text-slate-200"
          >
            Dashboard
          </button>
          <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
          <span className="text-slate-200">Labour Risk</span>
        </nav>
        <div className="flex flex-col items-center justify-center gap-3 py-24 text-center">
          <AlertTriangle className="h-8 w-8 text-slate-500" aria-hidden="true" />
          <p className="text-base font-semibold text-slate-50">Risk type not found</p>
          <p className="text-sm text-slate-400">The risk category you are looking for does not exist.</p>
          <Button
            type="button"
            variant="secondary"
            className="mt-2 h-auto border border-white/10 bg-white/10 px-4 py-2 text-sm font-semibold text-slate-50 hover:bg-white/15"
            onClick={() => navigate("/dashboard")}
          >
            Back to Dashboard
          </Button>
        </div>
      </section>
    );
  }

  const colors = getLevelColors(detail.level);

  return (
    <section className="flex w-full flex-col gap-6 px-4 pb-12 pt-4 md:px-6 xl:px-8">

      {/* ── Breadcrumb ──────────────────────────────────────────────── */}
      <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-sm text-slate-400">
        <button
          type="button"
          onClick={() => navigate("/dashboard")}
          className="transition-colors hover:text-slate-200"
        >
          Dashboard
        </button>
        <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
        <span className="text-slate-400">Labour Risk</span>
        <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
        <span className="text-slate-200">{detail.title}</span>
      </nav>

      {/* ── Page header ─────────────────────────────────────────────── */}
      <header className="flex w-full flex-col justify-between gap-4 border-b border-white/10 pb-5 md:flex-row md:items-start">
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-xl font-semibold tracking-tight text-slate-50">{detail.title}</h1>
            <Badge
              variant="secondary"
              className={`rounded px-2 py-1 text-xs font-medium shadow-none ${colors.badge}`}
            >
              {detail.level}
            </Badge>
          </div>
          <p className="text-sm text-slate-400">Labour Risk Detail</p>
        </div>
        <Button
          type="button"
          variant="secondary"
          className="h-auto shrink-0 border border-white/10 bg-white/10 px-4 py-2 text-sm font-semibold text-slate-50 shadow-none hover:bg-white/15 hover:text-slate-50"
          onClick={() => navigate("/dashboard")}
        >
          Back to Dashboard
        </Button>
      </header>

      {/* ── Score + summary row ──────────────────────────────────────── */}
      <div className="grid w-full grid-cols-1 gap-4 lg:grid-cols-[200px_1fr]">
        <Card className="rounded-xl border border-gray-800 bg-[#141820] shadow-none">
          <CardContent className="flex h-full flex-col items-start gap-3 p-5">
            <p className="text-xs text-slate-400">Risk Score</p>
            <p className="text-4xl font-semibold text-slate-50">{detail.score}</p>
            <div className="flex w-full flex-col gap-1.5">
              <div className="relative h-2 w-full overflow-hidden rounded bg-gray-800">
                <div
                  className={`h-full rounded ${colors.progress}`}
                  style={{ width: `${detail.score}%` }}
                />
              </div>
              <Badge
                variant="secondary"
                className={`w-fit rounded px-2 py-1 text-xs font-medium shadow-none ${colors.badge}`}
              >
                {detail.level} Risk
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-xl border border-gray-800 bg-[#141820] shadow-none">
          <CardContent className="flex h-full flex-col gap-2 p-5">
            <h2 className="text-sm font-semibold text-slate-50">Summary</h2>
            <p className="text-sm leading-relaxed text-slate-400">{detail.summary}</p>
          </CardContent>
        </Card>
      </div>

      {/* ── Key drivers ─────────────────────────────────────────────── */}
      <section className="flex w-full flex-col gap-4">
        <h2 className="text-base font-semibold text-slate-50">Key Drivers</h2>
        <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {detail.keyDrivers.map((driver) => (
            <Card
              key={driver.label}
              className="rounded-xl border border-gray-800 bg-[#141820] shadow-none"
            >
              <CardContent className="flex flex-col gap-1.5 p-4">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-yellow-400" aria-hidden="true" />
                  <p className="text-sm font-semibold text-slate-50">{driver.label}</p>
                </div>
                <p className="pl-[22px] text-xs text-slate-400">{driver.detail}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* ── Affected engineers / roles ───────────────────────────────── */}
      <section className="flex w-full flex-col gap-4">
        <h2 className="text-base font-semibold text-slate-50">Affected Engineers / Roles</h2>
        {detail.affected.length === 0 ? (
          <Card className="rounded-xl border border-gray-800 bg-[#141820] shadow-none">
            <CardContent className="flex items-center justify-center p-8">
              <p className="text-sm text-slate-400">No affected individuals identified.</p>
            </CardContent>
          </Card>
        ) : (
          <Card className="rounded-xl border border-gray-800 bg-[#141820] shadow-none">
            <CardContent className="p-0">
              <div className="flex w-full flex-col">
                {detail.affected.map((person, index) => (
                  <div
                    key={person.name}
                    className={`flex w-full flex-col gap-1 px-5 py-4 sm:flex-row sm:items-center sm:gap-4 ${
                      index !== detail.affected.length - 1 ? "border-b border-gray-800" : ""
                    }`}
                  >
                    <div className="flex items-center gap-3 sm:w-[220px] sm:shrink-0">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/10">
                        <Users className="h-4 w-4 text-slate-400" aria-hidden="true" />
                      </div>
                      <span className="text-sm font-semibold text-slate-50">{person.name}</span>
                    </div>
                    <span className="pl-11 text-sm text-slate-400 sm:w-[200px] sm:shrink-0 sm:pl-0">{person.role}</span>
                    <span className="pl-11 text-sm text-slate-400 sm:pl-0">{person.note}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </section>

      {/* ── Recommended actions + Action queue ──────────────────────── */}
      <div className="grid w-full grid-cols-1 gap-4 lg:grid-cols-[1fr_360px]">

        {/* Recommended actions */}
        <section className="flex flex-col gap-4">
          <h2 className="text-base font-semibold text-slate-50">Recommended Actions</h2>
          {detail.recommendedActions.length === 0 ? (
            <Card className="rounded-xl border border-gray-800 bg-[#141820] shadow-none">
              <CardContent className="flex items-center justify-center p-8">
                <p className="text-sm text-slate-400">No recommended actions at this time.</p>
              </CardContent>
            </Card>
          ) : (
            <Card className="rounded-xl border border-gray-800 bg-[#141820] shadow-none">
              <CardContent className="p-0">
                <div className="flex w-full flex-col">
                  {detail.recommendedActions.map((action, index) => {
                    const statusColors = getStatusClass(action.status);
                    return (
                      <div
                        key={action.title}
                        className={`flex flex-col gap-2 px-5 py-4 ${
                          index !== detail.recommendedActions.length - 1 ? "border-b border-gray-800" : ""
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <p className="text-sm font-semibold leading-snug text-slate-50">{action.title}</p>
                          <span className={`shrink-0 text-sm font-semibold ${getPriorityClass(action.priority)}`}>
                            {action.priority}
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge
                            variant="secondary"
                            className={`inline-flex h-auto items-center gap-1.5 rounded px-2 py-1 text-xs font-medium shadow-none ${statusColors.badge}`}
                          >
                            <span className={`h-1.5 w-1.5 rounded-full ${statusColors.dot}`} />
                            {action.status}
                          </Badge>
                          <Badge
                            variant="secondary"
                            className="h-auto rounded bg-white/10 px-2 py-1 text-xs font-medium text-slate-300 shadow-none hover:bg-white/10"
                          >
                            {action.category}
                          </Badge>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </section>

        {/* Action queue */}
        <section className="flex flex-col gap-4">
          <h2 className="text-base font-semibold text-slate-50">Action Queue</h2>
          {detail.actionQueue.length === 0 ? (
            <Card className="rounded-xl border border-gray-800 bg-[#141820] shadow-none">
              <CardContent className="flex items-center justify-center p-8">
                <p className="text-sm text-slate-400">Action queue is empty.</p>
              </CardContent>
            </Card>
          ) : (
            <Card className="rounded-xl border border-gray-800 bg-[#141820] shadow-none">
              <CardContent className="p-0">
                <div className="flex w-full flex-col">
                  {detail.actionQueue.map((item, index) => (
                    <div
                      key={item.title}
                      className={`flex flex-col gap-1.5 px-5 py-4 ${
                        index !== detail.actionQueue.length - 1 ? "border-b border-gray-800" : ""
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <p className="text-sm font-semibold leading-snug text-slate-50">{item.title}</p>
                        <span className="shrink-0 text-xs font-medium text-slate-400">{item.due}</span>
                      </div>
                      <p className="text-xs text-slate-400">{item.owner}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </section>
      </div>

    </section>
  );
};
