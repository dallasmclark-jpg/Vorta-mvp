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

  // ── Parallel fetch ──────────────────────────────────────────────────────────
  const [
    { data: skillGapSnaps },
    { data: departments },
    { data: engineers },
    { data: allAssignments },
    { data: riskProfiles },
    { data: trainingBookings },
    { data: trainingCourses },
  ] = await Promise.all([
    supabase
      .from("skill_gap_snapshots")
      .select("id,skill_id,department_id,target_rating,current_average_rating,engineers_at_or_above_target,engineers_below_target,single_point_of_failure,risk_level,recommendation,snapshot_date"),
    supabase.from("departments").select("id,name"),
    supabase
      .from("engineers")
      .select("id,full_name,discipline,department_id,availability_status")
      .order("full_name"),
    supabase
      .from("engineer_skills")
      .select("engineer_id,skill_id,validated_rating,manager_rating,self_rating,training_required,verification_status,expiry_date"),
    supabase
      .from("engineer_risk_profiles")
      .select("engineer_id,critical_knowledge_holder,retirement_risk,leaving_risk"),
    supabase
      .from("training_bookings")
      .select("engineer_id,course_id,status,booking_date")
      .not("engineer_id", "is", null),
    supabase.from("training_courses").select("id,title"),
  ]);

  const snapList    = skillGapSnaps  ?? [];
  const deptList    = departments    ?? [];
  const engList     = engineers      ?? [];
  const assignList  = allAssignments ?? [];
  const riskList    = riskProfiles   ?? [];
  const bookingList = trainingBookings ?? [];
  const courseList  = trainingCourses  ?? [];

  // ── Skill metadata ──────────────────────────────────────────────────────────
  const allSkillIds = [
    ...new Set((snapList as { skill_id: string }[]).map((s) => s.skill_id)),
  ];
  const { data: allSkills } = await supabase
    .from("skills")
    .select("id,name,category,is_critical,certification_required,skill_type")
    .in("id", allSkillIds);

  const skillsById = new Map((allSkills ?? []).map((s: { id: string }) => [s.id, s]));
  const deptMap    = new Map(deptList.map((d: { id: string; name: string }) => [d.id, d.name]));
  const courseMap  = new Map((courseList as { id: string; title: string }[]).map((c) => [c.id, c.title]));

  // ── Per-engineer qualification map: skill_id → set of qualified engineer IDs ──
  type AssignRow = {
    engineer_id: string; skill_id: string;
    validated_rating: number | null; manager_rating: number | null; self_rating: number | null;
    training_required: boolean; verification_status: string; expiry_date: string | null;
  };

  const qualifiedBySkill = new Map<string, Set<string>>();
  const trainingBySkill  = new Map<string, Set<string>>();

  for (const a of assignList as AssignRow[]) {
    const r = a.validated_rating ?? a.manager_rating ?? a.self_rating ?? null;
    if (!qualifiedBySkill.has(a.skill_id)) qualifiedBySkill.set(a.skill_id, new Set());
    if (!trainingBySkill.has(a.skill_id))  trainingBySkill.set(a.skill_id, new Set());
    if (r !== null && r >= 3) qualifiedBySkill.get(a.skill_id)!.add(a.engineer_id);
    if (a.training_required)  trainingBySkill.get(a.skill_id)!.add(a.engineer_id);
  }

  // ── Certification expiries ─────────────────────────────────────────────────
  const today   = new Date();
  const ninety  = new Date(today.getTime() + 90 * 24 * 60 * 60 * 1000);
  const certExpiryRows = (assignList as AssignRow[])
    .filter((a) => {
      if (!a.expiry_date) return false;
      const d = new Date(a.expiry_date);
      return d >= today && d <= ninety;
    })
    .map((a) => {
      const skill = skillsById.get(a.skill_id) as { name: string; category: string } | undefined;
      const eng   = (engList as { id: string; full_name: string }[]).find((e) => e.id === a.engineer_id);
      return {
        engineer_name: eng?.full_name ?? "Unknown",
        skill_name:    skill?.name ?? "Unknown",
        expiry_date:   a.expiry_date,
      };
    })
    .sort((a, b) => (a.expiry_date ?? "").localeCompare(b.expiry_date ?? ""))
    .slice(0, 10);

  // ── Risk profile map ────────────────────────────────────────────────────────
  const riskMap = new Map(
    (riskList as { engineer_id: string }[]).map((r) => [r.engineer_id, r])
  );

  // ── In-training engineers ────────────────────────────────────────────────────
  const inTrainingBySkill = new Map<string, { engineer_name: string; course_title: string }[]>();
  for (const b of bookingList as { engineer_id: string; course_id: string; status: string }[]) {
    if (!["booked", "approved", "pending"].includes(b.status)) continue;
    // We can't directly link booking → skill, so note engineers actively in training
    // Associate with courses for display
  }

  // ── Build enriched requirements from skill_gap_snapshots ───────────────────
  //    Each snapshot row becomes one "requirement" entry.
  //    Derive status from risk_level + qualified headcount.

  function deriveStatus(snap: {
    risk_level: string;
    engineers_at_or_above_target: number;
    engineers_below_target: number;
    single_point_of_failure: boolean;
  }): string {
    const total = snap.engineers_at_or_above_target + snap.engineers_below_target;
    if (snap.single_point_of_failure || snap.risk_level === "critical") {
      if (snap.engineers_at_or_above_target === 0) return "Critical Gap";
      return "Partial Gap";
    }
    if (snap.risk_level === "high") return "Training Required";
    if (total === 0 || snap.engineers_below_target > snap.engineers_at_or_above_target) return "Partial Gap";
    return "Covered";
  }

  function derivePriority(snap: {
    risk_level: string;
    single_point_of_failure: boolean;
  }): string {
    if (snap.single_point_of_failure || snap.risk_level === "critical") return "Critical";
    if (snap.risk_level === "high")   return "High";
    if (snap.risk_level === "medium") return "Medium";
    return "Low";
  }

  // Map category → display area
  function categoryToArea(cat: string): string {
    const map: Record<string, string> = {
      "Pharmaceutical Compliance":       "GMP / Compliance",
      "Pharmaceutical Equipment":        "Process Equipment",
      "CMMS / Maintenance Systems":      "CMMS Systems",
      "Reliability Engineering":         "Reliability",
      "Electrical Maintenance":          "Electrical",
      "Automation & Controls":           "Controls",
      "Pharmaceutical OEM Expertise":    "OEM Equipment",
      "Bosch OEM Expertise":             "Bosch Lines",
      "Mechanical Maintenance":          "Mechanical",
      "Certifications & Qualifications": "Certifications",
    };
    return map[cat] ?? cat;
  }

  // Map category → skill area group (for coverage section)
  function categoryToGroup(cat: string): string {
    if (cat.includes("Electrical")) return "Electrical";
    if (cat.includes("Mechanical")) return "Mechanical";
    if (cat.includes("Automation") || cat.includes("Controls")) return "Controls";
    if (cat.includes("Reliability")) return "Reliability";
    if (cat.includes("Pharmaceutical Compliance")) return "Compliance";
    if (cat.includes("Pharmaceutical Equipment") || cat.includes("OEM")) return "Equipment";
    return "Other";
  }

  const enrichedRequirements = (snapList as {
    id: string; skill_id: string; department_id: string | null;
    target_rating: number; current_average_rating: number;
    engineers_at_or_above_target: number; engineers_below_target: number;
    single_point_of_failure: boolean; risk_level: string;
    recommendation: string; snapshot_date: string;
  }[]).map((snap) => {
    const skill    = skillsById.get(snap.skill_id) as {
      name: string; category: string; is_critical: boolean;
      certification_required?: boolean;
    } | undefined;
    const deptName = snap.department_id ? (deptMap.get(snap.department_id) ?? null) : null;
    const qualCount = qualifiedBySkill.get(snap.skill_id)?.size ?? snap.engineers_at_or_above_target;
    const trainCount = trainingBySkill.get(snap.skill_id)?.size ?? 0;
    const total = snap.engineers_at_or_above_target + snap.engineers_below_target;
    const gap   = snap.engineers_below_target;
    const coveragePct = total > 0 ? Math.round((snap.engineers_at_or_above_target / total) * 100) : 0;

    return {
      id:                snap.id,
      title:             skill?.name ?? "Unknown Skill",
      skill_category:    skill?.category ?? "",
      area:              categoryToArea(skill?.category ?? ""),
      group:             categoryToGroup(skill?.category ?? ""),
      department_name:   deptName,
      required_level:    snap.target_rating,
      current_avg:       Number(snap.current_average_rating),
      engineers_qualified: snap.engineers_at_or_above_target,
      engineers_below:   snap.engineers_below_target,
      gap,
      coverage_pct:      coveragePct,
      training_required: trainCount,
      is_critical:       skill?.is_critical ?? false,
      certification_required: skill?.certification_required ?? false,
      single_point_of_failure: snap.single_point_of_failure,
      risk_level:        snap.risk_level,
      priority:          derivePriority(snap),
      status:            deriveStatus(snap),
      recommendation:    snap.recommendation,
      snapshot_date:     snap.snapshot_date,
    };
  });

  // Sort: priority order then by gap desc
  const priorityOrder: Record<string, number> = { Critical: 0, High: 1, Medium: 2, Low: 3 };
  enrichedRequirements.sort((a, b) => {
    const pa = priorityOrder[a.priority] ?? 9;
    const pb = priorityOrder[b.priority] ?? 9;
    if (pa !== pb) return pa - pb;
    return b.gap - a.gap;
  });

  // ── Coverage by group ───────────────────────────────────────────────────────
  const groupStats = new Map<string, { total: number; gaps: number; covered: number }>();
  for (const req of enrichedRequirements) {
    const g = req.group;
    if (!groupStats.has(g)) groupStats.set(g, { total: 0, gaps: 0, covered: 0 });
    const gs = groupStats.get(g)!;
    gs.total++;
    if (req.gap > 0) gs.gaps++;
    else gs.covered++;
  }
  const coverageByGroup = [...groupStats.entries()].map(([group, gs]) => ({
    group,
    total: gs.total,
    gaps: gs.gaps,
    covered: gs.covered,
    pct: gs.total > 0 ? Math.round((gs.covered / gs.total) * 100) : 0,
  })).sort((a, b) => a.pct - b.pct);

  // ── KPI stats ───────────────────────────────────────────────────────────────
  const totalReqs   = enrichedRequirements.length;
  const fullyCovered = enrichedRequirements.filter((r) => r.status === "Covered").length;
  const skillsAtRisk = enrichedRequirements.filter((r) => r.status === "Partial Gap" || r.status === "Training Required").length;
  const criticalGaps = enrichedRequirements.filter((r) => r.status === "Critical Gap").length;

  // ── Requirement action rows ─────────────────────────────────────────────────
  const actionRows = [
    // Upcoming cert expiries
    ...certExpiryRows.slice(0, 3).map((c) => ({
      type: "cert_expiry" as const,
      title: `Certification expiry: ${c.skill_name}`,
      subtitle: `${c.engineer_name} — expires ${new Date(c.expiry_date!).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}`,
      urgency: "high",
    })),
    // Critical gap requirements needing action
    ...enrichedRequirements
      .filter((r) => r.status === "Critical Gap")
      .slice(0, 3)
      .map((r) => ({
        type: "critical_gap" as const,
        title: `Critical gap: ${r.title}`,
        subtitle: `${r.engineers_below} engineers below target rating ${r.required_level}/5 — ${r.department_name ?? r.skill_category}`,
        urgency: "critical",
      })),
    // Training required items
    ...enrichedRequirements
      .filter((r) => r.status === "Training Required")
      .slice(0, 2)
      .map((r) => ({
        type: "training_required" as const,
        title: `Training needed: ${r.title}`,
        subtitle: `${r.training_required} engineers require training — avg ${r.current_avg.toFixed(1)}/5`,
        urgency: "medium",
      })),
    // Covered (recently assessed / healthy)
    ...enrichedRequirements
      .filter((r) => r.status === "Covered")
      .slice(0, 2)
      .map((r) => ({
        type: "covered" as const,
        title: `Covered: ${r.title}`,
        subtitle: `${r.engineers_qualified} qualified engineers — ${r.coverage_pct}% coverage`,
        urgency: "info",
      })),
  ].slice(0, 10);

  return new Response(
    JSON.stringify({
      requirements: enrichedRequirements,
      coverageByGroup,
      certExpiries: certExpiryRows,
      actionRows,
      stats: { totalReqs, fullyCovered, skillsAtRisk, criticalGaps },
      departments: deptList,
    }),
    { headers: { "Content-Type": "application/json", ...corsHeaders } }
  );
});
