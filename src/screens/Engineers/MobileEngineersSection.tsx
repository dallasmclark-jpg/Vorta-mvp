import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  GraduationCap,
  MapPin,
  RefreshCw,
  Search,
  Shield,
  Users,
} from "lucide-react";
import { DetailDrawer, DrawerCloseButton } from "../../components/DetailDrawer";
import { useAuth } from "../../lib/auth";
import type { VortaDataMode } from "../../lib/dataTrust";
import { supabase } from "../../lib/supabaseClient";
import {
  getShiftCoverSnapshot,
  type ShiftCoverSnapshot,
} from "../LabourRisk/shiftCoverService";
import { EngineerAvatar } from "./EngineerAvatar";

type MobileEngineer = {
  id: string;
  full_name: string;
  avatar_url: string | null;
  discipline: string | null;
  department_name: string | null;
  site_name: string | null;
  availability_status: string;
  risk_level: string;
  skills_score: number;
  training_count: number;
  verified: boolean;
  critical_knowledge_holder?: boolean;
};

type EngineersStats = {
  totalEngineers: number;
  currentlyAvailable: number;
  onShiftToday: number;
  criticalHolders: number;
};

type EngineerSummaryFilter =
  | "on-shift"
  | "available"
  | "critical-sme"
  | "at-risk";

type SummaryDefinition = {
  key: EngineerSummaryFilter;
  label: string;
  detail: string;
};

const EMPTY_STATS: EngineersStats = {
  totalEngineers: 0,
  currentlyAvailable: 0,
  onShiftToday: 0,
  criticalHolders: 0,
};

const SUMMARY_FILTERS: SummaryDefinition[] = [
  { key: "on-shift", label: "On shift", detail: "Scheduled today" },
  { key: "available", label: "Available", detail: "Ready to deploy" },
  { key: "critical-sme", label: "Critical SME", detail: "Knowledge holders" },
  { key: "at-risk", label: "At risk", detail: "High or critical risk" },
];

const DAY_MS = 24 * 60 * 60 * 1000;

