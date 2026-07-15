import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

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
    description: "Specialist GMP and pharmaceutical compliance training provider with over 15 years' experience supporting regulated manufacturing sites across Wales and the North West.",
    delivery_focus: ["Classroom", "Blended"],
  },
  "60000000-0000-0000-0000-000000000002": {
    rating: 4.4,
    accreditation: "EAL / City & Guilds / IET",
    categories: ["Automation", "PLC Systems", "Electrical Maintenance", "Controls", "Instrumentation"],
    description: "Industry-leading automation and electrical engineering training provider covering PLC fault-finding, SCADA systems, instrumentation, and 18th Edition wiring regulations.",
    delivery_focus: ["Classroom", "On-site", "Blended"],
  },
  "60000000-0000-0000-0000-000000000003": {
    rating: 4.5,
    accreditation: "CompEx / IOSH / PUWER",
    categories: ["Asset Management", "OEM Equipment", "Mechanical Maintenance", "Reliability", "Safety"],
    description: "Asset management and reliability excellence training covering OEM equipment operation, mechanical fault diagnosis, PUWER compliance, and predictive maintenance techniques.",
    delivery_focus: ["On-site", "Blended"],
  },
};

const CATEGORY_TO_PARTNERS: Record<string, string[]> = {
  "Pharmaceutical Compliance": ["60000000-0000-0000-0000-000000000001"],
  "Pharmaceutical OEM Expertise": ["60000000-0000-0000-0000-000000000003", "60000000-0000-0000-0000-000000000001"],
  "Pharmaceutical Equipment": ["60000000-0000-0000-0000-000000000003", "60000000-0000-0000-0000-000000000001"],
  "Bosch OEM Expertise": ["60000000-0000-0000-0000-000000000003"],
  "Automation & Controls": ["60000000-0000-0000-0000-000000000002"],
  "Electrical Maintenance": ["60000000-0000-0000-0000-000000000002"],
  "CMMS / Maintenance Systems": ["60000000-0000-0000-0000-000000000002"],
  "Reliability Engineering": ["60000000-0000-0000-0000-000000000003"],
  "Mechanical Maintenance": ["60000000-0000-0000-0000-000000000003"],
  "Certifications & Qualifications": ["60000000-0000-0000-0000-000000000002", "60000000-0000-0000-0000-000000000001"],
};

type RawCourse = {
  id: string;
  title: string;
  delivery_type: string;
  duration_days: number;
  price: number;
  currency: string;
  training_partner_id: string;
  status: string;
};

type RawBooking = {
  id: string;
  course_id: string;
  status: string;
  cost: number | null;
  currency: string | null;
};

type RawPartner = {
  id: string;
  name: string;
  website: string | null;
  location: string;
  contact_email: string;
  status: string;
};

type SkillRow = {
  id: string;
  name: string;
  category: string;
  is_critical: boolean;
};

type SnapRow = {
  id: string;
  skill_id: string;
  engineers_below_target: number;
  single_point_of_failure: boolean;
  risk_level: string;
  recommendation: string;
};

