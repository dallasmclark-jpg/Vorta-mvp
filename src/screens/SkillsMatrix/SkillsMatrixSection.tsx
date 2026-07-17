import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ElementType,
} from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  ArrowRight,
  Award,
  CheckCircle2,
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
const SKILLS_MATRIX_OPTIONS = { body: { schemaVersion: "capability-v2" } };

type ViewMode = "team" | "department";
type ScopeStatus = "Strong" | "Moderate" | "At risk" | "Critical";

interface ScopeSummary {
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
}

interface QualifiedEngineer {
  engineerId: string;
  engineerName: string;
  rating: number;
  yearsExperience: number;
  verified: boolean;
  shiftNames: string[];
}

interface NearestEngineer {
  engineerId: string;
  engineerName: string;
  rating: number;
  yearsExperience: number;
  trainingRequired: boolean;
}

interface PriorityRisk {
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
}

interface MatrixSkill {
  id: string;
  name: string;
  category: string;
  isCritical: boolean;
  equipmentCount: number;
}

interface RatingCell {
  rating: number | null;
  yearsExperience: number;
  validationState: string;
  trainingRequired: boolean;
  practiceAuthority: string | null;
  lastUsedDate: string | null;
}

interface ScopeEngineer {
  id: string;
  name: string;
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
}

interface ScopeDetail {
  scopeId: string;
  priorityRisks: PriorityRisk[];
  matrixSkills: MatrixSkill[];
  engineers: ScopeEngineer[];
}

interface SkillsMatrixPayload {
  generatedAt: string;
  site: { id: string; name: string };
  overall: ScopeSummary;
  teams: ScopeSummary[];
  departments: ScopeSummary[];
  details: Record<string, ScopeDetail>;
}

interface SkillDrawerProps {
  skill: MatrixSkill | null;
  detail: ScopeDetail | null;
  onClose: () => void;
  onOpenEquipment: (equipmentId: string) => void;
}

const TEAM_ACCENTS: Record<string, string> = {
  OVERALL: "border-t-blue-400",
  RED: "border-t-red-500",
  GREEN: "border-t-emerald-500",
  BLUE: "border-t-blue-500",
  YELLOW: "border-t-yellow-400",
  DAYS: "border-t-slate-300",
  CALIBRATION: "border-t-amber-400",
  OT: "border-t-cyan-400",
};

const TEAM_ICONS: Record<string, ElementType> = {
  OVERALL: Layers3,
  RED: Users,
  GREEN: Users,
  BLUE: Users,
  YELLOW: Users,
  DAYS: Users,
  CALIBRATION: Gauge,
  OT: Cpu,
};

function clamp(value: number): number {
  return Math.min(100, Math.max(0, Number(value) || 0));
}

function statusBadgeClass(status: ScopeStatus): string {
  switch (status) {
    case "Strong":
      return "border-emerald-500/30 bg-emerald-500/10 text-emerald-300";
    case "Moderate":
      return "border-blue-500/30 bg-blue-500/10 text-blue-300";
    case "At risk":
      return "border-amber-400/30 bg-amber-400/10 text-amber-300";
    default:
      return "border-red-500/30 bg-red-500/10 text-red-400";
  }
}

function scoreClass(score: number): string {
  if (score >= 85) return "text-emerald-400";
  if (score >= 70) return "text-blue-400";
  if (score >= 55) return "text-amber-300";
  return "text-red-400";
}

function riskBadgeClass(level: string): string {
  switch (level.toLowerCase()) {
    case "critical":
      return "border-red-500/30 bg-red-500/10 text-red-400";
    case "high":
      return "border-orange-400/30 bg-orange-400/10 text-orange-300";
    case "medium":
      return "border-amber-400/30 bg-amber-400/10 text-amber-300";
    default:
      return "border-slate-600 bg-slate-800/60 text-slate-300";
  }
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
  switch (state) {
    case "validated":
      return "Validated";
    case "expired":
      return "Expired";
    case "pending":
      return "Pending validation";
    case "rejected":
      return "Rejected";
    case "unverified":
      return "Unverified";
    default:
      return "No evidence";
  }
}

