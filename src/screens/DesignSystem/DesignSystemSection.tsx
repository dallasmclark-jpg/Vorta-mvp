import { useState } from "react";
import {
  AlertTriangle,
  Bell,
  BookOpen,
  Brain,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Download,
  Filter,
  GraduationCap,
  Info,
  MapPin,
  Plus,
  RefreshCw,
  Search,
  Shield,
  Sparkles,
  Star,
  Trash2,
  TrendingDown,
  TrendingUp,
  Upload,
  Users,
  X,
  Zap,
} from "lucide-react";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Card, CardContent } from "../../components/ui/card";
import { Progress } from "../../components/ui/progress";
import { Select } from "../../components/Select";
import { EmptyState } from "../../components/EmptyState";
import { TrendIndicator } from "../../components/TrendIndicator";
import { AiAnalysing } from "../../components/AiAnalysing";
import { AiActionsPanel, AiAction } from "../../components/AiActionsPanel";
import { SyncIndicator } from "../../components/SyncIndicator";
import { useToast } from "../../components/Toast";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="flex flex-col gap-4">
      <div className="border-b border-gray-800 pb-2">
        <h2 className="text-base font-semibold text-slate-200">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{label}</p>
      <div className="flex flex-wrap items-center gap-3">{children}</div>
    </div>
  );
}

function StateLabel({ children }: { children: React.ReactNode }) {
  return <span className="text-[10px] text-slate-600">{children}</span>;
}

function Token({ name, value, swatch }: { name: string; value: string; swatch?: string }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-gray-800 bg-[#111620] px-3 py-2">
      {swatch && <span className="h-4 w-4 shrink-0 rounded" style={{ background: swatch }} />}
      <div>
        <p className="text-[10px] font-mono text-slate-300">{name}</p>
        <p className="text-[10px] text-slate-500">{value}</p>
      </div>
    </div>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-gray-800 ${className}`} />;
}

// ─── Tooltip ──────────────────────────────────────────────────────────────────

function Tooltip({ children, tip }: { children: React.ReactNode; tip: string }) {
  return (
    <div className="group relative inline-flex">
      {children}
      <div className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 -translate-x-1/2 whitespace-nowrap rounded-lg border border-gray-700 bg-[#1a2030] px-2.5 py-1.5 text-[11px] text-slate-200 opacity-0 shadow-xl transition-opacity duration-150 group-hover:opacity-100">
        {tip}
        <div className="absolute left-1/2 top-full -translate-x-1/2 border-4 border-transparent border-t-gray-700" />
      </div>
    </div>
  );
}

// ─── Tab component ────────────────────────────────────────────────────────────

interface TabsProps {
  tabs: string[];
  active: string;
  onChange: (t: string) => void;
}

function Tabs({ tabs, active, onChange }: TabsProps) {
  return (
    <div className="flex items-center gap-1 rounded-lg border border-gray-800 bg-[#0b0e14] p-1">
      {tabs.map((t) => (
        <button
          key={t}
          type="button"
          onClick={() => onChange(t)}
          className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
            active === t
              ? "bg-[#1a2030] text-slate-200 shadow-sm"
              : "text-slate-500 hover:text-slate-300"
          }`}
        >
          {t}
        </button>
      ))}
    </div>
  );
}

// ─── Pagination component ─────────────────────────────────────────────────────

