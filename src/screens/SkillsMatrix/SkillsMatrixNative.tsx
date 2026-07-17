import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ElementType,
} from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  AlertTriangle,
  ArrowRight,
  Award,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Cpu,
  Download,
  Gauge,
  Layers3,
  RefreshCw,
  Search,
  Shield,
  Users,
  Wrench,
} from "lucide-react";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Card, CardContent } from "../../components/ui/card";
import { ContextHelp } from "../../components/ContextHelp";
import { DetailDrawer, DrawerCloseButton } from "../../components/DetailDrawer";
import {
  clearMaintenancePortalDataCache,
  supabase,
} from "../../lib/supabaseClient";

const SKILLS_MATRIX_FUNCTION = "skills-matrix-data";
const SKILLS_MATRIX_OPTIONS = { body: { schemaVersion: "capability-v3" } };
const ALL_SITE = "All Site";

type ViewMode = "team" | "department";
type ScopeStatus = "Strong" | "Moderate" | "At risk" | "Critical";

type ScopeSummary = {
  id: string;
  code: string;
  name: string;
  scopeType: "overall" | "team" | "department";
  memberCount: number;
  score: number;
  skillsCoverage: number;
  experienceDepth: number;
  smeResilience: number;
  validationHealth: number;
  criticalGaps: number;
  spofCount: number;
  trainingNeeds: number;
  affectedEquipment: number;
  status: ScopeStatus;
};

type QualifiedEngineer = {
  engineerId: string;
  engineerName: string;
  rating: number;
  yearsExperience: number;
  verified: boolean;
  shiftNames: string[];
};

type NearestEngineer = {
  engineerId: string;
  engineerName: string;
  rating: number;
  yearsExperience: number;
  trainingRequired: boolean;
};

type PriorityRisk = {
  id: string;
  equipmentId: string;
  equipmentCode: string;
  equipmentName: string;
  area: string;
  equipmentCriticality: string;
  skillId: string;
  skillName: string;
  skillCategory: string;
  requiredLevel: number;
  minimumRequired: number;
  qualifiedCount: number;
  validatedQualified: number;
  validationGap: number;
  gap: number;
  singlePoint: boolean;
  criticality: string;
  isCritical: boolean;
  qualifiedEngineers: QualifiedEngineer[];
  nearestEngineers: NearestEngineer[];
  recommendedAction: string;
  projectedScoreGain: number;
  riskRank: number;
};

type MatrixSkill = {
  id: string;
  name: string;
  category: string;
  isCritical: boolean;
  equipmentCount: number;
};

type RatingCell = {
  rating: number | null;
  yearsExperience: number;
  validationState: string;
  trainingRequired: boolean;
  practiceAuthority: string | null;
  lastUsedDate: string | null;
};

type ScopeEngineer = {
  id: string;
  name: string;
  avatarUrl: string | null;
  discipline: string;
  departmentName: string | null;
  shiftNames: string[];
  availabilityStatus: string;
  averageYearsExperience: number;
  criticalKnowledgeHolder: boolean;
  retirementRisk: string | null;
  leavingRisk: string | null;
  trainingNeeds: number;
  criticalSkillCount: number;
  ratings: Record<string, RatingCell>;
};

type ScopeDetail = {
  scopeId: string;
  priorityRisks: PriorityRisk[];
  matrixSkills: MatrixSkill[];
  engineers: ScopeEngineer[];
};

type SkillsMatrixPayload = {
  generatedAt: string;
  sourceUpdatedAt: string;
  site: { id: string; name: string };
  overall: ScopeSummary;
  teams: ScopeSummary[];
  departments: ScopeSummary[];
  areaSkills: Record<string, string[]>;
  details: Record<string, ScopeDetail>;
};

type TeamTone = {
  accent: string;
  selected: string;
  panel: string;
  text: string;
  icon: ElementType;
};

const TEAM_TONES: Record<string, TeamTone> = {
  OVERALL: {
    accent: "border-t-blue-400",
    selected:
      "border-x-blue-400/70 border-b-blue-400/70 bg-blue-500/[0.06] ring-blue-400/20",
    panel:
      "border-t-blue-400 bg-gradient-to-r from-blue-500/[0.08] to-[#141820]",
    text: "text-blue-300",
    icon: Layers3,
  },
  RED: {
    accent: "border-t-red-500",
    selected:
      "border-x-red-500/70 border-b-red-500/70 bg-red-500/[0.06] ring-red-500/20",
    panel: "border-t-red-500 bg-gradient-to-r from-red-500/[0.08] to-[#141820]",
    text: "text-red-400",
    icon: Users,
  },
  GREEN: {
    accent: "border-t-emerald-500",
    selected:
      "border-x-emerald-500/70 border-b-emerald-500/70 bg-emerald-500/[0.06] ring-emerald-500/20",
    panel:
      "border-t-emerald-500 bg-gradient-to-r from-emerald-500/[0.08] to-[#141820]",
    text: "text-emerald-400",
    icon: Users,
  },
  BLUE: {
    accent: "border-t-blue-500",
    selected:
      "border-x-blue-500/70 border-b-blue-500/70 bg-blue-500/[0.06] ring-blue-500/20",
    panel:
      "border-t-blue-500 bg-gradient-to-r from-blue-500/[0.08] to-[#141820]",
    text: "text-blue-400",
    icon: Users,
  },
  YELLOW: {
    accent: "border-t-yellow-400",
    selected:
      "border-x-yellow-400/70 border-b-yellow-400/70 bg-yellow-400/[0.055] ring-yellow-400/20",
    panel:
      "border-t-yellow-400 bg-gradient-to-r from-yellow-400/[0.08] to-[#141820]",
    text: "text-yellow-300",
    icon: Users,
  },
  DAYS: {
    accent: "border-t-slate-300",
    selected:
      "border-x-slate-300/60 border-b-slate-300/60 bg-slate-300/[0.045] ring-slate-300/15",
    panel:
      "border-t-slate-300 bg-gradient-to-r from-slate-300/[0.06] to-[#141820]",
    text: "text-slate-200",
    icon: Users,
  },
  CALIBRATION: {
    accent: "border-t-violet-400",
    selected:
      "border-x-violet-400/70 border-b-violet-400/70 bg-violet-500/[0.065] ring-violet-400/20",
    panel:
      "border-t-violet-400 bg-gradient-to-r from-violet-500/[0.09] to-[#141820]",
    text: "text-violet-300",
    icon: Gauge,
  },
  OT: {
    accent: "border-t-cyan-400",
    selected:
      "border-x-cyan-400/70 border-b-cyan-400/70 bg-cyan-500/[0.055] ring-cyan-400/20",
    panel:
      "border-t-cyan-400 bg-gradient-to-r from-cyan-500/[0.08] to-[#141820]",
    text: "text-cyan-300",
    icon: Cpu,
  },
};

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function clamp(value: number): number {
  return Math.min(100, Math.max(0, Number(value) || 0));
}

