import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  BookOpen,
  Building2,
  CheckCircle2,
  ExternalLink,
  Mail,
  MapPin,
  RefreshCw,
  Search,
} from "lucide-react";
import { Badge } from "../../components/ui/badge";
import { Card, CardContent } from "../../components/ui/card";
import { useAuth } from "../../lib/auth";
import {
  RuntimeContractError,
  validateTrainingProvidersPayload,
} from "../../lib/runtimeContracts";
import { supabase } from "../../lib/supabaseClient";

type ProviderCourse = {
  id: string;
  title: string;
  delivery_type: string;
  duration_days: number;
  price: number;
  currency: string;
  bookings: number;
};

type Provider = {
  id: string;
  name: string;
  location: string;
  contact_email: string;
  website: string | null;
  status: string;
  course_count: number;
  booking_count: number;
  enquiry_count: number;
  delivery_types: string[];
  top_courses: ProviderCourse[];
};

type GapMatch = {
  skill_name: string;
  category: string;
  risk_level: string;
  engineers_below: number;
  single_point_of_failure: boolean;
  recommendation: string;
  matched_partner_ids: string[];
  matched_partner_names: string[];
};

type TrainingProvidersPayload = {
  siteId: string;
  organisationId: string;
  generatedAt: string;
  providers: Provider[];
  gapMatches: GapMatch[];
  stats: {
    providerCount: number;
    courseCount: number;
    openEnquiries: number;
    totalBookings: number;
  };
};

function formatCurrency(value: number, currency = "GBP"): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value);
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

function statusClass(status: string): string {
  if (status === "preferred") return "border-blue-500/30 bg-blue-500/10 text-blue-300";
  if (status === "active") return "border-emerald-500/30 bg-emerald-500/10 text-emerald-300";
  if (status === "pending") return "border-amber-500/30 bg-amber-500/10 text-amber-300";
  return "border-slate-700 bg-slate-800/60 text-slate-300";
}

function riskClass(level: string): string {
  if (level === "critical") return "border-red-500/30 bg-red-500/10 text-red-300";
  if (level === "high") return "border-orange-500/30 bg-orange-500/10 text-orange-300";
  return "border-amber-500/30 bg-amber-500/10 text-amber-300";
}