function formatDateOnly(value: Date): string {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function startOfWeek(value: Date): Date {
  const result = new Date(value.getFullYear(), value.getMonth(), value.getDate());
  const day = result.getDay();
  result.setDate(result.getDate() + (day === 0 ? -6 : 1 - day));
  return result;
}

function addDays(value: Date, days: number): Date {
  return new Date(value.getTime() + days * DAY_MS);
}

function statusLabel(value: string): string {
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function riskClass(level: string): string {
  const value = level.toLowerCase();
  if (value === "critical") return "border-red-500/30 bg-red-500/10 text-red-300";
  if (value === "high") return "border-orange-500/30 bg-orange-500/10 text-orange-300";
  if (value === "medium") return "border-amber-400/30 bg-amber-400/10 text-amber-300";
  return "border-emerald-500/25 bg-emerald-500/10 text-emerald-300";
}

function availabilityClass(value: string): string {
  if (value === "available") return "text-emerald-300";
  if (value === "on_shift") return "text-blue-300";
  return "text-slate-400";
}

function matchesSummary(
  engineer: MobileEngineer,
  filter: EngineerSummaryFilter,
): boolean {
  if (filter === "on-shift") {
    return engineer.availability_status.toLowerCase() === "on_shift";
  }
  if (filter === "available") {
    return engineer.availability_status.toLowerCase() === "available";
  }
  if (filter === "critical-sme") {
    return engineer.critical_knowledge_holder === true;
  }
  return ["critical", "high"].includes(engineer.risk_level.toLowerCase());
}

function SummaryFilterCard({
  definition,
  count,
  selected,
  loading,
  onSelect,
}: {
  definition: SummaryDefinition;
  count: number;
  selected: boolean;
  loading: boolean;
  onSelect: () => void;
}): JSX.Element {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={selected}
      aria-controls="engineer-priority-panel"
      disabled={loading}
      data-vorta-engineer-summary-filter={definition.key}
      data-vorta-engineer-summary-count={count}
      onClick={onSelect}
      className={`min-h-24 rounded-xl border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 disabled:cursor-wait disabled:opacity-60 ${
        selected
          ? "border-blue-500 bg-[#141820] shadow-[inset_0_0_0_1px_rgba(59,130,246,0.25)]"
          : "border-gray-800 bg-[#141820] active:bg-[#1a2030]"
      }`}
    >
      <span className="block text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
        {definition.label}
      </span>
      <span className="mt-2 block text-2xl font-semibold tabular-nums text-slate-50">
        {loading ? "—" : count}
      </span>
      <span className="mt-1 block text-xs text-slate-500">{definition.detail}</span>
    </button>
  );
}

function EngineerCard({
  engineer,
  eager,
  context,
  onSelect,
}: {
  engineer: MobileEngineer;
  eager: boolean;
  context: "priority" | "register";
  onSelect: () => void;
}): JSX.Element {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-label={`Review ${engineer.full_name}`}
      data-vorta-engineer-card-context={context}
      className="w-full rounded-xl border border-gray-800 bg-[#141820] p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 active:bg-[#1a2030]"
    >
      <div className="flex items-start gap-3">
        <EngineerAvatar
          name={engineer.full_name}
          avatarUrl={engineer.avatar_url}
          eager={eager}
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <p className="truncate font-semibold text-slate-100">
              {engineer.full_name}
            </p>
            {engineer.verified ? (
              <CheckCircle2
                className="h-3.5 w-3.5 shrink-0 text-emerald-400"
                aria-label="Verified"
              />
            ) : null}
            {engineer.critical_knowledge_holder ? (
              <Shield
                className="h-3.5 w-3.5 shrink-0 text-blue-400"
                aria-label="Critical knowledge holder"
              />
            ) : null}
          </div>
          <p className="mt-0.5 truncate text-xs text-slate-500">
            {engineer.discipline ?? "Discipline not recorded"}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
            <span className={availabilityClass(engineer.availability_status)}>
              {statusLabel(engineer.availability_status)}
            </span>
            {engineer.department_name ? (
              <span className="text-slate-500">{engineer.department_name}</span>
            ) : null}
            {engineer.site_name ? (
              <span className="inline-flex items-center gap-1 text-slate-600">
                <MapPin className="h-3 w-3" aria-hidden="true" />
                {engineer.site_name}
              </span>
            ) : null}
          </div>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-lg font-semibold tabular-nums text-blue-300">
            {engineer.skills_score}%
          </p>
          <p className="text-[10px] text-slate-600">skills</p>
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between gap-3 border-t border-gray-800 pt-3">
        <span
          className={`rounded-md border px-2 py-1 text-[10px] font-semibold ${riskClass(
            engineer.risk_level,
          )}`}
        >
          {statusLabel(engineer.risk_level)} risk
        </span>
        <span className="inline-flex items-center gap-1 text-xs text-slate-400">
          <GraduationCap className="h-3.5 w-3.5 text-amber-300" aria-hidden="true" />
          {engineer.training_count} training gap
          {engineer.training_count === 1 ? "" : "s"}
          <ChevronRight className="ml-1 h-4 w-4 text-slate-600" aria-hidden="true" />
        </span>
      </div>
    </button>
  );
}

