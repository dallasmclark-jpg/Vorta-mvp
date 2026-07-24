import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  ArrowLeft,
  Boxes,
  CheckCircle2,
  ChevronRight,
  Clock3,
  RefreshCw,
  Search,
  Shield,
  Sparkles,
  UserRound,
  Users,
  Wrench,
} from "lucide-react";
import { DetailDrawer, DrawerCloseButton } from "../../components/DetailDrawer";
import type { VortaDataMode } from "../../lib/dataTrust";
import {
  clearMaintenancePortalDataCache,
  supabase,
} from "../../lib/supabaseClient";
import { validateSkillsMatrixPayload } from "../../lib/runtimeContracts";

const SKILLS_MATRIX_FUNCTION = "skills-matrix-data";
const SKILLS_MATRIX_OPTIONS = { body: { schemaVersion: "capability-v3" } };

type MobileView = "priorities" | "people" | "assets";
type ScopeStatus = "Strong" | "Moderate" | "At risk" | "Critical";

type ScopeSummary = {
  id: string;
  code: string;
  name: string;
  memberCount: number;
  score: number;
  status: ScopeStatus;
  criticalGaps: number;
  spofCount: number;
  trainingNeeds: number;
  affectedEquipment: number;
  coreCapabilityScore?: number;
  assetCompetenceScore?: number;
  proposedSkillsReadinessScore?: number;
};

type RatingCell = {
  rating: number | null;
  yearsExperience: number;
  validationState: string;
  trainingRequired: boolean;
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
  trainingNeeds: number;
  criticalSkillCount: number;
  ratings: Record<string, RatingCell>;
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
  gap: number;
  singlePoint: boolean;
  criticality: string;
  recommendedAction: string;
  projectedScoreGain: number;
  riskRank: number;
};

type CoreEngineer = {
  engineerId: string;
  engineerName: string;
  score: number;
  assessedSkillCount: number;
};

type AssetEngineer = {
  engineerId: string;
  engineerName: string;
  discipline: string;
  assetCompetenceScore: number;
  status: ScopeStatus;
  requirementFitScore: number;
  explicitCapabilityLevel: number;
  pmExperienceScore: number;
  pmTaskCount: number;
  pmTasksWithEvidence: number;
  confirmedPmCount: number;
  lastPmCompletedAt: string | null;
  recencyStatus: string;
};

type AssetCompetence = {
  equipmentId: string;
  equipmentCode: string;
  equipmentName: string;
  area: string;
  line: string | null;
  criticality: string;
  status: ScopeStatus;
  assetCompetenceScore: number;
  minimumQualified: number;
  requiredSkillCount: number;
  pmTaskCount: number;
  calibrationTaskCount: number;
  pmEvidenceCoverage: number;
  engineers: AssetEngineer[];
};

type CapabilityPreview = {
  modelStatus: "preview";
  coreCapability: {
    score: number;
    engineersAssessed: number;
    engineers: CoreEngineer[];
  };
  assetCompetence: {
    score: number;
    pmExperienceCoverage: number;
    pmEvidenceCount: number;
    assets: AssetCompetence[];
  };
};

type ScopeDetail = {
  scopeId: string;
  priorityRisks: PriorityRisk[];
  engineers: ScopeEngineer[];
  capabilityPreview?: CapabilityPreview;
};

type SkillsPayload = {
  sourceUpdatedAt: string;
  site: { id: string; name: string };
  overall: ScopeSummary;
  teams: ScopeSummary[];
  departments: ScopeSummary[];
  details: Record<string, ScopeDetail>;
};

type PersonEvidence = {
  engineer: ScopeEngineer;
  currentScore: number;
  coreScore: number | null;
  assetScore: number | null;
  assets: Array<{
    equipmentId: string;
    equipmentCode: string;
    equipmentName: string;
    score: number;
    pmExperience: number;
  }>;
};

function parsePayload(value: unknown): SkillsPayload {
  return validateSkillsMatrixPayload(value) as unknown as SkillsPayload;
}

function clamp(value: number): number {
  return Math.min(100, Math.max(0, Number(value) || 0));
}

