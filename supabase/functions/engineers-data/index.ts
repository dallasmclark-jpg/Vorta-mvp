import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } }
  );

  // ── Parallel fetch ────────────────────────────────────────────────────────
  const [
    { data: engineers },
    { data: allAssignments },
    { data: riskProfiles },
    { data: trainingBookings },
    { data: trainingCourses },
    { data: departments },
    { data: sites },
    { data: skillGapSnaps },
  ] = await Promise.all([
    supabase
      .from("engineers")
      .select("id,full_name,employment_type,discipline,availability_status,verified,shift_pattern,department_id,site_id")
      .order("full_name"),
    supabase
      .from("engineer_skills")
      .select("engineer_id,skill_id,self_rating,manager_rating,validated_rating,training_required,verification_status,last_validated_at,expiry_date"),
    supabase
      .from("engineer_risk_profiles")
      .select("engineer_id,retirement_risk,leaving_risk,critical_knowledge_holder"),
    supabase
      .from("training_bookings")
      .select("engineer_id,course_id,status,booking_date")
      .not("engineer_id", "is", null),
    supabase
      .from("training_courses")
      .select("id,title"),
    supabase.from("departments").select("id,name"),
    supabase.from("sites").select("id,name,region"),
    supabase
      .from("skill_gap_snapshots")
      .select("id,skill_id,department_id,target_rating,current_average_rating,engineers_at_or_above_target,engineers_below_target,single_point_of_failure,risk_level,recommendation,snapshot_date"),
  ]);

  const engList = engineers ?? [];
  const assignList = allAssignments ?? [];
  const riskList = riskProfiles ?? [];
  const bookingList = trainingBookings ?? [];
  const courseList = trainingCourses ?? [];
  const deptList = departments ?? [];
  const siteList = sites ?? [];
  const snapList = skillGapSnaps ?? [];

  // ── Skill metadata ────────────────────────────────────────────────────────
  const allSkillIds = [...new Set((assignList as { skill_id: string }[]).map((a) => a.skill_id))];
  const { data: allSkills } = await supabase
    .from("skills")
    .select("id,name,category,is_critical")
    .in("id", allSkillIds);

  const skillsById = new Map((allSkills ?? []).map((s: { id: string }) => [s.id, s]));
  const deptMap = new Map(deptList.map((d: { id: string; name: string }) => [d.id, d.name]));
  const siteMap = new Map(siteList.map((s: { id: string; name: string; region: string }) => [s.id, s]));
  const riskMap = new Map((riskList as { engineer_id: string }[]).map((r) => [r.engineer_id, r]));
  const courseMap = new Map((courseList as { id: string; title: string }[]).map((c) => [c.id, c.title]));

  // ── Per-engineer stats ────────────────────────────────────────────────────
  type RatedSkill = { name: string; category: string; rating: number; is_critical: boolean };
  type EngStat = {
    total: number; count: number; trainingCount: number;
    criticalCount: number; criticalMet: number;
    expiredAny: boolean; lastAssessDate: string | null;
    ratedSkills: RatedSkill[];
  };

  const engStats = new Map<string, EngStat>();

  for (const a of assignList as {
    engineer_id: string; skill_id: string;
    validated_rating: number | null; manager_rating: number | null; self_rating: number | null;
    training_required: boolean; verification_status: string; last_validated_at: string | null;
  }[]) {
    const r = a.validated_rating ?? a.manager_rating ?? a.self_rating ?? null;
    const skill = skillsById.get(a.skill_id) as { name: string; category: string; is_critical: boolean } | undefined;

    if (!engStats.has(a.engineer_id)) {
      engStats.set(a.engineer_id, {
        total: 0, count: 0, trainingCount: 0, criticalCount: 0,
        criticalMet: 0, expiredAny: false, lastAssessDate: null, ratedSkills: [],
      });
    }
    const e = engStats.get(a.engineer_id)!;

    if (r !== null) {
      e.total += r;
      e.count++;
      e.ratedSkills.push({ name: skill?.name ?? "Unknown", category: skill?.category ?? "", rating: r, is_critical: skill?.is_critical ?? false });
    }
    if (a.training_required) e.trainingCount++;
    if (skill?.is_critical) {
      e.criticalCount++;
      if (r !== null && r >= 3) e.criticalMet++;
    }
    if (a.verification_status && a.verification_status !== "validated") e.expiredAny = true;
    if (a.last_validated_at && (!e.lastAssessDate || a.last_validated_at > e.lastAssessDate)) {
      e.lastAssessDate = a.last_validated_at;
    }
  }

  // ── Per-engineer training counts ──────────────────────────────────────────
  const trainingByEng = new Map<string, { completed: number; active: number }>();
  for (const b of bookingList as { engineer_id: string; status: string }[]) {
    if (!b.engineer_id) continue;
    if (!trainingByEng.has(b.engineer_id)) trainingByEng.set(b.engineer_id, { completed: 0, active: 0 });
    const t = trainingByEng.get(b.engineer_id)!;
    if (b.status === "completed") t.completed++;
    else t.active++;
  }

  // ── Enriched engineers ────────────────────────────────────────────────────
  const enrichedEngineers = engList.map((eng: {
    id: string; full_name: string; employment_type: string; discipline: string | null;
    availability_status: string; verified: boolean; shift_pattern: string | null;
    department_id: string; site_id: string | null;
  }) => {
    const st = engStats.get(eng.id);
    const avg = st && st.count > 0 ? st.total / st.count : 0;
    const score = Math.round((avg / 5) * 100);
    const risk = score >= 80 ? "low" : score >= 68 ? "medium" : score >= 55 ? "high" : "critical";
    const rp = riskMap.get(eng.id) as { retirement_risk: string; leaving_risk: string; critical_knowledge_holder: boolean } | undefined;
    const site = siteMap.get(eng.site_id ?? "") as { name: string; region: string } | undefined;
    const topSkills = [...(st?.ratedSkills ?? [])].sort((a, b) => b.rating - a.rating).slice(0, 10);
    const tb = trainingByEng.get(eng.id);

    return {
      ...eng,
      department_name: deptMap.get(eng.department_id) ?? null,
      site_name: site?.name ?? null,
      site_region: site?.region ?? null,
      skills_score: score,
      risk_level: risk,
      training_count: st?.trainingCount ?? 0,
      total_skills_assessed: st?.count ?? 0,
      critical_skills_count: st?.criticalCount ?? 0,
      critical_skills_met: st?.criticalMet ?? 0,
      has_expired_validation: st?.expiredAny ?? false,
      last_assessment_date: st?.lastAssessDate ?? null,
      top_skills: topSkills,
      training_completed: tb?.completed ?? 0,
      training_active: tb?.active ?? 0,
      critical_knowledge_holder: rp?.critical_knowledge_holder ?? false,
      retirement_risk: rp?.retirement_risk ?? null,
      leaving_risk: rp?.leaving_risk ?? null,
    };
  });

  // ── Enriched assignments (for detail drawer) ──────────────────────────────
  const enrichedAssignments = (assignList as {
    engineer_id: string; skill_id: string;
    validated_rating: number | null; manager_rating: number | null; self_rating: number | null;
    training_required: boolean; verification_status: string; last_validated_at: string | null;
  }[]).map((a) => {
    const skill = skillsById.get(a.skill_id) as { name: string; category: string; is_critical: boolean } | undefined;
    return {
      engineer_id: a.engineer_id,
      skill_id: a.skill_id,
      skill_name: skill?.name ?? "Unknown",
      skill_category: skill?.category ?? "",
      is_critical: skill?.is_critical ?? false,
      rating: a.validated_rating ?? a.manager_rating ?? a.self_rating ?? null,
      training_required: a.training_required,
      verification_status: a.verification_status,
      last_validated_at: a.last_validated_at,
    };
  });

  // ── Enriched bookings (for detail drawer) ─────────────────────────────────
  const enrichedBookings = (bookingList as {
    engineer_id: string; course_id: string; status: string; booking_date: string | null;
  }[]).map((b) => ({
    engineer_id: b.engineer_id,
    course_title: courseMap.get(b.course_id) ?? "Unknown Course",
    status: b.status,
    booking_date: b.booking_date,
  }));

  // ── Enriched skill gaps ───────────────────────────────────────────────────
  const enrichedGaps = (snapList as { skill_id: string; department_id: string | null }[]).map((sg) => ({
    ...sg,
    skill_name: (skillsById.get(sg.skill_id) as { name: string } | undefined)?.name ?? "Unknown",
    skill_category: (skillsById.get(sg.skill_id) as { category: string } | undefined)?.category ?? "",
    department_name: sg.department_id ? (deptMap.get(sg.department_id) ?? null) : null,
  }));

  // ── KPI stats ─────────────────────────────────────────────────────────────
  const today = new Date();
  const thirtyDaysOut = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);
  const certsExpiring = (assignList as { expiry_date: string | null }[]).filter((a) => {
    if (!a.expiry_date) return false;
    const d = new Date(a.expiry_date);
    return d >= today && d <= thirtyDaysOut;
  }).length;

  const inTrainingSet = new Set(
    (bookingList as { engineer_id: string; status: string }[])
      .filter((b) => b.engineer_id && ["booked", "approved", "pending"].includes(b.status))
      .map((b) => b.engineer_id)
  );

  const avgScore =
    enrichedEngineers.length > 0
      ? Math.round(enrichedEngineers.reduce((s: number, e: { skills_score: number }) => s + e.skills_score, 0) / enrichedEngineers.length)
      : 0;

  const stats = {
    totalEngineers: engList.length,
    verifiedEngineers: (engList as { verified: boolean }[]).filter((e) => e.verified).length,
    currentlyAvailable: (engList as { availability_status: string }[]).filter((e) => e.availability_status === "available").length,
    onShiftToday: (engList as { availability_status: string }[]).filter((e) => e.availability_status === "on_shift").length,
    inTraining: inTrainingSet.size,
    criticalHolders: (riskList as { critical_knowledge_holder: boolean }[]).filter((r) => r.critical_knowledge_holder).length,
    avgCompetencyScore: avgScore,
    certificationsExpiring30d: certsExpiring,
  };

  return new Response(
    JSON.stringify({
      engineers: enrichedEngineers,
      assignments: enrichedAssignments,
      trainingBookings: enrichedBookings,
      skillGaps: enrichedGaps,
      departments: deptList,
      sites: siteList,
      stats,
    }),
    { headers: { "Content-Type": "application/json", ...corsHeaders } }
  );
});
