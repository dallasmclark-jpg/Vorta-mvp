import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

// One skill per category — ordered by domain importance for heatmap diversity
const HEATMAP_CATEGORY_PRIORITY = [
  "Pharmaceutical Compliance",
  "Pharmaceutical Equipment",
  "CMMS / Maintenance Systems",
  "Reliability Engineering",
  "Electrical Maintenance",
  "Automation & Controls",
  "Pharmaceutical OEM Expertise",
  "Bosch OEM Expertise",
  "Mechanical Maintenance",
  "Certifications & Qualifications",
];

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } }
  );

  // ── Parallel fetch ───────────────────────────────────────────────────────
  const [
    { data: engineers },
    { data: allAssignments },
    { data: riskProfiles },
    { data: skillGapSnaps },
    { data: departments },
  ] = await Promise.all([
    supabase
      .from("engineers")
      .select("id,full_name,discipline,shift_pattern,availability_status,department_id,employment_type")
      .order("full_name"),
    supabase
      .from("engineer_skills")
      .select("engineer_id,skill_id,validated_rating,manager_rating,self_rating,training_required,verification_status"),
    supabase
      .from("engineer_risk_profiles")
      .select("engineer_id,retirement_risk,leaving_risk,critical_knowledge_holder"),
    supabase
      .from("skill_gap_snapshots")
      .select("id,skill_id,department_id,target_rating,current_average_rating,engineers_at_or_above_target,engineers_below_target,single_point_of_failure,risk_level,recommendation,snapshot_date"),
    supabase.from("departments").select("id,name"),
  ]);

  const engList     = engineers      ?? [];
  const assignList  = allAssignments ?? [];
  const riskList    = riskProfiles   ?? [];
  const snapList    = skillGapSnaps  ?? [];
  const deptList    = departments    ?? [];

  // ── Skill metadata ──────────────────────────────────────────────────────
  const allSkillIds = [
    ...new Set([
      ...(assignList as { skill_id: string }[]).map((a) => a.skill_id),
      ...(snapList   as { skill_id: string }[]).map((s) => s.skill_id),
    ]),
  ];
  const { data: allSkills } = await supabase
    .from("skills")
    .select("id,name,category,is_critical")
    .in("id", allSkillIds);

  const skillsById  = new Map((allSkills ?? []).map((s: { id: string }) => [s.id, s]));
  const deptMap     = new Map(deptList.map((d: { id: string; name: string }) => [d.id, d.name]));
  const riskProfMap = new Map((riskList as { engineer_id: string }[]).map((r) => [r.engineer_id, r]));

  // ── Heatmap column selection: one per priority category, full coverage ──
  const skillEngCount = new Map<string, number>();
  for (const a of assignList as { skill_id: string }[]) {
    skillEngCount.set(a.skill_id, (skillEngCount.get(a.skill_id) ?? 0) + 1);
  }
  const halfCoverage = Math.ceil(engList.length / 2);
  const fullCoverageIds = new Set(
    [...skillEngCount.entries()]
      .filter(([, c]) => c >= halfCoverage)
      .map(([id]) => id)
  );

  const seenSkillIds = new Set<string>();
  const heatmapSkills: unknown[] = [];
  for (const cat of HEATMAP_CATEGORY_PRIORITY) {
    const candidates = (allSkills ?? []).filter(
      (s: { category: string; is_critical: boolean; id: string }) =>
        s.category === cat && s.is_critical && fullCoverageIds.has(s.id)
    );
    if (candidates.length === 0) continue;
    // Pick highest coverage skill in this category
    const best = candidates.sort(
      (a: { id: string }, b: { id: string }) =>
        (skillEngCount.get(b.id) ?? 0) - (skillEngCount.get(a.id) ?? 0)
    )[0];
    if (!seenSkillIds.has(best.id)) {
      seenSkillIds.add(best.id);
      heatmapSkills.push(best);
    }
  }

  const heatmapSkillIds = new Set(heatmapSkills.map((s: unknown) => (s as { id: string }).id));
  const heatmapAssignments = (assignList as { skill_id: string }[]).filter((a) =>
    heatmapSkillIds.has(a.skill_id)
  );

  // ── Per-engineer derived stats (from ALL assignments) ───────────────────
  const engStats = new Map<string, { total: number; count: number; trainingCount: number }>();
  for (const a of assignList as {
    engineer_id: string;
    validated_rating: number | null;
    manager_rating: number | null;
    self_rating: number | null;
    training_required: boolean;
  }[]) {
    const r = a.validated_rating ?? a.manager_rating ?? a.self_rating ?? null;
    if (!engStats.has(a.engineer_id)) {
      engStats.set(a.engineer_id, { total: 0, count: 0, trainingCount: 0 });
    }
    const e = engStats.get(a.engineer_id)!;
    if (r !== null) { e.total += r; e.count++; }
    if (a.training_required) e.trainingCount++;
  }

  const engineersWithStats = engList.map((eng: { id: string }) => {
    const st  = engStats.get(eng.id);
    const avg = st && st.count > 0 ? st.total / st.count : 0;
    const score = Math.round((avg / 5) * 100);
    const risk  =
      score >= 80 ? "low"
      : score >= 68 ? "medium"
      : score >= 55 ? "high"
      : "critical";
    const rp = riskProfMap.get(eng.id) as {
      retirement_risk: string; leaving_risk: string; critical_knowledge_holder: boolean
    } | undefined;
    return {
      ...eng,
      skills_score:              score,
      risk_level:                risk,
      training_count:            st?.trainingCount ?? 0,
      critical_knowledge_holder: rp?.critical_knowledge_holder ?? false,
      retirement_risk:           rp?.retirement_risk           ?? null,
      leaving_risk:              rp?.leaving_risk              ?? null,
      department_name:           deptMap.get((eng as { department_id: string }).department_id) ?? null,
    };
  });

  // ── Enrich skill gap snapshots ──────────────────────────────────────────
  const enrichedGaps = (snapList as {
    skill_id: string; department_id: string | null
  }[]).map((sg) => ({
    ...sg,
    skill_name:      (skillsById.get(sg.skill_id) as { name: string }  | undefined)?.name     ?? "Unknown",
    skill_category:  (skillsById.get(sg.skill_id) as { category: string } | undefined)?.category ?? "",
    department_name: sg.department_id ? (deptMap.get(sg.department_id) ?? null) : null,
  }));

  // Sort by SPOF first, then engineers_below_target DESC
  enrichedGaps.sort((a, b) => {
    const spofA = (a as { single_point_of_failure: boolean }).single_point_of_failure ? 0 : 1;
    const spofB = (b as { single_point_of_failure: boolean }).single_point_of_failure ? 0 : 1;
    if (spofA !== spofB) return spofA - spofB;
    return (
      (b as { engineers_below_target: number }).engineers_below_target -
      (a as { engineers_below_target: number }).engineers_below_target
    );
  });

  // ── Stats ───────────────────────────────────────────────────────────────
  const stats = {
    totalEngineers:  engList.length,
    skillsAssessed:  assignList.length,
    criticalGaps:    snapList.filter((s: { risk_level: string }) => s.risk_level === "critical").length,
    trainingRequired: assignList.filter((a: { training_required: boolean }) => a.training_required).length,
    criticalHolders: riskList.filter((r: { critical_knowledge_holder: boolean }) => r.critical_knowledge_holder).length,
  };

  return new Response(
    JSON.stringify({
      engineers:         engineersWithStats,
      departments:       deptList,
      heatmapSkills,
      heatmapAssignments,
      skillGaps:         enrichedGaps,
      riskProfiles:      riskList,
      stats,
    }),
    { headers: { "Content-Type": "application/json", ...corsHeaders } }
  );
});
