import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  Clock3,
  RefreshCw,
  Search,
  Shield,
  UserRoundCheck,
  Users,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge } from "../../components/ui/badge";
import { Card, CardContent } from "../../components/ui/card";
import { DetailDrawer, DrawerCloseButton } from "../../components/DetailDrawer";
import { useAuth } from "../../lib/auth";
import { RuntimeContractError } from "../../lib/runtimeContracts";
import { supabase } from "../../lib/supabaseClient";
import {
  getShiftCoverSnapshot,
  type ShiftCoverCalendarItem,
  type ShiftCoverSnapshot,
  type ShiftCoverageStatus,
} from "../LabourRisk/shiftCoverService";
import {
  validateEngineersPayload,
  type LiveEngineerRecord,
  type LiveEngineersPayload,
} from "./engineersRuntimeContracts";
import { getAvatarColor, getInitials } from "./EngineerDrawer";

const DAY_MS = 24 * 60 * 60 * 1000;

function startOfWeek(value: Date): Date {
  const date = new Date(value.getFullYear(), value.getMonth(), value.getDate());
  const day = date.getDay();
  date.setDate(date.getDate() + (day === 0 ? -6 : 1 - day));
  return date;
}

function addDays(value: Date, days: number): Date {
  return new Date(value.getTime() + days * DAY_MS);
}

