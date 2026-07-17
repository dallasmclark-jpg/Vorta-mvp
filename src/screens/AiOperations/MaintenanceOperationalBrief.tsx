import {
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  GraduationCap,
  Shield,
  Sparkles,
  Users,
} from "lucide-react";
import { supabase } from "../../lib/supabaseClient";

export type MaintenanceBriefKind =
  | "skills"
  | "engineers"
  | "matching"
  | "requirements"
  | "training"
  | "providers";

interface MaintenanceOperationalBriefProps extends PropsWithChildren {
  functionName: string;
  kind: MaintenanceBriefKind;
}

type JsonRecord = Record<string, unknown>;

type BriefMetric = {
  label: string;
  value: string;
  detail: string;
  tone: "neutral" | "good" | "warning" | "critical";
};

type BriefContent = {
  eyebrow: string;
  headline: string;
  detail: string;
  actionLabel: string;
  actionRoute: string;
  secondaryLabel?: string;
  secondaryRoute?: string;
  metrics: BriefMetric[];
};

const FALLBACKS: Record<MaintenanceBriefKind, BriefContent> = {
  skills: {
    eyebrow: "Workforce risk control",
    headline: "Close the highest-risk competency gap first",
    detail:
      "Prioritise single-point-of-failure skills and gaps affecting critical equipment or shift coverage.",
    actionLabel: "Review requirements",
    actionRoute: "/requirements",
    metrics: [
      { label: "Critical gaps", value: "—", detail: "Current exposure", tone: "critical" },
      { label: "Training needs", value: "—", detail: "Open skill records", tone: "warning" },
      { label: "Critical SMEs", value: "—", detail: "Knowledge holders", tone: "neutral" },
    ],
  },
  engineers: {
    eyebrow: "Shift capability control",
    headline: "Protect coverage and critical knowledge holders",
    detail:
      "Focus on engineers whose availability, certification or unique expertise affects operational resilience.",
    actionLabel: "Open skills matrix",
    actionRoute: "/skills-matrix",
    metrics: [
      { label: "Available now", value: "—", detail: "Deployable engineers", tone: "good" },
      { label: "Critical SMEs", value: "—", detail: "Knowledge holders", tone: "warning" },
      { label: "Certs due", value: "—", detail: "Next 30 days", tone: "critical" },
    ],
  },
  matching: {
    eyebrow: "Deployment decision support",
    headline: "Deploy the best-qualified available engineer",
    detail:
      "Use verified competency, certification, experience and availability rather than a vague familiarity with the person.",
    actionLabel: "Review engineers",
    actionRoute: "/engineers",
    metrics: [
      { label: "Best match", value: "—", detail: "Suitability score", tone: "good" },
      { label: "Available", value: "—", detail: "Ready or on shift", tone: "neutral" },
      { label: "Open needs", value: "—", detail: "High-risk requirements", tone: "warning" },
    ],
  },
  requirements: {
    eyebrow: "Competency requirement control",
    headline: "Turn requirements into executable risk reduction",
    detail:
      "Every requirement should expose current coverage, the operational consequence of the gap and the action that closes it.",
    actionLabel: "Open training plan",
    actionRoute: "/training",
    metrics: [
      { label: "Critical gaps", value: "—", detail: "Immediate action", tone: "critical" },
      { label: "Skills at risk", value: "—", detail: "Partial coverage", tone: "warning" },
      { label: "Fully covered", value: "—", detail: "Requirements met", tone: "good" },
    ],
  },
  training: {
    eyebrow: "Training risk reduction plan",
    headline: "Prioritise bookings by operational risk removed",
    detail:
      "Book the training that protects critical equipment, renews compliance and reduces single-person dependency first.",
    actionLabel: "Match engineers",
    actionRoute: "/ai-matching",
    secondaryLabel: "Compare providers",
    secondaryRoute: "/training-providers",
    metrics: [
      { label: "Critical gaps", value: "—", detail: "Training priority", tone: "critical" },
      { label: "Need training", value: "—", detail: "Engineers affected", tone: "warning" },
      { label: "Active plan", value: "—", detail: "Bookings underway", tone: "good" },
    ],
  },
  providers: {
    eyebrow: "Contextual provider selection",
    headline: "Choose a provider after the risk and course are defined",
    detail:
      "Provider comparison supports a specific competency gap. It is not a substitute for deciding what maintenance risk needs removing.",
    actionLabel: "Return to training plan",
    actionRoute: "/training",
    metrics: [
      { label: "Providers", value: "—", detail: "Approved options", tone: "neutral" },
      { label: "Courses", value: "—", detail: "Active catalogue", tone: "good" },
      { label: "Open enquiries", value: "—", detail: "Awaiting response", tone: "warning" },
    ],
  },
};

function record(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonRecord)
    : {};
}

function rows(value: unknown): JsonRecord[] {
  return Array.isArray(value)
    ? value.filter(
        (item): item is JsonRecord =>
          Boolean(item) && typeof item === "object" && !Array.isArray(item),
      )
    : [];
}

