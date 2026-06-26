import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

// Static enrichment per partner ID — fields not present in the DB schema
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

// Map skill category → partner IDs most likely to cover it
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
    { data: partnersRaw },
    { data: coursesRaw },
    { data: bookingsRaw },
    { data: snapshotsRaw },
    { data: skillsRaw },
    { data: enquiriesRaw },
  ] = await Promise.all([
    supabase.from("training_partners").select("id,name,website,location,contact_email,status"),
    supabase.from("training_courses").select("id,title,delivery_type,duration_days,price,currency,training_partner_id,status,description,location"),
    supabase.from("training_bookings").select("id,course_id,status,cost,currency"),
    supabase.from("skill_gap_snapshots").select("id,skill_id,department_id,target_rating,current_average_rating,engineers_below_target,single_point_of_failure,risk_level,recommendation").in("risk_level", ["critical", "high"]),
    supabase.from("skills").select("id,name,category,is_critical"),
    supabase.from("training_enquiries").select("id,training_partner_id,status"),
  ]);

  const partners   = partnersRaw   ?? [];
  const courses    = coursesRaw    ?? [];
  const bookings   = bookingsRaw   ?? [];
  const snapshots  = snapshotsRaw  ?? [];
  const skills     = skillsRaw     ?? [];
  const enquiries  = enquiriesRaw  ?? [];

  // ── Lookup maps ─────────────────────────────────────────────────────────────
  type RawCourse = { id: string; title: string; delivery_type: string; duration_days: number; price: number; currency: string; training_partner_id: string; status: string };
  type RawBooking = { id: string; course_id: string; status: string; cost: number | null; currency: string | null };
  type RawPartner = { id: string; name: string; website: string | null; location: string; contact_email: string; status: string };
  type SkillRow = { id: string; name: string; category: string; is_critical: boolean };
  type SnapRow = { id: string; skill_id: string; department_id: string | null; target_rating: number; current_average_rating: number; engineers_below_target: number; single_point_of_failure: boolean; risk_level: string; recommendation: string };
  type EnquiryRow = { id: string; training_partner_id: string | null; status: string };

  const skillsById = new Map((skills as SkillRow[]).map((s) => [s.id, s]));

  // Course → booking count
  const bookingsByCourse = new Map<string, number>();
  for (const b of bookings as RawBooking[]) {
    bookingsByCourse.set(b.course_id, (bookingsByCourse.get(b.course_id) ?? 0) + 1);
  }

  // Enquiries by partner
  const enquiriesByPartner = new Map<string, number>();
  for (const e of enquiries as EnquiryRow[]) {
    if (!e.training_partner_id) continue;
    if (["pending", "open", "submitted"].includes(e.status)) {
      enquiriesByPartner.set(e.training_partner_id, (enquiriesByPartner.get(e.training_partner_id) ?? 0) + 1);
    }
  }

  // ── Enrich providers ─────────────────────────────────────────────────────────
  const enrichedProviders = (partners as RawPartner[]).map((p) => {
    const meta = PARTNER_META[p.id] ?? {
      rating: 0,
      accreditation: "—",
      categories: [],
      description: "",
      delivery_focus: [],
    };

    const partnerCourses = (courses as RawCourse[]).filter(
      (c) => c.training_partner_id === p.id && c.status === "active"
    );

    // Delivery types from actual courses
    const deliveryTypes = [...new Set(partnerCourses.map((c) => c.delivery_type).filter(Boolean))];

    // Booking count across all courses for this partner
    const bookingCount = partnerCourses.reduce(
      (sum, c) => sum + (bookingsByCourse.get(c.id) ?? 0),
      0
    );

    // Top 6 courses by booking popularity
    const topCourses = [...partnerCourses]
      .sort((a, b) => (bookingsByCourse.get(b.id) ?? 0) - (bookingsByCourse.get(a.id) ?? 0))
      .slice(0, 6)
      .map((c) => ({
        id: c.id,
        title: c.title,
        delivery_type: c.delivery_type,
        duration_days: Number(c.duration_days),
        price: Number(c.price),
        currency: c.currency ?? "GBP",
        bookings: bookingsByCourse.get(c.id) ?? 0,
      }));

    return {
      id:            p.id,
      name:          p.name,
      location:      p.location,
      contact_email: p.contact_email,
      website:       p.website,
      status:        p.status,
      course_count:  partnerCourses.length,
      booking_count: bookingCount,
      enquiry_count: enquiriesByPartner.get(p.id) ?? 0,
      delivery_types: deliveryTypes,
      top_courses:   topCourses,
      // Static enrichment
      rating:        meta.rating,
      accreditation: meta.accreditation,
      categories:    meta.categories,
      description:   meta.description,
      delivery_focus: meta.delivery_focus,
    };
  });

  // ── Top skill gaps with provider matches ─────────────────────────────────────
  const seenSkills = new Set<string>();
  const gapMatches: {
    skill_name: string;
    category: string;
    risk_level: string;
    engineers_below: number;
    single_point_of_failure: boolean;
    recommendation: string;
    matched_partner_ids: string[];
    matched_partner_names: string[];
  }[] = [];

  const partnerNameById = new Map((partners as RawPartner[]).map((p) => [p.id, p.name]));

  for (const snap of (snapshots as SnapRow[]).slice(0, 20)) {
    const skill = skillsById.get(snap.skill_id) as SkillRow | undefined;
    if (!skill) continue;
    if (seenSkills.has(skill.name)) continue;
    seenSkills.add(skill.name);

    const matchedIds = CATEGORY_TO_PARTNERS[skill.category] ?? [];
    const matchedNames = matchedIds.map((id) => partnerNameById.get(id) ?? "").filter(Boolean);

    gapMatches.push({
      skill_name:            skill.name,
      category:              skill.category,
      risk_level:            snap.risk_level,
      engineers_below:       snap.engineers_below_target,
      single_point_of_failure: snap.single_point_of_failure,
      recommendation:        snap.recommendation,
      matched_partner_ids:   matchedIds,
      matched_partner_names: matchedNames,
    });

    if (gapMatches.length >= 6) break;
  }

  // ── Stats ─────────────────────────────────────────────────────────────────────
  const totalCourses    = (courses as RawCourse[]).filter((c) => c.status === "active").length;
  const openEnquiries   = (enquiries as EnquiryRow[]).filter((e) => ["pending","open","submitted"].includes(e.status)).length;
  const totalBookings   = bookings.length;

  return new Response(
    JSON.stringify({
      providers: enrichedProviders,
      gapMatches,
      stats: {
        providerCount: partners.length,
        courseCount:   totalCourses,
        openEnquiries,
        totalBookings,
      },
    }),
    { headers: { "Content-Type": "application/json", ...corsHeaders } }
  );
});