function capabilityStatus(score: number): ScopeStatus {
  if (score < 55) return "Critical";
  if (score < 70) return "At risk";
  if (score < 85) return "Moderate";
  return "Strong";
}

function normaliseSkillsMatrixPayload(
  payload: SkillsMatrixPayload,
): SkillsMatrixPayload {
  return payload;
}

function statusBadgeClass(status: ScopeStatus): string {
  if (status === "Strong") {
    return "border-emerald-500/30 bg-emerald-500/10 text-emerald-300";
  }
  if (status === "Moderate") {
    return "border-blue-500/30 bg-blue-500/10 text-blue-300";
  }
  if (status === "At risk") {
    return "border-amber-400/30 bg-amber-400/10 text-amber-300";
  }
  return "border-red-500/30 bg-red-500/10 text-red-400";
}

function scoreClass(score: number): string {
  if (score >= 85) return "text-emerald-400";
  if (score >= 70) return "text-blue-400";
  if (score >= 55) return "text-amber-300";
  return "text-red-400";
}

function riskBadgeClass(level: string): string {
  if (level.toLowerCase() === "critical") {
    return "border-red-500/30 bg-red-500/10 text-red-400";
  }
  if (level.toLowerCase() === "high") {
    return "border-orange-400/30 bg-orange-400/10 text-orange-300";
  }
  if (level.toLowerCase() === "medium") {
    return "border-amber-400/30 bg-amber-400/10 text-amber-300";
  }
  return "border-slate-600 bg-slate-800/60 text-slate-300";
}

function ratingClass(rating: number | null): string {
  if (rating === null) return "bg-transparent text-slate-700";
  if (rating >= 5) return "bg-emerald-500/20 text-emerald-300";
  if (rating >= 4) return "bg-blue-500/20 text-blue-300";
  if (rating >= 3) return "bg-amber-400/20 text-amber-300";
  if (rating >= 2) return "bg-orange-500/20 text-orange-300";
  return "bg-red-500/20 text-red-400";
}

function validationLabel(state: string): string {
  if (state === "validated") return "Validated";
  if (state === "expired") return "Expired";
  if (state === "pending") return "Pending validation";
  if (state === "rejected") return "Rejected";
  if (state === "unverified") return "Unverified";
  return "No evidence";
}

function freshnessLabel(value: string): string {
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return "Freshness unavailable";
  const minutes = Math.max(0, Math.round((Date.now() - timestamp) / 60_000));
  if (minutes < 1) return "Updated just now";
  if (minutes < 60) return `Updated ${minutes}m ago`;
  return `Updated ${Math.round(minutes / 60)}h ago`;
}

function siteWideLabel(siteName: string): string {
  const baseName = siteName.replace(/\s+Sterile Fill-Finish$/i, "").trim();
  return `${baseName || siteName} · Site-wide Maintenance`;
}

function engineerInitials(name: string): string {
  return name
    .split(" ")
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("");
}

function abbreviate(value: string): string {
  const map: Record<string, string> = {
    "Bosch Vial Fillers": "Bosch VF",
    "Vial Filling Lines": "Vial Lines",
    "Vision Inspection Systems": "Vision",
    "Electrical Fault Finding": "Elec. Fault",
    "Environmental Monitoring Systems": "Env. Monitor",
    "Operational Technology": "OT",
    "Instrumentation / Calibration": "Calibration",
  };
  return map[value] ?? (value.length > 12 ? `${value.slice(0, 11)}…` : value);
}

function MetricBar({
  label,
  value,
}: {
  label: string;
  value: number;
}): JSX.Element {
  const width = clamp(value);
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-3 text-[11px]">
        <span className="text-slate-500">{label}</span>
        <span className="font-semibold tabular-nums text-slate-300">
          {Math.round(width)}%
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-gray-800">
        <div
          className="h-full rounded-full bg-current text-blue-400"
          style={{ width: `${width}%` }}
        />
      </div>
    </div>
  );
}

