import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { context, preflight, response } from "./auth.ts";

function numeric(value: unknown): number {
  const result = Number(value);
  return Number.isFinite(result) ? result : 0;
}

function priority(riskLevel: string, singlePoint: boolean): string {
  if (singlePoint || riskLevel === "critical") return "Critical";
  if (riskLevel === "high") return "High";
  if (riskLevel === "medium") return "Medium";
  return "Low";
}

Deno.serve(async (req: Request) => {
  const options = preflight(req);
  if (options) return options;
  if (!["GET", "POST"].includes(req.method)) {
    return response(req, { error: "Method not allowed" }, 405);
  }

  try {
    const { db, siteId, organisationId } = await context(req);
    const [engineersResult, departmentsResult, gapsResult, partnersResult] =
      await Promise.all([
        db.from("engineers")
          .select("id,full_name,department_id")
          .eq("site_id", siteId)
          .eq("organisation_id", organisationId)
          .order("full_name"),
        db.from("departments")
          .select("id,name")
          .eq("site_id", siteId)
          .order("name"),
        db.from("skill_gap_snapshots")
          .select("id,skill_id,department_id,target_rating,current_average_rating,engineers_at_or_above_target,engineers_below_target,single_point_of_failure,risk_level,recommendation,snapshot_date")
          .eq("site_id", siteId)
          .eq("organisation_id", organisationId),
        db.from("training_partners")
          .select("id,name,location,status")
          .eq("organisation_id", organisationId),
      ]);

    const baseError =
      engineersResult.error ?? departmentsResult.error ?? gapsResult.error ??
      partnersResult.error;
    if (baseError) throw baseError;

    const engineers = engineersResult.data ?? [];
    const departments = departmentsResult.data ?? [];
    const gaps = gapsResult.data ?? [];
    const partners = partnersResult.data ?? [];
    const engineerIds = engineers.map((row: any) => row.id);
    const partnerIds = partners.map((row: any) => row.id);

    const [bookingsResult, assignmentsResult, coursesResult] = await Promise.all([
      engineerIds.length
        ? db.from("training_bookings")
            .select("id,engineer_id,course_id,status,booking_date,requested_date,cost,currency")
            .eq("organisation_id", organisationId)
            .in("engineer_id", engineerIds)
        : Promise.resolve({ data: [], error: null }),
      engineerIds.length
        ? db.from("engineer_skills")
            .select("engineer_id,skill_id,training_required,verification_status,expiry_date,last_validated_at,validated_rating,manager_rating,self_rating")
            .in("engineer_id", engineerIds)
        : Promise.resolve({ data: [], error: null }),
      partnerIds.length
        ? db.from("training_courses")
            .select("id,title,delivery_type,duration_days,price,currency,training_partner_id,status,description,location")
            .in("training_partner_id", partnerIds)
        : Promise.resolve({ data: [], error: null }),
    ]);

    const detailError =
      bookingsResult.error ?? assignmentsResult.error ?? coursesResult.error;
    if (detailError) throw detailError;

    const bookings = bookingsResult.data ?? [];
    const assignments = assignmentsResult.data ?? [];
    const courses = coursesResult.data ?? [];
    const courseIds = courses.map((row: any) => row.id);

    const courseSkillsResult = courseIds.length
      ? await db.from("course_skills")
          .select("course_id,skill_id,target_rating")
          .in("course_id", courseIds)
      : { data: [], error: null };
    if (courseSkillsResult.error) throw courseSkillsResult.error;
    const courseSkills = courseSkillsResult.data ?? [];

    const skillIds = [...new Set([
      ...gaps.map((row: any) => row.skill_id),
      ...assignments.map((row: any) => row.skill_id),
      ...courseSkills.map((row: any) => row.skill_id),
    ].filter(Boolean))];
    const skillsResult = skillIds.length
      ? await db.from("skills")
          .select("id,name,category,is_critical,certification_required")
          .in("id", skillIds)
      : { data: [], error: null };
    if (skillsResult.error) throw skillsResult.error;
    const skills = skillsResult.data ?? [];

    const engineerMap = new Map(engineers.map((row: any) => [row.id, row]));
    const departmentMap = new Map(departments.map((row: any) => [row.id, row.name]));
    const partnerMap = new Map(partners.map((row: any) => [row.id, row]));
    const courseMap = new Map(courses.map((row: any) => [row.id, row]));
    const skillMap = new Map(skills.map((row: any) => [row.id, row]));

    const enrichedBookings = bookings.map((booking: any) => {
      const engineer: any = engineerMap.get(booking.engineer_id);
      const course: any = courseMap.get(booking.course_id);
      const partner: any = course?.training_partner_id
        ? partnerMap.get(course.training_partner_id)
        : null;
      return {
        id: booking.id,
        engineer_id: booking.engineer_id,
        engineer_name: engineer?.full_name ?? null,
        department: engineer?.department_id
          ? departmentMap.get(engineer.department_id) ?? null
          : null,
        course_title: course?.title ?? "Course not recorded",
        delivery_type: course?.delivery_type ?? null,
        partner_name: partner?.name ?? null,
        status: booking.status ?? "unknown",
        booking_date: booking.booking_date ?? null,
        requested_date: booking.requested_date ?? null,
        cost: booking.cost == null ? null : numeric(booking.cost),
        currency: booking.currency ?? course?.currency ?? "GBP",
      };
    }).sort((left: any, right: any) =>
      (right.booking_date ?? "").localeCompare(left.booking_date ?? "")
    );

    const today = new Date();
    const thirtyDays = new Date(today.getTime() + 30 * 86400000);
    const ninetyDays = new Date(today.getTime() + 90 * 86400000);
    const totalBookings = enrichedBookings.length;
    const completed = enrichedBookings.filter((row: any) => row.status === "completed").length;
    const activeBookings = enrichedBookings.filter((row: any) =>
      ["booked", "approved", "pending_approval", "pending"].includes(row.status)
    ).length;
    const totalSpendGBP = enrichedBookings.reduce(
      (sum: number, row: any) => sum + numeric(row.cost),
      0,
    );
    const compliancePct = totalBookings
      ? Math.round((completed / totalBookings) * 100)
      : 0;

    const expiring = assignments.filter((row: any) => {
      if (!row.expiry_date) return false;
      return new Date(row.expiry_date) <= ninetyDays;
    });
    const expiringIn30Days = expiring.filter((row: any) => {
      const date = new Date(row.expiry_date);
      return date >= today && date <= thirtyDays;
    }).length;
    const expiringIn90Days = expiring.filter((row: any) => {
      const date = new Date(row.expiry_date);
      return date >= today && date <= ninetyDays;
    }).length;
    const engineersNeedingTraining = new Set(
      assignments
        .filter((row: any) => row.training_required)
        .map((row: any) => row.engineer_id),
    ).size;
    const criticalGaps = gaps.filter((row: any) => row.risk_level === "critical").length;

    const monthSpend = new Map<string, number>();
    for (const booking of enrichedBookings) {
      if (!booking.booking_date) continue;
      const month = booking.booking_date.slice(0, 7);
      monthSpend.set(month, (monthSpend.get(month) ?? 0) + numeric(booking.cost));
    }
    const spendByMonth = [...monthSpend.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .slice(-6)
      .map(([month, spend]) => ({
        month,
        label: new Date(`${month}-01T00:00:00`).toLocaleDateString("en-GB", {
          month: "short",
          year: "2-digit",
        }),
        spend,
      }));

    const departmentBookings = new Map<string, { count: number; spend: number }>();
    for (const booking of enrichedBookings) {
      if (!booking.department) continue;
      const current = departmentBookings.get(booking.department) ?? { count: 0, spend: 0 };
      current.count += 1;
      current.spend += numeric(booking.cost);
      departmentBookings.set(booking.department, current);
    }
    const maximumDepartmentSpend = Math.max(
      ...[...departmentBookings.values()].map((row) => row.spend),
      1,
    );
    const bookingsByDept = [...departmentBookings.entries()]
      .map(([dept, values]) => ({
        dept,
        count: values.count,
        spend: values.spend,
        pct: Math.round((values.spend / maximumDepartmentSpend) * 100),
      }))
      .sort((left, right) => right.spend - left.spend);

    const priorityRows = gaps.map((gap: any) => {
      const skill: any = skillMap.get(gap.skill_id);
      return {
        id: gap.id,
        skill_name: skill?.name ?? "Skill not recorded",
        category: skill?.category ?? "Uncategorised",
        is_critical: Boolean(skill?.is_critical),
        dept_name: gap.department_id
          ? departmentMap.get(gap.department_id) ?? null
          : null,
        current_avg: numeric(gap.current_average_rating),
        target_rating: numeric(gap.target_rating),
        gap: numeric(gap.engineers_below_target),
        engineers_qualified: numeric(gap.engineers_at_or_above_target),
        risk_level: gap.risk_level ?? "low",
        priority: priority(gap.risk_level ?? "low", Boolean(gap.single_point_of_failure)),
        single_point_of_failure: Boolean(gap.single_point_of_failure),
        recommendation: gap.recommendation ?? "Review the recorded capability gap.",
        snapshot_date: gap.snapshot_date,
      };
    }).sort((left: any, right: any) => {
      const order: Record<string, number> = { Critical: 0, High: 1, Medium: 2, Low: 3 };
      return (order[left.priority] ?? 9) - (order[right.priority] ?? 9) || right.gap - left.gap;
    });

    const certRiskRows = expiring.map((assignment: any) => {
      const engineer: any = engineerMap.get(assignment.engineer_id);
      const skill: any = skillMap.get(assignment.skill_id);
      const expiry = new Date(assignment.expiry_date);
      const daysLeft = Math.ceil((expiry.getTime() - today.getTime()) / 86400000);
      return {
        skill_name: skill?.name ?? "Skill not recorded",
        engineer_name: engineer?.full_name ?? "Engineer not recorded",
        expiry_date: assignment.expiry_date,
        days_left: daysLeft,
        status: daysLeft < 0 ? "Expired" : daysLeft <= 30 ? "Expiring Soon" : "Expiring",
        risk_level: daysLeft < 0 ? "critical" : daysLeft <= 30 ? "high" : "medium",
        verification_status: assignment.verification_status ?? "unverified",
      };
    }).sort((left: any, right: any) => left.days_left - right.days_left).slice(0, 20);

    const courseSkillMap = new Map<string, string[]>();
    for (const link of courseSkills) {
      const skill: any = skillMap.get((link as any).skill_id);
      if (!skill) continue;
      const current = courseSkillMap.get((link as any).course_id) ?? [];
      current.push(skill.name);
      courseSkillMap.set((link as any).course_id, current);
    }
    const bookingCountByCourse = new Map<string, number>();
    for (const booking of bookings) {
      bookingCountByCourse.set(
        (booking as any).course_id,
        (bookingCountByCourse.get((booking as any).course_id) ?? 0) + 1,
      );
    }

    const recommendedCourses = courses
      .filter((course: any) => course.status === "active")
      .map((course: any) => {
        const partner: any = partnerMap.get(course.training_partner_id);
        return {
          id: course.id,
          title: course.title ?? "Course not recorded",
          partner_name: partner?.name ?? null,
          partner_location: partner?.location ?? null,
          delivery_type: course.delivery_type ?? "Not recorded",
          duration_days: numeric(course.duration_days),
          price: numeric(course.price),
          currency: course.currency ?? "GBP",
          skills_covered: courseSkillMap.get(course.id) ?? [],
          bookings: bookingCountByCourse.get(course.id) ?? 0,
        };
      })
      .sort((left: any, right: any) => right.bookings - left.bookings);

    const trainingPartners = partners.map((partner: any) => {
      const partnerCourses = courses.filter((course: any) =>
        course.training_partner_id === partner.id && course.status === "active"
      );
      const partnerCourseIds = new Set(partnerCourses.map((course: any) => course.id));
      return {
        id: partner.id,
        name: partner.name,
        location: partner.location,
        status: partner.status,
        course_count: partnerCourses.length,
        booking_count: bookings.filter((booking: any) =>
          partnerCourseIds.has(booking.course_id)
        ).length,
        specialisms: [...new Set(partnerCourses.map((course: any) => course.delivery_type).filter(Boolean))],
      };
    });

    const insights: Array<{ severity: string; title: string; text: string }> = [];
    if (criticalGaps > 0) {
      const top = priorityRows.find((row: any) => row.priority === "Critical");
      insights.push({
        severity: "critical",
        title: `${criticalGaps} critical training gap${criticalGaps === 1 ? "" : "s"} identified`,
        text: top
          ? `${top.skill_name} has ${top.gap} engineer${top.gap === 1 ? "" : "s"} below the recorded target.`
          : "Critical capability gaps require review.",
      });
    }
    if (engineersNeedingTraining > 0) {
      insights.push({
        severity: "high",
        title: `${engineersNeedingTraining} engineer${engineersNeedingTraining === 1 ? "" : "s"} flagged for training`,
        text: "These flags are evidence from the current skills register and do not create a booking.",
      });
    }
    if (expiringIn30Days > 0) {
      insights.push({
        severity: "high",
        title: `${expiringIn30Days} certification${expiringIn30Days === 1 ? "" : "s"} expire within 30 days`,
        text: "Review renewal evidence in the source training workflow before capability lapses.",
      });
    }

    return response(req, {
      siteId,
      organisationId,
      generatedAt: new Date().toISOString(),
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
      recentActivity: enrichedBookings.slice(0, 15),
      recommendedCourses,
      trainingPartners,
      departments,
      insights,
    });
  } catch (error) {
    const status = Number((error as any)?.status) || 500;
    if (status >= 500) console.error("training-data failed", error);
    return response(req, {
      error: status < 500
        ? String((error as any)?.message ?? "Access denied")
        : "Training evidence could not be loaded",
    }, status);
  }
});
