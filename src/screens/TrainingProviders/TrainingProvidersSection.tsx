import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  BookOpen,
  Building2,
  CheckCircle2,
  CircleUser as UserCircle,
  Download,
  ExternalLink,
  GraduationCap,
  Mail,
  MapPin,
  Plus,
  RefreshCw,
  Search,
  Shield,
  Sparkles,
  Star,
  TrendingUp,
  X,
  Zap,
} from "lucide-react";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Card, CardContent } from "../../components/ui/card";
import { supabase } from "../../lib/supabaseClient";
import { ContextHelp } from "../../components/ContextHelp";
import { Select } from "../../components/Select";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ProviderCourse {
  id: string;
  title: string;
  delivery_type: string;
  duration_days: number;
  price: number;
  currency: string;
  bookings: number;
}

interface Provider {
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
  rating: number;
  accreditation: string;
  categories: string[];
  description: string;
  delivery_focus: string[];
}

interface GapMatch {
  skill_name: string;
  category: string;
  risk_level: string;
  engineers_below: number;
  single_point_of_failure: boolean;
  recommendation: string;
  matched_partner_ids: string[];
  matched_partner_names: string[];
}

interface ProviderStats {
  providerCount: number;
  courseCount: number;
  openEnquiries: number;
  totalBookings: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function statusBadgeClass(status: string): string {
  switch (status) {
    case "active":    return "bg-[#10b98120] text-emerald-500";
    case "preferred": return "bg-[#3b82f620] text-blue-400";
    case "pending":   return "bg-[#facc1520] text-yellow-400";
    case "inactive":  return "bg-gray-800 text-slate-400";
    default:          return "bg-[#10b98120] text-emerald-500";
  }
}

function statusLabel(status: string): string {
  switch (status) {
    case "active":    return "Approved";
    case "preferred": return "Preferred";
    case "pending":   return "Pending Review";
    default:          return status.charAt(0).toUpperCase() + status.slice(1);
  }
}

function deliveryBadgeClass(type: string): string {
  const t = type.toLowerCase();
  if (t.includes("class")) return "bg-[#3b82f620] text-blue-400";
  if (t.includes("blend")) return "bg-[#8b5cf620] text-violet-400";
  if (t.includes("onsite") || t.includes("on-site") || t.includes("site")) return "bg-[#10b98120] text-emerald-400";
  return "bg-gray-800 text-slate-400";
}

function riskBadgeClass(level: string): string {
  switch (level) {
    case "critical": return "bg-[#ef444420] text-red-500";
    case "high":     return "bg-[#f9731620] text-orange-400";
    case "medium":   return "bg-[#facc1520] text-yellow-400";
    default:         return "bg-[#10b98120] text-emerald-500";
  }
}

function fmtCurrency(n: number, currency = "GBP"): string {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency, maximumFractionDigits: 0 }).format(n);
}

function StarRating({ rating }: { rating: number }) {
  if (!rating) return <span className="text-sm text-slate-500">—</span>;
  return (
    <div className="flex items-center gap-1">
      <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />
      <span className="text-sm font-semibold tabular-nums text-slate-200">{rating.toFixed(1)}</span>
    </div>
  );
}

function SkeletonLine({ w = "w-24", h = "h-4" }: { w?: string; h?: string }) {
  return <div className={`${h} ${w} animate-pulse rounded bg-gray-800`} />;
}

// ─── Fetch ────────────────────────────────────────────────────────────────────

async function fetchProviders(): Promise<{
  providers: Provider[];
  gapMatches: GapMatch[];
  stats: ProviderStats;
  error?: boolean;
}> {
  const { data, error } = await supabase.functions.invoke("training-providers-data");
  if (error || !data) {
    return {
      providers: [],
      gapMatches: [],
      stats: { providerCount: 0, courseCount: 0, openEnquiries: 0, totalBookings: 0 },
      error: true,
    };
  }
  return {
    providers:  (data.providers  ?? []) as Provider[],
    gapMatches: (data.gapMatches ?? []) as GapMatch[],
    stats:       data.stats        as ProviderStats,
  };
}

// ─── Provider Detail Drawer ───────────────────────────────────────────────────

