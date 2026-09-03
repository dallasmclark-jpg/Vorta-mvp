import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  Award,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  Clock3,
  FilePlus2,
  GraduationCap,
  Network,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Upload,
  Wrench,
} from "lucide-react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";
import { getEquipmentList, type EquipmentListItem } from "../Equipment/equipmentService";

const PAGE = "mx-auto flex w-full max-w-[1600px] flex-col gap-5 px-4 pb-10 pt-5 sm:px-5 md:gap-6 md:px-6 md:pb-12 md:pt-6 xl:px-8";
const CARD = "rounded-2xl border border-slate-800/75 bg-[#030c1d] shadow-[0_14px_34px_rgba(0,0,0,0.22)]";
const RAISED = "rounded-xl border border-slate-800/70 bg-[#07172b]";
const ACTION = "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-700/80 bg-[#07172b] px-3 text-sm font-medium text-slate-200 transition-colors hover:border-blue-400/50 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400";

interface PersonalSkill {
  engineerId: string;
  skillId: string;
  name: string;
  category: string;
  requiredLevel: number;
  selfLevel: number | null;
  managerLevel: number | null;
  verifiedLevel: number | null;
  verificationStatus: string;
  trainingRequired: boolean;
}

interface EquipmentSkillProfile {
  equipment: EquipmentListItem;
  skills: PersonalSkill[];
  readiness: number;
  competent: number;
  gaps: number;
  reassessment: number;
}

interface TrainingItem {
  title: string;
  status: string;
  date: string | null;
  provider: string | null;
  deliveryType: string | null;
}

interface CertificateItem {
  name: string;
  category: string;
  expiryDate: string | null;
  status: string;
}

const DEMO_EQUIPMENT: EquipmentListItem[] = [
  { id: "vf-02", name: "Bosch VF-02", assetNumber: "VF-02", type: "FILLING MACHINE", area: "Fill Finish", riskScore: 73, riskLevel: "High", breakdown: [], status: "Running", oem: "Bosch", criticality: "Critical", overduePmCount: 0, openWorkOrderCount: 3, calibrationOverdueCount: 0 },
  { id: "pl-02", name: "Palletiser 2", assetNumber: "PL-02", type: "PALLETISER", area: "Packing", riskScore: 58, riskLevel: "Medium", breakdown: [], status: "Running", oem: "ABB", criticality: "High", overduePmCount: 0, openWorkOrderCount: 2, calibrationOverdueCount: 0 },
  { id: "washer-01", name: "Washer 01", assetNumber: "WSH-01", type: "BOTTLE WASHER", area: "Fill Finish", riskScore: 45, riskLevel: "Medium", breakdown: [], status: "Running", oem: "Bosch", criticality: "High", overduePmCount: 0, openWorkOrderCount: 1, calibrationOverdueCount: 0 },
  { id: "pur-skid-01", name: "Purification Skid", assetNumber: "PUR-01", type: "PROCESS SKID", area: "Purification", riskScore: 38, riskLevel: "Low", breakdown: [], status: "Running", oem: "GEA", criticality: "High", overduePmCount: 0, openWorkOrderCount: 1, calibrationOverdueCount: 0 },
];

