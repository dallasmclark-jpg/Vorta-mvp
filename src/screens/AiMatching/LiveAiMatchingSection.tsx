import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Brain,
  CheckCircle2,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react";
import { Badge } from "../../components/ui/badge";
import { Card, CardContent } from "../../components/ui/card";
import { useAuth } from "../../lib/auth";
import {
  RuntimeContractError,
  validateAiMatchingPayload,
} from "../../lib/runtimeContracts";
import { supabase } from "../../lib/supabaseClient";

type MatchResult = {
  engineer_id: string;
  engineer_name: string;
  discipline: string;
  employment_type: string;
  department_name: string | null;
  availability_status: string;
  overall_score: number;
  skills_score: number;
  cert_score: number;
  experience_score: number;
  avail_score: number;
  training_gap: number;
  matched_skills: string[];
  missing_skills: string[];
  certifications: string[];
  active_training: string[];
  status: string;
  ai_recommendation: string;
  critical_knowledge_holder: boolean;
  years_experience: number;
};

type GapRecommendation = {
  skill_name: string;
  category: string;
  risk_level: string;
  engineers_below: number;
  recommended_course: string | null;
  provider_name: string | null;
  provider_location: string | null;
  priority: string;
  score_impact: number;
};

type AiMatchingPayload = {
  siteId: string;
  organisationId: string;
  generatedAt: string;
  matchResults: MatchResult[];
  gapRecs: GapRecommendation[];
  departments: string[];
  skills: string[];
  certifications: string[];
  stats: {
    openRequirements: number;
    availableEngineers: number;
    bestMatchScore: number;
    criticalSkillGaps: number;
    totalEngineers: number;
    totalRequirements: number;
  };
};

function scoreClass(score: number): string {
  if (score >= 85) return "text-emerald-300";
  if (score >= 70) return "text-blue-300";
  if (score >= 55) return "text-amber-300";
  return "text-red-300";
}

function matchBadgeClass(status: string): string {
  if (status === "Strong Match") return "border-emerald-500/30 bg-emerald-500/10 text-emerald-300";
  if (status === "Good Match") return "border-blue-500/30 bg-blue-500/10 text-blue-300";
  if (status === "Partial Match") return "border-amber-500/30 bg-amber-500/10 text-amber-300";
  return "border-red-500/30 bg-red-500/10 text-red-300";
}

function priorityClass(priority: string): string {
  if (priority === "Critical") return "border-red-500/30 bg-red-500/10 text-red-300";
  if (priority === "High") return "border-orange-500/30 bg-orange-500/10 text-orange-300";
  return "border-amber-500/30 bg-amber-500/10 text-amber-300";
}