function Pagination({ page, total, onChange }: { page: number; total: number; onChange: (p: number) => void }) {
  return (
    <div className="flex items-center justify-between text-xs text-slate-500">
      <span>{(page - 1) * 10 + 1}–{Math.min(page * 10, total)} of {total}</span>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => onChange(Math.max(1, page - 1))}
          disabled={page === 1}
          className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-gray-800 text-slate-400 transition-colors hover:bg-[#ffffff1a] disabled:opacity-30"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        {Array.from({ length: Math.min(5, Math.ceil(total / 10)) }).map((_, i) => (
          <button
            key={i}
            type="button"
            onClick={() => onChange(i + 1)}
            className={`inline-flex h-7 w-7 items-center justify-center rounded-lg text-xs transition-colors ${
              i + 1 === page ? "bg-blue-500/20 font-semibold text-blue-400" : "text-slate-500 hover:bg-[#ffffff1a]"
            }`}
          >
            {i + 1}
          </button>
        ))}
        <button
          type="button"
          onClick={() => onChange(Math.min(Math.ceil(total / 10), page + 1))}
          disabled={page >= Math.ceil(total / 10)}
          className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-gray-800 text-slate-400 transition-colors hover:bg-[#ffffff1a] disabled:opacity-30"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────

function KpiCard({ label, value, sub, icon: Icon, valueClass = "text-slate-50", loading = false }: {
  label: string; value: string; sub: string;
  icon: React.ElementType; valueClass?: string; loading?: boolean;
}) {
  return (
    <Card className="rounded-xl border border-gray-800 bg-[#141820] shadow-none">
      <CardContent className="flex flex-col gap-3 p-5">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-medium text-slate-400">{label}</p>
          <Icon className="h-4 w-4 shrink-0 text-slate-600" />
        </div>
        {loading
          ? <div className="h-7 w-16 animate-pulse rounded bg-gray-800" />
          : <p className={`text-2xl font-semibold tabular-nums ${valueClass}`}>{value}</p>}
        <p className="text-[11px] text-slate-500">{sub}</p>
      </CardContent>
    </Card>
  );
}

// ─── Table row component ───────────────────────────────────────────────────────

function TableDemo({ loading }: { loading: boolean }) {
  const rows = [
    { name: "Sarah Chen", dept: "Electrical", site: "Site A", avail: "Available",   avCls: "bg-[#10b98120] text-emerald-400", risk: "Low",      rCls: "bg-[#10b98120] text-emerald-500", score: 92 },
    { name: "James Patel", dept: "Mechanical", site: "Site B", avail: "On Shift",    avCls: "bg-[#3b82f620] text-blue-400",    risk: "Medium",   rCls: "bg-[#facc1520] text-yellow-400",  score: 74 },
    { name: "Kate Wilson", dept: "Controls",   site: "Site A", avail: "Unavailable", avCls: "bg-[#ef444420] text-red-400",     risk: "High",     rCls: "bg-[#f9731620] text-orange-400",  score: 58 },
    { name: "Tom Briggs",  dept: "Electrical", site: "Site C", avail: "Available",   avCls: "bg-[#10b98120] text-emerald-400", risk: "Critical", rCls: "bg-[#ef444420] text-red-500",     score: 41 },
  ];

  return (
    <div className="w-full overflow-x-auto rounded-xl border border-gray-800">
      <table className="w-full min-w-[600px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-gray-800 bg-[#0f1318]">
            {["Engineer", "Department", "Site", "Availability", "Score", "Risk", ""].map((h) => (
              <th key={h} className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-500">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {loading
            ? Array.from({ length: 3 }).map((_, i) => (
                <tr key={i} className="border-b border-gray-800/50 bg-[#141820]">
                  {Array.from({ length: 7 }).map((_, j) => (
                    <td key={j} className="px-4 py-3"><Skeleton className={`h-4 ${j === 0 ? "w-28" : "w-16"}`} /></td>
                  ))}
                </tr>
              ))
            : rows.map((r, idx) => (
                <tr key={r.name} className={`cursor-pointer border-b border-gray-800/50 transition-colors hover:bg-[#1a2030] ${idx % 2 === 0 ? "bg-[#141820]" : "bg-[#111620]"}`}>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-blue-500/20 text-[10px] font-bold text-blue-300">
                        {r.name.split(" ").map(n => n[0]).join("")}
                      </div>
                      <span className="font-medium text-slate-100">{r.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-slate-400">{r.dept}</td>
                  <td className="px-4 py-2.5">
                    <span className="flex items-center gap-1 text-slate-400"><MapPin className="h-3 w-3 text-slate-600" />{r.site}</span>
                  </td>
                  <td className="px-4 py-2.5">
                    <Badge className={`inline-flex h-auto rounded px-2 py-0.5 text-[10px] font-medium shadow-none ${r.avCls}`}>{r.avail}</Badge>
                  </td>
                  <td className="px-4 py-2.5">
                    <span className={`font-semibold tabular-nums ${r.score >= 80 ? "text-emerald-400" : r.score >= 68 ? "text-yellow-400" : "text-red-400"}`}>{r.score}</span>
                  </td>
                  <td className="px-4 py-2.5">
                    <Badge className={`inline-flex h-auto rounded px-2 py-0.5 text-[10px] font-medium shadow-none ${r.rCls}`}>{r.risk}</Badge>
                  </td>
                  <td className="px-4 py-2.5">
                    <button type="button" className="rounded-lg border border-gray-700 px-2.5 py-1 text-[10px] font-medium text-slate-400 transition-colors hover:border-gray-600 hover:bg-[#ffffff0a] hover:text-slate-200">Review</button>
                  </td>
                </tr>
              ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Drawer preview ───────────────────────────────────────────────────────────

function DrawerPreview({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;
  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-[2px]" onClick={onClose} aria-hidden="true" />
      <aside className="fixed right-0 top-0 z-50 flex h-full w-full max-w-sm flex-col border-l border-gray-800 bg-[#090b10] shadow-2xl">
        <header className="flex items-center justify-between border-b border-gray-800 px-6 py-4">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-blue-400" />
            <span className="font-semibold text-slate-50">Engineer Profile</span>
          </div>
          <button type="button" onClick={onClose} className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-[#ffffff1a] hover:text-slate-200">
            <X className="h-4 w-4" />
          </button>
        </header>
        <div className="flex flex-1 flex-col gap-5 overflow-y-auto px-6 py-5">
          <div className="flex items-start gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-blue-500/20 text-lg font-bold text-blue-300">SC</div>
            <div>
              <p className="font-semibold text-slate-50">Sarah Chen</p>
              <p className="text-sm text-slate-400">Electrical Maintenance</p>
              <div className="mt-2 flex gap-2">
                <Badge className="inline-flex h-auto rounded px-2 py-0.5 text-[10px] font-medium shadow-none bg-[#10b98120] text-emerald-400">Available</Badge>
                <Badge className="inline-flex h-auto rounded px-2 py-0.5 text-[10px] font-medium shadow-none bg-[#10b98120] text-emerald-500">Low Risk</Badge>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {[["Competency", "92%"], ["AI Score", "88%"], ["Training Gaps", "0"], ["Critical Skills", "4/4"]].map(([l, v]) => (
              <div key={l} className="flex flex-col gap-0.5 rounded-lg border border-gray-800 bg-[#111620] p-3">
                <span className="text-[10px] font-medium uppercase tracking-wider text-slate-500">{l}</span>
                <span className="text-sm font-semibold text-slate-200">{v}</span>
              </div>
            ))}
          </div>
          <div className="flex flex-col gap-2">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Competency Score</p>
            <Progress value={92} className="h-2 overflow-hidden rounded bg-gray-800 [&>div]:bg-emerald-500" />
          </div>
          <p className="text-xs text-slate-500">This is a drawer / slide-over panel. It can contain any content — engineer profiles, equipment detail, AI recommendations, etc.</p>
        </div>
      </aside>
    </>
  );
}

// ─── Nav items ────────────────────────────────────────────────────────────────

const NAV_SECTIONS = [
  "Colours", "Typography", "Icons", "Buttons", "Badges",
  "Inputs", "Dropdowns", "Tabs", "Pagination",
  "KPI Cards", "Tables", "Drawers", "Tooltips",
  "Empty States", "Toasts", "AI Components",
  "Loading Skeletons", "Sync Indicator", "Trend Indicator",
];

// ─── Main ─────────────────────────────────────────────────────────────────────

export const DesignSystemSection = (): JSX.Element => {
  const toast = useToast();

  const [tab1, setTab1]           = useState("Overview");
  const [tab2, setTab2]           = useState("All");
  const [page, setPage]           = useState(2);
  const [selectVal, setSelectVal] = useState("all");
  const [selectMd, setSelectMd]   = useState("all");
  const [selectLg, setSelectLg]   = useState("all");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [tableLoading, setTableLoading] = useState(false);

  const sampleActions: AiAction[] = [
    { label: "Book training for engineers with gaps", description: "3 engineers require Siemens S7 training to close critical skill gaps.", priority: "critical", icon: GraduationCap },
    { label: "Review expiring certifications",        description: "5 certifications expire within 30 days. Book renewals now.",           priority: "high",     icon: Shield        },
    { label: "Add backup engineer for SPOF skills",   description: "Cross-train a second engineer to reduce single-point-of-failure risk.",  priority: "medium",   icon: Users         },
    { label: "Update skills matrix",                  description: "Skills matrix was last updated 14 days ago.",                           priority: "low",      icon: Brain         },
  ];

  return (
    <section className="relative flex min-w-0 w-full flex-col gap-10 px-4 pb-16 pt-0 md:px-6 xl:px-8">

      <DrawerPreview open={drawerOpen} onClose={() => setDrawerOpen(false)} />

      {/* ── Page header ────────────────────────────────────────────────────── */}
      <header className="flex w-full flex-col justify-between gap-4 py-5 lg:flex-row lg:items-start">
        <div>
          <p className="text-xs font-medium text-slate-500">Internal · Development Only</p>
          <h1 className="mt-1 text-xl font-semibold text-slate-50">Vorta Design System</h1>
          <p className="mt-1 text-sm text-slate-400">Every reusable component with every available state. Do not ship to production users.</p>
        </div>
        <div className="inline-flex items-center gap-2 rounded-lg border border-yellow-500/20 bg-[#facc1508] px-3 py-2 text-xs font-medium text-yellow-400">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          Internal route — /design-system
        </div>
      </header>

      {/* ── Jump nav ───────────────────────────────────────────────────────── */}
      <Card className="rounded-xl border border-gray-800 bg-[#141820] shadow-none">
        <CardContent className="flex flex-wrap gap-2 p-4">
          {NAV_SECTIONS.map((s) => (
            <a
              key={s}
              href={`#ds-${s.toLowerCase().replace(/\s+/g, "-")}`}
              className="rounded-md border border-gray-800 bg-[#0b0e14] px-2.5 py-1 text-[11px] font-medium text-slate-400 transition-colors hover:border-blue-500/30 hover:bg-[#1a2030] hover:text-slate-200"
            >
              {s}
            </a>
          ))}
        </CardContent>
      </Card>

      {/* ── 1 · COLOURS ────────────────────────────────────────────────────── */}
      <Section id="ds-colours" title="Colours">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
          {[
            { name: "--background",  value: "#0b0e14", swatch: "#0b0e14" },
            { name: "--surface-1",   value: "#090b10", swatch: "#090b10" },
            { name: "--surface-2",   value: "#111620", swatch: "#111620" },
            { name: "--surface-3",   value: "#141820", swatch: "#141820" },
            { name: "--surface-4",   value: "#1a2030", swatch: "#1a2030" },
            { name: "--border",      value: "#1f2937", swatch: "#1f2937" },
            { name: "--blue-500",    value: "#3b82f6", swatch: "#3b82f6" },
            { name: "--emerald-400", value: "#34d399", swatch: "#34d399" },
            { name: "--red-500",     value: "#ef4444", swatch: "#ef4444" },
            { name: "--orange-400",  value: "#fb923c", swatch: "#fb923c" },
            { name: "--yellow-400",  value: "#facc15", swatch: "#facc15" },
            { name: "--slate-50",    value: "#f8fafc", swatch: "#f8fafc" },
          ].map((t) => <Token key={t.name} {...t} />)}
        </div>
      </Section>

      {/* ── 2 · TYPOGRAPHY ─────────────────────────────────────────────────── */}
      <Section id="ds-typography" title="Typography">
        <div className="flex flex-col gap-3">
          {[
            { cls: "text-2xl font-semibold text-slate-50",  label: "Page heading · text-2xl semibold",  sample: "Engineer Register" },
            { cls: "text-xl font-semibold text-slate-50",   label: "Section heading · text-xl semibold", sample: "Skills Matrix" },
            { cls: "text-base font-semibold text-slate-50", label: "Card heading · text-base semibold",  sample: "Engineer Insights" },
            { cls: "text-sm font-medium text-slate-200",    label: "Body strong · text-sm medium",       sample: "Sarah Chen · Electrical Maintenance" },
            { cls: "text-sm text-slate-400",                label: "Body regular · text-sm regular",     sample: "Last synced 2 minutes ago via Supabase" },
            { cls: "text-xs font-medium text-slate-400",    label: "Label · text-xs medium",             sample: "Department · Site · Availability" },
            { cls: "text-[11px] font-semibold uppercase tracking-wider text-slate-500", label: "Section label · uppercase xs", sample: "KNOWLEDGE HOLDERS" },
            { cls: "text-[10px] text-slate-500",            label: "Caption · text-10px",                sample: "Last assessed 12 Jan 2025" },
          ].map(({ cls, label, sample }) => (
            <div key={label} className="flex flex-col gap-0.5 rounded-lg border border-gray-800/50 bg-[#111620] px-4 py-3">
              <p className="text-[10px] font-mono text-slate-600">{label}</p>
              <p className={cls}>{sample}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* ── 3 · ICONS ──────────────────────────────────────────────────────── */}
      <Section id="ds-icons" title="Icons">
        <p className="text-sm text-slate-500">Lucide React — consistent sizing: 16px (h-4 w-4) inline, 20px (h-5 w-5) navigation, 24px (h-6 w-6) featured.</p>
        <div className="flex flex-wrap gap-4">
          {[
            { icon: Users, label: "Users" }, { icon: Shield, label: "Shield" }, { icon: Brain, label: "Brain" },
            { icon: Sparkles, label: "Sparkles" }, { icon: GraduationCap, label: "GraduationCap" }, { icon: MapPin, label: "MapPin" },
            { icon: CheckCircle2, label: "CheckCircle2" }, { icon: AlertTriangle, label: "AlertTriangle" },
            { icon: TrendingUp, label: "TrendingUp" }, { icon: TrendingDown, label: "TrendingDown" },
            { icon: Download, label: "Download" }, { icon: Upload, label: "Upload" },
            { icon: Plus, label: "Plus" }, { icon: Search, label: "Search" },
            { icon: Filter, label: "Filter" }, { icon: RefreshCw, label: "RefreshCw" },
            { icon: Bell, label: "Bell" }, { icon: Star, label: "Star" },
            { icon: Trash2, label: "Trash2" }, { icon: Zap, label: "Zap" },
          ].map(({ icon: Icon, label }) => (
            <div key={label} className="flex flex-col items-center gap-1.5 rounded-lg border border-gray-800 bg-[#111620] p-3">
              <Icon className="h-5 w-5 text-slate-400" />
              <span className="text-[10px] text-slate-500">{label}</span>
            </div>
          ))}
        </div>
      </Section>

      {/* ── 4 · BUTTONS ────────────────────────────────────────────────────── */}
      <Section id="ds-buttons" title="Buttons">
        <Row label="Primary">
          <Button className="bg-blue-600 text-white hover:bg-blue-500">Primary</Button>
          <Button className="bg-blue-600 text-white hover:bg-blue-500" disabled>Disabled</Button>
          <Button className="bg-blue-600 text-white hover:bg-blue-500 opacity-70 cursor-wait">
            <RefreshCw className="h-4 w-4 animate-spin" />Loading
          </Button>
          <div className="flex flex-col gap-0.5"><Button className="bg-blue-600 text-white hover:bg-blue-500 ring-2 ring-blue-500/50">Focused</Button><StateLabel>focused</StateLabel></div>
        </Row>
        <Row label="Secondary / Outline">
          <Button variant="outline" className="border-[#ffffff20] bg-[#ffffff1a] text-slate-50 hover:bg-[#ffffff24] hover:text-slate-50">Secondary</Button>
          <Button variant="outline" className="border-[#ffffff20] bg-[#ffffff1a] text-slate-50" disabled>Disabled</Button>
          <Button variant="outline" className="border-[#ffffff20] bg-[#ffffff1a] text-slate-50 hover:bg-[#ffffff24] hover:text-slate-50">
            <Download className="h-4 w-4" />With Icon
          </Button>
        </Row>
        <Row label="Destructive">
          <Button className="bg-red-600/20 text-red-400 hover:bg-red-600/30 border border-red-500/20">Delete</Button>
          <Button className="bg-red-600/20 text-red-400 border border-red-500/20" disabled>Disabled</Button>
        </Row>
        <Row label="Ghost / Icon">
          <Button variant="ghost" className="text-slate-400 hover:bg-[#ffffff1a] hover:text-slate-200">Ghost</Button>
          <button type="button" className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-[#ffffff1a] hover:text-slate-200"><RefreshCw className="h-4 w-4" /></button>
          <button type="button" className="inline-flex h-9 w-9 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-[#ffffff1a] hover:text-slate-200"><Plus className="h-5 w-5" /></button>
        </Row>
        <Row label="Sizes">
          <Button size="sm" className="bg-blue-600 text-white hover:bg-blue-500">Small</Button>
          <Button className="bg-blue-600 text-white hover:bg-blue-500">Default</Button>
          <Button size="lg" className="bg-blue-600 text-white hover:bg-blue-500">Large</Button>
        </Row>
      </Section>

      {/* ── 5 · BADGES ─────────────────────────────────────────────────────── */}
      <Section id="ds-badges" title="Badges">
        <Row label="Status">
          <Badge className="inline-flex h-auto rounded px-2 py-0.5 text-[10px] font-medium shadow-none bg-[#10b98120] text-emerald-400">Available</Badge>
          <Badge className="inline-flex h-auto rounded px-2 py-0.5 text-[10px] font-medium shadow-none bg-[#3b82f620] text-blue-400">On Shift</Badge>
          <Badge className="inline-flex h-auto rounded px-2 py-0.5 text-[10px] font-medium shadow-none bg-[#ef444420] text-red-400">Unavailable</Badge>
        </Row>
        <Row label="Risk">
          <Badge className="inline-flex h-auto rounded px-2 py-0.5 text-[10px] font-medium shadow-none bg-[#ef444420] text-red-500">Critical</Badge>
          <Badge className="inline-flex h-auto rounded px-2 py-0.5 text-[10px] font-medium shadow-none bg-[#f9731620] text-orange-400">High</Badge>
          <Badge className="inline-flex h-auto rounded px-2 py-0.5 text-[10px] font-medium shadow-none bg-[#facc1520] text-yellow-400">Medium</Badge>
          <Badge className="inline-flex h-auto rounded px-2 py-0.5 text-[10px] font-medium shadow-none bg-[#10b98120] text-emerald-500">Low</Badge>
        </Row>
        <Row label="Priority">
          <Badge className="inline-flex h-auto rounded px-2 py-0.5 text-[10px] font-medium shadow-none bg-[#ef444418] text-red-400 border border-red-500/20">Critical</Badge>
          <Badge className="inline-flex h-auto rounded px-2 py-0.5 text-[10px] font-medium shadow-none bg-[#f9731618] text-orange-400 border border-orange-500/20">High</Badge>
          <Badge className="inline-flex h-auto rounded px-2 py-0.5 text-[10px] font-medium shadow-none bg-[#facc1518] text-yellow-400 border border-yellow-500/20">Medium</Badge>
          <Badge className="inline-flex h-auto rounded px-2 py-0.5 text-[10px] font-medium shadow-none bg-[#10b98118] text-emerald-400 border border-emerald-500/20">Low</Badge>
        </Row>
        <Row label="Live / Info">
          <Badge className="inline-flex h-auto items-center gap-1.5 rounded bg-[#3b82f620] px-2 py-1 text-xs font-medium text-blue-500 shadow-none">
            <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />Live
          </Badge>
          <Badge className="inline-flex h-auto items-center gap-1.5 rounded bg-[#3b82f620] px-2 py-1 text-xs font-medium text-blue-500 shadow-none">
            <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />AI Ranked
          </Badge>
          <Badge className="inline-flex h-auto rounded bg-blue-500/20 px-2 py-0.5 text-[10px] font-medium text-blue-400 shadow-none">Skill Tag</Badge>
        </Row>
        <Row label="Coverage">
          <Badge className="inline-flex h-auto rounded px-2 py-0.5 text-[10px] font-medium shadow-none bg-[#10b98120] text-emerald-500">Strong</Badge>
          <Badge className="inline-flex h-auto rounded px-2 py-0.5 text-[10px] font-medium shadow-none bg-[#facc1520] text-yellow-400">Partial</Badge>
          <Badge className="inline-flex h-auto rounded px-2 py-0.5 text-[10px] font-medium shadow-none bg-[#ef444420] text-red-500">Gap</Badge>
        </Row>
      </Section>

      {/* ── 6 · INPUTS ─────────────────────────────────────────────────────── */}
      <Section id="ds-inputs" title="Form Inputs">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-slate-400">Default</label>
            <input type="text" placeholder="Search engineers…" defaultValue="" className="h-9 w-full rounded-lg border border-gray-800 bg-[#0b0e14] px-3 text-sm text-slate-200 placeholder:text-slate-600 focus:border-blue-500/50 focus:outline-none focus:ring-1 focus:ring-blue-500/30" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-slate-400">With icon</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
              <input type="text" placeholder="Search…" className="h-9 w-full rounded-lg border border-gray-800 bg-[#0b0e14] pl-9 pr-3 text-sm text-slate-200 placeholder:text-slate-600 focus:border-blue-500/50 focus:outline-none focus:ring-1 focus:ring-blue-500/30" />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-slate-400">Focused</label>
            <input type="text" defaultValue="Sarah Chen" className="h-9 w-full rounded-lg border border-blue-500/40 bg-[#0b0e14] px-3 text-sm text-slate-200 outline-none ring-1 ring-blue-500/30" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-slate-400">Disabled</label>
            <input type="text" disabled placeholder="Disabled field" className="h-9 w-full cursor-not-allowed rounded-lg border border-gray-800 bg-[#0b0e14] px-3 text-sm text-slate-600 opacity-50 placeholder:text-slate-700" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-slate-400">Error</label>
            <input type="email" defaultValue="invalid-email" className="h-9 w-full rounded-lg border border-red-500/50 bg-[#0b0e14] px-3 text-sm text-slate-200 ring-1 ring-red-500/30 outline-none" />
            <p className="text-[11px] text-red-400">Enter a valid email address</p>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-slate-400">Textarea</label>
            <textarea rows={3} placeholder="Describe the issue…" className="w-full resize-none rounded-lg border border-gray-800 bg-[#0b0e14] px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:border-blue-500/50 focus:outline-none focus:ring-1 focus:ring-blue-500/30" />
          </div>
        </div>
      </Section>

      {/* ── 7 · DROPDOWNS ──────────────────────────────────────────────────── */}
      <Section id="ds-dropdowns" title="Dropdowns">
        <Row label="Sizes — sm (160px) · md (200px) · lg (240px)">
          <div className="flex flex-col gap-1">
            <Select value={selectVal} onChange={setSelectVal} size="sm" placeholder="All Risk Levels"
              options={[{ value: "all", label: "All Risk Levels" }, { value: "critical", label: "Critical" }, { value: "high", label: "High" }, { value: "medium", label: "Medium" }, { value: "low", label: "Low" }]} />
            <StateLabel>sm · 160px · Risk / Status / Priority</StateLabel>
          </div>
          <div className="flex flex-col gap-1">
            <Select value={selectMd} onChange={setSelectMd} size="md" placeholder="All Departments"
              options={[{ value: "all", label: "All Departments" }, { value: "elec", label: "Electrical" }, { value: "mech", label: "Mechanical" }, { value: "ctrl", label: "Controls" }]} />
            <StateLabel>md · 200px · Department / Site / Trade</StateLabel>
          </div>
          <div className="flex flex-col gap-1">
            <Select value={selectLg} onChange={setSelectLg} size="lg" placeholder="All OEM Equipment"
              options={[{ value: "all", label: "All OEM Equipment" }, { value: "siemens", label: "Siemens S7 PLC Line 3" }, { value: "krones", label: "Krones Modulfill VFS" }, { value: "abb", label: "ABB IRB 660 Robot" }]} />
            <StateLabel>lg · 240px · OEM / Equipment / Long values</StateLabel>
          </div>
        </Row>
        <Row label="States">
          <div className="flex flex-col gap-1">
            <Select value="" onChange={() => {}} size="sm" placeholder="Placeholder state"
              options={[{ value: "a", label: "Option A" }]} />
            <StateLabel>empty / placeholder</StateLabel>
          </div>
          <div className="flex flex-col gap-1">
            <Select value="critical" onChange={() => {}} size="sm"
              options={[{ value: "critical", label: "Critical" }, { value: "high", label: "High" }]} />
            <StateLabel>selected</StateLabel>
          </div>
          <div className="flex flex-col gap-1">
            <Select value="" onChange={() => {}} size="sm" disabled placeholder="Disabled"
              options={[{ value: "a", label: "Option" }]} />
            <StateLabel>disabled</StateLabel>
          </div>
        </Row>
      </Section>

      {/* ── 8 · TABS ───────────────────────────────────────────────────────── */}
      <Section id="ds-tabs" title="Tabs">
        <Row label="Standard tabs">
          <div className="flex flex-col gap-3">
            <Tabs tabs={["Overview", "Skills", "Training", "Assignments"]} active={tab1} onChange={setTab1} />
            <p className="text-xs text-slate-500">Active: <span className="text-slate-300">{tab1}</span></p>
          </div>
        </Row>
        <Row label="Compact tabs">
          <Tabs tabs={["All", "Active", "Expiring"]} active={tab2} onChange={setTab2} />
        </Row>
      </Section>

      {/* ── 9 · PAGINATION ─────────────────────────────────────────────────── */}
      <Section id="ds-pagination" title="Pagination">
        <Row label="Standard">
          <div className="w-full max-w-md rounded-xl border border-gray-800 bg-[#141820] px-4 py-3">
            <Pagination page={page} total={47} onChange={setPage} />
          </div>
        </Row>
        <Row label="First page (prev disabled)">
          <div className="w-full max-w-md rounded-xl border border-gray-800 bg-[#141820] px-4 py-3">
            <Pagination page={1} total={47} onChange={() => {}} />
          </div>
        </Row>
        <Row label="Last page (next disabled)">
          <div className="w-full max-w-md rounded-xl border border-gray-800 bg-[#141820] px-4 py-3">
            <Pagination page={5} total={47} onChange={() => {}} />
          </div>
        </Row>
      </Section>

      {/* ── 10 · KPI CARDS ─────────────────────────────────────────────────── */}
      <Section id="ds-kpi-cards" title="KPI Cards">
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <KpiCard label="Total Engineers"  value="42"   sub="23 verified"         icon={Users}         valueClass="text-slate-50"    />
          <KpiCard label="Available Now"    value="18"   sub="Ready to deploy"     icon={CheckCircle2}  valueClass="text-emerald-400" />
          <KpiCard label="Training Gaps"    value="7"    sub="Require booking"     icon={GraduationCap} valueClass="text-orange-400"  />
          <KpiCard label="Certs Expiring"   value="3"    sub="Next 30 days"        icon={AlertTriangle} valueClass="text-red-400"     />
        </div>
        <Row label="Loading state">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4 w-full">
            <KpiCard label="Total Engineers" value="—" sub="Loading…" icon={Users} loading />
            <KpiCard label="Available Now"   value="—" sub="Loading…" icon={CheckCircle2} loading />
          </div>
        </Row>
      </Section>

      {/* ── 11 · TABLES ────────────────────────────────────────────────────── */}
      <Section id="ds-tables" title="Tables">
        <Row label="Controls">
          <button type="button" onClick={() => setTableLoading((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-800 px-3 py-1.5 text-xs font-medium text-slate-400 transition-colors hover:bg-[#ffffff0a] hover:text-slate-200">
            <RefreshCw className={`h-3.5 w-3.5 ${tableLoading ? "animate-spin" : ""}`} />
            Toggle loading
          </button>
        </Row>
        <TableDemo loading={tableLoading} />
        <div className="rounded-xl border border-gray-800 bg-[#141820] px-4 py-3">
          <Pagination page={1} total={24} onChange={() => {}} />
        </div>
      </Section>

      {/* ── 12 · DRAWERS ───────────────────────────────────────────────────── */}
      <Section id="ds-drawers" title="Drawers / Slide-overs">
        <Row label="Open a drawer">
          <Button
            type="button"
            onClick={() => setDrawerOpen(true)}
            className="bg-blue-600 text-white hover:bg-blue-500"
          >
            Open Engineer Profile Drawer
          </Button>
        </Row>
        <p className="text-xs text-slate-500">Drawers: fixed right panel · max-w-md · scrollable body · always opens at top · click backdrop to close.</p>
      </Section>

      {/* ── 13 · TOOLTIPS ──────────────────────────────────────────────────── */}
      <Section id="ds-tooltips" title="Tooltips">
        <Row label="Hover each element">
          <Tooltip tip="This engineer is a critical knowledge holder">
            <button type="button" className="inline-flex items-center gap-1.5 rounded-lg border border-gray-800 bg-[#111620] px-3 py-1.5 text-xs text-slate-300 transition-colors hover:bg-[#1a2030]">
              <Shield className="h-3.5 w-3.5 text-blue-400" />SME Badge
            </button>
          </Tooltip>
          <Tooltip tip="3 certifications expiring in 30 days">
            <span className="inline-flex h-2 w-2 cursor-default rounded-full bg-amber-400" />
          </Tooltip>
          <Tooltip tip="Competency score: 92% — above target">
            <span className="cursor-default font-semibold text-emerald-400">92%</span>
          </Tooltip>
          <Tooltip tip="Disabled — no permission">
            <button type="button" disabled className="cursor-not-allowed rounded-lg border border-gray-800 px-3 py-1.5 text-xs text-slate-600 opacity-40">Locked</button>
          </Tooltip>
        </Row>
      </Section>

      {/* ── 14 · EMPTY STATES ──────────────────────────────────────────────── */}
      <Section id="ds-empty-states" title="Empty States">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Card className="rounded-xl border border-gray-800 bg-[#141820] shadow-none">
            <CardContent className="p-0">
              <EmptyState icon={Users} title="No engineers found" description="No engineers match the current filters. Try adjusting your search." action={{ label: "Clear filters", onClick: () => {} }} />
            </CardContent>
          </Card>
          <Card className="rounded-xl border border-gray-800 bg-[#141820] shadow-none">
            <CardContent className="p-0">
              <EmptyState icon={GraduationCap} title="No training gaps" description="All engineers meet their required skill thresholds." />
            </CardContent>
          </Card>
          <Card className="rounded-xl border border-gray-800 bg-[#141820] shadow-none">
            <CardContent className="p-0">
              <EmptyState icon={AlertTriangle} title="Connection error" description="Unable to load data. Check your connection and try again." action={{ label: "Retry", onClick: () => {} }} />
            </CardContent>
          </Card>
          <Card className="rounded-xl border border-gray-800 bg-[#141820] shadow-none">
            <CardContent className="p-0">
              <EmptyState icon={CheckCircle2} title="All clear" description="No critical issues detected across all engineers and assets." />
            </CardContent>
          </Card>
        </div>
      </Section>

      {/* ── 15 · TOASTS ────────────────────────────────────────────────────── */}
      <Section id="ds-toasts" title="Toasts / Notifications">
        <Row label="Trigger a toast">
          <Button type="button" onClick={() => toast({ type: "success", message: "Engineer profile saved successfully." })}
            className="bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600/30 border border-emerald-500/20">
            <CheckCircle2 className="h-4 w-4" />Success
          </Button>
          <Button type="button" onClick={() => toast({ type: "info", message: "Training booking sent to manager for approval." })}
            className="bg-blue-600/20 text-blue-400 hover:bg-blue-600/30 border border-blue-500/20">
            <Info className="h-4 w-4" />Info
          </Button>
          <Button type="button" onClick={() => toast({ type: "warning", message: "3 certifications are expiring within 30 days." })}
            className="bg-yellow-500/10 text-yellow-400 hover:bg-yellow-500/20 border border-yellow-500/20">
            <AlertTriangle className="h-4 w-4" />Warning
          </Button>
          <Button type="button" onClick={() => toast({ type: "success", message: "Action accepted.", duration: 8000 })}
            className="bg-[#ffffff1a] text-slate-300 hover:bg-[#ffffff24] border border-[#ffffff20]">
            Long (8s)
          </Button>
        </Row>
        <p className="text-xs text-slate-500">Toasts: top-right · auto-dismiss (3.2s default) · animated progress bar · max 4 visible · click × to dismiss.</p>
      </Section>

      {/* ── 16 · AI COMPONENTS ─────────────────────────────────────────────── */}
      <Section id="ds-ai-components" title="AI Components">
        <Row label="AiAnalysing — inline">
          <AiAnalysing message="Analysing skill gaps…" />
          <AiAnalysing message="Matching engineers to requirements…" />
        </Row>
        <Row label="AiAnalysing — block">
          <div className="w-full">
            <AiAnalysing block message="Vorta AI is generating your workforce readiness report…" />
          </div>
        </Row>
        <Row label="AiActionsPanel">
          <div className="w-full">
            <AiActionsPanel actions={sampleActions} />
          </div>
        </Row>
        <Row label="AI Insight cards">
          <div className="flex flex-col gap-3 w-full max-w-lg">
            {[
              { cls: { bg: "bg-[#ef444408]", border: "border-red-500/20", icon: "text-red-500", title: "text-red-400" }, severity: "Critical", Icon: AlertTriangle, text: "2 engineers at critical risk — immediate review required." },
              { cls: { bg: "bg-[#f9731608]", border: "border-orange-400/20", icon: "text-orange-400", title: "text-orange-300" }, severity: "High", Icon: Shield, text: "1 knowledge holder at high attrition risk." },
              { cls: { bg: "bg-[#facc1508]", border: "border-yellow-400/20", icon: "text-yellow-400", title: "text-yellow-300" }, severity: "Medium", Icon: Brain, text: "7 training gaps across 4 engineers." },
            ].map(({ cls, severity, Icon, text }) => (
              <div key={severity} className={`flex items-start gap-2.5 rounded-lg border ${cls.border} ${cls.bg} p-4`}>
                <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${cls.icon}`} />
                <div>
                  <p className={`text-sm font-semibold ${cls.title}`}>{severity} — {text}</p>
                </div>
              </div>
            ))}
          </div>
        </Row>
      </Section>

      {/* ── 17 · LOADING SKELETONS ─────────────────────────────────────────── */}
      <Section id="ds-loading-skeletons" title="Loading Skeletons">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <div className="flex flex-col gap-3">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">KPI Card skeleton</p>
            <Card className="rounded-xl border border-gray-800 bg-[#141820] shadow-none">
              <CardContent className="flex flex-col gap-3 p-5">
                <div className="flex items-center justify-between"><Skeleton className="h-3 w-24" /><Skeleton className="h-4 w-4" /></div>
                <Skeleton className="h-7 w-16" />
                <Skeleton className="h-2.5 w-32" />
              </CardContent>
            </Card>
          </div>
          <div className="flex flex-col gap-3">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">List row skeleton</p>
            <div className="flex flex-col divide-y divide-gray-800/50 rounded-xl border border-gray-800 bg-[#141820]">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 px-4 py-3">
                  <Skeleton className="h-8 w-8 rounded-lg" />
                  <div className="flex flex-1 flex-col gap-1.5">
                    <Skeleton className="h-3 w-28" />
                    <Skeleton className="h-2.5 w-20" />
                  </div>
                  <Skeleton className="h-5 w-14 rounded" />
                </div>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-3">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Table row skeleton</p>
            <div className="rounded-xl border border-gray-800 bg-[#141820] overflow-hidden">
              <TableDemo loading />
            </div>
          </div>
          <div className="flex flex-col gap-3">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Insight card skeleton</p>
            <div className="flex flex-col gap-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="rounded-lg border border-gray-800 p-4">
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="mt-2 h-3 w-full" />
                  <Skeleton className="mt-1 h-3 w-3/4" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </Section>

      {/* ── 18 · SYNC INDICATOR ────────────────────────────────────────────── */}
      <Section id="ds-sync-indicator" title="Sync Indicator">
        <Row label="States">
          <div className="flex flex-col gap-2 w-full">
            <SyncIndicator source="Supabase" confidence={92} loading={false} syncedAt={new Date(Date.now() - 90000)} />
            <SyncIndicator source="Supabase" loading />
            <SyncIndicator source="Supabase" confidence={45} syncedAt={new Date(Date.now() - 3600000)} />
          </div>
        </Row>
      </Section>

      {/* ── 19 · TREND INDICATOR ───────────────────────────────────────────── */}
      <Section id="ds-trend-indicator" title="Trend Indicator">
        <Row label="Directions &amp; contexts">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex flex-col gap-1 items-center">
              <TrendIndicator direction="up" label="+2 this month" positiveIsUp />
              <StateLabel>up · positive</StateLabel>
            </div>
            <div className="flex flex-col gap-1 items-center">
              <TrendIndicator direction="up" label="+3 gaps added" positiveIsUp={false} />
              <StateLabel>up · negative</StateLabel>
            </div>
            <div className="flex flex-col gap-1 items-center">
              <TrendIndicator direction="down" label="-1 vs last month" positiveIsUp={false} />
              <StateLabel>down · positive</StateLabel>
            </div>
            <div className="flex flex-col gap-1 items-center">
              <TrendIndicator direction="down" label="-1 engineer" positiveIsUp />
              <StateLabel>down · negative</StateLabel>
            </div>
            <div className="flex flex-col gap-1 items-center">
              <TrendIndicator direction="flat" label="No change" />
              <StateLabel>flat · neutral</StateLabel>
            </div>
          </div>
        </Row>
      </Section>

      {/* ── Progress bars ──────────────────────────────────────────────────── */}
      <Section id="ds-progress" title="Progress Bars">
        <div className="flex flex-col gap-4 max-w-md">
          {[
            { label: "Strong coverage (92%)",  value: 92,  cls: "[&>div]:bg-emerald-500" },
            { label: "Partial coverage (58%)",  value: 58,  cls: "[&>div]:bg-yellow-400" },
            { label: "Critical gap (22%)",      value: 22,  cls: "[&>div]:bg-red-500"    },
            { label: "Loading / indeterminate", value: 60,  cls: "[&>div]:bg-blue-500"   },
          ].map(({ label, value, cls }) => (
            <div key={label} className="flex flex-col gap-1.5">
              <div className="flex justify-between text-xs">
                <span className="text-slate-400">{label}</span>
                <span className="tabular-nums text-slate-500">{value}%</span>
              </div>
              <Progress value={value} className={`h-2 overflow-hidden rounded bg-gray-800 ${cls}`} />
            </div>
          ))}
        </div>
      </Section>

    </section>
  );
};
