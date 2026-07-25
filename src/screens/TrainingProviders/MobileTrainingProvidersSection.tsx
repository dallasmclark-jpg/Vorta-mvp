import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  BookOpen,
  Building2,
  ChevronRight,
  ExternalLink,
  Filter,
  MapPin,
  Search,
  Star,
} from "lucide-react";
import { DetailDrawer, DrawerCloseButton } from "../../components/DetailDrawer";
import { MobilePageHeader } from "../../components/MobilePageHeader";
import { useAuth } from "../../lib/auth";
import type { VortaDataMode } from "../../lib/dataTrust";
import { supabase } from "../../lib/supabaseClient";

type ProviderCourse = {
  id: string;
  title: string;
  delivery_type: string;
  duration_days: number;
  price: number;
  currency: string;
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
  delivery_types: string[];
  top_courses: ProviderCourse[];
  rating: number;
  accreditation: string;
  categories: string[];
  description: string;
};

type GapMatch = {
  skill_name: string;
  risk_level: string;
  matched_partner_ids: string[];
};

type StatusFilter = "all" | "active" | "preferred";

function statusTone(value: string): string {
  if (value === "preferred") return "border-blue-500/25 bg-blue-500/10 text-blue-300";
  if (value === "active") return "border-emerald-500/25 bg-emerald-500/10 text-emerald-300";
  return "border-amber-500/25 bg-amber-500/10 text-amber-300";
}

function statusLabel(value: string): string {
  if (value === "active") return "Approved";
  if (value === "preferred") return "Preferred";
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatCurrency(value: number, currency = "GBP"): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: currency || "GBP",
    maximumFractionDigits: 0,
  }).format(value);
}

