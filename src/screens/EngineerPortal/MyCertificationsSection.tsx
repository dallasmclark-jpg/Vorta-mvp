import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Award,
  BookOpen,
  CheckCircle2,
  Clock,
  Download,
  GraduationCap,
  MessageSquare,
  RefreshCw,
  Shield,
  Sparkles,
  TrendingUp,
  Upload,
  XCircle,
  Zap,
} from "lucide-react";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Card, CardContent } from "../../components/ui/card";
import { Progress } from "../../components/ui/progress";
import { AiActionsPanel, AiAction } from "../../components/AiActionsPanel";
import { ExplainWithAi } from "../../components/ExplainWithAi";
import { SyncIndicator } from "../../components/SyncIndicator";
import { supabase } from "../../lib/supabaseClient";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Cert {
  id: string;
  skill_name: string;
  category: string;
  issued_date: string | null;
  expiry_date: string | null;
  status: "Valid" | "Expiring Soon" | "Expiring" | "Expired";
  validation_status: "validated" | "pending" | "not_uploaded";
  cert_available: boolean;
  linked_training: string | null;
}

// ─── Mock data ────────────────────────────────────────────────────────────────

const MOCK_CERTS: Cert[] = [
  { id: "1", skill_name: "PSSR Pressure Systems",        category: "Compliance",     issued_date: "2022-09-14", expiry_date: "2025-09-14", status: "Expiring Soon", validation_status: "validated",    cert_available: true,  linked_training: "PSSR Refresher" },
  { id: "2", skill_name: "Confined Space Entry",         category: "Safety",         issued_date: "2023-05-12", expiry_date: "2025-07-30", status: "Expiring Soon", validation_status: "validated",    cert_available: true,  linked_training: "Confined Space Refresher" },
  { id: "3", skill_name: "Manual Handling",              category: "Safety",         issued_date: "2022-11-01", expiry_date: "2024-11-01", status: "Expired",       validation_status: "validated",    cert_available: true,  linked_training: "Manual Handling Renewal" },
  { id: "4", skill_name: "Electrical Safety LV",        category: "Electrical",     issued_date: "2023-03-15", expiry_date: "2026-03-15", status: "Valid",         validation_status: "validated",    cert_available: true,  linked_training: null },
  { id: "5", skill_name: "GMP Fundamentals",             category: "Pharmaceutical", issued_date: "2023-12-01", expiry_date: "2025-12-01", status: "Valid",         validation_status: "validated",    cert_available: true,  linked_training: null },
  { id: "6", skill_name: "ATEX Zone Classification",    category: "Electrical",     issued_date: null,         expiry_date: null,         status: "Expired",       validation_status: "not_uploaded", cert_available: false, linked_training: "ATEX Zone Certification" },
  { id: "7", skill_name: "Vibration Analysis Level I",  category: "Predictive",     issued_date: "2022-06-20", expiry_date: "2025-06-20", status: "Expiring Soon", validation_status: "pending",      cert_available: false, linked_training: "Vibration Analysis II" },
  { id: "8", skill_name: "Hydraulic Systems",           category: "Mechanical",     issued_date: "2022-09-03", expiry_date: "2026-09-03", status: "Valid",         validation_status: "pending",      cert_available: false, linked_training: null },
];