const DEMO_PROFILES: Record<string, Array<Omit<PersonalSkill, "engineerId">>> = {
  "vf-02": [
    { skillId: "vf-mech", name: "Mechanical Maintenance", category: "Bosch VF-02", requiredLevel: 3, selfLevel: 4, managerLevel: 4, verifiedLevel: 4, verificationStatus: "validated", trainingRequired: false },
    { skillId: "vf-elec", name: "Electrical Fault Finding", category: "Bosch VF-02", requiredLevel: 3, selfLevel: 3, managerLevel: 3, verifiedLevel: 3, verificationStatus: "validated", trainingRequired: false },
    { skillId: "vf-diag", name: "Advanced Diagnostics", category: "Bosch VF-02", requiredLevel: 3, selfLevel: 3, managerLevel: 2, verifiedLevel: 2, verificationStatus: "pending", trainingRequired: true },
    { skillId: "vf-change", name: "Format Change", category: "Bosch VF-02", requiredLevel: 3, selfLevel: 4, managerLevel: 4, verifiedLevel: 4, verificationStatus: "validated", trainingRequired: false },
  ],
  "pl-02": [
    { skillId: "pl-mech", name: "Mechanical Maintenance", category: "Palletiser 2", requiredLevel: 3, selfLevel: 4, managerLevel: 4, verifiedLevel: 4, verificationStatus: "validated", trainingRequired: false },
    { skillId: "pl-elec", name: "Electrical Systems", category: "Palletiser 2", requiredLevel: 3, selfLevel: 4, managerLevel: 4, verifiedLevel: 4, verificationStatus: "validated", trainingRequired: false },
    { skillId: "pl-robot", name: "Robot Diagnostics", category: "Palletiser 2", requiredLevel: 3, selfLevel: 4, managerLevel: 4, verifiedLevel: 4, verificationStatus: "validated", trainingRequired: false },
  ],
  "washer-01": [
    { skillId: "w-mech", name: "Mechanical Maintenance", category: "Washer 01", requiredLevel: 3, selfLevel: 3, managerLevel: 3, verifiedLevel: 3, verificationStatus: "validated", trainingRequired: false },
    { skillId: "w-diag", name: "Fault Diagnostics", category: "Washer 01", requiredLevel: 3, selfLevel: 3, managerLevel: 2, verifiedLevel: 2, verificationStatus: "pending", trainingRequired: true },
    { skillId: "w-change", name: "Changeover", category: "Washer 01", requiredLevel: 3, selfLevel: 3, managerLevel: 3, verifiedLevel: 3, verificationStatus: "validated", trainingRequired: false },
  ],
  "pur-skid-01": [
    { skillId: "p-mech", name: "Mechanical Maintenance", category: "Purification Skid", requiredLevel: 3, selfLevel: 3, managerLevel: 2, verifiedLevel: 2, verificationStatus: "pending", trainingRequired: true },
    { skillId: "p-instr", name: "Instrumentation", category: "Purification Skid", requiredLevel: 3, selfLevel: 2, managerLevel: 2, verifiedLevel: 2, verificationStatus: "validated", trainingRequired: true },
    { skillId: "p-proc", name: "Process Understanding", category: "Purification Skid", requiredLevel: 3, selfLevel: 3, managerLevel: 3, verifiedLevel: 3, verificationStatus: "validated", trainingRequired: false },
  ],
};

const DEMO_TRAINING: TrainingItem[] = [
  { title: "Bosch VF-02 Advanced Diagnostics", status: "Assigned", date: "2026-09-18", provider: "Bosch Training", deliveryType: "On site" },
  { title: "Working at Height Refresher", status: "Assigned", date: "2026-10-05", provider: "Site Safety", deliveryType: "Classroom" },
  { title: "Electrical Safety LV", status: "Completed", date: "2026-07-22", provider: "Internal", deliveryType: "Practical" },
  { title: "Palletiser 2 Robot Diagnostics", status: "Completed", date: "2026-06-14", provider: "ABB", deliveryType: "On site" },
];

const DEMO_CERTIFICATES: CertificateItem[] = [
  { name: "Working at Height", category: "Safety", expiryDate: "2026-10-01", status: "Expiring" },
  { name: "Electrical Safety LV", category: "Electrical", expiryDate: "2027-07-22", status: "Current" },
  { name: "Confined Space", category: "Safety", expiryDate: "2027-03-14", status: "Current" },
];

function calcProfile(equipment: EquipmentListItem, skills: PersonalSkill[]): EquipmentSkillProfile {
  if (skills.length === 0) return { equipment, skills, readiness: 0, competent: 0, gaps: 0, reassessment: 0 };
  const competent = skills.filter((skill) => (skill.verifiedLevel ?? skill.managerLevel ?? 0) >= skill.requiredLevel).length;
  const gaps = skills.filter((skill) => (skill.verifiedLevel ?? skill.managerLevel ?? 0) < skill.requiredLevel).length;
  const reassessment = skills.filter((skill) => skill.verificationStatus !== "validated" || skill.trainingRequired).length;
  return { equipment, skills, readiness: Math.round((competent / skills.length) * 100), competent, gaps, reassessment };
}

function readinessTone(value: number): string {
  if (value >= 85) return "text-emerald-400";
  if (value >= 65) return "text-blue-400";
  if (value >= 45) return "text-amber-400";
  return "text-red-400";
}

function levelTone(level: number | null, required: number): string {
  if (level == null) return "border-slate-700 bg-slate-800/30 text-slate-500";
  if (level >= required) return "border-emerald-500/25 bg-emerald-500/10 text-emerald-300";
  if (level === required - 1) return "border-amber-500/25 bg-amber-500/10 text-amber-300";
  return "border-red-500/25 bg-red-500/10 text-red-300";
}

