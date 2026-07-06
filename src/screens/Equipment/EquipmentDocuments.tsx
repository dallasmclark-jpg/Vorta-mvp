import { useState, useEffect, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  Bell,
  ChevronRight,
  Download,
  Edit,
  RefreshCw,
  UserCircle,
  Upload,
  Search,
  FileText,
  FileCode,
  FileCog,
  FileBarChart,
  Shield,
  Filter,
  Lock,
  Pin,
  Clock,
} from "lucide-react";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Card, CardContent } from "../../components/ui/card";

import { EquipmentBase, DEFAULT_EQUIPMENT_ID } from "./equipmentData";
import { getEquipmentIdentityById, getCachedEquipmentIdentity, getEquipmentDocuments } from "./equipmentService";

// ─── Tabs ─────────────────────────────────────────────────────────────────────

const TABS = [
  { label: "Overview",           id: "overview" },
  { label: "Health",             id: "health" },
  { label: "Work Orders",        id: "wo",      badge: 12 },
  { label: "PMs",                id: "pm",      badge: 8 },
  { label: "History",            id: "history" },
  { label: "Skills & Engineers", id: "skills" },
  { label: "Spares",             id: "spares" },
  { label: "Documents",          id: "docs" },
  { label: "AI Insights",        id: "ai" },
];

// ─── Mock data ────────────────────────────────────────────────────────────────

type DocStatus = "Current" | "Expiring" | "Review Due" | "Expired";

interface DocRow {
  name: string; category: string; date: string; size: string;
  status: DocStatus; iconBg: string; iconColor: string;
}

const EXPIRING = [
  { name: "Safety Certificate ISO-14001", sub: "Expires in 14 days",  subClass: "text-orange-400" },
  { name: "Risk Assessment v2.1",         sub: "Review overdue",       subClass: "text-red-400"    },
  { name: "Calibration Certificate",      sub: "Expired",              subClass: "text-red-400"    },
  { name: "Compliance Audit Report",      sub: "Expires in 26 days",   subClass: "text-yellow-400" },
];

const PINNED = [
  { name: "Operation Manual v4.2",      meta: "PDF • 4.2 MB",  iconBg: "bg-red-500/20",   iconColor: "text-red-400"   },
  { name: "Electrical Schematic Rev.C", meta: "DWG • 8.1 MB",  iconBg: "bg-blue-500/20",  iconColor: "text-blue-400"  },
  { name: "PM Procedure — Quarterly",   meta: "PDF • 2.8 MB",  iconBg: "bg-red-500/20",   iconColor: "text-red-400"   },
];

const RECENT = [
  { name: "Operation Manual v4.2",      meta: "D. Mitchell • 2 hours ago", dotColor: "bg-blue-400"    },
  { name: "Safety Inspection Report",   meta: "J. Wilson • Yesterday",     dotColor: "bg-emerald-400" },
  { name: "PLC Program Backup",         meta: "S. Chen • 3 days ago",      dotColor: "bg-slate-400"   },
];

const PERMISSIONS = [
  { role: "Maintenance Engineers", level: "Full Access",  cls: "bg-emerald-500/20 text-emerald-400" },
  { role: "Operators",             level: "Read Only",    cls: "bg-blue-500/20 text-blue-400"       },
  { role: "Contractors",           level: "Restricted",   cls: "bg-red-500/20 text-red-400"         },
  { role: "Management",            level: "Full Access",  cls: "bg-emerald-500/20 text-emerald-400" },
];

const QUICK_ACTIONS = [
  { Icon: Upload,      label: "Upload Document"     },
  { Icon: Search,      label: "Search Documents"    },
  { Icon: FileText,    label: "Request Document"    },
  { Icon: FileBarChart,label: "Compliance Report"   },
  { Icon: FileText,    label: "Print Document List" },
];

function statusBadgeClass(s: DocStatus) {
  if (s === "Current")    return "bg-[#10b98120] text-emerald-400";
  if (s === "Expiring")   return "bg-[#eab30820] text-yellow-400";
  if (s === "Review Due") return "bg-[#f9731620] text-orange-400";
  return "bg-[#ef444420] text-red-400";
}

