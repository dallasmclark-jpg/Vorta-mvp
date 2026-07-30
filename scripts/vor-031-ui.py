from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def replace_once(path: str, old: str, new: str) -> None:
    target = ROOT / path
    content = target.read_text()
    count = content.count(old)
    if count != 1:
        raise RuntimeError(f"{path}: expected one replacement, found {count}: {old[:100]!r}")
    target.write_text(content.replace(old, new, 1))


path = "src/screens/ShiftHandover/ShiftHandoverSection.tsx"
replace_once(
    path,
    'import { VortaSelect } from "../../components/VortaSelect";\n',
    'import { VortaMultiSelect } from "../../components/VortaMultiSelect";\n'
    'import { VortaSelect } from "../../components/VortaSelect";\n',
)
replace_once(
    path,
    'import { getVortaShiftPresentation } from "../../lib/shiftPresentation";\n',
    '''import {
  VORTA_MAINTENANCE_TEAM_CODES,
  getVortaMaintenanceTeamPresentation,
  getVortaShiftPresentation,
  type VortaMaintenanceTeamCode,
} from "../../lib/shiftPresentation";
''',
)
replace_once(
    path,
    '''  type ShiftHandoverItem,
  type ShiftHandoverReviewHours,''',
    '''  type ShiftHandoverItem,
  type ShiftHandoverMaintenanceTeam,
  type ShiftHandoverReviewHours,''',
)
replace_once(
    path,
    '''type SortMode = "priority" | "breakdown" | "recent";
type ActivityGroup''',
    '''type SortMode = "priority" | "breakdown" | "recent";
type StoredFilterState = {
  maintenanceTeams: VortaMaintenanceTeamCode[];
  scopeValue: string;
  criticality: CriticalityFilter;
  status: StatusFilter;
  sortMode: SortMode;
  query: string;
  filtersOpen: boolean;
};
type ActivityGroup''',
)
replace_once(
    path,
    '''const REVIEW_STORAGE_KEY = "vorta.shift-handover.review-period";
const REVIEW_PERIOD_OPTIONS''',
    '''const REVIEW_STORAGE_KEY = "vorta.shift-handover.review-period";
const FILTER_STORAGE_KEY = "vorta.shift-handover.filters";
const SCROLL_STORAGE_KEY = "vorta.shift-handover.scroll-position";

function readStoredFilterState(): StoredFilterState {
  const fallback: StoredFilterState = {
    maintenanceTeams: [],
    scopeValue: "all",
    criticality: "all",
    status: "all",
    sortMode: "recent",
    query: "",
    filtersOpen: false,
  };
  if (typeof window === "undefined") return fallback;
  try {
    const parsed = JSON.parse(window.sessionStorage.getItem(FILTER_STORAGE_KEY) ?? "{}") as Partial<StoredFilterState>;
    const maintenanceTeams = Array.isArray(parsed.maintenanceTeams)
      ? parsed.maintenanceTeams.filter((code): code is VortaMaintenanceTeamCode =>
          [...VORTA_MAINTENANCE_TEAM_CODES, "UNASSIGNED"].includes(code as VortaMaintenanceTeamCode)
        )
      : [];
    return {
      maintenanceTeams,
      scopeValue: typeof parsed.scopeValue === "string" ? parsed.scopeValue : "all",
      criticality: ["all", "critical", "high", "medium", "low", "unknown"].includes(String(parsed.criticality))
        ? parsed.criticality as CriticalityFilter
        : "all",
      status: ["all", "active", "completed", "waiting", "contractor"].includes(String(parsed.status))
        ? parsed.status as StatusFilter
        : "all",
      sortMode: ["priority", "breakdown", "recent"].includes(String(parsed.sortMode))
        ? parsed.sortMode as SortMode
        : "recent",
      query: typeof parsed.query === "string" ? parsed.query : "",
      filtersOpen: Boolean(parsed.filtersOpen),
    };
  } catch {
    return fallback;
  }
}

const REVIEW_PERIOD_OPTIONS''',
)
replace_once(
    path,
    '''function reviewPeriodHeading(reviewHours: ShiftHandoverReviewHours): string {
  const count = reviewShiftCount(reviewHours);
  if (count === 1) return "Previous shift: Previous shift activity";
  return `Previous ${count} shifts: Activity from the previous ${count} shifts`;
}''',
    '''function reviewPeriodHeading(reviewHours: ShiftHandoverReviewHours): string {
  const count = reviewShiftCount(reviewHours);
  if (count === 1) return "Previous shift activity";
  return `Activity from the previous ${count} shifts`;
}''',
)
replace_once(
    path,
    '''function reviewPeriodLoadingState(reviewHours: ShiftHandoverReviewHours): string {
  const count = reviewShiftCount(reviewHours);
  return count === 1
    ? "Loading activity from the previous shift…"
    : `Loading activity from the previous ${count} shifts…`;
}''',
    '''function teamSelectionLabel(teams: readonly VortaMaintenanceTeamCode[]): string {
  if (teams.length === 0) return "All maintenance teams";
  if (teams.length === 1) {
    return getVortaMaintenanceTeamPresentation(teams[0]).label;
  }
  return `${teams.length} selected maintenance teams`;
}

function reviewPeriodLoadingState(
  reviewHours: ShiftHandoverReviewHours,
  teams: readonly VortaMaintenanceTeamCode[] = [],
): string {
  if (teams.length === 1) {
    return `Loading activity for ${getVortaMaintenanceTeamPresentation(teams[0]).label}…`;
  }
  const count = reviewShiftCount(reviewHours);
  return count === 1
    ? "Loading activity from the previous shift…"
    : `Loading activity from the previous ${count} shifts…`;
}

function filteredEmptyHeading(
  reviewHours: ShiftHandoverReviewHours,
  teams: readonly VortaMaintenanceTeamCode[],
): string {
  const count = reviewShiftCount(reviewHours);
  if (teams.length > 1) {
    return `No work orders match the ${teams.length} selected maintenance teams.`;
  }
  if (teams.length === 1) {
    const label = getVortaMaintenanceTeamPresentation(teams[0]).label;
    return count === 1
      ? `No ${label} activity was recorded during the previous shift.`
      : `No ${label} activity was recorded during the previous ${count} shifts.`;
  }
  return "No work orders match the selected filters.";
}''',
)
replace_once(
    path,
    '''function HandoverCard({
  item,''',
    '''function MaintenanceTeamBadges({
  teams,
  hasUnassigned,
  maxVisible = 2,
}: {
  teams: readonly ShiftHandoverMaintenanceTeam[];
  hasUnassigned: boolean;
  maxVisible?: number;
}): JSX.Element {
  const badges = [
    ...teams.map((team) => ({
      key: team.code,
      presentation: getVortaMaintenanceTeamPresentation(team.code, team.name),
    })),
    ...(hasUnassigned
      ? [{
          key: "UNASSIGNED",
          presentation: getVortaMaintenanceTeamPresentation("UNASSIGNED"),
        }]
      : []),
  ];
  const visible = badges.slice(0, maxVisible);
  const hidden = badges.length - visible.length;
  return (
    <span
      className="inline-flex min-w-0 max-w-full flex-wrap items-center gap-1.5"
      data-vorta-shift-handover-team-badges="true"
    >
      {visible.map(({ key, presentation }) => (
        <span
          key={key}
          className={`inline-flex min-h-6 max-w-full items-center gap-1.5 rounded-md border px-2 py-0.5 text-[11px] font-semibold ${presentation.badgeClassName}`}
        >
          <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${presentation.dotClassName}`} aria-hidden="true" />
          <span className="truncate">{presentation.label}</span>
        </span>
      ))}
      {hidden > 0 ? (
        <span className="rounded-md border border-gray-700 bg-[#0d1117] px-2 py-0.5 text-[11px] font-semibold text-slate-400">
          +{hidden} teams
        </span>
      ) : null}
    </span>
  );
}

function HandoverCard({
  item,''',
)
replace_once(
    path,
    '''        <span className="rounded-md border border-gray-700 bg-[#0d1117] px-2 py-1 text-xs text-slate-400">
          {DISCIPLINE_LABELS[item.discipline]}
        </span>''',
    '''        <MaintenanceTeamBadges
          teams={item.maintenanceTeams}
          hasUnassigned={item.hasUnassignedActivity}
          maxVisible={2}
        />
        <span className="rounded-md border border-gray-700 bg-[#0d1117] px-2 py-1 text-xs text-slate-400">
          {DISCIPLINE_LABELS[item.discipline]}
        </span>''',
)
replace_once(
    path,
    '''            {latestConfirmation ? (
              <div className="mt-4 grid min-w-0 gap-1 text-xs text-slate-600 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start sm:gap-3">''',
    '''            {latestConfirmation ? (
              <div className="mt-4">
                <MaintenanceTeamBadges
                  teams={latestConfirmation.maintenanceTeams}
                  hasUnassigned={latestConfirmation.maintenanceTeams.length === 0}
                  maxVisible={3}
                />
                <div className="mt-2 grid min-w-0 gap-1 text-xs text-slate-600 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start sm:gap-3">''',
)
replace_once(
    path,
    '''                <time className="whitespace-nowrap" dateTime={latestConfirmation.timestamp ?? undefined}>{formatTimestamp(latestConfirmation.timestamp)}</time>
              </div>
            ) : null}''',
    '''                  <time className="whitespace-nowrap" dateTime={latestConfirmation.timestamp ?? undefined}>{formatTimestamp(latestConfirmation.timestamp)}</time>
                </div>
              </div>
            ) : null}''',
)
replace_once(
    path,
    '''                    {metadata.length > 0 ? (
                      <div''',
    '''                    <div className="mt-3">
                      <MaintenanceTeamBadges
                        teams={confirmation.maintenanceTeams}
                        hasUnassigned={confirmation.maintenanceTeams.length === 0}
                        maxVisible={3}
                      />
                    </div>
                    {metadata.length > 0 ? (
                      <div''',
)
replace_once(
    path,
    '''  const [snapshot, setSnapshot] = useState<ShiftHandoverSnapshot | null>(null);''',
    '''  const initialFilterState = useRef(readStoredFilterState()).current;
  const [snapshot, setSnapshot] = useState<ShiftHandoverSnapshot | null>(null);''',
)
replace_once(
    path,
    '''  const [scopeValue, setScopeValue] = useState("all");
  const [criticality, setCriticality] = useState<CriticalityFilter>("all");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [sortMode, setSortMode] = useState<SortMode>("recent");
  const [query, setQuery] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);''',
    '''  const [maintenanceTeams, setMaintenanceTeams] = useState<VortaMaintenanceTeamCode[]>(
    initialFilterState.maintenanceTeams,
  );
  const [scopeValue, setScopeValue] = useState(initialFilterState.scopeValue);
  const [criticality, setCriticality] = useState<CriticalityFilter>(initialFilterState.criticality);
  const [status, setStatus] = useState<StatusFilter>(initialFilterState.status);
  const [sortMode, setSortMode] = useState<SortMode>(initialFilterState.sortMode);
  const [query, setQuery] = useState(initialFilterState.query);
  const [filtersOpen, setFiltersOpen] = useState(initialFilterState.filtersOpen);''',
)
replace_once(
    path,
    '''        if (criticality !== "all" && item.criticality !== criticality) return false;
        if (!statusMatch(item)) return false;''',
    '''        if (criticality !== "all" && item.criticality !== criticality) return false;
        if (
          maintenanceTeams.length > 0
          && !maintenanceTeams.some((teamCode) =>
            teamCode === "UNASSIGNED"
              ? item.hasUnassignedActivity
              : item.maintenanceTeams.some((team) => team.code === teamCode)
          )
        ) return false;
        if (!statusMatch(item)) return false;''',
)
replace_once(
    path,
    '''          item.functionalLocation,
        ].join(" ").toLowerCase().includes(searchTerm);''',
    '''          item.functionalLocation,
          ...item.maintenanceTeams.map((team) => team.name),
        ].join(" ").toLowerCase().includes(searchTerm);''',
)
replace_once(
    path,
    '''  }, [criticality, query, reviewHours, scopeValue, snapshot?.items, sortMode, status]);''',
    '''  }, [criticality, maintenanceTeams, query, reviewHours, scopeValue, snapshot?.items, sortMode, status]);''',
)
replace_once(
    path,
    '''  const activeAdvancedFilterCount = Number(criticality !== "all")
    + Number(status !== "all");
  const hasActiveAdvancedFilters = criticality !== "all"
    || status !== "all"
    || sortMode !== "recent";

  const clearAdvancedFilters = (): void => {
    setCriticality("all");
    setStatus("all");
    setSortMode("recent");
  };''',
    '''  const hasUnassignedActivity = Boolean(
    snapshot?.items.some((item) => item.hasUnassignedActivity),
  );
  const maintenanceTeamOptions = useMemo(() => {
    const codes: VortaMaintenanceTeamCode[] = [
      ...VORTA_MAINTENANCE_TEAM_CODES,
      ...(hasUnassignedActivity ? ["UNASSIGNED" as const] : []),
    ];
    return codes.map((code) => {
      const presentation = getVortaMaintenanceTeamPresentation(code);
      return {
        value: code,
        label: presentation.label,
        dotClassName: presentation.dotClassName,
        textClassName: presentation.textClassName,
      };
    });
  }, [hasUnassignedActivity]);

  const activeAdvancedFilterCount = Number(maintenanceTeams.length > 0)
    + Number(criticality !== "all")
    + Number(status !== "all");
  const hasActiveAdvancedFilters = maintenanceTeams.length > 0
    || criticality !== "all"
    || status !== "all"
    || sortMode !== "recent";

  const clearAdvancedFilters = (): void => {
    setMaintenanceTeams([]);
    setCriticality("all");
    setStatus("all");
    setSortMode("recent");
  };''',
)
replace_once(
    path,
    '''  useEffect(() => {
    if (scopeValue !== "all" && !scopeAreas.includes(scopeValue)) {''',
    '''  useEffect(() => {
    if (!hasUnassignedActivity && maintenanceTeams.includes("UNASSIGNED")) {
      setMaintenanceTeams((current) => current.filter((code) => code !== "UNASSIGNED"));
    }
  }, [hasUnassignedActivity, maintenanceTeams]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.sessionStorage.setItem(FILTER_STORAGE_KEY, JSON.stringify({
      maintenanceTeams,
      scopeValue,
      criticality,
      status,
      sortMode,
      query,
      filtersOpen,
    } satisfies StoredFilterState));
  }, [criticality, filtersOpen, maintenanceTeams, query, scopeValue, sortMode, status]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const scrollContainer = document.querySelector<HTMLElement>('[data-vorta-portal-scroll-container="true"]');
    const stored = Number(window.sessionStorage.getItem(SCROLL_STORAGE_KEY) ?? 0);
    const restoreFrame = window.requestAnimationFrame(() => {
      if (!Number.isFinite(stored) || stored <= 0) return;
      if (scrollContainer) scrollContainer.scrollTop = stored;
      else window.scrollTo({ top: stored });
    });
    let writeFrame = 0;
    const saveScroll = (): void => {
      window.cancelAnimationFrame(writeFrame);
      writeFrame = window.requestAnimationFrame(() => {
        const value = scrollContainer?.scrollTop ?? window.scrollY;
        window.sessionStorage.setItem(SCROLL_STORAGE_KEY, String(value));
      });
    };
    const target: EventTarget = scrollContainer ?? window;
    target.addEventListener("scroll", saveScroll, { passive: true });
    return () => {
      window.cancelAnimationFrame(restoreFrame);
      window.cancelAnimationFrame(writeFrame);
      target.removeEventListener("scroll", saveScroll);
      const value = scrollContainer?.scrollTop ?? window.scrollY;
      window.sessionStorage.setItem(SCROLL_STORAGE_KEY, String(value));
    };
  }, []);

  useEffect(() => {
    if (scopeValue !== "all" && !scopeAreas.includes(scopeValue)) {''',
)
for _ in range(2):
    replace_once(
        path,
        '{reviewPeriodLoadingState(reviewHours)}',
        '{reviewPeriodLoadingState(reviewHours, maintenanceTeams)}',
    )
replace_once(
    path,
    'lg:grid-cols-[minmax(220px,1fr)_repeat(3,minmax(150px,0.45fr))]',
    'lg:grid-cols-[minmax(220px,1fr)_repeat(4,minmax(150px,0.45fr))]',
)
replace_once(
    path,
    '''    >
      <VortaSelect
        label="Criticality"''',
    '''    >
      <VortaMultiSelect
        label="Maintenance team"
        values={maintenanceTeams}
        options={maintenanceTeamOptions}
        allLabel="All maintenance teams"
        onChange={setMaintenanceTeams}
      />

      <VortaSelect
        label="Criticality"''',
)
replace_once(
    path,
    ''': "No work orders match the selected filters."}''',
    ''': filteredEmptyHeading(reviewHours, maintenanceTeams)}''',
)
replace_once(
    path,
    ''': "Return to Site or clear the search, status or criticality filters."}''',
    ''': maintenanceTeams.length > 0
          ? `Selected team scope: ${teamSelectionLabel(maintenanceTeams)}. Clear maintenance team or other filters to broaden the result.`
          : "Return to Site or clear the search, status or criticality filters."}''',
)

print("VOR-031 UI patch applied")
