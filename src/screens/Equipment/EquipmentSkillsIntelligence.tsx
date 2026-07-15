import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  AlertTriangle, ArrowRight, Bell, BrainCircuit, Check, ChevronRight, Copy,
  Database, GraduationCap, RefreshCw, Search, ShieldAlert, ShieldCheck,
  Sparkles, UserCircle, Users, Wrench,
} from "lucide-react";
import { ProfilePhoto } from "../../components/ProfilePhoto";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Card, CardContent } from "../../components/ui/card";
import { DEFAULT_EQUIPMENT_ID, type EquipmentBase } from "./equipmentData";
import {
  type EquipmentDevelopmentPath,
  type EquipmentEngineerCapability,
  type EquipmentOperatorCapability,
  type EquipmentSkillsShowcase,
  getCachedEquipmentIdentity,
  getEquipmentIdentityById,
  getEquipmentSkillsShowcase,
} from "./equipmentService";
import { EquipmentRiskIndicator } from "./EquipmentRiskIndicator";
import { EquipmentTabNavigation } from "./EquipmentTabNavigation";

type EngineerFilter = "ALL" | "PRIMARY_SME" | "BACKUP_SME" | "DEVELOPING_BACKUP";

const words = (value?: string | null): string =>
  value ? value.replaceAll("_", " ").toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase()) : "—";
const initials = (name: string): string => name.split(/\s+/).filter(Boolean).map((part) => part[0]).join("").slice(0, 2).toUpperCase();
const dateLabel = (value?: string | null): string => {
  if (!value) return "No target date";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" }).format(date);
};
const dateTimeLabel = (date: Date | null): string => date
  ? new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(date)
  : "Loading latest capability data";

function riskTone(level: string): string {
  if (level.toLowerCase() === "critical") return "border-red-500/25 bg-red-500/10 text-red-300";
  if (level.toLowerCase() === "high") return "border-orange-500/25 bg-orange-500/10 text-orange-300";
  if (level.toLowerCase() === "medium") return "border-yellow-500/25 bg-yellow-500/10 text-yellow-300";
  return "border-emerald-500/25 bg-emerald-500/10 text-emerald-300";
}

function roleTone(role?: string | null): string {
  if (role === "PRIMARY_SME") return "border-emerald-500/25 bg-emerald-500/10 text-emerald-300";
  if (role === "BACKUP_SME") return "border-blue-500/25 bg-blue-500/10 text-blue-300";
  if (role === "DEVELOPING_BACKUP") return "border-amber-500/25 bg-amber-500/10 text-amber-300";
  return "border-slate-600 bg-slate-800/70 text-slate-300";
}

function Metric({ label, value, detail, tone = "text-slate-50" }: { label: string; value: string | number; detail: string; tone?: string }): JSX.Element {
  return (
    <div className="rounded-xl border border-gray-800 bg-[#0b1017]/80 p-3.5">
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">{label}</p>
      <p className={`mt-1.5 text-2xl font-semibold ${tone}`}>{value}</p>
      <p className="mt-1 text-[11px] leading-4 text-slate-500">{detail}</p>
    </div>
  );
}

function SmeProfile({ engineer, large = false }: { engineer?: EquipmentEngineerCapability; large?: boolean }): JSX.Element {
  const name = engineer?.engineerName ?? "Unassigned";
  return (
    <div className="flex min-w-0 items-center gap-4">
      <ProfilePhoto
        name={name}
        entityType="engineer"
        entityId={engineer?.engineerId}
        sizeClass={large ? "h-20 w-20" : "h-14 w-14"}
        shapeClass="rounded-2xl"
        fallbackClass={engineer ? "bg-emerald-500/15 text-emerald-300" : "bg-red-500/15 text-red-300"}
        fallbackText={initials(name)}
        className={large ? "text-lg" : "text-sm"}
        eager
      />
      <div className="min-w-0">
        <p className={`truncate font-semibold ${large ? "text-xl" : "text-base"} ${engineer ? "text-slate-100" : "text-red-300"}`}>{name}</p>
        <p className="mt-1 text-xs text-slate-500">
          {engineer ? `${engineer.requiredSkillMatches}/${engineer.requiredSkillTotal} required skills matched` : "No validated equipment owner"}
        </p>
        {engineer ? <Badge className="mt-2 h-auto rounded border border-emerald-500/25 bg-emerald-500/10 px-2 py-1 text-[10px] font-semibold text-emerald-300 shadow-none">Primary SME</Badge> : null}
      </div>
    </div>
  );
}

