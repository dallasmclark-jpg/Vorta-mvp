import { useEffect, useState } from "react";
import {
  Activity,
  AlertTriangle,
  Bell,
  Building2,
  CheckCircle2,
  CircleUser as UserCircle,
  Cog,
  CreditCard,
  Download,
  GraduationCap,
  KeyRound,
  Lock,
  LogOut,
  Mail,
  MapPin,
  Network,
  Plus,
  RefreshCw,
  Shield,
  Smartphone,
  Trash2,
  UserMinus,
  Users,
  X,
} from "lucide-react";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Card, CardContent } from "../../components/ui/card";
import { ContextHelp } from "../../components/ContextHelp";
import { Select } from "../../components/Select";
import { ExplainWithAi } from "../../components/ExplainWithAi";
import {
  getSystemHealth,
} from "./systemHealthService";

import type {
  RecoveryManifest,
  SystemHealthIncident,
  SystemHealthStatus,
  SystemHealthSummary,
} from "./systemHealthService";

// ─── Toast ────────────────────────────────────────────────────────────────────

function Toast({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 3000);
    return () => clearTimeout(t);
  }, [onDismiss]);
  return (
    <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-xl border border-emerald-500/30 bg-[#0b1a12] px-4 py-3 shadow-lg">
      <CheckCircle2 className="h-4 w-4 text-emerald-400" />
      <span className="text-sm font-medium text-slate-200">{message}</span>
      <button type="button" onClick={onDismiss} className="ml-2 text-slate-500 hover:text-slate-300">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

// ─── Invite modal ─────────────────────────────────────────────────────────────

function InviteModal({ onClose, onInvite }: { onClose: () => void; onInvite: (email: string, role: string) => void }) {
  const [email, setEmail] = useState("");
  const [role, setRole]   = useState("Viewer");
  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-[2px]" onClick={onClose} aria-hidden="true" />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md rounded-xl border border-gray-800 bg-[#141820] shadow-2xl">
          <div className="flex items-center justify-between border-b border-gray-800 px-5 py-4">
            <div className="flex items-center gap-2">
              <Plus className="h-4 w-4 text-blue-400" />
              <span className="font-semibold text-slate-50">Invite Team Member</span>
            </div>
            <button type="button" onClick={onClose}
              className="inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-400 hover:bg-[#ffffff1a] hover:text-slate-200">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="flex flex-col gap-4 p-5">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-slate-300">Email address</label>
              <input type="email" placeholder="colleague@company.com" value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-9 rounded-lg border border-[#ffffff15] bg-[#0d0d0d] px-3 text-sm text-slate-200 placeholder:text-slate-600 outline-none focus:border-blue-500/60" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-slate-300">Role</label>
              <Select
                value={role}
                onChange={setRole}
                options={[
                  { value: "Admin",   label: "Admin"   },
                  { value: "Manager", label: "Manager" },
                  { value: "Editor",  label: "Editor"  },
                  { value: "Viewer",  label: "Viewer"  },
                ]}
                className="h-9"
              />
            </div>
            <div className="flex gap-3 pt-1">
              <button type="button" onClick={onClose}
                className="flex-1 rounded-lg border border-[#ffffff20] py-2 text-sm font-medium text-slate-300 hover:bg-[#ffffff0a]">
                Cancel
              </button>
              <button type="button"
                onClick={() => { if (email.trim()) { onInvite(email.trim(), role); onClose(); } }}
                disabled={!email.trim()}
                className="flex-1 rounded-lg bg-blue-600 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed">
                Send Invite
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Toggle ───────────────────────────────────────────────────────────────────

function Toggle({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={onChange}
      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full transition-colors focus:outline-none ${checked ? "bg-blue-600" : "bg-gray-700"}`}
    >
      <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${checked ? "translate-x-[18px]" : "translate-x-[3px]"}`} />
    </button>
  );
}

// ─── Section heading ──────────────────────────────────────────────────────────

function SectionHeading({ icon: Icon, title, subtitle }: { icon: React.ElementType; title: string; subtitle?: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#3b82f615]">
        <Icon className="h-4 w-4 text-blue-400" />
      </div>
      <div>
        <h2 className="font-semibold text-slate-50">{title}</h2>
        {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
      </div>
    </div>
  );
}

function formatSystemDateTime(
  value: string | null,
): string {
  if (!value) {
    return "Not available";
  }

  const date = new Date(value);

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return value;
  }

  return new Intl.DateTimeFormat(
    "en-GB",
    {
      dateStyle: "medium",
      timeStyle: "short",
    },
  ).format(date);
}

function formatRiskAge(
  minutes: number | null,
): string {
  if (minutes === null) {
    return "Unknown";
  }

  if (minutes < 60) {
    return `${minutes}m`;
  }

  if (minutes < 1440) {
    const hours =
      Math.floor(minutes / 60);

    const remainingMinutes =
      minutes % 60;

    return remainingMinutes > 0
      ? `${hours}h ${remainingMinutes}m`
      : `${hours}h`;
  }

  const days =
    Math.floor(minutes / 1440);

  const hours =
    Math.floor(
      (minutes % 1440) / 60,
    );

  return hours > 0
    ? `${days}d ${hours}h`
    : `${days}d`;
}

function formatSystemStatus(
  value: string,
): string {
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) =>
      letter.toUpperCase(),
    );
}

function systemStatusClassName(
  status: SystemHealthStatus,
): string {
  switch (status) {
    case "critical":
      return "border-red-500/30 bg-red-500/10 text-red-300";

    case "degraded":
      return "border-amber-500/30 bg-amber-500/10 text-amber-300";

    default:
      return "border-emerald-500/30 bg-emerald-500/10 text-emerald-300";
  }
}

function systemCardBorderClassName(
  status: SystemHealthStatus | null,
): string {
  switch (status) {
    case "critical":
      return "border-red-500/30";

    case "degraded":
      return "border-amber-500/30";

    case "healthy":
      return "border-emerald-500/20";

    default:
      return "border-gray-800";
  }
}

function recoveryStatusClassName(
  status:
    RecoveryManifest["status"],
): string {
  return status === "complete"
    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
    : "border-amber-500/30 bg-amber-500/10 text-amber-300";
}

function incidentSeverityClassName(
  severity: string,
): string {
  switch (
    severity
      .trim()
      .toLowerCase()
  ) {
    case "critical":
      return "border-red-500/30 bg-red-500/10 text-red-300";

    case "high":
      return "border-orange-500/30 bg-orange-500/10 text-orange-300";

    case "medium":
      return "border-amber-500/30 bg-amber-500/10 text-amber-300";

    default:
      return "border-blue-500/30 bg-blue-500/10 text-blue-300";
  }
}

function SystemHealthMetric({
  label,
  value,
  detail,
}: {
  label: string;
  value: string | number;
  detail?: string;
}): JSX.Element {
  return (
    <div className="rounded-lg border border-gray-800 bg-[#111620] p-4">
      <p className="text-xs font-medium text-slate-500">
        {label}
      </p>

      <p className="mt-2 text-xl font-semibold tracking-tight text-slate-100">
        {value}
      </p>

      {detail ? (
        <p className="mt-1 text-[11px] leading-5 text-slate-500">
          {detail}
        </p>
      ) : null}
    </div>
  );
}

// ─── Field row (label + input) ────────────────────────────────────────────────

function FieldRow({ label, value, onChange, type = "text", readOnly = false }: {
  label: string;
  value: string;
  onChange?: (v: string) => void;
  type?: string;
  readOnly?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-medium text-slate-400">{label}</label>
      <input
        type={type}
        readOnly={readOnly}
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        className={`h-9 rounded-lg border px-3 text-sm outline-none transition-colors
          ${readOnly
            ? "border-[#ffffff0d] bg-[#0b0e14] text-slate-500 cursor-default"
            : "border-[#ffffff15] bg-[#0d0d0d] text-slate-200 placeholder:text-slate-600 focus:border-blue-500/60"
          }`}
      />
    </div>
  );
}

// ─── Select row ───────────────────────────────────────────────────────────────

function SelectRow({ label, value, onChange, options }: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-medium text-slate-400">{label}</label>
      <Select
        value={value}
        onChange={onChange}
        options={options.map((o) => ({ value: o, label: o }))}
        className="h-9"
      />
    </div>
  );
}