function average(values: number[]): number {
  return values.length === 0
    ? 0
    : values.reduce((sum, value) => sum + value, 0) / values.length;
}

function scoreClass(score: number): string {
  if (score >= 85) return "text-emerald-300";
  if (score >= 70) return "text-blue-300";
  if (score >= 55) return "text-amber-300";
  return "text-red-300";
}

function statusClass(status: ScopeStatus | string): string {
  const value = status.toLowerCase();
  if (value === "strong") return "border-emerald-500/25 bg-emerald-500/10 text-emerald-300";
  if (value === "moderate") return "border-blue-500/25 bg-blue-500/10 text-blue-300";
  if (value.includes("risk")) return "border-amber-400/30 bg-amber-400/10 text-amber-300";
  return "border-red-500/30 bg-red-500/10 text-red-300";
}

function riskClass(value: string): string {
  const level = value.toLowerCase();
  if (level === "critical") return "border-red-500/30 bg-red-500/10 text-red-300";
  if (level === "high") return "border-orange-500/30 bg-orange-500/10 text-orange-300";
  if (level === "medium") return "border-amber-400/30 bg-amber-400/10 text-amber-300";
  return "border-slate-600 bg-slate-800/70 text-slate-300";
}

function initials(name: string): string {
  return name
    .split(" ")
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function formatStatus(value: string): string {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatDate(value: string | null): string {
  if (!value) return "No linked PM";
  const parsed = new Date(value.includes("T") ? value : `${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(parsed);
}

function freshness(value: string): string {
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return "Freshness unavailable";
  const minutes = Math.max(0, Math.round((Date.now() - timestamp) / 60_000));
  if (minutes < 1) return "Updated just now";
  if (minutes < 60) return `Updated ${minutes}m ago`;
  return `Updated ${Math.round(minutes / 60)}h ago`;
}

function Metric({
  label,
  value,
  detail,
  tone = "text-slate-50",
}: {
  label: string;
  value: string;
  detail: string;
  tone?: string;
}): JSX.Element {
  return (
    <div className="rounded-xl border border-gray-800 bg-[#141820] p-3">
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">{label}</p>
      <p className={`mt-2 text-2xl font-semibold tabular-nums ${tone}`}>{value}</p>
      <p className="mt-1 text-xs text-slate-500">{detail}</p>
    </div>
  );
}

function currentEngineerScore(engineer: ScopeEngineer): number {
  const ratings = Object.values(engineer.ratings)
    .map((rating) => rating.rating)
    .filter((rating): rating is number => rating !== null);
  return Math.round(average(ratings.map((rating) => clamp((rating / 5) * 100))));
}

export function MobileSkillsMatrix({ dataMode }: { dataMode: VortaDataMode }): JSX.Element {
  const navigate = useNavigate();
  const [payload, setPayload] = useState<SkillsPayload | null>(null);
  const [selectedScopeId, setSelectedScopeId] = useState("overall");
  const [view, setView] = useState<MobileView>("priorities");
  const [search, setSearch] = useState("");
  const [selectedPerson, setSelectedPerson] = useState<PersonEvidence | null>(null);
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (force = false): Promise<void> => {
    if (force) {
      clearMaintenancePortalDataCache(SKILLS_MATRIX_FUNCTION);
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      const { data, error: invokeError } = await supabase.functions.invoke(
        SKILLS_MATRIX_FUNCTION,
        SKILLS_MATRIX_OPTIONS,
      );
      if (invokeError || !data) {
        throw invokeError ?? new Error("Skills Matrix evidence was empty.");
      }
      const resolved = parsePayload(data);
      setPayload(resolved);
      setSelectedScopeId((current) => resolved.details[current] ? current : resolved.overall.id);
    } catch (loadError) {
      setPayload(null);
      setError(loadError instanceof Error ? loadError.message : "Skills Matrix evidence could not be loaded.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load(false);
  }, [load]);

  const scopes = useMemo(
    () => (payload ? [payload.overall, ...payload.teams, ...payload.departments] : []),
    [payload],
  );
  const selectedSummary = useMemo(
    () => scopes.find((scope) => scope.id === selectedScopeId) ?? payload?.overall ?? null,
    [payload?.overall, scopes, selectedScopeId],
  );
  const selectedDetail = selectedSummary ? payload?.details[selectedSummary.id] ?? null : null;
  const preview = selectedDetail?.capabilityPreview?.modelStatus === "preview"
    ? selectedDetail.capabilityPreview
    : null;

  const personEvidence = useMemo<PersonEvidence[]>(() => {
    if (!selectedDetail) return [];
    const coreByEngineer = new Map(
      (preview?.coreCapability.engineers ?? []).map((engineer) => [engineer.engineerId, engineer]),
    );
    const assetsByEngineer = new Map<string, PersonEvidence["assets"]>();
    for (const asset of preview?.assetCompetence.assets ?? []) {
      for (const engineer of asset.engineers) {
        const rows = assetsByEngineer.get(engineer.engineerId) ?? [];
        rows.push({
          equipmentId: asset.equipmentId,
          equipmentCode: asset.equipmentCode,
          equipmentName: asset.equipmentName,
          score: engineer.assetCompetenceScore,
          pmExperience: engineer.pmExperienceScore,
        });
        assetsByEngineer.set(engineer.engineerId, rows);
      }
    }

    return selectedDetail.engineers
      .map((engineer) => {
        const assetRows = assetsByEngineer.get(engineer.id) ?? [];
        return {
          engineer,
          currentScore: currentEngineerScore(engineer),
          coreScore: coreByEngineer.get(engineer.id)?.score ?? null,
          assetScore: assetRows.length > 0 ? Math.round(average(assetRows.map((row) => row.score))) : null,
          assets: [...assetRows].sort((left, right) => right.score - left.score),
        };
      })
      .sort(
        (left, right) =>
          right.engineer.trainingNeeds - left.engineer.trainingNeeds ||
          right.engineer.criticalSkillCount - left.engineer.criticalSkillCount ||
          right.currentScore - left.currentScore,
      );
  }, [preview, selectedDetail]);

  const filteredPeople = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return personEvidence;
    return personEvidence.filter(({ engineer }) =>
      [engineer.name, engineer.discipline, engineer.departmentName ?? "", ...engineer.shiftNames]
        .some((value) => value.toLowerCase().includes(term)),
    );
  }, [personEvidence, search]);

  const assets = useMemo(() => {
    const rows = preview?.assetCompetence.assets ?? [];
    const term = search.trim().toLowerCase();
    const filtered = term
      ? rows.filter((asset) =>
          [asset.equipmentName, asset.equipmentCode, asset.area, asset.line ?? ""]
            .some((value) => value.toLowerCase().includes(term)),
        )
      : rows;
    return [...filtered].sort(
      (left, right) => left.assetCompetenceScore - right.assetCompetenceScore,
    );
  }, [preview?.assetCompetence.assets, search]);

  const selectedAsset = useMemo(
    () => assets.find((asset) => asset.equipmentId === selectedAssetId) ?? null,
    [assets, selectedAssetId],
  );

  const priorities = useMemo(
    () => [...(selectedDetail?.priorityRisks ?? [])].sort((left, right) => left.riskRank - right.riskRank),
    [selectedDetail?.priorityRisks],
  );
  const topRisk = priorities[0] ?? null;

  const changeScope = (scopeId: string): void => {
    setSelectedScopeId(scopeId);
    setSelectedAssetId(null);
    setSelectedPerson(null);
    setSearch("");
  };

  return (
    <section
      className="flex w-full flex-col gap-4 overflow-x-hidden px-3 pb-28 pt-4"
      data-vorta-mobile-skills-matrix="true"
    >
      <DetailDrawer open={Boolean(selectedPerson)} onClose={() => setSelectedPerson(null)}>
        <div className="flex items-start justify-between border-b border-gray-800 p-5">
          <div className="min-w-0 pr-3">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-blue-300">Engineer capability</p>
            <h2 className="mt-2 text-lg font-semibold text-slate-50">{selectedPerson?.engineer.name ?? "Engineer"}</h2>
            <p className="mt-1 text-sm text-slate-400">{selectedPerson?.engineer.discipline ?? "Discipline not recorded"}</p>
          </div>
          <DrawerCloseButton onClose={() => setSelectedPerson(null)} />
        </div>
        <div className="grid grid-cols-3 divide-x divide-gray-800 border-b border-gray-800">
          <div className="p-4">
            <p className="text-[10px] text-slate-500">Current</p>
            <p className={`mt-1 text-xl font-semibold ${scoreClass(selectedPerson?.currentScore ?? 0)}`}>{selectedPerson?.currentScore ?? 0}%</p>
          </div>
          <div className="p-4">
            <p className="text-[10px] text-slate-500">Core</p>
            <p className="mt-1 text-xl font-semibold text-blue-300">{selectedPerson?.coreScore ?? "—"}{selectedPerson?.coreScore !== null ? "%" : ""}</p>
          </div>
          <div className="p-4">
            <p className="text-[10px] text-slate-500">Asset</p>
            <p className="mt-1 text-xl font-semibold text-violet-300">{selectedPerson?.assetScore ?? "—"}{selectedPerson?.assetScore !== null ? "%" : ""}</p>
          </div>
        </div>
        <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-5">
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-xl border border-gray-800 bg-[#141820] p-3">
              <p className="text-[10px] text-slate-500">Training needs</p>
              <p className="mt-1 text-xl font-semibold text-amber-300">{selectedPerson?.engineer.trainingNeeds ?? 0}</p>
            </div>
            <div className="rounded-xl border border-gray-800 bg-[#141820] p-3">
              <p className="text-[10px] text-slate-500">Critical skills</p>
              <p className="mt-1 text-xl font-semibold text-red-300">{selectedPerson?.engineer.criticalSkillCount ?? 0}</p>
            </div>
          </div>
          <div className="rounded-xl border border-gray-800 bg-[#141820] p-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">Workforce context</p>
            <p className="mt-2 text-sm text-slate-200">{selectedPerson?.engineer.departmentName ?? "Department not recorded"}</p>
            <p className="mt-1 text-xs text-slate-500">{selectedPerson?.engineer.shiftNames.join(" · ") || "Shift not recorded"} · {formatStatus(selectedPerson?.engineer.availabilityStatus ?? "unknown")}</p>
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">Asset evidence</p>
            <div className="mt-3 flex flex-col gap-2">
              {selectedPerson?.assets.slice(0, 6).map((asset) => (
                <button
                  key={asset.equipmentId}
                  type="button"
                  onClick={() => navigate(`/equipment/${asset.equipmentId}/skills`)}
                  className="flex min-h-12 items-center justify-between gap-3 rounded-xl border border-gray-800 bg-[#141820] px-4 text-left"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-100">{asset.equipmentName}</p>
                    <p className="mt-0.5 text-xs text-slate-500">{asset.equipmentCode} · PM experience {asset.pmExperience.toFixed(1)}/5</p>
                  </div>
                  <span className={`shrink-0 text-sm font-semibold ${scoreClass(asset.score)}`}>{asset.score}%</span>
                </button>
              ))}
              {selectedPerson?.assets.length === 0 ? (
                <div className="rounded-xl border border-dashed border-gray-800 bg-[#10151d] p-4 text-sm text-slate-500">No equipment-specific evidence is linked in this scope.</div>
              ) : null}
            </div>
          </div>
          <button
            type="button"
            onClick={() => navigate("/training")}
            className="inline-flex min-h-12 items-center justify-between rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white"
          >
            Review training plan <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </DetailDrawer>

      <header className="flex items-start justify-between gap-3 border-b border-gray-800 pb-4">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-blue-300">
            {dataMode === "live" ? "Verified capability" : "Demo capability"}
          </p>
          <h1 className="mt-1 text-xl font-semibold text-slate-50">Skills Matrix</h1>
          <p className="mt-1 text-sm text-slate-400">People, core skills and equipment competence.</p>
        </div>
        <button
          type="button"
          onClick={() => void load(true)}
          disabled={loading || refreshing}
          aria-label="Refresh skills matrix"
          className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-gray-800 bg-[#141820] text-slate-300 disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
        </button>
      </header>

      {error ? (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4" role="alert">
          <div className="flex items-center gap-2 text-red-300"><AlertTriangle className="h-4 w-4" /><p className="font-semibold">Skills evidence unavailable</p></div>
          <p className="mt-2 text-sm text-red-200/80">{error}</p>
        </div>
      ) : null}

      {loading && !payload ? (
        <div className="grid grid-cols-2 gap-2">
          {Array.from({ length: 4 }, (_, index) => <div key={index} className="h-24 animate-pulse rounded-xl border border-gray-800 bg-[#141820]" />)}
        </div>
      ) : selectedSummary && selectedDetail ? (
        <>
          <div className="rounded-xl border border-gray-800 bg-[#10151d] p-3">
            <label className="block">
              <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">Workforce scope</span>
              <select
                value={selectedSummary.id}
                onChange={(event) => changeScope(event.target.value)}
                aria-label="Select workforce scope"
                className="mt-2 min-h-12 w-full rounded-xl border border-gray-700 bg-[#141820] px-3 text-base font-semibold text-slate-100 outline-none focus:border-blue-500"
              >
                {scopes.map((scope) => (
                  <option key={scope.id} value={scope.id}>{scope.name}</option>
                ))}
              </select>
            </label>
            <div className="mt-3 flex items-center justify-between gap-3 text-xs text-slate-500">
              <span>{selectedSummary.memberCount} engineers · {selectedSummary.affectedEquipment} affected assets</span>
              <span className={`rounded-md border px-2 py-1 text-[10px] font-semibold ${statusClass(selectedSummary.status)}`}>{selectedSummary.status}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Metric label="Current score" value={`${selectedSummary.score}%`} detail="Authoritative model" tone={scoreClass(selectedSummary.score)} />
            <Metric label="Core skills" value={preview ? `${Math.round(preview.coreCapability.score)}%` : "—"} detail="Transferable capability" tone="text-blue-300" />
            <Metric label="Asset competence" value={preview ? `${Math.round(preview.assetCompetence.score)}%` : "—"} detail="Equipment and PM evidence" tone="text-violet-300" />
            <Metric label="Critical gaps" value={String(selectedSummary.criticalGaps)} detail={`${selectedSummary.spofCount} single-point risks`} tone={selectedSummary.criticalGaps > 0 ? "text-red-300" : "text-emerald-300"} />
          </div>

          {topRisk ? (
            <button
              type="button"
              onClick={() => navigate(`/equipment/${topRisk.equipmentId}/skills`)}
              className="rounded-xl border border-red-500/25 bg-red-500/[0.07] p-4 text-left"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-red-300"><Sparkles className="h-4 w-4" /><p className="text-sm font-semibold">Highest capability exposure</p></div>
                  <h2 className="mt-2 font-semibold text-slate-100">{topRisk.skillName}</h2>
                  <p className="mt-1 text-sm leading-5 text-slate-400">{topRisk.equipmentName} · {topRisk.qualifiedCount} of {topRisk.minimumRequired} qualified</p>
                </div>
                <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-red-300" />
              </div>
            </button>
          ) : (
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.05] p-4">
              <div className="flex items-center gap-2 text-emerald-300"><CheckCircle2 className="h-4 w-4" /><p className="text-sm font-semibold">No current critical capability exposure</p></div>
            </div>
          )}

          <nav className="grid grid-cols-3 gap-1 rounded-xl border border-gray-800 bg-[#10151d] p-1" aria-label="Skills Matrix mobile sections">
            {([
              ["priorities", "Priorities"],
              ["people", "People"],
              ["assets", "Assets"],
            ] as Array<[MobileView, string]>).map(([value, label]) => (
              <button
                key={value}
                type="button"
                aria-pressed={view === value}
                onClick={() => {
                  setView(value);
                  setSearch("");
                  setSelectedAssetId(null);
                }}
                className={`min-h-11 rounded-lg px-2 text-xs font-semibold ${view === value ? "bg-blue-600 text-white" : "text-slate-400"}`}
              >
                {label}
              </button>
            ))}
          </nav>

          {view !== "priorities" && !selectedAsset ? (
            <label className="relative block">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <span className="sr-only">Search {view}</span>
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={view === "people" ? "Search engineers" : "Search equipment"}
                className="min-h-12 w-full rounded-xl border border-gray-800 bg-[#10151d] pl-10 pr-4 text-base text-slate-100 outline-none placeholder:text-slate-600 focus:border-blue-500"
              />
            </label>
          ) : null}

          {view === "priorities" ? (
            <div>
              <div className="flex items-center justify-between gap-3">
                <div><h2 className="font-semibold text-slate-50">Priority weaknesses</h2><p className="text-xs text-slate-500">Risk-ranked equipment capability gaps</p></div>
                <span className="rounded-md border border-gray-800 bg-[#141820] px-2 py-1 text-[10px] font-semibold text-slate-400">{priorities.length} records</span>
              </div>
              <div className="mt-3 flex flex-col gap-2">
                {priorities.slice(0, 8).map((risk) => (
                  <article key={risk.id} className="rounded-xl border border-gray-800 bg-[#141820] p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`rounded-md border px-2 py-1 text-[10px] font-semibold ${riskClass(risk.criticality)}`}>{risk.criticality}</span>
                          {risk.singlePoint ? <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-300"><Shield className="h-3 w-3" />SPOF</span> : null}
                        </div>
                        <h3 className="mt-2 font-semibold text-slate-100">{risk.skillName}</h3>
                        <p className="mt-1 text-xs text-slate-500">{risk.equipmentName} · {risk.equipmentCode}</p>
                      </div>
                      <div className="shrink-0 text-right"><p className="text-xl font-semibold text-red-300">{risk.gap}</p><p className="text-[10px] text-slate-600">gap</p></div>
                    </div>
                    <p className="mt-3 text-sm leading-5 text-slate-400">{risk.recommendedAction}</p>
                    <div className="mt-3 grid grid-cols-3 gap-2 border-t border-gray-800 pt-3 text-xs">
                      <div><p className="text-[9px] uppercase tracking-wider text-slate-600">Required</p><p className="mt-1 font-semibold text-slate-200">{risk.minimumRequired} × L{risk.requiredLevel}</p></div>
                      <div><p className="text-[9px] uppercase tracking-wider text-slate-600">Qualified</p><p className="mt-1 font-semibold text-orange-300">{risk.qualifiedCount}</p></div>
                      <div className="text-right"><p className="text-[9px] uppercase tracking-wider text-slate-600">Gain</p><p className="mt-1 font-semibold text-emerald-300">+{risk.projectedScoreGain}</p></div>
                    </div>
                    <button type="button" onClick={() => navigate(`/equipment/${risk.equipmentId}/skills`)} className="mt-3 inline-flex min-h-11 w-full items-center justify-between rounded-xl border border-gray-700 bg-[#10151d] px-4 text-sm font-semibold text-blue-300">Open equipment capability <ChevronRight className="h-4 w-4" /></button>
                  </article>
                ))}
                {priorities.length === 0 ? <div className="rounded-xl border border-dashed border-gray-800 bg-[#10151d] p-8 text-center text-sm text-slate-500">No priority weaknesses are recorded for this scope.</div> : null}
              </div>
            </div>
          ) : null}

          {view === "people" ? (
            <div>
              <div className="flex items-center justify-between gap-3"><div><h2 className="font-semibold text-slate-50">Engineer capability</h2><p className="text-xs text-slate-500">Current score, core skills and asset evidence</p></div><Users className="h-4 w-4 text-blue-300" /></div>
              <div className="mt-3 flex flex-col gap-2">
                {filteredPeople.map((person) => (
                  <button key={person.engineer.id} type="button" onClick={() => setSelectedPerson(person)} aria-label={`Review ${person.engineer.name}`} className="w-full rounded-xl border border-gray-800 bg-[#141820] p-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60">
                    <div className="flex items-start gap-3">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-blue-500/10 text-sm font-semibold text-blue-300">
                        {person.engineer.avatarUrl ? <img src={person.engineer.avatarUrl} alt="" className="h-full w-full object-cover" /> : initials(person.engineer.name)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5"><p className="truncate font-semibold text-slate-100">{person.engineer.name}</p>{person.engineer.criticalKnowledgeHolder ? <Shield className="h-3.5 w-3.5 shrink-0 text-blue-400" /> : null}</div>
                        <p className="mt-0.5 truncate text-xs text-slate-500">{person.engineer.discipline}</p>
                        <p className="mt-2 text-xs text-slate-500">{person.engineer.trainingNeeds} training need{person.engineer.trainingNeeds === 1 ? "" : "s"} · {person.engineer.criticalSkillCount} critical skill{person.engineer.criticalSkillCount === 1 ? "" : "s"}</p>
                      </div>
                      <div className="shrink-0 text-right"><p className={`text-lg font-semibold ${scoreClass(person.currentScore)}`}>{person.currentScore}%</p><p className="text-[10px] text-slate-600">current</p></div>
                    </div>
                    <div className="mt-3 grid grid-cols-3 gap-2 border-t border-gray-800 pt-3 text-center">
                      <div><p className="text-[9px] uppercase tracking-wider text-slate-600">Core</p><p className="mt-1 text-sm font-semibold text-blue-300">{person.coreScore ?? "—"}{person.coreScore !== null ? "%" : ""}</p></div>
                      <div><p className="text-[9px] uppercase tracking-wider text-slate-600">Asset</p><p className="mt-1 text-sm font-semibold text-violet-300">{person.assetScore ?? "—"}{person.assetScore !== null ? "%" : ""}</p></div>
                      <div><p className="text-[9px] uppercase tracking-wider text-slate-600">Assets</p><p className="mt-1 inline-flex items-center gap-1 text-sm font-semibold text-slate-200">{person.assets.length}<ChevronRight className="h-4 w-4 text-slate-600" /></p></div>
                    </div>
                  </button>
                ))}
                {filteredPeople.length === 0 ? <div className="rounded-xl border border-dashed border-gray-800 bg-[#10151d] p-8 text-center text-sm text-slate-500">No engineer matches the search.</div> : null}
              </div>
            </div>
          ) : null}

          {view === "assets" ? (
            selectedAsset ? (
              <div>
                <button type="button" onClick={() => setSelectedAssetId(null)} className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-slate-300"><ArrowLeft className="h-4 w-4" />Back to assets</button>
                <article className="mt-2 rounded-xl border border-gray-800 bg-[#141820] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0"><p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">{selectedAsset.equipmentCode}</p><h2 className="mt-1 text-lg font-semibold text-slate-50">{selectedAsset.equipmentName}</h2><p className="mt-1 text-sm text-slate-400">{selectedAsset.area}{selectedAsset.line ? ` · ${selectedAsset.line}` : ""}</p></div>
                    <span className={`rounded-md border px-2 py-1 text-[10px] font-semibold ${statusClass(selectedAsset.status)}`}>{selectedAsset.status}</span>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <Metric label="Asset score" value={`${selectedAsset.assetCompetenceScore}%`} detail="Competence evidence" tone={scoreClass(selectedAsset.assetCompetenceScore)} />
                    <Metric label="Minimum cover" value={String(selectedAsset.minimumQualified)} detail="Qualified engineers" />
                    <Metric label="PM tasks" value={String(selectedAsset.pmTaskCount)} detail={`${selectedAsset.calibrationTaskCount} calibrations`} />
                    <Metric label="History saturation" value={`${selectedAsset.pmEvidenceCoverage}%`} detail="Linked engineer-PM pairs" tone={selectedAsset.pmEvidenceCoverage < 10 ? "text-amber-300" : "text-blue-300"} />
                  </div>
                  {selectedAsset.pmEvidenceCoverage < 10 ? <div className="mt-3 rounded-xl border border-amber-400/20 bg-amber-400/[0.05] p-3 text-xs leading-5 text-slate-400">Sparse linked history is an evidence-quality warning, not proof that the team lacks competence.</div> : null}
                  <div className="mt-5"><div className="flex items-center justify-between gap-3"><p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">Engineer evidence</p><p className="text-[10px] text-slate-600">PM score capped at 5</p></div><div className="mt-3 flex flex-col gap-2">
                    {selectedAsset.engineers.map((engineer) => (
                      <div key={engineer.engineerId} className="rounded-xl border border-gray-800 bg-[#10151d] p-3">
                        <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate text-sm font-semibold text-slate-100">{engineer.engineerName}</p><p className="mt-0.5 truncate text-xs text-slate-500">{engineer.discipline || "Maintenance engineer"}</p></div><p className={`shrink-0 text-sm font-semibold ${scoreClass(engineer.assetCompetenceScore)}`}>{engineer.assetCompetenceScore}%</p></div>
                        <div className="mt-3 grid grid-cols-3 gap-2 text-xs"><div><p className="text-[9px] text-slate-600">PM experience</p><p className="mt-1 font-semibold text-blue-300">{engineer.pmExperienceScore.toFixed(1)}/5</p></div><div><p className="text-[9px] text-slate-600">Confirmed</p><p className="mt-1 font-semibold text-slate-200">{engineer.confirmedPmCount}</p></div><div><p className="text-[9px] text-slate-600">Last PM</p><p className="mt-1 font-semibold text-slate-300">{formatDate(engineer.lastPmCompletedAt)}</p></div></div>
                      </div>
                    ))}
                    {selectedAsset.engineers.length === 0 ? <div className="rounded-xl border border-dashed border-gray-800 p-4 text-sm text-slate-500">No engineer evidence is linked to this asset in the selected scope.</div> : null}
                  </div></div>
                  <button type="button" onClick={() => navigate(`/equipment/${selectedAsset.equipmentId}/skills`)} className="mt-4 inline-flex min-h-12 w-full items-center justify-between rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white">Open equipment skills <ChevronRight className="h-4 w-4" /></button>
                </article>
              </div>
            ) : (
              <div>
                <div className="flex items-center justify-between gap-3"><div><h2 className="font-semibold text-slate-50">Asset competence</h2><p className="text-xs text-slate-500">Lowest-scoring equipment first</p></div><Boxes className="h-4 w-4 text-violet-300" /></div>
                <div className="mt-3 flex flex-col gap-2">
                  {assets.map((asset) => (
                    <button key={asset.equipmentId} type="button" onClick={() => setSelectedAssetId(asset.equipmentId)} className="w-full rounded-xl border border-gray-800 bg-[#141820] p-4 text-left">
                      <div className="flex items-start justify-between gap-3"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className={`rounded-md border px-2 py-1 text-[10px] font-semibold ${statusClass(asset.status)}`}>{asset.status}</span><span className="text-[10px] text-slate-500">{asset.criticality}</span></div><h3 className="mt-2 font-semibold text-slate-100">{asset.equipmentName}</h3><p className="mt-1 text-xs text-slate-500">{asset.equipmentCode} · {asset.area}</p></div><div className="shrink-0 text-right"><p className={`text-xl font-semibold ${scoreClass(asset.assetCompetenceScore)}`}>{asset.assetCompetenceScore}%</p><ChevronRight className="ml-auto mt-2 h-4 w-4 text-slate-600" /></div></div>
                      <div className="mt-3 flex items-center justify-between border-t border-gray-800 pt-3 text-xs text-slate-500"><span>{asset.requiredSkillCount} skills · {asset.pmTaskCount} PMs</span><span>{asset.engineers.length} engineers</span></div>
                    </button>
                  ))}
                  {assets.length === 0 ? <div className="rounded-xl border border-dashed border-gray-800 bg-[#10151d] p-8 text-center"><Wrench className="mx-auto h-6 w-6 text-slate-700" /><p className="mt-3 text-sm text-slate-500">No asset competence evidence matches this scope.</p></div> : null}
                </div>
              </div>
            )
          ) : null}

          <div className="flex items-start gap-3 rounded-xl border border-blue-500/20 bg-blue-500/[0.05] p-4">
            <Clock3 className="mt-0.5 h-4 w-4 shrink-0 text-blue-300" />
            <p className="text-xs leading-5 text-slate-400">{payload ? freshness(payload.sourceUpdatedAt) : "Evidence freshness unavailable"}. Core and asset scores remain comparison evidence; the current capability score remains authoritative.</p>
          </div>
        </>
      ) : null}
    </section>
  );
}