type EnquiryRow = {
  id: string;
  training_partner_id: string | null;
  status: string;
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader) {
    return jsonResponse({ error: "Authentication is required." }, 401);
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    },
  );

  const results = await Promise.all([
    supabase.from("training_partners").select("id,name,website,location,contact_email,status"),
    supabase.from("training_courses").select("id,title,delivery_type,duration_days,price,currency,training_partner_id,status,description,location"),
    supabase.from("training_bookings").select("id,course_id,status,cost,currency"),
    supabase
      .from("skill_gap_snapshots")
      .select("id,skill_id,department_id,target_rating,current_average_rating,engineers_below_target,single_point_of_failure,risk_level,recommendation")
      .in("risk_level", ["critical", "high"]),
    supabase.from("skills").select("id,name,category,is_critical"),
    supabase.from("training_enquiries").select("id,training_partner_id,status"),
  ]);

  const failedQuery = results.find((result) => result.error);
  if (failedQuery?.error) {
    console.error("training-providers-data query failed", failedQuery.error);
    return jsonResponse({ error: "Training provider data could not be loaded." }, 500);
  }

  const [partnersResult, coursesResult, bookingsResult, snapshotsResult, skillsResult, enquiriesResult] = results;
  const partners = (partnersResult.data ?? []) as RawPartner[];
  const courses = (coursesResult.data ?? []) as RawCourse[];
  const bookings = (bookingsResult.data ?? []) as RawBooking[];
  const snapshots = (snapshotsResult.data ?? []) as SnapRow[];
  const skills = (skillsResult.data ?? []) as SkillRow[];
  const enquiries = (enquiriesResult.data ?? []) as EnquiryRow[];

  const skillsById = new Map(skills.map((skill) => [skill.id, skill]));
  const bookingsByCourse = new Map<string, number>();
  for (const booking of bookings) {
    bookingsByCourse.set(booking.course_id, (bookingsByCourse.get(booking.course_id) ?? 0) + 1);
  }

  const enquiriesByPartner = new Map<string, number>();
  for (const enquiry of enquiries) {
    if (!enquiry.training_partner_id) continue;
    if (["pending", "open", "submitted"].includes(enquiry.status)) {
      enquiriesByPartner.set(
        enquiry.training_partner_id,
        (enquiriesByPartner.get(enquiry.training_partner_id) ?? 0) + 1,
      );
    }
  }

  const enrichedProviders = partners.map((partner) => {
    const meta = PARTNER_META[partner.id] ?? {
      rating: 0,
      accreditation: "—",
      categories: [],
      description: "",
      delivery_focus: [],
    };

    const partnerCourses = courses.filter(
      (course) => course.training_partner_id === partner.id && course.status === "active",
    );
    const deliveryTypes = [...new Set(partnerCourses.map((course) => course.delivery_type).filter(Boolean))];
    const bookingCount = partnerCourses.reduce(
      (sum, course) => sum + (bookingsByCourse.get(course.id) ?? 0),
      0,
    );
    const topCourses = [...partnerCourses]
      .sort(
        (left, right) =>
          (bookingsByCourse.get(right.id) ?? 0) - (bookingsByCourse.get(left.id) ?? 0),
      )
      .slice(0, 6)
      .map((course) => ({
        id: course.id,
        title: course.title,
        delivery_type: course.delivery_type,
        duration_days: Number(course.duration_days),
        price: Number(course.price),
        currency: course.currency ?? "GBP",
        bookings: bookingsByCourse.get(course.id) ?? 0,
      }));

    return {
      id: partner.id,
      name: partner.name,
      location: partner.location,
      contact_email: partner.contact_email,
      website: partner.website,
      status: partner.status,
      course_count: partnerCourses.length,
      booking_count: bookingCount,
      enquiry_count: enquiriesByPartner.get(partner.id) ?? 0,
      delivery_types: deliveryTypes,
      top_courses: topCourses,
      ...meta,
    };
  });

  const seenSkills = new Set<string>();
  const partnerNameById = new Map(partners.map((partner) => [partner.id, partner.name]));
  const gapMatches: Array<{
    skill_name: string;
    category: string;
    risk_level: string;
    engineers_below: number;
    single_point_of_failure: boolean;
    recommendation: string;
    matched_partner_ids: string[];
    matched_partner_names: string[];
  }> = [];

  for (const snapshot of snapshots.slice(0, 20)) {
    const skill = skillsById.get(snapshot.skill_id);
    if (!skill || seenSkills.has(skill.name)) continue;
    seenSkills.add(skill.name);

    const matchedIds = CATEGORY_TO_PARTNERS[skill.category] ?? [];
    gapMatches.push({
      skill_name: skill.name,
      category: skill.category,
      risk_level: snapshot.risk_level,
      engineers_below: snapshot.engineers_below_target,
      single_point_of_failure: snapshot.single_point_of_failure,
      recommendation: snapshot.recommendation,
      matched_partner_ids: matchedIds,
      matched_partner_names: matchedIds
        .map((id) => partnerNameById.get(id) ?? "")
        .filter(Boolean),
    });

    if (gapMatches.length >= 6) break;
  }

  const totalCourses = courses.filter((course) => course.status === "active").length;
  const openEnquiries = enquiries.filter((enquiry) =>
    ["pending", "open", "submitted"].includes(enquiry.status)
  ).length;

  return jsonResponse({
    providers: enrichedProviders,
    gapMatches,
    stats: {
      providerCount: partners.length,
      courseCount: totalCourses,
      openEnquiries,
      totalBookings: bookings.length,
    },
  });
});
