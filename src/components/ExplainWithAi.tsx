import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, ArrowRight, CheckCircle2, Sparkles, X } from "lucide-react";
import { AiAnalysing } from "./AiAnalysing";

// ─── Page explanations ────────────────────────────────────────────────────────

interface PageExplanation {
  title: string;
  summary: string;
  risks: string[];
  actions: string[];
}

const EXPLANATIONS: Record<string, PageExplanation> = {
  dashboard: {
    title: "Workforce Capability Dashboard",
    summary:
      "This page shows your live workforce capability overview for Alpha Manufacturing. It aggregates skills coverage, training compliance, engineer readiness and equipment risk from across your site in real time.",
    risks: [
      "Critical skill gaps exist where fewer engineers than required are qualified — these create SPOF (single-point-of-failure) risk on shift.",
      "Training compliance is a key risk driver this quarter. Certifications expiring in the next 30 days must be renewed to stay compliant.",
      "Equipment with low skill coverage may become inoperable if the one qualified engineer is absent.",
    ],
    actions: [
      "Book training for the highest-risk skill gaps shown in the Critical Risks panel.",
      "Open the Skills Matrix to identify which engineers need cross-training.",
      "Generate a full site readiness report via AI Reports for management review.",
    ],
  },
  engineers: {
    title: "Engineers Directory",
    summary:
      "This page shows the full directory of maintenance engineers on site, including their skills, certifications, availability, competency scores and AI-generated risk ratings.",
    risks: [
      "Engineers with low competency scores on critical skills create operational risk, especially on night shifts.",
      "Certifications approaching expiry will cause compliance failures if not renewed in time.",
      "Engineers marked as single-point-of-failure holders have no qualified backup — absence creates a site risk.",
    ],
    actions: [
      "Review all engineers with certifications expiring within 30 days and book renewals.",
      "Identify engineers who hold SPOF skills and cross-train a colleague.",
      "Use AI Matching to find the best-fit engineers for open requirements.",
    ],
  },
  equipment: {
    title: "Equipment & Asset Register",
    summary:
      "This page tracks your critical site assets and maps them to the engineer skills required to maintain and operate them safely. Coverage scores show how well your team is prepared for each asset.",
    risks: [
      "Assets with a 'Gap' coverage status have fewer qualified engineers than required — these are operational liabilities.",
      "Critical assets with only one qualified engineer are at high risk during holidays, sickness or turnover.",
      "Assets rated 'At Risk' or 'Watch' may already be experiencing maintenance issues caused by skill shortfalls.",
    ],
    actions: [
      "Book skills training for the highest-criticality assets with gap coverage.",
      "Assign a backup engineer to any critical asset with fewer than 2 qualified engineers.",
      "Export this report and share with your maintenance manager for workforce planning.",
    ],
  },
  requirements: {
    title: "Requirements Coverage",
    summary:
      "This page defines and tracks the minimum skill coverage requirements for your site. Each requirement specifies how many engineers must be competent in a given skill area, and AI monitors compliance in real time.",
    risks: [
      "Requirements marked 'Critical Gap' have zero or insufficient qualified engineers — these are immediate compliance and safety risks.",
      "Partial gaps mean coverage is below the required minimum. While not immediately critical, they need attention before shifts rotate.",
      "Single-point-of-failure requirements are the highest priority — they depend on a single engineer who could become unavailable.",
    ],
    actions: [
      "Address Critical Gap requirements immediately by booking training or temporarily assigning contractors.",
      "Use AI Matching to find the best-fit engineers to cover Partial Gap requirements.",
      "Add any missing requirements so AI can track full site coverage accurately.",
    ],
  },
  "skills-matrix": {
    title: "Skills Matrix",
    summary:
      "This page shows a structured view of every skill across your maintenance team, including competency levels, risk ratings and coverage counts. It is the foundation of Vorta's AI capability scoring.",
    risks: [
      "Skills with a 'Critical' risk rating have dangerously low qualified engineer counts — often just one or zero.",
      "Skills linked to high-criticality equipment carry the most operational risk when coverage falls below minimum.",
      "Skill gaps that span multiple departments indicate a systemic training deficit rather than individual shortfalls.",
    ],
    actions: [
      "Sort by risk level and target Critical skills with training bookings first.",
      "Cross-reference with the Equipment page to see which assets are most exposed.",
      "Export the full matrix to support workforce development planning with HR.",
    ],
  },
  "ai-matching": {
    title: "AI Matching Engine",
    summary:
      "This page uses Vorta's AI to match engineers to open skill requirements based on competency scores, certifications, availability and risk ratings. Match scores indicate how well each engineer covers a given requirement.",
    risks: [
      "Low match scores indicate a skills deficit across the entire team for a given requirement — training rather than reassignment may be needed.",
      "Critical skill gaps with no engineers above 60% match require urgent training investment or contractor engagement.",
      "Requirements with no available engineers (all on shift or absent) create immediate shift coverage risk.",
    ],
    actions: [
      "Accept the highest-scoring match for each open requirement to establish baseline coverage.",
      "Book training for engineers who score 40–70% on critical requirements to build their scores.",
      "Export the AI match report to share with site management for resourcing decisions.",
    ],
  },
  training: {
    title: "Training Bookings",
    summary:
      "This page manages all training bookings for your maintenance team, tracks spend, compliance rates and upcoming certification renewals. AI ranks engineers for training based on skill gaps and equipment risk.",
    risks: [
      "Overdue training creates immediate compliance risk — engineers may be operating equipment without valid certifications.",
      "Expiring certifications in the next 30 days must be renewed promptly to avoid gaps in legal compliance.",
      "Engineers with multiple critical skill gaps are higher-priority for training than those with minor gaps.",
    ],
    actions: [
      "Review the Priority Training table and book the top-ranked courses immediately.",
      "Set up reminders for certifications expiring in the next 90 days.",
      "Use AI Matching to check which trained engineers can now cover previously open requirements.",
    ],
  },
  support: {
    title: "Support Centre",
    summary:
      "This page lets you raise support tickets, browse guides and contact the Vorta team. You can report technical issues, request features or get help with the platform.",
    risks: [
      "Unresolved technical issues may prevent accurate skills tracking — raise a ticket promptly if data looks incorrect.",
      "Configuration issues (incorrect requirements, wrong engineer counts) can cause misleading AI match scores.",
    ],
    actions: [
      "Raise a ticket for any data discrepancies or technical issues you have noticed.",
      "Browse the guides section before raising a ticket — most questions are covered there.",
      "Contact support for help migrating legacy skills data or configuring bulk imports.",
    ],
  },
  settings: {
    title: "Account Settings",
    summary:
      "This page manages your organisation's Vorta configuration including user accounts, notification preferences, data sources and system integrations.",
    risks: [
      "Inactive users with admin access are a security risk — review the team list periodically.",
      "Notification settings that are too infrequent may delay awareness of critical skill gap changes.",
    ],
    actions: [
      "Review user access levels and remove or downgrade accounts that no longer need admin rights.",
      "Enable weekly digest notifications so team leads are kept informed without being overwhelmed.",
      "Check data integration settings to ensure Vorta is pulling the latest engineer and equipment data.",
    ],
  },
  "contractor-dashboard": {
    title: "Contractor Dashboard",
    summary:
      "Your contractor company command centre showing workforce availability, matched opportunities, active assignments and AI-prioritised actions. Everything here is specific to your contractor company and updated in real time.",
    risks: [
      "Low engineer availability reduces your ability to respond to new opportunities — review utilisation and free up capacity.",
      "Unresponded opportunities expire — high-match requirements should be actioned within 24–48 hours.",
      "Compliance gaps in engineer certifications can block assignment readiness and delay site access approvals.",
    ],
    actions: [
      "Review AI Recommendations for the highest-priority workforce and compliance actions.",
      "Check Opportunities for new matched requirements and respond before they expire.",
      "Confirm engineer availability is up to date before accepting new assignments.",
    ],
  },
  "contractor-company-profile": {
    title: "Company Profile",
    summary:
      "Manage your contractor company's Vorta profile, marketplace presence, capabilities and compliance status. This is the information sites and customers see when evaluating your company for opportunities.",
    risks: [
      "An incomplete profile reduces your visibility to manufacturing sites browsing the marketplace.",
      "Outdated capability descriptions may cause mismatches between your skills and site requirements.",
      "Missing compliance documentation can block automatic verification and delay opportunity responses.",
    ],
    actions: [
      "Ensure your service regions, capabilities and emergency callout availability are accurate.",
      "Upload any missing company compliance documents to maintain verified status.",
      "Review your marketplace visibility settings to confirm you are visible to relevant sites.",
    ],
  },
  "contractor-engineers": {
    title: "Contractor Engineers",
    summary:
      "Manage your contractor workforce — skills coverage, certifications, availability and assignment readiness. This is the foundation of your company's capability scoring and opportunity matching.",
    risks: [
      "Engineers with expiring certifications may become ineligible for specific site or assignment requirements.",
      "Low skills coverage in key disciplines reduces your match scores and opportunity eligibility.",
      "Engineers without up-to-date availability status may be excluded from AI matching.",
    ],
    actions: [
      "Review engineers with certifications expiring in the next 30 days and arrange renewals.",
      "Update availability status for any engineer whose circumstances have changed.",
      "Cross-train engineers in high-demand disciplines to improve your company's match score.",
    ],
  },
  "contractor-availability": {
    title: "Engineer Availability",
    summary:
      "Monitor your engineer workforce availability, utilisation rates and readiness for new customer opportunities. Accurate availability data directly improves your AI opportunity match scores.",
    risks: [
      "Over-utilised engineers with no available capacity will reduce your ability to accept new assignments.",
      "Stale availability data causes AI to mis-score your capacity and may result in missed opportunities.",
      "Conflicts between existing assignments and new opportunities need early identification to avoid delivery risk.",
    ],
    actions: [
      "Update engineer availability immediately after assignment completions or schedule changes.",
      "Flag engineers who are approaching full utilisation so they are excluded from new opportunity matching.",
      "Use the availability matrix to identify which engineers can be offered for upcoming requirements.",
    ],
  },
  "contractor-opportunities": {
    title: "Opportunities",
    summary:
      "Review matched customer requirements, compare engineer fit scores and decide which opportunities to respond to. AI ranks opportunities by match quality and urgency to help you prioritise.",
    risks: [
      "High-match opportunities that go unresponded within 24 hours are at risk of being taken by competing contractors.",
      "Accepting opportunities without confirming engineer availability leads to delivery risk and customer friction.",
      "Low match scores on visible opportunities suggest a skills or certification gap in your workforce.",
    ],
    actions: [
      "Sort by AI match score and respond to the highest-ranked opportunities first.",
      "Confirm engineer availability and certifications before committing to an opportunity.",
      "Review declined or expired opportunities to identify skills gaps worth addressing through training.",
    ],
  },
  "contractor-assignments": {
    title: "Assignments",
    summary:
      "Track active, upcoming and completed assignments — including engineer allocation, delivery progress, job reports, timesheets and customer approval status.",
    risks: [
      "Assignments without submitted job reports block invoice creation and delay payment.",
      "Timesheets that are overdue or unapproved create invoice blockers that affect cashflow.",
      "Assignments approaching their end date without a completion sign-off create customer satisfaction risk.",
    ],
    actions: [
      "Review active assignments and identify any without submitted job reports or approved timesheets.",
      "Chase engineer timesheets that are overdue to unblock invoice readiness.",
      "Monitor assignment delivery status and raise any risks with the customer early.",
    ],
  },
  "contractor-job-reports": {
    title: "Job Reports",
    summary:
      "Review completed work evidence, outstanding reports and customer approval status. Job reports are required to trigger invoice readiness for each assignment.",
    risks: [
      "Missing job reports block invoicing — every completed assignment needs a signed-off report to generate an invoice.",
      "Reports awaiting customer approval delay payment — follow up promptly on outstanding approvals.",
      "Incomplete or rejected reports require engineer re-submission which extends the billing cycle.",
    ],
    actions: [
      "Identify all completed assignments with missing or unsubmitted job reports and chase engineers.",
      "Follow up with customers on reports awaiting approval to unblock invoicing.",
      "Review rejected reports and work with engineers to resubmit corrected versions promptly.",
    ],
  },
  "contractor-timesheets": {
    title: "Timesheets",
    summary:
      "Track submitted hours, approval status, missing entries and invoice readiness across all assignments. Accurate timesheet data is required for invoicing and revenue recognition.",
    risks: [
      "Missing timesheets block invoice creation — all hours must be submitted and approved before invoicing.",
      "Disputed timesheets delay payment and create customer friction if not resolved promptly.",
      "Late timesheet submissions reduce your ability to forecast accurate monthly revenue.",
    ],
    actions: [
      "Review engineers with missing or overdue timesheet entries and issue reminders.",
      "Follow up on timesheets awaiting customer approval to unblock invoice readiness.",
      "Reconcile timesheet hours against assignment scope before submitting invoices.",
    ],
  },
  "contractor-invoices": {
    title: "Invoices",
    summary:
      "Monitor invoice readiness, draft and submitted invoices, payment status and blockers. This page gives you full visibility of your revenue pipeline from assignment completion to payment.",
    risks: [
      "Invoices blocked by missing job reports or unapproved timesheets delay your cashflow.",
      "Overdue invoices that have not been followed up create revenue risk.",
      "Disputed invoices can escalate into relationship issues if not resolved within the agreed timeframe.",
    ],
    actions: [
      "Review all invoice blockers and resolve the underlying job report or timesheet issues.",
      "Follow up on submitted invoices that are past their payment due date.",
      "Check draft invoices for accuracy before submission to avoid disputes.",
    ],
  },
  "contractor-compliance": {
    title: "Compliance",
    summary:
      "Monitor company documents, engineer certifications, site access readiness and expiry risks. Compliance status directly affects your marketplace visibility and assignment eligibility.",
    risks: [
      "Expired company documents can trigger automatic suspension of your marketplace listing.",
      "Engineers with expired certifications may be rejected at site induction — this creates assignment delivery risk.",
      "Compliance gaps that are not resolved before assignment start dates cause customer and reputational damage.",
    ],
    actions: [
      "Upload and renew any company documents flagged as expiring or expired.",
      "Review engineer certifications expiring within 30 days and arrange renewals.",
      "Confirm all engineers on active assignments meet the site's specific compliance requirements.",
    ],
  },
  "contractor-ai-recommendations": {
    title: "AI Recommendations",
    summary:
      "Vorta AI prioritises the most impactful workforce actions, opportunity responses, compliance risks and revenue opportunities for your contractor company. Recommendations are ranked by urgency and impact.",
    risks: [
      "Ignoring high-priority recommendations can cause compliance failures, missed opportunities or delayed revenue.",
      "Recommendations marked as urgent typically have a 24–48 hour action window before the risk escalates.",
      "AI confidence scores below 80% indicate limited data — complete your engineer profiles to improve accuracy.",
    ],
    actions: [
      "Review and action high-priority recommendations before moving to medium and low priority items.",
      "Dismiss recommendations that are no longer relevant so AI can recalibrate its prioritisation.",
      "Complete engineer profiles and certifications to improve AI match accuracy and recommendation quality.",
    ],
  },
  "contractor-settings": {
    title: "Contractor Settings",
    summary:
      "Manage contractor portal preferences, users, permissions, notifications and marketplace configuration. Settings here control how your company appears to sites and how your team accesses the portal.",
    risks: [
      "Incorrect marketplace visibility settings may hide your company from relevant site requirements.",
      "User permission gaps can leave operations managers unable to respond to opportunities in time.",
      "Notification settings that are too infrequent may delay awareness of compliance expiries or opportunity matches.",
    ],
    actions: [
      "Review user roles and ensure all team members have the correct access level.",
      "Confirm marketplace visibility and region settings are accurate before the next opportunity cycle.",
      "Enable compliance expiry and opportunity alerts to ensure timely awareness of critical events.",
    ],
  },
  "engineer-dashboard": {
    title: "Engineer Dashboard",
    summary:
      "Your personal dashboard shows your live competency profile, upcoming training, certification status, AI match score and personalised career recommendations. Everything here is specific to you and updated in real time.",
    risks: [
      "Expired certifications create compliance risk and may prevent you from being assigned to certain work orders — renew them promptly.",
      "Skill gaps reduce your AI match score and limit the roles and requirements you can be matched to.",
      "If your profile is incomplete, AI cannot generate accurate match scores or career recommendations.",
    ],
    actions: [
      "Review your Today's Priorities section and address any expired or expiring certifications immediately.",
      "Book training for your highest-priority skill gaps to improve your match score and unlock new opportunities.",
      "Complete your profile and validate pending skills to maximise your AI match accuracy.",
    ],
  },
};

