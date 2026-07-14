import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  AlertTriangle,
  Bell,
  CheckCircle2,
  ChevronRight,
  Edit,
  GraduationCap,
  RefreshCw,
  ShieldCheck,
  UserCircle,
  Users,
  Wrench,
} from "lucide-react";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Card, CardContent } from "../../components/ui/card";

import { EquipmentBase, DEFAULT_EQUIPMENT_ID } from "./equipmentData";
import {
  EquipmentDevelopmentPath,
  EquipmentEngineerCapability,
  EquipmentOperatorCapability,
  EquipmentRequiredSkill,
  EquipmentSkillsShowcase,
  getCachedEquipmentIdentity,
  getEquipmentIdentityById,
  getEquipmentSkillsShowcase,
} from "./equipmentService";
import { EquipmentTabNavigation } from "./EquipmentTabNavigation";
import { EquipmentRiskIndicator } from "./EquipmentRiskIndicator";

const ROLE_STYLES: Record<string, string> = {
  PRIMARY_SME: "bg-emerald-500/15 text-emerald-300",
  BACKUP_SME: "bg-blue-500/15 text-blue-300",
  DEVELOPING_BACKUP: "bg-amber-500/15 text-amber-300",
  QUALIFIED_SUPPORT: "bg-slate-500/15 text-slate-300",
};

function words(value?: string | null) {
  return value ? value.replaceAll("_", " ").toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase()) : "—";
}

function initials(name?: string | null) {
  return (name ?? "?").split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase();
}

function dateLabel(value?: string | null) {
  if (!value) return "No target date";
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" }).format(new Date(value));
}

function StatCard({ label, value, detail, tone = "text-slate-50" }: { label: string; value: string; detail: string; tone?: string }) {
  return (
    <Card className="rounded-xl border border-gray-800 bg-[#141820] shadow-none">
      <CardContent className="p-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">{label}</p>
        <p className={`mt-2 text-2xl font-bold ${tone}`}>{value}</p>
        <p className="mt-1 text-xs text-slate-500">{detail}</p>
      </CardContent>
    </Card>
  );
}