// ─── Main Component ───────────────────────────────────────────────────────────

export const EquipmentDocuments = (): JSX.Element => {
  const navigate = useNavigate();
  const { equipmentId } = useParams<{ equipmentId?: string }>();
  const resolvedId = equipmentId ?? DEFAULT_EQUIPMENT_ID;
  const [eq, setEq] = useState<EquipmentBase | null>(() => getCachedEquipmentIdentity(resolvedId));
  const [search, setSearch] = useState("");
  const [documents, setDocuments] = useState<DocRow[]>([]);

  useEffect(() => {
    getEquipmentIdentityById(resolvedId).then(setEq);

    const serviceDocuments = getEquipmentDocuments(resolvedId).map((document) => ({
      ...document,
      iconBg:
        document.category === "Schematic" ? "bg-blue-500/20" :
        document.category === "Drawing" ? "bg-orange-500/20" :
        document.category === "Other" ? "bg-emerald-500/20" :
        document.status === "Review Due" ? "bg-yellow-500/20" :
        "bg-red-500/20",
      iconColor:
        document.category === "Schematic" ? "text-blue-400" :
        document.category === "Drawing" ? "text-orange-400" :
        document.category === "Other" ? "text-emerald-400" :
        document.status === "Review Due" ? "text-yellow-400" :
        "text-red-400",
    }));

    setDocuments(serviceDocuments);
  }, [resolvedId]);

  if (!eq) {
    return (
      <section className="flex w-full flex-col gap-0 overflow-x-hidden pb-10">
        <div className="border-b border-gray-800 bg-[#0b0e14] px-4 pb-4 pt-4 md:px-6">
          <div className="h-28 animate-pulse rounded-xl bg-[#141820]" />
        </div>
      </section>
    );
  }

  const riskBadgeClass =
    eq.riskLevel === "Critical" ? "bg-[#ef444420] text-red-400" :
    eq.riskLevel === "High"     ? "bg-[#f9731620] text-orange-400" :
    "bg-[#10b98120] text-emerald-400";

  const statusDotClass =
    eq.status === "Running" ? "bg-emerald-500" :
    eq.status === "At Risk" ? "bg-orange-400" : "bg-red-500";

  const riskTotal = eq.riskBreakdown.reduce((s, b) => s + b.pct, 0) || 1;

  const handleTabClick = (tabId: string) => {
    const id = eq.id;
    if (tabId === "overview") navigate(`/equipment/${id}/overview`);
    if (tabId === "health")   navigate(`/equipment/${id}/health`);
    if (tabId === "wo")       navigate(`/equipment/${id}/work-orders`);
    if (tabId === "pm")       navigate(`/equipment/${id}/pms`);
    if (tabId === "history")  navigate(`/equipment/${id}/history`);
    if (tabId === "skills")   navigate(`/equipment/${id}/skills`);
    if (tabId === "spares")   navigate(`/equipment/${id}/spares`);
    if (tabId === "ai")       navigate(`/equipment/${id}/ai-insights`);
  };

  const filtered = documents.filter(
    (d) => d.name.toLowerCase().includes(search.toLowerCase()) ||
           d.category.toLowerCase().includes(search.toLowerCase()),
  );

  const categoryCounts = useMemo(() => {
    const counts = documents.reduce<Record<string, number>>((acc, document) => {
      acc[document.category] = (acc[document.category] ?? 0) + 1;
      return acc;
    }, {});
    return [
      { label: "All Docs", count: documents.length, color: "#3b82f6" },
      { label: "Manuals", count: counts.Manual ?? 0, color: "#10b981" },
      { label: "Drawings", count: counts.Drawing ?? 0, color: "#6366f1" },
      { label: "Schematics", count: counts.Schematic ?? 0, color: "#f97316" },
      { label: "Procedures", count: counts.Procedure ?? 0, color: "#eab308" },
      { label: "Certificates", count: counts.Certificate ?? 0, color: "#ef4444" },
      { label: "Compliance", count: counts.Compliance ?? 0, color: "#8b5cf6" },
      { label: "Other", count: counts.Other ?? 0, color: "#64748b" },
    ];
  }, [documents]);

  return (
    <section className="flex w-full flex-col gap-0 overflow-x-hidden pb-10">

      {/* ── Sticky Header ─────────────────────────────────────────────────── */}
      <div className="sticky top-0 z-10 border-b border-gray-800 bg-[#0b0e14] px-4 pb-4 pt-4 md:px-6">
        <div className="mb-4 flex items-center justify-between gap-4">
          <nav className="flex items-center gap-1.5 text-sm text-slate-500">
            <button type="button" onClick={() => navigate("/equipment")} className="transition-colors hover:text-slate-300">
              Equipment
            </button>
            <ChevronRight className="h-3.5 w-3.5" />
            <span className="text-slate-300">{eq.name} ({eq.assetNumber})</span>
          </nav>
          <div className="flex shrink-0 items-center gap-2">
            <Button type="button" variant="outline"
              className="h-auto gap-2 border-gray-700 bg-transparent px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-gray-800 hover:text-slate-100">
              <Edit className="h-3.5 w-3.5" /> Edit Equipment
            </Button>
            <button type="button" className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-400 hover:bg-gray-800 hover:text-slate-200 transition-colors">
              <Bell className="h-4 w-4" />
            </button>
            <button type="button" className="inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-gray-800 hover:text-slate-200 transition-colors">
              <UserCircle className="h-7 w-7" />
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:gap-6">
          <div className="h-28 w-32 shrink-0 overflow-hidden rounded-xl border border-gray-800 bg-[#141820]">
            <img src={eq.image} alt={eq.name} className="h-full w-full object-cover"
              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-2xl font-bold tracking-tight text-slate-50">{eq.name}</h1>
              <Badge className={`inline-flex h-auto rounded px-2 py-0.5 text-[10px] font-bold uppercase shadow-none ${riskBadgeClass}`}>
                {eq.riskLevel} Risk
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              <span className={`h-2 w-2 rounded-full ${statusDotClass}`} />
              <span className="text-sm font-semibold text-slate-200">{eq.status}</span>
              <span className="text-sm text-slate-500">{eq.statusNote}</span>
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-400">
              <span className="font-medium text-slate-300">{eq.assetNumber}</span>
              <span className="rounded bg-gray-800 px-1.5 py-0.5 font-medium tracking-wide">{eq.type}</span>
              <span>📍 {eq.area}</span>
              <span>Manufacturer: <span className="text-slate-300">{eq.manufacturer}</span></span>
              <span>Model: <span className="text-slate-300">{eq.model}</span></span>
              <span>Serial Number: <span className="text-slate-300">{eq.serialNumber}</span></span>
              <span>Install Date: <span className="text-slate-300">{eq.installDate}</span></span>
              <span>Warranty: <span className="text-orange-400">{eq.warranty}</span></span>
              <span>Criticality: <span className="text-slate-300">{eq.criticality}</span></span>
            </div>
          </div>
          <div className="flex shrink-0 flex-col gap-2 lg:w-52">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Risk Score</span>
            <div className="flex items-end gap-3">
              <span className="text-4xl font-bold text-slate-50">{eq.riskScore}%</span>
              <Badge className={`mb-1 inline-flex h-auto rounded px-2 py-0.5 text-[10px] font-bold uppercase shadow-none ${riskBadgeClass}`}>
                {eq.riskLevel}
              </Badge>
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-slate-500">Risk Breakdown</span>
              <div className="flex h-2 overflow-hidden rounded-full">
                {eq.riskBreakdown.map((b) => (
                  <div key={b.label} style={{ width: `${(b.pct / riskTotal) * 100}%`, backgroundColor: b.color }} />
                ))}
              </div>
              <div className="flex flex-wrap gap-x-2 gap-y-0.5">
                {eq.riskBreakdown.map((b) => (
                  <span key={b.label} className="inline-flex items-center gap-1 text-[10px] text-slate-400">
                    <span className={`h-1.5 w-1.5 rounded-full ${b.dotClass}`} />
                    {b.label} {b.pct}%
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-4 flex gap-0 overflow-x-auto">
          {TABS.map((tab) => (
            <button key={tab.id} type="button" onClick={() => handleTabClick(tab.id)}
              className={`flex shrink-0 items-center gap-1.5 border-b-2 px-4 py-2.5 text-xs font-semibold transition-colors ${
                tab.id === "docs"
                  ? "border-blue-500 text-blue-400"
                  : "border-transparent text-slate-500 hover:text-slate-300"
              }`}>
              {tab.label}
              {tab.badge && (
                <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-blue-500/20 px-1 text-[9px] font-bold text-blue-400">
                  {tab.badge}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ── Page Content ──────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-4 px-4 pt-4 md:px-6">

        {/* Page title + actions */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-slate-50">Documents</h2>
            <p className="text-xs text-slate-500">Document control, certifications and compliance records for this equipment.</p>
          </div>
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline"
              className="h-auto gap-1.5 border-gray-700 bg-transparent px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-gray-800 hover:text-slate-100 shadow-none">
              <Upload className="h-3.5 w-3.5" /> Upload Document
            </Button>
            <Button type="button" variant="outline"
              className="h-auto gap-1.5 border-gray-700 bg-transparent px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-gray-800 hover:text-slate-100 shadow-none">
              <Download className="h-3.5 w-3.5" /> Export
            </Button>
          </div>
        </div>

        {/* ── KPI Row ───────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-5">
          <Card className="rounded-xl border border-gray-800 bg-[#141820] shadow-none">
            <CardContent className="p-4">
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">Total Documents</p>
              <p className="text-2xl font-bold text-slate-50">86</p>
              <p className="mt-0.5 text-[11px] text-slate-500">All categories</p>
            </CardContent>
          </Card>
          <Card className="rounded-xl border border-gray-800 bg-[#141820] shadow-none">
            <CardContent className="p-4">
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">Critical Documents</p>
              <p className="text-2xl font-bold text-orange-400">12</p>
              <p className="mt-0.5 text-[11px] text-slate-500">Require review</p>
            </CardContent>
          </Card>
          <Card className="rounded-xl border border-gray-800 bg-[#141820] shadow-none">
            <CardContent className="p-4">
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">Expiring Soon</p>
              <p className="text-2xl font-bold text-red-400">7</p>
              <p className="mt-0.5 text-[11px] text-slate-500">Within 30 days</p>
            </CardContent>
          </Card>
          <Card className="rounded-xl border border-gray-800 bg-[#141820] shadow-none">
            <CardContent className="p-4">
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">Last Updated</p>
              <p className="text-2xl font-bold text-emerald-400">Today</p>
              <p className="mt-0.5 text-[11px] text-slate-500">24 Apr 2025</p>
            </CardContent>
          </Card>
          <Card className="rounded-xl border border-gray-800 bg-[#141820] shadow-none">
            <CardContent className="p-4">
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">Total File Size</p>
              <p className="text-2xl font-bold text-slate-50">2.48 GB</p>
              <p className="mt-0.5 text-[11px] text-slate-500">Across all documents</p>
            </CardContent>
          </Card>
        </div>

        {/* ── Document Categories ───────────────────────────────────────────── */}
        <Card className="rounded-xl border border-gray-800 bg-[#141820] shadow-none">
          <CardContent className="p-4">
            <h3 className="mb-3 text-sm font-semibold text-slate-200">Document Categories</h3>
            <div className="grid grid-cols-4 gap-3 sm:grid-cols-8">
              {categoryCounts.map((cat) => (
                <button key={cat.label} type="button"
                  className="flex flex-col items-center overflow-hidden rounded-lg border border-gray-800 bg-[#0f1218] transition-colors hover:bg-[#1a2030]">
                  <div className="h-1 w-full" style={{ backgroundColor: cat.color }} />
                  <div className="flex flex-col items-center px-2 py-2">
                    <span className="text-lg font-bold text-slate-50">{cat.count}</span>
                    <span className="text-center text-[10px] leading-tight text-slate-500">{cat.label}</span>
                  </div>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* ── Documents Summary Table ───────────────────────────────────────── */}
        <Card className="rounded-xl border border-gray-800 bg-[#141820] shadow-none">
          <CardContent className="p-4">
            <h3 className="mb-3 text-sm font-semibold text-slate-200">Documents Summary</h3>

            {/* Toolbar */}
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <div className="relative min-w-0 flex-1">
                <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
                <input
                  type="text"
                  placeholder="Search documents, tags, description..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="h-8 w-full rounded-lg border border-gray-700 bg-[#0f1218] pl-8 pr-3 text-xs text-slate-200 placeholder:text-slate-600 focus:border-blue-500/50 focus:outline-none"
                />
              </div>
              {["Category", "Type", "Status"].map((f) => (
                <button key={f} type="button"
                  className="flex h-8 items-center gap-1 rounded-lg border border-gray-700 bg-[#0f1218] px-3 text-xs text-slate-400 hover:bg-gray-800 hover:text-slate-200 transition-colors">
                  {f} <ChevronRight className="h-3 w-3 rotate-90" />
                </button>
              ))}
              <button type="button"
                className="flex h-8 items-center gap-1.5 rounded-lg border border-gray-700 bg-[#0f1218] px-3 text-xs text-slate-400 hover:bg-gray-800 hover:text-slate-200 transition-colors">
                <Filter className="h-3 w-3" /> More Filters
              </button>
              <button type="button"
                className="flex h-8 items-center gap-1.5 rounded-lg bg-blue-600 px-3 text-xs font-semibold text-white hover:bg-blue-500 transition-colors">
                <Upload className="h-3 w-3" /> Upload
              </button>
            </div>

            {/* Column headers */}
            <div className="border-b border-gray-800 pb-2">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Document</span>
            </div>

            {/* Rows */}
            <div className="divide-y divide-gray-800">
              {filtered.map((doc) => (
                <div key={doc.name} className="flex items-center gap-3 py-3">
                  <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md ${doc.iconBg}`}>
                    <FileText className={`h-3.5 w-3.5 ${doc.iconColor}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="truncate text-xs font-semibold text-slate-200">{doc.name}</p>
                  </div>
                  <span className="hidden w-24 shrink-0 text-right text-[11px] text-slate-500 sm:block">{doc.category}</span>
                  <span className="hidden w-28 shrink-0 text-right text-[11px] text-slate-500 md:block">{doc.date}</span>
                  <span className="hidden w-14 shrink-0 text-right text-[11px] text-slate-500 lg:block">{doc.size}</span>
                  <Badge className={`h-auto shrink-0 rounded px-2 py-0.5 text-[10px] font-bold shadow-none ${statusBadgeClass(doc.status)}`}>
                    {doc.status}
                  </Badge>
                </div>
              ))}
            </div>

            <div className="mt-3 flex items-center gap-2 text-[11px] text-slate-500">
              <span>Showing {filtered.length} of 86 documents.</span>
              <button type="button" className="text-blue-400 hover:text-blue-300 transition-colors">
                View All Documents →
              </button>
            </div>
          </CardContent>
        </Card>

        {/* ── Lower Row: Expiring | Pinned | Recent ─────────────────────────── */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">

          {/* Expiring / Review Due */}
          <Card className="rounded-xl border border-gray-800 bg-[#141820] shadow-none">
            <CardContent className="p-4">
              <h3 className="mb-3 text-sm font-semibold text-slate-200">Expiring / Review Due</h3>
              <div className="flex flex-col gap-0 divide-y divide-gray-800">
                {EXPIRING.map((item) => (
                  <div key={item.name} className="flex items-start gap-2.5 py-3">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-gray-800">
                      <FileText className="h-3.5 w-3.5 text-slate-400" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-slate-200">{item.name}</p>
                      <p className={`text-[10px] font-medium ${item.subClass}`}>{item.sub}</p>
                    </div>
                  </div>
                ))}
              </div>
              <button type="button" className="mt-1 text-xs text-blue-400 hover:text-blue-300 transition-colors">
                View All Expiring →
              </button>
            </CardContent>
          </Card>

          {/* Pinned Documents */}
          <Card className="rounded-xl border border-gray-800 bg-[#141820] shadow-none">
            <CardContent className="p-4">
              <h3 className="mb-3 text-sm font-semibold text-slate-200">Pinned Documents</h3>
              <div className="flex flex-col gap-0 divide-y divide-gray-800">
                {PINNED.map((item) => (
                  <div key={item.name} className="flex items-center gap-3 py-3">
                    <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md ${item.iconBg}`}>
                      <FileText className={`h-3.5 w-3.5 ${item.iconColor}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="truncate text-xs font-semibold text-slate-200">{item.name}</p>
                      <p className="text-[10px] text-slate-500">{item.meta}</p>
                    </div>
                    <button type="button" className="shrink-0 text-slate-600 hover:text-slate-400 transition-colors">
                      <Download className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
              <button type="button" className="mt-1 text-xs text-blue-400 hover:text-blue-300 transition-colors">
                Manage Pinned →
              </button>
            </CardContent>
          </Card>

          {/* Recent Uploads */}
          <Card className="rounded-xl border border-gray-800 bg-[#141820] shadow-none">
            <CardContent className="p-4">
              <h3 className="mb-3 text-sm font-semibold text-slate-200">Recent Uploads</h3>
              <div className="flex flex-col gap-0 divide-y divide-gray-800">
                {RECENT.map((item) => (
                  <div key={item.name} className="flex items-center gap-2.5 py-3">
                    <span className={`h-2 w-2 shrink-0 rounded-full ${item.dotColor}`} />
                    <div className="flex-1 min-w-0">
                      <p className="truncate text-xs font-semibold text-slate-200">{item.name}</p>
                      <p className="text-[10px] text-slate-500">{item.meta}</p>
                    </div>
                  </div>
                ))}
              </div>
              <button type="button" className="mt-1 text-xs text-blue-400 hover:text-blue-300 transition-colors">
                View Upload History →
              </button>
            </CardContent>
          </Card>
        </div>

        {/* ── Bottom Row: Quick Actions | Permissions ───────────────────────── */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">

          {/* Quick Actions */}
          <Card className="rounded-xl border border-gray-800 bg-[#141820] shadow-none">
            <CardContent className="p-4">
              <h3 className="mb-3 text-sm font-semibold text-slate-200">Quick Actions</h3>
              <div className="flex flex-col gap-2">
                {QUICK_ACTIONS.map(({ Icon, label }) => (
                  <button key={label} type="button"
                    className="flex w-full items-center gap-3 rounded-lg border border-gray-800 bg-transparent px-3 py-2.5 text-left transition-colors hover:bg-[#1a2030]">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-gray-800">
                      <Icon className="h-3.5 w-3.5 text-slate-400" />
                    </div>
                    <span className="flex-1 text-xs font-medium text-slate-300">{label}</span>
                    <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-600" />
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Document Access & Permissions */}
          <Card className="rounded-xl border border-gray-800 bg-[#141820] shadow-none">
            <CardContent className="p-4">
              <h3 className="mb-3 text-sm font-semibold text-slate-200">Document Access & Permissions</h3>
              <div className="flex flex-col gap-0 divide-y divide-gray-800">
                {PERMISSIONS.map((p) => (
                  <div key={p.role} className="flex items-center justify-between py-3">
                    <div className="flex items-center gap-2">
                      <Lock className="h-3.5 w-3.5 text-slate-500" />
                      <span className="text-xs font-medium text-slate-200">{p.role}</span>
                    </div>
                    <Badge className={`h-auto rounded px-2 py-0.5 text-[10px] font-bold shadow-none ${p.cls}`}>
                      {p.level}
                    </Badge>
                  </div>
                ))}
              </div>
              <button type="button" className="mt-3 text-xs text-blue-400 hover:text-blue-300 transition-colors">
                Manage Permissions →
              </button>
            </CardContent>
          </Card>
        </div>

        {/* ── Footer ────────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between border-t border-gray-800 py-3 text-xs text-slate-500">
          <span>All data is synced from Vorta Network and SAP PM. Last updated: 24 Apr 2025, 14:45</span>
          <button type="button" aria-label="Refresh" className="text-slate-600 hover:text-slate-400 transition-colors">
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </section>
  );
};
