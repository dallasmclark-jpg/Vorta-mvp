import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { context, preflight, response } from "./auth.ts";

const PARTNER_META: Record<string, {
  rating: number;
  accreditation: string;
  categories: string[];
  description: string;
  delivery_focus: string[];
}> = {
  "60000000-0000-0000-0000-000000000001": {
    rating: 4.6,
    accreditation: "COGC / GMP Alliance",
    categories: ["GMP", "Pharmaceutical Compliance", "Data Integrity", "Regulatory"],
    description: "Specialist GMP and pharmaceutical compliance training provider supporting regulated manufacturing sites.",
    delivery_focus: ["Classroom", "Blended"],
  },
  "60000000-0000-0000-0000-000000000002": {
    rating: 4.4,
    accreditation: "EAL / City & Guilds / IET",
    categories: ["Automation", "PLC Systems", "Electrical Maintenance", "Controls", "Instrumentation"],
    description: "Automation and electrical engineering training covering PLC fault-finding, SCADA, instrumentation and electrical regulations.",
    delivery_focus: ["Classroom", "On-site", "Blended"],
  },
  "60000000-0000-0000-0000-000000000003": {
    rating: 4.5,
    accreditation: "CompEx / IOSH / PUWER",
    categories: ["Asset Management", "OEM Equipment", "Mechanical Maintenance", "Reliability", "Safety"],
    description: "Asset management and reliability training covering OEM equipment, mechanical diagnosis, compliance and predictive maintenance.",
    delivery_focus: ["On-site", "Blended"],
  },
};

const CATEGORY_TO_PARTNERS: Record<string, string[]> = {
  "Pharmaceutical Compliance": ["60000000-0000-0000-0000-000000000001"],
  "Pharmaceutical OEM Expertise": [
    "60000000-0000-0000-0000-000000000003",
    "60000000-0000-0000-0000-000000000001",
  ],
  "Pharmaceutical Equipment": [
    "60000000-0000-0000-0000-000000000003",
    "60000000-0000-0000-0000-000000000001",
  ],
  "Bosch OEM Expertise": ["60000000-0000-0000-0000-000000000003"],
  "Automation & Controls": ["60000000-0000-0000-0000-000000000002"],
  "Electrical Maintenance": ["60000000-0000-0000-0000-000000000002"],
  "CMMS / Maintenance Systems": ["60000000-0000-0000-0000-000000000002"],
  "Reliability Engineering": ["60000000-0000-0000-0000-000000000003"],
  "Mechanical Maintenance": ["60000000-0000-0000-0000-000000000003"],
  "Certifications & Qualifications": [
    "60000000-0000-0000-0000-000000000002",
    "60000000-0000-0000-0000-000000000001",
  ],
};

function numeric(value: unknown): number {
  const result = Number(value);
  return Number.isFinite(result) ? result : 0;
}