function CapabilityCard({
  scope,
  selected,
  onSelect,
}: {
  scope: ScopeSummary;
  selected: boolean;
  onSelect: () => void;
}): JSX.Element {
  const tone = TEAM_TONES[scope.code] ?? TEAM_TONES.OVERALL;
  const Icon = tone.icon;
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={`min-w-0 rounded-xl border border-t-2 bg-[#141820] p-5 text-left shadow-none transition-all ${tone.accent} ${
        selected
          ? `${tone.selected} ring-1`
          : "border-x-gray-800 border-b-gray-800 hover:border-x-gray-700 hover:border-b-gray-700 hover:bg-[#171c25]"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-slate-100">
            {scope.name}
          </p>
          <p className="mt-0.5 text-[11px] text-slate-500">
            {scope.memberCount} member{scope.memberCount === 1 ? "" : "s"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge
            className={`h-auto rounded border px-2 py-0.5 text-[10px] font-medium shadow-none ${statusBadgeClass(scope.status)}`}
          >
            {scope.status}
          </Badge>
          <Icon className="h-4 w-4 shrink-0 text-slate-600" />
        </div>
      </div>
      <div className="mt-4 flex items-end gap-1.5">
        <span
          className={`text-3xl font-semibold tabular-nums ${scoreClass(scope.score)}`}
        >
          {scope.score}
        </span>
        <span className="pb-1 text-xs text-slate-600">/ 100</span>
      </div>
      <p className="mt-1 text-[11px] text-slate-500">
        Capability &amp; resilience
      </p>
      <div className="mt-4 flex flex-col gap-2.5">
        <MetricBar label="Critical skills" value={scope.skillsCoverage} />
        <MetricBar label="Experience depth" value={scope.experienceDepth} />
        <MetricBar label="SME resilience" value={scope.smeResilience} />
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-gray-800 pt-3 text-[11px]">
        <span
          className={
            scope.criticalGaps > 0
              ? "font-medium text-red-400"
              : "text-slate-500"
          }
        >
          {scope.criticalGaps} critical gap{scope.criticalGaps === 1 ? "" : "s"}
        </span>
        <span
          className={
            scope.spofCount > 0
              ? "font-medium text-amber-300"
              : "text-slate-500"
          }
        >
          {scope.spofCount} SPOF{scope.spofCount === 1 ? "" : "s"}
        </span>
        <ChevronRight className="ml-auto h-4 w-4 text-slate-600" />
      </div>
    </button>
  );
}

function SkillDrawer({
  skill,
  detail,
  onClose,
  onOpenEquipment,
}: {
  skill: MatrixSkill | null;
  detail: ScopeDetail | null;
  onClose: () => void;
  onOpenEquipment: (equipmentId: string) => void;
}): JSX.Element {
  const risks = useMemo(
    () =>
      detail?.priorityRisks.filter((row) => row.skillId === skill?.id) ?? [],
    [detail, skill?.id],
  );
  const engineers = useMemo(() => {
    if (!skill || !detail) return [];
    return detail.engineers
      .map((engineer) => ({ engineer, rating: engineer.ratings[skill.id] }))
      .filter((row) => row.rating?.rating !== null)
      .sort(
        (left, right) =>
          (right.rating?.rating ?? 0) - (left.rating?.rating ?? 0) ||
          (right.rating?.yearsExperience ?? 0) -
            (left.rating?.yearsExperience ?? 0),
      );
  }, [detail, skill]);

  return (
    <DetailDrawer open={Boolean(skill)} onClose={onClose}>
      <div className="flex items-start justify-between border-b border-gray-800 p-5">
        <div className="min-w-0 pr-3">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-semibold text-slate-50">
              {skill?.name ?? "Skill detail"}
            </h2>
            {skill?.isCritical ? (
              <Badge className="h-auto rounded border border-red-500/30 bg-red-500/10 px-2 py-0.5 text-[10px] text-red-400 shadow-none">
                Critical
              </Badge>
            ) : null}
          </div>
          <p className="mt-1 text-sm text-slate-400">{skill?.category}</p>
        </div>
        <DrawerCloseButton onClose={onClose} />
      </div>
      <div className="grid grid-cols-3 divide-x divide-gray-800 border-b border-gray-800">
        <div className="p-4">
          <p className="text-[10px] text-slate-500">Affected equipment</p>
          <p className="mt-1 text-xl font-semibold text-slate-100">
            {risks.length}
          </p>
        </div>
        <div className="p-4">
          <p className="text-[10px] text-slate-500">Assessed engineers</p>
          <p className="mt-1 text-xl font-semibold text-slate-100">
            {engineers.length}
          </p>
        </div>
        <div className="p-4">
          <p className="text-[10px] text-slate-500">Need training</p>
          <p className="mt-1 text-xl font-semibold text-orange-300">
            {engineers.filter((row) => row.rating?.trainingRequired).length}
          </p>
        </div>
      </div>
      <div className="flex flex-1 flex-col overflow-y-auto">
        <div className="border-b border-gray-800 p-5">
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            Equipment coverage
          </p>
          {risks.length === 0 ? (
            <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-4 text-sm text-emerald-300">
              No current coverage exception is recorded for this skill in the
              selected scope.
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {risks.map((risk) => (
                <button
                  key={risk.id}
                  type="button"
                  onClick={() => onOpenEquipment(risk.equipmentId)}
                  className="rounded-lg border border-gray-800 bg-[#111620] p-4 text-left transition-colors hover:border-blue-500/30 hover:bg-[#141b25]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-100">
                        {risk.equipmentName}
                      </p>
                      <p className="mt-0.5 text-[11px] text-slate-500">
                        {risk.equipmentCode} · {risk.area}
                      </p>
                    </div>
                    <Badge
                      className={`h-auto rounded border px-2 py-0.5 text-[10px] shadow-none ${riskBadgeClass(risk.criticality)}`}
                    >
                      {risk.criticality}
                    </Badge>
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2 text-[11px]">
                    <div>
                      <p className="text-slate-600">Required</p>
                      <p className="mt-0.5 font-semibold text-slate-300">
                        {risk.minimumRequired} × L{risk.requiredLevel}
                      </p>
                    </div>
                    <div>
                      <p className="text-slate-600">Qualified</p>
                      <p
                        className={`mt-0.5 font-semibold ${risk.qualifiedCount < risk.minimumRequired ? "text-red-400" : "text-emerald-400"}`}
                      >
                        {risk.qualifiedCount}
                      </p>
                    </div>
                    <div>
                      <p className="text-slate-600">Risk reduction</p>
                      <p className="mt-0.5 font-semibold text-blue-300">
                        +{risk.projectedScoreGain} pts
                      </p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="p-5">
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            Engineers in selected scope
          </p>
          <div className="flex flex-col divide-y divide-gray-800/70">
            {engineers.map(({ engineer, rating }) => (
              <div key={engineer.id} className="flex items-center gap-3 py-3">
                <div
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-sm font-semibold ${ratingClass(rating?.rating ?? null)}`}
                >
                  {rating?.rating ?? "—"}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <p className="truncate text-sm font-medium text-slate-200">
                      {engineer.name}
                    </p>
                    {engineer.criticalKnowledgeHolder ? (
                      <Shield className="h-3.5 w-3.5 text-blue-400" />
                    ) : null}
                  </div>
                  <p className="truncate text-[11px] text-slate-500">
                    {engineer.discipline}
                  </p>
                </div>
                <div className="shrink-0 text-right text-[11px]">
                  <p className="font-medium text-slate-300">
                    {rating?.yearsExperience.toFixed(1)} yrs
                  </p>
                  <p
                    className={
                      rating?.validationState === "validated"
                        ? "text-emerald-400"
                        : "text-amber-300"
                    }
                  >
                    {validationLabel(rating?.validationState ?? "missing")}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </DetailDrawer>
  );
}

