import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  Boxes,
  CheckCircle2,
  Clock3,
  Gauge,
  Info,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  Wrench,
} from "lucide-react";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Card, CardContent } from "../../components/ui/card";
import {
  clearMaintenancePortalDataCache,
  supabase,
} from "../../lib/supabaseClient";
import { validateSkillsMatrixPayload } from "../../lib/runtimeContracts";

const SKILLS_MATRIX_FUNCTION = "skills-matrix-data";
const SKILLS_MATRIX_OPTIONS = { body: { schemaVersion: "capability-v3" } };

type ScopeStatus = "Strong" | "Moderate" | "At risk" | "Critical";

type PreviewScopeSummary = {
  id: string;
  code: string;
  name: string;
  memberCount: number;
  score: number;
  status: ScopeStatus;
  previewOnly: boolean;
  scoreAuthority: string;
  scoreModel: string;
  coreCapabilityScore: number;
  assetCompetenceScore: number;
  proposedSkillsReadinessScore: number;
  pmExperienceCoverage: number;
  pmEvidenceCount: number;
  assetsAssessed: number;
  coreEngineersAssessed: number;
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
  scoreModel: string;
  explanation: string;
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

type PreviewPayload = {
  generatedAt: string;
  sourceUpdatedAt: string;
  site: { id: string; name: string };
  overall: PreviewScopeSummary;
  teams: PreviewScopeSummary[];
  departments: PreviewScopeSummary[];
  details: Record<string, { capabilityPreview?: CapabilityPreview }>;
};

function parsePreviewPayload(value: unknown): PreviewPayload {
  const payload = validateSkillsMatrixPayload(value) as unknown as PreviewPayload;
  const preview = payload.details?.[payload.overall.id]?.capabilityPreview;
  if (!preview || preview.modelStatus !== "preview") {
    throw new Error("Core and asset competence preview data is unavailable");
  }
  return payload;
}

function clamp(value: number): number {
  return Math.min(100, Math.max(0, Number(value) || 0));
}

function statusFromScore(score: number): ScopeStatus {
  if (score < 55) return "Critical";
  if (score < 70) return "At risk";
  if (score < 85) return "Moderate";
  return "Strong";
}

function scoreClass(score: number): string {
  if (score >= 85) return "text-emerald-400";
  if (score >= 70) return "text-blue-400";
  if (score >= 55) return "text-amber-300";
  return "text-red-400";
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

function recencyClass(status: string): string {
  if (status === "current") return "text-emerald-400";
  if (status === "aging") return "text-amber-300";
  if (status === "stale") return "text-red-400";
  return "text-slate-500";
}

function freshnessLabel(value: string): string {
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return "Freshness unavailable";
  const minutes = Math.max(0, Math.round((Date.now() - timestamp) / 60_000));
  if (minutes < 1) return "Updated just now";
  if (minutes < 60) return `Updated ${minutes}m ago`;
  return `Updated ${Math.round(minutes / 60)}h ago`;
}

function dateLabel(value: string | null): string {
  if (!value) return "No confirmed PM";
  const parsed = new Date(`${value}T00:00:00`);
  if (!Number.isFinite(parsed.getTime())) return value;
  return parsed.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function ScoreBar({ value, label }: { value: number; label: string }): JSX.Element {
  const width = clamp(value);
  return (
    <div>
      <div className="flex items-center justify-between gap-3 text-[11px]">
        <span className="text-slate-500">{label}</span>
        <span className="font-semibold tabular-nums text-slate-300">
          {Math.round(width)}%
        </span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-800">
        <div
          className="h-full rounded-full bg-current text-blue-400"
          style={{ width: `${width}%` }}
        />
      </div>
    </div>
  );
}

function SummaryScore({
  label,
  score,
  description,
  icon: Icon,
  selected = false,
}: {
  label: string;
  score: number;
  description: string;
  icon: typeof Gauge;
  selected?: boolean;
}): JSX.Element {
  return (
    <Card
      className={`rounded-xl border bg-[#141820] shadow-none ${
        selected ? "border-blue-500/35 ring-1 ring-blue-500/15" : "border-gray-800"
      }`}
    >
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
              {label}
            </p>
            <div className="mt-2 flex items-end gap-1">
              <span className={`text-3xl font-semibold tabular-nums ${scoreClass(score)}`}>
                {Math.round(score)}
              </span>
              <span className="pb-1 text-xs text-slate-600">/ 100</span>
            </div>
          </div>
          <Icon className="h-5 w-5 text-slate-600" />
        </div>
        <p className="mt-3 text-xs leading-5 text-slate-400">{description}</p>
      </CardContent>
    </Card>
  );
}

export const SkillsMatrixCoreAssetPreview = (): JSX.Element => {
  const [data, setData] = useState<PreviewPayload | null>(null);
  const [selectedScopeId, setSelectedScopeId] = useState("overall");
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [assetSearch, setAssetSearch] = useState("");
  const [mobileAssetDetailOpen, setMobileAssetDetailOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
        throw invokeError ?? new Error("Skills matrix preview data was empty");
      }
      const resolved = parsePreviewPayload(payload);
      setData(resolved);
      setSelectedScopeId((current) =>
        resolved.details[current]?.capabilityPreview ? current : resolved.overall.id,
      );
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Skills matrix preview data could not be loaded",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadData(false);
  }, [loadData]);

  const scopes = useMemo(
    () => (data ? [data.overall, ...data.teams, ...data.departments] : []),
    [data],
  );
  const selectedSummary = useMemo(
    () => scopes.find((scope) => scope.id === selectedScopeId) ?? data?.overall ?? null,
    [data?.overall, scopes, selectedScopeId],
  );
  const preview = selectedSummary
    ? data?.details[selectedSummary.id]?.capabilityPreview ?? null
    : null;

  const assets = useMemo(() => {
    const rows = preview?.assetCompetence.assets ?? [];
    const term = assetSearch.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter((asset) =>
      [asset.equipmentName, asset.equipmentCode, asset.area, asset.line ?? ""].some(
        (value) => value.toLowerCase().includes(term),
      ),
    );
  }, [assetSearch, preview?.assetCompetence.assets]);

  useEffect(() => {
    const availableAssets = preview?.assetCompetence.assets ?? [];
    setSelectedAssetId((current) =>
      current && availableAssets.some((asset) => asset.equipmentId === current)
        ? current
        : availableAssets[0]?.equipmentId ?? null,
    );
    setMobileAssetDetailOpen(false);
  }, [preview]);

  const selectedAsset = useMemo(
    () =>
      preview?.assetCompetence.assets.find(
        (asset) => asset.equipmentId === selectedAssetId,
      ) ?? null,
    [preview?.assetCompetence.assets, selectedAssetId],
  );

  const totalPmTasks = useMemo(
    () =>
      preview?.assetCompetence.assets.reduce(
        (sum, asset) => sum + asset.pmTaskCount,
        0,
      ) ?? 0,
    [preview?.assetCompetence.assets],
  );
  const strictPairDenominator =
    (selectedSummary?.memberCount ?? 0) * totalPmTasks;
  const sparseHistory =
    totalPmTasks > 0 && (selectedSummary?.pmExperienceCoverage ?? 0) < 10;

  const selectAsset = (assetId: string): void => {
    setSelectedAssetId(assetId);
    setMobileAssetDetailOpen(true);
  };

  const changeScope = (scopeId: string): void => {
    setSelectedScopeId(scopeId);
    setAssetSearch("");
    setMobileAssetDetailOpen(false);
  };

  return (
    <section
      data-vorta-skills-preview="core-asset"
      className="flex min-w-0 w-full max-w-full flex-1 grow flex-col gap-6 overflow-x-hidden px-4 pb-36 pt-0 md:gap-8 md:px-6 md:pb-12 xl:px-8"
    >
      <header className="flex w-full flex-col justify-between gap-4 py-5 lg:flex-row lg:items-center">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold text-slate-50">Skills Matrix</h1>
            <Badge className="h-auto rounded border border-violet-400/30 bg-violet-500/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-violet-300 shadow-none">
              Core + Asset Preview
            </Badge>
          </div>
          <p className="mt-2 max-w-3xl text-sm text-slate-400">
            Separates transferable engineering capability from verified competence on SAP equipment, PMs and calibrations.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <Clock3 className="h-3.5 w-3.5" />
            {data
              ? freshnessLabel(data.sourceUpdatedAt)
              : loading
                ? "Loading evidence"
                : "Data unavailable"}
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={() => void loadData(true)}
            disabled={loading || refreshing}
            className="min-h-10 gap-2 border-[#ffffff20] bg-[#ffffff0d] px-3 text-xs font-semibold text-slate-200 hover:bg-[#ffffff16] hover:text-slate-50"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
            Refresh evidence
          </Button>
        </div>
      </header>

      <div className="rounded-xl border border-violet-400/20 bg-violet-500/[0.06] px-4 py-3">
        <div className="flex items-start gap-3">
          <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-violet-300" />
          <div>
            <p className="text-sm font-semibold text-violet-200">Comparison model only</p>
            <p className="mt-1 text-xs leading-5 text-slate-400">
              The existing capability score remains authoritative. This preview combines 40% Core Capability and 60% Asset Competence so the evidence can be reviewed before it affects risk decisions.
            </p>
          </div>
        </div>
      </div>

      {error && !data ? (
        <Card className="rounded-xl border border-red-500/30 bg-red-500/5 shadow-none">
          <CardContent className="flex flex-col items-start gap-3 p-6">
            <div className="flex items-center gap-2 text-red-400">
              <AlertTriangle className="h-5 w-5" />
              <h2 className="font-semibold">Skills preview could not be loaded</h2>
            </div>
            <p className="text-sm text-slate-400">{error}</p>
            <Button type="button" onClick={() => void loadData(true)}>
              Try again
            </Button>
          </CardContent>
        </Card>
      ) : loading && !data ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {Array.from({ length: 3 }, (_, index) => (
            <div
              key={index}
              className="h-40 animate-pulse rounded-xl border border-gray-800 bg-[#141820]"
            />
          ))}
        </div>
      ) : selectedSummary && preview ? (
        <>
          <div className="flex flex-col gap-3 rounded-xl border border-gray-800 bg-[#10151d] p-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                Selected workforce scope
              </p>
              <p className="mt-1 text-sm text-slate-300">
                {selectedSummary.memberCount} members · {selectedSummary.assetsAssessed} assets assessed
              </p>
            </div>
            <select
              value={selectedSummary.id}
              onChange={(event) => changeScope(event.target.value)}
              aria-label="Select workforce scope"
              className="min-h-10 w-full rounded-lg border border-gray-700 bg-[#0d1219] px-3 text-sm text-slate-200 outline-none focus:border-blue-500/60 md:w-auto md:min-w-[240px]"
            >
              {scopes.map((scope) => (
                <option key={scope.id} value={scope.id}>
                  {scope.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <SummaryScore
              label="Skills Readiness"
              score={selectedSummary.proposedSkillsReadinessScore}
              description="Proposed combined score. It is visible for comparison but does not replace the live capability score."
              icon={Gauge}
              selected
            />
            <SummaryScore
              label="Core Capability"
              score={selectedSummary.coreCapabilityScore}
              description="Electrical, mechanical, controls, instrumentation, hydraulics, pneumatics and other transferable technical skills."
              icon={ShieldCheck}
            />
            <SummaryScore
              label="Asset Competence"
              score={selectedSummary.assetCompetenceScore}
              description="Equipment requirements, validated asset capability and historical PM or calibration evidence."
              icon={Boxes}
            />
          </div>

          <div className="grid min-w-0 grid-cols-1 gap-6 2xl:grid-cols-2">
            <Card className="min-w-0 rounded-xl border border-gray-800 bg-[#141820] shadow-none">
              <CardContent className="p-5 lg:p-6">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-base font-semibold text-slate-50">Core Capability</h2>
                    <p className="mt-1 text-sm text-slate-400">
                      Transferable technical capability across the selected workforce.
                    </p>
                  </div>
                  <Badge className={`h-auto rounded border px-2 py-1 text-[10px] shadow-none ${statusBadgeClass(statusFromScore(preview.coreCapability.score))}`}>
                    {statusFromScore(preview.coreCapability.score)}
                  </Badge>
                </div>

                <div className="mt-5 rounded-lg border border-gray-800 bg-[#10151d] p-4">
                  <ScoreBar value={preview.coreCapability.score} label="Core capability coverage" />
                  <div className="mt-4 grid grid-cols-2 gap-3 border-t border-gray-800 pt-4">
                    <div>
                      <p className="text-[10px] text-slate-500">Engineers assessed</p>
                      <p className="mt-1 text-lg font-semibold text-slate-100">
                        {preview.coreCapability.engineersAssessed}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-500">Combined weighting</p>
                      <p className="mt-1 text-lg font-semibold text-blue-300">40%</p>
                    </div>
                  </div>
                </div>

                <div className="mt-5 overflow-hidden rounded-lg border border-gray-800">
                  <div className="grid grid-cols-[minmax(0,1fr)_64px_72px] gap-2 border-b border-gray-800 bg-[#0f141b] px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-600 sm:grid-cols-[minmax(0,1fr)_80px_88px] sm:gap-3 sm:px-4">
                    <span>Engineer</span>
                    <span className="text-right">Skills</span>
                    <span className="text-right">Score</span>
                  </div>
                  <div className="max-h-[520px] divide-y divide-gray-800/70 overflow-y-auto">
                    {preview.coreCapability.engineers.map((engineer) => (
                      <div
                        key={engineer.engineerId}
                        className="grid grid-cols-[minmax(0,1fr)_64px_72px] items-center gap-2 px-3 py-3 sm:grid-cols-[minmax(0,1fr)_80px_88px] sm:gap-3 sm:px-4"
                      >
                        <p className="truncate text-sm font-medium text-slate-200">
                          {engineer.engineerName}
                        </p>
                        <p className="text-right text-xs tabular-nums text-slate-500">
                          {engineer.assessedSkillCount}
                        </p>
                        <p className={`text-right text-sm font-semibold tabular-nums ${scoreClass(engineer.score)}`}>
                          {engineer.score}%
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="min-w-0 rounded-xl border border-gray-800 bg-[#141820] shadow-none">
              <CardContent className="p-5 lg:p-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h2 className="text-base font-semibold text-slate-50">Asset Competence</h2>
                    <p className="mt-1 text-sm text-slate-400">
                      SAP equipment, required competencies, PMs and calibrations.
                    </p>
                  </div>
                  <div className="text-left sm:text-right">
                    <p className="text-[10px] text-slate-500">
                      Full engineer-task evidence saturation
                    </p>
                    <p className="mt-1 text-sm font-semibold text-blue-300">
                      {preview.assetCompetence.pmExperienceCoverage}%
                    </p>
                  </div>
                </div>

                <div
                  data-vorta-pm-evidence-audit
                  className={`mt-5 rounded-lg border p-4 ${
                    sparseHistory
                      ? "border-amber-400/25 bg-amber-400/[0.06]"
                      : "border-gray-800 bg-[#10151d]"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <Info className={`mt-0.5 h-4 w-4 shrink-0 ${sparseHistory ? "text-amber-300" : "text-blue-300"}`} />
                    <div className="min-w-0">
                      <p className={`text-xs font-semibold ${sparseHistory ? "text-amber-200" : "text-slate-200"}`}>
                        Historical SAP evidence audit
                      </p>
                      <p className="mt-1 text-xs leading-5 text-slate-400">
                        The percentage measures how many engineer × PM combinations have at least one linked confirmation. It is deliberately stricter than competence and must not be read as “the team is {preview.assetCompetence.pmExperienceCoverage}% competent”.
                      </p>
                      <div className="mt-3 grid grid-cols-3 gap-2">
                        <div>
                          <p className="text-[10px] text-slate-600">Engineers</p>
                          <p className="mt-0.5 text-sm font-semibold text-slate-200">
                            {selectedSummary.memberCount}
                          </p>
                        </div>
                        <div>
                          <p className="text-[10px] text-slate-600">PM tasks</p>
                          <p className="mt-0.5 text-sm font-semibold text-slate-200">
                            {totalPmTasks}
                          </p>
                        </div>
                        <div>
                          <p className="text-[10px] text-slate-600">Confirmed executions</p>
                          <p className="mt-0.5 text-sm font-semibold text-slate-200">
                            {selectedSummary.pmEvidenceCount}
                          </p>
                        </div>
                      </div>
                      {strictPairDenominator > 0 ? (
                        <p className="mt-3 text-[10px] leading-4 text-slate-500">
                          Strict denominator: {strictPairDenominator} possible engineer-PM pairs. Repeated executions improve experience scores but do not create new covered pairs.
                        </p>
                      ) : null}
                    </div>
                  </div>
                </div>

                <div className={mobileAssetDetailOpen ? "hidden xl:block" : "block"}>
                  <div className="relative mt-5">
                    <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-600" />
                    <input
                      value={assetSearch}
                      onChange={(event) => setAssetSearch(event.target.value)}
                      placeholder="Search equipment, code or area"
                      className="min-h-10 w-full rounded-lg border border-gray-800 bg-[#0f141b] pl-10 pr-3 text-sm text-slate-200 outline-none placeholder:text-slate-600 focus:border-blue-500/50"
                    />
                  </div>
                </div>

                <div className="mt-4 grid min-w-0 grid-cols-1 gap-4 xl:grid-cols-[minmax(220px,0.78fr)_minmax(0,1.22fr)]">
                  <div
                    data-vorta-mobile-asset-list
                    className={`${mobileAssetDetailOpen ? "hidden xl:block" : "block"} max-h-[620px] space-y-2 overflow-y-auto pr-1`}
                  >
                    {assets.map((asset) => (
                      <button
                        key={asset.equipmentId}
                        type="button"
                        onClick={() => selectAsset(asset.equipmentId)}
                        className={`min-h-11 w-full rounded-lg border p-3 text-left transition-colors ${
                          asset.equipmentId === selectedAsset?.equipmentId
                            ? "border-blue-500/40 bg-blue-500/[0.08]"
                            : "border-gray-800 bg-[#10151d] hover:border-gray-700"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-slate-200">
                              {asset.equipmentName}
                            </p>
                            <p className="mt-0.5 truncate text-[10px] text-slate-500">
                              {asset.equipmentCode} · {asset.area}
                            </p>
                          </div>
                          <span className={`text-sm font-semibold tabular-nums ${scoreClass(asset.assetCompetenceScore)}`}>
                            {asset.assetCompetenceScore}
                          </span>
                        </div>
                        <div className="mt-3 flex flex-wrap items-center justify-between gap-x-2 gap-y-1 text-[10px] text-slate-500">
                          <span>{asset.pmTaskCount} PMs</span>
                          <span>{asset.calibrationTaskCount} calibrations</span>
                          <span>{asset.pmEvidenceCoverage}% saturation</span>
                        </div>
                      </button>
                    ))}
                    {assets.length === 0 ? (
                      <div className="rounded-lg border border-gray-800 bg-[#10151d] p-4 text-sm text-slate-500">
                        No asset matches the current search.
                      </div>
                    ) : null}
                  </div>

                  {selectedAsset ? (
                    <div
                      data-vorta-mobile-asset-detail
                      className={`${mobileAssetDetailOpen ? "block" : "hidden xl:block"} min-w-0 scroll-mt-24 rounded-lg border border-gray-800 bg-[#10151d] p-4`}
                    >
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => setMobileAssetDetailOpen(false)}
                        className="-ml-2 mb-3 min-h-10 gap-2 px-2 text-xs text-slate-300 xl:hidden"
                      >
                        <ArrowLeft className="h-4 w-4" />
                        Back to assets
                      </Button>

                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                            {selectedAsset.equipmentCode}
                          </p>
                          <h3 className="mt-1 break-words text-base font-semibold text-slate-50">
                            {selectedAsset.equipmentName}
                          </h3>
                          <p className="mt-1 text-xs text-slate-500">
                            {selectedAsset.area}
                            {selectedAsset.line ? ` · ${selectedAsset.line}` : ""}
                          </p>
                        </div>
                        <Badge className={`h-auto rounded border px-2 py-1 text-[10px] shadow-none ${statusBadgeClass(selectedAsset.status)}`}>
                          {selectedAsset.status}
                        </Badge>
                      </div>

                      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
                        {[
                          ["Asset score", `${selectedAsset.assetCompetenceScore}%`],
                          ["Required skills", String(selectedAsset.requiredSkillCount)],
                          ["PM tasks", String(selectedAsset.pmTaskCount)],
                          ["Minimum cover", String(selectedAsset.minimumQualified)],
                          ["Calibrations", String(selectedAsset.calibrationTaskCount)],
                          ["History saturation", `${selectedAsset.pmEvidenceCoverage}%`],
                        ].map(([label, value]) => (
                          <div key={label} className="rounded-lg border border-gray-800 bg-[#0d1219] p-3">
                            <p className="text-[10px] text-slate-600">{label}</p>
                            <p className="mt-1 text-sm font-semibold text-slate-200">{value}</p>
                          </div>
                        ))}
                      </div>

                      {selectedAsset.pmEvidenceCoverage < 10 ? (
                        <div className="mt-4 rounded-lg border border-amber-400/20 bg-amber-400/[0.05] px-3 py-2 text-[10px] leading-4 text-slate-400">
                          Sparse linked history is an evidence-quality warning, not proof that engineers lack competence on this asset.
                        </div>
                      ) : null}

                      <div className="mt-5">
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-500">
                            Engineer evidence
                          </p>
                          <p className="text-[10px] text-slate-600">PM score capped at 5</p>
                        </div>
                        <div className="mt-2 divide-y divide-gray-800/70 rounded-lg border border-gray-800">
                          {selectedAsset.engineers.map((engineer) => (
                            <div key={engineer.engineerId} className="p-3">
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <p className="truncate text-sm font-medium text-slate-200">
                                    {engineer.engineerName}
                                  </p>
                                  <p className="truncate text-[10px] text-slate-500">
                                    {engineer.discipline || "Maintenance engineer"}
                                  </p>
                                </div>
                                <div className="shrink-0 text-right">
                                  <p className={`text-sm font-semibold tabular-nums ${scoreClass(engineer.assetCompetenceScore)}`}>
                                    {engineer.assetCompetenceScore}%
                                  </p>
                                  <p className="text-[10px] text-slate-600">asset score</p>
                                </div>
                              </div>
                              <div className="mt-3 grid grid-cols-3 gap-2 text-[10px]">
                                <div>
                                  <p className="text-slate-600">PM experience</p>
                                  <p className="mt-0.5 font-semibold text-blue-300">
                                    {engineer.pmExperienceScore.toFixed(1)} / 5
                                  </p>
                                </div>
                                <div>
                                  <p className="text-slate-600">Confirmed PMs</p>
                                  <p className="mt-0.5 font-semibold text-slate-300">
                                    {engineer.confirmedPmCount}
                                  </p>
                                </div>
                                <div>
                                  <p className="text-slate-600">Last completed</p>
                                  <p className={`mt-0.5 font-semibold ${recencyClass(engineer.recencyStatus)}`}>
                                    {dateLabel(engineer.lastPmCompletedAt)}
                                  </p>
                                </div>
                              </div>
                            </div>
                          ))}
                          {selectedAsset.engineers.length === 0 ? (
                            <div className="p-4 text-sm text-slate-500">
                              No engineer evidence is available for this asset in the selected scope.
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex min-h-72 items-center justify-center rounded-lg border border-dashed border-gray-800 bg-[#10151d] p-6 text-center">
                      <div>
                        <Wrench className="mx-auto h-6 w-6 text-slate-700" />
                        <p className="mt-3 text-sm text-slate-500">
                          Select an asset to inspect competence evidence.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          <div
            data-vorta-skills-preview-footer
            className="flex items-start gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/[0.05] px-4 py-3"
          >
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
            <p className="text-xs leading-5 text-slate-400">
              Existing Skills Matrix calculations, risk outputs and screen behaviour remain unchanged unless the preview feature flag is enabled. Historical PM evidence is read-only and cannot promote an engineer to independent status without the existing validation and authorisation controls.
            </p>
          </div>
        </>
      ) : null}
    </section>
  );
};
