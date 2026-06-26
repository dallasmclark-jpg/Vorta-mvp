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
    { data: bookingsRaw },
    { data: coursesRaw },
    { data: partnersRaw },
    { data: engineersRaw },
    { data: departmentsRaw },
    { data: engineerSkillsRaw },
    { data: skillGapSnapsRaw },
    { data: skillsRaw },
    { data: courseSkillsRaw },
  ] = await Promise.all([
    supabase
      .from("training_bookings")
      .select("id,engineer_id,course_id,status,booking_date,requested_date,cost,currency"),
    supabase
      .from("training_courses")
      .select("id,title,delivery_type,duration_days,price,currency,training_partner_id,status,description,location"),
    supabase
      .from("training_partners")
      .select("id,name,location,status"),
    supabase
      .from("engineers")
      .select("id,full_name,discipline,department_id,availability_status")
      .order("full_name"),
    supabase.from("departments").select("id,name"),
    supabase
      .from("engineer_skills")
      .select("engineer_id,skill_id,training_required,verification_status,expiry_date,last_validated_at,validated_rating,manager_rating,self_rating"),
    supabase
      .from("skill_gap_snapshots")
      .select("id,skill_id,department_id,target_rating,current_average_rating,engineers_at_or_above_target,engineers_below_target,single_point_of_failure,risk_level,recommendation,snapshot_date"),
    supabase.from("skills").select("id,name,category,is_critical,certification_required"),
    supabase.from("course_skills").select("course_id,skill_id,target_rating"),
  ]);

  const bookings     = bookingsRaw      ?? [];
  const courses      = coursesRaw       ?? [];
  const partners     = partnersRaw      ?? [];
  const engineers    = engineersRaw     ?? [];
  const departments  = departmentsRaw   ?? [];
  const engSkills    = engineerSkillsRaw ?? [];
  const snapshots    = skillGapSnapsRaw  ?? [];
  const skills       = skillsRaw         ?? [];
  const courseSkills = courseSkillsRaw   ?? [];

  // ── Lookup maps ─────────────────────────────────────────────────────────────
  const courseMap  = new Map(courses.map((c: { id: string; title: string }) => [c.id, c]));
  const partnerMap = new Map(partners.map((p: { id: string; name: string; location: string }) => [p.id, p]));
  const engMap     = new Map(engineers.map((e: { id: string; full_name: string; department_id: string }) => [e.id, e]));
  const deptMap    = new Map(departments.map((d: { id: string; name: string }) => [d.id, d.name]));
  const skillsById = new Map(skills.map((s: { id: string }) => [s.id, s]));

  // ── Enriched bookings ───────────────────────────────────────────────────────
  type RawBooking = {
    id: string; engineer_id: string | null; course_id: string;
    status: string; booking_date: string | null; requested_date: string | null;
    cost: number | null; currency: string | null;
  };
  type RawCourse = { id: string; title: string; delivery_type: string; duration_days: number; price: number; currency: string; training_partner_id: string; status: string };
  type RawPartner = { id: string; name: string; location: string };
  type RawEngineer = { id: string; full_name: string; department_id: string };

  const enrichedBookings = (bookings as RawBooking[]).map((b) => {
    const course  = b.course_id  ? (courseMap.get(b.course_id) as RawCourse | undefined)   : undefined;
    const partner = course?.training_partner_id ? (partnerMap.get(course.training_partner_id) as RawPartner | undefined) : undefined;
    const eng     = b.engineer_id ? (engMap.get(b.engineer_id) as RawEngineer | undefined) : undefined;
    const dept    = eng?.department_id ? deptMap.get(eng.department_id) : undefined;
    return {
      id:             b.id,
      engineer_id:    b.engineer_id ?? null,
      engineer_name:  eng?.full_name ?? null,
      department:     dept ?? null,
      course_title:   course?.title ?? "Unknown Course",
      delivery_type:  course?.delivery_type ?? null,
      partner_name:   partner?.name ?? null,
      status:         b.status,
      booking_date:   b.booking_date,
      requested_date: b.requested_date,
      cost:           b.cost,
      currency:       b.currency ?? "GBP",
    };
  });

  // Sort by booking_date desc
  enrichedBookings.sort((a, b) =>
    (b.booking_date ?? "").localeCompare(a.booking_date ?? "")
  );

  // ── KPI stats ───────────────────────────────────────────────────────────────
  const today    = new Date();
  const thirty   = new Date(today.getTime() + 30  * 24 * 60 * 60 * 1000);
  const ninety   = new Date(today.getTime() + 90  * 24 * 60 * 60 * 1000);

  const totalBookings   = bookings.length;
  const completed       = (bookings as RawBooking[]).filter((b) => b.status === "completed").length;
  const activeBookings  = (bookings as RawBooking[]).filter((b) => ["booked","approved","pending_approval"].includes(b.status)).length;
  const totalSpendGBP   = (bookings as RawBooking[]).reduce((s, b) => s + (Number(b.cost) || 0), 0);
  const compliancePct   = totalBookings > 0 ? Math.round((completed / totalBookings) * 100) : 0;

  type EngSkillRow = { engineer_id: string; skill_id: string; training_required: boolean; verification_status: string; expiry_date: string | null };

  const expiringIn30Days = (engSkills as EngSkillRow[]).filter((a) => {
    if (!a.expiry_date) return false;
    const d = new Date(a.expiry_date);
    return d >= today && d <= thirty;
  }).length;

  const expiringIn90Days = (engSkills as EngSkillRow[]).filter((a) => {
    if (!a.expiry_date) return false;
    const d = new Date(a.expiry_date);
    return d >= today && d <= ninety;
  }).length;

  const engineersNeedingTraining = new Set(
    (engSkills as EngSkillRow[])
      .filter((a) => a.training_required)
      .map((a) => a.engineer_id)
  ).size;

  const criticalGaps = (snapshots as { risk_level: string }[]).filter(
    (s) => s.risk_level === "critical"
  ).length;

  // ── Spend by month (last 6 populated months) ────────────────────────────────
  const monthSpend = new Map<string, number>();
  for (const b of bookings as RawBooking[]) {
    if (!b.booking_date) continue;
    const key = b.booking_date.substring(0, 7); // YYYY-MM
    monthSpend.set(key, (monthSpend.get(key) ?? 0) + (Number(b.cost) || 0));
  }
  const spendByMonth = [...monthSpend.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-6)
    .map(([month, spend]) => ({
      month,
      label: new Date(month + "-01").toLocaleDateString("en-GB", { month: "short", year: "2-digit" }),
      spend,
    }));

  // ── Bookings by department ──────────────────────────────────────────────────
  const deptBookings = new Map<string, { count: number; spend: number }>();
  for (const b of enrichedBookings) {
    if (!b.department) continue;
    const cur = deptBookings.get(b.department) ?? { count: 0, spend: 0 };
    cur.count++;
    cur.spend += Number(b.cost) || 0;
    deptBookings.set(b.department, cur);
  }
  const maxDeptSpend = Math.max(...[...deptBookings.values()].map((v) => v.spend), 1);
  const bookingsByDept = [...deptBookings.entries()]
    .map(([dept, { count, spend }]) => ({
      dept,
      count,
      spend,
      pct: Math.round((spend / maxDeptSpend) * 100),
    }))
    .sort((a, b) => b.spend - a.spend);

  // ── Training priority rows from skill_gap_snapshots ─────────────────────────
  function derivePriority(riskLevel: string, spof: boolean): string {
    if (spof || riskLevel === "critical") return "Critical";
    if (riskLevel === "high")   return "High";
    if (riskLevel === "medium") return "Medium";
    return "Low";
  }

  type SnapRow = {
    id: string; skill_id: string; department_id: string | null;
    target_rating: number; current_average_rating: number;
    engineers_at_or_above_target: number; engineers_below_target: number;
    single_point_of_failure: boolean; risk_level: string;
    recommendation: string;
  };
  type SkillRow = { id: string; name: string; category: string; is_critical: boolean; certification_required?: boolean };

  const priorityRows = (snapshots as SnapRow[])
    .map((snap) => {
      const skill    = skillsById.get(snap.skill_id) as SkillRow | undefined;
      const deptName = snap.department_id ? deptMap.get(snap.department_id) ?? null : null;
      return {
        id:           snap.id,
        skill_name:   skill?.name ?? "Unknown Skill",
        category:     skill?.category ?? "",
        is_critical:  skill?.is_critical ?? false,
        dept_name:    deptName,
        current_avg:  Number(snap.current_average_rating),
        target_rating: snap.target_rating,
        gap:          snap.engineers_below_target,
        engineers_qualified: snap.engineers_at_or_above_target,
        risk_level:   snap.risk_level,
        priority:     derivePriority(snap.risk_level, snap.single_point_of_failure),
        single_point_of_failure: snap.single_point_of_failure,
        recommendation: snap.recommendation,
      };
    })
    .sort((a, b) => {
      const order: Record<string, number> = { Critical: 0, High: 1, Medium: 2, Low: 3 };
      const pa = order[a.priority] ?? 9;
      const pb = order[b.priority] ?? 9;
      return pa !== pb ? pa - pb : b.gap - a.gap;
    });

  // ── Certification risk rows ──────────────────────────────────────────────────
  const certRiskRows = (engSkills as EngSkillRow[])
    .filter((a) => {
      if (!a.expiry_date) return false;
      return new Date(a.expiry_date) <= ninety;
    })
    .map((a) => {
      const eng   = engMap.get(a.engineer_id) as RawEngineer | undefined;
      const skill = skillsById.get(a.skill_id) as SkillRow | undefined;
      const expiry = new Date(a.expiry_date!);
      const daysLeft = Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      return {
        skill_name:   skill?.name ?? "Unknown",
        engineer_name: eng?.full_name ?? "Unknown",
        expiry_date:  a.expiry_date,
        days_left:    daysLeft,
        status:       daysLeft < 0 ? "Expired" : daysLeft <= 30 ? "Expiring Soon" : "Expiring",
        risk_level:   daysLeft < 0 ? "critical" : daysLeft <= 30 ? "high" : "medium",
        verification_status: a.verification_status,
      };
    })
    .sort((a, b) => a.days_left - b.days_left)
    .slice(0, 20);

  // ── Recent activity ─────────────────────────────────────────────────────────
  const recentActivity = enrichedBookings.slice(0, 15).map((b) => ({
    id:            b.id,
    engineer_name: b.engineer_name,
    course_title:  b.course_title,
    partner_name:  b.partner_name,
    status:        b.status,
    booking_date:  b.booking_date,
    cost:          b.cost,
    department:    b.department,
  }));

  // ── Recommended courses (active, enriched with partner + skills) ────────────
  type CourseSkillRow = { course_id: string; skill_id: string };
  const courseSkillMap = new Map<string, string[]>();
  for (const cs of courseSkills as CourseSkillRow[]) {
    if (!courseSkillMap.has(cs.course_id)) courseSkillMap.set(cs.course_id, []);
    const skill = skillsById.get(cs.skill_id) as SkillRow | undefined;
    if (skill) courseSkillMap.get(cs.course_id)!.push(skill.name);
  }

  const recommendedCourses = (courses as RawCourse[])
    .filter((c) => c.status === "active")
    .map((c) => {
      const partner = partnerMap.get(c.training_partner_id) as RawPartner | undefined;
      const skillsCovered = courseSkillMap.get(c.id) ?? [];
      const bookingCount = (bookings as RawBooking[]).filter((b) => b.course_id === c.id).length;
      return {
        id:             c.id,
        title:          c.title,
        partner_name:   partner?.name ?? null,
        partner_location: partner?.location ?? null,
        delivery_type:  c.delivery_type,
        duration_days:  Number(c.duration_days),
        price:          Number(c.price),
        currency:       c.currency ?? "GBP",
        skills_covered: skillsCovered,
        bookings:       bookingCount,
      };
    })
    .sort((a, b) => b.bookings - a.bookings);

  // ── Training partners enriched ───────────────────────────────────────────────
  type RawPartnerFull = { id: string; name: string; location: string; status: string };
  const trainingPartners = (partners as RawPartnerFull[]).map((p) => {
    const partnerCourses = (courses as RawCourse[]).filter(
      (c) => c.training_partner_id === p.id && c.status === "active"
    );
    const partnerBookings = enrichedBookings.filter((b) => {
      const course = courseMap.get((bookings as RawBooking[]).find((bk) => bk.id === b.id)?.course_id ?? "") as RawCourse | undefined;
      return course?.training_partner_id === p.id;
    }).length;
    const specialisms = [...new Set(
      partnerCourses.map((c) => c.delivery_type).filter(Boolean)
    )];
    return {
      id:           p.id,
      name:         p.name,
      location:     p.location,
      status:       p.status,
      course_count: partnerCourses.length,
      booking_count: partnerBookings,
      specialisms,
    };
  });

  // ── AI Insights ─────────────────────────────────────────────────────────────
  const insights: { severity: string; title: string; text: string }[] = [];

  const criticalSnapshots = (snapshots as SnapRow[]).filter((s) => s.risk_level === "critical");
  if (criticalSnapshots.length > 0) {
    const top = criticalSnapshots[0];
    const skill = skillsById.get(top.skill_id) as SkillRow | undefined;
    insights.push({
      severity: "critical",
      title: `${criticalSnapshots.length} critical training gap${criticalSnapshots.length !== 1 ? "s" : ""} identified`,
      text: `${skill?.name ?? "A key skill"} has ${top.engineers_below_target} engineers below target rating ${top.target_rating}/5. Immediate training action required.`,
    });
  }

  const spofSnaps = (snapshots as SnapRow[]).filter((s) => s.single_point_of_failure);
  if (spofSnaps.length > 0) {
    const names = spofSnaps.slice(0, 2).map((s) => (skillsById.get(s.skill_id) as SkillRow | undefined)?.name ?? "Unknown").join(", ");
    insights.push({
      severity: "critical",
      title: `${spofSnaps.length} single-point-of-failure skill${spofSnaps.length !== 1 ? "s" : ""}`,
      text: `Skills with only one qualified engineer: ${names}${spofSnaps.length > 2 ? ` +${spofSnaps.length - 2} more` : ""}. Prioritise cross-training to eliminate this risk.`,
    });
  }

  if (engineersNeedingTraining > 0) {
    insights.push({
      severity: "high",
      title: `${engineersNeedingTraining} engineer${engineersNeedingTraining !== 1 ? "s" : ""} flagged for training`,
      text: `These engineers have skill gaps requiring structured training. Book courses now to close gaps before the next assessment cycle.`,
    });
  }

  const highGapDepts = bookingsByDept.filter((d) => d.count >= 5).slice(0, 2);
  if (highGapDepts.length > 0) {
    insights.push({
      severity: "medium",
      title: `High training activity in ${highGapDepts[0].dept}`,
      text: `${highGapDepts[0].count} bookings totalling £${highGapDepts[0].spend.toLocaleString()}. Consider consolidating engineers into group courses to reduce per-head cost.`,
    });
  }

  if (recommendedCourses.length > 0) {
    const top = recommendedCourses[0];
    insights.push({
      severity: "medium",
      title: `"${top.title}" is the most booked course`,
      text: `${top.bookings} booking${top.bookings !== 1 ? "s" : ""} via ${top.partner_name ?? "a training partner"}. Consider bulk booking to negotiate a reduced rate.`,
    });
  }

  return new Response(
    JSON.stringify({
      enrichedBookings,
      stats: {
        totalBookings,
        completed,
        activeBookings,
        totalSpendGBP,
        compliancePct,
        expiringIn30Days,
        expiringIn90Days,
        engineersNeedingTraining,
        criticalGaps,
      },
      spendByMonth,
      bookingsByDept,
      priorityRows,
      certRiskRows,
      recentActivity,
      recommendedCourses,
      trainingPartners,
      departments,
      insights,
    }),
    { headers: { "Content-Type": "application/json", ...corsHeaders } }
  );
});