export function LiveTrainingProvidersSection(): JSX.Element {
  const { siteContext } = useAuth();
  const [payload, setPayload] = useState<TrainingProvidersPayload | null>(null);
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
      const { data, error: requestError } = await supabase.functions.invoke(
        "training-providers-data",
        { body: { schemaVersion: "provider-evidence-v1" } },
      );
      if (requestError || !data) {
        throw requestError ?? new Error("Provider evidence was empty");
      }

      const validated = validateTrainingProvidersPayload(
        data,
      ) as unknown as TrainingProvidersPayload;
      if (
        validated.siteId !== siteContext.siteId ||
        validated.organisationId !== siteContext.organisationId
      ) {
        throw new RuntimeContractError(
          "Training providers",
          "response scope did not match the authenticated site",
        );
      }
      setPayload(validated);
    } catch (loadError) {
      setPayload(null);
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Verified provider evidence is unavailable.",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [siteContext?.organisationId, siteContext?.siteId]);

  useEffect(() => {
    void load(true);
  }, [load]);

  const providers = useMemo(() => {
    const term = search.trim().toLowerCase();
    const rows = payload?.providers ?? [];
    if (!term) return rows;
    return rows.filter((provider) =>
      [
        provider.name,
        provider.location,
        provider.status,
        ...provider.delivery_types,
        ...provider.top_courses.map((course) => course.title),
      ].some((value) => value.toLowerCase().includes(term)),
    );
  }, [payload?.providers, search]);

  const gapMatches = useMemo(() => payload?.gapMatches.slice(0, 8) ?? [], [payload]);

  return (
    <section className="relative flex min-w-0 w-full max-w-full flex-1 grow flex-col gap-6 overflow-x-hidden px-4 pb-12 pt-0 md:gap-8 md:px-6 xl:px-8">
      <header className="flex flex-col justify-between gap-4 py-5 lg:flex-row lg:items-center">
        <div>
          <p className="text-xs font-medium text-slate-400">Read-only live pilot</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-50">Training Provider Evidence</h1>
          <p className="mt-1 max-w-3xl text-sm text-slate-400">
            Organisation-approved provider and course records matched to verified site capability gaps. Vorta does not shortlist providers, send enquiries or request availability in live mode.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load(false)}
          disabled={loading || refreshing}
          aria-label="Refresh verified provider evidence"
          className="inline-flex h-10 items-center justify-center gap-2 self-start rounded-lg border border-white/10 bg-white/10 px-4 text-sm font-semibold text-slate-100 transition-colors hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-50 lg:self-auto"
        >
          <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} aria-hidden="true" />
          Refresh
        </button>
      </header>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" role="status" aria-label="Loading provider evidence">
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
              <p className="text-sm font-semibold text-red-100">Provider evidence was withheld</p>
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
              ["Approved providers", payload.stats.providerCount, Building2, "text-slate-100"],
              ["Active courses", payload.stats.courseCount, BookOpen, "text-blue-300"],
              ["Site bookings", payload.stats.totalBookings, CheckCircle2, "text-slate-100"],
              ["Open site enquiries", payload.stats.openEnquiries, Mail, payload.stats.openEnquiries ? "text-orange-300" : "text-emerald-300"],
            ].map(([label, value, Icon, valueClass]) => {
              const MetricIcon = Icon as typeof Building2;
              return (
                <Card key={String(label)} className="rounded-xl border border-gray-800 bg-[#141820] shadow-none">
                  <CardContent className="p-5">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-xs font-medium text-slate-400">{String(label)}</p>
                      <MetricIcon className="h-4 w-4 text-slate-600" aria-hidden="true" />
                    </div>
                    <p className={`mt-3 text-2xl font-semibold tabular-nums ${String(valueClass)}`}>{String(value)}</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <div className="rounded-xl border border-amber-500/20 bg-amber-500/[0.06] px-4 py-3 text-xs leading-5 text-amber-100/80" role="note">
            Provider status, courses, bookings and enquiry counts are recorded evidence. Displayed gap matches are recommendations only and do not constitute provider approval, availability or a commercial commitment.
          </div>

          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
            <div>
              <h2 className="font-semibold text-slate-50">Approved provider catalogue</h2>
              <p className="mt-1 text-xs text-slate-500">Organisation-wide catalogue with site-attributable booking and enquiry counts.</p>
            </div>
            <label className="relative block w-full sm:w-72">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-600" aria-hidden="true" />
              <span className="sr-only">Search provider evidence</span>
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search provider or course"
                className="h-10 w-full rounded-lg border border-gray-800 bg-[#111620] pl-9 pr-3 text-sm text-slate-200 outline-none placeholder:text-slate-600 focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20"
              />
            </label>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            {providers.length === 0 ? (
              <div className="rounded-xl border border-gray-800 bg-[#141820] p-5 text-sm text-slate-500">No provider evidence meets the current search.</div>
            ) : providers.map((provider) => {
              const matchedGapCount = gapMatches.filter((gap) =>
                gap.matched_partner_ids.includes(provider.id),
              ).length;
              return (
                <Card key={provider.id} className="rounded-xl border border-gray-800 bg-[#141820] shadow-none">
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="truncate text-sm font-semibold text-slate-100">{provider.name}</h3>
                          <Badge className={`h-auto rounded border px-2 py-0.5 text-[10px] shadow-none ${statusClass(provider.status)}`}>{provider.status}</Badge>
                        </div>
                        <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-500">
                          <MapPin className="h-3.5 w-3.5" aria-hidden="true" />{provider.location || "Location not recorded"}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-xl font-semibold text-blue-300">{provider.course_count}</p>
                        <p className="text-[10px] text-slate-600">courses</p>
                      </div>
                    </div>

                    <div className="mt-4 grid grid-cols-3 gap-2 text-center text-[11px]">
                      {[
                        ["Site bookings", provider.booking_count],
                        ["Open enquiries", provider.enquiry_count],
                        ["Gap matches", matchedGapCount],
                      ].map(([label, value]) => (
                        <div key={String(label)} className="rounded-lg border border-gray-800 bg-[#111620] px-2 py-2">
                          <p className="text-slate-600">{String(label)}</p>
                          <p className="mt-0.5 font-semibold tabular-nums text-slate-300">{Number(value)}</p>
                        </div>
                      ))}
                    </div>

                    <div className="mt-4 flex flex-wrap gap-1.5">
                      {provider.delivery_types.map((delivery) => (
                        <span key={delivery} className="rounded-full border border-gray-700 px-2 py-0.5 text-[10px] text-slate-400">{delivery}</span>
                      ))}
                    </div>

                    <div className="mt-4 flex flex-col gap-2">
                      {provider.top_courses.slice(0, 3).map((course) => (
                        <div key={course.id} className="flex items-start justify-between gap-3 rounded-lg border border-gray-800 bg-[#111620] p-3">
                          <div className="min-w-0">
                            <p className="truncate text-xs font-medium text-slate-200">{course.title}</p>
                            <p className="mt-0.5 text-[10px] text-slate-600">{course.delivery_type} · {course.duration_days}d</p>
                          </div>
                          <span className="shrink-0 text-xs font-semibold text-slate-300">{formatCurrency(course.price, course.currency)}</span>
                        </div>
                      ))}
                    </div>

                    <div className="mt-4 flex flex-wrap gap-3 border-t border-gray-800 pt-3 text-xs">
                      {provider.contact_email ? (
                        <a href={`mailto:${provider.contact_email}`} className="inline-flex items-center gap-1.5 text-blue-300 hover:text-blue-200">
                          <Mail className="h-3.5 w-3.5" aria-hidden="true" />Recorded contact
                        </a>
                      ) : null}
                      {provider.website ? (
                        <a href={provider.website} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-blue-300 hover:text-blue-200">
                          <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />Provider website
                        </a>
                      ) : null}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <Card className="rounded-xl border border-gray-800 bg-[#141820] shadow-none">
            <CardContent className="p-0">
              <div className="border-b border-gray-800 p-5">
                <h2 className="font-semibold text-slate-50">Verified capability-gap matches</h2>
                <p className="mt-1 text-xs text-slate-500">Current high-risk site gaps mapped to relevant organisation-approved providers.</p>
              </div>
              <div className="grid gap-0 divide-y divide-gray-800/80 md:grid-cols-2 md:divide-x md:divide-y-0">
                {gapMatches.length === 0 ? (
                  <p className="p-5 text-sm text-slate-500">No high-risk provider matches are recorded.</p>
                ) : gapMatches.map((gap) => (
                  <div key={`${gap.skill_name}:${gap.risk_level}`} className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-100">{gap.skill_name}</p>
                        <p className="mt-0.5 text-xs text-slate-500">{gap.category}</p>
                      </div>
                      <Badge className={`h-auto rounded border px-2 py-0.5 text-[10px] shadow-none ${riskClass(gap.risk_level)}`}>{gap.risk_level}</Badge>
                    </div>
                    <p className="mt-3 text-xs text-slate-400">{gap.engineers_below} engineer{gap.engineers_below === 1 ? "" : "s"} below target{gap.single_point_of_failure ? " · single point of failure" : ""}</p>
                    <p className="mt-2 text-xs leading-5 text-slate-500">{gap.recommendation}</p>
                    <p className="mt-2 text-xs font-medium text-blue-300">{gap.matched_partner_names.length ? gap.matched_partner_names.join(" · ") : "No verified provider match"}</p>
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