export function MobileEngineersSection({
  dataMode,
}: {
  dataMode: VortaDataMode;
}): JSX.Element {
  const navigate = useNavigate();
  const { siteContext } = useAuth();
  const [engineers, setEngineers] = useState<MobileEngineer[]>([]);
  const [stats, setStats] = useState<EngineersStats>(EMPTY_STATS);
  const [snapshot, setSnapshot] = useState<ShiftCoverSnapshot | null>(null);
  const [selectedEngineer, setSelectedEngineer] = useState<MobileEngineer | null>(null);
  const [selectedSummary, setSelectedSummary] = useState<EngineerSummaryFilter | null>(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rotaError, setRotaError] = useState(false);

  const load = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);
    setRotaError(false);

    try {
      const { data, error: invokeError } = await supabase.functions.invoke(
        "engineers-data",
      );
      if (invokeError || !data || !Array.isArray(data.engineers)) {
        throw invokeError ?? new Error("Engineer evidence could not be loaded.");
      }
      if (siteContext?.siteId && data.siteId && data.siteId !== siteContext.siteId) {
        throw new Error("Engineer evidence does not match the authorised active site.");
      }

      setEngineers(data.engineers as MobileEngineer[]);
      setStats({
        ...EMPTY_STATS,
        ...(data.stats as Partial<EngineersStats> | undefined),
      });

      if (siteContext?.siteId) {
        const weekStart = startOfWeek(new Date());
        try {
          setSnapshot(
            await getShiftCoverSnapshot(
              siteContext.siteId,
              formatDateOnly(weekStart),
              formatDateOnly(addDays(weekStart, 6)),
            ),
          );
        } catch {
          setSnapshot(null);
          setRotaError(true);
        }
      } else {
        setSnapshot(null);
        setRotaError(true);
      }
    } catch (loadError) {
      setEngineers([]);
      setStats(EMPTY_STATS);
      setSnapshot(null);
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Engineer evidence could not be loaded.",
      );
    } finally {
      setLoading(false);
    }
  }, [siteContext?.siteId]);

  useEffect(() => {
    void load();
  }, [load]);

  const orderedEngineers = useMemo(
    () =>
      [...engineers].sort(
        (left, right) =>
          Number(right.risk_level.toLowerCase() === "critical") -
            Number(left.risk_level.toLowerCase() === "critical") ||
          right.training_count - left.training_count ||
          right.skills_score - left.skills_score,
      ),
    [engineers],
  );

  const filteredEngineers = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return orderedEngineers;
    return orderedEngineers.filter((engineer) =>
      [engineer.full_name, engineer.discipline, engineer.department_name]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query)),
    );
  }, [orderedEngineers, search]);

  const summaryCounts = useMemo(
    () =>
      SUMMARY_FILTERS.reduce<Record<EngineerSummaryFilter, number>>(
        (counts, definition) => ({
          ...counts,
          [definition.key]: engineers.filter((engineer) =>
            matchesSummary(engineer, definition.key),
          ).length,
        }),
        {
          "on-shift": 0,
          available: 0,
          "critical-sme": 0,
          "at-risk": 0,
        },
      ),
    [engineers],
  );

  const priorityEngineers = useMemo(
    () =>
      selectedSummary
        ? orderedEngineers.filter((engineer) =>
            matchesSummary(engineer, selectedSummary),
          )
        : [],
    [orderedEngineers, selectedSummary],
  );

  const selectedSummaryDefinition = selectedSummary
    ? SUMMARY_FILTERS.find((definition) => definition.key === selectedSummary) ?? null
    : null;

  const today = formatDateOnly(new Date());
  const todayShifts =
    snapshot?.calendar.filter((item) => item.shiftDate === today) ?? [];
  const atRiskShifts =
    snapshot?.calendar.filter((item) =>
      ["gap", "partial", "reduced"].includes(item.coverageStatus),
    ) ?? [];
  const highestRiskShift = [...atRiskShifts].sort(
    (left, right) => right.labourRiskScore - left.labourRiskScore,
  )[0];

  return (
    <section
      className="flex w-full flex-col gap-4 overflow-x-hidden px-3 pb-24 pt-4"
      data-vorta-mobile-engineers="true"
    >
      <DetailDrawer
        open={Boolean(selectedEngineer)}
        onClose={() => setSelectedEngineer(null)}
      >
        <div className="flex items-start justify-between border-b border-gray-800 p-5">
          <div className="flex min-w-0 items-start gap-3 pr-3">
            {selectedEngineer ? (
              <EngineerAvatar
                name={selectedEngineer.full_name}
                avatarUrl={selectedEngineer.avatar_url}
                size="lg"
                eager
              />
            ) : null}
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-blue-300">
                Engineer record
              </p>
              <h2 className="mt-2 truncate text-lg font-semibold text-slate-50">
                {selectedEngineer?.full_name ?? "Engineer"}
              </h2>
              <p className="mt-1 text-sm text-slate-400">
                {selectedEngineer?.discipline ?? "Discipline not recorded"}
              </p>
            </div>
          </div>
          <DrawerCloseButton onClose={() => setSelectedEngineer(null)} />
        </div>
        <div className="grid grid-cols-3 divide-x divide-gray-800 border-b border-gray-800">
          <div className="p-4">
            <p className="text-[10px] text-slate-500">Skills</p>
            <p className="mt-1 text-xl font-semibold text-blue-300">
              {selectedEngineer?.skills_score ?? 0}%
            </p>
          </div>
          <div className="p-4">
            <p className="text-[10px] text-slate-500">Gaps</p>
            <p className="mt-1 text-xl font-semibold text-amber-300">
              {selectedEngineer?.training_count ?? 0}
            </p>
          </div>
          <div className="p-4">
            <p className="text-[10px] text-slate-500">Status</p>
            <p className="mt-1 text-sm font-semibold text-slate-200">
              {statusLabel(selectedEngineer?.availability_status ?? "unknown")}
            </p>
          </div>
        </div>
        <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-5">
          <div className="rounded-xl border border-gray-800 bg-[#141820] p-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
              Workforce context
            </p>
            <p className="mt-2 text-sm text-slate-200">
              {selectedEngineer?.department_name ?? "Department not recorded"}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              {selectedEngineer?.site_name ?? "Active site"}
            </p>
          </div>
          <div className="grid gap-2">
            <button
              type="button"
              onClick={() => navigate("/skills-matrix")}
              className="inline-flex min-h-12 items-center justify-between rounded-xl border border-gray-800 bg-[#141820] px-4 text-sm font-semibold text-slate-100"
            >
              View skills evidence
              <ChevronRight className="h-4 w-4 text-slate-500" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => navigate("/training")}
              className="inline-flex min-h-12 items-center justify-between rounded-xl border border-gray-800 bg-[#141820] px-4 text-sm font-semibold text-slate-100"
            >
              Review training needs
              <ChevronRight className="h-4 w-4 text-slate-500" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => navigate("/maintenance/labour-risk/shift-cover")}
              className="inline-flex min-h-12 items-center justify-between rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white"
            >
              Open shift cover
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      </DetailDrawer>

      <header className="flex items-start justify-between gap-3 border-b border-gray-800 pb-4">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-blue-300">
            {dataMode === "live" ? "Verified workforce" : "Demo workforce"}
          </p>
          <h1 data-vorta-mobile-page-title="true" className="mt-1 text-xl font-semibold text-slate-50">
            Engineers
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Who is available, capable and at risk today.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          aria-label="Refresh engineer evidence"
          className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-gray-800 bg-[#141820] text-slate-300 disabled:opacity-50"
        >
          <RefreshCw
            className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
            aria-hidden="true"
          />
        </button>
      </header>

      {error ? (
        <div
          className="rounded-xl border border-red-500/30 bg-red-500/10 p-4"
          role="alert"
        >
          <div className="flex items-center gap-2 text-red-300">
            <AlertTriangle className="h-4 w-4" aria-hidden="true" />
            <p className="font-semibold">Engineer evidence unavailable</p>
          </div>
          <p className="mt-2 text-sm text-red-200/80">{error}</p>
          <button
            type="button"
            onClick={() => void load()}
            className="mt-3 min-h-11 rounded-lg border border-red-400/30 px-3 text-sm font-semibold text-red-100"
          >
            Retry
          </button>
        </div>
      ) : (
        <>
          <div
            className="grid grid-cols-2 gap-2"
            role="tablist"
            aria-label="Engineer priority filters"
            data-vorta-engineer-summary-tabs="true"
          >
            {SUMMARY_FILTERS.map((definition) => (
              <SummaryFilterCard
                key={definition.key}
                definition={definition}
                count={summaryCounts[definition.key]}
                selected={selectedSummary === definition.key}
                loading={loading}
                onSelect={() =>
                  setSelectedSummary((current) =>
                    current === definition.key ? null : definition.key,
                  )
                }
              />
            ))}
          </div>

          {selectedSummaryDefinition ? (
            <section
              id="engineer-priority-panel"
              role="tabpanel"
              data-vorta-engineer-priority-panel={selectedSummaryDefinition.key}
              data-vorta-engineer-priority-count={priorityEngineers.length}
              className="rounded-xl border border-blue-500/25 bg-blue-500/[0.04] p-3"
            >
              <div className="flex items-center justify-between gap-3 pb-3">
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-blue-300">
                    Priority view
                  </p>
                  <h2 className="mt-1 font-semibold text-slate-50">
                    {selectedSummaryDefinition.label} engineers
                  </h2>
                  <p className="mt-1 text-xs text-slate-500">
                    {priorityEngineers.length} matching engineer
                    {priorityEngineers.length === 1 ? "" : "s"}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedSummary(null)}
                  className="min-h-11 shrink-0 rounded-lg border border-gray-700 bg-[#141820] px-3 text-xs font-semibold text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60"
                >
                  All engineers
                </button>
              </div>

              {priorityEngineers.length > 0 ? (
                <div className="flex flex-col gap-2">
                  {priorityEngineers.map((engineer, index) => (
                    <EngineerCard
                      key={`priority-${engineer.id}`}
                      engineer={engineer}
                      eager={index < 4}
                      context="priority"
                      onSelect={() => setSelectedEngineer(engineer)}
                    />
                  ))}
                </div>
              ) : (
                <div
                  className="rounded-lg border border-dashed border-gray-700 bg-[#10151d] px-4 py-6 text-center"
                  data-vorta-engineer-priority-empty="true"
                >
                  <p className="text-sm font-semibold text-slate-200">
                    No matching engineers
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    No current records meet this priority condition.
                  </p>
                </div>
              )}
            </section>
          ) : null}

          <button
            type="button"
            onClick={() => navigate("/maintenance/labour-risk/shift-cover")}
            className="rounded-xl border border-blue-500/25 bg-blue-500/[0.07] p-4 text-left"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-blue-300">
                  <CalendarDays className="h-4 w-4" aria-hidden="true" />
                  <p className="text-sm font-semibold">Verified shift cover</p>
                </div>
                {rotaError ? (
                  <p className="mt-2 text-sm text-slate-400">
                    Rota evidence is temporarily unavailable.
                  </p>
                ) : highestRiskShift ? (
                  <p className="mt-2 text-sm leading-5 text-slate-300">
                    Highest exposure: {highestRiskShift.shiftDate}{" "}
                    {highestRiskShift.shiftType} shift ·{" "}
                    {highestRiskShift.missingSkillCount} missing skill
                    {highestRiskShift.missingSkillCount === 1 ? "" : "s"} ·{" "}
                    {highestRiskShift.equipmentWithMissingCover} affected asset
                    {highestRiskShift.equipmentWithMissingCover === 1 ? "" : "s"}.
                  </p>
                ) : (
                  <p className="mt-2 text-sm text-slate-300">
                    {todayShifts.length} shift{todayShifts.length === 1 ? "" : "s"}{" "}
                    recorded today with no current weekly coverage gap.
                  </p>
                )}
              </div>
              <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-blue-300" aria-hidden="true" />
            </div>
          </button>

          <label className="relative block">
            <Search
              className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500"
              aria-hidden="true"
            />
            <span className="sr-only">Search engineers</span>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search engineers"
              className="min-h-12 w-full rounded-xl border border-gray-800 bg-[#10151d] pl-10 pr-4 text-base text-slate-100 outline-none placeholder:text-slate-600 focus:border-blue-500"
            />
          </label>

          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="font-semibold text-slate-50">Engineer register</h2>
              <p className="text-xs text-slate-500">
                {filteredEngineers.length} of {stats.totalEngineers} engineers
              </p>
            </div>
            <span className="inline-flex items-center gap-1.5 rounded-md border border-gray-800 bg-[#141820] px-2 py-1 text-[10px] font-semibold text-slate-400">
              <Users className="h-3 w-3" aria-hidden="true" /> Site workforce
            </span>
          </div>

          <div className="flex flex-col gap-2" data-vorta-engineer-register="true">
            {loading && engineers.length === 0
              ? Array.from({ length: 4 }, (_, index) => (
                  <div
                    key={index}
                    className="h-28 animate-pulse rounded-xl border border-gray-800 bg-[#141820]"
                  />
                ))
              : filteredEngineers.map((engineer, index) => (
                  <EngineerCard
                    key={engineer.id}
                    engineer={engineer}
                    eager={index < 4}
                    context="register"
                    onSelect={() => setSelectedEngineer(engineer)}
                  />
                ))}
          </div>
        </>
      )}
    </section>
  );
}
