import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

// Category → training providers static mapping (mirrors training-providers-data)
const CATEGORY_TO_PARTNERS: Record<string, string[]> = {
  "Pharmaceutical Compliance":    ["60000000-0000-0000-0000-000000000001"],
  "Pharmaceutical OEM Expertise": ["60000000-0000-0000-0000-000000000003", "60000000-0000-0000-0000-000000000001"],
  "Pharmaceutical Equipment":     ["60000000-0000-0000-0000-000000000003", "60000000-0000-0000-0000-000000000001"],
  "Bosch OEM Expertise":          ["60000000-0000-0000-0000-000000000003"],
  "Automation & Controls":        ["60000000-0000-0000-0000-000000000002"],
  "Electrical Maintenance":       ["60000000-0000-0000-0000-000000000002"],
  "CMMS / Maintenance Systems":   ["60000000-0000-0000-0000-000000000002"],
  "Reliability Engineering":      ["60000000-0000-0000-0000-000000000003"],
  "Mechanical Maintenance":       ["60000000-0000-0000-0000-000000000003"],
  "Certifications & Qualifications": ["60000000-0000-0000-0000-000000000002", "60000000-0000-0000-0000-000000000001"],
};

// Priority of training gap → impact on match score (pp points)
function gapImpact(riskLevel: string): number {
  if (riskLevel === "critical") return 18;
  if (riskLevel === "high")     return 12;
  if (riskLevel === "medium")   return 7;
  return 3;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } }
  );

  // ── Parallel fetch ──────────────────────────────────────────────────────────
  const [
    { data: engineersRaw },
    { data: allAssignmentsRaw },
    { data: riskProfilesRaw },
    { data: bookingsRaw },
    { data: coursesRaw },
    { data: departmentsRaw },
    { data: snapshotsRaw },
    { data: partnersRaw },
    { data: courseSkillsRaw },
  ] = await Promise.all([
    supabase
      .from("engineers")
      .select("id,full_name,employment_type,discipline,availability_status,verified,shift_pattern,department_id,site_id")
      .order("full_name"),
    supabase
      .from("engineer_skills")
      .select("engineer_id,skill_id,self_rating,manager_rating,validated_rating,training_required,verification_status,last_validated_at,expiry_date,years_experience"),
    supabase
      .from("engineer_risk_profiles")
      .select("engineer_id,retirement_risk,leaving_risk,critical_knowledge_holder"),
    supabase
      .from("training_bookings")
      .select("engineer_id,course_id,status,booking_date")
      .not("engineer_id", "is", null),
    supabase
      .from("training_courses")
      .select("id,title,delivery_type,duration_days,price,currency,training_partner_id,status"),
    supabase.from("departments").select("id,name"),
    supabase
      .from("skill_gap_snapshots")
      .select("id,skill_id,department_id,target_rating,current_average_rating,engineers_at_or_above_target,engineers_below_target,single_point_of_failure,risk_level,recommendation"),
    supabase.from("training_partners").select("id,name,location"),
    supabase.from("course_skills").select("course_id,skill_id,target_rating"),
  ]);

  const engineers    = engineersRaw     ?? [];
  const assignments  = allAssignmentsRaw ?? [];
  const riskProfiles = riskProfilesRaw  ?? [];
  const bookings     = bookingsRaw       ?? [];
  const courses      = coursesRaw        ?? [];
  const departments  = departmentsRaw    ?? [];
  const snapshots    = snapshotsRaw      ?? [];
  const partners     = partnersRaw       ?? [];
  const courseSkills = courseSkillsRaw   ?? [];

  // ── Skill metadata ─────────────────────────────────────────────────────────
  const allSkillIds = [...new Set((assignments as { skill_id: string }[]).map((a) => a.skill_id))];
  const { data: skillsRaw } = await supabase
    .from("skills")
    .select("id,name,category,is_critical,certification_required,skill_type")
    .in("id", allSkillIds);
  const skills = skillsRaw ?? [];

  // ── Lookup maps ────────────────────────────────────────────────────────────
  type SkillRow = { id: string; name: string; category: string; is_critical: boolean; certification_required: boolean; skill_type: string };
  type AssignRow = { engineer_id: string; skill_id: string; self_rating: number | null; manager_rating: number | null; validated_rating: number | null; training_required: boolean; verification_status: string; last_validated_at: string | null; expiry_date: string | null; years_experience: number | null };
  type RiskRow = { engineer_id: string; retirement_risk: string; leaving_risk: string; critical_knowledge_holder: boolean };
  type BookingRow = { engineer_id: string; course_id: string; status: string; booking_date: string | null };
  type CourseRow = { id: string; title: string; delivery_type: string; duration_days: number; price: number; currency: string; training_partner_id: string; status: string };
  type SnapRow = { id: string; skill_id: string; department_id: string | null; target_rating: number; current_average_rating: number; engineers_at_or_above_target: number; engineers_below_target: number; single_point_of_failure: boolean; risk_level: string; recommendation: string };
  type PartnerRow = { id: string; name: string; location: string };
  type CourseSkillRow = { course_id: string; skill_id: string; target_rating: number };

  const skillsById   = new Map((skills as SkillRow[]).map((s) => [s.id, s]));
  const deptMap      = new Map((departments as { id: string; name: string }[]).map((d) => [d.id, d.name]));
  const riskMap      = new Map((riskProfiles as RiskRow[]).map((r) => [r.engineer_id, r]));
  const courseMap    = new Map((courses as CourseRow[]).map((c) => [c.id, c]));
  const partnerMap   = new Map((partners as PartnerRow[]).map((p) => [p.id, p]));

  // ── Per-engineer skill map: skill_id → best rating ────────────────────────
  type EngSkillEntry = { rating: number; training_required: boolean; verification_status: string; expiry_date: string | null; years_experience: number | null };
  const engSkillMap = new Map<string, Map<string, EngSkillEntry>>();

  for (const a of assignments as AssignRow[]) {
    const rating = a.validated_rating ?? a.manager_rating ?? a.self_rating ?? null;
    if (rating === null) continue;
    if (!engSkillMap.has(a.engineer_id)) engSkillMap.set(a.engineer_id, new Map());
    engSkillMap.get(a.engineer_id)!.set(a.skill_id, {
      rating,
      training_required: a.training_required,
      verification_status: a.verification_status,
      expiry_date: a.expiry_date,
      years_experience: a.years_experience,
    });
  }

  // ── Requirements: one per unique skill_gap_snapshot ───────────────────────
  // Deduplicate by skill_id, keeping worst risk_level
  const reqsBySkill = new Map<string, SnapRow>();
  for (const snap of snapshots as SnapRow[]) {
    const existing = reqsBySkill.get(snap.skill_id);
    if (!existing) { reqsBySkill.set(snap.skill_id, snap); continue; }
    const order: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
    if ((order[snap.risk_level] ?? 9) < (order[existing.risk_level] ?? 9)) {
      reqsBySkill.set(snap.skill_id, snap);
    }
  }
  const requirements = [...reqsBySkill.values()];

  // ── Course → skills map ────────────────────────────────────────────────────
  const courseToSkills = new Map<string, string[]>();
  for (const cs of courseSkills as CourseSkillRow[]) {
    if (!courseToSkills.has(cs.course_id)) courseToSkills.set(cs.course_id, []);
    courseToSkills.get(cs.course_id)!.push(cs.skill_id);
  }

  // ── Active training bookings per engineer ─────────────────────────────────
  const activeBookingsByEng = new Map<string, string[]>(); // engineer_id → course titles
  for (const b of bookings as BookingRow[]) {
    if (!b.engineer_id) continue;
    if (!["booked", "approved", "pending"].includes(b.status)) continue;
    const course = courseMap.get(b.course_id) as CourseRow | undefined;
    if (!course) continue;
    if (!activeBookingsByEng.has(b.engineer_id)) activeBookingsByEng.set(b.engineer_id, []);
    activeBookingsByEng.get(b.engineer_id)!.push(course.title);
  }

  // ── Match scoring ──────────────────────────────────────────────────────────
  // Requirements represent skills needed. Score each engineer against each requirement
  // by checking if they hold the required skill at or above target_rating.
  // Dimensions: skills (40%), certifications (25%), experience (20%), availability (15%)

  const engList = engineers as {
    id: string; full_name: string; employment_type: string; discipline: string | null;
    availability_status: string; verified: boolean; shift_pattern: string | null;
    department_id: string; site_id: string | null;
  }[];

  // Aggregate all requirement skill IDs (for global gap analysis)
  const reqSkillIds = new Set(requirements.map((r) => r.skill_id));

  // Per-engineer match results (matched against ALL requirements collectively)
  const matchResults = engList.map((eng) => {
    const skillMap = engSkillMap.get(eng.id) ?? new Map<string, EngSkillEntry>();
    const rp       = riskMap.get(eng.id) as RiskRow | undefined;

    // ── Skills match ─────────────────────────────────────────────────────
    const reqSkillArr = requirements.filter((r) => reqSkillIds.has(r.skill_id));
    const matchedSkillIds: string[] = [];
    const missingSkillIds: string[] = [];
    let skillRatingSum = 0;
    let skillRatingCount = 0;

    for (const req of reqSkillArr) {
      const entry = skillMap.get(req.skill_id);
      if (entry && entry.rating >= req.target_rating) {
        matchedSkillIds.push(req.skill_id);
        skillRatingSum += Math.min(entry.rating / req.target_rating, 1);
        skillRatingCount++;
      } else {
        missingSkillIds.push(req.skill_id);
        // Partial credit if they have some rating below target
        const partialRating = entry ? entry.rating / req.target_rating : 0;
        skillRatingSum += partialRating * 0.5;
        skillRatingCount++;
      }
    }
    const skillScore = skillRatingCount > 0 ? (skillRatingSum / skillRatingCount) * 100 : 50;

    // ── Certification match ───────────────────────────────────────────────
    const certReqSkills = reqSkillArr.filter((r) => {
      const s = skillsById.get(r.skill_id) as SkillRow | undefined;
      return s?.certification_required;
    });
    let certScore = 100;
    if (certReqSkills.length > 0) {
      const today = new Date();
      let certMet = 0;
      for (const req of certReqSkills) {
        const entry = skillMap.get(req.skill_id);
        if (!entry) continue;
        if (entry.verification_status === "validated") {
          // Check expiry
          if (!entry.expiry_date || new Date(entry.expiry_date) > today) certMet++;
          else certMet += 0.3; // expired
        } else if (entry.verification_status === "pending") {
          certMet += 0.6;
        }
      }
      certScore = (certMet / certReqSkills.length) * 100;
    }

    // ── Experience match ──────────────────────────────────────────────────
    const allYears = [...skillMap.values()]
      .map((e) => e.years_experience)
      .filter((y): y is number => y !== null && y !== undefined);
    const maxYears = allYears.length > 0 ? Math.max(...allYears) : 0;
    // Normalise: 10+ years = 100%, 5 years = 70%, 2 years = 40%, 0 = 20%
    const experienceScore = Math.min(100, maxYears >= 10 ? 100 : maxYears >= 5 ? 70 + (maxYears - 5) * 6 : maxYears >= 2 ? 40 + (maxYears - 2) * 10 : 20 + maxYears * 10);

    // ── Availability match ─────────────────────────────────────────────────
    const availScore =
      eng.availability_status === "available" ? 100
      : eng.availability_status === "on_shift"  ? 65
      : eng.availability_status === "on_leave"  ? 20
      : eng.availability_status === "training"  ? 40
      : 50;

    // ── Composite score (weighted) ─────────────────────────────────────────
    const overallScore = Math.round(
      skillScore * 0.40 +
      certScore  * 0.25 +
      experienceScore * 0.20 +
      availScore * 0.15
    );

    // ── Matched / missing skills display names ────────────────────────────
    const matchedSkillNames = matchedSkillIds
      .slice(0, 5)
      .map((id) => (skillsById.get(id) as SkillRow | undefined)?.name ?? "Unknown")
      .filter(Boolean);

    const missingSkillNames = missingSkillIds
      .slice(0, 5)
      .map((id) => (skillsById.get(id) as SkillRow | undefined)?.name ?? "Unknown")
      .filter(Boolean);

    // ── Certification names held ──────────────────────────────────────────
    const certNames: string[] = [];
    for (const [skillId, entry] of skillMap.entries()) {
      const s = skillsById.get(skillId) as SkillRow | undefined;
      if (s?.certification_required && entry.verification_status === "validated") {
        certNames.push(s.name);
      }
    }

    // ── Match status ──────────────────────────────────────────────────────
    const status =
      overallScore >= 85 ? "Strong Match"
      : overallScore >= 70 ? "Good Match"
      : overallScore >= 55 ? "Partial Match"
      : "Weak Match";

    // ── Training gap count ────────────────────────────────────────────────
    const trainingGap = missingSkillIds.length;

    // ── AI recommendation text ─────────────────────────────────────────────
    const topMissing = missingSkillNames.slice(0, 2).join(", ") || "no critical gaps";
    const topMatched = matchedSkillNames.slice(0, 2).join(", ") || "general maintenance skills";
    const aiRecommendation =
      overallScore >= 85
        ? `Strong match. ${eng.full_name} meets or exceeds target ratings across most required skills. ${trainingGap === 0 ? "No training gaps identified." : `Minor gap in ${topMissing} — recommend targeted refresher.`}`
        : overallScore >= 70
        ? `Good candidate. Strong in ${topMatched}. ${trainingGap > 0 ? `Missing ${topMissing} — schedule training before deployment.` : "Meets certification requirements."}`
        : overallScore >= 55
        ? `Partial match. Core competency in ${topMatched} but significant gaps in ${topMissing}. Training required before deployment.`
        : `Weak match. Significant skill gaps across ${trainingGap} areas. Consider redeployment or extensive upskilling programme.`;

    return {
      engineer_id:         eng.id,
      engineer_name:       eng.full_name,
      discipline:          eng.discipline ?? "—",
      employment_type:     eng.employment_type,
      department_name:     deptMap.get(eng.department_id) ?? null,
      availability_status: eng.availability_status,
      overall_score:       overallScore,
      skills_score:        Math.round(skillScore),
      cert_score:          Math.round(certScore),
      experience_score:    Math.round(experienceScore),
      avail_score:         availScore,
      training_gap:        trainingGap,
      matched_skills:      matchedSkillNames,
      missing_skills:      missingSkillNames,
      certifications:      certNames.slice(0, 5),
      active_training:     activeBookingsByEng.get(eng.id) ?? [],
      status,
      ai_recommendation:   aiRecommendation,
      critical_knowledge_holder: rp?.critical_knowledge_holder ?? false,
      years_experience:    allYears.length > 0 ? Math.max(...allYears) : 0,
    };
  });

  // Sort by overall score descending
  matchResults.sort((a, b) => b.overall_score - a.overall_score);

  // ── Training gap recommendations ──────────────────────────────────────────
  // For each high/critical snapshot gap, find a relevant course and provider
  type GapRec = {
    skill_name: string;
    category: string;
    risk_level: string;
    engineers_below: number;
    recommended_course: string | null;
    provider_name: string | null;
    provider_location: string | null;
    priority: string;
    score_impact: number;
  };

  const gapRecs: GapRec[] = [];
  const seenGapSkills = new Set<string>();

  const sortedSnaps = [...(snapshots as SnapRow[])].sort((a, b) => {
    const order: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
    return (order[a.risk_level] ?? 9) - (order[b.risk_level] ?? 9);
  });

  for (const snap of sortedSnaps.slice(0, 20)) {
    const skill = skillsById.get(snap.skill_id) as SkillRow | undefined;
    if (!skill || seenGapSkills.has(skill.name)) continue;
    seenGapSkills.add(skill.name);

    // Find best course for this skill via course_skills
    const matchedCourse = (courses as CourseRow[]).find((c) => {
      if (c.status !== "active") return false;
      const cSkills = courseToSkills.get(c.id) ?? [];
      return cSkills.includes(snap.skill_id);
    });

    // Fallback: match by partner category affinity
    const affinityPartnerIds = CATEGORY_TO_PARTNERS[skill.category] ?? [];
    const affinityCourse = matchedCourse ?? (courses as CourseRow[]).find((c) =>
      c.status === "active" && affinityPartnerIds.includes(c.training_partner_id)
    );

    const partner = affinityCourse?.training_partner_id
      ? (partnerMap.get(affinityCourse.training_partner_id) as PartnerRow | undefined)
      : undefined;

    gapRecs.push({
      skill_name:          skill.name,
      category:            skill.category,
      risk_level:          snap.risk_level,
      engineers_below:     snap.engineers_below_target,
      recommended_course:  affinityCourse?.title ?? null,
      provider_name:       partner?.name ?? null,
      provider_location:   partner?.location ?? null,
      priority:            snap.single_point_of_failure || snap.risk_level === "critical" ? "Critical" : snap.risk_level === "high" ? "High" : "Medium",
      score_impact:        gapImpact(snap.risk_level),
    });

    if (gapRecs.length >= 10) break;
  }

  // ── KPI stats ──────────────────────────────────────────────────────────────
  const openRequirements = requirements.filter(
    (r) => r.risk_level === "critical" || r.risk_level === "high"
  ).length;

  const availableEngineers = engList.filter(
    (e) => e.availability_status === "available" || e.availability_status === "on_shift"
  ).length;

  const bestMatchScore = matchResults.length > 0 ? matchResults[0].overall_score : 0;

  const criticalSkillGaps = (snapshots as SnapRow[]).filter(
    (s) => s.risk_level === "critical"
  ).length;

  // ── Departments list for filters ──────────────────────────────────────────
  const uniqueDepts = [...new Set(
    engList.map((e) => deptMap.get(e.department_id)).filter(Boolean)
  )] as string[];

  // ── Unique skills for filters ──────────────────────────────────────────────
  const uniqueSkillNames = [...new Set(
    (skills as SkillRow[]).map((s) => s.name)
  )].sort().slice(0, 50);

  // ── Certifications for filters ─────────────────────────────────────────────
  const uniqueCertNames = [...new Set(
    (skills as SkillRow[]).filter((s) => s.certification_required).map((s) => s.name)
  )].sort();

  return new Response(
    JSON.stringify({
      matchResults,
      gapRecs,
      departments: uniqueDepts,
      skills: uniqueSkillNames,
      certifications: uniqueCertNames,
      stats: {
        openRequirements,
        availableEngineers,
        bestMatchScore,
        criticalSkillGaps,
        totalEngineers: engList.length,
        totalRequirements: requirements.length,
      },
    }),
    { headers: { "Content-Type": "application/json", ...corsHeaders } }
  );
});
