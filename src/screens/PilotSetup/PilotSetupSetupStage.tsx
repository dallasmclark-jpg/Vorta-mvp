import {
  ClipboardCheck,
  Flag,
  RefreshCw,
  Save,
  UsersRound,
} from "lucide-react";
import { Card, CardContent } from "../../components/ui/card";
import { FieldLabel } from "./PilotSetupShared";
import {
  type ConfigurationDraft,
  type PilotSetupReport,
  type SuccessCriterion,
  statusLabel,
} from "./pilotSetupModel";

interface PilotSetupSetupStageProps {
  report: PilotSetupReport;
  configuration: ConfigurationDraft;
  configurationDirty: boolean;
  criteria: SuccessCriterion[];
  criteriaDirty: boolean;
  pilotOwnerUserId: string;
  managerContactUserId: string;
  participantsDirty: boolean;
  busy: Record<string, boolean>;
  onConfigurationChange: (patch: Partial<ConfigurationDraft>) => void;
  onSaveConfiguration: () => void;
  onOwnerChange: (userId: string) => void;
  onManagerChange: (userId: string) => void;
  onSaveParticipants: () => void;
  onCriterionTargetChange: (index: number, target: number) => void;
  onSaveCriteria: () => void;
}

export function PilotSetupSetupStage({
  report,
  configuration,
  configurationDirty,
  criteria,
  criteriaDirty,
  pilotOwnerUserId,
  managerContactUserId,
  participantsDirty,
  busy,
  onConfigurationChange,
  onSaveConfiguration,
  onOwnerChange,
  onManagerChange,
  onSaveParticipants,
  onCriterionTargetChange,
  onSaveCriteria,
}: PilotSetupSetupStageProps): JSX.Element {
  const participants = report.pilot.availableParticipants ?? [];
  const managerParticipants = participants.filter((participant) =>
    participant.role === "maintenance_manager" ||
    participant.role === "site_admin" ||
    participant.role === "vorta_admin",
  );

  return (
    <div className="grid gap-5">
      <Card className="rounded-xl border border-gray-800 bg-[#141820] shadow-none">
        <CardContent className="p-5 md:p-6">
          <div className="mb-5 flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <Flag className="mt-0.5 h-4 w-4 text-blue-400" aria-hidden="true" />
              <div>
                <h2 className="text-sm font-semibold text-slate-100">Pilot configuration</h2>
                <p className="mt-1 text-xs leading-5 text-slate-500">
                  Define what the pilot must prove and the period in which it will be judged.
                </p>
              </div>
            </div>
            {configurationDirty ? (
              <span className="text-xs font-semibold text-amber-300">Not saved</span>
            ) : null}
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <FieldLabel className="xl:col-span-2">
              Pilot objective
              <textarea
                value={configuration.objective}
                onChange={(event) => onConfigurationChange({ objective: event.target.value })}
                rows={3}
                maxLength={2000}
                placeholder="State the operational problem and what the pilot must prove."
                className="min-h-[96px] rounded-lg border border-gray-800 bg-[#10141b] px-3 py-2 text-sm leading-6 text-slate-200 outline-none focus:border-blue-500/60"
              />
            </FieldLabel>

            <FieldLabel>
              Planned start
              <input
                type="date"
                value={configuration.plannedStartDate}
                onChange={(event) => onConfigurationChange({ plannedStartDate: event.target.value })}
                className="h-10 rounded-lg border border-gray-800 bg-[#10141b] px-3 text-sm text-slate-200 outline-none focus:border-blue-500/60"
              />
            </FieldLabel>

            <FieldLabel>
              Planned end
              <input
                type="date"
                value={configuration.plannedEndDate}
                min={configuration.plannedStartDate || undefined}
                onChange={(event) => onConfigurationChange({ plannedEndDate: event.target.value })}
                className="h-10 rounded-lg border border-gray-800 bg-[#10141b] px-3 text-sm text-slate-200 outline-none focus:border-blue-500/60"
              />
            </FieldLabel>

            <FieldLabel className="xl:col-span-2">
              Known limitations
              <textarea
                value={configuration.knownLimitations}
                onChange={(event) => onConfigurationChange({ knownLimitations: event.target.value })}
                rows={3}
                maxLength={5000}
                placeholder="Record data gaps, unsupported workflows and anything the site must understand before launch."
                className="min-h-[96px] rounded-lg border border-gray-800 bg-[#10141b] px-3 py-2 text-sm leading-6 text-slate-200 outline-none focus:border-blue-500/60"
              />
            </FieldLabel>
          </div>

          <div className="mt-4 flex justify-end">
            <button
              type="button"
              onClick={onSaveConfiguration}
              disabled={Boolean(busy.configuration) || !configurationDirty}
              className="inline-flex h-9 items-center gap-2 rounded-lg bg-blue-600 px-4 text-xs font-semibold text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy.configuration ? (
                <RefreshCw className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
              ) : (
                <Save className="h-3.5 w-3.5" aria-hidden="true" />
              )}
              Save configuration
            </button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-5 xl:grid-cols-2">
        <Card className="rounded-xl border border-gray-800 bg-[#141820] shadow-none">
          <CardContent className="p-5 md:p-6">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <UsersRound className="mt-0.5 h-4 w-4 text-blue-400" aria-hidden="true" />
                <div>
                  <h2 className="text-sm font-semibold text-slate-100">Pilot participants</h2>
                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    Make ownership and the pilot user explicit before rehearsals begin.
                  </p>
                </div>
              </div>
              {participantsDirty ? (
                <span className="text-xs font-semibold text-amber-300">Not saved</span>
              ) : null}
            </div>

            <div className="grid gap-4">
              <FieldLabel>
                Pilot owner
                <select
                  value={pilotOwnerUserId}
                  onChange={(event) => onOwnerChange(event.target.value)}
                  className="h-10 rounded-lg border border-gray-800 bg-[#10141b] px-3 text-sm text-slate-200 outline-none focus:border-blue-500/60"
                >
                  <option value="">Choose pilot owner</option>
                  {participants.map((participant) => (
                    <option key={participant.userId} value={participant.userId}>
                      {participant.name} · {statusLabel(participant.role)}
                    </option>
                  ))}
                </select>
              </FieldLabel>

              <FieldLabel>
                Maintenance Manager contact
                <select
                  value={managerContactUserId}
                  onChange={(event) => onManagerChange(event.target.value)}
                  className="h-10 rounded-lg border border-gray-800 bg-[#10141b] px-3 text-sm text-slate-200 outline-none focus:border-blue-500/60"
                >
                  <option value="">Choose Maintenance Manager</option>
                  {managerParticipants.map((participant) => (
                    <option key={participant.userId} value={participant.userId}>
                      {participant.name} · {statusLabel(participant.role)}
                    </option>
                  ))}
                </select>
              </FieldLabel>
            </div>

            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={onSaveParticipants}
                disabled={Boolean(busy.participants) || !participantsDirty}
                className="inline-flex h-9 items-center gap-2 rounded-lg bg-blue-600 px-4 text-xs font-semibold text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {busy.participants ? (
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                ) : (
                  <Save className="h-3.5 w-3.5" aria-hidden="true" />
                )}
                Save participants
              </button>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-xl border border-gray-800 bg-[#141820] shadow-none">
          <CardContent className="p-5 md:p-6">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <ClipboardCheck className="mt-0.5 h-4 w-4 text-blue-400" aria-hidden="true" />
                <div>
                  <h2 className="text-sm font-semibold text-slate-100">Success criteria</h2>
                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    Agree measurable targets before the site judges the result.
                  </p>
                </div>
              </div>
              {criteriaDirty ? (
                <span className="text-xs font-semibold text-amber-300">Not saved</span>
              ) : null}
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              {criteria.map((criterion, index) => (
                <label
                  key={criterion.key}
                  className="rounded-lg border border-gray-800 bg-[#10141b] p-3"
                >
                  <span className="text-xs font-semibold text-slate-200">
                    {criterion.label}
                  </span>
                  <span className="mt-2 flex items-center gap-2">
                    <input
                      type="number"
                      min={0}
                      step="any"
                      value={criterion.target}
                      onChange={(event) => onCriterionTargetChange(index, Number(event.target.value))}
                      className="h-9 min-w-0 flex-1 rounded-lg border border-gray-800 bg-[#0d1117] px-3 text-sm font-semibold text-blue-300 outline-none focus:border-blue-500/60"
                    />
                    <span className="text-xs text-slate-500">{criterion.unit}</span>
                  </span>
                </label>
              ))}
            </div>

            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={onSaveCriteria}
                disabled={Boolean(busy.criteria) || !criteriaDirty}
                className="inline-flex h-9 items-center gap-2 rounded-lg bg-blue-600 px-4 text-xs font-semibold text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {busy.criteria ? (
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                ) : (
                  <Save className="h-3.5 w-3.5" aria-hidden="true" />
                )}
                Save criteria
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