export function MobileTrainingProvidersSection({ dataMode }: { dataMode: VortaDataMode }): JSX.Element {
  const { siteContext } = useAuth();
  const [providers, setProviders] = useState<Provider[]>([]);
  const [gapMatches, setGapMatches] = useState<GapMatch[]>([]);
  const [selected, setSelected] = useState<Provider | null>(null);
  const [search, setSearch] = useState("");
  const [delivery, setDelivery] = useState("all");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [matchedOnly, setMatchedOnly] = useState(true);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: requestError } = await supabase.functions.invoke("training-providers-data");
      if (requestError || !data || !Array.isArray(data.providers)) {
        throw requestError ?? new Error("Training provider evidence could not be loaded.");
      }
      if (siteContext?.siteId && data.siteId && data.siteId !== siteContext.siteId) {
        throw new Error("Training provider evidence does not match the authorised active site.");
      }
      setProviders(data.providers as Provider[]);
      setGapMatches(Array.isArray(data.gapMatches) ? (data.gapMatches as GapMatch[]) : []);
    } catch (loadError) {
      setProviders([]);
      setGapMatches([]);
      setError(loadError instanceof Error ? loadError.message : "Training provider evidence could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [siteContext?.siteId]);

  useEffect(() => {
    void load();
  }, [load]);

  const deliveryTypes = useMemo(
    () => Array.from(new Set(providers.flatMap((provider) => provider.delivery_types))).sort(),
    [providers],
  );
  const matchedProviderIds = useMemo(
    () => new Set(gapMatches.flatMap((gap) => gap.matched_partner_ids)),
    [gapMatches],
  );
  const criticalGapCount = gapMatches.filter((gap) => gap.risk_level === "critical").length;

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return providers
      .filter((provider) => {
        if (
          query &&
          ![provider.name, provider.location, provider.accreditation, ...provider.categories]
            .join(" ")
            .toLowerCase()
            .includes(query)
        ) {
          return false;
        }
        if (delivery !== "all" && !provider.delivery_types.includes(delivery)) return false;
        if (status !== "all" && provider.status !== status) return false;
        if (matchedOnly && gapMatches.length > 0 && !matchedProviderIds.has(provider.id)) return false;
        return true;
      })
      .sort(
        (left, right) =>
          Number(matchedProviderIds.has(right.id)) - Number(matchedProviderIds.has(left.id)) ||
          right.rating - left.rating ||
          left.name.localeCompare(right.name),
      );
  }, [delivery, gapMatches.length, matchedOnly, matchedProviderIds, providers, search, status]);

  const selectedMatches = selected
    ? gapMatches.filter((gap) => gap.matched_partner_ids.includes(selected.id))
    : [];
  const activeFilterCount = Number(delivery !== "all") + Number(status !== "all");

  return (
    <section
      data-vorta-mobile-training-providers="true"
      className="flex w-full flex-col gap-4 overflow-x-hidden px-3 pt-4"
    >
      <DetailDrawer open={filtersOpen} onClose={() => setFiltersOpen(false)}>
        <div className="flex items-start justify-between border-b border-gray-800 p-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-blue-300">Provider filters</p>
            <h2 className="mt-2 text-lg font-semibold text-slate-50">Narrow the provider list</h2>
          </div>
          <DrawerCloseButton onClose={() => setFiltersOpen(false)} />
        </div>
        <div className="flex flex-1 flex-col gap-6 overflow-y-auto p-5">
          <fieldset>
            <legend className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Delivery</legend>
            <div className="mt-3 grid gap-2">
              {["all", ...deliveryTypes].map((option) => (
                <button
                  key={option}
                  type="button"
                  aria-pressed={delivery === option}
                  onClick={() => setDelivery(option)}
                  className={`min-h-11 rounded-xl border px-3 text-left text-sm font-semibold ${
                    delivery === option
                      ? "border-blue-500 bg-blue-500/15 text-blue-200"
                      : "border-gray-800 bg-[#141820] text-slate-300"
                  }`}
                >
                  {option === "all" ? "All delivery methods" : option}
                </button>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Status</legend>
            <div className="mt-3 grid gap-2">
              {([
                ["all", "All providers"],
                ["preferred", "Preferred"],
                ["active", "Approved"],
              ] as const).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={status === value}
                  onClick={() => setStatus(value)}
                  className={`min-h-11 rounded-xl border px-3 text-left text-sm font-semibold ${
                    status === value
                      ? "border-blue-500 bg-blue-500/15 text-blue-200"
                      : "border-gray-800 bg-[#141820] text-slate-300"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </fieldset>
          <div className="mt-auto grid grid-cols-2 gap-2 border-t border-gray-800 pt-4">
            <button
              type="button"
              onClick={() => {
                setDelivery("all");
                setStatus("all");
              }}
              className="min-h-12 rounded-xl border border-gray-800 bg-[#141820] text-sm font-semibold text-slate-200"
            >
              Clear
            </button>
            <button
              type="button"
              onClick={() => setFiltersOpen(false)}
              className="min-h-12 rounded-xl bg-blue-600 text-sm font-semibold text-white"
            >
              Show {filtered.length}
            </button>
          </div>
        </div>
      </DetailDrawer>

      <DetailDrawer open={Boolean(selected)} onClose={() => setSelected(null)}>
        <div className="flex items-start justify-between border-b border-gray-800 p-5">
          <div className="min-w-0 pr-3">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-blue-300">Provider evidence</p>
            <h2 className="mt-2 text-lg font-semibold leading-6 text-slate-50">{selected?.name ?? "Provider"}</h2>
            <p className="mt-1 text-sm text-slate-400">{selected?.location ?? "Location not recorded"}</p>
          </div>
          <DrawerCloseButton onClose={() => setSelected(null)} />
        </div>
        <div className="grid grid-cols-3 divide-x divide-gray-800 border-b border-gray-800">
          <div className="p-3"><p className="text-[9px] text-slate-500">Courses</p><p className="mt-1 text-lg font-semibold text-slate-100">{selected?.course_count ?? 0}</p></div>
          <div className="p-3"><p className="text-[9px] text-slate-500">Matches</p><p className="mt-1 text-lg font-semibold text-blue-300">{selectedMatches.length}</p></div>
          <div className="p-3"><p className="text-[9px] text-slate-500">Rating</p><p className="mt-1 text-lg font-semibold text-amber-300">{selected?.rating?.toFixed(1) ?? "—"}</p></div>
        </div>
        <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-5">
          <div className="rounded-xl border border-gray-800 bg-[#141820] p-4">
            <p className="text-sm leading-6 text-slate-300">{selected?.description || "No provider description is recorded."}</p>
            <p className="mt-3 text-xs text-slate-500">{selected?.accreditation || "Accreditation not recorded"}</p>
          </div>
          {selectedMatches.length ? (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">Matched capability gaps</p>
              <div className="mt-2 flex flex-col gap-2">
                {selectedMatches.map((gap) => (
                  <div key={gap.skill_name} className="rounded-xl border border-orange-500/20 bg-orange-500/[0.06] p-3">
                    <p className="text-sm font-semibold text-slate-100">{gap.skill_name}</p>
                    <p className="mt-1 text-xs text-orange-300">{gap.risk_level} risk</p>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">Courses</p>
            <div className="mt-2 flex flex-col gap-2">
              {(selected?.top_courses ?? []).map((course) => (
                <div key={course.id} className="rounded-xl border border-gray-800 bg-[#141820] p-3">
                  <p className="text-sm font-semibold text-slate-100">{course.title}</p>
                  <p className="mt-1 text-xs text-slate-500">{course.delivery_type} · {course.duration_days} day{course.duration_days === 1 ? "" : "s"}</p>
                  <p className="mt-2 text-sm font-semibold text-blue-300">{formatCurrency(course.price, course.currency)}</p>
                </div>
              ))}
            </div>
          </div>
          {selected?.website ? (
            <a
              href={selected.website}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-12 items-center justify-between rounded-xl border border-gray-800 bg-[#141820] px-4 text-sm font-semibold text-slate-100"
            >
              Open provider website <ExternalLink className="h-4 w-4 text-blue-300" aria-hidden="true" />
            </a>
          ) : null}
        </div>
      </DetailDrawer>

      <MobilePageHeader
        eyebrow={dataMode === "live" ? "Verified marketplace" : "Training marketplace"}
        title="Training Providers"
        description="Providers matched to the skills that create the most site risk."
        actionLabel="Refresh training providers"
        busy={loading}
        onAction={() => void load()}
      />

      {error ? (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4" role="alert">
          <div className="flex items-center gap-2 text-red-300"><AlertTriangle className="h-4 w-4" aria-hidden="true" /><p className="font-semibold">Provider evidence unavailable</p></div>
          <p className="mt-2 text-sm text-red-200/80">{error}</p>
        </div>
      ) : null}

      {criticalGapCount > 0 ? (
        <div className="rounded-xl border border-orange-500/25 bg-orange-500/[0.06] p-4">
          <div className="flex items-start gap-3">
            <BookOpen className="mt-0.5 h-4 w-4 shrink-0 text-orange-300" aria-hidden="true" />
            <div>
              <p className="text-sm font-semibold text-orange-200">{criticalGapCount} critical training match{criticalGapCount === 1 ? "" : "es"}</p>
              <p className="mt-1 text-xs leading-5 text-slate-400">Matched providers are shown first so the page begins with the useful part, a concept websites occasionally overlook.</p>
            </div>
          </div>
        </div>
      ) : null}

      <div className="grid grid-cols-[1fr_auto] gap-2">
        <label className="flex min-h-12 items-center gap-2 rounded-xl border border-gray-800 bg-[#10151d] px-3">
          <Search className="h-4 w-4 text-slate-500" aria-hidden="true" />
          <span className="sr-only">Search training providers</span>
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search providers"
            className="min-w-0 flex-1 bg-transparent text-base text-slate-200 outline-none placeholder:text-slate-600"
          />
        </label>
        <button
          type="button"
          onClick={() => setFiltersOpen(true)}
          aria-label={`Open provider filters${activeFilterCount ? `, ${activeFilterCount} active` : ""}`}
          className="relative inline-flex h-12 w-12 items-center justify-center rounded-xl border border-gray-800 bg-[#141820] text-slate-300"
        >
          <Filter className="h-4 w-4" aria-hidden="true" />
          {activeFilterCount ? <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-blue-600 px-1 text-[10px] font-bold text-white">{activeFilterCount}</span> : null}
        </button>
      </div>

      <button
        type="button"
        aria-pressed={matchedOnly}
        onClick={() => setMatchedOnly((current) => !current)}
        className={`inline-flex min-h-11 items-center justify-between rounded-xl border px-4 text-sm font-semibold ${
          matchedOnly ? "border-blue-500/30 bg-blue-500/10 text-blue-200" : "border-gray-800 bg-[#141820] text-slate-300"
        }`}
      >
        Matched to site gaps
        <span className={`h-5 w-9 rounded-full p-0.5 transition-colors ${matchedOnly ? "bg-blue-600" : "bg-gray-700"}`}>
          <span className={`block h-4 w-4 rounded-full bg-white transition-transform ${matchedOnly ? "translate-x-4" : "translate-x-0"}`} />
        </span>
      </button>

      <div className="flex items-center justify-between gap-3">
        <div><h2 className="font-semibold text-slate-50">Provider list</h2><p className="text-xs text-slate-500">{filtered.length} providers</p></div>
        <span className="inline-flex items-center gap-1.5 rounded-md border border-gray-800 bg-[#141820] px-2 py-1 text-[10px] font-semibold text-slate-400"><Building2 className="h-3 w-3" aria-hidden="true" /> Approved network</span>
      </div>

      <div className="flex flex-col gap-2">
        {loading && providers.length === 0
          ? Array.from({ length: 4 }, (_, index) => <div key={index} className="h-36 animate-pulse rounded-xl border border-gray-800 bg-[#141820]" />)
          : filtered.map((provider) => {
              const matches = gapMatches.filter((gap) => gap.matched_partner_ids.includes(provider.id)).length;
              return (
                <button
                  key={provider.id}
                  type="button"
                  onClick={() => setSelected(provider)}
                  className="w-full rounded-xl border border-gray-800 bg-[#141820] p-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 active:bg-[#1a2030]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-slate-100">{provider.name}</p>
                      <p className="mt-1 inline-flex items-center gap-1 truncate text-xs text-slate-500"><MapPin className="h-3 w-3" aria-hidden="true" />{provider.location || "Location not recorded"}</p>
                    </div>
                    <span className={`rounded-md border px-2 py-1 text-[10px] font-semibold ${statusTone(provider.status)}`}>{statusLabel(provider.status)}</span>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                    <span className="inline-flex items-center gap-1 text-amber-300"><Star className="h-3.5 w-3.5" aria-hidden="true" />{provider.rating ? provider.rating.toFixed(1) : "Not rated"}</span>
                    <span className="text-slate-500">{provider.course_count} courses</span>
                    {matches ? <span className="rounded-md border border-orange-500/20 bg-orange-500/10 px-2 py-1 text-[10px] font-semibold text-orange-300">{matches} gap match{matches === 1 ? "" : "es"}</span> : null}
                  </div>
                  <div className="mt-3 flex items-center justify-between border-t border-gray-800 pt-3">
                    <span className="truncate text-xs text-slate-500">{provider.delivery_types.slice(0, 2).join(" · ") || "Delivery not recorded"}</span>
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-blue-300">Review <ChevronRight className="h-4 w-4" aria-hidden="true" /></span>
                  </div>
                </button>
              );
            })}
      </div>
    </section>
  );
}