function EngineerCard({ engineer }: { engineer: EquipmentEngineerCapability }): JSX.Element {
  const match = engineer.requiredSkillTotal > 0 ? Math.round((engineer.requiredSkillMatches / engineer.requiredSkillTotal) * 100) : 0;
  return (
    <article className="rounded-xl border border-gray-800 bg-[#0d1219] p-4">
      <div className="flex items-start gap-3">
        <ProfilePhoto name={engineer.engineerName} entityType="engineer" entityId={engineer.engineerId} sizeClass="h-12 w-12" shapeClass="rounded-xl" fallbackClass="bg-blue-500/15 text-blue-300" fallbackText={initials(engineer.engineerName)} className="text-xs" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0"><p className="truncate text-sm font-semibold text-slate-100">{engineer.engineerName}</p><p className="mt-1 text-[11px] text-slate-500">{words(engineer.discipline)} · {words(engineer.shiftPattern)}</p></div>
            <Badge className={`h-auto rounded border px-2 py-1 text-[9px] font-semibold shadow-none ${roleTone(engineer.capabilityRole)}`}>{words(engineer.capabilityRole || "QUALIFIED_SUPPORT")}</Badge>
          </div>
          <div className="mt-3 flex items-center justify-between text-[11px]"><span className="text-slate-500">Required-skill match</span><span className="font-semibold text-slate-200">{match}%</span></div>
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-gray-800"><div className={`h-full rounded-full ${match >= 90 ? "bg-emerald-400" : match >= 70 ? "bg-blue-400" : "bg-amber-400"}`} style={{ width: `${match}%`, opacity: 0.72 }} /></div>
          <p className="mt-3 text-[10px] text-slate-500">Level {engineer.competencyLevel ?? "—"} · {words(engineer.validationStatus)}</p>
        </div>
      </div>
    </article>
  );
}

function OperatorRow({ operator }: { operator: EquipmentOperatorCapability }): JSX.Element {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-gray-800 py-3 last:border-0">
      <div className="flex min-w-0 items-center gap-3">
        <ProfilePhoto name={operator.operatorName} entityType="operator" entityId={operator.operatorId} sizeClass="h-10 w-10" shapeClass="rounded-xl" fallbackClass="bg-violet-500/15 text-violet-300" fallbackText={initials(operator.operatorName)} className="text-[10px]" />
        <div className="min-w-0"><p className="truncate text-xs font-semibold text-slate-200">{operator.operatorName}</p><p className="mt-1 text-[10px] text-slate-500">{words(operator.roleOnEquipment)} · {operator.validatedAmSkillCount} validated AM skills</p></div>
      </div>
      <div className="shrink-0 text-right"><p className="text-xs font-semibold text-violet-300">AM Step {operator.amStep ?? "—"}</p><p className="mt-1 text-[10px] text-slate-500">{words(operator.amValidationStatus)}</p></div>
    </div>
  );
}

function DevelopmentCard({ path }: { path: EquipmentDevelopmentPath }): JSX.Element {
  const tone = path.readinessScore >= 80 ? "text-emerald-300" : path.readinessScore >= 60 ? "text-amber-300" : "text-orange-300";
  return (
    <article className="rounded-xl border border-gray-800 bg-[#0d1219] p-4">
      <div className="flex items-start justify-between gap-3">
        <div><p className="text-sm font-semibold text-slate-100">{path.personName}</p><p className="mt-1 text-[11px] text-slate-500">{words(path.shiftName)} · Mentor {path.mentorName || "unassigned"}</p></div>
        <div className="text-right"><p className={`text-lg font-semibold ${tone}`}>{path.readinessScore}%</p><p className="text-[9px] uppercase tracking-wide text-slate-600">ready</p></div>
      </div>
      <div className="mt-3 rounded-lg border border-gray-800 bg-[#0a0f16] p-3"><p className="text-[10px] text-slate-500">{words(path.currentJobRole)}</p><p className="mt-1 text-xs font-semibold text-blue-300">→ {words(path.targetJobRole || path.targetCapabilityRole)}</p></div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-gray-800"><div className="h-full rounded-full bg-blue-400" style={{ width: `${Math.min(100, path.readinessScore)}%`, opacity: 0.75 }} /></div>
      <div className="mt-3 flex justify-between text-[10px] text-slate-500"><span>Supervised {path.supervisedCompleted}/{path.supervisedRequired}</span><span>Evidence {path.evidenceCompleted}/{path.evidenceRequired}</span></div>
      <p className="mt-2 text-[10px] text-slate-600">Target {dateLabel(path.targetCompletionDate)}</p>
    </article>
  );
}