const AI_ACTIONS: AiAction[] = [
  { label: "Renew Manual Handling Certificate",    description: "Expired Nov 2024. Required for site compliance. Book renewal training before audit deadline.",      priority: "critical", icon: AlertTriangle },
  { label: "Renew Confined Space Entry",           description: "Expires 30 Jul 2025. Book refresher now — spaces are limited with Safety Pro Ltd.",                 priority: "critical", icon: Zap           },
  { label: "Complete ATEX Certification",          description: "No cert on record. Closes a critical skill gap and adds +9 pts to your AI match score.",           priority: "high",     icon: Shield        },
  { label: "Upload Vibration Analysis evidence",   description: "Cert marked pending. Upload evidence to validate your Level I status and unlock Level II booking.", priority: "medium",   icon: Upload        },
  { label: "Book Vibration Analysis Level II",     description: "Level II certification supports progression to Predictive Maintenance Specialist role.",            priority: "low",      icon: TrendingUp    },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function daysLeft(expiry: string | null): number {
  if (!expiry) return -9999;
  return Math.floor((new Date(expiry).getTime() - Date.now()) / 86_400_000);
}

function fmtDate(d: string | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function certStatusClass(s: string): string {
  switch (s) {
    case "Valid":         return "bg-[#10b98120] text-emerald-400";
    case "Expiring Soon": return "bg-[#f9731620] text-orange-400";
    case "Expiring":      return "bg-[#facc1520] text-yellow-400";
    case "Expired":       return "bg-[#ef444420] text-red-400";
    default:              return "bg-gray-800 text-slate-400";
  }
}

function validationClass(v: string): string {
  if (v === "validated")    return "bg-[#10b98120] text-emerald-400";
  if (v === "pending")      return "bg-[#facc1520] text-yellow-400";
  return "bg-gray-800 text-slate-500";
}

function validationLabel(v: string): string {
  if (v === "validated")    return "Validated";
  if (v === "pending")      return "Pending";
  return "Not uploaded";
}

function expiryColor(d: number): string {
  if (d < 0)   return "text-red-400";
  if (d <= 30) return "text-orange-400";
  if (d <= 90) return "text-yellow-400";
  return "text-slate-400";
}

function complianceScore(certs: Cert[]): number {
  if (!certs.length) return 100;
  const valid = certs.filter((c) => c.status === "Valid" || c.status === "Expiring").length;
  return Math.round((valid / certs.length) * 100);
}

function SkelLine({ w = "w-24", h = "h-3" }: { w?: string; h?: string }) {
  return <div className={`${h} ${w} animate-pulse rounded bg-gray-800`} />;
}

function SectionCard({ title, sub, badge, children }: {
  title: string; sub?: string; badge?: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <Card className="min-w-0 w-full rounded-xl border border-gray-800 bg-[#141820] shadow-none">
      <CardContent className="flex min-w-0 flex-col gap-4 p-5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex flex-col gap-0.5">
            <h2 className="text-sm font-semibold text-slate-200">{title}</h2>
            {sub && <p className="text-[11px] text-slate-500">{sub}</p>}
          </div>
          {badge}
        </div>
        {children}
      </CardContent>
    </Card>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export function MyCertificationsSection(): JSX.Element {
  const [certs,   setCerts]   = useState<Cert[]>([]);
  const [loading, setLoading] = useState(true);
  const [tick,    setTick]    = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const { data } = await supabase.functions.invoke("engineers-data");
        if (cancelled) return;
        const raw = (data?.engineers?.[0]?.certifications ?? []) as Array<{
          skill_name: string; category: string; expiry_date: string | null; verification_status: string;
        }>;
        if (raw.length) {
          const mapped: Cert[] = raw.map((c, i) => {
            const d = daysLeft(c.expiry_date);
            let status: Cert["status"] = "Valid";
            if (c.verification_status === "expired" || d < 0) status = "Expired";
            else if (d <= 30) status = "Expiring Soon";
            else if (d <= 90) status = "Expiring";
            return {
              id: String(i),
              skill_name: c.skill_name,
              category: c.category,
              issued_date: null,
              expiry_date: c.expiry_date,
              status,
              validation_status: (c.verification_status === "validated" ? "validated" : c.verification_status === "pending" ? "pending" : "not_uploaded") as Cert["validation_status"],
              cert_available: c.verification_status === "validated",
              linked_training: null,
            };
          });
          setCerts(mapped);
        } else {
          setCerts(MOCK_CERTS);
        }
      } catch {
        if (!cancelled) setCerts(MOCK_CERTS);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [tick]);

  // ── Derived ───────────────────────────────────────────────────────────────

  const valid     = useMemo(() => certs.filter((c) => c.status === "Valid"),                          [certs]);
  const expiring  = useMemo(() => certs.filter((c) => c.status === "Expiring Soon" || c.status === "Expiring"), [certs]);
  const expired   = useMemo(() => certs.filter((c) => c.status === "Expired"),                        [certs]);
  const pending   = useMemo(() => certs.filter((c) => c.validation_status === "pending"),             [certs]);
  const score     = useMemo(() => (loading ? 0 : complianceScore(certs)),                             [certs, loading]);

  const recentlyAdded = useMemo(() =>
    [...certs]
      .filter((c) => c.issued_date)
      .sort((a, b) => new Date(b.issued_date!).getTime() - new Date(a.issued_date!).getTime())
      .slice(0, 4),
    [certs]
  );

  const kpis = [
    { label: "Valid",              value: String(valid.length),    sub: "Current & active",           icon: CheckCircle2, cls: "text-emerald-400"    },
    { label: "Expiring Soon",      value: String(expiring.length), sub: "Within 90 days",             icon: Clock,        cls: expiring.length > 0 ? "text-orange-400"  : "text-emerald-400" },
    { label: "Expired",            value: String(expired.length),  sub: "Require renewal",            icon: XCircle,      cls: expired.length  > 0 ? "text-red-400"     : "text-emerald-400" },
    { label: "Pending Validation", value: String(pending.length),  sub: "Awaiting sign-off",          icon: Shield,       cls: pending.length  > 0 ? "text-yellow-400"  : "text-emerald-400" },
    { label: "Compliance Score",   value: loading ? "—" : `${score}%`, sub: `${certs.length} certs tracked`, icon: Sparkles, cls: score >= 80 ? "text-emerald-400" : score >= 60 ? "text-yellow-400" : "text-red-400" },
  ];

  return (
    <section className="flex min-w-0 w-full flex-col gap-6 overflow-x-hidden px-4 pb-12 pt-5 md:px-6 xl:px-8">

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-1 min-w-0">
          <h1 className="text-xl font-semibold text-slate-50">My Certifications</h1>
          <p className="text-sm text-slate-400">Track your certificates, expiry dates and compliance status.</p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <SyncIndicator />
          <ExplainWithAi pageId="engineer-certifications" />
          <button
            type="button"
            onClick={() => setTick((t) => t + 1)}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-gray-700 bg-transparent px-3 text-xs font-medium text-slate-400 transition-colors hover:border-gray-600 hover:text-slate-200"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
      </header>

      {/* ── Compliance score bar ─────────────────────────────────────────────── */}
      {!loading && (
        <div className="flex items-center gap-4 rounded-xl border border-gray-800 bg-[#141820] px-5 py-4">
          <Shield className="h-5 w-5 shrink-0 text-slate-500" />
          <div className="flex flex-1 flex-col gap-1.5 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-semibold text-slate-300">Certification Compliance</p>
              <span className={`text-sm font-bold tabular-nums ${score >= 80 ? "text-emerald-400" : score >= 60 ? "text-yellow-400" : "text-red-400"}`}>
                {score}%
              </span>
            </div>
            <Progress
              value={score}
              className={`h-2 bg-gray-800 ${score >= 80 ? "[&>div]:bg-emerald-500" : score >= 60 ? "[&>div]:bg-yellow-400" : "[&>div]:bg-red-500"}`}
            />
            <p className="text-[11px] text-slate-500">
              {valid.length} valid · {expiring.length} expiring · {expired.length} expired · {pending.length} pending validation
            </p>
          </div>
        </div>
      )}

      {/* ── KPI strip ───────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {kpis.map(({ label, value, sub, icon: Icon, cls }) => (
          <Card key={label} className="min-w-0 rounded-xl border border-gray-800 bg-[#141820] shadow-none">
            <CardContent className="flex flex-col gap-3 p-4 xl:p-5">
              <div className="flex items-center justify-between gap-2">
                <p className="min-w-0 truncate text-xs font-medium text-slate-400">{label}</p>
                <Icon className="h-4 w-4 shrink-0 text-slate-600" />
              </div>
              <p className={`truncate text-xl font-semibold tabular-nums ${cls}`}>
                {loading ? "—" : value}
              </p>
              <p className="truncate text-[11px] text-slate-500">{sub}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ── AI Actions ──────────────────────────────────────────────────────── */}
      {!loading && <AiActionsPanel actions={AI_ACTIONS} />}

      {/* ── Certification Register ───────────────────────────────────────────── */}
      <SectionCard
        title="Certification Register"
        sub="All certificates, licences and compliance evidence"
        badge={
          <span className="text-[11px] text-slate-500">{loading ? "—" : `${certs.length} records`}</span>
        }
      >
        <div className="w-full overflow-x-auto rounded-lg border border-gray-800">
          <table className="w-max min-w-[820px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-gray-800 bg-[#0f1318]">
                {["Certificate / Skill", "Category", "Issued", "Expiry", "Status", "Validation", "Evidence", "Actions"].map((h) => (
                  <th key={h} className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-500 whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading
                ? Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="border-b border-gray-800/50 bg-[#141820]">
                      {Array.from({ length: 8 }).map((_, j) => (
                        <td key={j} className="px-4 py-3"><SkelLine /></td>
                      ))}
                    </tr>
                  ))
                : certs.length === 0
                ? (
                    <tr>
                      <td colSpan={8} className="py-10 text-center text-sm text-slate-500">
                        No certifications on record.
                      </td>
                    </tr>
                  )
                : certs.map((c, i) => {
                    const d = daysLeft(c.expiry_date);
                    return (
                      <tr key={c.id} className={`border-b border-gray-800/50 transition-colors hover:bg-[#1a2030] ${i % 2 === 0 ? "bg-[#141820]" : "bg-[#111520]"}`}>
                        <td className="px-4 py-3 max-w-[200px]">
                          <span className="block truncate text-xs font-medium text-slate-200">{c.skill_name}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-[11px] text-slate-400">{c.category}</span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-xs text-slate-400">{fmtDate(c.issued_date)}</td>
                        <td className="px-4 py-3">
                          <div className="flex flex-col gap-0.5">
                            <span className={`text-xs font-medium whitespace-nowrap ${expiryColor(d)}`}>{fmtDate(c.expiry_date)}</span>
                            {c.expiry_date && (
                              <span className={`text-[10px] ${expiryColor(d)}`}>
                                {d < 0 ? `${Math.abs(d)}d overdue` : `${d}d remaining`}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <Badge className={`inline-flex h-auto rounded px-2 py-0.5 text-[10px] font-medium shadow-none ${certStatusClass(c.status)}`}>
                            {c.status}
                          </Badge>
                        </td>
                        <td className="px-4 py-3">
                          <Badge className={`inline-flex h-auto rounded px-2 py-0.5 text-[10px] font-medium shadow-none ${validationClass(c.validation_status)}`}>
                            {validationLabel(c.validation_status)}
                          </Badge>
                        </td>
                        <td className="px-4 py-3">
                          {c.cert_available ? (
                            <button type="button" title="Download certificate"
                              className="inline-flex items-center gap-1 text-[11px] font-medium text-blue-400 transition-colors hover:text-blue-300">
                              <Download className="h-3 w-3" /> Download
                            </button>
                          ) : (
                            <button type="button" title="Upload evidence"
                              className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 transition-colors hover:text-slate-300">
                              <Upload className="h-3 w-3" /> Upload
                            </button>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5">
                            {(c.status === "Expired" || c.status === "Expiring Soon") && c.linked_training && (
                              <button type="button" title="Book renewal training"
                                className="rounded border border-gray-700 px-2 py-0.5 text-[10px] font-medium text-slate-400 transition-colors hover:border-blue-500/40 hover:text-blue-400 whitespace-nowrap">
                                Book
                              </button>
                            )}
                            {c.validation_status === "not_uploaded" && (
                              <button type="button" title="Upload evidence"
                                className="rounded border border-gray-700 px-2 py-0.5 text-[10px] font-medium text-slate-400 transition-colors hover:border-emerald-500/40 hover:text-emerald-400 whitespace-nowrap">
                                Upload
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
            </tbody>
          </table>
        </div>
      </SectionCard>

      {/* ── Expiring Soon + Pending Validation (2-col on lg) ─────────────────── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">

        {/* Expiring Soon */}
        <SectionCard
          title="Expiring Soon"
          sub="Certificates expiring within 90 days"
          badge={
            expiring.length > 0 ? (
              <Badge className="inline-flex h-auto shrink-0 rounded bg-[#f9731620] px-2 py-0.5 text-[10px] font-medium text-orange-400 shadow-none hover:bg-[#f9731620]">
                {expiring.length} at risk
              </Badge>
            ) : null
          }
        >
          {loading ? (
            <div className="flex flex-col gap-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 rounded-lg border border-gray-800 p-3">
                  <div className="h-7 w-7 animate-pulse rounded-lg bg-gray-800 shrink-0" />
                  <div className="flex flex-1 flex-col gap-1.5"><SkelLine w="w-40" /><SkelLine w="w-24" h="h-2.5" /></div>
                </div>
              ))}
            </div>
          ) : expiring.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-8 text-center">
              <CheckCircle2 className="h-8 w-8 text-emerald-400/40" />
              <p className="text-sm font-medium text-emerald-400">No certs expiring within 90 days</p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {[...expiring].sort((a, b) => daysLeft(a.expiry_date) - daysLeft(b.expiry_date)).map((c) => {
                const d = daysLeft(c.expiry_date);
                const urgency = d <= 30 ? "border-[#f9731630] bg-[#f9731608]" : "border-[#facc1530] bg-[#facc1508]";
                return (
                  <div key={c.id} className={`flex items-start gap-3 rounded-lg border ${urgency} px-4 py-3`}>
                    <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${d <= 30 ? "bg-[#f9731620]" : "bg-[#facc1520]"}`}>
                      <Clock className={`h-3.5 w-3.5 ${d <= 30 ? "text-orange-400" : "text-yellow-400"}`} />
                    </div>
                    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <p className="truncate text-xs font-medium text-slate-200">{c.skill_name}</p>
                      <div className="flex flex-wrap items-center gap-2 mt-0.5">
                        <span className="text-[11px] text-slate-500">{c.category}</span>
                        <span className={`text-[11px] font-medium ${expiryColor(d)}`}>
                          {fmtDate(c.expiry_date)} · {d}d remaining
                        </span>
                      </div>
                    </div>
                    <button type="button"
                      className="shrink-0 rounded border border-gray-700 px-2.5 py-1 text-[10px] font-medium text-slate-400 transition-colors hover:border-blue-500/40 hover:text-blue-400 whitespace-nowrap">
                      {c.linked_training ? "Book Renewal" : "View"}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </SectionCard>

        {/* Pending Validation */}
        <SectionCard
          title="Pending Validation"
          sub="Uploaded certificates awaiting manager or admin sign-off"
          badge={
            pending.length > 0 ? (
              <Badge className="inline-flex h-auto shrink-0 rounded bg-[#facc1520] px-2 py-0.5 text-[10px] font-medium text-yellow-400 shadow-none hover:bg-[#facc1520]">
                {pending.length} waiting
              </Badge>
            ) : null
          }
        >
          {loading ? (
            <div className="flex flex-col gap-3">
              {Array.from({ length: 2 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 rounded-lg border border-gray-800 p-3">
                  <div className="h-7 w-7 animate-pulse rounded-lg bg-gray-800 shrink-0" />
                  <div className="flex flex-1 flex-col gap-1.5"><SkelLine w="w-40" /><SkelLine w="w-28" h="h-2.5" /></div>
                  <SkelLine w="w-16" h="h-5" />
                </div>
              ))}
            </div>
          ) : pending.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-8 text-center">
              <CheckCircle2 className="h-8 w-8 text-emerald-400/40" />
              <p className="text-sm font-medium text-emerald-400">Nothing pending validation</p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {pending.map((c) => (
                <div key={c.id} className="flex items-start gap-3 rounded-lg border border-[#facc1520] bg-[#facc1508] px-4 py-3">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#facc1520]">
                    <Shield className="h-3.5 w-3.5 text-yellow-400" />
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <p className="truncate text-xs font-medium text-slate-200">{c.skill_name}</p>
                    <span className="text-[11px] text-slate-500">{c.category}</span>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Badge className="inline-flex h-auto rounded bg-[#facc1520] px-2 py-0.5 text-[10px] font-medium text-yellow-400 shadow-none hover:bg-[#facc1520]">
                      Pending
                    </Badge>
                    <button type="button"
                      className="rounded border border-gray-700 px-2.5 py-1 text-[10px] font-medium text-slate-400 transition-colors hover:border-blue-500/40 hover:text-blue-400 whitespace-nowrap">
                      Chase
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      </div>

      {/* ── Recently Added + AI Recommendations (2-col on xl) ────────────────── */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">

        {/* Recently Added */}
        <SectionCard title="Recently Added" sub="Most recently uploaded or validated certificates">
          {loading ? (
            <div className="divide-y divide-gray-800/60">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 py-3">
                  <div className="h-7 w-7 animate-pulse rounded-lg bg-gray-800 shrink-0" />
                  <div className="flex flex-1 flex-col gap-1.5"><SkelLine w="w-36" /><SkelLine w="w-20" h="h-2.5" /></div>
                </div>
              ))}
            </div>
          ) : recentlyAdded.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-8 text-center">
              <Award className="h-8 w-8 text-slate-700" />
              <p className="text-sm text-slate-500">No recently added certifications.</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-800/60">
              {recentlyAdded.map((c) => (
                <div key={c.id} className="flex items-center gap-3 py-3">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#10b98115]">
                    <Award className="h-3.5 w-3.5 text-emerald-400" />
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <p className="truncate text-xs font-medium text-slate-200">{c.skill_name}</p>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-slate-500">{c.category}</span>
                      <span className="text-[11px] text-slate-600">·</span>
                      <span className="text-[11px] text-slate-500">{fmtDate(c.issued_date)}</span>
                    </div>
                  </div>
                  <Badge className={`shrink-0 inline-flex h-auto rounded px-1.5 py-0.5 text-[9px] font-medium shadow-none ${certStatusClass(c.status)}`}>
                    {c.status}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </SectionCard>

        {/* AI Recommendations */}
        <Card className="min-w-0 w-full rounded-xl border border-gray-800 bg-[#141820] shadow-none">
          <CardContent className="flex min-w-0 flex-col gap-4 p-5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex flex-col gap-0.5">
                <h2 className="text-sm font-semibold text-slate-200">AI Recommendations</h2>
                <p className="text-[11px] text-slate-500">Renewal priorities, compliance risks and career certifications</p>
              </div>
              <Badge className="inline-flex h-auto items-center gap-1.5 rounded bg-[#3b82f620] px-2 py-1 text-xs font-medium text-blue-400 shadow-none hover:bg-[#3b82f620]">
                <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />Live
              </Badge>
            </div>
            {loading ? (
              <div className="flex flex-col gap-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="rounded-lg border border-gray-800 p-3">
                    <SkelLine w="w-48" h="h-3.5" />
                    <div className="mt-2"><SkelLine w="w-full" h="h-2.5" /></div>
                  </div>
                ))}
              </div>
            ) : (
              <AiActionsPanel actions={AI_ACTIONS} />
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Quick Actions ────────────────────────────────────────────────────── */}
      <Card className="min-w-0 rounded-xl border border-gray-800 bg-[#141820] shadow-none">
        <CardContent className="flex flex-col gap-4 p-5">
          <h2 className="text-sm font-semibold text-slate-200">Quick Actions</h2>
          <div className="flex flex-wrap gap-2">
            {[
              { label: "Upload Certificate",   icon: Upload       },
              { label: "Request Validation",   icon: Shield       },
              { label: "Book Renewal Training", icon: GraduationCap },
              { label: "Download Certificate", icon: Download     },
              { label: "Contact Manager",      icon: MessageSquare },
            ].map(({ label, icon: Icon }) => (
              <Button
                key={label}
                size="sm"
                variant="outline"
                className="h-8 gap-1.5 border-gray-700 bg-transparent text-slate-400 hover:border-blue-500/40 hover:text-blue-400 text-xs"
              >
                <Icon className="h-3.5 w-3.5 shrink-0" />
                {label}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

    </section>
  );
}
