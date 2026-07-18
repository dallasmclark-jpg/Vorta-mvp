import {
  ArrowRight,
  Award,
  GraduationCap,
  ShieldCheck,
  Users,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { ProfilePhoto } from "../../components/ProfilePhoto";
import { Badge } from "../../components/ui/badge";
import type {
  EquipmentRequiredSkill,
  EquipmentSkillEngineerEvidence,
} from "./equipmentService";

const initials = (name: string): string =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

const words = (value?: string | null): string =>
  value
    ? value
        .replaceAll("_", " ")
        .toLowerCase()
        .replace(/\b\w/g, (letter) => letter.toUpperCase())
    : "Validated";

function statusTone(skill: EquipmentRequiredSkill): string {
  if (skill.validationGap > 0) {
    return "border-red-500/25 bg-red-500/10 text-red-300";
  }
  if (skill.singlePointOfFailure) {
    return "border-amber-500/25 bg-amber-500/10 text-amber-300";
  }
  return "border-emerald-500/25 bg-emerald-500/10 text-emerald-300";
}

function trainingPriority(criticality?: string | null): string {
  switch (criticality?.trim().toLowerCase()) {
    case "critical":
      return "Critical";
    case "high":
      return "High";
    case "low":
      return "Low";
    case "medium":
    default:
      return "Medium";
  }
}

function PersonEvidence({
  person,
  label,
  equipmentId,
  skillId,
  skillName,
  returnTo,
}: {
  person: EquipmentSkillEngineerEvidence;
  label: string;
  equipmentId: string;
  skillId: string;
  skillName: string;
  returnTo: string;
}): JSX.Element {
  const navigate = useNavigate();
  const params = new URLSearchParams({
    engineer: person.engineerId,
    equipment: equipmentId,
    skill: skillId,
    skillName,
    from: "equipment",
    returnTo,
  });

  return (
    <button
      type="button"
      onClick={() => navigate(`/engineers?${params.toString()}`)}
      className="flex min-h-11 min-w-0 items-center gap-3 rounded-lg border border-gray-800 bg-[#0b1017] px-3 py-2.5 text-left transition-colors hover:border-blue-500/35 hover:bg-blue-500/[0.05] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60"
      aria-label={`Open ${person.engineerName} evidence for ${skillName}`}
    >
      <ProfilePhoto
        name={person.engineerName}
        photoUrl={person.avatarUrl}
        entityType="engineer"
        entityId={person.engineerId}
        sizeClass="h-9 w-9"
        shapeClass="rounded-lg"
        fallbackClass="bg-blue-500/15 text-blue-300"
        fallbackText={initials(person.engineerName)}
        className="text-xs"
      />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-slate-200">
          {person.engineerName}
        </span>
        <span className="mt-0.5 block truncate text-xs text-slate-400">
          {label} · Level {person.rating} · {person.yearsExperience.toFixed(1)} years
        </span>
      </span>
      <ArrowRight className="h-4 w-4 shrink-0 text-slate-500" />
    </button>
  );
}

export function EquipmentRequiredSkillCoverage({
  skill,
  equipmentId,
}: {
  skill: EquipmentRequiredSkill;
  equipmentId: string;
}): JSX.Element {
  const navigate = useNavigate();
  const minimum = Math.max(1, skill.minimumQualifiedEngineers);
  const requirementCoverage = Math.min(
    100,
    Math.round((skill.qualifiedEngineerCount / minimum) * 100),
  );
  const returnTo = `/equipment/${encodeURIComponent(equipmentId)}/skills`;

  const route = (
    pathname: string,
    values: Record<string, string>,
  ): string => {
    const params = new URLSearchParams({
      ...values,
      equipment: equipmentId,
      skill: skill.skillId,
      skillName: skill.name,
      from: "equipment",
      returnTo,
    });
    return `${pathname}?${params.toString()}`;
  };

  const skillsMatrixRoute = route("/skills-matrix", {
    view: "priority",
    priority: "1",
  });
  const engineerRoute = route("/engineers", {});
  const requirementRoute = route("/requirements", {});
  const trainingRoute = route("/training", {
    priority: trainingPriority(skill.criticality),
  });

  const primaryAction = skill.validationGap > 0
    ? { label: "Close skill gap", route: trainingRoute, icon: GraduationCap }
    : skill.singlePointOfFailure
      ? { label: "Develop backup", route: trainingRoute, icon: Users }
      : { label: "View capability", route: skillsMatrixRoute, icon: ShieldCheck };
  const PrimaryIcon = primaryAction.icon;
  const nearestCandidate = skill.nearestEngineers[0];
  const hiddenQualifiedCount = Math.max(0, skill.qualifiedEngineers.length - 4);
  const resilienceLabel = skill.validationGap > 0
    ? `${skill.validationGap} qualification gap${skill.validationGap === 1 ? "" : "s"}`
    : skill.singlePointOfFailure
      ? "Single-person dependency"
      : `${skill.qualifiedEngineerCount} validated engineers`;

  return (
    <article className="rounded-xl border border-gray-800 bg-[#0d1219] p-4 md:p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => navigate(skillsMatrixRoute)}
              className="text-left text-base font-semibold text-slate-100 transition-colors hover:text-blue-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60"
            >
              {skill.name}
            </button>
            <Badge className={`h-auto rounded border px-2 py-1 text-xs font-semibold shadow-none ${statusTone(skill)}`}>
              {skill.validationGap > 0
                ? `${skill.validationGap} short`
                : skill.singlePointOfFailure
                  ? "Single point"
                  : "Resilient"}
            </Badge>
          </div>
          <p className="mt-1.5 text-xs leading-5 text-slate-400">
            {skill.category ?? "Equipment capability"} · Required level {skill.requiredLevel} · Minimum {minimum} validated engineer{minimum === 1 ? "" : "s"}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {minimum > 1
              ? "Minimum coverage reflects the required maintenance resilience for this equipment."
              : "One engineer meets the minimum requirement, but a validated backup is still needed for resilience."}
          </p>
        </div>

        <div className="w-full shrink-0 rounded-lg border border-gray-800 bg-[#0a0f16] p-3 lg:w-64">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400">Requirement coverage</span>
            <span className="font-semibold text-slate-200">{requirementCoverage}%</span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-gray-800">
            <div
              className={`h-full rounded-full ${skill.validationGap > 0 ? "bg-red-400" : skill.singlePointOfFailure ? "bg-amber-400" : "bg-emerald-400"}`}
              style={{ width: `${requirementCoverage}%`, opacity: 0.76 }}
            />
          </div>
          <div className="mt-2 flex items-center justify-between gap-3 text-xs">
            <span className="text-slate-500">Resilience</span>
            <span className={skill.validationGap > 0 ? "font-semibold text-red-300" : skill.singlePointOfFailure ? "font-semibold text-amber-300" : "font-semibold text-emerald-300"}>
              {resilienceLabel}
            </span>
          </div>
        </div>
      </div>

      <div className="mt-5 grid gap-4 xl:grid-cols-2">
        <div>
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
              Qualified engineers
            </p>
            <span className="text-xs text-slate-500">{skill.qualifiedEngineerCount} validated</span>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {skill.qualifiedEngineers.slice(0, 4).map((person) => (
              <PersonEvidence
                key={person.engineerId}
                person={person}
                label={words(person.capabilityRole ?? person.validationStatus)}
                equipmentId={equipmentId}
                skillId={skill.skillId}
                skillName={skill.name}
                returnTo={returnTo}
              />
            ))}
            {hiddenQualifiedCount > 0 ? (
              <button
                type="button"
                onClick={() => navigate(engineerRoute)}
                className="min-h-11 rounded-lg border border-gray-800 bg-[#0b1017] px-3 py-2.5 text-left text-xs font-semibold text-blue-300 hover:border-blue-500/35"
              >
                +{hiddenQualifiedCount} more qualified engineer{hiddenQualifiedCount === 1 ? "" : "s"}
              </button>
            ) : null}
            {skill.qualifiedEngineers.length === 0 ? (
              <div className="rounded-lg border border-red-500/20 bg-red-500/[0.05] px-3 py-3 text-xs leading-5 text-red-200 sm:col-span-2">
                No validated engineer meets Level {skill.requiredLevel} for this equipment.
                {nearestCandidate
                  ? ` ${nearestCandidate.engineerName} is the closest recorded candidate at Level ${nearestCandidate.rating}.`
                  : " No developing capability evidence is currently recorded."}
              </div>
            ) : null}
          </div>
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
              Development candidates
            </p>
            <span className="text-xs text-slate-500">Closest to target</span>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {skill.nearestEngineers.slice(0, 3).map((person) => (
              <PersonEvidence
                key={person.engineerId}
                person={person}
                label={`Developing · ${Math.max(0, skill.requiredLevel - person.rating)} level gap`}
                equipmentId={equipmentId}
                skillId={skill.skillId}
                skillName={skill.name}
                returnTo={returnTo}
              />
            ))}
            {skill.nearestEngineers.length === 0 ? (
              <div className="rounded-lg border border-gray-800 bg-[#0b1017] px-3 py-3 text-xs leading-5 text-slate-400 sm:col-span-2">
                No developing capability evidence is recorded. Add an engineer skill assessment or equipment authorisation to create a development path.
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <div className="mt-5 flex flex-col gap-2 border-t border-gray-800 pt-4 sm:flex-row sm:flex-wrap sm:items-center">
        <button
          type="button"
          onClick={() => navigate(primaryAction.route)}
          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-blue-500/30 bg-blue-500/[0.09] px-4 py-2 text-sm font-semibold text-blue-200 hover:border-blue-400/55 hover:bg-blue-500/[0.13] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60"
        >
          <PrimaryIcon className="h-4 w-4" />
          {primaryAction.label}
          <ArrowRight className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => navigate(engineerRoute)}
          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-gray-700 px-3 py-2 text-xs font-semibold text-slate-300 hover:border-blue-500/35 hover:text-blue-300"
        >
          Find engineer <Users className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => navigate(requirementRoute)}
          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-gray-700 px-3 py-2 text-xs font-semibold text-slate-300 hover:border-blue-500/35 hover:text-blue-300"
        >
          View requirement <Award className="h-4 w-4" />
        </button>
        {primaryAction.route !== skillsMatrixRoute ? (
          <button
            type="button"
            onClick={() => navigate(skillsMatrixRoute)}
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold text-slate-400 hover:text-blue-300"
          >
            Open Skills Matrix <ArrowRight className="h-4 w-4" />
          </button>
        ) : (
          <button
            type="button"
            onClick={() => navigate(trainingRoute)}
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold text-slate-400 hover:text-blue-300"
          >
            Open training plan <GraduationCap className="h-4 w-4" />
          </button>
        )}
      </div>
    </article>
  );
}