export const EquipmentSkills = (): JSX.Element => {
  const navigate = useNavigate();
  const { equipmentId } = useParams<{ equipmentId?: string }>();
  const resolvedId = equipmentId ?? DEFAULT_EQUIPMENT_ID;
  const [equipment, setEquipment] = useState<EquipmentBase | null>(() => getCachedEquipmentIdentity(resolvedId));
  const [showcase, setShowcase] = useState<EquipmentSkillsShowcase | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [question, setQuestion] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<EngineerFilter>("ALL");
  const [copied, setCopied] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const loadCapability = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [identity, capability] = await Promise.all([getEquipmentIdentityById(resolvedId), getEquipmentSkillsShowcase(resolvedId)]);
      setEquipment(identity);
      setShowcase(capability);
      setLastUpdated(new Date());
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Capability intelligence could not be loaded.");
      setShowcase(null);
    } finally {
      setLoading(false);
    }
  }, [resolvedId]);

  useEffect(() => { void loadCapability(); }, [loadCapability]);

  const engineers = useMemo(() => showcase?.engineers ?? [], [showcase]);
  const primarySme = engineers.find((engineer) => engineer.capabilityRole === "PRIMARY_SME");
  const backups = engineers.filter((engineer) => engineer.capabilityRole === "BACKUP_SME");
  const developing = engineers.filter((engineer) => engineer.capabilityRole === "DEVELOPING_BACKUP");
  const skillGaps = showcase?.requiredSkills.filter((skill) => skill.qualifiedEngineerCount < skill.minimumQualifiedEngineers) ?? [];
  const thresholdSkills = showcase?.requiredSkills.filter((skill) => skill.qualifiedEngineerCount === skill.minimumQualifiedEngineers) ?? [];
  const shiftGaps = showcase?.shiftCoverage.filter((shift) => !shift.covered) ?? [];
  const peopleScore = Math.round(showcase?.peopleResilienceScore ?? 0);

  const filteredEngineers = useMemo(() => {
    const query = search.trim().toLowerCase();
    return engineers.filter((engineer) => {
      const roleMatch = filter === "ALL" || engineer.capabilityRole === filter;
      const queryMatch = !query || [engineer.engineerName, engineer.discipline, engineer.shiftPattern, engineer.validationStatus].some((value) => value?.toLowerCase().includes(query));
      return roleMatch && queryMatch;
    });
  }, [engineers, filter, search]);

  const interventions = useMemo(() => {
    const rows: Array<{ title: string; detail: string; evidence: string; route: string }> = [];
    if (!primarySme) rows.push({ title: "Assign a validated primary SME", detail: "No accountable equipment owner is recorded.", evidence: "Primary ownership gap", route: "/engineers" });
    if (!backups.length) rows.push({ title: "Validate a backup SME", detail: "The equipment depends on one person's availability and retention.", evidence: `${developing.length} developing backup${developing.length === 1 ? "" : "s"}`, route: "/training" });
    skillGaps.slice(0, 2).forEach((skill) => rows.push({ title: `Close ${skill.name} coverage gap`, detail: `${skill.qualifiedEngineerCount} qualified against a minimum of ${skill.minimumQualifiedEngineers}.`, evidence: `${words(skill.criticality)} criticality`, route: "/training" }));
    if (shiftGaps.length) rows.push({ title: "Restore operator AM shift coverage", detail: `${shiftGaps.map((shift) => shift.shiftCode).join(", ")} shift coverage is below the validated threshold.`, evidence: `${showcase?.rotatingShiftCoverageCount ?? 0}/4 rotating shifts covered`, route: "/maintenance/labour-risk/shift-cover" });
    return rows.slice(0, 3);
  }, [backups.length, developing.length, primarySme, shiftGaps, showcase?.rotatingShiftCoverageCount, skillGaps]);

  const askVorta = useCallback((prompt?: string) => {
    if (!equipment) return;
    const resolvedPrompt = prompt || question.trim() || `Explain the people and capability risk for ${equipment.name}. Rank the most valuable training, validation, backup-SME and shift-cover actions.`;
    navigate(`/equipment/${equipment.id}/ai-insights?prompt=${encodeURIComponent(resolvedPrompt)}`);
  }, [equipment, navigate, question]);

  const copyAsset = useCallback(async () => {
    if (!equipment || !navigator.clipboard) return;
    await navigator.clipboard.writeText(equipment.assetNumber);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }, [equipment]);

  if (!equipment) return <section className="flex w-full flex-col overflow-x-hidden pb-10"><div className="border-b border-gray-800 bg-[#0b0e14] px-4 py-4 md:px-6"><div className="h-40 animate-pulse rounded-xl bg-[#141820]" /></div></section>;

  const riskTotal = equipment.riskBreakdown.reduce((sum, driver) => sum + driver.pct, 0) || 1;
  const briefing = `${equipment.name} has a people resilience score of ${peopleScore}%. ${primarySme ? `${primarySme.engineerName} is the validated primary SME.` : "No validated primary SME is recorded."} ${backups.length ? `${backups.length} validated backup${backups.length === 1 ? " is" : "s are"} available.` : "No validated backup SME is available."} ${skillGaps.length ? `${skillGaps.length} required skill gap${skillGaps.length === 1 ? " requires" : "s require"} action.` : "All mapped required skills meet their minimum threshold."}`;

  return (
    <section className="flex w-full flex-col gap-0 overflow-x-hidden pb-10">
      {loadError ? <div className="mx-4 mt-4 rounded-xl border border-red-500/25 bg-red-500/[0.06] px-4 py-3 text-xs text-red-200 md:mx-6">{loadError}</div> : null}
      <div className="sticky top-0 z-10 border-b border-gray-800 bg-[#0b0e14] px-4 pb-4 pt-4 md:px-6">
        <div className="mb-4 flex items-center justify-between gap-4">
          <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1.5 text-sm text-slate-500"><button type="button" onClick={() => navigate("/equipment")} className="hover:text-slate-300">Equipment</button><ChevronRight className="h-3.5 w-3.5 shrink-0" /><span className="truncate text-slate-300">{equipment.name} ({equipment.assetNumber})</span></nav>
          <div className="flex shrink-0 items-center gap-2"><Button type="button" variant="outline" onClick={() => void copyAsset()} className="h-auto gap-2 border-gray-700 bg-transparent px-3 py-1.5 text-xs text-slate-300 hover:bg-gray-800">{copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}{copied ? "Copied" : "Copy asset ref"}</Button><button type="button" onClick={() => void loadCapability()} disabled={loading} aria-label="Refresh capability intelligence" className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-400 hover:bg-gray-800 disabled:opacity-50"><RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /></button><button type="button" onClick={() => navigate(`/equipment/${equipment.id}/notifications`)} aria-label="Equipment notifications" className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-400 hover:bg-gray-800"><Bell className="h-4 w-4" /></button><button type="button" onClick={() => navigate("/settings")} aria-label="Profile settings" className="inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-gray-800"><UserCircle className="h-7 w-7" /></button></div>
        </div>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:gap-6">
          <div className="h-28 w-32 shrink-0 overflow-hidden rounded-xl border border-gray-800 bg-[#141820]"><img src={equipment.image} alt={equipment.name} className="h-full w-full object-cover" onError={(event) => { event.currentTarget.style.display = "none"; }} /></div>
          <div className="flex min-w-0 flex-1 flex-col gap-3"><div className="flex flex-wrap items-center gap-2.5"><h1 className="text-2xl font-bold tracking-tight text-slate-50">{equipment.name}</h1><Badge className={`inline-flex h-auto rounded border px-2 py-0.5 text-[10px] font-bold uppercase shadow-none ${riskTone(equipment.riskLevel)}`}>{equipment.riskLevel} Risk</Badge></div><div className="flex flex-wrap items-center gap-2"><EquipmentRiskIndicator riskLevel={equipment.riskLevel} /><span className="text-sm font-semibold text-slate-200">{equipment.status}</span><span className="text-sm text-slate-500">{equipment.statusNote}</span></div><div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-400"><span className="font-medium text-slate-300">{equipment.assetNumber}</span><span className="rounded bg-gray-800 px-1.5 py-0.5 font-medium tracking-wide">{equipment.type}</span><span>📍 {equipment.area}</span><span>Manufacturer: <span className="text-slate-300">{equipment.manufacturer}</span></span><span>Model: <span className="text-slate-300">{equipment.model}</span></span><span>Criticality: <span className="text-slate-300">{equipment.criticality}</span></span></div></div>
          <div className="flex shrink-0 flex-col gap-2 lg:w-52"><span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Risk Score</span><div className="flex items-end gap-3"><span className="text-4xl font-bold text-slate-50">{equipment.riskScore}%</span><Badge className={`mb-1 inline-flex h-auto rounded border px-2 py-0.5 text-[10px] font-bold uppercase shadow-none ${riskTone(equipment.riskLevel)}`}>{equipment.riskLevel}</Badge></div><div className="flex flex-col gap-1.5"><span className="text-xs font-medium text-slate-500">Risk drivers</span><div className="flex h-2 overflow-hidden rounded-full bg-gray-800">{equipment.riskBreakdown.map((driver) => <div key={driver.label} style={{ width: `${(driver.pct / riskTotal) * 100}%`, backgroundColor: driver.color }} />)}</div><div className="flex flex-wrap gap-x-2 gap-y-0.5">{equipment.riskBreakdown.map((driver) => <span key={driver.label} className="inline-flex items-center gap-1 text-[10px] text-slate-400"><span className={`h-1.5 w-1.5 rounded-full ${driver.dotClass}`} />{driver.label} {driver.pct}%</span>)}</div></div></div>
        </div>
        <EquipmentTabNavigation equipmentId={equipment.id} activeTab="skills" />
      </div>

      <div className="flex flex-col gap-4 px-4 pt-4 md:px-6">
        <Card className="overflow-hidden rounded-2xl border border-emerald-500/25 bg-[linear-gradient(135deg,#121a19_0%,#10151d_55%,#101b17_100%)] shadow-none"><CardContent className="p-0"><div className="grid xl:grid-cols-[minmax(0,1.45fr)_minmax(310px,0.55fr)]"><div className="p-5 md:p-6"><div className="flex flex-wrap items-center gap-2"><Badge className="h-auto rounded bg-emerald-500/15 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-emerald-300 shadow-none">People and capability intelligence</Badge><span className="inline-flex items-center gap-1.5 text-[11px] text-slate-500"><Database className="h-3.5 w-3.5" />Skills · validation · shift cover · development · {dateTimeLabel(lastUpdated)}</span></div><h2 className="mt-4 text-xl font-semibold text-slate-50">Capability Resilience Briefing</h2><p className="mt-2 max-w-4xl text-sm leading-6 text-slate-300">{briefing}</p><div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Metric label="People resilience" value={`${peopleScore}%`} detail={`${engineers.length} engineers · ${showcase?.activeAmOperatorCount ?? 0} AM operators`} tone={peopleScore >= 80 ? "text-emerald-300" : peopleScore >= 60 ? "text-amber-300" : "text-red-300"} /><Metric label="Required skills" value={showcase?.requiredSkillCount ?? 0} detail={`${skillGaps.length} gaps · ${thresholdSkills.length} at minimum threshold`} tone={skillGaps.length ? "text-red-300" : "text-emerald-300"} /><Metric label="Backup depth" value={backups.length} detail={`${developing.length} developing backup${developing.length === 1 ? "" : "s"}`} tone={backups.length ? "text-emerald-300" : "text-red-300"} /><Metric label="AM shift coverage" value={`${showcase?.rotatingShiftCoverageCount ?? 0}/4`} detail={`${shiftGaps.length} shift gap${shiftGaps.length === 1 ? "" : "s"}`} tone={shiftGaps.length ? "text-amber-300" : "text-emerald-300"} /></div><div className="mt-5 flex flex-col gap-2 sm:flex-row"><div className="flex min-h-11 flex-1 items-center gap-2 rounded-xl border border-gray-700 bg-[#0a0f16] px-3 focus-within:border-emerald-500/60"><Sparkles className="h-4 w-4 shrink-0 text-emerald-400" /><input value={question} onChange={(event) => setQuestion(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") askVorta(); }} placeholder={`Ask Vorta about ${equipment.assetNumber} capability...`} className="min-w-0 flex-1 bg-transparent text-sm text-slate-200 outline-none placeholder:text-slate-600" /></div><Button type="button" onClick={() => askVorta()} className="min-h-11 gap-2 bg-emerald-600 px-5 text-white hover:bg-emerald-500"><BrainCircuit className="h-4 w-4" />Ask Vorta</Button></div></div><div className="border-t border-gray-800 bg-[#0b1017]/70 p-5 xl:border-l xl:border-t-0 md:p-6"><p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">Highest people exposure</p><div className="mt-4"><SmeProfile engineer={primarySme} large /><div className={`mt-5 rounded-xl border p-4 ${backups.length ? "border-emerald-500/20 bg-emerald-500/[0.05]" : "border-red-500/25 bg-red-500/[0.06]"}`}><div className="flex items-center gap-2">{backups.length ? <ShieldCheck className="h-4 w-4 text-emerald-400" /> : <ShieldAlert className="h-4 w-4 text-red-400" />}<p className={`text-xs font-semibold ${backups.length ? "text-emerald-200" : "text-red-200"}`}>{backups.length ? `${backups.length} validated backup${backups.length === 1 ? "" : "s"}` : "Single-person dependency"}</p></div><p className="mt-2 text-xs leading-5 text-slate-400">{backups.length ? "Validated backup depth reduces availability and succession exposure." : "Leave, shift conflict or role movement could remove the strongest equipment knowledge."}</p></div><button type="button" onClick={() => navigate("/engineers")} className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-400 hover:text-emerald-300">Open workforce evidence<ArrowRight className="h-3.5 w-3.5" /></button></div></div></div></CardContent></Card>

        <Card className="rounded-2xl border border-amber-500/20 bg-[#141820] shadow-none"><CardContent className="p-5 md:p-6"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-amber-400/80">Capability intervention queue</p><h2 className="mt-1 text-base font-semibold text-slate-100">Highest-value people actions</h2><p className="mt-1 text-xs leading-5 text-slate-500">Ranked from ownership depth, required-skill thresholds, AM shift coverage and active development paths.</p></div><Badge className="h-auto rounded border border-amber-500/20 bg-amber-500/[0.07] px-2 py-1 text-[10px] font-semibold text-amber-300 shadow-none">{interventions.length} active actions</Badge></div><div className="mt-5 grid gap-3 xl:grid-cols-3">{interventions.map((item, index) => <article key={item.title} className="flex min-h-[210px] flex-col rounded-xl border border-gray-800 bg-[#0d1219] p-4"><div className="flex items-start gap-3"><span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-500/10 text-xs font-bold text-amber-300">{index + 1}</span><div><p className="text-sm font-semibold leading-5 text-slate-100">{item.title}</p><p className="mt-2 text-xs leading-5 text-slate-400">{item.detail}</p></div></div><div className="mt-4 rounded-lg border border-gray-800 bg-[#0a0f16] p-3"><p className="text-[9px] font-semibold uppercase tracking-wide text-slate-600">Evidence</p><p className="mt-1 text-xs text-slate-300">{item.evidence}</p></div><button type="button" onClick={() => navigate(item.route)} className="mt-auto inline-flex items-center justify-end gap-1.5 pt-4 text-xs font-semibold text-amber-300 hover:text-amber-200">Open supporting workflow<ChevronRight className="h-3.5 w-3.5" /></button></article>)}{!loading && interventions.length === 0 ? <div className="xl:col-span-3 rounded-xl border border-emerald-500/20 bg-emerald-500/[0.05] px-4 py-8 text-center"><ShieldCheck className="mx-auto h-6 w-6 text-emerald-400" /><p className="mt-3 text-sm font-semibold text-emerald-200">No immediate capability intervention required</p><p className="mt-1 text-xs text-slate-500">Ownership, backup depth, required skills and rotating-shift AM cover meet the current thresholds.</p></div> : null}</div></CardContent></Card>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(340px,0.65fr)]"><Card className="rounded-2xl border border-gray-800 bg-[#141820] shadow-none"><CardContent className="p-0"><div className="border-b border-gray-800 p-5"><div className="flex items-center gap-2"><Wrench className="h-4 w-4 text-blue-400" /><h2 className="text-base font-semibold text-slate-100">Required Skill Coverage Map</h2></div><p className="mt-1 text-xs text-slate-500">Validated engineering depth against the minimum capability required for this equipment.</p></div><div className="divide-y divide-gray-800">{showcase?.requiredSkills.map((skill) => { const minimum = Math.max(1, skill.minimumQualifiedEngineers); const shortfall = Math.max(0, minimum - skill.qualifiedEngineerCount); const width = Math.min(100, (skill.qualifiedEngineerCount / Math.max(minimum + 1, skill.qualifiedEngineerCount)) * 100); return <div key={skill.id || skill.skillId} className="grid gap-3 px-5 py-4 lg:grid-cols-[minmax(0,1.45fr)_110px_minmax(180px,0.8fr)_110px] lg:items-center"><div><p className="text-sm font-semibold text-slate-100">{skill.name}</p><p className="mt-1 text-[10px] text-slate-500">{words(skill.category)} · Level {skill.requiredLevel} · {words(skill.criticality)}</p></div><div className="text-xs text-slate-400"><span className="font-semibold text-slate-200">{skill.qualifiedEngineerCount}</span> qualified / {minimum} minimum</div><div><div className="h-1.5 overflow-hidden rounded-full bg-gray-800"><div className={`h-full rounded-full ${shortfall ? "bg-red-400" : skill.qualifiedEngineerCount === minimum ? "bg-amber-400" : "bg-emerald-400"}`} style={{ width: `${width}%`, opacity: 0.72 }} /></div></div><Badge className={`h-auto justify-self-start rounded border px-2 py-1 text-[10px] font-semibold shadow-none lg:justify-self-end ${shortfall ? "border-red-500/25 bg-red-500/10 text-red-300" : skill.qualifiedEngineerCount === minimum ? "border-amber-500/25 bg-amber-500/10 text-amber-300" : "border-emerald-500/25 bg-emerald-500/10 text-emerald-300"}`}>{shortfall ? `${shortfall} short` : skill.qualifiedEngineerCount === minimum ? "At threshold" : "Resilient"}</Badge></div>; })}</div></CardContent></Card><Card className="rounded-2xl border border-gray-800 bg-[#141820] shadow-none"><CardContent className="p-5 md:p-6"><div className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-emerald-400" /><h2 className="text-base font-semibold text-slate-100">Equipment Ownership Depth</h2></div><p className="mt-1 text-xs text-slate-500">Primary ownership, validated backup depth and succession exposure.</p><div className="mt-5 rounded-xl border border-emerald-500/20 bg-emerald-500/[0.05] p-4"><SmeProfile engineer={primarySme} /></div><div className="mt-4 grid grid-cols-2 gap-3"><Metric label="Validated backups" value={backups.length} detail="Ready to deputise" tone={backups.length ? "text-emerald-300" : "text-red-300"} /><Metric label="Developing backups" value={developing.length} detail="Succession pipeline" tone={developing.length ? "text-amber-300" : "text-slate-100"} /></div><Button type="button" variant="outline" onClick={() => navigate("/engineers")} className="mt-4 h-9 w-full gap-2 border-gray-700 bg-transparent px-3 text-xs text-slate-300 hover:bg-gray-800"><Users className="h-3.5 w-3.5" />Open engineer register</Button></CardContent></Card></div>

        <Card className="rounded-2xl border border-gray-800 bg-[#141820] shadow-none"><CardContent className="p-0"><div className="flex flex-col gap-3 border-b border-gray-800 p-4 lg:flex-row lg:items-center lg:justify-between md:p-5"><div><div className="flex items-center gap-2"><Users className="h-4 w-4 text-blue-400" /><h2 className="text-base font-semibold text-slate-100">Engineering Capability Register</h2></div><p className="mt-1 text-xs text-slate-500">Database-linked profiles, validated match, role depth and shift allocation.</p></div><div className="flex flex-col gap-2 xl:flex-row"><div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search engineer, discipline, shift..." className="h-9 w-full rounded-lg border border-gray-700 bg-[#0b0e14] pl-9 pr-3 text-xs text-slate-200 outline-none placeholder:text-slate-600 focus:border-blue-500 sm:w-64" /></div><div className="flex rounded-lg border border-gray-700 bg-[#0b0e14] p-1">{([["All","ALL"],["Primary","PRIMARY_SME"],["Backups","BACKUP_SME"],["Developing","DEVELOPING_BACKUP"]] as const).map(([label, value]) => <button key={value} type="button" onClick={() => setFilter(value)} className={`rounded-md px-2.5 py-1.5 text-xs font-medium ${filter === value ? "bg-blue-600 text-white" : "text-slate-500 hover:text-slate-300"}`}>{label}</button>)}</div></div></div><div className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-3 md:p-5">{loading ? Array.from({ length: 6 }).map((_, index) => <div key={index} className="h-40 animate-pulse rounded-xl bg-[#171c25]" />) : filteredEngineers.map((engineer) => <EngineerCard key={engineer.capabilityId || engineer.engineerId} engineer={engineer} />)}</div>{!loading && !filteredEngineers.length ? <div className="px-4 py-12 text-center"><Users className="mx-auto h-7 w-7 text-slate-600" /><p className="mt-3 text-sm text-slate-300">No engineers match this view</p></div> : null}</CardContent></Card>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(360px,0.9fr)]"><Card className="rounded-2xl border border-gray-800 bg-[#141820] shadow-none"><CardContent className="p-5 md:p-6"><div className="flex items-start justify-between gap-3"><div><div className="flex items-center gap-2"><Wrench className="h-4 w-4 text-violet-400" /><h2 className="text-base font-semibold text-slate-100">Operator AM Shift Readiness</h2></div><p className="mt-1 text-xs text-slate-500">Validated autonomous-maintenance capability on each rotating shift.</p></div><Badge className="h-auto rounded border border-violet-500/20 bg-violet-500/[0.07] px-2 py-1 text-[10px] font-semibold text-violet-300 shadow-none">{showcase?.activeAmOperatorCount ?? 0} active</Badge></div><div className="mt-5 grid gap-3 sm:grid-cols-2">{showcase?.shiftCoverage.map((shift) => { const operators = showcase.operators.filter((operator) => operator.shiftName === shift.shiftCode); return <article key={shift.shiftCode} className={`rounded-xl border p-4 ${shift.covered ? "border-emerald-500/20 bg-emerald-500/[0.04]" : "border-amber-500/25 bg-amber-500/[0.05]"}`}><div className="flex items-center justify-between"><div><p className="text-sm font-semibold text-slate-100">{shift.shiftCode} shift</p><p className="mt-1 text-[10px] text-slate-500">{shift.validatedAmOperatorCount} validated operators</p></div><Badge className={`h-auto rounded border px-2 py-1 text-[10px] font-semibold shadow-none ${shift.covered ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-300" : "border-amber-500/25 bg-amber-500/10 text-amber-300"}`}>{shift.covered ? "Covered" : "Gap"}</Badge></div><div className="mt-3">{operators.length ? operators.map((operator) => <OperatorRow key={operator.assignmentId || operator.operatorId} operator={operator} />) : <div className="rounded-lg border border-amber-500/20 bg-amber-500/[0.05] px-3 py-4 text-center"><AlertTriangle className="mx-auto h-4 w-4 text-amber-400" /><p className="mt-2 text-[11px] text-amber-200">No validated operator assigned</p></div>}</div></article>; })}</div></CardContent></Card><Card className="rounded-2xl border border-gray-800 bg-[#141820] shadow-none"><CardContent className="p-5 md:p-6"><div className="flex items-start justify-between gap-3"><div><div className="flex items-center gap-2"><GraduationCap className="h-4 w-4 text-blue-400" /><h2 className="text-base font-semibold text-slate-100">Capability Development Pipeline</h2></div><p className="mt-1 text-xs text-slate-500">Active pathways building future equipment resilience.</p></div><Badge className="h-auto rounded border border-blue-500/20 bg-blue-500/[0.07] px-2 py-1 text-[10px] font-semibold text-blue-300 shadow-none">{showcase?.developmentPaths.length ?? 0} active</Badge></div><div className="mt-5 space-y-3">{showcase?.developmentPaths.map((path) => <DevelopmentCard key={`${path.personType}-${path.pathId}`} path={path} />)}{!loading && !showcase?.developmentPaths.length ? <div className="rounded-xl border border-amber-500/20 bg-amber-500/[0.05] px-4 py-10 text-center"><GraduationCap className="mx-auto h-6 w-6 text-amber-400" /><p className="mt-3 text-sm font-semibold text-amber-200">No active development path</p></div> : null}</div></CardContent></Card></div>

        <Card className="rounded-2xl border border-gray-800 bg-[#141820] shadow-none"><CardContent className="p-5"><div className="flex flex-wrap items-center justify-between gap-4"><div><div className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-emerald-400" /><h2 className="text-sm font-semibold text-slate-100">Capability Investigation</h2></div><p className="mt-1 text-xs text-slate-500">Continue into workforce, training, shift cover and AI analysis.</p></div><div className="flex flex-wrap gap-2"><Button type="button" variant="outline" onClick={() => navigate("/engineers")} className="h-9 gap-2 border-gray-700 bg-transparent px-3 text-xs text-slate-300 hover:bg-gray-800"><Users className="h-3.5 w-3.5" />View engineers</Button><Button type="button" variant="outline" onClick={() => navigate("/training")} className="h-9 gap-2 border-gray-700 bg-transparent px-3 text-xs text-slate-300 hover:bg-gray-800"><GraduationCap className="h-3.5 w-3.5" />Open training</Button><Button type="button" variant="outline" onClick={() => navigate("/maintenance/labour-risk/shift-cover")} className="h-9 gap-2 border-gray-700 bg-transparent px-3 text-xs text-slate-300 hover:bg-gray-800"><Wrench className="h-3.5 w-3.5" />View shift cover</Button><Button type="button" onClick={() => askVorta()} className="h-9 gap-2 bg-emerald-600 px-3 text-xs text-white hover:bg-emerald-500"><BrainCircuit className="h-3.5 w-3.5" />Analyse capability</Button></div></div></CardContent></Card>
      </div>
    </section>
  );
};