function dateOnly(value: Date): string {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatTimestamp(value: string | null): string {
  if (!value) return "Source timestamp unavailable";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Source timestamp unavailable";
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatDate(value: string | null): string {
  if (!value) return "Not recorded";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

function normaliseName(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function riskClass(value: string): string {
  switch (value.toLowerCase()) {
    case "critical":
      return "border-red-500/25 bg-red-500/10 text-red-300";
    case "high":
      return "border-orange-500/25 bg-orange-500/10 text-orange-300";
    case "medium":
      return "border-amber-500/25 bg-amber-500/10 text-amber-300";
    default:
      return "border-emerald-500/25 bg-emerald-500/10 text-emerald-300";
  }
}

const COVERAGE_LABELS: Record<ShiftCoverageStatus, string> = {
  covered: "Covered",
  reduced: "Reduced",
  partial: "Partial",
  gap: "Gap",
  contractor: "Contractor",
};

function coverageClass(status: ShiftCoverageStatus): string {
  switch (status) {
    case "gap":
      return "border-red-500/25 bg-red-500/10 text-red-300";
    case "partial":
      return "border-orange-500/25 bg-orange-500/10 text-orange-300";
    case "reduced":
      return "border-amber-500/25 bg-amber-500/10 text-amber-300";
    case "contractor":
      return "border-blue-500/25 bg-blue-500/10 text-blue-300";
    default:
      return "border-emerald-500/25 bg-emerald-500/10 text-emerald-300";
  }
}

function MetricCard({
  label,
  value,
  detail,
  icon: Icon,
  tone = "text-slate-50",
}: {
  label: string;
  value: string;
  detail: string;
  icon: typeof Users;
  tone?: string;
}): JSX.Element {
  return (
    <Card className="min-w-0 rounded-xl border border-gray-800 bg-[#141820] shadow-none">
      <CardContent className="p-4">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</p>
          <Icon className={`h-4 w-4 ${tone}`} aria-hidden="true" />
        </div>
        <p className={`mt-3 text-2xl font-bold tabular-nums ${tone}`}>{value}</p>
        <p className="mt-1 text-xs text-slate-500">{detail}</p>
      </CardContent>
    </Card>
  );
}

function EngineerEvidenceDrawer({
  engineer,
  scheduledShifts,
  onClose,
}: {
  engineer: LiveEngineerRecord | null;
  scheduledShifts: ShiftCoverCalendarItem[];
  onClose: () => void;
}): JSX.Element {
  return (
    <DetailDrawer open={Boolean(engineer)} onClose={onClose}>
      <div className="flex items-start justify-between border-b border-gray-800 p-5">
        <div className="flex min-w-0 items-center gap-3 pr-3">
          {engineer ? (
            <div
              className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-sm font-bold ${getAvatarColor(engineer.full_name)}`}
            >
              {getInitials(engineer.full_name)}
            </div>
          ) : null}
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
              Verified workforce record
            </p>
            <h2 className="mt-1 truncate text-base font-semibold text-slate-50">
              {engineer?.full_name ?? "Engineer"}
            </h2>
            <p className="mt-0.5 text-sm text-slate-400">
              {engineer?.discipline ?? "Discipline not recorded"}
            </p>
          </div>
        </div>
        <DrawerCloseButton onClose={onClose} />
      </div>

      {engineer ? (
        <div className="flex-1 overflow-y-auto">
          <div className="grid grid-cols-2 gap-3 border-b border-gray-800 p-5">
            {[
              ["Competency", `${engineer.skills_score}%`],
              ["Skills assessed", String(engineer.total_skills_assessed)],
              ["Training gaps", String(engineer.training_count)],
              ["Week shifts", String(scheduledShifts.length)],
            ].map(([label, value]) => (
              <div key={label} className="rounded-lg border border-gray-800 bg-[#111620] p-3">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                  {label}
                </p>
                <p className="mt-1 text-lg font-semibold tabular-nums text-slate-100">{value}</p>
              </div>
            ))}
          </div>

          <section className="border-b border-gray-800 p-5">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Record details
            </h3>
            <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
              {[
                ["Department", engineer.department_name ?? "Not recorded"],
                ["Employment", engineer.employment_type],
                ["Shift pattern", engineer.shift_pattern ?? "Not recorded"],
                ["Site", engineer.site_name ?? "Authorised active site"],
                ["Last assessment", formatDate(engineer.last_assessment_date)],
                ["Experience", engineer.years_experience == null ? "Not recorded" : `${engineer.years_experience} years`],
              ].map(([label, value]) => (
                <div key={label} className="rounded-lg border border-gray-800 bg-[#111620] p-3">
                  <dt className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                    {label}
                  </dt>
                  <dd className="mt-1 text-xs font-medium text-slate-200">{value}</dd>
                </div>
              ))}
            </dl>
          </section>

          <section className="border-b border-gray-800 p-5">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Verified rota evidence
              </h3>
              <Badge className="border border-blue-500/25 bg-blue-500/10 text-blue-300">
                {scheduledShifts.length} shift{scheduledShifts.length === 1 ? "" : "s"}
              </Badge>
            </div>
            {scheduledShifts.length > 0 ? (
              <div className="mt-3 flex flex-col gap-2">
                {scheduledShifts.map((shift) => (
                  <div
                    key={`${shift.shiftDate}:${shift.shiftType}`}
                    className="flex items-center justify-between gap-3 rounded-lg border border-gray-800 bg-[#111620] p-3"
                  >
                    <div>
                      <p className="text-xs font-semibold text-slate-200">
                        {formatDate(shift.shiftDate)} · {shift.shiftType === "night" ? "Night" : "Day"}
                      </p>
                      <p className="mt-0.5 text-[11px] text-slate-500">
                        {shift.teamNames.join(" · ") || "No team name"}
                      </p>
                    </div>
                    <Badge className={`border ${coverageClass(shift.coverageStatus)}`}>
                      {COVERAGE_LABELS[shift.coverageStatus]}
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-3 text-sm leading-6 text-slate-400">
                This engineer is not named in the verified rota snapshot for the selected week.
              </p>
            )}
          </section>

          <section className="border-b border-gray-800 p-5">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Highest-rated skills
            </h3>
            {engineer.top_skills.length > 0 ? (
              <div className="mt-3 flex flex-col gap-2">
                {engineer.top_skills.slice(0, 6).map((skill) => (
                  <div
                    key={`${skill.name}:${skill.category}`}
                    className="flex items-center justify-between gap-3 rounded-lg border border-gray-800 bg-[#111620] p-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-xs font-semibold text-slate-200">{skill.name}</p>
                      <p className="mt-0.5 truncate text-[11px] text-slate-500">{skill.category}</p>
                    </div>
                    <span className="text-sm font-bold tabular-nums text-blue-300">{skill.rating}/5</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-3 text-sm text-slate-400">No assessed skill evidence was returned.</p>
            )}
          </section>

          <section className="p-5">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Certification evidence
            </h3>
            {engineer.certifications.length > 0 ? (
              <div className="mt-3 flex flex-col gap-2">
                {engineer.certifications.map((certification) => (
                  <div
                    key={`${certification.skill_name}:${certification.expiry_date ?? "none"}`}
                    className="rounded-lg border border-gray-800 bg-[#111620] p-3"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-xs font-semibold text-slate-200">
                        {certification.skill_name}
                      </p>
                      <span className="text-[11px] text-slate-400">
                        {formatDate(certification.expiry_date)}
                      </span>
                    </div>
                    <p className="mt-1 text-[11px] text-slate-500">
                      {certification.verification_status}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-3 text-sm text-slate-400">No certification records were returned.</p>
            )}
          </section>
        </div>
      ) : null}
    </DetailDrawer>
  );
}

export function LiveEngineersSection(): JSX.Element {
  const { siteContext } = useAuth();
  const weekStart = useMemo(() => startOfWeek(new Date()), []);
  const startDate = dateOnly(weekStart);
  const endDate = dateOnly(addDays(weekStart, 6));

  const [payload, setPayload] = useState<LiveEngineersPayload | null>(null);
  const [snapshot, setSnapshot] = useState<ShiftCoverSnapshot | null>(null);
  const [selectedEngineer, setSelectedEngineer] = useState<LiveEngineerRecord | null>(null);
  const [search, setSearch] = useState("");
  const [riskFilter, setRiskFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadEvidence = useCallback(async (): Promise<void> => {
    const siteId = siteContext?.siteId;
    const organisationId = siteContext?.organisationId;
    if (!siteId || !organisationId) {
      setPayload(null);
      setSnapshot(null);
      setError("Engineers evidence is unavailable because no authorised active site was resolved.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const [engineersResult, shiftSnapshot] = await Promise.all([
        supabase.functions.invoke("engineers-data"),
        getShiftCoverSnapshot(siteId, startDate, endDate),
      ]);
      if (engineersResult.error) {
        throw new Error(`Engineer records could not be loaded: ${engineersResult.error.message}`);
      }

      const validated = validateEngineersPayload(engineersResult.data);
      if (validated.siteId !== siteId || validated.organisationId !== organisationId) {
        throw new RuntimeContractError(
          "Engineers.activeSite",
          "the response does not match the authorised site and organisation",
        );
      }
      if (shiftSnapshot.siteId !== siteId) {
        throw new RuntimeContractError(
          "Engineers.shiftCover",
          "the rota snapshot does not match the authorised active site",
        );
      }

      setPayload(validated);
      setSnapshot(shiftSnapshot);
      setSelectedEngineer((current) =>
        current ? validated.engineers.find((engineer) => engineer.id === current.id) ?? null : null,
      );
    } catch (loadError) {
      setPayload(null);
      setSnapshot(null);
      setSelectedEngineer(null);
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Verified Engineers evidence could not be loaded.",
      );
    } finally {
      setLoading(false);
    }
  }, [endDate, siteContext?.organisationId, siteContext?.siteId, startDate]);

  useEffect(() => {
    void loadEvidence();
  }, [loadEvidence]);

  const shiftsByEngineer = useMemo(() => {
    const map = new Map<string, ShiftCoverCalendarItem[]>();
    for (const shift of snapshot?.calendar ?? []) {
      for (const engineerName of shift.engineerNames) {
        const key = normaliseName(engineerName);
        map.set(key, [...(map.get(key) ?? []), shift]);
      }
    }
    return map;
  }, [snapshot?.calendar]);

  const todayKey = dateOnly(new Date());
  const todayScheduledNames = useMemo(
    () =>
      new Set(
        (snapshot?.calendar ?? [])
          .filter((shift) => shift.shiftDate === todayKey)
          .flatMap((shift) => shift.engineerNames)
          .map(normaliseName),
      ),
    [snapshot?.calendar, todayKey],
  );

  const filteredEngineers = useMemo(() => {
    const query = search.trim().toLowerCase();
    return (payload?.engineers ?? [])
      .filter((engineer) => {
        if (
          query &&
          !engineer.full_name.toLowerCase().includes(query) &&
          !(engineer.discipline ?? "").toLowerCase().includes(query) &&
          !(engineer.department_name ?? "").toLowerCase().includes(query)
        ) {
          return false;
        }
        if (riskFilter !== "all" && engineer.risk_level !== riskFilter) return false;
        return true;
      })
      .sort((left, right) => left.full_name.localeCompare(right.full_name));
  }, [payload?.engineers, riskFilter, search]);

  const weekScheduledCount = useMemo(
    () =>
      (payload?.engineers ?? []).filter((engineer) =>
        shiftsByEngineer.has(normaliseName(engineer.full_name)),
      ).length,
    [payload?.engineers, shiftsByEngineer],
  );

  const todayScheduledCount = useMemo(
    () =>
      (payload?.engineers ?? []).filter((engineer) =>
        todayScheduledNames.has(normaliseName(engineer.full_name)),
      ).length,
    [payload?.engineers, todayScheduledNames],
  );

  const coverageGapCount =
    snapshot?.calendar.filter((shift) => shift.coverageStatus === "gap").length ?? 0;
  const contractorShiftCount =
    snapshot?.calendar.filter((shift) => shift.contractorEngineerCount > 0).length ?? 0;
  const siteName = payload?.engineers.find((engineer) => engineer.site_name)?.site_name ?? "Active site";

  const weekDays = useMemo(
    () =>
      Array.from({ length: 7 }, (_, index) => {
        const date = addDays(weekStart, index);
        const key = dateOnly(date);
        return {
          date,
          key,
          day: snapshot?.calendar.find(
            (shift) => shift.shiftDate === key && shift.shiftType === "day",
          ),
          night: snapshot?.calendar.find(
            (shift) => shift.shiftDate === key && shift.shiftType === "night",
          ),
        };
      }),
    [snapshot?.calendar, weekStart],
  );

  const selectedShifts = selectedEngineer
    ? shiftsByEngineer.get(normaliseName(selectedEngineer.full_name)) ?? []
    : [];

  return (
    <section
      data-vorta-live-engineers="true"
      data-vorta-active-site={siteContext?.siteId ?? ""}
      className="flex w-full min-w-0 flex-1 flex-col gap-6 overflow-x-hidden px-4 pb-12 pt-4 md:px-6 xl:px-8"
    >
      <EngineerEvidenceDrawer
        engineer={selectedEngineer}
        scheduledShifts={selectedShifts}
        onClose={() => setSelectedEngineer(null)}
      />

      <header className="flex flex-col gap-4 border-b border-white/10 pb-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-300">
            Read-only live pilot
          </p>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-50">Engineers</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
            Site-scoped workforce records combined with the verified Shift Cover rota. Availability is
            derived from named rota assignments, not the demonstration calendar or fixed KPI values.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge className="border border-emerald-500/25 bg-emerald-500/10 text-emerald-300">
            ACTIVE-SITE VERIFIED
          </Badge>
          <button
            type="button"
            onClick={() => void loadEvidence()}
            disabled={loading}
            aria-label="Refresh verified Engineers evidence"
            className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-gray-700 bg-[#141820] px-3 text-sm font-semibold text-slate-300 transition-colors hover:border-blue-500/40 hover:text-blue-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} aria-hidden="true" />
            Refresh
          </button>
        </div>
      </header>

      {loading ? (
        <div className="flex min-h-[360px] items-center justify-center rounded-xl border border-gray-800 bg-[#141820]">
          <span className="inline-flex items-center gap-2 text-sm text-slate-400" role="status">
            <RefreshCw className="h-4 w-4 animate-spin text-blue-400" aria-hidden="true" />
            Loading verified workforce and rota evidence…
          </span>
        </div>
      ) : error ? (
        <div
          className="rounded-xl border border-red-500/25 bg-red-500/[0.07] p-6"
          role="alert"
          aria-live="assertive"
        >
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-400" aria-hidden="true" />
            <div>
              <h2 className="font-semibold text-red-200">Verified Engineers evidence is unavailable</h2>
              <p className="mt-2 text-sm leading-6 text-red-100/75">{error}</p>
              <p className="mt-2 text-xs leading-5 text-slate-400">
                Malformed, cross-site or incomplete responses are withheld rather than rendered as zero
                risk or full availability.
              </p>
            </div>
          </div>
        </div>
      ) : payload && snapshot ? (
        <>
          <div className="rounded-xl border border-blue-500/20 bg-blue-500/[0.05] p-4 text-sm text-slate-300">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <span>
                <strong className="text-slate-100">{siteName}</strong> · {payload.engineers.length} scoped
                workforce records
              </span>
              <span className="text-xs text-slate-500">
                Workforce generated {formatTimestamp(payload.generatedAt)} · Rota source {formatTimestamp(snapshot.sourceUpdatedAt)}
              </span>
            </div>
          </div>

          <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-6">
            <MetricCard
              label="Engineers"
              value={String(payload.stats.totalEngineers)}
              detail={`${payload.stats.verifiedEngineers} verified records`}
              icon={Users}
            />
            <MetricCard
              label="Scheduled today"
              value={String(todayScheduledCount)}
              detail="Named on day or night rota"
              icon={Clock3}
              tone="text-blue-300"
            />
            <MetricCard
              label="Scheduled this week"
              value={String(weekScheduledCount)}
              detail="Matched to verified rota names"
              icon={CalendarDays}
              tone="text-emerald-300"
            />
            <MetricCard
              label="Critical holders"
              value={String(payload.stats.criticalHolders)}
              detail="Capability evidence only"
              icon={Shield}
              tone={payload.stats.criticalHolders > 0 ? "text-amber-300" : "text-slate-300"}
            />
            <MetricCard
              label="Coverage gaps"
              value={String(coverageGapCount)}
              detail="Critical rota gaps this week"
              icon={AlertTriangle}
              tone={coverageGapCount > 0 ? "text-red-300" : "text-emerald-300"}
            />
            <MetricCard
              label="Rota completeness"
              value={`${snapshot.completeness.completenessPercent}%`}
              detail={`${contractorShiftCount} contractor-covered shifts`}
              icon={CheckCircle2}
              tone={snapshot.completeness.completenessPercent === 100 ? "text-emerald-300" : "text-amber-300"}
            />
          </section>

          <Card className="rounded-xl border border-gray-800 bg-[#141820] shadow-none">
            <CardContent className="p-5">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="font-semibold text-slate-50">Verified weekly coverage</h2>
                  <p className="mt-1 text-sm text-slate-400">
                    Day and night status from the same source used by Shift Cover.
                  </p>
                </div>
                <span className="text-xs text-slate-500">
                  {formatDate(startDate)} to {formatDate(endDate)}
                </span>
              </div>
              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-7">
                {weekDays.map((day) => (
                  <div key={day.key} className="rounded-lg border border-gray-800 bg-[#111620] p-3">
                    <p className="text-xs font-semibold text-slate-200">
                      {new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric" }).format(day.date)}
                    </p>
                    <div className="mt-3 flex flex-col gap-2">
                      {[{ label: "Day", shift: day.day }, { label: "Night", shift: day.night }].map(
                        ({ label, shift }) => (
                          <div key={label} className="flex items-center justify-between gap-2">
                            <span className="text-[11px] text-slate-500">{label}</span>
                            {shift ? (
                              <Badge className={`border px-1.5 py-0.5 text-[10px] ${coverageClass(shift.coverageStatus)}`}>
                                {COVERAGE_LABELS[shift.coverageStatus]}
                              </Badge>
                            ) : (
                              <span className="text-[10px] text-slate-600">No evidence</span>
                            )}
                          </div>
                        ),
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="min-w-0 rounded-xl border border-gray-800 bg-[#141820] shadow-none">
            <CardContent className="p-0">
              <div className="flex flex-col gap-4 border-b border-gray-800 p-5 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <h2 className="font-semibold text-slate-50">Engineer evidence register</h2>
                  <p className="mt-1 text-sm text-slate-400">
                    {filteredEngineers.length} of {payload.engineers.length} records
                  </p>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <label className="relative min-w-[230px]">
                    <span className="sr-only">Search engineers</span>
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" aria-hidden="true" />
                    <input
                      type="search"
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      placeholder="Search engineer, discipline or department"
                      className="h-10 w-full rounded-lg border border-gray-800 bg-[#0b0e14] pl-9 pr-3 text-sm text-slate-200 placeholder:text-slate-600 focus:border-blue-500/50 focus:outline-none focus:ring-1 focus:ring-blue-500/30"
                    />
                  </label>
                  <label>
                    <span className="sr-only">Filter by capability risk</span>
                    <select
                      value={riskFilter}
                      onChange={(event) => setRiskFilter(event.target.value)}
                      className="h-10 rounded-lg border border-gray-800 bg-[#0b0e14] px-3 text-sm text-slate-200 focus:border-blue-500/50 focus:outline-none focus:ring-1 focus:ring-blue-500/30"
                    >
                      <option value="all">All capability risk</option>
                      <option value="critical">Critical</option>
                      <option value="high">High</option>
                      <option value="medium">Medium</option>
                      <option value="low">Low</option>
                    </select>
                  </label>
                </div>
              </div>

              {filteredEngineers.length === 0 ? (
                <div className="p-10 text-center">
                  <Users className="mx-auto h-8 w-8 text-slate-700" aria-hidden="true" />
                  <p className="mt-3 text-sm text-slate-400">No engineer records match the current filters.</p>
                </div>
              ) : (
                <>
                  <div className="grid gap-3 p-4 md:hidden">
                    {filteredEngineers.map((engineer) => {
                      const weekShifts = shiftsByEngineer.get(normaliseName(engineer.full_name)) ?? [];
                      return (
                        <article key={engineer.id} className="rounded-xl border border-gray-800 bg-[#111620] p-4">
                          <div className="flex items-start gap-3">
                            <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-bold ${getAvatarColor(engineer.full_name)}`}>
                              {getInitials(engineer.full_name)}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <h3 className="font-semibold text-slate-100">{engineer.full_name}</h3>
                                {engineer.verified ? (
                                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" aria-label="Verified record" />
                                ) : null}
                              </div>
                              <p className="mt-1 text-xs text-slate-500">
                                {engineer.discipline ?? "Discipline not recorded"}
                              </p>
                            </div>
                            <span className="text-lg font-bold tabular-nums text-slate-100">
                              {engineer.skills_score}%
                            </span>
                          </div>
                          <div className="mt-3 flex flex-wrap gap-2">
                            <Badge className={`border ${riskClass(engineer.risk_level)}`}>
                              {engineer.risk_level} capability risk
                            </Badge>
                            <Badge className="border border-blue-500/25 bg-blue-500/10 text-blue-300">
                              {weekShifts.length} rota shifts
                            </Badge>
                          </div>
                          <button
                            type="button"
                            onClick={() => setSelectedEngineer(engineer)}
                            aria-label={`Review ${engineer.full_name}`}
                            className="mt-4 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-lg border border-gray-700 text-sm font-semibold text-slate-300 transition-colors hover:border-blue-500/40 hover:text-blue-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                          >
                            <UserRoundCheck className="h-4 w-4" aria-hidden="true" />
                            Review evidence
                          </button>
                        </article>
                      );
                    })}
                  </div>

                  <div className="hidden overflow-x-auto md:block">
                    <table className="w-full min-w-[920px] border-collapse text-sm">
                      <thead>
                        <tr className="border-b border-gray-800 bg-[#0f1318]">
                          {[
                            "Engineer",
                            "Department",
                            "Competency",
                            "Capability risk",
                            "Rota week",
                            "Training gaps",
                            "Evidence",
                          ].map((label) => (
                            <th
                              key={label}
                              className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-500"
                            >
                              {label}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {filteredEngineers.map((engineer) => {
                          const weekShifts = shiftsByEngineer.get(normaliseName(engineer.full_name)) ?? [];
                          const scheduledToday = todayScheduledNames.has(normaliseName(engineer.full_name));
                          return (
                            <tr key={engineer.id} className="border-b border-gray-800/60 bg-[#141820]">
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-3">
                                  <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-xs font-bold ${getAvatarColor(engineer.full_name)}`}>
                                    {getInitials(engineer.full_name)}
                                  </div>
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-2">
                                      <span className="font-semibold text-slate-100">{engineer.full_name}</span>
                                      {engineer.verified ? (
                                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" aria-label="Verified record" />
                                      ) : null}
                                    </div>
                                    <span className="text-xs text-slate-500">
                                      {engineer.discipline ?? "Discipline not recorded"}
                                    </span>
                                  </div>
                                </div>
                              </td>
                              <td className="px-4 py-3 text-slate-400">
                                {engineer.department_name ?? "Not recorded"}
                              </td>
                              <td className="px-4 py-3 font-semibold tabular-nums text-slate-200">
                                {engineer.skills_score}%
                              </td>
                              <td className="px-4 py-3">
                                <Badge className={`border ${riskClass(engineer.risk_level)}`}>
                                  {engineer.risk_level}
                                </Badge>
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex flex-col gap-1">
                                  <span className="font-semibold tabular-nums text-slate-200">
                                    {weekShifts.length} shifts
                                  </span>
                                  <span className={scheduledToday ? "text-xs text-blue-300" : "text-xs text-slate-500"}>
                                    {scheduledToday ? "Scheduled today" : "Not named today"}
                                  </span>
                                </div>
                              </td>
                              <td className="px-4 py-3 font-semibold tabular-nums text-slate-300">
                                {engineer.training_count}
                              </td>
                              <td className="px-4 py-3">
                                <button
                                  type="button"
                                  onClick={() => setSelectedEngineer(engineer)}
                                  aria-label={`Review ${engineer.full_name}`}
                                  className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-gray-700 px-3 text-xs font-semibold text-slate-300 transition-colors hover:border-blue-500/40 hover:text-blue-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                                >
                                  Review
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </>
      ) : null}
    </section>
  );
}