function freshnessLabel(value: string): string {
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return "Freshness unavailable";
  const minutes = Math.max(0, Math.round((Date.now() - timestamp) / 60_000));
  if (minutes < 1) return "Updated just now";
  if (minutes < 60) return `Updated ${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  return `Updated ${hours}h ago`;
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
        <span className="font-semibold tabular-nums text-slate-300">{Math.round(width)}%</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-gray-800">
        <div className="h-full rounded-full bg-current text-blue-400" style={{ width: `${width}%` }} />
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
  const Icon = TEAM_ICONS[scope.code] ?? Users;
  const accent = TEAM_ACCENTS[scope.code] ?? "border-t-slate-500";

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={`min-w-0 rounded-xl border border-t-2 bg-[#141820] p-5 text-left shadow-none transition-all ${accent} ${
        selected
          ? "border-x-blue-500/50 border-b-blue-500/50 ring-1 ring-blue-500/20"
          : "border-x-gray-800 border-b-gray-800 hover:border-x-gray-700 hover:border-b-gray-700 hover:bg-[#171c25]"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-slate-100">{scope.name}</p>
          <p className="mt-0.5 text-[11px] text-slate-500">
            {scope.memberCount} member{scope.memberCount === 1 ? "" : "s"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge className={`h-auto rounded border px-2 py-0.5 text-[10px] font-medium shadow-none ${statusBadgeClass(scope.status)}`}>
            {scope.status}
          </Badge>
          <Icon className="h-4 w-4 shrink-0 text-slate-600" />
        </div>
      </div>

      <div className="mt-4 flex items-end gap-1.5">
        <span className={`text-3xl font-semibold tabular-nums ${scoreClass(scope.score)}`}>
          {scope.score}
        </span>
        <span className="pb-1 text-xs text-slate-600">/ 100</span>
      </div>
      <p className="mt-1 text-[11px] text-slate-500">Capability &amp; resilience</p>

      <div className="mt-4 flex flex-col gap-2.5">
        <MetricBar label="Critical skills" value={scope.skillsCoverage} />
        <MetricBar label="Experience depth" value={scope.experienceDepth} />
        <MetricBar label="SME resilience" value={scope.smeResilience} />
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-gray-800 pt-3 text-[11px]">
        <span className={scope.criticalGaps > 0 ? "font-medium text-red-400" : "text-slate-500"}>
          {scope.criticalGaps} critical gap{scope.criticalGaps === 1 ? "" : "s"}
        </span>
        <span className={scope.spofCount > 0 ? "font-medium text-amber-300" : "text-slate-500"}>
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
}: SkillDrawerProps): JSX.Element {
  const risks = useMemo(
    () => detail?.priorityRisks.filter((row) => row.skillId === skill?.id) ?? [],
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
          (right.rating?.yearsExperience ?? 0) - (left.rating?.yearsExperience ?? 0),
      );
  }, [detail, skill]);

  return (
    <DetailDrawer open={Boolean(skill)} onClose={onClose}>
      <div className="flex items-start justify-between border-b border-gray-800 p-5">
        <div className="min-w-0 pr-3">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-semibold text-slate-50">{skill?.name ?? "Skill detail"}</h2>
            {skill?.isCritical && (
              <Badge className="h-auto rounded border border-red-500/30 bg-red-500/10 px-2 py-0.5 text-[10px] text-red-400 shadow-none">
                Critical
              </Badge>
            )}
          </div>
          <p className="mt-1 text-sm text-slate-400">{skill?.category}</p>
        </div>
        <DrawerCloseButton onClose={onClose} />
      </div>

      <div className="grid grid-cols-3 divide-x divide-gray-800 border-b border-gray-800">
        <div className="p-4">
          <p className="text-[10px] text-slate-500">Affected equipment</p>
          <p className="mt-1 text-xl font-semibold text-slate-100">{risks.length}</p>
        </div>
        <div className="p-4">
          <p className="text-[10px] text-slate-500">Assessed engineers</p>
          <p className="mt-1 text-xl font-semibold text-slate-100">{engineers.length}</p>
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
              No current coverage exception is recorded for this skill in the selected scope.
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
                      <p className="truncate text-sm font-semibold text-slate-100">{risk.equipmentName}</p>
                      <p className="mt-0.5 text-[11px] text-slate-500">
                        {risk.equipmentCode} · {risk.area}
                      </p>
                    </div>
                    <Badge className={`h-auto rounded border px-2 py-0.5 text-[10px] shadow-none ${riskBadgeClass(risk.criticality)}`}>
                      {risk.criticality}
                    </Badge>
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2 text-[11px]">
                    <div>
                      <p className="text-slate-600">Required</p>
                      <p className="mt-0.5 font-semibold text-slate-300">{risk.minimumRequired} × L{risk.requiredLevel}</p>
                    </div>
                    <div>
                      <p className="text-slate-600">Qualified</p>
                      <p className={`mt-0.5 font-semibold ${risk.qualifiedCount < risk.minimumRequired ? "text-red-400" : "text-emerald-400"}`}>
                        {risk.qualifiedCount}
                      </p>
                    </div>
                    <div>
                      <p className="text-slate-600">Risk reduction</p>
                      <p className="mt-0.5 font-semibold text-blue-300">+{risk.projectedScoreGain} pts</p>
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
                <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-sm font-semibold ${ratingClass(rating?.rating ?? null)}`}>
                  {rating?.rating ?? "—"}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <p className="truncate text-sm font-medium text-slate-200">{engineer.name}</p>
                    {engineer.criticalKnowledgeHolder && <Shield className="h-3.5 w-3.5 text-blue-400" />}
                  </div>
                  <p className="truncate text-[11px] text-slate-500">{engineer.discipline}</p>
                </div>
                <div className="shrink-0 text-right text-[11px]">
                  <p className="font-medium text-slate-300">{rating?.yearsExperience.toFixed(1)} yrs</p>
                  <p className={rating?.validationState === "validated" ? "text-emerald-400" : "text-amber-300"}>
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
  const detailRef = useRef<HTMLDivElement>(null);
  const [data, setData] = useState<SkillsMatrixPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("team");
  const [selectedScopeId, setSelectedScopeId] = useState("overall");
  const [search, setSearch] = useState("");
  const [priorityOnly, setPriorityOnly] = useState(false);
  const [selectedSkillId, setSelectedSkillId] = useState<string | null>(null);

  const loadData = useCallback(async (force = false): Promise<void> => {
    if (force) {
      clearMaintenancePortalDataCache(SKILLS_MATRIX_FUNCTION);
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      const { data: payload, error: invokeError } = await supabase.functions.invoke(
        SKILLS_MATRIX_FUNCTION,
        SKILLS_MATRIX_OPTIONS,
      );
      if (invokeError || !payload) {
        throw invokeError ?? new Error("Skills matrix data was empty");
      }
      setData(payload as SkillsMatrixPayload);
      setSelectedScopeId((current) =>
        (payload as SkillsMatrixPayload).details[current] ? current : "overall",
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
    setSearch("");
    setPriorityOnly(false);
    setSelectedSkillId(null);
  }, [selectedScopeId]);

  const scopes = useMemo(() => {
    if (!data) return [];
    return [
      data.overall,
      ...(viewMode === "team" ? data.teams : data.departments),
    ];
  }, [data, viewMode]);

  useEffect(() => {
    if (!scopes.some((scope) => scope.id === selectedScopeId)) {
      setSelectedScopeId("overall");
    }
  }, [scopes, selectedScopeId]);

  const selectedSummary = useMemo(
    () => scopes.find((scope) => scope.id === selectedScopeId) ?? data?.overall ?? null,
    [data?.overall, scopes, selectedScopeId],
  );
  const selectedDetail = selectedSummary ? data?.details[selectedSummary.id] ?? null : null;

  const prioritySkillIds = useMemo(
    () => new Set(selectedDetail?.priorityRisks.map((row) => row.skillId) ?? []),
    [selectedDetail],
  );

  const filteredMatrixSkills = useMemo(() => {
    if (!selectedDetail) return [];
    const term = search.trim().toLowerCase();
    const skillMatches = selectedDetail.matrixSkills.filter((skill) =>
      skill.name.toLowerCase().includes(term) || skill.category.toLowerCase().includes(term),
    );
    let skills = priorityOnly
      ? selectedDetail.matrixSkills.filter((skill) => prioritySkillIds.has(skill.id))
      : selectedDetail.matrixSkills;
    if (term && skillMatches.length > 0) {
      skills = skills.filter((skill) => skillMatches.some((match) => match.id === skill.id));
    }
    return skills;
  }, [priorityOnly, prioritySkillIds, search, selectedDetail]);

  const filteredEngineers = useMemo(() => {
    if (!selectedDetail) return [];
    const term = search.trim().toLowerCase();
    const skillMatchExists = selectedDetail.matrixSkills.some(
      (skill) => skill.name.toLowerCase().includes(term) || skill.category.toLowerCase().includes(term),
    );
    if (!term || skillMatchExists) return selectedDetail.engineers;
    return selectedDetail.engineers.filter((engineer) =>
      [engineer.name, engineer.discipline, engineer.departmentName ?? "", ...engineer.shiftNames]
        .some((value) => value.toLowerCase().includes(term)),
    );
  }, [search, selectedDetail]);

  const selectedSkill = useMemo(
    () => selectedDetail?.matrixSkills.find((skill) => skill.id === selectedSkillId) ?? null,
    [selectedDetail, selectedSkillId],
  );

  const handleScopeSelect = (scopeId: string): void => {
    setSelectedScopeId(scopeId);
    window.requestAnimationFrame(() => {
      detailRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

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
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${selectedSummary.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-skills-matrix.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <section className="relative flex min-w-0 w-full max-w-full flex-1 grow flex-col items-start gap-6 overflow-x-hidden px-4 pb-12 pt-0 md:gap-8 md:px-6 xl:px-8">
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
          <p className="text-xs font-medium text-slate-500">{data?.site.name ?? "Maintenance site"}</p>
          <div className="flex items-center gap-2">
            <h1 className="font-text-xl-semibold text-[length:var(--text-xl-semibold-font-size)] font-[number:var(--text-xl-semibold-font-weight)] leading-[var(--text-xl-semibold-line-height)] tracking-[var(--text-xl-semibold-letter-spacing)] text-slate-50">
              Skills Matrix
            </h1>
            <ContextHelp
              content={{
                title: "Skills Matrix",
                body: "Permanent maintenance capability by shift, specialist team and department, weighted against critical equipment requirements.",
                usage: "Select a card to inspect the team, its priority weaknesses and the supporting engineer matrix.",
                aiNote: "Scores combine critical-skill coverage, experience depth, SME resilience and validation health. Uncovered critical equipment prevents a green status.",
              }}
            />
          </div>
          <p className="text-sm text-slate-400">Critical equipment competency, experience and SME resilience</p>
        </div>

        <div className="flex flex-wrap items-center gap-3 self-start lg:self-auto">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <Clock3 className="h-3.5 w-3.5" />
            {data ? freshnessLabel(data.generatedAt) : loading ? "Loading capability data" : "Data unavailable"}
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
            <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
          </button>
        </div>
      </header>

      {error && !data ? (
        <Card className="w-full rounded-xl border border-red-500/30 bg-red-500/5 shadow-none">
          <CardContent className="flex flex-col items-start gap-3 p-6">
            <div className="flex items-center gap-2 text-red-400">
              <AlertTriangle className="h-5 w-5" />
              <h2 className="font-semibold">Skills capability data could not be loaded</h2>
            </div>
            <p className="text-sm text-slate-400">{error}</p>
            <Button type="button" onClick={() => void loadData(true)} className="bg-blue-600 text-white hover:bg-blue-500">
              Try again
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="flex min-w-0 w-full max-w-full flex-col gap-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
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
            <p className="text-xs text-slate-500">
              {viewMode === "team"
                ? "Shift teams plus Calibration and Operational Technology"
                : "Permanent capability grouped by organisational department"}
            </p>
          </div>

          <section className="grid w-full grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {(loading && !data ? Array.from({ length: 8 }) : scopes).map((scope, index) =>
              scope ? (
                <CapabilityCard
                  key={scope.id}
                  scope={scope}
                  selected={scope.id === selectedScopeId}
                  onSelect={() => handleScopeSelect(scope.id)}
                />
              ) : (
                <div key={index} className="h-[286px] animate-pulse rounded-xl border border-gray-800 bg-[#141820]" />
              ),
            )}
          </section>

          {selectedSummary && selectedDetail && (
            <div ref={detailRef} className="scroll-mt-4 flex min-w-0 w-full flex-col gap-6">
              <Card className="w-full rounded-xl border border-gray-800 bg-[#141820] shadow-none">
                <CardContent className="p-0">
                  <div className="flex flex-col gap-4 border-b border-gray-800 p-5 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-lg font-semibold text-slate-50">{selectedSummary.name}</h2>
                        <Badge className={`h-auto rounded border px-2 py-0.5 text-[10px] font-medium shadow-none ${statusBadgeClass(selectedSummary.status)}`}>
                          {selectedSummary.status}
                        </Badge>
                      </div>
                      <p className="mt-1 text-sm text-slate-400">
                        Permanent capability against critical equipment requirements
                      </p>
                    </div>
                    <div className="flex items-end gap-2">
                      <span className={`text-3xl font-semibold tabular-nums ${scoreClass(selectedSummary.score)}`}>
                        {selectedSummary.score}
                      </span>
                      <span className="pb-1 text-xs text-slate-600">/ 100 overall</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 divide-x divide-y divide-gray-800 md:grid-cols-4 md:divide-y-0">
                    {[
                      { label: "Critical skills", value: `${selectedSummary.skillsCoverage}%`, icon: Wrench, className: "text-blue-300" },
                      { label: "Experience depth", value: `${selectedSummary.experienceDepth}%`, icon: Award, className: "text-slate-100" },
                      { label: "SME resilience", value: `${selectedSummary.smeResilience}%`, icon: Shield, className: selectedSummary.smeResilience < 70 ? "text-amber-300" : "text-emerald-300" },
                      { label: "Validation health", value: `${selectedSummary.validationHealth}%`, icon: CheckCircle2, className: selectedSummary.validationHealth < 70 ? "text-amber-300" : "text-emerald-300" },
                    ].map(({ label, value, icon: Icon, className }) => (
                      <div key={label} className="flex items-center gap-3 p-4">
                        <Icon className="h-4 w-4 shrink-0 text-slate-600" />
                        <div>
                          <p className="text-[10px] text-slate-500">{label}</p>
                          <p className={`mt-0.5 text-lg font-semibold tabular-nums ${className}`}>{value}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <div className="grid w-full grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.55fr)_minmax(300px,0.75fr)]">
                <Card className="min-w-0 rounded-xl border border-gray-800 bg-[#141820] shadow-none">
                  <CardContent className="flex min-w-0 flex-col gap-4 p-5">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <h3 className="font-semibold text-slate-50">Priority Coverage Weaknesses</h3>
                        <p className="mt-1 text-sm text-slate-400">Ranked by equipment criticality, coverage deficit and SME dependency</p>
                      </div>
                      <Badge className="h-auto rounded border border-red-500/20 bg-red-500/10 px-2 py-1 text-[10px] text-red-400 shadow-none">
                        {selectedSummary.affectedEquipment} assets affected
                      </Badge>
                    </div>

                    {selectedDetail.priorityRisks.length === 0 ? (
                      <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-5">
                        <div className="flex items-center gap-2 text-emerald-300">
                          <CheckCircle2 className="h-4 w-4" />
                          <p className="text-sm font-semibold">No critical coverage exception recorded</p>
                        </div>
                        <p className="mt-2 text-xs text-slate-400">Current minimum competency and resilience requirements are covered for this scope.</p>
                      </div>
                    ) : (
                      <div className="flex flex-col divide-y divide-gray-800">
                        {selectedDetail.priorityRisks.slice(0, 6).map((risk, index) => (
                          <div key={risk.id} className="flex min-w-0 flex-col gap-3 py-4 first:pt-0 last:pb-0">
                            <div className="flex items-start gap-3">
                              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gray-800 text-xs font-semibold text-slate-300">
                                {index + 1}
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() => setSelectedSkillId(risk.skillId)}
                                    className="text-left text-sm font-semibold text-slate-100 transition-colors hover:text-blue-300"
                                  >
                                    {risk.skillName}
                                  </button>
                                  <Badge className={`h-auto rounded border px-2 py-0.5 text-[10px] shadow-none ${riskBadgeClass(risk.criticality)}`}>
                                    {risk.criticality}
                                  </Badge>
                                  {risk.singlePoint && (
                                    <Badge className="h-auto rounded border border-amber-400/30 bg-amber-400/10 px-2 py-0.5 text-[10px] text-amber-300 shadow-none">
                                      Single point
                                    </Badge>
                                  )}
                                </div>
                                <p className="mt-1 text-xs text-slate-400">
                                  {risk.equipmentName} · {risk.equipmentCode} · {risk.area}
                                </p>
                              </div>
                              <div className="shrink-0 text-right">
                                <p className="text-xs text-slate-500">Cover</p>
                                <p className={`mt-0.5 text-sm font-semibold tabular-nums ${risk.qualifiedCount < risk.minimumRequired ? "text-red-400" : "text-emerald-400"}`}>
                                  {risk.qualifiedCount}/{risk.minimumRequired}
                                </p>
                              </div>
                            </div>

                            <div className="ml-10 grid grid-cols-1 gap-3 rounded-lg border border-gray-800 bg-[#10151d] p-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
                              <div>
                                <p className="text-xs leading-relaxed text-slate-300">{risk.recommendedAction}</p>
                                <p className="mt-1 text-[11px] text-slate-500">
                                  {risk.qualifiedEngineers.length > 0
                                    ? `Current cover: ${risk.qualifiedEngineers.map((engineer) => engineer.engineerName).join(", ")}`
                                    : risk.nearestEngineers.length > 0
                                      ? `Nearest capability: ${risk.nearestEngineers.map((engineer) => `${engineer.engineerName} L${engineer.rating}`).join(", ")}`
                                      : "No existing capability evidence found"}
                                </p>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="rounded-md bg-blue-500/10 px-2 py-1 text-[11px] font-semibold text-blue-300">
                                  +{risk.projectedScoreGain} pts
                                </span>
                                <button
                                  type="button"
                                  onClick={() => navigate(`/equipment/${encodeURIComponent(risk.equipmentId)}/skills`)}
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
                  </CardContent>
                </Card>

                <Card className="min-w-0 rounded-xl border border-gray-800 bg-[#141820] shadow-none">
                  <CardContent className="flex min-w-0 flex-col gap-4 p-5">
                    <div>
                      <h3 className="font-semibold text-slate-50">People &amp; Experience</h3>
                      <p className="mt-1 text-sm text-slate-400">Permanent members of the selected scope</p>
                    </div>
                    <div className="flex max-h-[520px] flex-col divide-y divide-gray-800/70 overflow-y-auto pr-1">
                      {selectedDetail.engineers.map((engineer) => (
                        <div key={engineer.id} className="flex items-center gap-3 py-3">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#0f1318] text-sm font-semibold text-slate-300">
                            {engineer.name.split(" ").map((part) => part[0]).slice(0, 2).join("")}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <p className="truncate text-sm font-medium text-slate-200">{engineer.name}</p>
                              {engineer.criticalKnowledgeHolder && (
                                <Shield className="h-3.5 w-3.5 text-blue-400" aria-label="Critical knowledge holder" />
                              )}
                            </div>
                            <p className="truncate text-[11px] text-slate-500">{engineer.discipline}</p>
                            <p className="truncate text-[10px] text-slate-600">
                              {engineer.shiftNames.join(" · ") || engineer.departmentName || "Specialist team"}
                            </p>
                          </div>
                          <div className="shrink-0 text-right">
                            <p className="text-xs font-semibold tabular-nums text-slate-300">{engineer.averageYearsExperience.toFixed(1)} yrs</p>
                            <p className={engineer.trainingNeeds > 0 ? "text-[10px] text-orange-300" : "text-[10px] text-slate-600"}>
                              {engineer.trainingNeeds} training need{engineer.trainingNeeds === 1 ? "" : "s"}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Card className="min-w-0 w-full rounded-xl border border-gray-800 bg-[#141820] shadow-none">
                <CardContent className="flex min-w-0 flex-col gap-4 p-5">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <h3 className="font-semibold text-slate-50">{selectedSummary.name} Skills &amp; Experience</h3>
                      <p className="mt-1 text-sm text-slate-400">
                        Critical skills are selected from equipment requirements, not popularity across the workforce
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
                        className={`h-9 rounded-lg border px-3 text-xs font-semibold transition-colors ${
                          priorityOnly
                            ? "border-red-500/40 bg-red-500/10 text-red-300"
                            : "border-gray-800 text-slate-500 hover:text-slate-300"
                        }`}
                      >
                        Priority skills only
                      </button>
                    </div>
                  </div>

                  <div className="w-full max-w-full overflow-hidden rounded-lg border border-gray-800">
                    <div className="max-h-[58vh] overflow-auto">
                      <table className="w-max min-w-full border-collapse text-sm">
                        <thead>
                          <tr className="sticky top-0 z-30 bg-[#0f1318]">
                            <th className="sticky left-0 z-40 min-w-[190px] bg-[#0f1318] px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                              Engineer
                            </th>
                            <th className="min-w-[72px] px-2 py-3 text-center text-[10px] font-semibold uppercase tracking-wider text-slate-500">Experience</th>
                            <th className="min-w-[54px] px-2 py-3 text-center text-[10px] font-semibold uppercase tracking-wider text-slate-500">SME</th>
                            {filteredMatrixSkills.map((skill) => (
                              <th key={skill.id} className="min-w-[76px] border-l border-gray-800 px-1 py-2 text-center">
                                <button
                                  type="button"
                                  onClick={() => setSelectedSkillId(skill.id)}
                                  className="mx-auto flex max-w-[76px] flex-col items-center gap-0.5 rounded px-1 py-1 text-[10px] font-medium text-slate-400 transition-colors hover:bg-[#ffffff08] hover:text-blue-300 focus:outline-none focus:ring-1 focus:ring-blue-500/50"
                                  title={skill.name}
                                >
                                  <span>{abbreviate(skill.name)}</span>
                                  <span className="text-[9px] text-slate-600">{skill.equipmentCount} assets</span>
                                </button>
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {filteredEngineers.length === 0 ? (
                            <tr>
                              <td colSpan={3 + filteredMatrixSkills.length} className="py-12 text-center text-sm text-slate-500">
                                No engineers match the current search.
                              </td>
                            </tr>
                          ) : (
                            filteredEngineers.map((engineer, index) => {
                              const rowBg = index % 2 === 0 ? "bg-[#141820]" : "bg-[#111620]";
                              return (
                                <tr key={engineer.id} className={`border-b border-gray-800/50 ${rowBg}`}>
                                  <td className={`sticky left-0 z-10 min-w-[190px] px-4 py-2.5 ${rowBg}`}>
                                    <div className="flex items-center gap-2">
                                      <div className="min-w-0">
                                        <p className="truncate font-medium text-slate-200">{engineer.name}</p>
                                        <p className="mt-0.5 truncate text-[11px] text-slate-500">{engineer.discipline}</p>
                                      </div>
                                    </div>
                                  </td>
                                  <td className="px-2 py-2.5 text-center text-xs font-semibold tabular-nums text-slate-300">
                                    {engineer.averageYearsExperience.toFixed(1)}y
                                  </td>
                                  <td className="px-2 py-2.5 text-center">
                                    {engineer.criticalKnowledgeHolder ? (
                                      <Shield className="mx-auto h-4 w-4 text-blue-400" aria-label="Critical knowledge holder" />
                                    ) : (
                                      <span className="text-slate-700">—</span>
                                    )}
                                  </td>
                                  {filteredMatrixSkills.map((skill) => {
                                    const rating = engineer.ratings[skill.id];
                                    const value = rating?.rating ?? null;
                                    return (
                                      <td key={skill.id} className="border-l border-gray-800/60 px-1 py-2 text-center">
                                        <button
                                          type="button"
                                          onClick={() => setSelectedSkillId(skill.id)}
                                          className={`relative mx-auto flex h-10 w-12 flex-col items-center justify-center rounded text-xs font-semibold tabular-nums transition-opacity hover:opacity-80 focus:outline-none focus:ring-1 focus:ring-blue-500/50 ${ratingClass(value)}`}
                                          title={`${engineer.name} · ${skill.name} · ${value ?? "Not assessed"}/5 · ${rating?.yearsExperience?.toFixed(1) ?? "0.0"} years · ${validationLabel(rating?.validationState ?? "missing")}`}
                                        >
                                          <span>{value ?? "—"}</span>
                                          {value !== null && (
                                            <span className="text-[8px] font-medium opacity-75">{rating.yearsExperience.toFixed(1)}y</span>
                                          )}
                                          {rating?.trainingRequired && (
                                            <span className="absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full bg-orange-400" />
                                          )}
                                          {rating && rating.validationState !== "validated" && (
                                            <span className="absolute -bottom-0.5 -left-0.5 h-1.5 w-1.5 rounded-full bg-amber-300" />
                                          )}
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
                    <span className="font-semibold uppercase tracking-wider text-slate-600">Competency</span>
                    {[5, 4, 3, 2, 1].map((rating) => (
                      <span key={rating} className="flex items-center gap-1.5">
                        <span className={`inline-flex h-5 w-7 items-center justify-center rounded text-[11px] font-semibold ${ratingClass(rating)}`}>{rating}</span>
                        {rating === 5 ? "Expert" : rating === 4 ? "Competent" : rating === 3 ? "Developing" : rating === 2 ? "Basic" : "Gap"}
                      </span>
                    ))}
                    <span className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-orange-400" /> Training required</span>
                    <span className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-amber-300" /> Validation evidence required</span>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      )}
    </section>
  );
};