function SkillStatus({ skill }: { skill: EquipmentRequiredSkill }) {
  const covered = skill.qualifiedEngineerCount >= skill.minimumQualifiedEngineers;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-bold ${covered ? "bg-emerald-500/15 text-emerald-300" : "bg-red-500/15 text-red-300"}`}>
      {covered ? <CheckCircle2 className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
      {covered ? "Covered" : "Gap"}
    </span>
  );
}

function EngineerRow({ engineer }: { engineer: EquipmentEngineerCapability }) {
  const role = engineer.capabilityRole || "QUALIFIED_SUPPORT";
  return (
    <div className="flex gap-3 border-b border-gray-800 py-3 last:border-0">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-500/15 text-xs font-bold text-blue-300">{initials(engineer.engineerName)}</div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-semibold text-slate-100">{engineer.engineerName}</p>
          <Badge className={`h-auto rounded px-2 py-0.5 text-[9px] font-bold shadow-none ${ROLE_STYLES[role] ?? ROLE_STYLES.QUALIFIED_SUPPORT}`}>{words(role)}</Badge>
        </div>
        <p className="mt-1 text-xs text-slate-500">{words(engineer.discipline)} · {words(engineer.shiftPattern)} · Level {engineer.competencyLevel ?? "—"}</p>
        <p className="mt-1 text-[11px] text-slate-400">{engineer.requiredSkillMatches}/{engineer.requiredSkillTotal} required skills matched · {words(engineer.validationStatus)}</p>
      </div>
    </div>
  );
}

function OperatorRow({ operator }: { operator: EquipmentOperatorCapability }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-gray-800 py-2.5 last:border-0">
      <div className="flex min-w-0 items-center gap-2.5">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-violet-500/15 text-[10px] font-bold text-violet-300">{initials(operator.operatorName)}</div>
        <div className="min-w-0">
          <p className="truncate text-xs font-semibold text-slate-200">{operator.operatorName}</p>
          <p className="text-[10px] text-slate-500">{words(operator.roleOnEquipment)} · {operator.validatedAmSkillCount} AM skills</p>
        </div>
      </div>
      <div className="text-right">
        <p className="text-xs font-semibold text-slate-300">AM {operator.amStep ?? "—"}</p>
        <p className="text-[10px] text-slate-500">{words(operator.amValidationStatus)}</p>
      </div>
    </div>
  );
}

function DevelopmentPathRow({ path }: { path: EquipmentDevelopmentPath }) {
  const supervised = `${path.supervisedCompleted}/${path.supervisedRequired}`;
  const evidence = `${path.evidenceCompleted}/${path.evidenceRequired}`;
  return (
    <div className="grid gap-3 border-b border-gray-800 py-4 last:border-0 md:grid-cols-[1.3fr_1.4fr_0.8fr_1fr] md:items-center">
      <div>
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold text-slate-100">{path.personName}</p>
          <Badge className="h-auto rounded bg-slate-500/15 px-2 py-0.5 text-[9px] font-bold text-slate-300 shadow-none">{words(path.personType)}</Badge>
        </div>
        <p className="mt-1 text-xs text-slate-500">{words(path.shiftName)} · Mentor: {path.mentorName || "Unassigned"}</p>
      </div>
      <div>
        <p className="text-xs text-slate-500">{words(path.currentJobRole)}</p>
        <p className="mt-0.5 text-xs font-semibold text-blue-300">→ {words(path.targetJobRole || path.targetCapabilityRole)}</p>
      </div>
      <div>
        <div className="mb-1 flex items-center justify-between text-[10px] text-slate-500"><span>Readiness</span><span>{path.readinessScore}%</span></div>
        <div className="h-1.5 overflow-hidden rounded-full bg-gray-800"><div className="h-full rounded-full bg-blue-500" style={{ width: `${Math.min(100, path.readinessScore)}%` }} /></div>
      </div>
      <div className="text-xs text-slate-400">
        <p>Supervised {supervised} · Evidence {evidence}</p>
        <p className="mt-1 text-[10px] text-slate-500">Target {dateLabel(path.targetCompletionDate)}</p>
      </div>
    </div>
  );
}

export const EquipmentSkills = (): JSX.Element => {
  const navigate = useNavigate();
  const { equipmentId } = useParams<{ equipmentId?: string }>();
  const resolvedId = equipmentId ?? DEFAULT_EQUIPMENT_ID;
  const [eq, setEq] = useState<EquipmentBase | null>(() => getCachedEquipmentIdentity(resolvedId));
  const [showcase, setShowcase] = useState<EquipmentSkillsShowcase | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadShowcase = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setShowcase(await getEquipmentSkillsShowcase(resolvedId));
    } catch (loadError) {
      setShowcase(null);
      setError(loadError instanceof Error ? loadError.message : "Unable to load equipment skills.");
    } finally {
      setLoading(false);
    }
  }, [resolvedId]);

  useEffect(() => { getEquipmentIdentityById(resolvedId).then(setEq); }, [resolvedId]);
  useEffect(() => { void loadShowcase(); }, [loadShowcase]);

  if (!eq) {
    return <section className="flex w-full flex-col pb-10"><div className="border-b border-gray-800 bg-[#0b0e14] px-4 py-4 md:px-6"><div className="h-40 animate-pulse rounded-xl bg-[#141820]" /></div></section>;
  }

  const riskBadgeClass = eq.riskLevel === "Critical" ? "bg-[#ef444420] text-red-400" : eq.riskLevel === "High" ? "bg-[#f9731620] text-orange-400" : eq.riskLevel === "Medium" ? "bg-[#eab30820] text-yellow-400" : "bg-[#10b98120] text-emerald-400";
  const riskTotal = eq.riskBreakdown.reduce((sum, item) => sum + item.pct, 0) || 1;

  const primarySme = showcase?.engineers.find((engineer) => engineer.capabilityRole === "PRIMARY_SME");
  const gaps = showcase?.requiredSkills.filter((skill) => skill.qualifiedEngineerCount < skill.minimumQualifiedEngineers).length ?? 0;

  return (
    <section className="flex w-full flex-col gap-0 overflow-x-hidden pb-10">
      <div className="sticky top-0 z-10 border-b border-gray-800 bg-[#0b0e14] px-4 pb-4 pt-4 md:px-6">
        {/* Top bar */}
        <div className="mb-4 flex items-center justify-between gap-4">
          <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-sm text-slate-500">
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
            <button type="button" onClick={() => navigate("/settings")} className="inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-gray-800 hover:text-slate-200 transition-colors">
              <UserCircle className="h-7 w-7" />
            </button>
          </div>
        </div>

        {/* Equipment header row */}
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
              <EquipmentRiskIndicator riskLevel={eq.riskLevel} />
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
              <span className="text-xs font-medium text-slate-500">Risk Drivers</span>
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

        <EquipmentTabNavigation equipmentId={eq.id} activeTab="skills" />
      </div>

      <div className="flex flex-col gap-4 px-4 pt-4 md:px-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div><h2 className="text-lg font-bold text-slate-50">Equipment Skills & Capability</h2><p className="text-xs text-slate-500">Validated engineering cover, autonomous maintenance capability and active development paths for this asset.</p></div>
          <Button type="button" variant="outline" onClick={() => void loadShowcase()} disabled={loading} className="h-auto gap-2 border-gray-700 bg-transparent px-3 py-1.5 text-xs text-slate-300 hover:bg-gray-800 hover:text-slate-100"><RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh</Button>
        </div>

        {loading ? <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">{Array.from({ length: 4 }).map((_, index) => <div key={index} className="h-28 animate-pulse rounded-xl border border-gray-800 bg-[#141820]" />)}</div> : null}
        {error ? <Card className="rounded-xl border border-red-500/30 bg-red-500/5 shadow-none"><CardContent className="flex items-center justify-between gap-4 p-4"><div className="flex gap-3"><AlertTriangle className="h-5 w-5 shrink-0 text-red-400" /><div><p className="text-sm font-semibold text-red-300">Skills data could not be loaded</p><p className="mt-1 text-xs text-slate-400">{error}</p></div></div><Button type="button" variant="outline" onClick={() => void loadShowcase()} className="border-red-500/30 bg-transparent text-xs text-red-300">Retry</Button></CardContent></Card> : null}

        {showcase && !loading ? (
          <>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <StatCard label="Required skills" value={`${showcase.requiredSkillCount}`} detail={`${gaps} coverage ${gaps === 1 ? "gap" : "gaps"}`} tone={gaps ? "text-amber-300" : "text-emerald-300"} />
              <StatCard label="Primary SME" value={primarySme?.engineerName ?? "Unassigned"} detail={primarySme ? `${primarySme.requiredSkillMatches}/${primarySme.requiredSkillTotal} skills matched` : "Critical ownership gap"} tone={primarySme ? "text-emerald-300" : "text-red-300"} />
              <StatCard label="Backup resilience" value={showcase.backupSmeCount ? `${showcase.backupSmeCount} validated` : `${showcase.developingBackupCount} developing`} detail={showcase.backupSmeCount ? "Validated backup cover in place" : "No validated backup SME"} tone={showcase.backupSmeCount ? "text-emerald-300" : "text-amber-300"} />
              <StatCard label="AM shift coverage" value={`${showcase.rotatingShiftCoverageCount}/4 shifts`} detail={`${showcase.activeAmOperatorCount} active AM operators`} tone={showcase.rotatingShiftGapCount ? "text-amber-300" : "text-emerald-300"} />
            </div>

            <Card className="rounded-xl border border-gray-800 bg-[#141820] shadow-none">
              <CardContent className="p-0">
                <div className="flex items-center justify-between border-b border-gray-800 px-4 py-3"><div className="flex items-center gap-2"><Wrench className="h-4 w-4 text-blue-400" /><h3 className="text-sm font-semibold text-slate-100">Required skills matrix</h3></div><span className="text-xs text-slate-500">Validated coverage only</span></div>
                <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left"><thead className="border-b border-gray-800 bg-[#10141b] text-[10px] uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-3">Skill</th><th className="px-3 py-3">Category</th><th className="px-3 py-3">Level</th><th className="px-3 py-3">Qualified</th><th className="px-3 py-3">Minimum</th><th className="px-3 py-3">Criticality</th><th className="px-4 py-3">Status</th></tr></thead><tbody>{showcase.requiredSkills.map((skill) => <tr key={skill.id || skill.skillId} className="border-b border-gray-800 last:border-0"><td className="px-4 py-3 text-xs font-semibold text-slate-200">{skill.name}</td><td className="px-3 py-3 text-xs text-slate-400">{words(skill.category)}</td><td className="px-3 py-3 text-xs text-slate-300">{skill.requiredLevel}</td><td className="px-3 py-3 text-xs font-semibold text-slate-200">{skill.qualifiedEngineerCount}</td><td className="px-3 py-3 text-xs text-slate-400">{skill.minimumQualifiedEngineers}</td><td className="px-3 py-3 text-xs text-slate-400">{words(skill.criticality)}</td><td className="px-4 py-3"><SkillStatus skill={skill} /></td></tr>)}</tbody></table></div>
              </CardContent>
            </Card>

            <div className="grid gap-4 xl:grid-cols-2">
              <Card className="rounded-xl border border-gray-800 bg-[#141820] shadow-none"><CardContent className="p-4"><div className="mb-2 flex items-center justify-between"><div className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-emerald-400" /><h3 className="text-sm font-semibold text-slate-100">Engineering capability</h3></div><span className="text-xs text-slate-500">{showcase.engineers.length} assigned</span></div>{showcase.engineers.length ? showcase.engineers.map((engineer) => <EngineerRow key={engineer.capabilityId || engineer.engineerId} engineer={engineer} />) : <p className="py-8 text-center text-xs text-slate-500">No engineering capability assigned.</p>}</CardContent></Card>
              <Card className="rounded-xl border border-gray-800 bg-[#141820] shadow-none"><CardContent className="p-4"><div className="mb-2 flex items-center justify-between"><div className="flex items-center gap-2"><Users className="h-4 w-4 text-violet-400" /><h3 className="text-sm font-semibold text-slate-100">Operator AM coverage</h3></div><span className="text-xs text-slate-500">People resilience {showcase.peopleResilienceScore.toFixed(1)}%</span></div><div className="grid gap-3 sm:grid-cols-2">{showcase.shiftCoverage.map((shift) => { const shiftOperators = showcase.operators.filter((operator) => operator.shiftName === shift.shiftCode); return <div key={shift.shiftCode} className={`rounded-lg border p-3 ${shift.covered ? "border-emerald-500/20 bg-emerald-500/5" : "border-amber-500/20 bg-amber-500/5"}`}><div className="flex items-center justify-between"><p className="text-xs font-bold text-slate-200">{shift.shiftCode} shift</p><Badge className={`h-auto rounded px-2 py-0.5 text-[9px] font-bold shadow-none ${shift.covered ? "bg-emerald-500/15 text-emerald-300" : "bg-amber-500/15 text-amber-300"}`}>{shift.covered ? "Covered" : "Gap"}</Badge></div><p className="mt-1 text-[10px] text-slate-500">{shift.validatedAmOperatorCount} validated AM operator{shift.validatedAmOperatorCount === 1 ? "" : "s"}</p><div className="mt-2">{shiftOperators.length ? shiftOperators.map((operator) => <OperatorRow key={operator.assignmentId || operator.operatorId} operator={operator} />) : <p className="py-3 text-[11px] text-amber-300">No validated operator assigned</p>}</div></div>; })}</div></CardContent></Card>
            </div>

            <Card className="rounded-xl border border-gray-800 bg-[#141820] shadow-none"><CardContent className="p-4"><div className="mb-1 flex items-center justify-between"><div className="flex items-center gap-2"><GraduationCap className="h-4 w-4 text-blue-400" /><h3 className="text-sm font-semibold text-slate-100">Equipment career paths</h3></div><span className="text-xs text-slate-500">{showcase.developmentPaths.length} active</span></div>{showcase.developmentPaths.length ? showcase.developmentPaths.map((path) => <DevelopmentPathRow key={`${path.personType}-${path.pathId}`} path={path} />) : <p className="py-8 text-center text-xs text-slate-500">No active development paths for this equipment.</p>}</CardContent></Card>
          </>
        ) : null}
      </div>
    </section>
  );
};
