import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { context, preflight, response } from "./auth.ts";
import { buildEngineerPayload } from "./transform.ts";

type EvidenceBundle = {
  engineers?: unknown;
  assignments?: unknown;
  risks?: unknown;
  bookings?: unknown;
  courses?: unknown;
  departments?: unknown;
  sites?: unknown;
  gaps?: unknown;
  skills?: unknown;
};

function rows(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value)
    ? value.filter(
        (entry): entry is Record<string, unknown> =>
          Boolean(entry) && typeof entry === "object" && !Array.isArray(entry),
      )
    : [];
}

Deno.serve(async (req: Request) => {
  const options = preflight(req);
  if (options) return options;
  if (!["GET", "POST"].includes(req.method)) {
    return response(req, { error: "Method not allowed" }, 405);
  }

  try {
    const { db, siteId, organisationId } = await context(req);
    const startedAt = performance.now();
    const { data, error } = await db.rpc(
      "vorta_get_engineers_evidence_bundle_internal",
      {
        p_site_id: siteId,
        p_organisation_id: organisationId,
      },
    );

    if (error) throw error;
    if (!data || typeof data !== "object" || Array.isArray(data)) {
      throw new Error("Engineer evidence bundle returned no site-scoped payload");
    }

    const bundle = data as EvidenceBundle;
    const payload = buildEngineerPayload({
      engineers: rows(bundle.engineers),
      assignments: rows(bundle.assignments),
      risks: rows(bundle.risks),
      bookings: rows(bundle.bookings),
      courses: rows(bundle.courses),
      departments: rows(bundle.departments),
      sites: rows(bundle.sites),
      gaps: rows(bundle.gaps),
      skills: rows(bundle.skills),
    });

    return response(req, {
      siteId,
      organisationId,
      generatedAt: new Date().toISOString(),
      evidenceLoadMs: Math.round((performance.now() - startedAt) * 10) / 10,
      ...payload,
    });
  } catch (error) {
    const status = Number((error as { status?: unknown })?.status) || 500;
    if (status >= 500) console.error("engineers-data failed", error);
    return response(
      req,
      {
        error:
          status < 500
            ? String((error as { message?: unknown })?.message ?? "Access denied")
            : "Engineer data could not be loaded",
      },
      status,
    );
  }
});