function statusTone(status: string): string {
  const value = status.toLowerCase();
  if (value.includes("current") || value.includes("complete") || value.includes("valid")) return "text-emerald-400";
  if (value.includes("expir") || value.includes("pending") || value.includes("assign")) return "text-amber-400";
  return "text-slate-400";
}

function dateLabel(value: string | null): string {
  if (!value) return "No date";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

async function loadSkillProfiles(): Promise<{
  profiles: EquipmentSkillProfile[];
  engineerId: string;
  training: TrainingItem[];
  certificates: CertificateItem[];
}> {
  let equipment = await getEquipmentList();
  if (equipment.length === 0) equipment = DEMO_EQUIPMENT;
  equipment = equipment.slice(0, 12);

  try {
    const [matrixResult, requirementsResult, engineerResult] = await Promise.all([
      supabase.functions.invoke("skills-matrix-data"),
      supabase
        .from("equipment_required_skills")
        .select("equipment_id, skill_id, required_level")
        .in("equipment_id", equipment.map((item) => item.id)),
      supabase.functions.invoke("engineers-data"),
    ]);

    const matrixData = matrixResult.data;
    const engineerId = (matrixData?.engineers?.[0]?.id as string | undefined) ?? "";
    const skillsMeta = (matrixData?.heatmapSkills ?? []) as Array<{ id: string; name: string; category: string }>;
    const assignments = (matrixData?.heatmapAssignments ?? []) as Array<{
      engineer_id: string;
      skill_id: string;
      self_rating: number | null;
      manager_rating: number | null;
      validated_rating: number | null;
      verification_status?: string;
      training_required?: boolean;
    }>;
    const requirements = (requirementsResult.data ?? []) as Array<{ equipment_id: string; skill_id: string; required_level: number | null }>;

    if (engineerId && requirements.length > 0 && skillsMeta.length > 0) {
      const assignmentMap = new Map(
        assignments
          .filter((assignment) => assignment.engineer_id === engineerId)
          .map((assignment) => [assignment.skill_id, assignment]),
      );
      const metaMap = new Map(skillsMeta.map((skill) => [skill.id, skill]));

      const profiles = equipment.map((asset) => {
        const personalSkills = requirements
          .filter((requirement) => requirement.equipment_id === asset.id)
          .map((requirement): PersonalSkill => {
            const assignment = assignmentMap.get(requirement.skill_id);
            const meta = metaMap.get(requirement.skill_id);
            return {
              engineerId,
              skillId: requirement.skill_id,
              name: meta?.name ?? "Unknown skill",
              category: meta?.category ?? asset.name,
              requiredLevel: requirement.required_level ?? 1,
              selfLevel: assignment?.self_rating ?? null,
              managerLevel: assignment?.manager_rating ?? null,
              verifiedLevel: assignment?.validated_rating ?? null,
              verificationStatus: assignment?.verification_status ?? "not_uploaded",
              trainingRequired: Boolean(assignment?.training_required),
            };
          });
        return calcProfile(asset, personalSkills);
      }).filter((profile) => profile.skills.length > 0);

      const bookings = (engineerResult.data?.trainingBookings ?? []) as Array<any>;
      const training: TrainingItem[] = bookings.length > 0
        ? bookings.slice(0, 16).map((booking) => ({
            title: booking.course_title ?? "Training",
            status: booking.status ?? "Assigned",
            date: booking.booking_date ?? null,
            provider: booking.partner_name ?? null,
            deliveryType: booking.delivery_type ?? null,
          }))
        : DEMO_TRAINING;

      const rawCertificates = (engineerResult.data?.engineers?.[0]?.certifications ?? []) as Array<any>;
      const certificates: CertificateItem[] = rawCertificates.length > 0
        ? rawCertificates.map((certificate) => ({
            name: certificate.skill_name ?? "Certificate",
            category: certificate.category ?? "Certificate",
            expiryDate: certificate.expiry_date ?? null,
            status: certificate.verification_status === "expired" ? "Expired" : "Current",
          }))
        : DEMO_CERTIFICATES;

      if (profiles.length > 0) return { profiles, engineerId, training, certificates };
    }
  } catch (error) {
    console.warn("Engineer equipment-centric skills load failed; using demo competency model:", error);
  }

  const fallbackEquipment = equipment.length > 0 ? equipment : DEMO_EQUIPMENT;
  const profiles = fallbackEquipment.slice(0, 4).map((asset, index) => {
    const keyed = DEMO_PROFILES[asset.id] ?? DEMO_PROFILES[DEMO_EQUIPMENT[index % DEMO_EQUIPMENT.length].id] ?? [];
    return calcProfile(asset, keyed.map((skill) => ({ ...skill, engineerId: "demo-engineer" })));
  });
  return { profiles, engineerId: "demo-engineer", training: DEMO_TRAINING, certificates: DEMO_CERTIFICATES };
}

function SkillsHeader(): JSX.Element {
  return (
    <header>
      <h1 className="text-2xl font-semibold tracking-[-0.025em] text-slate-50 md:text-3xl">My Skills</h1>
      <p className="mt-1 text-sm leading-6 text-slate-400">Your verified competency, self-assessment, training and readiness by equipment.</p>
    </header>
  );
}

export function EngineerSkillsScreen(): JSX.Element {
  const [profiles, setProfiles] = useState<EquipmentSkillProfile[]>([]);
  const [training, setTraining] = useState<TrainingItem[]>([]);
  const [certificates, setCertificates] = useState<CertificateItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"equipment" | "skill" | "training" | "certificates">("equipment");

  useEffect(() => {
    let cancelled = false;
    void loadSkillProfiles().then((data) => {
      if (cancelled) return;
      setProfiles(data.profiles);
      setTraining(data.training);
      setCertificates(data.certificates);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, []);

  const allSkills = useMemo(() => profiles.flatMap((profile) => profile.skills.map((skill) => ({ ...skill, equipment: profile.equipment }))), [profiles]);
  const overallReadiness = profiles.length ? Math.round(profiles.reduce((sum, profile) => sum + profile.readiness, 0) / profiles.length) : 0;
  const competentCount = allSkills.filter((skill) => (skill.verifiedLevel ?? skill.managerLevel ?? 0) >= skill.requiredLevel).length;
  const reassessment = allSkills.filter((skill) => skill.verificationStatus !== "validated").length;
  const gaps = allSkills.filter((skill) => (skill.verifiedLevel ?? skill.managerLevel ?? 0) < skill.requiredLevel).length;

  if (loading) {
    return <div data-vorta-page-content="true" className={PAGE}><SkillsHeader /><div className={`${CARD} h-40 animate-pulse`} /><div className="grid gap-3 md:grid-cols-2"><div className={`${CARD} h-52 animate-pulse`} /><div className={`${CARD} h-52 animate-pulse`} /></div></div>;
  }

  return (
    <div data-vorta-page-content="true" data-vorta-engineer-skills="true" className={PAGE}>
      <SkillsHeader />

      <section className={`${CARD} overflow-hidden border-blue-500/35 bg-blue-500/[0.08] p-4 sm:p-5`}>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="col-span-2 flex items-center gap-4 sm:col-span-1">
            <div className="relative flex h-20 w-20 shrink-0 items-center justify-center rounded-full border-[6px] border-blue-500/20">
              <div className="absolute inset-[-6px] rounded-full border-[6px] border-transparent border-t-blue-500" style={{ transform: `rotate(${Math.max(20, Math.round(overallReadiness * 2.6))}deg)` }} />
              <span className="text-xl font-semibold tabular-nums text-slate-50">{overallReadiness}%</span>
            </div>
            <div><p className="text-xs text-slate-500">Current readiness</p><p className="mt-1 text-sm font-semibold text-blue-300">By equipment</p></div>
          </div>
          <div className="border-l border-slate-800/70 pl-4"><p className="text-2xl font-semibold tabular-nums text-slate-50">{competentCount}</p><p className="mt-1 text-xs text-slate-500">Competent requirements</p></div>
          <div className="border-l border-slate-800/70 pl-4"><p className="text-2xl font-semibold tabular-nums text-amber-400">{reassessment}</p><p className="mt-1 text-xs text-slate-500">Reassessment / pending</p></div>
          <div className="border-l border-slate-800/70 pl-4"><p className="text-2xl font-semibold tabular-nums text-red-400">{gaps}</p><p className="mt-1 text-xs text-slate-500">Training gaps</p></div>
        </div>
      </section>

      <div className="grid grid-cols-2 gap-1 rounded-xl border border-slate-800/80 bg-[#07172b] p-1 sm:grid-cols-4" role="tablist" aria-label="Skills views">
        {([
          ["equipment", "By Equipment"],
          ["skill", "By Skill"],
          ["training", "Training"],
          ["certificates", "Certificates"],
        ] as const).map(([key, label]) => (
          <button key={key} type="button" role="tab" aria-selected={view === key} onClick={() => setView(key)} className={`min-h-11 rounded-lg px-3 text-sm font-medium transition-colors ${view === key ? "bg-blue-500/15 text-blue-300" : "text-slate-500 hover:text-slate-200"}`}>{label}</button>
        ))}
      </div>

      {view === "equipment" ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {profiles.map((profile) => (
            <article key={profile.equipment.id} className={`${CARD} overflow-hidden`}>
              <Link to={`/engineer/equipment/${profile.equipment.id}`} className="flex items-center gap-3 border-b border-slate-800/60 p-4 sm:p-5">
                <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-500/10 text-blue-400"><Wrench className="h-5 w-5" /></span>
                <div className="min-w-0 flex-1"><h2 className="truncate text-base font-semibold text-slate-100">{profile.equipment.name}</h2><p className="truncate text-xs text-slate-500">{profile.equipment.assetNumber} · {profile.equipment.area}</p></div>
                <div className="text-right"><p className={`text-xl font-semibold tabular-nums ${readinessTone(profile.readiness)}`}>{profile.readiness}%</p><p className="text-[10px] text-slate-600">readiness</p></div>
              </Link>
              <div className="space-y-2 p-4 sm:p-5">
                {profile.skills.slice(0, 5).map((skill) => {
                  const effective = skill.verifiedLevel ?? skill.managerLevel;
                  return (
                    <Link key={skill.skillId} to={`/engineer/skills/${encodeURIComponent(skill.name)}?equipment=${profile.equipment.id}`} className={`${RAISED} flex min-h-14 items-center gap-3 p-3 hover:border-blue-400/40`}>
                      <div className="min-w-0 flex-1"><p className="truncate text-xs font-medium text-slate-200">{skill.name}</p><p className="mt-0.5 text-[10px] text-slate-500">Required L{skill.requiredLevel}{skill.trainingRequired ? " · Training required" : ""}</p></div>
                      <span className={`inline-flex min-w-10 items-center justify-center rounded-lg border px-2 py-1 text-xs font-semibold ${levelTone(effective, skill.requiredLevel)}`}>L{effective ?? "—"}</span>
                      <ChevronRight className="h-4 w-4 text-slate-600" />
                    </Link>
                  );
                })}
                {profile.skills.length === 0 ? <p className="py-5 text-center text-xs text-slate-500">No required skills are linked to this asset.</p> : null}
              </div>
              <div className="grid grid-cols-3 border-t border-slate-800/60 px-4 py-3 text-center text-xs sm:px-5"><div><p className="font-semibold tabular-nums text-emerald-400">{profile.competent}</p><p className="text-[10px] text-slate-600">Competent</p></div><div className="border-x border-slate-800/60"><p className="font-semibold tabular-nums text-red-400">{profile.gaps}</p><p className="text-[10px] text-slate-600">Gap</p></div><div><p className="font-semibold tabular-nums text-amber-400">{profile.reassessment}</p><p className="text-[10px] text-slate-600">Due / pending</p></div></div>
            </article>
          ))}
        </div>
      ) : null}

      {view === "skill" ? (
        <section className={`${CARD} overflow-hidden`}>
          <div className="flex items-center justify-between border-b border-slate-800/60 px-4 py-4 sm:px-5"><div className="flex items-center gap-2"><Network className="h-5 w-5 text-blue-400" /><h2 className="text-sm font-semibold text-slate-100">My competency by skill</h2></div><span className="text-xs text-slate-500">{allSkills.length} equipment requirements</span></div>
          <div className="divide-y divide-slate-800/55">
            {allSkills.map((skill) => {
              const effective = skill.verifiedLevel ?? skill.managerLevel;
              return (
                <Link key={`${skill.equipment.id}-${skill.skillId}`} to={`/engineer/skills/${encodeURIComponent(skill.name)}?equipment=${skill.equipment.id}`} className="grid min-h-16 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 hover:bg-blue-500/[0.04] sm:px-5 md:grid-cols-[minmax(0,1fr)_12rem_5rem_auto]">
                  <div className="min-w-0"><p className="truncate text-sm font-medium text-slate-100">{skill.name}</p><p className="truncate text-xs text-slate-500">{skill.equipment.name}</p></div>
                  <p className="hidden truncate text-xs text-slate-500 md:block">{skill.category}</p>
                  <span className={`inline-flex min-w-10 items-center justify-center rounded-lg border px-2 py-1 text-xs font-semibold ${levelTone(effective, skill.requiredLevel)}`}>L{effective ?? "—"}</span>
                  <ChevronRight className="h-4 w-4 text-slate-600" />
                </Link>
              );
            })}
          </div>
        </section>
      ) : null}

      {view === "training" ? (
        <section className={`${CARD} overflow-hidden`}>
          <div className="flex items-center justify-between border-b border-slate-800/60 px-4 py-4 sm:px-5"><div className="flex items-center gap-2"><GraduationCap className="h-5 w-5 text-violet-400" /><h2 className="text-sm font-semibold text-slate-100">My Training</h2></div><span className="text-xs text-slate-500">Assigned and completed</span></div>
          <div className="divide-y divide-slate-800/55">
            {training.map((item) => (
              <div key={`${item.title}-${item.date}`} className="grid min-h-16 gap-2 px-4 py-3 sm:px-5 md:grid-cols-[minmax(0,1fr)_8rem_8rem] md:items-center">
                <div className="min-w-0"><p className="text-sm font-medium text-slate-100">{item.title}</p><p className="mt-0.5 text-xs text-slate-500">{[item.provider, item.deliveryType].filter(Boolean).join(" · ") || "Training record"}</p></div>
                <p className={`text-xs font-semibold ${statusTone(item.status)}`}>{item.status}</p>
                <p className="text-xs text-slate-500">{dateLabel(item.date)}</p>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {view === "certificates" ? (
        <section className={`${CARD} overflow-hidden`}>
          <div className="flex items-center justify-between border-b border-slate-800/60 px-4 py-4 sm:px-5"><div className="flex items-center gap-2"><Award className="h-5 w-5 text-blue-400" /><h2 className="text-sm font-semibold text-slate-100">Certificates</h2></div><span className="text-xs text-slate-500">Expiry and refresher status</span></div>
          <div className="divide-y divide-slate-800/55">
            {certificates.map((item) => (
              <div key={item.name} className="grid min-h-16 gap-2 px-4 py-3 sm:px-5 md:grid-cols-[minmax(0,1fr)_10rem_8rem] md:items-center">
                <div><p className="text-sm font-medium text-slate-100">{item.name}</p><p className="text-xs text-slate-500">{item.category}</p></div>
                <p className="text-xs text-slate-500">Expires {dateLabel(item.expiryDate)}</p>
                <p className={`text-xs font-semibold ${statusTone(item.status)}`}>{item.status}</p>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

export function EngineerSkillDetailScreen(): JSX.Element {
  const { skillName } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const equipmentId = searchParams.get("equipment") ?? "";
  const decodedName = decodeURIComponent(skillName ?? "");
  const [skill, setSkill] = useState<(PersonalSkill & { equipment: EquipmentListItem }) | null>(null);
  const [loading, setLoading] = useState(true);
  const [selfAssessmentOpen, setSelfAssessmentOpen] = useState(false);
  const [nextSelfLevel, setNextSelfLevel] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void loadSkillProfiles().then((data) => {
      if (cancelled) return;
      const matches = data.profiles.flatMap((profile) => profile.skills.map((item) => ({ ...item, equipment: profile.equipment })));
      const matched = matches.find((item) => item.name === decodedName && (!equipmentId || item.equipment.id === equipmentId)) ?? matches.find((item) => item.name === decodedName) ?? null;
      setSkill(matched);
      setNextSelfLevel(matched?.selfLevel ?? null);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [decodedName, equipmentId]);

  const saveSelfAssessment = async (): Promise<void> => {
    if (!skill || !nextSelfLevel || skill.engineerId === "demo-engineer") {
      setSaveMessage("Self-assessment is shown in the new workflow, but this demo record is not writable.");
      return;
    }
    setSaving(true);
    setSaveMessage(null);
    try {
      const { error } = await supabase
        .from("engineer_skills")
        .update({ self_rating: nextSelfLevel })
        .eq("engineer_id", skill.engineerId)
        .eq("skill_id", skill.skillId);
      if (error) throw error;
      setSkill((current) => current ? { ...current, selfLevel: nextSelfLevel } : current);
      setSaveMessage(`Self-assessment updated to Level ${nextSelfLevel}. Verified Level ${skill.verifiedLevel ?? "—"} is unchanged.`);
      setSelfAssessmentOpen(false);
    } catch (error) {
      console.warn("Engineer self-assessment update failed:", error);
      setSaveMessage("Vorta could not save the self-assessment. No verified competency was changed.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div data-vorta-page-content="true" className={PAGE}><div className={`${CARD} h-48 animate-pulse`} /><div className={`${CARD} h-72 animate-pulse`} /></div>;
  if (!skill) return <div data-vorta-page-content="true" className={PAGE}><section className={`${CARD} p-8 text-center`}><p className="text-sm font-semibold text-slate-200">Skill unavailable</p><p className="mt-1 text-xs text-slate-500">This skill is not linked to the current Engineer competency scope.</p></section></div>;

  const verified = skill.verifiedLevel;
  const effectiveVerified = verified ?? skill.managerLevel;

  return (
    <div data-vorta-page-content="true" data-vorta-engineer-skill-detail="true" className={PAGE}>
      <button type="button" onClick={() => navigate(-1)} className="inline-flex w-fit min-h-11 items-center gap-2 text-sm font-medium text-slate-400 hover:text-white"><ArrowLeft className="h-4 w-4" />Back to My Skills</button>

      <header className="text-center md:text-left">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-blue-400">{skill.equipment.name}</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-[-0.025em] text-slate-50 md:text-3xl">{skill.name}</h1>
        <p className="mt-1 text-sm text-slate-400">Required Level {skill.requiredLevel} · {skill.category}</p>
      </header>

      <section className={`${CARD} overflow-hidden border-blue-500/35 bg-blue-500/[0.08] p-5 sm:p-6`}>
        <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_minmax(240px,0.7fr)] md:items-center">
          <div>
            <div className="inline-flex items-center gap-2 rounded-xl border border-blue-500/30 bg-blue-500/10 px-4 py-3 text-blue-300">
              <ShieldCheck className="h-5 w-5" />
              <span className="text-lg font-semibold">Verified Level {verified ?? "—"}</span>
            </div>
            <p className="mt-3 max-w-xl text-sm leading-6 text-slate-400">Verified competency is controlled by authorised assessment. Your self-assessment can be updated without overwriting the verified level.</p>
          </div>
          <div className={`${RAISED} p-4`}>
            <div className="flex items-center justify-between gap-3"><span className="text-xs text-slate-500">Self-assessed</span><span className="text-lg font-semibold text-emerald-400">Level {skill.selfLevel ?? "—"}</span></div>
            <div className="mt-3 flex items-center justify-between gap-3"><span className="text-xs text-slate-500">Assessment status</span><span className={`text-xs font-semibold ${statusTone(skill.verificationStatus)}`}>{skill.verificationStatus.replace(/_/g, " ")}</span></div>
          </div>
        </div>
      </section>

      <section className={`${CARD} p-5 sm:p-6`}>
        <h2 className="text-base font-semibold text-slate-100">Competency Levels</h2>
        <div className="mt-5 grid grid-cols-4 gap-2">
          {[
            [1, "Awareness"], [2, "Assisted"], [3, "Competent"], [4, "Expert"],
          ].map(([level, label]) => {
            const numeric = Number(level);
            const isVerified = effectiveVerified === numeric;
            const isSelf = skill.selfLevel === numeric;
            return (
              <div key={numeric} className={`relative rounded-xl border p-3 text-center ${isVerified ? "border-blue-400/45 bg-blue-500/10" : isSelf ? "border-emerald-500/35 bg-emerald-500/[0.07]" : "border-slate-800/70 bg-[#07172b]"}`}>
                <span className={`mx-auto inline-flex h-9 w-9 items-center justify-center rounded-full border text-sm font-semibold ${isVerified ? "border-blue-400/50 text-blue-300" : isSelf ? "border-emerald-500/45 text-emerald-300" : "border-slate-700 text-slate-500"}`}>{numeric}</span>
                <p className="mt-2 text-[10px] font-medium text-slate-400 sm:text-xs">{label}</p>
                {isVerified ? <span className="mt-1 block text-[9px] font-semibold uppercase tracking-wide text-blue-400">Verified</span> : isSelf ? <span className="mt-1 block text-[9px] font-semibold uppercase tracking-wide text-emerald-400">Self</span> : null}
              </div>
            );
          })}
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-2">
        <section className={`${CARD} p-5 sm:p-6`}>
          <div className="flex items-center gap-2"><ClipboardCheck className="h-5 w-5 text-blue-400" /><h2 className="text-base font-semibold text-slate-100">Evidence & Assessment</h2></div>
          <div className="mt-4 space-y-3">
            <div className={`${RAISED} flex items-center justify-between gap-3 p-3`}><span className="text-xs text-slate-500">Verified level</span><span className="text-sm font-semibold text-blue-300">L{verified ?? "—"}</span></div>
            <div className={`${RAISED} flex items-center justify-between gap-3 p-3`}><span className="text-xs text-slate-500">Manager level</span><span className="text-sm font-semibold text-slate-200">L{skill.managerLevel ?? "—"}</span></div>
            <div className={`${RAISED} flex items-center justify-between gap-3 p-3`}><span className="text-xs text-slate-500">Training required</span><span className={`text-xs font-semibold ${skill.trainingRequired ? "text-amber-400" : "text-emerald-400"}`}>{skill.trainingRequired ? "Yes" : "No"}</span></div>
          </div>
        </section>

        <section className={`${CARD} p-5 sm:p-6`}>
          <h2 className="text-base font-semibold text-slate-100">Update Skill</h2>
          <p className="mt-1 text-xs leading-5 text-slate-500">Vorta-native updates only. Imported training and source-system records remain read-only.</p>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <button type="button" className={ACTION} onClick={() => setSaveMessage("Experience evidence workflow is tracked under ENG-015 and will not create a false source record.")}><TrendingUp className="h-4 w-4 text-blue-400" />Add Experience</button>
            <button type="button" className={ACTION} onClick={() => setSaveMessage("Evidence upload workflow is tracked under ENG-015 and will use Vorta-native evidence storage only.")}><Upload className="h-4 w-4 text-blue-400" />Add Evidence</button>
            <button type="button" className={ACTION} onClick={() => { setSelfAssessmentOpen((current) => !current); setSaveMessage(null); }}><RefreshCw className="h-4 w-4 text-blue-400" />Self-Assessment</button>
            <button type="button" className={ACTION} onClick={() => setSaveMessage("Assessment request is tracked under ENG-015. Verified competency remains unchanged until an authorised assessor approves it.")}><FilePlus2 className="h-4 w-4 text-blue-400" />Request Assessment</button>
          </div>

          {selfAssessmentOpen ? (
            <div className="mt-4 rounded-xl border border-blue-500/25 bg-blue-500/[0.06] p-4">
              <p className="text-xs font-semibold text-slate-200">Update self-assessed level</p>
              <div className="mt-3 grid grid-cols-4 gap-2">
                {[1, 2, 3, 4].map((level) => <button key={level} type="button" onClick={() => setNextSelfLevel(level)} className={`min-h-11 rounded-lg border text-sm font-semibold ${nextSelfLevel === level ? "border-blue-400 bg-blue-500/15 text-blue-300" : "border-slate-700 text-slate-500"}`}>L{level}</button>)}
              </div>
              <button type="button" disabled={!nextSelfLevel || saving} onClick={() => void saveSelfAssessment()} className="mt-3 min-h-11 w-full rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50">{saving ? "Saving..." : "Save self-assessment"}</button>
            </div>
          ) : null}

          {saveMessage ? <div role="status" className="mt-4 rounded-xl border border-blue-500/20 bg-blue-500/[0.06] px-3 py-3 text-xs leading-5 text-blue-100/80">{saveMessage}</div> : null}
        </section>
      </div>

      <section className={`${CARD} overflow-hidden border-amber-500/20 bg-amber-500/[0.04]`}>
        <div className="flex items-start gap-3 p-4 sm:p-5"><AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" /><div><p className="text-sm font-semibold text-slate-100">Governance rule</p><p className="mt-1 text-xs leading-5 text-slate-400">Self-assessment and supporting evidence can be updated by the engineer. The verified level can only change through the authorised Vorta assessment workflow. This prevents a self-rating from silently becoming an approved competency.</p></div></div>
      </section>
    </div>
  );
}