// ─── Panel component ──────────────────────────────────────────────────────────

interface PanelProps {
  pageId: string;
  onClose: () => void;
  open: boolean;
}

function ExplainPanel({ pageId, onClose, open }: PanelProps) {
  const explanation = EXPLANATIONS[pageId] ?? EXPLANATIONS["dashboard"];
  const [analysing, setAnalysing] = useState(false);
  const [ready, setReady] = useState(false);
  const prevOpen = useRef(false);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (open && !prevOpen.current) {
      setReady(false);
      setAnalysing(true);
      const t = setTimeout(() => {
        setAnalysing(false);
        setReady(true);
      }, 1400);
      prevOpen.current = true;
      return () => clearTimeout(t);
    }
    if (!open) {
      prevOpen.current = false;
      setReady(false);
    }
  }, [open]);

  // Focus close button on open
  useEffect(() => {
    if (open) {
      const t = setTimeout(() => closeRef.current?.focus(), 250);
      return () => clearTimeout(t);
    }
  }, [open]);

  // Keyboard close
  useEffect(() => {
    if (!open) return;
    function handle(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handle);
    return () => document.removeEventListener("keydown", handle);
  }, [open, onClose]);

  return createPortal(
    <>
      {/* Backdrop */}
      <div
        aria-hidden="true"
        onClick={onClose}
        className={`fixed inset-0 z-[9980] bg-black/50 transition-opacity duration-200 ${
          open ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
      />

      {/* Panel */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`AI explanation: ${explanation.title}`}
        className={`fixed top-0 right-0 z-[9981] flex h-full w-full max-w-[440px] flex-col border-l border-[#1e2533] bg-[#090c12] shadow-2xl transition-transform duration-200 ease-out ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-[#1e2533] px-5 py-4">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#3b82f615]">
              <Sparkles className="h-4 w-4 text-blue-400" aria-hidden />
            </div>
            <div>
              <p className="text-[11px] font-medium uppercase tracking-widest text-slate-500">Vorta AI</p>
              <p className="text-sm font-semibold text-slate-100 leading-tight">{explanation.title}</p>
            </div>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Close explanation"
            className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-[#ffffff10] hover:text-slate-200"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-5">
          {analysing && (
            <div className="flex flex-col gap-6">
              <AiAnalysing
                message="AI is analysing this page…"
                block
                className="w-full"
              />
              {[120, 80, 100, 60, 90].map((w, i) => (
                <div key={i} className={`h-3 animate-pulse rounded bg-gray-800`} style={{ width: `${w}%` }} />
              ))}
            </div>
          )}

          {ready && (
            <div className="flex flex-col gap-6 animate-fade-in">
              {/* Summary */}
              <div className="flex flex-col gap-2">
                <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-500">What this page shows</p>
                <p className="text-sm leading-relaxed text-slate-300">{explanation.summary}</p>
              </div>

              {/* Risks */}
              <div className="flex flex-col gap-3">
                <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-500">Main risks &amp; opportunities</p>
                <div className="flex flex-col gap-2">
                  {explanation.risks.map((r, i) => (
                    <div key={i} className="flex items-start gap-2.5 rounded-lg border border-[#ef444415] bg-[#ef44440a] p-3">
                      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-orange-400" aria-hidden />
                      <p className="text-[12px] leading-relaxed text-slate-300">{r}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Actions */}
              <div className="flex flex-col gap-3">
                <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-500">Recommended next actions</p>
                <div className="flex flex-col gap-2">
                  {explanation.actions.map((a, i) => (
                    <div key={i} className="flex items-start gap-2.5 rounded-lg border border-[#10b98115] bg-[#10b9810a] p-3">
                      <ArrowRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400" aria-hidden />
                      <p className="text-[12px] leading-relaxed text-slate-300">{a}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Footer note */}
              <div className="flex items-start gap-2 rounded-lg border border-[#3b82f615] bg-[#3b82f60a] p-3">
                <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-blue-400" aria-hidden />
                <p className="text-[11px] leading-relaxed text-slate-500">
                  This is an AI insight preview. Live explanations will reflect your real-time data as Vorta's AI engine processes site changes.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </>,
    document.body
  );
}

// ─── Public component ─────────────────────────────────────────────────────────

interface ExplainWithAiProps {
  /** Key matching EXPLANATIONS map: dashboard | engineers | equipment | requirements | skills-matrix | ai-matching | training | support | settings */
  pageId: string;
  className?: string;
}

export const ExplainWithAi = ({ pageId, className = "" }: ExplainWithAiProps): JSX.Element => {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Explain this page with AI"
        className={`inline-flex h-8 items-center gap-1.5 rounded-lg border border-[#3b82f630] bg-[#3b82f60d] px-3 text-xs font-medium text-blue-400 transition-colors hover:border-[#3b82f650] hover:bg-[#3b82f618] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-500/50 ${className}`}
      >
        <Sparkles className="h-3.5 w-3.5" aria-hidden />
        Explain with AI
      </button>

      <ExplainPanel pageId={pageId} open={open} onClose={() => setOpen(false)} />
    </>
  );
};