Deno.serve(async (req: Request) => {
  const options = preflight(req);
  if (options) return options;
  if (!["GET", "POST"].includes(req.method)) {
    return response(req, { error: "Method not allowed" }, 405);
  }

  try {
    const { db, siteId, organisationId } = await context(req);
    const [engineersResult, gapsResult, partnersResult] = await Promise.all([
      db.from("engineers")
        .select("id")
        .eq("site_id", siteId)
        .eq("organisation_id", organisationId),
      db.from("skill_gap_snapshots")
        .select("id,skill_id,department_id,target_rating,current_average_rating,engineers_below_target,single_point_of_failure,risk_level,recommendation")
        .eq("site_id", siteId)
        .eq("organisation_id", organisationId)
        .in("risk_level", ["critical", "high"]),
      db.from("training_partners")
        .select("id,name,website,location,contact_email,status")
        .eq("organisation_id", organisationId),
    ]);

    const baseError =
      engineersResult.error ?? gapsResult.error ?? partnersResult.error;
    if (baseError) throw baseError;

    const engineerIds = (engineersResult.data ?? []).map((row: any) => row.id);
    const gaps = gapsResult.data ?? [];
    const gapIds = gaps.map((row: any) => row.id);
    const partners = partnersResult.data ?? [];
    const partnerIds = partners.map((row: any) => row.id);

    const [coursesResult, bookingsResult, enquiriesResult] = await Promise.all([
      partnerIds.length
        ? db.from("training_courses")
            .select("id,title,delivery_type,duration_days,price,currency,training_partner_id,status,description,location")
            .in("training_partner_id", partnerIds)
        : Promise.resolve({ data: [], error: null }),
      engineerIds.length
        ? db.from("training_bookings")
            .select("id,engineer_id,course_id,status,cost,currency")
            .eq("organisation_id", organisationId)
            .in("engineer_id", engineerIds)
        : Promise.resolve({ data: [], error: null }),
      db.from("training_enquiries")
        .select("id,training_partner_id,course_id,requirement_id,engineer_id,status")
        .eq("organisation_id", organisationId),
    ]);

    const detailError =
      coursesResult.error ?? bookingsResult.error ?? enquiriesResult.error;
    if (detailError) throw detailError;

    const courses = coursesResult.data ?? [];
    const bookings = bookingsResult.data ?? [];
    const siteEngineerIds = new Set(engineerIds);
    const siteGapIds = new Set(gapIds);
    const enquiries = (enquiriesResult.data ?? []).filter((row: any) =>
      (row.engineer_id && siteEngineerIds.has(row.engineer_id)) ||
      (row.requirement_id && siteGapIds.has(row.requirement_id))
    );

    const skillIds = [...new Set(gaps.map((row: any) => row.skill_id).filter(Boolean))];
    const skillsResult = skillIds.length
      ? await db.from("skills")
          .select("id,name,category,is_critical")
          .in("id", skillIds)
      : { data: [], error: null };
    if (skillsResult.error) throw skillsResult.error;
    const skills = skillsResult.data ?? [];

    const skillsById = new Map(skills.map((row: any) => [row.id, row]));
    const partnerNameById = new Map(partners.map((row: any) => [row.id, row.name]));
    const bookingCountByCourse = new Map<string, number>();
    for (const booking of bookings) {
      const courseId = String((booking as any).course_id);
      bookingCountByCourse.set(courseId, (bookingCountByCourse.get(courseId) ?? 0) + 1);
    }
    const enquiryCountByPartner = new Map<string, number>();
    for (const enquiry of enquiries) {
      if (!(enquiry as any).training_partner_id) continue;
      if (!["pending", "open", "submitted"].includes((enquiry as any).status)) continue;
      const partnerId = String((enquiry as any).training_partner_id);
      enquiryCountByPartner.set(
        partnerId,
        (enquiryCountByPartner.get(partnerId) ?? 0) + 1,
      );
    }

    const enrichedProviders = partners.map((partner: any) => {
      const partnerCourses = courses.filter((course: any) =>
        course.training_partner_id === partner.id && course.status === "active"
      );
      const bookingCount = partnerCourses.reduce(
        (sum: number, course: any) => sum + (bookingCountByCourse.get(course.id) ?? 0),
        0,
      );
      const topCourses = [...partnerCourses]
        .sort((left: any, right: any) =>
          (bookingCountByCourse.get(right.id) ?? 0) -
          (bookingCountByCourse.get(left.id) ?? 0)
        )
        .slice(0, 6)
        .map((course: any) => ({
          id: course.id,
          title: course.title ?? "Course not recorded",
          delivery_type: course.delivery_type ?? "Not recorded",
          duration_days: numeric(course.duration_days),
          price: numeric(course.price),
          currency: course.currency ?? "GBP",
          bookings: bookingCountByCourse.get(course.id) ?? 0,
        }));
      const meta = PARTNER_META[partner.id] ?? {
        rating: 0,
        accreditation: "Not recorded",
        categories: [],
        description: "",
        delivery_focus: [],
      };

      return {
        id: partner.id,
        name: partner.name ?? "Provider not recorded",
        location: partner.location || "Location not recorded",
        contact_email: partner.contact_email || "Contact not recorded",
        website: partner.website ?? null,
        status: partner.status ?? "unknown",
        course_count: partnerCourses.length,
        booking_count: bookingCount,
        enquiry_count: enquiryCountByPartner.get(partner.id) ?? 0,
        delivery_types: [...new Set(partnerCourses.map((course: any) => course.delivery_type).filter(Boolean))],
        top_courses: topCourses,
        ...meta,
      };
    });

    const gapMatches: any[] = [];
    const seenSkills = new Set<string>();
    for (const gap of gaps.slice(0, 20)) {
      const skill: any = skillsById.get((gap as any).skill_id);
      if (!skill || seenSkills.has(skill.name)) continue;
      seenSkills.add(skill.name);
      const matchedIds = (CATEGORY_TO_PARTNERS[skill.category] ?? [])
        .filter((partnerId) => partnerNameById.has(partnerId));
      gapMatches.push({
        skill_name: skill.name,
        category: skill.category ?? "Uncategorised",
        risk_level: (gap as any).risk_level ?? "high",
        engineers_below: numeric((gap as any).engineers_below_target),
        single_point_of_failure: Boolean((gap as any).single_point_of_failure),
        recommendation: (gap as any).recommendation ?? "Review the recorded capability gap.",
        matched_partner_ids: matchedIds,
        matched_partner_names: matchedIds
          .map((partnerId) => partnerNameById.get(partnerId) ?? "")
          .filter(Boolean),
      });
      if (gapMatches.length >= 8) break;
    }

    const activeCourses = courses.filter((course: any) => course.status === "active");
    const openEnquiries = enquiries.filter((enquiry: any) =>
      ["pending", "open", "submitted"].includes(enquiry.status)
    ).length;

    return response(req, {
      siteId,
      organisationId,
      generatedAt: new Date().toISOString(),
      providers: enrichedProviders,
      gapMatches,
      stats: {
        providerCount: partners.filter((partner: any) =>
          ["active", "preferred"].includes(partner.status)
        ).length,
        courseCount: activeCourses.length,
        openEnquiries,
        totalBookings: bookings.length,
      },
    });
  } catch (error) {
    const status = Number((error as any)?.status) || 500;
    if (status >= 500) console.error("training-providers-data failed", error);
    return response(req, {
      error: status < 500
        ? String((error as any)?.message ?? "Access denied")
        : "Training provider evidence could not be loaded",
    }, status);
  }
});