function ProviderDrawer({
  provider,
  gapMatches,
  shortlisted,
  onClose,
  onShortlist,
  onRequestAvailability,
}: {
  provider: Provider | null;
  gapMatches: GapMatch[];
  shortlisted: Set<string>;
  onClose: () => void;
  onShortlist: (id: string) => void;
  onRequestAvailability: (name: string) => void;
}) {
  const isOpen   = provider !== null;
  const navigate = useNavigate();
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => { if (provider && scrollRef.current) scrollRef.current.scrollTop = 0; }, [provider?.id]);

  const matchedGaps = useMemo(
    () => gapMatches.filter((g) => provider && g.matched_partner_ids.includes(provider.id)),
    [provider, gapMatches]
  );

  return (
    <>
      <div
        className={`fixed inset-0 z-40 bg-black/60 backdrop-blur-[2px] transition-opacity duration-200 ${
          isOpen ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={onClose}
      />
      <div
        className={`fixed inset-y-0 right-0 z-50 flex w-full flex-col border-l border-gray-800 bg-[#0d1117] shadow-2xl transition-transform duration-300 ease-in-out sm:max-w-[440px] md:max-w-[500px] ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* Header */}
        <div className="flex items-start gap-4 border-b border-gray-800 p-5">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border border-gray-800 bg-[#141820]">
            <Building2 className="h-6 w-6 text-blue-400" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-semibold text-slate-50 leading-tight">{provider?.name ?? "—"}</h2>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              {provider && (
                <Badge className={`inline-flex h-auto rounded px-2 py-0.5 text-[10px] font-medium shadow-none ${statusBadgeClass(provider.status)}`}>
                  {statusLabel(provider.status)}
                </Badge>
              )}
              {provider && provider.rating > 0 && (
                <div className="flex items-center gap-1">
                  <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                  <span className="text-[11px] font-semibold text-slate-300">{provider.rating.toFixed(1)}</span>
                </div>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-[#ffffff10] hover:text-slate-200"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Stats strip */}
        <div className="grid grid-cols-3 divide-x divide-gray-800 border-b border-gray-800">
          {[
            { label: "Courses",  value: String(provider?.course_count ?? "—"),  cls: "text-slate-50" },
            { label: "Bookings", value: String(provider?.booking_count ?? "—"), cls: "text-blue-400" },
            { label: "Gap Matches", value: String(matchedGaps.length),           cls: matchedGaps.length > 0 ? "text-orange-400" : "text-slate-50" },
          ].map(({ label, value, cls }) => (
            <div key={label} className="flex flex-col gap-0.5 px-4 py-3">
              <p className="text-[10px] font-medium text-slate-500">{label}</p>
              <p className={`text-base font-semibold tabular-nums ${cls}`}>{value}</p>
            </div>
          ))}
        </div>

        {/* Scrollable body */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto">

          {/* Overview */}
          <div className="border-b border-gray-800 p-5">
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Overview</p>
            <p className="text-sm leading-relaxed text-slate-400">{provider?.description || "No description available."}</p>
            <div className="mt-4 flex flex-col gap-2">
              {provider?.location && (
                <div className="flex items-center gap-2 text-sm text-slate-400">
                  <MapPin className="h-4 w-4 shrink-0 text-slate-600" />
                  {provider.location}
                </div>
              )}
              {provider?.contact_email && (
                <div className="flex items-center gap-2 text-sm text-slate-400">
                  <Mail className="h-4 w-4 shrink-0 text-slate-600" />
                  <a href={`mailto:${provider.contact_email}`} className="truncate hover:text-blue-400 transition-colors">
                    {provider.contact_email}
                  </a>
                </div>
              )}
              {provider?.website && (
                <div className="flex items-center gap-2 text-sm text-slate-400">
                  <ExternalLink className="h-4 w-4 shrink-0 text-slate-600" />
                  <a href={provider.website} target="_blank" rel="noopener noreferrer" className="truncate hover:text-blue-400 transition-colors">
                    {provider.website}
                  </a>
                </div>
              )}
            </div>
          </div>

          {/* Categories + Accreditation */}
          <div className="border-b border-gray-800 p-5">
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Training Categories</p>
            <div className="flex flex-wrap gap-1.5">
              {(provider?.categories ?? []).map((cat) => (
                <span key={cat} className="rounded bg-gray-800 px-2 py-0.5 text-[11px] text-slate-300">{cat}</span>
              ))}
            </div>
            {provider?.accreditation && (
              <div className="mt-4">
                <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Accreditation</p>
                <div className="flex items-center gap-2">
                  <Shield className="h-4 w-4 shrink-0 text-blue-400" />
                  <span className="text-sm text-slate-300">{provider.accreditation}</span>
                </div>
              </div>
            )}
          </div>

          {/* Delivery methods */}
          <div className="border-b border-gray-800 p-5">
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Delivery Methods</p>
            <div className="flex flex-wrap gap-2">
              {(provider?.delivery_types ?? []).map((d) => (
                <Badge key={d} className={`inline-flex h-auto rounded px-2 py-1 text-xs font-medium shadow-none ${deliveryBadgeClass(d)}`}>
                  {d}
                </Badge>
              ))}
              {(provider?.delivery_types ?? []).length === 0 && (
                <p className="text-sm text-slate-500">Not specified.</p>
              )}
            </div>
          </div>

          {/* Top Courses */}
          <div className="border-b border-gray-800 p-5">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Courses</p>
              <span className="text-[11px] text-slate-500">{provider?.course_count ?? 0} active</span>
            </div>
            {(provider?.top_courses ?? []).length === 0 ? (
              <p className="text-sm text-slate-500">No courses on record.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {(provider?.top_courses ?? []).map((c) => (
                  <div key={c.id} className="flex items-center justify-between gap-3 rounded-lg border border-gray-800 bg-[#0b0e14] px-3 py-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-medium text-slate-200">{c.title}</p>
                      <div className="mt-0.5 flex items-center gap-2">
                        {c.delivery_type && (
                          <Badge className={`inline-flex h-auto rounded px-1.5 py-0.5 text-[9px] font-medium shadow-none ${deliveryBadgeClass(c.delivery_type)}`}>
                            {c.delivery_type}
                          </Badge>
                        )}
                        {c.duration_days > 0 && <span className="text-[10px] text-slate-500">{c.duration_days}d</span>}
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-col items-end">
                      <span className="text-xs font-semibold tabular-nums text-slate-200">{fmtCurrency(c.price, c.currency)}</span>
                      {c.bookings > 0 && <span className="text-[9px] text-slate-500">{c.bookings} booked</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Matched gaps */}
          <div className="border-b border-gray-800 p-5">
            <div className="mb-3 flex items-center gap-2">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Matched Skill Gaps</p>
              {matchedGaps.length > 0 && (
                <span className="rounded-full bg-orange-400/15 px-1.5 py-0.5 text-[9px] font-medium text-orange-400">
                  {matchedGaps.length}
                </span>
              )}
            </div>
            {matchedGaps.length === 0 ? (
              <p className="text-sm text-slate-500">No gaps currently matched to this provider.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {matchedGaps.map((g, i) => (
                  <div key={i} className="flex items-start gap-2.5 rounded-lg border border-gray-800 bg-[#0b0e14] p-3">
                    <AlertTriangle className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${g.risk_level === "critical" ? "text-red-500" : "text-orange-400"}`} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-medium text-slate-200">{g.skill_name}</p>
                      <p className="mt-0.5 text-[10px] text-slate-500">{g.engineers_below} engineers below target</p>
                    </div>
                    <Badge className={`inline-flex h-auto shrink-0 rounded px-1.5 py-0.5 text-[9px] font-medium shadow-none ${riskBadgeClass(g.risk_level)}`}>
                      {g.risk_level}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Local actions */}
          <div className="border-b border-gray-800 p-5">
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Actions</p>
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => { onShortlist(provider!.id); }}
                className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-xs font-semibold transition-colors ${
                  shortlisted.has(provider?.id ?? "")
                    ? "border-blue-500/40 bg-blue-500/15 text-blue-300"
                    : "border-gray-700 bg-[#0b0e14] text-slate-300 hover:border-blue-500/30 hover:bg-[#141820] hover:text-blue-300"
                }`}
              >
                <Star className="h-3.5 w-3.5 shrink-0" />
                {shortlisted.has(provider?.id ?? "") ? "Shortlisted" : "Shortlist Provider"}
              </button>
              <button
                type="button"
                onClick={() => { onRequestAvailability(provider?.name ?? ""); }}
                className="flex items-center gap-2 rounded-lg border border-gray-700 bg-[#0b0e14] px-3 py-2 text-left text-xs font-semibold text-slate-300 transition-colors hover:border-gray-600 hover:bg-[#141820] hover:text-slate-100"
              >
                <Mail className="h-3.5 w-3.5 shrink-0 text-slate-500" />
                Request Availability
              </button>
              <button
                type="button"
                onClick={() => { onClose(); navigate("/training"); }}
                className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-left text-xs font-semibold text-emerald-400 transition-colors hover:bg-emerald-500/20"
              >
                <GraduationCap className="h-3.5 w-3.5 shrink-0" />
                Book Course
              </button>
            </div>
          </div>

          {/* Workflow navigation */}
          <div className="p-5">
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Navigate</p>
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: "View Bookings",     route: "/training"      },
                { label: "View Skills",       route: "/skills-matrix" },
                { label: "View Engineers",    route: "/engineers"     },
                { label: "View Requirements", route: "/requirements"  },
                { label: "View AI Match",     route: "/ai-matching"   },
              ].map(({ label, route }) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => { onClose(); navigate(route); }}
                  className="rounded-lg border border-gray-700 bg-[#111620] px-3 py-2 text-xs font-semibold text-slate-300 transition-colors hover:border-blue-500/40 hover:bg-[#141b2a] hover:text-blue-300"
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export const TrainingProvidersSection = (): JSX.Element => {
  const [providers,   setProviders]   = useState<Provider[]>([]);
  const [gapMatches,  setGapMatches]  = useState<GapMatch[]>([]);
  const [stats,       setStats]       = useState<ProviderStats>({ providerCount: 0, courseCount: 0, openEnquiries: 0, totalBookings: 0 });
  const [loading,     setLoading]     = useState(true);
  const [loadError,   setLoadError]   = useState(false);
  const [tick,        setTick]        = useState(0);

  const [shortlisted, setShortlisted] = useState<Set<string>>(new Set());
  const [toast,       setToast]       = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const handleShortlist = (id: string) => {
    setShortlisted((prev) => {
      const next = new Set(prev);
      const added = !next.has(id);
      if (added) next.add(id); else next.delete(id);
      const p = providers.find((x) => x.id === id);
      showToast(added ? `${p?.name ?? "Provider"} added to shortlist` : `${p?.name ?? "Provider"} removed from shortlist`);
      return next;
    });
  };

  const handleRequestAvailability = (name: string) => {
    showToast(`Availability request sent to ${name}`);
  };

  // Filters
  const [search,          setSearch]          = useState("");
  const [filterDelivery,  setFilterDelivery]  = useState("all");
  const [filterLocation,  setFilterLocation]  = useState("all");
  const [filterStatus,    setFilterStatus]    = useState("all");

  // Selected provider for drawer
  const [selectedProvider, setSelectedProvider] = useState<Provider | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(false);
    fetchProviders().then((payload) => {
      if (cancelled) return;
      if (payload.error) { setLoadError(true); setLoading(false); return; }
      setProviders(payload.providers);
      setGapMatches(payload.gapMatches);
      setStats(payload.stats);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [tick]);

  // ── Derived ───────────────────────────────────────────────────────────────

  const allDeliveryTypes = useMemo(
    () => [...new Set(providers.flatMap((p) => p.delivery_types))].sort(),
    [providers]
  );

  const allLocations = useMemo(
    () => [...new Set(providers.map((p) => p.location))].sort(),
    [providers]
  );

  const filteredProviders = useMemo(() => {
    const lc = search.toLowerCase();
    return providers.filter((p) => {
      if (search && !p.name.toLowerCase().includes(lc) && !p.location.toLowerCase().includes(lc) && !p.categories.some((c) => c.toLowerCase().includes(lc))) return false;
      if (filterDelivery !== "all" && !p.delivery_types.some((d) => d.toLowerCase().includes(filterDelivery.toLowerCase()))) return false;
      if (filterLocation !== "all" && p.location !== filterLocation) return false;
      if (filterStatus !== "all"   && p.status !== filterStatus)     return false;
      return true;
    });
  }, [providers, search, filterDelivery, filterLocation, filterStatus]);

  const hasActiveFilters = !!(search || filterDelivery !== "all" || filterLocation !== "all" || filterStatus !== "all");
  const resetFilters = () => { setSearch(""); setFilterDelivery("all"); setFilterLocation("all"); setFilterStatus("all"); };

  // AI insight banner copy — derived from live gap data
  const aiInsightText = useMemo(() => {
    const critical = gapMatches.filter((g) => g.risk_level === "critical");
    const providerNames = [...new Set(gapMatches.flatMap((g) => g.matched_partner_names))];
    if (critical.length === 0) return null;
    return `Vorta has matched ${critical.length} critical skill gap${critical.length !== 1 ? "s" : ""} — including ${critical.slice(0, 2).map((g) => g.skill_name).join(" and ")} — to ${providerNames.length} approved provider${providerNames.length !== 1 ? "s" : ""}. Prioritise bookings with local providers who have available dates in the next 30 days.`;
  }, [gapMatches]);

  const kpiCards = useMemo(() => [
    {
      label: "Approved Providers",
      value: String(stats.providerCount),
      sub: "Active on approved list",
      icon: Building2,
      valueClass: "text-slate-50",
    },
    {
      label: "Courses Available",
      value: String(stats.courseCount),
      sub: "Across all providers",
      icon: BookOpen,
      valueClass: "text-blue-400",
    },
    {
      label: "Total Bookings",
      value: String(stats.totalBookings),
      sub: "All time",
      icon: GraduationCap,
      valueClass: "text-slate-50",
    },
    {
      label: "Open Enquiries",
      value: String(stats.openEnquiries),
      sub: "Awaiting response",
      icon: TrendingUp,
      valueClass: stats.openEnquiries > 0 ? "text-orange-400" : "text-emerald-400",
    },
  ], [stats]);

  // ─────────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <>
      <section className="relative flex min-w-0 w-full max-w-full flex-1 grow flex-col items-start gap-6 overflow-x-hidden px-4 pb-12 pt-0 md:gap-8 md:px-6 xl:px-8">

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 z-[60] -translate-x-1/2 rounded-xl border border-emerald-500/30 bg-[#0d1117] px-5 py-3 text-sm font-medium text-emerald-400 shadow-2xl">
          {toast}
        </div>
      )}

        {/* ── Header ─────────────────────────────────────────────────────────── */}
        <header className="flex w-full flex-col justify-between gap-4 py-5 lg:flex-row lg:items-center">
          <div className="flex flex-col items-start gap-1">
            <p className="text-xs font-medium text-slate-500">Alpha Manufacturing</p>
            <div className="flex items-center gap-2">
              <h1 className="font-text-xl-semibold text-[length:var(--text-xl-semibold-font-size)] font-[number:var(--text-xl-semibold-font-weight)] leading-[var(--text-xl-semibold-line-height)] tracking-[var(--text-xl-semibold-letter-spacing)] text-slate-50">
                Training Providers
              </h1>
              <ContextHelp content={{
                title: "Training Providers",
                body:  "Approved training partners matched to your site's skill gaps and compliance requirements. Each provider is rated and linked to the skills they cover.",
                usage: "Click a provider card to see their courses and how they match your open skill gaps. Use Add provider to bring new partners into the system.",
                aiNote: "Vorta AI matches providers to your live skill gaps automatically — surfacing the most relevant courses for your highest-risk areas.",
              }} />
            </div>
            <p className="text-sm text-slate-400">Approved training partners matched to your site skill gaps, compliance requirements, and upcoming training demand.</p>
          </div>
          <div className="flex flex-wrap items-center gap-3 self-start lg:self-auto">
            <Button type="button" variant="outline" className="h-auto gap-2 border-[#ffffff20] bg-[#ffffff1a] px-4 py-2 text-sm font-semibold text-slate-50 hover:bg-[#ffffff24] hover:text-slate-50">
              <Download className="h-4 w-4" /> Export list
            </Button>
            <Button type="button" className="h-auto gap-2 bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500">
              <Plus className="h-4 w-4" /> Add provider
            </Button>
            <button type="button" onClick={() => setTick((t) => t + 1)} disabled={loading}
              className="inline-flex h-10 w-10 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-[#ffffff1a] hover:text-slate-200 disabled:opacity-50">
              <RefreshCw className={`h-5 w-5 ${loading ? "animate-spin" : ""}`} />
            </button>
            <button type="button"
              className="inline-flex h-10 w-10 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-[#ffffff1a] hover:text-slate-200">
              <UserCircle className="h-8 w-8" />
            </button>
          </div>
        </header>

        <div className="flex min-w-0 w-full max-w-full flex-col items-start gap-6">

          {/* ── KPI cards ────────────────────────────────────────────────────── */}
          <section className="grid w-full grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {kpiCards.map(({ label, value, sub, icon: Icon, valueClass }) => (
              <Card key={label} className="min-w-0 h-full rounded-xl border border-gray-800 bg-[#141820] shadow-none">
                <CardContent className="flex min-w-0 h-full flex-col gap-3 p-5">
                  <div className="flex min-w-0 items-center justify-between gap-2">
                    <p className="min-w-0 truncate text-xs font-medium text-slate-400">{label}</p>
                    <Icon className="h-4 w-4 shrink-0 text-slate-600" />
                  </div>
                  <p className={`truncate text-xl font-semibold tabular-nums ${valueClass}`}>
                    {loading ? "—" : value}
                  </p>
                  <p className="truncate text-[11px] text-slate-500">{sub}</p>
                </CardContent>
              </Card>
            ))}
          </section>

          {/* ── AI Recommendation Banner ──────────────────────────────────────── */}
          {(loading || aiInsightText) && (
            <div className="w-full rounded-xl border border-blue-500/20 bg-[#3b82f608] p-5">
              {loading ? (
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 h-5 w-5 animate-pulse rounded bg-gray-800" />
                  <div className="flex-1 space-y-2">
                    <SkeletonLine w="w-48" />
                    <SkeletonLine w="w-full" h="h-3" />
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex items-start gap-3">
                    <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-blue-400" />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-sm font-semibold text-blue-300">AI Provider Recommendations</p>
                        <Badge className="inline-flex h-auto items-center gap-1 rounded bg-[#3b82f620] px-2 py-0.5 text-[10px] font-medium text-blue-400 shadow-none hover:bg-[#3b82f620]">
                          <span className="h-1.5 w-1.5 rounded-full bg-blue-400" />Live
                        </Badge>
                      </div>
                      <p className="text-sm leading-relaxed text-slate-400">{aiInsightText}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="shrink-0 rounded-lg border border-blue-500/30 px-4 py-2 text-sm font-medium text-blue-400 transition-colors hover:bg-blue-500/10 hover:border-blue-500/50"
                  >
                    View recommendations
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ── Error state ──────────────────────────────────────────────────── */}
          {loadError && (
            <div className="flex w-full flex-col items-center gap-3 rounded-xl border border-red-500/20 bg-[#ef444408] py-10 text-center">
              <AlertTriangle className="h-7 w-7 text-red-500/60" />
              <div>
                <p className="font-medium text-red-400">Failed to load provider data</p>
                <p className="mt-1 text-sm text-slate-500">Unable to connect to the database.</p>
              </div>
              <button type="button" onClick={() => setTick((t) => t + 1)}
                className="rounded-lg border border-red-500/20 px-4 py-2 text-sm font-medium text-red-400 transition-colors hover:bg-red-500/10">
                Try again
              </button>
            </div>
          )}

          {!loadError && (
            <>
              {/* ── Filters ────────────────────────────────────────────────────── */}
              <div className="flex w-full flex-wrap items-center gap-2">
                <div className="relative min-w-[180px] flex-1 sm:max-w-xs">
                  <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
                  <input
                    type="text"
                    placeholder="Search providers…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="h-9 w-full rounded-lg border border-gray-800 bg-[#141820] pl-8 pr-3 text-sm text-slate-200 placeholder:text-slate-600 focus:border-blue-500/50 focus:outline-none focus:ring-1 focus:ring-blue-500/30"
                  />
                </div>
                <Select
                  value={filterDelivery}
                  onChange={setFilterDelivery}
                  options={[{ value: "all", label: "All Delivery" }, ...allDeliveryTypes.map((d) => ({ value: d, label: d }))]}
                  placeholder="All Delivery"
                  size="sm"
                  className="h-9"
                />
                <Select
                  value={filterLocation}
                  onChange={setFilterLocation}
                  options={[{ value: "all", label: "All Locations" }, ...allLocations.map((l) => ({ value: l, label: l }))]}
                  placeholder="All Locations"
                  size="md"
                  className="h-9"
                />
                <Select
                  value={filterStatus}
                  onChange={setFilterStatus}
                  options={[
                    { value: "all",       label: "All Statuses"  },
                    { value: "active",    label: "Approved"      },
                    { value: "preferred", label: "Preferred"     },
                    { value: "pending",   label: "Pending Review" },
                  ]}
                  placeholder="All Statuses"
                  size="sm"
                  className="h-9"
                />
                {hasActiveFilters && (
                  <button type="button" onClick={resetFilters}
                    className="flex items-center gap-1 text-xs font-medium text-slate-500 transition-colors hover:text-slate-200">
                    <X className="h-3 w-3" /> Clear
                  </button>
                )}
              </div>

              {/* ── Desktop table ─────────────────────────────────────────────── */}
              <div className="hidden w-full overflow-x-auto rounded-xl border border-gray-800 md:block">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-gray-800 bg-[#0f1318]">
                      {[
                        { label: "Provider",     cls: "min-w-[220px]" },
                        { label: "Location",     cls: "min-w-[130px]" },
                        { label: "Delivery",     cls: "min-w-[160px]" },
                        { label: "Courses",      cls: "min-w-[80px] text-center" },
                        { label: "Bookings",     cls: "min-w-[80px] text-center" },
                        { label: "Rating",       cls: "min-w-[90px]" },
                        { label: "Accreditation",cls: "min-w-[160px]" },
                        { label: "Status",       cls: "min-w-[120px]" },
                        { label: "Actions",      cls: "min-w-[140px] text-right" },
                      ].map(({ label, cls }) => (
                        <th key={label} className={`px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-500 ${cls}`}>
                          {label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {loading
                      ? Array.from({ length: 3 }).map((_, i) => (
                          <tr key={i} className="border-b border-gray-800/50 bg-[#141820]">
                            {Array.from({ length: 9 }).map((_, j) => (
                              <td key={j} className="px-4 py-4">
                                <div className="h-4 w-20 animate-pulse rounded bg-gray-800" />
                              </td>
                            ))}
                          </tr>
                        ))
                      : filteredProviders.length === 0
                      ? (
                          <tr>
                            <td colSpan={9} className="py-16 text-center">
                              <div className="flex flex-col items-center gap-2">
                                <Building2 className="h-8 w-8 text-slate-700" />
                                <p className="text-sm font-medium text-slate-400">No providers found</p>
                                {hasActiveFilters && (
                                  <button type="button" onClick={resetFilters} className="text-xs font-medium text-blue-400 hover:underline">
                                    Clear filters
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        )
                      : filteredProviders.map((p, idx) => {
                          const rowBg = idx % 2 === 0 ? "bg-[#141820]" : "bg-[#111620]";
                          return (
                            <tr
                              key={p.id}
                              onClick={() => setSelectedProvider(p)}
                              className={`cursor-pointer border-b border-gray-800/50 ${rowBg} transition-colors hover:bg-[#1a2030]`}
                            >
                              <td className="px-4 py-3">
                                <div className="flex flex-col gap-0.5">
                                  <span className="font-medium text-slate-200">{p.name}</span>
                                  <span className="text-[11px] text-slate-500">{p.categories.slice(0, 2).join(", ")}</span>
                                </div>
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-1.5 text-sm text-slate-400">
                                  <MapPin className="h-3.5 w-3.5 shrink-0 text-slate-600" />
                                  {p.location}
                                </div>
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex flex-wrap gap-1">
                                  {p.delivery_types.map((d) => (
                                    <Badge key={d} className={`inline-flex h-auto rounded px-1.5 py-0.5 text-[10px] font-medium shadow-none ${deliveryBadgeClass(d)}`}>
                                      {d}
                                    </Badge>
                                  ))}
                                </div>
                              </td>
                              <td className="px-4 py-3 text-center">
                                <span className="text-sm font-semibold tabular-nums text-blue-400">{p.course_count}</span>
                              </td>
                              <td className="px-4 py-3 text-center">
                                <span className="text-sm font-semibold tabular-nums text-slate-200">{p.booking_count}</span>
                              </td>
                              <td className="px-4 py-3">
                                <StarRating rating={p.rating} />
                              </td>
                              <td className="px-4 py-3">
                                {p.accreditation !== "—" ? (
                                  <div className="flex items-center gap-1.5">
                                    <Shield className="h-3.5 w-3.5 shrink-0 text-blue-400" />
                                    <span className="text-sm text-slate-400">{p.accreditation}</span>
                                  </div>
                                ) : (
                                  <span className="text-sm text-slate-500">—</span>
                                )}
                              </td>
                              <td className="px-4 py-3">
                                <Badge className={`inline-flex h-auto rounded px-2 py-0.5 text-[10px] font-medium shadow-none ${statusBadgeClass(p.status)}`}>
                                  {statusLabel(p.status)}
                                </Badge>
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex items-center justify-end gap-2">
                                  <button
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); setSelectedProvider(p); }}
                                    className="rounded-lg border border-gray-700 px-2.5 py-1 text-[10px] font-medium text-slate-400 transition-colors hover:border-gray-600 hover:bg-[#ffffff0a] hover:text-slate-200"
                                  >
                                    View
                                  </button>
                                  <button
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); setSelectedProvider(p); }}
                                    className="rounded-lg border border-blue-500/30 px-2.5 py-1 text-[10px] font-medium text-blue-400 transition-colors hover:bg-blue-500/10"
                                  >
                                    Book course
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                  </tbody>
                </table>
              </div>

              {/* ── Mobile / tablet cards ─────────────────────────────────────── */}
              <div className="flex w-full flex-col gap-4 md:hidden">
                {loading
                  ? Array.from({ length: 3 }).map((_, i) => (
                      <Card key={i} className="min-w-0 rounded-xl border border-gray-800 bg-[#141820] shadow-none">
                        <CardContent className="flex flex-col gap-3 p-5">
                          <SkeletonLine w="w-48" />
                          <SkeletonLine w="w-32" h="h-3" />
                          <div className="flex gap-2">
                            <div className="h-5 w-16 animate-pulse rounded bg-gray-800" />
                            <div className="h-5 w-16 animate-pulse rounded bg-gray-800" />
                          </div>
                        </CardContent>
                      </Card>
                    ))
                  : filteredProviders.length === 0
                  ? (
                      <div className="flex flex-col items-center gap-3 rounded-xl border border-gray-800 py-12 text-center">
                        <Building2 className="h-8 w-8 text-slate-700" />
                        <p className="text-sm text-slate-500">No providers found.</p>
                      </div>
                    )
                  : filteredProviders.map((p) => (
                      <Card
                        key={p.id}
                        onClick={() => setSelectedProvider(p)}
                        className="min-w-0 cursor-pointer rounded-xl border border-gray-800 bg-[#141820] shadow-none transition-colors hover:border-gray-700 hover:bg-[#1a2030]"
                      >
                        <CardContent className="flex flex-col gap-4 p-5">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <p className="font-semibold text-slate-200">{p.name}</p>
                              <p className="mt-0.5 text-xs text-slate-500">{p.categories.slice(0, 2).join(", ")}</p>
                            </div>
                            <Badge className={`inline-flex h-auto shrink-0 rounded px-2 py-0.5 text-[10px] font-medium shadow-none ${statusBadgeClass(p.status)}`}>
                              {statusLabel(p.status)}
                            </Badge>
                          </div>

                          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400">
                            <span className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5 text-slate-600" />{p.location}</span>
                            <span className="flex items-center gap-1.5"><BookOpen className="h-3.5 w-3.5 text-slate-600" />{p.course_count} courses</span>
                            {p.rating > 0 && (
                              <span className="flex items-center gap-1">
                                <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />
                                {p.rating.toFixed(1)}
                              </span>
                            )}
                          </div>

                          <div className="flex flex-wrap gap-1.5">
                            {p.delivery_types.map((d) => (
                              <Badge key={d} className={`inline-flex h-auto rounded px-2 py-0.5 text-[10px] font-medium shadow-none ${deliveryBadgeClass(d)}`}>
                                {d}
                              </Badge>
                            ))}
                          </div>

                          {p.accreditation && p.accreditation !== "—" && (
                            <div className="flex items-center gap-1.5 text-xs text-slate-400">
                              <Shield className="h-3.5 w-3.5 shrink-0 text-blue-400" />
                              {p.accreditation}
                            </div>
                          )}

                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); setSelectedProvider(p); }}
                              className="flex-1 rounded-lg border border-gray-700 py-2 text-xs font-medium text-slate-400 transition-colors hover:border-gray-600 hover:bg-[#ffffff0a] hover:text-slate-200"
                            >
                              View details
                            </button>
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); setSelectedProvider(p); }}
                              className="flex-1 rounded-lg border border-blue-500/30 py-2 text-xs font-medium text-blue-400 transition-colors hover:bg-blue-500/10"
                            >
                              Book course
                            </button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
              </div>

              {/* ── Matched to Skills Gaps ────────────────────────────────────── */}
              {(loading || gapMatches.length > 0) && (
                <Card className="min-w-0 w-full rounded-xl border border-gray-800 bg-[#141820] shadow-none">
                  <CardContent className="flex min-w-0 flex-col gap-4 p-5">
                    <div className="flex items-center gap-2">
                      <h2 className="font-semibold text-slate-50">Matched to Skill Gaps</h2>
                      <Badge className="inline-flex h-auto items-center gap-1.5 rounded bg-[#3b82f620] px-2 py-1 text-xs font-medium text-blue-500 shadow-none hover:bg-[#3b82f620]">
                        <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />Live
                      </Badge>
                    </div>
                    <p className="text-sm text-slate-400">Critical and high-priority skill gaps matched to approved providers based on training category alignment.</p>

                    <div className="grid w-full grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                      {loading
                        ? Array.from({ length: 6 }).map((_, i) => (
                            <div key={i} className="rounded-xl border border-gray-800 bg-[#0b0e14] p-4">
                              <SkeletonLine w="w-36" />
                              <div className="mt-2 space-y-1.5">
                                <SkeletonLine w="w-full" h="h-3" />
                                <SkeletonLine w="w-24" h="h-3" />
                              </div>
                            </div>
                          ))
                        : gapMatches.map((gap, i) => (
                            <div key={i} className="flex flex-col gap-3 rounded-xl border border-gray-800 bg-[#0b0e14] p-4">
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <p className="truncate font-medium text-slate-200">{gap.skill_name}</p>
                                  <p className="mt-0.5 text-[11px] text-slate-500">{gap.category}</p>
                                </div>
                                <Badge className={`inline-flex h-auto shrink-0 rounded px-2 py-0.5 text-[10px] font-medium shadow-none ${riskBadgeClass(gap.risk_level)}`}>
                                  {gap.risk_level}
                                </Badge>
                              </div>

                              <div className="flex items-center gap-2 text-[11px] text-slate-500">
                                <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-orange-400" />
                                <span>{gap.engineers_below} engineers below target</span>
                                {gap.single_point_of_failure && (
                                  <Badge className="inline-flex h-auto rounded bg-[#ef444420] px-1 py-0.5 text-[9px] font-medium text-red-500 shadow-none hover:bg-[#ef444420]">
                                    SPOF
                                  </Badge>
                                )}
                              </div>

                              {gap.matched_partner_names.length > 0 ? (
                                <div className="flex flex-col gap-1.5">
                                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Matched Providers</p>
                                  {gap.matched_partner_names.map((name, j) => {
                                    const provider = providers.find((p) => p.name === name);
                                    return (
                                      <div key={j} className="flex items-center justify-between gap-2">
                                        <div className="flex items-center gap-1.5 min-w-0">
                                          <Building2 className="h-3.5 w-3.5 shrink-0 text-blue-400" />
                                          <span className="truncate text-[11px] text-slate-300">{name}</span>
                                        </div>
                                        {provider && (
                                          <button
                                            type="button"
                                            onClick={() => setSelectedProvider(provider)}
                                            className="shrink-0 text-[10px] font-medium text-blue-400 hover:underline"
                                          >
                                            View
                                          </button>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              ) : (
                                <p className="text-[11px] text-slate-500">No approved provider matched for this category.</p>
                              )}

                              <button
                                type="button"
                                onClick={() => { const p = providers.find((x) => gap.matched_partner_ids.includes(x.id)); if (p) setSelectedProvider(p); }}
                                className="mt-auto rounded-lg border border-blue-500/30 py-1.5 text-xs font-medium text-blue-400 transition-colors hover:bg-blue-500/10"
                              >
                                Book training
                              </button>
                            </div>
                          ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          )}

        </div>
      </section>

      {/* ── Provider Detail Drawer ──────────────────────────────────────────── */}
      <ProviderDrawer
        provider={selectedProvider}
        gapMatches={gapMatches}
        shortlisted={shortlisted}
        onClose={() => setSelectedProvider(null)}
        onShortlist={handleShortlist}
        onRequestAvailability={handleRequestAvailability}
      />
    </>
  );
};
