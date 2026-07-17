import { ArrowRight, Award, GraduationCap, Users } from "lucide-react";
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

function statusTone(skill: EquipmentRequiredSkill): string {
  if (skill.validationGap > 0) {
    return "border-red-500/25 bg-red-500/10 text-red-300";
  }
  if (skill.singlePointOfFailure) {
    return "border-amber-500/25 bg-amber-500/10 text-amber-300";
  }
  return "border-emerald-500/25 bg-emerald-500/10 text-emerald-300";
}

function PersonEvidence({
  person,
  label,
  returnTo,
}: {
  person: EquipmentSkillEngineerEvidence;
  label: string;
  returnTo: string;
}): JSX.Element {
  const navigate = useNavigate();
  const params = new URLSearchParams({
    engineer: person.engineerId,
    from: "equipment",
    returnTo,
  });

  return (
    <button
      type="button"
      onClick={() => navigate(`/engineers?${params.toString()}`)}
      className="flex min-w-0 items-center gap-2 rounded-lg border border-gray-800 bg-[#0b1017] px-2.5 py-2 text-left transition-colors hover:border-blue-500/35 hover:bg-blue-500/[0.05]"
    >
      <ProfilePhoto
        name={person.engineerName}
        photoUrl={person.avatarUrl}
        entityType="engineer"
        entityId={person.engineerId}
        sizeClass="h-8 w-8"
        shapeClass="rounded-lg"
        fallbackClass="bg-blue-500/15 text-blue-300"
        fallbackText={initials(person.engineerName)}
        className="text-[9px]"
      />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[11px] font-semibold text-slate-200">
          {person.engineerName}
        </span>
        <span className="mt-0.5 block truncate text-[9px] text-slate-500">
          {label} · L{person.rating} · {person.yearsExperience.toFixed(1)} yrs
        </span>
      </span>
      <ArrowRight className="h-3 w-3 shrink-0 text-slate-600" />
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
  const coverage = Math.min(
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
      from: "equipment",
      returnTo,
    });
    return `${pathname}?${params.toString()}`;
  };

  const skillsMatrixRoute = route("/skills-matrix", {
    skill: skill.skillId,
    priority: "1",
  });
  const engineerRoute = route("/engineers", {
    skill: skill.skillId,
    skillName: skill.name,
  });
  const requirementRoute = route("/requirements", {
    skill: skill.name,
  });
  const trainingRoute = route("/training", {
    skill: skill.name,
    priority:
      skill.criticality?.toLowerCase() === "critical"
        ? "Critical"
        : "High",
  });

  return (
    <article className="rounded-xl border border-gray-800 bg-[#0d1219] p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => navigate(skillsMatrixRoute)}
              className="text-left text-sm font-semibold text-slate-100 transition-colors hover:text-blue-300"
            >
              {skill.name}
            </button>
            <Badge className={`h-auto rounded border px-2 py-0.5 text-[9px] font-semibold shadow-none ${statusTone(skill)}`}>
              {skill.validationGap > 0
                ? `${skill.validationGap} short`
                : skill.singlePointOfFailure
                  ? "Single point"
                  : "Covered"}
            </Badge>
          </div>
          <p className="mt-1 text-[10px] text-slate-500">
            {skill.category ?? "Equipment capability"} · Required level {skill.requiredLevel} · {skill.qualifiedEngineerCount}/{minimum} validated
          </p>
        </div>

        <div className="w-full shrink-0 lg:w-40">
          <div className="flex items-center justify-between text-[10px] text-slate-500">
            <span>Coverage</span>
            <span className="font-semibold text-slate-300">{coverage}%</span>
          </div>
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-gray-800">
            <div
              className={`h-full rounded-full ${skill.validationGap > 0 ? "bg-red-400" : skill.singlePointOfFailure ? "bg-amber-400" : "bg-emerald-400"}`}
              style={{ width: `${coverage}%`, opacity: 0.76 }}
            />
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-3 xl:grid-cols-2">
        <div>
          <p className="mb-2 text-[9px] font-semibold uppercase tracking-[0.12em] text-slate-600">
            Qualified engineers
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            {skill.qualifiedEngineers.slice(0, 4).map((person) => (
              <PersonEvidence
                key={person.engineerId}
                person={person}
                label={person.validationStatus || "Validated"}
                returnTo={returnTo}
              />
            ))}
            {skill.qualifiedEngineers.length === 0 ? (
              <div className="rounded-lg border border-red-500/20 bg-red-500/[0.05] px-3 py-3 text-[10px] text-red-200">
                No validated engineer meets this equipment requirement.
              </div>
            ) : null}
          </div>
        </div>

        <div>
          <p className="mb-2 text-[9px] font-semibold uppercase tracking-[0.12em] text-slate-600">
            Nearest capability
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            {skill.nearestEngineers.slice(0, 3).map((person) => (
              <PersonEvidence
                key={person.engineerId}
                person={person}
                label="Nearest to target"
                returnTo={returnTo}
              />
            ))}
            {skill.nearestEngineers.length === 0 ? (
              <div className="rounded-lg border border-gray-800 bg-[#0b1017] px-3 py-3 text-[10px] text-slate-500">
                No developing capability evidence is recorded.
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2 border-t border-gray-800 pt-3">
        <button
          type="button"
          onClick={() => navigate(skillsMatrixRoute)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-blue-500/25 bg-blue-500/[0.07] px-2.5 py-1.5 text-[10px] font-semibold text-blue-300 hover:border-blue-400/45"
        >
          Open Skills Matrix <ArrowRight className="h-3 w-3" />
        </button>
        <button
          type="button"
          onClick={() => navigate(engineerRoute)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-gray-700 px-2.5 py-1.5 text-[10px] font-semibold text-slate-300 hover:border-blue-500/35 hover:text-blue-300"
        >
          Find engineer <Users className="h-3 w-3" />
        </button>
        <button
          type="button"
          onClick={() => navigate(requirementRoute)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-gray-700 px-2.5 py-1.5 text-[10px] font-semibold text-slate-300 hover:border-blue-500/35 hover:text-blue-300"
        >
          View requirement <Award className="h-3 w-3" />
        </button>
        <button
          type="button"
          onClick={() => navigate(trainingRoute)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-gray-700 px-2.5 py-1.5 text-[10px] font-semibold text-slate-300 hover:border-blue-500/35 hover:text-blue-300"
        >
          Open training plan <GraduationCap className="h-3 w-3" />
        </button>
      </div>
    </article>
  );
}