function text(value: unknown, fallback = ""): string {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function numeric(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function integer(value: unknown): string {
  return Math.round(numeric(value)).toLocaleString("en-GB");
}

function riskWeight(row: JsonRecord): number {
  const level = text(row.risk_level).toLowerCase();
  const base =
    level === "critical"
      ? 400
      : level === "high"
        ? 300
        : level === "medium"
          ? 200
          : 100;

  return (
    base +
    (row.single_point_of_failure === true ? 100 : 0) +
    numeric(row.engineers_below_target ?? row.engineers_below ?? row.gap)
  );
}

function topRiskRow(value: unknown): JsonRecord | null {
  return [...rows(value)].sort((left, right) => riskWeight(right) - riskWeight(left))[0] ?? null;
}

function briefFromPayload(
  kind: MaintenanceBriefKind,
  payload: unknown,
): BriefContent {
  const fallback = FALLBACKS[kind];
  const data = record(payload);
  const stats = record(data.stats);

  if (kind === "skills") {
    const top = topRiskRow(data.skillGaps);
    const skillName = text(top?.skill_name ?? top?.title, "Critical competency");
    return {
      ...fallback,
      headline: top ? `${skillName} is the highest workforce exposure` : fallback.headline,
      detail: text(
        top?.recommendation,
        top
          ? `${integer(top.engineers_below_target ?? top.engineers_below)} engineers are below the required level.`
          : fallback.detail,
      ),
      metrics: [
        { label: "Critical gaps", value: integer(stats.criticalGaps), detail: "Current exposure", tone: "critical" },
        { label: "Training needs", value: integer(stats.trainingRequired), detail: "Open skill records", tone: "warning" },
        { label: "Critical SMEs", value: integer(stats.criticalHolders), detail: "Knowledge holders", tone: "neutral" },
      ],
    };
  }

  if (kind === "engineers") {
    const engineerRows = rows(data.engineers);
    const top = [...engineerRows].sort((left, right) => riskWeight(right) - riskWeight(left))[0];
    const engineerName = text(top?.full_name, "Critical knowledge holder");
    const discipline = text(top?.discipline, "maintenance capability");
    return {
      ...fallback,
      headline: top ? `${engineerName} requires the closest capability review` : fallback.headline,
      detail: top
        ? `${discipline}. ${integer(top.training_count)} training gaps are recorded and the current risk level is ${text(top.risk_level, "unrated")}.`
        : fallback.detail,
      metrics: [
        { label: "Available now", value: integer(stats.currentlyAvailable), detail: "Deployable engineers", tone: "good" },
        { label: "Critical SMEs", value: integer(stats.criticalHolders), detail: "Knowledge holders", tone: "warning" },
        { label: "Certs due", value: integer(stats.certificationsExpiring30d), detail: "Next 30 days", tone: "critical" },
      ],
    };
  }

  if (kind === "matching") {
    const matches = rows(data.matchResults);
    const top = matches[0];
    const name = text(top?.engineer_name, "Best available engineer");
    const matchedSkills = Array.isArray(top?.matched_skills)
      ? top.matched_skills.filter((item): item is string => typeof item === "string").slice(0, 2)
      : [];
    return {
      ...fallback,
      headline: top
        ? `${name} is the strongest current match at ${integer(top.overall_score)}%`
        : fallback.headline,
      detail: text(
        top?.ai_recommendation,
        matchedSkills.length
          ? `Best evidence: ${matchedSkills.join(", ")}.`
          : fallback.detail,
      ),
      metrics: [
        { label: "Best match", value: `${integer(stats.bestMatchScore)}%`, detail: "Suitability score", tone: "good" },
        { label: "Available", value: integer(stats.availableEngineers), detail: "Ready or on shift", tone: "neutral" },
        { label: "Open needs", value: integer(stats.openRequirements), detail: "High-risk requirements", tone: "warning" },
      ],
    };
  }

  if (kind === "requirements") {
    const requirementRows = rows(data.requirements);
    const top = requirementRows[0];
    const name = text(top?.title, "Critical requirement");
    return {
      ...fallback,
      headline: top ? `${name} is the first requirement to close` : fallback.headline,
      detail: top
        ? `${integer(top.engineers_below ?? top.gap)} engineers are below target, with ${integer(top.coverage_pct)}% current coverage. ${text(top.recommendation)}`.trim()
        : fallback.detail,
      metrics: [
        { label: "Critical gaps", value: integer(stats.criticalGaps), detail: "Immediate action", tone: "critical" },
        { label: "Skills at risk", value: integer(stats.skillsAtRisk), detail: "Partial coverage", tone: "warning" },
        { label: "Fully covered", value: integer(stats.fullyCovered), detail: "Requirements met", tone: "good" },
      ],
    };
  }

  if (kind === "training") {
    const top = rows(data.priorityRows)[0];
    const name = text(top?.skill_name, "Critical training requirement");
    return {
      ...fallback,
      headline: top ? `${name} should be the next training action` : fallback.headline,
      detail: top
        ? `${integer(top.gap)} engineers are below target ${integer(top.target_rating)}/5. ${text(top.recommendation)}`.trim()
        : fallback.detail,
      metrics: [
        { label: "Critical gaps", value: integer(stats.criticalGaps), detail: "Training priority", tone: "critical" },
        { label: "Need training", value: integer(stats.engineersNeedingTraining), detail: "Engineers affected", tone: "warning" },
        { label: "Active plan", value: integer(stats.activeBookings), detail: "Bookings underway", tone: "good" },
      ],
    };
  }

  const top = rows(data.gapMatches)[0];
  const matchedProviders = Array.isArray(top?.matched_partner_names)
    ? top.matched_partner_names.filter((item): item is string => typeof item === "string")
    : [];
  return {
    ...fallback,
    headline: top
      ? `Select a provider for ${text(top.skill_name, "the highest-risk skill")}`
      : fallback.headline,
    detail: top
      ? `${integer(top.engineers_below)} engineers are below target. ${matchedProviders.length ? `Matched providers: ${matchedProviders.join(", ")}.` : text(top.recommendation)}`
      : fallback.detail,
    metrics: [
      { label: "Providers", value: integer(stats.providerCount), detail: "Approved options", tone: "neutral" },
      { label: "Courses", value: integer(stats.courseCount), detail: "Active catalogue", tone: "good" },
      { label: "Open enquiries", value: integer(stats.openEnquiries), detail: "Awaiting response", tone: "warning" },
    ],
  };
}

const TONE_CLASS: Record<BriefMetric["tone"], string> = {
  neutral: "text-slate-100",
  good: "text-emerald-400",
  warning: "text-amber-300",
  critical: "text-red-400",
};

const KIND_ICON: Record<MaintenanceBriefKind, typeof Shield> = {
  skills: Shield,
  engineers: Users,
  matching: Sparkles,
  requirements: AlertTriangle,
  training: GraduationCap,
  providers: CheckCircle2,
};

export function MaintenanceOperationalBrief({
  functionName,
  kind,
  children,
}: MaintenanceOperationalBriefProps): JSX.Element {
  const navigate = useNavigate();
  const [payload, setPayload] = useState<unknown>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;

    void supabase.functions.invoke(functionName).then(({ data, error }) => {
      if (cancelled) return;
      if (error || !data) {
        setFailed(true);
        return;
      }
      setPayload(data);
      setFailed(false);
    });

    return () => {
      cancelled = true;
    };
  }, [functionName]);

  const content = useMemo(
    () => briefFromPayload(kind, payload),
    [kind, payload],
  );
  const Icon = KIND_ICON[kind];

  return (
    <div className="min-w-0 w-full" data-maintenance-operational-brief={kind}>
      <section className="mx-4 mt-4 overflow-hidden rounded-xl border border-slate-700/70 bg-[linear-gradient(135deg,rgba(20,24,32,0.98),rgba(12,16,24,0.98))] shadow-[0_16px_40px_rgba(0,0,0,0.18)] md:mx-6 xl:mx-8">
        <div className="flex flex-col gap-5 p-5 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex min-w-0 flex-1 items-start gap-3">
            <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-blue-400/20 bg-blue-400/10 text-blue-300">
              <Icon className="h-4.5 w-4.5" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-blue-300/80">
                  {content.eyebrow}
                </p>
                {kind === "providers" && (
                  <span className="rounded-full border border-slate-600/70 bg-slate-800/70 px-2 py-0.5 text-[10px] font-medium text-slate-400">
                    Contextual page
                  </span>
                )}
              </div>
              <h2 className="mt-1 text-base font-semibold text-slate-50 md:text-lg">
                {content.headline}
              </h2>
              <p className="mt-1 max-w-3xl text-xs leading-relaxed text-slate-400 md:text-sm">
                {failed ? FALLBACKS[kind].detail : content.detail}
              </p>
            </div>
          </div>

          <div className="grid min-w-0 grid-cols-3 gap-2 xl:w-[420px]">
            {content.metrics.map((metric) => (
              <div
                key={metric.label}
                className="min-w-0 rounded-lg border border-slate-700/70 bg-black/15 px-3 py-2.5"
              >
                <p className="truncate text-[10px] font-medium uppercase tracking-wide text-slate-500">
                  {metric.label}
                </p>
                <p className={`mt-1 text-lg font-semibold tabular-nums ${TONE_CLASS[metric.tone]}`}>
                  {metric.value}
                </p>
                <p className="truncate text-[10px] text-slate-600">
                  {metric.detail}
                </p>
              </div>
            ))}
          </div>

          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {content.secondaryLabel && content.secondaryRoute && (
              <button
                type="button"
                onClick={() => navigate(content.secondaryRoute!)}
                className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-700 bg-slate-800/60 px-3 text-xs font-semibold text-slate-300 transition-colors hover:border-slate-600 hover:bg-slate-800 hover:text-slate-100"
              >
                {content.secondaryLabel}
              </button>
            )}
            <button
              type="button"
              onClick={() => navigate(content.actionRoute)}
              className="inline-flex h-9 items-center gap-2 rounded-lg bg-blue-600 px-3.5 text-xs font-semibold text-white transition-colors hover:bg-blue-500"
            >
              {content.actionLabel}
              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>
        </div>
      </section>

      {children}
    </div>
  );
}
