import {
  AlertTriangle,
  Bell,
  CheckCircle2,
  Database,
  Gauge,
  GraduationCap,
  Package,
  ShieldCheck,
} from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import type { EquipmentTabRoute } from "./EquipmentTabNavigation";
import {
  loadLiveEquipmentCalibrations,
  loadLiveEquipmentComponents,
  loadLiveEquipmentNotifications,
  loadLiveEquipmentSkills,
  loadLiveEquipmentWorkItems,
  type LiveCalibration,
  type LiveComponentsPayload,
  type LiveDataState,
  type LiveEquipmentRecord,
  type LiveNotification,
  type LiveSkillsPayload,
} from "./equipmentLiveTrust";
import {
  AskVortaButton,
  EvidenceStateMessage,
  LoadingEvidence,
  Metric,
  PageFrame,
  RefreshButton,
  formatDate,
  riskTone,
  usePilotEvidence,
} from "./EquipmentPilotEvidenceShared";

function EquipmentAskVortaButton({
  record,
  question,
}: {
  record: LiveEquipmentRecord;
  question: string;
}): JSX.Element {
  return (
    <AskVortaButton
      question={`${question} Use verified evidence for ${record.name} (${record.assetNumber}) only.`}
    />
  );
}

export function LiveEquipmentOverviewView({ record }: { record: LiveEquipmentRecord }): JSX.Element {
  const loadWork = useCallback(() => loadLiveEquipmentWorkItems(record.id), [record.id]);
  const loadCalibrations = useCallback(() => loadLiveEquipmentCalibrations(record.id), [record.id]);
  const loadSkills = useCallback(() => loadLiveEquipmentSkills(record.id), [record.id]);
  const loadComponents = useCallback(
    () => loadLiveEquipmentComponents(record.siteId, record.id),
    [record.id, record.siteId],
  );
  const work = usePilotEvidence(loadWork);
  const calibrations = usePilotEvidence(loadCalibrations);
  const skills = usePilotEvidence(loadSkills);
  const components = usePilotEvidence(loadComponents);
  const workCount = work.state?.status === "ready" ? work.state.data.length : null;
  const overdueCalibrations =
    calibrations.state?.status === "ready"
      ? calibrations.state.data.filter((item) => /overdue|critical/i.test(item.riskState ?? item.scheduleStatus)).length
      : null;
  const peopleScore = skills.state?.status === "ready" ? Math.round(skills.state.data.peopleResilienceScore) : null;
  const stockResilience =
    components.state?.status === "ready" ? components.state.data.stockResilience : null;
  const warnings = [work.state, calibrations.state, skills.state, components.state].filter(
    (state): state is Exclude<LiveDataState<unknown>, { status: "ready" }> =>
      Boolean(state && state.status !== "ready"),
  );
  const refreshAll = (): void => {
    work.reload();
    calibrations.reload();
    skills.reload();
    components.reload();
  };
  const loading = work.loading || calibrations.loading || skills.loading || components.loading;

  return (
    <PageFrame
      record={record}
      activeTab="overview"
      title={record.name}
      description={`Risk calculated ${formatDate(record.risk.updatedAt)} from site-scoped maintenance, calibration, labour and spares evidence.`}
      icon={Gauge}
      actions={
        <>
          <EquipmentAskVortaButton record={record} question="Explain the current equipment risk and the most useful next action." />
          <RefreshButton loading={loading} onClick={refreshAll} />
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Current risk" value={record.risk.score.toFixed(1)} detail={record.risk.level} tone={riskTone(record.risk.level).split(" ").at(-1)} />
        <Metric label="Work items" value={workCount ?? "—"} detail={work.state?.status === "empty" ? "No recorded work" : "Verified work-order rows"} />
        <Metric label="People resilience" value={peopleScore === null ? "—" : `${peopleScore}%`} detail="Validated equipment capability" />
        <Metric label="Stock resilience" value={stockResilience === null ? "—" : `${stockResilience}%`} detail="Quantity against configured target" />
      </div>

      {warnings.map((warning, index) => (
        <EvidenceStateMessage key={`${warning.status}-${index}`} state={warning} />
      ))}

      <div className="grid gap-4 xl:grid-cols-2">
        <div className="rounded-xl border border-gray-800 bg-[#141820] p-5">
          <h2 className="text-sm font-semibold text-slate-100">Stored risk drivers</h2>
          <div className="mt-4 space-y-3">
            {record.risk.breakdown.map((driver) => (
              <div key={driver.label}>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">{driver.label}</span>
                  <span className="font-semibold tabular-nums text-slate-200">{driver.pct.toFixed(1)}%</span>
                </div>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-gray-800">
                  <div className={`h-full rounded-full ${driver.dotClass}`} style={{ width: `${driver.pct}%`, opacity: 0.72 }} />
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-xl border border-gray-800 bg-[#141820] p-5">
          <h2 className="text-sm font-semibold text-slate-100">Operational priority</h2>
          <p className="mt-3 text-sm leading-6 text-slate-300">
            {record.risk.priorityAction ?? "No priority action is stored for the current calculation."}
          </p>
          <p className="mt-3 text-xs leading-5 text-slate-500">
            {record.risk.riskSummary ?? "No risk summary is stored for the current calculation."}
          </p>
          <div className="mt-5 grid grid-cols-2 gap-3">
            <Metric label="Overdue calibrations" value={overdueCalibrations ?? "—"} detail="Current equipment records" />
            <Metric label="Missing skills" value={record.risk.missingSkillCount} detail="Risk-profile count" />
          </div>
        </div>
      </div>
    </PageFrame>
  );
}

export function LiveEquipmentSparesView({ record }: { record: LiveEquipmentRecord }): JSX.Element {
  const loader = useCallback(
    () => loadLiveEquipmentComponents(record.siteId, record.id),
    [record.id, record.siteId],
  );
  const { state, loading, reload } = usePilotEvidence(loader);
  const payload = state?.status === "ready" ? state.data : null;
  return (
    <PageFrame
      record={record}
      activeTab="spares"
      title="Spares"
      description="Stock condition is calculated from available, minimum and target quantities. Imported status text is supporting evidence only."
      icon={Package}
      actions={
        <>
          <EquipmentAskVortaButton record={record} question="Explain the verified spare-parts exposure and replenishment priority." />
          <RefreshButton loading={loading} onClick={reload} />
        </>
      }
    >
      {loading && !state ? <LoadingEvidence label="Loading active-site component inventory…" /> : null}
      {state && state.status !== "ready" ? <EvidenceStateMessage state={state} /> : null}
      {payload ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Metric label="Stock resilience" value={payload.stockResilience === null ? "—" : `${payload.stockResilience}%`} detail={payload.stockResilience === null ? "No target quantities configured" : "Available units against target"} />
            <Metric label="Out of stock" value={payload.outOfStock} detail="Available quantity is zero" tone="text-red-300" />
            <Metric label="Low stock" value={payload.lowStock} detail="Below minimum quantity" tone="text-amber-300" />
            <Metric label="Below target" value={payload.belowTarget} detail="Above minimum, below target" tone="text-blue-300" />
          </div>
          <div className="overflow-x-auto rounded-xl border border-gray-800 bg-[#141820]">
            <table className="w-full min-w-[760px] text-left text-xs">
              <thead className="border-b border-gray-800 bg-[#0d1117] text-slate-500">
                <tr>
                  {['Part', 'Status', 'Stock', 'Minimum', 'Target', 'Supplier', 'Lead'].map((label) => (
                    <th key={label} className="px-4 py-3 font-semibold uppercase tracking-wider">{label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {payload.inventory.map((part) => (
                  <tr key={`${part.partNumber}-${part.name}`} className="border-b border-gray-800 last:border-0">
                    <td className="px-4 py-3"><p className="font-semibold text-slate-200">{part.name}</p><p className="mt-1 text-slate-600">{part.partNumber}</p></td>
                    <td className="px-4 py-3"><span className={`rounded-md border px-2 py-1 font-semibold ${part.derivedStatus === 'Out of stock' ? 'border-red-500/25 bg-red-500/10 text-red-300' : part.derivedStatus === 'Low stock' ? 'border-amber-500/25 bg-amber-500/10 text-amber-300' : part.derivedStatus === 'Below target' ? 'border-blue-500/25 bg-blue-500/10 text-blue-300' : 'border-emerald-500/25 bg-emerald-500/10 text-emerald-300'}`}>{part.derivedStatus}</span></td>
                    <td className="px-4 py-3 font-semibold tabular-nums text-slate-200">{part.stock}</td>
                    <td className="px-4 py-3 tabular-nums text-slate-400">{part.minimum}</td>
                    <td className="px-4 py-3 tabular-nums text-slate-400">{part.target}</td>
                    <td className="px-4 py-3 text-slate-400">{part.supplier}</td>
                    <td className="px-4 py-3 tabular-nums text-slate-400">{part.leadDays}d</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : null}
    </PageFrame>
  );
}

export function LiveEquipmentCalibrationsView({ record }: { record: LiveEquipmentRecord }): JSX.Element {
  const loader = useCallback(() => loadLiveEquipmentCalibrations(record.id), [record.id]);
  const { state, loading, reload } = usePilotEvidence(loader);
  const rows = state?.status === "ready" ? state.data : [];
  const overdue = rows.filter((item) => /overdue|critical/i.test(item.riskState ?? item.scheduleStatus));
  return (
    <PageFrame record={record} activeTab="pms" title="Calibrations" description="Verified calibration schedules, results, certificates and linked work-order evidence." icon={ShieldCheck} actions={<RefreshButton loading={loading} onClick={reload} />}>
      {loading && !state ? <LoadingEvidence label="Loading verified calibration evidence…" /> : null}
      {state && state.status !== "ready" ? <EvidenceStateMessage state={state} /> : null}
      {state?.status === "ready" ? (
        <>
          <div className="grid gap-3 sm:grid-cols-3"><Metric label="Calibration points" value={rows.length} detail="Configured records" /><Metric label="Overdue or critical" value={overdue.length} detail="Requires attention" tone="text-red-300" /><Metric label="Certificates linked" value={rows.filter((item) => item.certificateReference).length} detail="Certificate reference present" /></div>
          <div className="space-y-3">{rows.map((item: LiveCalibration) => <article key={item.id} className="rounded-xl border border-gray-800 bg-[#141820] p-4"><div className="flex flex-col gap-3 sm:flex-row sm:justify-between"><div><p className="text-sm font-semibold text-slate-100">{item.number} · {item.title}</p><p className="mt-1 text-xs text-slate-500">{item.point ?? 'Calibration point not recorded'} · Next due {formatDate(item.nextDueDate)}</p><p className="mt-2 text-xs text-slate-400">Result: {item.lastResult ?? '—'} · Certificate: {item.certificateReference ?? '—'}</p></div><span className="h-fit rounded-md border border-gray-700 px-2 py-1 text-xs font-semibold text-slate-300">{item.riskState ?? item.scheduleStatus}</span></div></article>)}</div>
        </>
      ) : null}
    </PageFrame>
  );
}

function textField(row: Record<string, unknown>, ...keys: string[]): string {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === "string" && value.trim()) return value;
  }
  return "—";
}

function numberField(row: Record<string, unknown>, ...keys: string[]): number {
  for (const key of keys) {
    const parsed = Number(row[key]);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
}

export function LiveEquipmentSkillsView({ record }: { record: LiveEquipmentRecord }): JSX.Element {
  const loader = useCallback(() => loadLiveEquipmentSkills(record.id), [record.id]);
  const { state, loading, reload } = usePilotEvidence(loader);
  const payload: LiveSkillsPayload | null = state?.status === "ready" ? state.data : null;
  return (
    <PageFrame record={record} activeTab="skills" title="Skills & Engineers" description="Validated equipment capability, SME ownership and required-skill coverage from the protected showcase function." icon={GraduationCap} actions={<><EquipmentAskVortaButton record={record} question="Explain the verified skills risk and the best development action." /><RefreshButton loading={loading} onClick={reload} /></>}>
      {loading && !state ? <LoadingEvidence label="Loading verified capability evidence…" /> : null}
      {state && state.status !== "ready" ? <EvidenceStateMessage state={state} /> : null}
      {payload ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Metric label="People resilience" value={`${Math.round(payload.peopleResilienceScore)}%`} detail="Validated capability score" /><Metric label="Required skills" value={payload.requiredSkillCount} detail="Configured requirements" /><Metric label="Primary SMEs" value={payload.primarySmeCount} detail="Validated owners" /><Metric label="Backup SMEs" value={payload.backupSmeCount} detail={`${payload.developingBackupCount} developing`} /></div>
          <div className="grid gap-4 xl:grid-cols-2">
            <div className="rounded-xl border border-gray-800 bg-[#141820] p-5"><h2 className="text-sm font-semibold text-slate-100">Required skill coverage</h2><div className="mt-3 space-y-2">{payload.requiredSkills.length ? payload.requiredSkills.map((skill, index) => <div key={textField(skill, 'skill_id', 'id') + index} className="flex items-center justify-between gap-3 rounded-lg border border-gray-800 bg-[#0d1117] px-3 py-3"><div><p className="text-xs font-semibold text-slate-200">{textField(skill, 'name', 'skill_name')}</p><p className="mt-1 text-[11px] text-slate-500">Required level {numberField(skill, 'required_level')} · Minimum {numberField(skill, 'minimum_qualified_engineers')} qualified</p></div><span className="text-sm font-bold tabular-nums text-blue-300">{numberField(skill, 'qualified_engineer_count')}</span></div>) : <p className="text-xs text-amber-300">No required skills returned.</p>}</div></div>
            <div className="rounded-xl border border-gray-800 bg-[#141820] p-5"><h2 className="text-sm font-semibold text-slate-100">Equipment capability owners</h2><div className="mt-3 space-y-2">{payload.engineers.length ? payload.engineers.map((engineer, index) => <div key={textField(engineer, 'engineer_id', 'id') + index} className="rounded-lg border border-gray-800 bg-[#0d1117] px-3 py-3"><p className="text-xs font-semibold text-slate-200">{textField(engineer, 'engineer_name', 'full_name', 'name')}</p><p className="mt-1 text-[11px] text-slate-500">{textField(engineer, 'capability_role')} · {textField(engineer, 'validation_status')}</p></div>) : <p className="text-xs text-red-300">No validated equipment capability owners returned.</p>}</div></div>
          </div>
        </>
      ) : null}
    </PageFrame>
  );
}

export function LiveEquipmentNotificationsView({ record }: { record: LiveEquipmentRecord }): JSX.Element {
  const loader = useCallback(() => loadLiveEquipmentNotifications(record.id), [record.id]);
  const { state, loading, reload } = usePilotEvidence(loader);
  const rows: LiveNotification[] = state?.status === "ready" ? state.data : [];
  const awaiting = rows.filter((item) => item.workflowStatus === "AWAITING_WORK_ORDER");
  const completeFields = rows.reduce((total, item) => total + Number(Boolean(item.longText)) + Number(Boolean(item.reportedBy)) + Number(Boolean(item.requiredStartDate)) + Number(Boolean(item.typeCode || item.typeDescription)), 0);
  const completeness = rows.length > 0 ? Math.round((completeFields / (rows.length * 4)) * 100) : null;
  return (
    <PageFrame record={record} activeTab="notifications" title="Notifications" description="Maintenance requests and malfunction reports linked to the active-site equipment record." icon={Bell} actions={<RefreshButton loading={loading} onClick={reload} />}>
      {loading && !state ? <LoadingEvidence label="Loading verified maintenance notifications…" /> : null}
      {state && state.status !== "ready" ? <EvidenceStateMessage state={state} /> : null}
      {state?.status === "ready" ? (
        <>
          <div className="grid gap-3 sm:grid-cols-3"><Metric label="Notifications" value={rows.length} detail="Returned records" /><Metric label="Awaiting work order" value={awaiting.length} detail="Not yet converted" tone="text-amber-300" /><Metric label="Evidence completeness" value={completeness === null ? '—' : `${completeness}%`} detail="Required fields populated" /></div>
          <div className="space-y-3">{rows.map((item) => <article key={item.id} className="rounded-xl border border-gray-800 bg-[#141820] p-4"><div className="flex flex-col gap-3 sm:flex-row sm:justify-between"><div><p className="text-sm font-semibold text-slate-100">{item.number} · {item.shortText}</p><p className="mt-1 text-xs text-slate-500">{item.typeDescription ?? item.typeCode ?? 'Notification'} · Reported by {item.reportedBy ?? '—'} · {item.ageDays}d old</p><p className="mt-2 text-xs leading-5 text-slate-400">{item.longText ?? 'No long text recorded.'}</p></div><div className="flex h-fit flex-wrap gap-2"><span className="rounded-md border border-gray-700 px-2 py-1 text-xs font-semibold text-slate-300">{item.workflowStatus}</span><span className="rounded-md border border-purple-500/25 bg-purple-500/10 px-2 py-1 text-xs font-semibold text-purple-300">{item.riskPoints} risk</span></div></div></article>)}</div>
        </>
      ) : null}
    </PageFrame>
  );
}

export function LiveEquipmentUnavailableView({
  record,
  activeTab,
  title,
  message,
}: {
  record: LiveEquipmentRecord;
  activeTab: EquipmentTabRoute;
  title: string;
  message: string;
}): JSX.Element {
  return (
    <PageFrame record={record} activeTab={activeTab} title={title} description="This live route is guarded by the active-site equipment boundary." icon={Database}>
      <div className="rounded-xl border border-amber-500/30 bg-amber-500/[0.07] p-5" role="status">
        <div className="flex items-start gap-3"><AlertTriangle className="mt-0.5 h-5 w-5 text-amber-400" /><div><p className="text-sm font-semibold text-amber-200">Live evidence not yet available</p><p className="mt-1 text-xs leading-5 text-slate-400">{message}</p><p className="mt-2 text-xs text-slate-600">No legacy demonstration record has been displayed.</p></div></div>
      </div>
    </PageFrame>
  );
}