export const SkillsMatrixSection = (): JSX.Element => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const returnTo = searchParams.get("returnTo") ?? "";
  const equipmentContext = searchParams.get("equipment") ?? "";
  const [data, setData] = useState<SkillsMatrixPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>(() =>
    searchParams.get("view") === "department" ? "department" : "team",
  );
  const [selectedScopeId, setSelectedScopeId] = useState(
    () => searchParams.get("scope") || "overall",
  );
  const [selectedArea, setSelectedArea] = useState(
    () => searchParams.get("area") || ALL_SITE,
  );
  const [search, setSearch] = useState(() => searchParams.get("q") || "");
  const [priorityOnly, setPriorityOnly] = useState(
    () => searchParams.get("priority") === "1",
  );
  const [selectedSkillId, setSelectedSkillId] = useState<string | null>(() =>
    searchParams.get("skill"),
  );
  const [showAllWeaknesses, setShowAllWeaknesses] = useState(false);

  const loadData = useCallback(async (force = false): Promise<void> => {
    if (force) {
      clearMaintenancePortalDataCache(SKILLS_MATRIX_FUNCTION);
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);
    try {
      const { data: payload, error: invokeError } =
        await supabase.functions.invoke(
          SKILLS_MATRIX_FUNCTION,
          SKILLS_MATRIX_OPTIONS,
        );
      if (invokeError || !payload) {
        throw invokeError ?? new Error("Skills matrix data was empty");
      }
      const resolved = normaliseSkillsMatrixPayload(
        payload as SkillsMatrixPayload,
      );
      setData(resolved);
      setSelectedScopeId((current) =>
        resolved.details[current] ? current : "overall",
      );
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Skills matrix data could not be loaded",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadData(false);
  }, [loadData]);

  useEffect(() => {
    setSearchParams(
      (current) => {
        const next = new URLSearchParams(current);
        const setOrDelete = (key: string, value: string, defaultValue = "") => {
          if (!value || value === defaultValue) next.delete(key);
          else next.set(key, value);
        };
        setOrDelete("view", viewMode, "team");
        setOrDelete("scope", selectedScopeId, "overall");
        setOrDelete("area", selectedArea, ALL_SITE);
        setOrDelete("q", search.trim());
        if (priorityOnly) next.set("priority", "1");
        else next.delete("priority");
        setOrDelete("skill", selectedSkillId ?? "");
        return next;
      },
      { replace: true },
    );
  }, [
    priorityOnly,
    search,
    selectedArea,
    selectedScopeId,
    selectedSkillId,
    setSearchParams,
    viewMode,
  ]);

  useEffect(() => {
    setShowAllWeaknesses(false);
  }, [selectedScopeId]);

  const scopes = useMemo(() => {
    if (!data) return [];
    return [
      data.overall,
      ...(viewMode === "team" ? data.teams : data.departments),
    ];
  }, [data, viewMode]);

  const buildingSkills = useMemo(
    () =>
      new Map(
        Object.entries(data?.areaSkills ?? {}).map(([area, skillIds]) => [
          area,
          new Set(skillIds),
        ]),
      ),
    [data?.areaSkills],
  );

  useEffect(() => {
    if (!scopes.some((scope) => scope.id === selectedScopeId)) {
      setSelectedScopeId("overall");
    }
  }, [scopes, selectedScopeId]);

  const selectedSummary = useMemo(
    () =>
      scopes.find((scope) => scope.id === selectedScopeId) ??
      data?.overall ??
      null,
    [data?.overall, scopes, selectedScopeId],
  );
  const selectedDetail = selectedSummary
    ? (data?.details[selectedSummary.id] ?? null)
    : null;

  const prioritySkillIds = useMemo(
    () =>
      new Set(selectedDetail?.priorityRisks.map((row) => row.skillId) ?? []),
    [selectedDetail],
  );

  const areaTabs = useMemo(() => {
    const skills = selectedDetail?.matrixSkills ?? [];
    return [
      { name: ALL_SITE, count: skills.length },
      ...Array.from(buildingSkills.entries())
        .map(([name, skillIds]) => ({
          name,
          count: skills.filter((skill) => skillIds.has(skill.id)).length,
        }))
        .sort((left, right) => left.name.localeCompare(right.name)),
    ];
  }, [buildingSkills, selectedDetail]);

  const filteredMatrixSkills = useMemo(() => {
    if (!selectedDetail) return [];
    const term = search.trim().toLowerCase();
    const areaSkillIds =
      selectedArea === ALL_SITE
        ? null
        : (buildingSkills.get(selectedArea) ?? new Set<string>());
    let skills = selectedDetail.matrixSkills.filter(
      (skill) => !areaSkillIds || areaSkillIds.has(skill.id),
    );
    if (priorityOnly) {
      skills = skills.filter((skill) => prioritySkillIds.has(skill.id));
    }
    if (term) {
      const matchingSkillIds = new Set(
        selectedDetail.matrixSkills
          .filter(
            (skill) =>
              skill.name.toLowerCase().includes(term) ||
              skill.category.toLowerCase().includes(term),
          )
          .map((skill) => skill.id),
      );
      if (matchingSkillIds.size > 0) {
        skills = skills.filter((skill) => matchingSkillIds.has(skill.id));
      }
    }
    return skills;
  }, [
    buildingSkills,
    priorityOnly,
    prioritySkillIds,
    search,
    selectedArea,
    selectedDetail,
  ]);

  const filteredEngineers = useMemo(() => {
    if (!selectedDetail) return [];
    const term = search.trim().toLowerCase();
    const skillMatchExists = selectedDetail.matrixSkills.some(
      (skill) =>
        skill.name.toLowerCase().includes(term) ||
        skill.category.toLowerCase().includes(term),
    );
    if (!term || skillMatchExists) return selectedDetail.engineers;
    return selectedDetail.engineers.filter((engineer) =>
      [
        engineer.name,
        engineer.discipline,
        engineer.departmentName ?? "",
        ...engineer.shiftNames,
      ].some((value) => value.toLowerCase().includes(term)),
    );
  }, [search, selectedDetail]);

  const selectedSkill = useMemo(
    () =>
      selectedDetail?.matrixSkills.find(
        (skill) => skill.id === selectedSkillId,
      ) ?? null,
    [selectedDetail, selectedSkillId],
  );

  const intelligence = useMemo(() => {
    if (!selectedSummary || !selectedDetail) return null;
    const risks = selectedDetail.priorityRisks;
    return {
      topRisk: risks[0] ?? null,
      priorityCount: risks.length,
      assetCount:
        new Set(risks.map((risk) => risk.equipmentId)).size ||
        selectedSummary.affectedEquipment,
      singlePointCount: risks.filter((risk) => risk.singlePoint).length,
    };
  }, [selectedDetail, selectedSummary]);

  const visiblePriorityRisks = showAllWeaknesses
    ? (selectedDetail?.priorityRisks ?? [])
    : (selectedDetail?.priorityRisks.slice(0, 3) ?? []);

  const exportSelectedScope = (): void => {
    if (!selectedSummary || !selectedDetail) return;
    const headers = [
      "Engineer",
      "Discipline",
      "Department",
      "Shift or team",
      "Average experience years",
      "Critical SME",
      ...selectedDetail.matrixSkills.map((skill) => skill.name),
    ];
    const rows = selectedDetail.engineers.map((engineer) => [
      engineer.name,
      engineer.discipline,
      engineer.departmentName ?? "",
      engineer.shiftNames.join(" / "),
      engineer.averageYearsExperience.toFixed(1),
      engineer.criticalKnowledgeHolder ? "Yes" : "No",
      ...selectedDetail.matrixSkills.map((skill) => {
        const rating = engineer.ratings[skill.id];
        return rating?.rating == null
          ? "Not assessed"
          : `${rating.rating}/5 (${rating.yearsExperience.toFixed(1)} years, ${validationLabel(rating.validationState)})`;
      }),
    ]);
    const csv = [headers, ...rows]
      .map((row) =>
        row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","),
      )
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${selectedSummary.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-skills-matrix.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const selectedTone =
    TEAM_TONES[selectedSummary?.code ?? "OVERALL"] ?? TEAM_TONES.OVERALL;
  const briefingSubject =
    selectedSummary?.name.replace(/\s+Capability$/i, "") ?? "Maintenance";

  return (
    <section className="relative flex min-w-0 w-full max-w-full flex-1 grow flex-col items-start gap-6 overflow-x-hidden px-4 pb-12 pt-0 md:gap-8 md:px-6 xl:px-8">
      <style>{`
        .skills-matrix-people-scroll {
          scrollbar-width: thin;
          scrollbar-color: rgba(96, 165, 250, 0.28) transparent;
        }
        .skills-matrix-people-scroll::-webkit-scrollbar { width: 5px; }
        .skills-matrix-people-scroll::-webkit-scrollbar-track { background: transparent; }
        .skills-matrix-people-scroll::-webkit-scrollbar-thumb {
          border-radius: 9999px;
          background: rgba(96, 165, 250, 0.22);
        }
        .skills-matrix-people-scroll:hover::-webkit-scrollbar-thumb {
          background: rgba(96, 165, 250, 0.38);
        }
      `}</style>

      <SkillDrawer
        skill={selectedSkill}
        detail={selectedDetail}
        onClose={() => setSelectedSkillId(null)}
        onOpenEquipment={(equipmentId) => {
          setSelectedSkillId(null);
          navigate(`/equipment/${encodeURIComponent(equipmentId)}/skills`);
        }}
      />

      <header className="flex w-full flex-col justify-between gap-4 py-5 lg:flex-row lg:items-center">
        <div className="flex flex-col items-start gap-1">
          <p className="text-xs font-medium text-slate-500">
            {data ? siteWideLabel(data.site.name) : "Maintenance site"}
          </p>
          <div className="flex items-center gap-2">
            <h1 className="font-text-xl-semibold text-[length:var(--text-xl-semibold-font-size)] font-[number:var(--text-xl-semibold-font-weight)] leading-[var(--text-xl-semibold-line-height)] tracking-[var(--text-xl-semibold-letter-spacing)] text-slate-50">
              Skills Matrix
            </h1>
            <ContextHelp
              content={{
                title: "Skills Matrix",
                body: "Permanent maintenance capability by shift, specialist team and department, weighted against critical equipment requirements.",
                usage:
                  "Select a card to inspect its capability briefing, people, coverage weaknesses and equipment-linked matrix.",
                aiNote:
                  "Scores combine critical-skill coverage, experience depth, SME resilience and validation health. Uncovered critical equipment prevents a green status.",
              }}
            />
          </div>
          <p className="text-sm text-slate-400">
            Critical equipment competency, experience and SME resilience
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3 self-start lg:self-auto">
          {returnTo ? (
            <button
              type="button"
              onClick={() => navigate(returnTo)}
              className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-blue-500/30 bg-blue-500/[0.06] px-3 text-xs font-semibold text-blue-300 transition-colors hover:bg-blue-500/10"
            >
              Back to equipment{equipmentContext ? " skills" : ""}{" "}
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
          ) : null}
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <Clock3 className="h-3.5 w-3.5" />
            {data
              ? freshnessLabel(data.sourceUpdatedAt)
              : loading
                ? "Loading capability data"
                : "Data unavailable"}
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={exportSelectedScope}
            disabled={!selectedDetail || loading}
            className="h-9 gap-2 border-[#ffffff20] bg-[#ffffff0d] px-3 text-xs font-semibold text-slate-200 hover:bg-[#ffffff16] hover:text-slate-50"
          >
            <Download className="h-4 w-4" /> Export selected
          </Button>
          <button
            type="button"
            onClick={() => void loadData(true)}
            disabled={loading || refreshing}
            aria-label="Refresh skills matrix"
            className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-gray-800 text-slate-400 transition-colors hover:bg-[#ffffff10] hover:text-slate-200 disabled:opacity-50"
          >
            <RefreshCw
              className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`}
            />
          </button>
        </div>
      </header>

      {error && !data ? (
        <Card className="w-full rounded-xl border border-red-500/30 bg-red-500/5 shadow-none">
          <CardContent className="flex flex-col items-start gap-3 p-6">
            <div className="flex items-center gap-2 text-red-400">
              <AlertTriangle className="h-5 w-5" />
              <h2 className="font-semibold">
                Skills capability data could not be loaded
              </h2>
            </div>
            <p className="text-sm text-slate-400">{error}</p>
            <Button
              type="button"
              onClick={() => void loadData(true)}
              className="bg-blue-600 text-white hover:bg-blue-500"
            >
              Try again
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="flex min-w-0 w-full max-w-full flex-col gap-6">
          <div className="inline-flex w-fit rounded-lg border border-gray-800 bg-[#0f1318] p-1">
            {(["team", "department"] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setViewMode(mode)}
                className={`rounded-md px-4 py-2 text-xs font-semibold transition-colors ${
                  viewMode === mode
                    ? "bg-blue-500/15 text-blue-300"
                    : "text-slate-500 hover:text-slate-300"
                }`}
              >
                {mode === "team" ? "By Team" : "By Department"}
              </button>
            ))}
          </div>

          <section className="grid w-full grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {(loading && !data ? Array.from({ length: 8 }) : scopes).map(
              (scope, index) =>
                scope ? (
                  <CapabilityCard
                    key={scope.id}
                    scope={scope}
                    selected={scope.id === selectedScopeId}
                    onSelect={() => setSelectedScopeId(scope.id)}
                  />
                ) : (
                  <div
                    key={index}
                    className="h-[286px] animate-pulse rounded-xl border border-gray-800 bg-[#141820]"
                  />
                ),
            )}
          </section>

          {selectedSummary && selectedDetail ? (
            <div className="flex min-w-0 w-full flex-col gap-6">
              <Card
                className={`w-full rounded-xl border border-t-2 border-x-gray-800 border-b-gray-800 shadow-none ${selectedTone.panel}`}
              >
                <CardContent className="p-5 lg:p-6">
                  <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0 max-w-4xl">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge
                          className={`h-auto rounded border border-current/30 bg-black/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] shadow-none ${selectedTone.text}`}
                        >
                          Capability intelligence
                        </Badge>
                        <Badge
                          className={`h-auto rounded border px-2 py-1 text-[10px] font-semibold shadow-none ${statusBadgeClass(selectedSummary.status)}`}
                        >
                          {selectedSummary.status}
                        </Badge>
                      </div>
                      <h2 className="mt-3 text-lg font-semibold text-slate-50">
                        {briefingSubject} Briefing
                      </h2>
                      <p className="mt-2 text-sm leading-6 text-slate-300">
                        {intelligence?.topRisk
                          ? `${briefingSubject} is ${selectedSummary.status.toLowerCase()} at ${selectedSummary.score}/100. ${intelligence.priorityCount} priority coverage ${intelligence.priorityCount === 1 ? "record affects" : "records affect"} ${intelligence.assetCount} ${intelligence.assetCount === 1 ? "asset" : "assets"}, including ${intelligence.singlePointCount} single-person ${intelligence.singlePointCount === 1 ? "dependency" : "dependencies"}. The highest-ranked exposure is ${intelligence.topRisk.skillName} on ${intelligence.topRisk.equipmentName}.`
                          : `${briefingSubject} has no priority coverage exception in the current site dataset. The score is calculated from current critical-skill coverage, experience depth, SME resilience and validation evidence.`}
                      </p>
                      {intelligence?.topRisk ? (
                        <p className="mt-2 text-xs leading-5 text-slate-500">
                          <span className="font-semibold text-slate-400">
                            Recorded action:
                          </span>{" "}
                          {intelligence.topRisk.recommendedAction}
                        </p>
                      ) : null}
                    </div>
                    <div className="shrink-0 text-left lg:text-right">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                        Live capability score
                      </p>
                      <div className="mt-1 flex items-end gap-1 lg:justify-end">
                        <span
                          className={`text-3xl font-semibold tabular-nums ${selectedTone.text}`}
                        >
                          {selectedSummary.score}
                        </span>
                        <span className="pb-1 text-xs text-slate-600">
                          / 100
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="mt-5 grid grid-cols-1 gap-3 border-t border-white/10 pt-4 sm:grid-cols-2 xl:grid-cols-4">
                    {[
                      {
                        label: "Highest-risk capability",
                        value:
                          intelligence?.topRisk?.skillName ??
                          "No current exception",
                      },
                      {
                        label: "Coverage status",
                        value: intelligence?.topRisk
                          ? intelligence.topRisk.qualifiedCount >=
                              intelligence.topRisk.minimumRequired &&
                            intelligence.topRisk.singlePoint
                            ? `${intelligence.topRisk.qualifiedCount}/${intelligence.topRisk.minimumRequired} · resilience risk`
                            : `${intelligence.topRisk.qualifiedCount}/${intelligence.topRisk.minimumRequired}`
                          : "Covered",
                      },
                      {
                        label: "Assets affected",
                        value: String(intelligence?.assetCount ?? 0),
                      },
                      {
                        label: "Recorded action gain",
                        value: intelligence?.topRisk
                          ? `+${intelligence.topRisk.projectedScoreGain} pts`
                          : "No action required",
                      },
                    ].map((metric) => (
                      <div
                        key={metric.label}
                        className="min-w-0 rounded-lg border border-white/10 bg-black/10 px-4 py-3"
                      >
                        <p className="text-[10px] font-medium uppercase tracking-[0.1em] text-slate-500">
                          {metric.label}
                        </p>
                        <p
                          className="mt-1 truncate text-sm font-semibold text-slate-100"
                          title={metric.value}
                        >
                          {metric.value}
                        </p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <div className="grid w-full grid-cols-1 gap-6 xl:grid-cols-[minmax(300px,0.75fr)_minmax(0,1.55fr)]">
                <Card className="min-w-0 self-start rounded-xl border border-gray-800 bg-[#141820] shadow-none">
                  <CardContent className="flex min-w-0 flex-col gap-4 p-5">
                    <div>
                      <h3 className="font-semibold text-slate-50">
                        People &amp; Experience
                      </h3>
                      <p className="mt-1 text-sm text-slate-400">
                        Permanent members of the selected scope
                      </p>
                    </div>
                    <div className="grid grid-cols-3 gap-2 border-y border-gray-800 py-3">
                      <div className="rounded-lg bg-[#10151d] px-3 py-2">
                        <p className="text-[10px] text-slate-500">
                          Avg experience
                        </p>
                        <p className="mt-1 text-sm font-semibold text-slate-200">
                          {average(
                            selectedDetail.engineers.map(
                              (engineer) => engineer.averageYearsExperience,
                            ),
                          ).toFixed(1)}{" "}
                          yrs
                        </p>
                      </div>
                      <div className="rounded-lg bg-[#10151d] px-3 py-2">
                        <p className="text-[10px] text-slate-500">
                          Critical SMEs
                        </p>
                        <p className="mt-1 text-sm font-semibold text-blue-300">
                          {
                            selectedDetail.engineers.filter(
                              (engineer) => engineer.criticalKnowledgeHolder,
                            ).length
                          }
                        </p>
                      </div>
                      <div className="rounded-lg bg-[#10151d] px-3 py-2">
                        <p className="text-[10px] text-slate-500">
                          Training needs
                        </p>
                        <p className="mt-1 text-sm font-semibold text-amber-300">
                          {selectedDetail.engineers.reduce(
                            (sum, engineer) => sum + engineer.trainingNeeds,
                            0,
                          )}
                        </p>
                      </div>
                    </div>
                    <div className="skills-matrix-people-scroll flex max-h-[560px] flex-col divide-y divide-gray-800/70 overflow-y-auto pr-1">
                      {selectedDetail.engineers.map((engineer) => {
                        const avatarUrl = engineer.avatarUrl;
                        return (
                          <button
                            key={engineer.id}
                            type="button"
                            onClick={() =>
                              navigate(
                                `/engineers?engineer=${encodeURIComponent(engineer.id)}&from=skills-matrix`,
                              )
                            }
                            className="flex w-full items-center gap-3 py-3 text-left transition-colors hover:bg-white/[0.025] focus:outline-none focus-visible:ring-1 focus-visible:ring-blue-500/50"
                          >
                            <div className="relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full border border-gray-700 bg-[#0f1318] text-sm font-semibold text-slate-300">
                              {avatarUrl ? (
                                <img
                                  src={avatarUrl}
                                  alt={`${engineer.name} profile`}
                                  loading="lazy"
                                  className="h-full w-full object-cover"
                                />
                              ) : (
                                engineerInitials(engineer.name)
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <p className="truncate text-sm font-medium text-slate-200">
                                  {engineer.name}
                                </p>
                                {engineer.criticalKnowledgeHolder ? (
                                  <Shield
                                    className="h-3.5 w-3.5 text-blue-400"
                                    aria-label="Critical knowledge holder"
                                  />
                                ) : null}
                              </div>
                              <p className="truncate text-[11px] text-slate-500">
                                {engineer.discipline}
                              </p>
                              <p className="truncate text-[10px] text-slate-600">
                                {engineer.shiftNames.join(" · ") ||
                                  engineer.departmentName ||
                                  "Specialist team"}
                              </p>
                            </div>
                            <div className="shrink-0 text-right">
                              <p className="text-xs font-semibold tabular-nums text-slate-300">
                                {engineer.averageYearsExperience.toFixed(1)} yrs
                              </p>
                              <p
                                className={
                                  engineer.trainingNeeds > 0
                                    ? "text-[10px] text-orange-300"
                                    : "text-[10px] text-slate-600"
                                }
                              >
                                {engineer.trainingNeeds} training need
                                {engineer.trainingNeeds === 1 ? "" : "s"}
                              </p>
                            </div>
                            <ChevronRight className="h-4 w-4 shrink-0 text-slate-600" />
                          </button>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>

                <Card className="min-w-0 rounded-xl border border-gray-800 bg-[#141820] shadow-none">
                  <CardContent className="flex min-w-0 flex-col gap-4 p-5">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <h3 className="font-semibold text-slate-50">
                          Priority Coverage Weaknesses
                        </h3>
                        <p className="mt-1 text-sm text-slate-400">
                          Ranked by equipment criticality, coverage deficit and
                          SME dependency
                        </p>
                      </div>
                      <Badge className="h-auto rounded border border-red-500/20 bg-red-500/10 px-2 py-1 text-[10px] text-red-400 shadow-none">
                        {intelligence?.assetCount ??
                          selectedSummary.affectedEquipment}{" "}
                        assets affected
                      </Badge>
                    </div>
                    {selectedDetail.priorityRisks.length === 0 ? (
                      <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-5">
                        <div className="flex items-center gap-2 text-emerald-300">
                          <CheckCircle2 className="h-4 w-4" />
                          <p className="text-sm font-semibold">
                            No critical coverage exception recorded
                          </p>
                        </div>
                        <p className="mt-2 text-xs text-slate-400">
                          Current minimum competency and resilience requirements
                          are covered for this scope.
                        </p>
                      </div>
                    ) : (
                      <div className="flex flex-col divide-y divide-gray-800">
                        {visiblePriorityRisks.map((risk, index) => (
                          <div
                            key={risk.id}
                            className="flex min-w-0 flex-col gap-3 py-4 first:pt-0 last:pb-0"
                          >
                            <div className="flex items-start gap-3">
                              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gray-800 text-xs font-semibold text-slate-300">
                                {index + 1}
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setSelectedSkillId(risk.skillId)
                                    }
                                    className="text-left text-sm font-semibold text-slate-100 transition-colors hover:text-blue-300"
                                  >
                                    {risk.skillName}
                                  </button>
                                  <Badge
                                    className={`h-auto rounded border px-2 py-0.5 text-[10px] shadow-none ${riskBadgeClass(risk.criticality)}`}
                                  >
                                    {risk.criticality}
                                  </Badge>
                                  {risk.singlePoint ? (
                                    <Badge className="h-auto rounded border border-amber-400/30 bg-amber-400/10 px-2 py-0.5 text-[10px] text-amber-300 shadow-none">
                                      Single point
                                    </Badge>
                                  ) : null}
                                </div>
                                <p className="mt-1 text-xs text-slate-400">
                                  {risk.equipmentName} · {risk.equipmentCode} ·{" "}
                                  {risk.area}
                                </p>
                              </div>
                              <div className="shrink-0 text-right">
                                <p className="text-xs text-slate-500">Cover</p>
                                <p
                                  className={`mt-0.5 text-sm font-semibold tabular-nums ${risk.qualifiedCount < risk.minimumRequired ? "text-red-400" : risk.singlePoint ? "text-amber-300" : "text-emerald-400"}`}
                                >
                                  {risk.qualifiedCount}/{risk.minimumRequired}
                                </p>
                              </div>
                            </div>
                            <div className="ml-10 grid grid-cols-1 gap-3 rounded-lg border border-gray-800 bg-[#10151d] p-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
                              <div>
                                <p className="text-xs leading-relaxed text-slate-300">
                                  {risk.recommendedAction}
                                </p>
                                <p className="mt-1 text-[11px] text-slate-500">
                                  {risk.qualifiedEngineers.length > 0
                                    ? `Current cover: ${risk.qualifiedEngineers.map((engineer) => engineer.engineerName).join(", ")}`
                                    : risk.nearestEngineers.length > 0
                                      ? `Nearest capability: ${risk.nearestEngineers.map((engineer) => `${engineer.engineerName} L${engineer.rating}`).join(", ")}`
                                      : "No existing capability evidence found"}
                                </p>
                              </div>
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="rounded-md bg-blue-500/10 px-2 py-1 text-[11px] font-semibold text-blue-300">
                                  +{risk.projectedScoreGain} pts
                                </span>
                                <button
                                  type="button"
                                  onClick={() =>
                                    navigate(
                                      `/engineers?skill=${encodeURIComponent(risk.skillId)}&skillName=${encodeURIComponent(risk.skillName)}&from=skills-matrix`,
                                    )
                                  }
                                  className="inline-flex items-center gap-1 rounded-md border border-gray-700 px-2 py-1 text-[11px] font-medium text-slate-300 transition-colors hover:border-blue-500/40 hover:text-blue-300"
                                >
                                  Find engineer <Users className="h-3 w-3" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    navigate(
                                      `/requirements?skill=${encodeURIComponent(risk.skillName)}&from=skills-matrix`,
                                    )
                                  }
                                  className="inline-flex items-center gap-1 rounded-md border border-gray-700 px-2 py-1 text-[11px] font-medium text-slate-300 transition-colors hover:border-blue-500/40 hover:text-blue-300"
                                >
                                  View requirement <Award className="h-3 w-3" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    navigate(
                                      `/training?skill=${encodeURIComponent(risk.skillName)}&priority=${risk.isCritical ? "Critical" : "High"}&from=skills-matrix`,
                                    )
                                  }
                                  className="inline-flex items-center gap-1 rounded-md border border-gray-700 px-2 py-1 text-[11px] font-medium text-slate-300 transition-colors hover:border-blue-500/40 hover:text-blue-300"
                                >
                                  Open training plan{" "}
                                  <Wrench className="h-3 w-3" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    navigate(
                                      `/equipment/${encodeURIComponent(risk.equipmentId)}/skills`,
                                    )
                                  }
                                  className="inline-flex items-center gap-1 rounded-md border border-gray-700 px-2 py-1 text-[11px] font-medium text-slate-300 transition-colors hover:border-blue-500/40 hover:text-blue-300"
                                >
                                  Equipment <ArrowRight className="h-3 w-3" />
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    {selectedDetail.priorityRisks.length > 3 ? (
                      <div className="flex justify-center border-t border-gray-800 pt-4">
                        <button
                          type="button"
                          onClick={() =>
                            setShowAllWeaknesses((current) => !current)
                          }
                          className="rounded-lg border border-gray-700 bg-[#111620] px-4 py-2 text-xs font-semibold text-slate-300 transition-colors hover:border-blue-500/40 hover:text-blue-300"
                        >
                          {showAllWeaknesses
                            ? "Show top 3"
                            : `View all ${selectedDetail.priorityRisks.length} weaknesses`}
                        </button>
                      </div>
                    ) : null}
                  </CardContent>
                </Card>
              </div>

              <Card className="min-w-0 w-full rounded-xl border border-gray-800 bg-[#141820] shadow-none">
                <CardContent className="flex min-w-0 flex-col gap-4 p-5">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <h3 className="font-semibold text-slate-50">
                        {selectedSummary.name} Skills &amp; Experience
                      </h3>
                      <p className="mt-1 text-sm text-slate-400">
                        Critical skills are selected from equipment
                        requirements, not popularity across the workforce
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="relative min-w-[220px] flex-1 lg:w-[260px]">
                        <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
                        <input
                          type="search"
                          value={search}
                          onChange={(event) => setSearch(event.target.value)}
                          placeholder="Search engineer or skill…"
                          className="h-9 w-full rounded-lg border border-gray-800 bg-[#0b0e14] pl-8 pr-3 text-sm text-slate-200 placeholder:text-slate-600 focus:border-blue-500/50 focus:outline-none focus:ring-1 focus:ring-blue-500/30"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => setPriorityOnly((current) => !current)}
                        aria-pressed={priorityOnly}
                        className={`h-9 rounded-lg border px-3 text-xs font-semibold transition-colors ${priorityOnly ? "border-red-500/40 bg-red-500/10 text-red-300" : "border-gray-800 text-slate-500 hover:text-slate-300"}`}
                      >
                        Priority skills only
                      </button>
                    </div>
                  </div>

                  <div className="flex min-w-0 items-center gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                    {areaTabs.map((area) => {
                      const active = area.name === selectedArea;
                      const disabled =
                        area.name !== ALL_SITE && area.count === 0;
                      return (
                        <button
                          key={area.name}
                          type="button"
                          disabled={disabled}
                          onClick={() => setSelectedArea(area.name)}
                          aria-pressed={active}
                          className={`shrink-0 rounded-lg border px-3 py-2 text-xs font-semibold transition-colors ${active ? "border-blue-500/40 bg-blue-500/10 text-blue-300" : disabled ? "cursor-not-allowed border-gray-900 text-slate-700" : "border-gray-800 text-slate-500 hover:border-gray-700 hover:text-slate-300"}`}
                        >
                          {area.name}
                          <span className="ml-1.5 text-[10px] font-medium opacity-70">
                            {area.count}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  <div className="w-full max-w-full overflow-hidden rounded-lg border border-gray-800">
                    <div className="max-h-[58vh] overflow-auto">
                      <table className="w-max min-w-full border-collapse text-sm">
                        <thead>
                          <tr className="sticky top-0 z-30 bg-[#0f1318]">
                            <th className="sticky left-0 z-40 min-w-[190px] bg-[#0f1318] px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                              Engineer
                            </th>
                            <th className="min-w-[72px] px-2 py-3 text-center text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                              Experience
                            </th>
                            <th className="min-w-[54px] px-2 py-3 text-center text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                              SME
                            </th>
                            {filteredMatrixSkills.map((skill) => (
                              <th
                                key={skill.id}
                                className="min-w-[76px] border-l border-gray-800 px-1 py-2 text-center"
                              >
                                <button
                                  type="button"
                                  onClick={() => setSelectedSkillId(skill.id)}
                                  className="mx-auto flex max-w-[76px] flex-col items-center gap-0.5 rounded px-1 py-1 text-[10px] font-medium text-slate-400 transition-colors hover:bg-[#ffffff08] hover:text-blue-300 focus:outline-none focus:ring-1 focus:ring-blue-500/50"
                                  title={skill.name}
                                >
                                  <span>{abbreviate(skill.name)}</span>
                                  <span className="text-[9px] text-slate-600">
                                    {skill.equipmentCount} assets
                                  </span>
                                </button>
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {filteredEngineers.length === 0 ? (
                            <tr>
                              <td
                                colSpan={3 + filteredMatrixSkills.length}
                                className="py-12 text-center text-sm text-slate-500"
                              >
                                No engineers match the current search.
                              </td>
                            </tr>
                          ) : (
                            filteredEngineers.map((engineer, index) => {
                              const rowBg =
                                index % 2 === 0
                                  ? "bg-[#141820]"
                                  : "bg-[#111620]";
                              return (
                                <tr
                                  key={engineer.id}
                                  className={`border-b border-gray-800/50 ${rowBg}`}
                                >
                                  <td
                                    className={`sticky left-0 z-10 min-w-[190px] px-4 py-2.5 ${rowBg}`}
                                  >
                                    <button
                                      type="button"
                                      onClick={() =>
                                        navigate(
                                          `/engineers?engineer=${encodeURIComponent(engineer.id)}&from=skills-matrix`,
                                        )
                                      }
                                      className="w-full rounded text-left transition-colors hover:text-blue-300 focus:outline-none focus-visible:ring-1 focus-visible:ring-blue-500/50"
                                    >
                                      <p className="truncate font-medium text-slate-200">
                                        {engineer.name}
                                      </p>
                                      <p className="mt-0.5 truncate text-[11px] text-slate-500">
                                        {engineer.discipline}
                                      </p>
                                    </button>
                                  </td>
                                  <td className="px-2 py-2.5 text-center text-xs font-semibold tabular-nums text-slate-300">
                                    {engineer.averageYearsExperience.toFixed(1)}
                                    y
                                  </td>
                                  <td className="px-2 py-2.5 text-center">
                                    {engineer.criticalKnowledgeHolder ? (
                                      <Shield
                                        className="mx-auto h-4 w-4 text-blue-400"
                                        aria-label="Critical knowledge holder"
                                      />
                                    ) : (
                                      <span className="text-slate-700">—</span>
                                    )}
                                  </td>
                                  {filteredMatrixSkills.map((skill) => {
                                    const rating = engineer.ratings[skill.id];
                                    const value = rating?.rating ?? null;
                                    return (
                                      <td
                                        key={skill.id}
                                        className="border-l border-gray-800/60 px-1 py-2 text-center"
                                      >
                                        <button
                                          type="button"
                                          onClick={() =>
                                            setSelectedSkillId(skill.id)
                                          }
                                          className={`relative mx-auto flex h-10 w-12 flex-col items-center justify-center rounded text-xs font-semibold tabular-nums transition-opacity hover:opacity-80 focus:outline-none focus:ring-1 focus:ring-blue-500/50 ${ratingClass(value)}`}
                                          title={`${engineer.name} · ${skill.name} · ${value ?? "Not assessed"}/5 · ${rating?.yearsExperience?.toFixed(1) ?? "0.0"} years · ${validationLabel(rating?.validationState ?? "missing")}`}
                                        >
                                          <span>{value ?? "—"}</span>
                                          {value !== null ? (
                                            <span className="text-[8px] font-medium opacity-75">
                                              {rating.yearsExperience.toFixed(
                                                1,
                                              )}
                                              y
                                            </span>
                                          ) : null}
                                          {rating?.trainingRequired ? (
                                            <span className="absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full bg-orange-400" />
                                          ) : null}
                                          {rating &&
                                          [
                                            "pending",
                                            "rejected",
                                            "expired",
                                          ].includes(rating.validationState) ? (
                                            <span className="absolute -bottom-0.5 -left-0.5 h-1.5 w-1.5 rounded-full bg-amber-300" />
                                          ) : null}
                                        </button>
                                      </td>
                                    );
                                  })}
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[11px] text-slate-500">
                    <span className="font-semibold uppercase tracking-wider text-slate-600">
                      Competency
                    </span>
                    {[5, 4, 3, 2, 1].map((rating) => (
                      <span key={rating} className="flex items-center gap-1.5">
                        <span
                          className={`inline-flex h-5 w-7 items-center justify-center rounded text-[11px] font-semibold ${ratingClass(rating)}`}
                        >
                          {rating}
                        </span>
                        {rating === 5
                          ? "Expert"
                          : rating === 4
                            ? "Competent"
                            : rating === 3
                              ? "Developing"
                              : rating === 2
                                ? "Basic"
                                : "Gap"}
                      </span>
                    ))}
                    <span className="flex items-center gap-1.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-orange-400" />{" "}
                      Training required
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-amber-300" />{" "}
                      Validation exception
                    </span>
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : null}
        </div>
      )}
    </section>
  );
};