// ─── Toggle row ───────────────────────────────────────────────────────────────

function ToggleRow({ label, subtitle, checked, onChange }: {
  label: string;
  subtitle?: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-3 border-b border-gray-800 last:border-0">
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="text-sm font-medium text-slate-200">{label}</span>
        {subtitle && <span className="text-xs text-slate-500">{subtitle}</span>}
      </div>
      <Toggle checked={checked} onChange={onChange} />
    </div>
  );
}

// ─── Save button ──────────────────────────────────────────────────────────────

function SaveButton({ label = "Save changes", onClick }: { label?: string; onClick: () => void }) {
  return (
    <div className="flex justify-end pt-2">
      <button type="button" onClick={onClick}
        className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-500">
        {label}
      </button>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export const SettingsSection = (): JSX.Element => {
  const [toast,       setToast]       = useState<string | null>(null);
  const [showInvite,  setShowInvite]  = useState(false);

  const [
    systemHealthSummary,
    setSystemHealthSummary,
  ] =
    useState<SystemHealthSummary | null>(
      null,
    );

  const [
    recoveryManifest,
    setRecoveryManifest,
  ] =
    useState<RecoveryManifest | null>(
      null,
    );

  const [
    systemHealthIncidents,
    setSystemHealthIncidents,
  ] = useState<
    SystemHealthIncident[]
  >([]);

  const [
    systemHealthError,
    setSystemHealthError,
  ] = useState<string | null>(
    null,
  );

  const [
    isLoadingSystemHealth,
    setIsLoadingSystemHealth,
  ] = useState(true);

  // ── Site profile ──────────────────────────────────────────────────────────
  const [siteName,   setSiteName]   = useState("Wrexham Manufacturing Site");
  const [company,    setCompany]    = useState("Vorta Demo Manufacturing Ltd");
  const [industry,   setIndustry]   = useState("Food & Beverage Manufacturing");
  const [location,   setLocation]   = useState("Wrexham, North Wales");
  const [siteSize,   setSiteSize]   = useState("420");
  const [teamSize,   setTeamSize]   = useState("36");
  const [opPattern,  setOpPattern]  = useState("24/7 shift operation");

  // ── Team members ──────────────────────────────────────────────────────────
  const [members, setMembers] = useState([
    { id: "1", name: "Dallas Clark",    title: "Maintenance Manager",  role: "Admin",   status: "Active"  },
    { id: "2", name: "Patrick Power",   title: "Engineering Lead",     role: "Manager", status: "Active"  },
    { id: "3", name: "Sarah Williams",  title: "Training Coordinator", role: "Editor",  status: "Active"  },
    { id: "4", name: "Mark Evans",      title: "Planner",              role: "Viewer",  status: "Pending" },
  ]);

  // ── Notification toggles ──────────────────────────────────────────────────
  const [notifs, setNotifs] = useState({
    skillsGapCritical:       true,
    certExpiry:              true,
    trainingApprovals:       true,
    contractorMatch:         false,
    aiWeeklySummary:         true,
    budgetAlerts:            true,
    newProviderMatch:        false,
  });

  // ── Skills matrix rules ───────────────────────────────────────────────────
  const [minScore,          setMinScore]          = useState("3");
  const [criticalCoverage,  setCriticalCoverage]  = useState("3");
  const [expiryWarning,     setExpiryWarning]     = useState("60");
  const [managerValidation, setManagerValidation] = useState("Yes");
  const [selfWeight,        setSelfWeight]        = useState("30%");
  const [managerWeight,     setManagerWeight]     = useState("70%");

  // ── Training approval rules ───────────────────────────────────────────────
  const [autoApproveUnder,   setAutoApproveUnder]   = useState("500");
  const [managerApproveOver, setManagerApproveOver] = useState("500");
  const [budgetApproveOver,  setBudgetApproveOver]  = useState("2500");
  const [preferredOnly,      setPreferredOnly]      = useState(true);
  const [allowExternal,      setAllowExternal]      = useState(true);
  const [requireJustif,      setRequireJustif]      = useState(true);

  // ── Booking preferences ───────────────────────────────────────────────────
  const [prefLocation,   setPrefLocation]   = useState("Within 50 miles");
  const [prefDelivery,   setPrefDelivery]   = useState("On-site or blended");
  const [prefDays,       setPrefDays]       = useState("Tuesday to Thursday");
  const [avoidConflict,  setAvoidConflict]  = useState(true);
  const [includeTravel,  setIncludeTravel]  = useState(true);
  const [notifyEngineer, setNotifyEngineer] = useState(true);

  // ── Billing ───────────────────────────────────────────────────────────────
  const [billingContact, setBillingContact] = useState("Dallas Clark");
  const [poRequired,     setPoRequired]     = useState("Required");
  const [defaultPo,      setDefaultPo]      = useState("VORTA-2026-MAINT");
  const [invoiceEmail,   setInvoiceEmail]   = useState("finance@vortademo.com");
  const [address,        setAddress]        = useState("Unit 4, Wrexham Industrial Estate, LL13 9XX");

  function toast_(msg: string) { setToast(msg); }

  const loadSystemHealth =
    async (): Promise<void> => {
      setIsLoadingSystemHealth(
        true,
      );

      setSystemHealthError(null);

      try {
        const response =
          await getSystemHealth();

        setSystemHealthSummary(
          response.summary,
        );

        setSystemHealthIncidents(
          response.incidents,
        );

        setRecoveryManifest(
          response.recoveryManifest,
        );
      } catch (error) {
        setSystemHealthError(
          error instanceof Error
            ? error.message
            : "System health could not be loaded.",
        );
      } finally {
        setIsLoadingSystemHealth(
          false,
        );
      }
    };

  useEffect(() => {
    void loadSystemHealth();
  }, []);

  const activeSystemHealthIncidents =
    systemHealthIncidents.filter(
      (incident) =>
        incident.status === "open" ||
        incident.status ===
          "acknowledged",
    );

  const totalHealthChecks =
    systemHealthSummary
      ? systemHealthSummary
          .passedCount +
        systemHealthSummary
          .failedCount +
        systemHealthSummary
          .warningCount
      : 0;

  const trackedRecoveryDatasetCount =
    recoveryManifest
      ? Object.keys(
          recoveryManifest.datasetCounts,
        ).length
      : 0;

  const trackedRecoveryRowCount =
    recoveryManifest
      ? Object.values(
          recoveryManifest.datasetCounts,
        ).reduce(
          (
            total,
            rowCount,
          ) =>
            total +
            Number(rowCount ?? 0),
          0,
        )
      : 0;

  const shortRecoveryFingerprint =
    recoveryManifest?.manifestFingerprint.slice(0, 12) ??
    null;

  function roleBadge(role: string) {
    switch (role) {
      case "Admin":   return "bg-[#3b82f620] text-blue-400";
      case "Manager": return "bg-[#10b98120] text-emerald-500";
      case "Editor":  return "bg-[#facc1520] text-yellow-400";
      default:        return "bg-gray-800 text-slate-400";
    }
  }

  function statusBadge(status: string) {
    return status === "Active"
      ? "bg-[#10b98120] text-emerald-500"
      : "bg-[#facc1520] text-yellow-400";
  }

  return (
    <section className="relative flex min-w-0 w-full max-w-full flex-1 grow flex-col items-start gap-6 overflow-x-hidden px-4 pb-12 pt-0 md:gap-8 md:px-6 xl:px-8">

      {toast && <Toast message={toast} onDismiss={() => setToast(null)} />}
      {showInvite && <InviteModal onClose={() => setShowInvite(false)} onInvite={(email, role) => toast_(`Invite sent to ${email} as ${role}`)} />}

      {/* ── Page header ──────────────────────────────────────────────────── */}
      <header className="flex w-full flex-col justify-between gap-4 py-5 lg:flex-row lg:items-center">
        <div className="flex flex-col items-start gap-1">
          <div className="flex items-center gap-2">
            <h1 className="mt-[-1.00px] font-text-xl-semibold text-[length:var(--text-xl-semibold-font-size)] font-[number:var(--text-xl-semibold-font-weight)] leading-[var(--text-xl-semibold-line-height)] tracking-[var(--text-xl-semibold-letter-spacing)] text-slate-50 [font-style:var(--text-xl-semibold-font-style)]">
              Settings
            </h1>
            <ContextHelp content={{
              title: "Settings",
              body:  "Configure your site profile, team access, notification preferences and approval rules for training bookings.",
              usage: "Use the tabs to navigate between Site Config, Team Access, Notifications and Approval Rules. Changes take effect immediately.",
            }} />
          </div>
          <p className="text-sm text-slate-400">
            Manage your site, team access, notifications and approval rules.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3 self-start lg:self-auto">
          <ExplainWithAi pageId="settings" />
          <button
            type="button"
            aria-label="Refresh system health"
            title="Refresh system health"
            disabled={
              isLoadingSystemHealth
            }
            onClick={() =>
              void loadSystemHealth()
            }
            className="inline-flex h-10 w-10 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-[#ffffff1a] hover:text-slate-200 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <RefreshCw
              className={`h-5 w-5 ${
                isLoadingSystemHealth
                  ? "animate-spin"
                  : ""
              }`}
            />
          </button>
          <button type="button"
            className="inline-flex h-10 w-10 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-[#ffffff1a] hover:text-slate-200">
            <UserCircle className="h-8 w-8" />
          </button>
        </div>
      </header>

      <div className="flex w-full flex-col gap-6">

        <Card
          className={`rounded-xl bg-[#141820] shadow-none ${systemCardBorderClassName(
            systemHealthSummary
              ?.overallStatus ??
              null,
          )}`}
        >
          <CardContent className="flex flex-col gap-5 p-5 md:p-6">
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
              <SectionHeading
                icon={Activity}
                title="System Health"
                subtitle="Automated platform, import and risk-engine monitoring"
              />

              {systemHealthSummary ? (
                <span
                  className={`inline-flex w-fit rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-wide ${systemStatusClassName(
                    systemHealthSummary
                      .overallStatus,
                  )}`}
                >
                  {formatSystemStatus(
                    systemHealthSummary
                      .overallStatus,
                  )}
                </span>
              ) : null}
            </div>

            {isLoadingSystemHealth &&
            !systemHealthSummary ? (
              <div className="flex min-h-32 items-center justify-center rounded-lg border border-gray-800 bg-[#111620] text-sm text-slate-400">
                <RefreshCw className="mr-3 h-4 w-4 animate-spin" />
                Loading live system health
              </div>
            ) : null}

            {systemHealthError ? (
              <div className="flex flex-col justify-between gap-4 rounded-lg border border-red-500/30 bg-red-500/10 p-4 sm:flex-row sm:items-center">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-400" />

                  <div>
                    <p className="text-sm font-semibold text-red-100">
                      System health could not be loaded
                    </p>

                    <p className="mt-1 text-xs leading-5 text-red-100/75">
                      {systemHealthError}
                    </p>
                  </div>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  disabled={
                    isLoadingSystemHealth
                  }
                  onClick={() =>
                    void loadSystemHealth()
                  }
                  className="shrink-0 border-red-500/30 bg-transparent text-red-200 hover:bg-red-500/10 hover:text-red-100"
                >
                  <RefreshCw
                    className={`h-4 w-4 ${
                      isLoadingSystemHealth
                        ? "animate-spin"
                        : ""
                    }`}
                  />
                  Retry
                </Button>
              </div>
            ) : null}

            {systemHealthSummary ? (
              <>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
                  <SystemHealthMetric
                    label="Backend checks"
                    value={`${systemHealthSummary.passedCount}/${totalHealthChecks}`}
                    detail={
                      systemHealthSummary
                        .failedCount >
                        0 ||
                      systemHealthSummary
                        .warningCount >
                        0
                        ? `${systemHealthSummary.failedCount} failed · ${systemHealthSummary.warningCount} warnings`
                        : "All automated checks passed"
                    }
                  />

                  <SystemHealthMetric
                    label="Open incidents"
                    value={
                      systemHealthSummary
                        .openIncidentCount
                    }
                    detail={`${systemHealthSummary.criticalIncidentCount} critical · ${systemHealthSummary.highIncidentCount} high`}
                  />

                  <SystemHealthMetric
                    label="Risk data age"
                    value={formatRiskAge(
                      systemHealthSummary
                        .riskAgeMinutes,
                    )}
                    detail={`Last refreshed ${formatSystemDateTime(
                      systemHealthSummary
                        .riskLastRefreshedAt,
                    )}`}
                  />

                  <SystemHealthMetric
                    label="Last monitoring run"
                    value={
                      systemHealthSummary
                        .latestHealthStatus
                        ? formatSystemStatus(
                            systemHealthSummary
                              .latestHealthStatus,
                          )
                        : "Not available"
                    }
                    detail={formatSystemDateTime(
                      systemHealthSummary
                        .latestMonitorRunAt,
                    )}
                  />

                  <SystemHealthMetric
                    label="Recovery checkpoint"
                    value={
                      recoveryManifest
                        ? formatSystemStatus(
                            recoveryManifest.status,
                          )
                        : "Unavailable"
                    }
                    detail={
                      recoveryManifest
                        ? `${formatRiskAge(
                            recoveryManifest.ageHours *
                              60,
                          )} old · ${trackedRecoveryDatasetCount} datasets`
                        : "No validation checkpoint loaded"
                    }
                  />
                </div>

                <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.38fr)]">
                  <div className="rounded-lg border border-gray-800 bg-[#111620] p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-200">
                          Active incidents
                        </p>

                        <p className="mt-1 text-xs text-slate-500">
                          Backend failures, stale calculations and SAP import exceptions
                        </p>
                      </div>

                      <Badge className="h-auto rounded border border-gray-700 bg-gray-800 px-2 py-1 text-[10px] font-semibold text-slate-300 shadow-none">
                        {
                          activeSystemHealthIncidents.length
                        }
                      </Badge>
                    </div>

                    {activeSystemHealthIncidents.length ===
                    0 ? (
                      <div className="mt-4 flex items-start gap-3 rounded-lg border border-emerald-500/20 bg-emerald-500/[0.07] p-4">
                        <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400" />

                        <div>
                          <p className="text-sm font-semibold text-emerald-100">
                            No active system incidents
                          </p>

                          <p className="mt-1 text-xs leading-5 text-emerald-100/70">
                            The latest automated monitoring run found no backend, import or data-freshness failures.
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="mt-4 flex flex-col gap-2">
                        {activeSystemHealthIncidents
                          .slice(0, 5)
                          .map(
                            (
                              incident,
                            ) => (
                              <div
                                key={
                                  incident.id
                                }
                                className="rounded-lg border border-gray-800 bg-[#0b0e14] p-4"
                              >
                                <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                                  <div className="min-w-0">
                                    <p className="text-sm font-semibold text-slate-200">
                                      {
                                        incident.title
                                      }
                                    </p>

                                    {incident.description ? (
                                      <p className="mt-1 text-xs leading-5 text-slate-500">
                                        {
                                          incident.description
                                        }
                                      </p>
                                    ) : null}
                                  </div>

                                  <span
                                    className={`inline-flex w-fit shrink-0 rounded-full border px-2 py-1 text-[10px] font-semibold uppercase tracking-wide ${incidentSeverityClassName(
                                      incident.severity,
                                    )}`}
                                  >
                                    {formatSystemStatus(
                                      incident.severity,
                                    )}
                                  </span>
                                </div>

                                <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-600">
                                  <span>
                                    {incident.source ??
                                      "Vorta System Monitor"}
                                  </span>

                                  <span>
                                    Last observed{" "}
                                    {formatSystemDateTime(
                                      incident.lastObservedAt,
                                    )}
                                  </span>

                                  <span>
                                    {
                                      incident.occurrenceCount
                                    }{" "}
                                    occurrence
                                    {incident.occurrenceCount ===
                                    1
                                      ? ""
                                      : "s"}
                                  </span>
                                </div>
                              </div>
                            ),
                          )}
                      </div>
                    )}
                  </div>

                  <div className="flex min-w-0 flex-col gap-3">
                    <div className="rounded-lg border border-gray-800 bg-[#111620] p-4">
                      <p className="text-sm font-semibold text-slate-200">
                        Latest SAP import
                      </p>

                      {systemHealthSummary
                        .latestImportStatus ? (
                        <>
                          <span
                            className={`mt-3 inline-flex rounded-full border px-2 py-1 text-[10px] font-semibold uppercase tracking-wide ${
                              systemHealthSummary.latestImportStatus ===
                              "completed"
                                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                                : systemHealthSummary.latestImportStatus ===
                                      "rolled_back" ||
                                    systemHealthSummary.latestImportStatus ===
                                      "failed"
                                  ? "border-red-500/30 bg-red-500/10 text-red-300"
                                  : "border-amber-500/30 bg-amber-500/10 text-amber-300"
                            }`}
                          >
                            {formatSystemStatus(
                              systemHealthSummary
                                .latestImportStatus,
                            )}
                          </span>

                          <p className="mt-3 break-words text-sm font-medium text-slate-300">
                            {systemHealthSummary
                              .latestImportFileName ??
                              "Unnamed SAP file"}
                          </p>

                          <p className="mt-1 text-xs text-slate-500">
                            {formatSystemDateTime(
                              systemHealthSummary
                                .latestImportAt,
                            )}
                          </p>
                        </>
                      ) : (
                        <div className="mt-3 rounded-lg border border-dashed border-gray-800 p-4">
                          <p className="text-sm text-slate-400">
                            No SAP import has been recorded for this site.
                          </p>
                        </div>
                      )}

                      <div className="mt-4 border-t border-gray-800 pt-4">
                        <p className="text-xs font-medium text-slate-400">
                          Monitoring schedule
                        </p>

                        <p className="mt-1 text-xs leading-5 text-slate-500">
                          Vorta automatically runs platform, security, integrity, performance and freshness checks every hour.
                        </p>
                      </div>
                    </div>

                    <div className="rounded-lg border border-gray-800 bg-[#111620] p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex min-w-0 items-start gap-2.5">
                          <Shield className="mt-0.5 h-4 w-4 shrink-0 text-blue-400" />

                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-slate-200">
                              Recovery checkpoint
                            </p>

                            <p className="mt-1 text-xs leading-5 text-slate-500">
                              Daily schema and critical-data validation
                            </p>
                          </div>
                        </div>

                        {recoveryManifest ? (
                          <span
                            className={`inline-flex w-fit shrink-0 rounded-full border px-2 py-1 text-[10px] font-semibold uppercase tracking-wide ${recoveryStatusClassName(
                              recoveryManifest
                                .status,
                            )}`}
                          >
                            {formatSystemStatus(
                              recoveryManifest
                                .status,
                            )}
                          </span>
                        ) : null}
                      </div>

                      {recoveryManifest ? (
                        <div className="mt-4 flex flex-col gap-3">
                          <div className="grid grid-cols-2 gap-3">
                            <div className="rounded-lg border border-gray-800 bg-[#0b0e14] p-3">
                              <p className="text-[10px] font-medium uppercase tracking-wide text-slate-600">
                                Generated
                              </p>

                              <p className="mt-1 text-xs font-medium text-slate-300">
                                {formatSystemDateTime(
                                  recoveryManifest
                                    .createdAt,
                                )}
                              </p>
                            </div>

                            <div className="rounded-lg border border-gray-800 bg-[#0b0e14] p-3">
                              <p className="text-[10px] font-medium uppercase tracking-wide text-slate-600">
                                Checkpoint age
                              </p>

                              <p className="mt-1 text-xs font-medium text-slate-300">
                                {formatRiskAge(
                                  recoveryManifest
                                    .ageHours *
                                    60,
                                )}
                              </p>
                            </div>
                          </div>

                          <div className="rounded-lg border border-gray-800 bg-[#0b0e14] p-3">
                            <p className="text-[10px] font-medium uppercase tracking-wide text-slate-600">
                              Schema checkpoint
                            </p>

                            <p className="mt-1 break-words text-xs font-medium text-slate-300">
                              {recoveryManifest
                                .migrationName ??
                                "Unnamed migration"}
                            </p>

                            <p className="mt-1 break-all font-mono text-[10px] text-slate-600">
                              {
                                recoveryManifest
                                  .migrationVersion
                              }
                            </p>
                          </div>

                          <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-500">
                            <span>
                              {
                                recoveryManifest
                                  .schemaMigrationCount
                              }{" "}
                              migrations
                            </span>

                            <span>
                              {
                                trackedRecoveryDatasetCount
                              }{" "}
                              datasets
                            </span>

                            <span>
                              {
                                trackedRecoveryRowCount
                              }{" "}
                              tracked rows
                            </span>
                          </div>

                          {shortRecoveryFingerprint ? (
                            <div className="flex items-center justify-between gap-3 border-t border-gray-800 pt-3">
                              <span className="text-[10px] text-slate-600">
                                Manifest fingerprint
                              </span>

                              <code className="rounded bg-[#0b0e14] px-2 py-1 text-[10px] text-slate-400">
                                {
                                  shortRecoveryFingerprint
                                }
                              </code>
                            </div>
                          ) : null}

                          <p className="border-t border-gray-800 pt-3 text-[10px] leading-4 text-slate-600">
                            This checkpoint validates the expected schema and critical dataset state after recovery. Managed backup and point-in-time recovery remain Supabase platform settings and are not confirmed by this check.
                          </p>
                        </div>
                      ) : (
                        <div className="mt-3 rounded-lg border border-dashed border-gray-800 p-4">
                          <p className="text-sm text-slate-400">
                            No recovery checkpoint has been recorded.
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </>
            ) : null}
          </CardContent>
        </Card>

        {/* ── Row 1: Site Profile + Team Access ────────────────────────────── */}
        <div className="grid w-full grid-cols-1 gap-6 xl:grid-cols-2">

          {/* 1. Site Profile */}
          <Card className="rounded-xl border border-gray-800 bg-[#141820] shadow-none">
            <CardContent className="flex flex-col gap-5 p-5 md:p-6">
              <SectionHeading icon={Building2} title="Site Profile" subtitle="Manage your manufacturing site details" />
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <FieldRow label="Site name"            value={siteName}  onChange={setSiteName} />
                <FieldRow label="Company"              value={company}   onChange={setCompany} />
                <FieldRow label="Industry"             value={industry}  onChange={setIndustry} />
                <FieldRow label="Location"             value={location}  onChange={setLocation} />
                <FieldRow label="Site size (employees)" value={siteSize} onChange={setSiteSize} type="number" />
                <FieldRow label="Maintenance team size" value={teamSize} onChange={setTeamSize} type="number" />
              </div>
              <SelectRow label="Operating pattern" value={opPattern} onChange={setOpPattern}
                options={["24/7 shift operation", "Day shift only", "2-shift operation", "3-shift operation"]} />
              <SaveButton label="Save site profile" onClick={() => toast_("Site profile saved")} />
            </CardContent>
          </Card>

          {/* 2. Team Access */}
          <Card className="rounded-xl border border-gray-800 bg-[#141820] shadow-none">
            <CardContent className="flex flex-col gap-5 p-5 md:p-6">
              <div className="flex items-center justify-between gap-3">
                <SectionHeading icon={Users} title="Team Access" subtitle="Manage who can access this dashboard" />
                <button type="button" onClick={() => setShowInvite(true)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[#ffffff20] bg-[#ffffff1a] px-3 py-1.5 text-xs font-semibold text-slate-200 transition-colors hover:bg-[#ffffff24]">
                  <Plus className="h-3.5 w-3.5" /> Invite
                </button>
              </div>

              <div className="flex flex-col gap-2">
                {members.map((m) => (
                  <div key={m.id}
                    className="flex items-center justify-between gap-3 rounded-lg border border-gray-800 bg-[#111620] px-4 py-3">
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#3b82f620] text-xs font-bold text-blue-400">
                        {m.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-slate-100">{m.name}</p>
                        <p className="truncate text-xs text-slate-500">{m.title}</p>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <Badge className={`hidden sm:inline-flex h-auto rounded px-2 py-0.5 text-[10px] font-medium shadow-none ${roleBadge(m.role)}`}>
                        {m.role}
                      </Badge>
                      <Badge className={`hidden sm:inline-flex h-auto rounded px-2 py-0.5 text-[10px] font-medium shadow-none ${statusBadge(m.status)}`}>
                        {m.status}
                      </Badge>
                      <button type="button" title="Change role"
                        onClick={() => {
                          const cycle: Record<string, string> = { Admin: "Manager", Manager: "Editor", Editor: "Viewer", Viewer: "Admin" };
                          const next = cycle[m.role] ?? "Viewer";
                          setMembers((prev) => prev.map((x) => x.id === m.id ? { ...x, role: next } : x));
                          toast_(`${m.name} role changed to ${next}`);
                        }}
                        className="rounded border border-gray-700 px-2 py-1 text-[10px] font-medium text-slate-400 transition-colors hover:border-gray-600 hover:bg-[#ffffff0a] hover:text-slate-200">
                        Role
                      </button>
                      <button type="button" title="Remove access"
                        onClick={() => setMembers((prev) => prev.filter((x) => x.id !== m.id))}
                        className="inline-flex h-7 w-7 items-center justify-center rounded border border-gray-700 text-slate-500 transition-colors hover:border-red-500/30 hover:bg-[#ef444408] hover:text-red-400">
                        <UserMinus className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ── Row 2: Notifications + Skills Matrix Rules ───────────────────── */}
        <div className="grid w-full grid-cols-1 gap-6 xl:grid-cols-2">

          {/* 3. Notification Preferences */}
          <Card className="rounded-xl border border-gray-800 bg-[#141820] shadow-none">
            <CardContent className="flex flex-col gap-4 p-5 md:p-6">
              <SectionHeading icon={Bell} title="Notification Preferences" subtitle="Choose what alerts you receive" />
              <div className="flex flex-col">
                <ToggleRow label="Skills gaps becoming critical"   subtitle="Alert when a skill reaches critical risk level" checked={notifs.skillsGapCritical}  onChange={() => { setNotifs((n) => ({ ...n, skillsGapCritical: !n.skillsGapCritical })); toast_(!notifs.skillsGapCritical ? "Critical gap alerts enabled" : "Critical gap alerts disabled"); }} />
                <ToggleRow label="Certifications expiring soon"    subtitle="30-day and 60-day expiry warnings"             checked={notifs.certExpiry}           onChange={() => { setNotifs((n) => ({ ...n, certExpiry: !n.certExpiry })); toast_(!notifs.certExpiry ? "Certification expiry alerts enabled" : "Certification expiry alerts disabled"); }} />
                <ToggleRow label="Training booking approvals"      subtitle="Requests awaiting your approval"               checked={notifs.trainingApprovals}     onChange={() => { setNotifs((n) => ({ ...n, trainingApprovals: !n.trainingApprovals })); toast_(!notifs.trainingApprovals ? "Training approval alerts enabled" : "Training approval alerts disabled"); }} />
                <ToggleRow label="Contractor match recommendations" subtitle="New AI-matched contractor suggestions"       checked={notifs.contractorMatch}       onChange={() => { setNotifs((n) => ({ ...n, contractorMatch: !n.contractorMatch })); toast_(!notifs.contractorMatch ? "Contractor match alerts enabled" : "Contractor match alerts disabled"); }} />
                <ToggleRow label="AI weekly summary report"        subtitle="Delivered every Monday morning"               checked={notifs.aiWeeklySummary}       onChange={() => { setNotifs((n) => ({ ...n, aiWeeklySummary: !n.aiWeeklySummary })); toast_(!notifs.aiWeeklySummary ? "Weekly AI summary enabled" : "Weekly AI summary disabled"); }} />
                <ToggleRow label="Budget threshold alerts"         subtitle="Notify when spend approaches your limit"      checked={notifs.budgetAlerts}          onChange={() => { setNotifs((n) => ({ ...n, budgetAlerts: !n.budgetAlerts })); toast_(!notifs.budgetAlerts ? "Budget alerts enabled" : "Budget alerts disabled"); }} />
                <ToggleRow label="New supplier / training provider matches" subtitle="When new providers match your skill gaps" checked={notifs.newProviderMatch} onChange={() => { setNotifs((n) => ({ ...n, newProviderMatch: !n.newProviderMatch })); toast_(!notifs.newProviderMatch ? "Provider match alerts enabled" : "Provider match alerts disabled"); }} />
              </div>
            </CardContent>
          </Card>

          {/* 4. Skills Matrix Rules */}
          <Card className="rounded-xl border border-gray-800 bg-[#141820] shadow-none">
            <CardContent className="flex flex-col gap-5 p-5 md:p-6">
              <SectionHeading icon={Network} title="Skills Matrix Rules" subtitle="Define scoring thresholds and validation logic" />
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <SelectRow label="Min. acceptable competence score"
                  value={minScore} onChange={setMinScore}
                  options={["1", "2", "3", "4", "5"]} />
                <SelectRow label="Critical skill coverage target"
                  value={criticalCoverage} onChange={setCriticalCoverage}
                  options={["1 engineer minimum", "2 engineers minimum", "3 engineers minimum", "4 engineers minimum", "5 engineers minimum"]} />
                <SelectRow label="Expiry warning window"
                  value={expiryWarning} onChange={setExpiryWarning}
                  options={["30 days", "60 days", "90 days", "120 days"]} />
                <SelectRow label="Manager validation required"
                  value={managerValidation} onChange={setManagerValidation}
                  options={["Yes", "No"]} />
                <SelectRow label="Self-assessment weight"
                  value={selfWeight} onChange={setSelfWeight}
                  options={["10%", "20%", "30%", "40%", "50%"]} />
                <SelectRow label="Manager assessment weight"
                  value={managerWeight} onChange={setManagerWeight}
                  options={["50%", "60%", "70%", "80%", "90%"]} />
              </div>
              <SaveButton label="Save matrix rules" onClick={() => toast_("Skills matrix rules saved")} />
            </CardContent>
          </Card>
        </div>

        {/* ── Row 3: Training Approval + Booking Preferences ───────────────── */}
        <div className="grid w-full grid-cols-1 gap-6 xl:grid-cols-2">

          {/* 5. Training Approval Rules */}
          <Card className="rounded-xl border border-gray-800 bg-[#141820] shadow-none">
            <CardContent className="flex flex-col gap-5 p-5 md:p-6">
              <SectionHeading icon={GraduationCap} title="Training Approval Rules" subtitle="Define spend thresholds and approval workflows" />
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-slate-400">Auto-approve training under (£)</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-500">£</span>
                    <input type="number" value={autoApproveUnder}
                      onChange={(e) => setAutoApproveUnder(e.target.value)}
                      className="h-9 w-full rounded-lg border border-[#ffffff15] bg-[#0d0d0d] pl-7 pr-3 text-sm text-slate-200 outline-none focus:border-blue-500/60" />
                  </div>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-slate-400">Require manager approval above (£)</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-500">£</span>
                    <input type="number" value={managerApproveOver}
                      onChange={(e) => setManagerApproveOver(e.target.value)}
                      className="h-9 w-full rounded-lg border border-[#ffffff15] bg-[#0d0d0d] pl-7 pr-3 text-sm text-slate-200 outline-none focus:border-blue-500/60" />
                  </div>
                </div>
                <div className="flex flex-col gap-1.5 sm:col-span-2">
                  <label className="text-xs font-medium text-slate-400">Require budget owner approval above (£)</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-500">£</span>
                    <input type="number" value={budgetApproveOver}
                      onChange={(e) => setBudgetApproveOver(e.target.value)}
                      className="h-9 w-full rounded-lg border border-[#ffffff15] bg-[#0d0d0d] pl-7 pr-3 text-sm text-slate-200 outline-none focus:border-blue-500/60" />
                  </div>
                </div>
              </div>
              <div className="flex flex-col">
                <ToggleRow label="Preferred providers only"     subtitle="Restrict bookings to your approved provider list" checked={preferredOnly}   onChange={() => { setPreferredOnly((v) => !v); toast_(preferredOnly ? "Provider restriction removed" : "Restricted to preferred providers"); }} />
                <ToggleRow label="Allow external providers"     subtitle="Permit training from non-listed providers"        checked={allowExternal}   onChange={() => { setAllowExternal((v) => !v); toast_(allowExternal ? "External providers blocked" : "External providers allowed"); }} />
                <ToggleRow label="Require business justification" subtitle="Mandatory field when submitting any booking"   checked={requireJustif}   onChange={() => { setRequireJustif((v) => !v); toast_(requireJustif ? "Justification no longer required" : "Business justification now required"); }} />
              </div>
              <SaveButton label="Save approval rules" onClick={() => toast_("Training approval rules saved")} />
            </CardContent>
          </Card>

          {/* 6. Booking Preferences */}
          <Card className="rounded-xl border border-gray-800 bg-[#141820] shadow-none">
            <CardContent className="flex flex-col gap-5 p-5 md:p-6">
              <SectionHeading icon={MapPin} title="Booking Preferences" subtitle="Default training logistics and scheduling preferences" />
              <div className="grid grid-cols-1 gap-4">
                <SelectRow label="Preferred training location"
                  value={prefLocation} onChange={setPrefLocation}
                  options={["On-site", "Within 10 miles", "Within 25 miles", "Within 50 miles", "Any location"]} />
                <SelectRow label="Preferred delivery method"
                  value={prefDelivery} onChange={setPrefDelivery}
                  options={["On-site", "Classroom", "Blended", "On-site or blended", "Online", "Any"]} />
                <SelectRow label="Preferred training days"
                  value={prefDays} onChange={setPrefDays}
                  options={["Monday to Friday", "Tuesday to Thursday", "Monday to Wednesday", "Any weekday"]} />
              </div>
              <div className="flex flex-col">
                <ToggleRow label="Avoid shift conflicts"            subtitle="Block bookings that clash with engineer shifts"        checked={avoidConflict}  onChange={() => { setAvoidConflict((v) => !v); toast_(avoidConflict ? "Shift conflict check disabled" : "Shift conflict check enabled"); }} />
                <ToggleRow label="Include travel time"             subtitle="Add travel buffer to shift planning around training"    checked={includeTravel}  onChange={() => { setIncludeTravel((v) => !v); toast_(includeTravel ? "Travel time buffer disabled" : "Travel time buffer enabled"); }} />
                <ToggleRow label="Notify engineer when confirmed"  subtitle="Send confirmation notification to the engineer"        checked={notifyEngineer} onChange={() => { setNotifyEngineer((v) => !v); toast_(notifyEngineer ? "Engineer notifications disabled" : "Engineer notifications enabled"); }} />
              </div>
              <SaveButton label="Save booking preferences" onClick={() => toast_("Booking preferences saved")} />
            </CardContent>
          </Card>
        </div>

        {/* ── Row 4: Billing + Security ─────────────────────────────────────── */}
        <div className="grid w-full grid-cols-1 gap-6 xl:grid-cols-2">

          {/* 7. Billing & Company Details */}
          <Card className="rounded-xl border border-gray-800 bg-[#141820] shadow-none">
            <CardContent className="flex flex-col gap-5 p-5 md:p-6">
              <SectionHeading icon={CreditCard} title="Billing & Company Details" subtitle="Manage your billing contact and invoicing preferences" />
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <FieldRow label="Billing contact"         value={billingContact} onChange={setBillingContact} />
                <SelectRow label="Purchase order requirement"
                  value={poRequired} onChange={setPoRequired}
                  options={["Required", "Optional", "Not required"]} />
                <FieldRow label="Default PO number"       value={defaultPo}      onChange={setDefaultPo} />
                <FieldRow label="Invoice email"           value={invoiceEmail}   onChange={setInvoiceEmail} type="email" />
                <div className="sm:col-span-2">
                  <FieldRow label="Company address" value={address} onChange={setAddress} />
                </div>
              </div>
              <SaveButton label="Update billing details" onClick={() => toast_("Billing details updated")} />
            </CardContent>
          </Card>

          {/* 8. Security */}
          <Card className="rounded-xl border border-gray-800 bg-[#141820] shadow-none">
            <CardContent className="flex flex-col gap-5 p-5 md:p-6">
              <SectionHeading icon={Shield} title="Security" subtitle="Password, 2FA and session management" />

              <div className="flex flex-col gap-3">
                {/* Password */}
                <div className="flex items-center justify-between gap-4 rounded-lg border border-gray-800 bg-[#111620] px-4 py-3">
                  <div className="flex items-center gap-3">
                    <KeyRound className="h-4 w-4 shrink-0 text-slate-500" />
                    <div>
                      <p className="text-sm font-medium text-slate-200">Password</p>
                      <p className="text-xs text-slate-500">Last changed 18 days ago</p>
                    </div>
                  </div>
                  <button type="button" onClick={() => toast_("Password change email sent")}
                    className="shrink-0 rounded border border-gray-700 px-3 py-1.5 text-xs font-medium text-slate-400 hover:border-gray-600 hover:bg-[#ffffff0a] hover:text-slate-200">
                    Change
                  </button>
                </div>

                {/* 2FA */}
                <div className="flex items-center justify-between gap-4 rounded-lg border border-gray-800 bg-[#111620] px-4 py-3">
                  <div className="flex items-center gap-3">
                    <Smartphone className="h-4 w-4 shrink-0 text-slate-500" />
                    <div>
                      <p className="text-sm font-medium text-slate-200">Two-factor authentication</p>
                      <div className="flex items-center gap-1.5">
                        <Badge className="mt-0.5 inline-flex h-auto rounded bg-[#10b98120] px-1.5 py-0.5 text-[10px] font-medium text-emerald-500 shadow-none hover:bg-[#10b98120]">
                          Enabled
                        </Badge>
                      </div>
                    </div>
                  </div>
                  <button type="button" onClick={() => toast_("Navigating to 2FA settings…")}
                    className="shrink-0 rounded border border-gray-700 px-3 py-1.5 text-xs font-medium text-slate-400 hover:border-gray-600 hover:bg-[#ffffff0a] hover:text-slate-200">
                    Manage
                  </button>
                </div>

                {/* Sessions */}
                <div className="flex items-center justify-between gap-4 rounded-lg border border-gray-800 bg-[#111620] px-4 py-3">
                  <div className="flex items-center gap-3">
                    <Lock className="h-4 w-4 shrink-0 text-slate-500" />
                    <div>
                      <p className="text-sm font-medium text-slate-200">Active sessions</p>
                      <p className="text-xs text-slate-500">2 devices currently signed in</p>
                    </div>
                  </div>
                  <button type="button" onClick={() => toast_("Signed out of all other devices")}
                    className="shrink-0 rounded border border-gray-700 px-3 py-1.5 text-xs font-medium text-slate-400 hover:border-gray-600 hover:bg-[#ffffff0a] hover:text-slate-200">
                    Sign out all
                  </button>
                </div>

                {/* Audit */}
                <div className="flex items-center justify-between gap-4 rounded-lg border border-gray-800 bg-[#111620] px-4 py-3">
                  <div className="flex items-center gap-3">
                    <Mail className="h-4 w-4 shrink-0 text-slate-500" />
                    <div>
                      <p className="text-sm font-medium text-slate-200">Login audit</p>
                      <p className="text-xs text-slate-500">View recent sign-in activity</p>
                    </div>
                  </div>
                  <button type="button" onClick={() => toast_("Audit log opened")}
                    className="shrink-0 rounded border border-gray-700 px-3 py-1.5 text-xs font-medium text-slate-400 hover:border-gray-600 hover:bg-[#ffffff0a] hover:text-slate-200">
                    View
                  </button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ── 9. Danger Zone ───────────────────────────────────────────────── */}
        <Card className="rounded-xl border border-red-500/20 bg-[#ef444408] shadow-none">
          <CardContent className="flex flex-col gap-5 p-5 md:p-6">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#ef444420]">
                <AlertTriangle className="h-4 w-4 text-red-500" />
              </div>
              <div>
                <h2 className="font-semibold text-red-400">Danger Zone</h2>
                <p className="text-xs text-slate-500">Irreversible actions — proceed with caution</p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="flex flex-col gap-3 rounded-lg border border-red-500/10 bg-[#0b0e14] p-4">
                <div className="flex items-center gap-2">
                  <Download className="h-4 w-4 text-slate-400" />
                  <span className="text-sm font-medium text-slate-200">Export site data</span>
                </div>
                <p className="text-xs text-slate-500">Download a full export of your site data including engineers, skills, training records and bookings.</p>
                <button type="button" onClick={() => toast_("Export queued — you will receive an email when ready")}
                  className="mt-auto rounded-lg border border-gray-700 px-3 py-2 text-xs font-medium text-slate-400 transition-colors hover:border-gray-600 hover:bg-[#ffffff0a] hover:text-slate-200">
                  Export data
                </button>
              </div>

              <div className="flex flex-col gap-3 rounded-lg border border-red-500/10 bg-[#0b0e14] p-4">
                <div className="flex items-center gap-2">
                  <Cog className="h-4 w-4 text-slate-400" />
                  <span className="text-sm font-medium text-slate-200">Deactivate site account</span>
                </div>
                <p className="text-xs text-slate-500">Suspend this site account. All engineers and data will be preserved but access will be blocked.</p>
                <button type="button" onClick={() => toast_("Contact support to deactivate your account")}
                  className="mt-auto rounded-lg border border-red-500/20 px-3 py-2 text-xs font-medium text-red-500/80 transition-colors hover:border-red-500/40 hover:bg-[#ef444408] hover:text-red-400">
                  Deactivate account
                </button>
              </div>

              <div className="flex flex-col gap-3 rounded-lg border border-red-500/10 bg-[#0b0e14] p-4">
                <div className="flex items-center gap-2">
                  <Trash2 className="h-4 w-4 text-slate-400" />
                  <span className="text-sm font-medium text-slate-200">Delete demo data</span>
                </div>
                <p className="text-xs text-slate-500">Remove all seeded demo engineers, skills and training data and start with a blank site configuration.</p>
                <button type="button" onClick={() => toast_("Contact support to clear demo data")}
                  className="mt-auto rounded-lg border border-red-500/20 px-3 py-2 text-xs font-medium text-red-500/80 transition-colors hover:border-red-500/40 hover:bg-[#ef444408] hover:text-red-400">
                  Delete demo data
                </button>
              </div>
            </div>
          </CardContent>
        </Card>

      </div>
    </section>
  );
};