function formatGeneratedAt(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Freshness unavailable";
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function LiveAiMatchingSection(): JSX.Element {
  const { siteContext } = useAuth();
  const [payload, setPayload] = useState<AiMatchingPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const load = useCallback(async (initial = false): Promise<void> => {
    if (!siteContext?.siteId || !siteContext.organisationId) {
      setPayload(null);
      setError("An active maintenance site could not be resolved for this account.");
      setLoading(false);
      setRefreshing(false);
      return;
    }

    if (initial) setLoading(true);
    else setRefreshing(true);
    setError(null);

    try {
      const { data, error: requestError } = await supabase.functions.invoke("ai-matching-data", {
        body: { schemaVersion: "matching-evidence-v1" },
      });
      if (requestError || !data) {
        throw requestError ?? new Error("Matching evidence was empty");
      }

      const validated = validateAiMatchingPayload(data) as unknown as AiMatchingPayload;
      if (
        validated.siteId !== siteContext.siteId ||
        validated.organisationId !== siteContext.organisationId
      ) {
        throw new RuntimeContractError(
          "AI matching",
          "response scope did not match the authenticated site",
        );
      }
      setPayload(validated);
    } catch (loadError) {
      setPayload(null);
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Verified matching evidence is unavailable.",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [siteContext?.organisationId, siteContext?.siteId]);

  useEffect(() => {
    void load(true);
  }, [load]);

  const filteredMatches = useMemo(() => {
    const term = search.trim().toLowerCase();
    const rows = payload?.matchResults ?? [];
    if (!term) return rows.slice(0, 20);
    return rows.filter((row) =>
      [
        row.engineer_name,
        row.discipline,
        row.department_name ?? "",
        ...row.matched_skills,
        ...row.missing_skills,
      ].some((value) => value.toLowerCase().includes(term)),
    ).slice(0, 20);
  }, [payload?.matchResults, search]);

  const gapRecommendations = useMemo(() => payload?.gapRecs.slice(0, 8) ?? [], [payload]);

  return (
    <section className="relative flex min-w-0 w-full max-w-full flex-1 grow flex-col gap-6 overflow-x-hidden px-4 pb-12 pt-0 md:gap-8 md:px-6 xl:px-8">
      <header className="flex flex-col justify-between gap-4 py-5 lg:flex-row lg:items-center">
        <div>
          <p className="text-xs font-medium text-slate-400">Read-only live pilot</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-50">AI Matching Evidence</h1>
          <p className="mt-1 max-w-3xl text-sm text-slate-400">
            Evidence-derived workforce rankings against verified site requirements. Results support review only and do not assign engineers, accept recommendations or create training decisions.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load(false)}
          disabled={loading || refreshing}
          aria-label="Refresh verified AI matching evidence"
          className="inline-flex h-10 items-center justify-center gap-2 self-start rounded-lg border border-white/10 bg-white/10 px-4 text-sm font-semibold text-slate-100 transition-colors hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-50 lg:self-auto"
        >
          <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} aria-hidden="true" />
          Refresh
        </button>
      </header>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" role="status" aria-label="Loading matching evidence">
          {[0, 1, 2, 3].map((item) => (
            <div key={item} className="h-28 animate-pulse rounded-xl border border-gray-800 bg-[#141820]" />
          ))}
        </div>
      ) : null}

      {!loading && error ? (
        <div className="flex flex-col justify-between gap-4 rounded-xl border border-red-500/30 bg-red-500/10 p-5 sm:flex-row sm:items-center" role="alert">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-400" aria-hidden="true" />
            <div>
              <p className="text-sm font-semibold text-red-100">AI matching evidence was withheld</p>
              <p className="mt-1 text-xs leading-5 text-red-100/75">{error}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => void load(false)}
            className="rounded-lg border border-red-500/30 px-4 py-2 text-sm font-semibold text-red-200 hover:bg-red-500/10"
          >
            Retry
          </button>
        </div>
      ) : null}

      {!loading && payload ? (
        <>
          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-blue-500/20 bg-blue-500/[0.07] px-4 py-3 text-xs text-slate-300">
            <CheckCircle2 className="h-4 w-4 text-blue-300" aria-hidden="true" />
            <span className="font-semibold text-blue-200">Runtime-validated evidence</span>
            <span>Active site: {payload.siteId}</span>
            <span>Generated: {formatGeneratedAt(payload.generatedAt)}</span>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[
              { label: "Open requirements", value: payload.stats.openRequirements, icon: ShieldCheck, cls: payload.stats.openRequirements ? "text-orange-300" : "text-emerald-300" },
              { label: "Available engineers", value: payload.stats.availableEngineers, icon: Users, cls: "text-blue-300" },
              { label: "Best evidence score", value: `${payload.stats.bestMatchScore}%`, icon: Sparkles, cls: scoreClass(payload.stats.bestMatchScore) },
              { label: "Critical skill gaps", value: payload.stats.criticalSkillGaps, icon: AlertTriangle, cls: payload.stats.criticalSkillGaps ? "text-red-300" : "text-emerald-300" },
            ].map(({ label, value, icon: Icon, cls }) => (
              <Card key={label} className="rounded-xl border border-gray-800 bg-[#141820] shadow-none">
                <CardContent className="p-5">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs font-medium text-slate-400">{label}</p>
                    <Icon className="h-4 w-4 text-slate-600" aria-hidden="true" />
                  </div>
                  <p className={`mt-3 text-2xl font-semibold tabular-nums ${cls}`}>{value}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="rounded-xl border border-amber-500/20 bg-amber-500/[0.06] px-4 py-3 text-xs leading-5 text-amber-100/80" role="note">
            Scores combine recorded skill ratings, certification validity, experience and current availability. They are decision-support evidence, not an automated staffing instruction.
          </div>

          <div className="flex flex-col gap-4">
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
              <div>
                <h2 className="font-semibold text-slate-50">Engineer evidence ranking</h2>
                <p className="mt-1 text-xs text-slate-500">Highest recorded match against current site requirements.</p>
              </div>
              <label className="relative block w-full sm:w-72">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-600" aria-hidden="true" />
                <span className="sr-only">Search matching evidence</span>
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search engineer or skill"
                  className="h-10 w-full rounded-lg border border-gray-800 bg-[#111620] pl-9 pr-3 text-sm text-slate-200 outline-none placeholder:text-slate-600 focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20"
                />
              </label>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              {filteredMatches.length === 0 ? (
                <div className="rounded-xl border border-gray-800 bg-[#141820] p-5 text-sm text-slate-500">No matching evidence meets the current search.</div>
              ) : filteredMatches.map((row) => (
                <Card key={row.engineer_id} className="rounded-xl border border-gray-800 bg-[#141820] shadow-none">
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="truncate text-sm font-semibold text-slate-100">{row.engineer_name}</h3>
                          {row.critical_knowledge_holder ? (
                            <span title="Critical knowledge holder"><Brain className="h-3.5 w-3.5 text-blue-300" aria-hidden="true" /></span>
                          ) : null}
                        </div>
                        <p className="mt-0.5 truncate text-xs text-slate-500">{row.discipline} · {row.department_name ?? "Department not recorded"}</p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className={`text-2xl font-semibold tabular-nums ${scoreClass(row.overall_score)}`}>{row.overall_score}%</p>
                        <Badge className={`mt-1 h-auto rounded border px-2 py-0.5 text-[10px] shadow-none ${matchBadgeClass(row.status)}`}>{row.status}</Badge>
                      </div>
                    </div>

                    <div className="mt-4 grid grid-cols-4 gap-2 text-center text-[11px]">
                      {[
                        ["Skills", row.skills_score],
                        ["Certs", row.cert_score],
                        ["Experience", row.experience_score],
                        ["Availability", row.avail_score],
                      ].map(([label, value]) => (
                        <div key={String(label)} className="rounded-lg border border-gray-800 bg-[#111620] px-2 py-2">
                          <p className="text-slate-600">{String(label)}</p>
                          <p className={`mt-0.5 font-semibold tabular-nums ${scoreClass(Number(value))}`}>{Number(value)}%</p>
                        </div>
                      ))}
                    </div>

                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-600">Recorded strengths</p>
                        <p className="mt-1 text-xs leading-5 text-slate-400">{row.matched_skills.length ? row.matched_skills.join(" · ") : "No requirement-level match recorded"}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-600">Recorded gaps</p>
                        <p className="mt-1 text-xs leading-5 text-slate-400">{row.missing_skills.length ? row.missing_skills.join(" · ") : "No current gap recorded"}</p>
                      </div>
                    </div>
                    <p className="mt-4 border-t border-gray-800 pt-3 text-xs leading-5 text-slate-400">{row.ai_recommendation}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          <Card className="rounded-xl border border-gray-800 bg-[#141820] shadow-none">
            <CardContent className="p-0">
              <div className="border-b border-gray-800 p-5">
                <h2 className="font-semibold text-slate-50">Training gap recommendations</h2>
                <p className="mt-1 text-xs text-slate-500">Recorded courses and providers matched to current high-risk capability gaps.</p>
              </div>
              <div className="grid gap-0 divide-y divide-gray-800/80 md:grid-cols-2 md:divide-x md:divide-y-0">
                {gapRecommendations.length === 0 ? (
                  <p className="p-5 text-sm text-slate-500">No high-risk training recommendations are recorded.</p>
                ) : gapRecommendations.map((row) => (
                  <div key={`${row.skill_name}:${row.priority}`} className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-100">{row.skill_name}</p>
                        <p className="mt-0.5 text-xs text-slate-500">{row.category}</p>
                      </div>
                      <Badge className={`h-auto rounded border px-2 py-0.5 text-[10px] shadow-none ${priorityClass(row.priority)}`}>{row.priority}</Badge>
                    </div>
                    <p className="mt-3 text-xs text-slate-400">{row.engineers_below} engineer{row.engineers_below === 1 ? "" : "s"} below target · estimated evidence score impact +{row.score_impact}pp</p>
                    <p className="mt-2 text-xs font-medium text-slate-300">{row.recommended_course ?? "No verified course match"}</p>
                    {row.provider_name ? <p className="mt-0.5 text-xs text-slate-500">{row.provider_name}{row.provider_location ? ` · ${row.provider_location}` : ""}</p> : null}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      ) : null}
    </section>
  );
}
