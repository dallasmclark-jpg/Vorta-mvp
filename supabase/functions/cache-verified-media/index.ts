import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const BUCKET = "vorta-media";
const MAX_BYTES = 5 * 1024 * 1024;
// PostgreSQL's uuid type accepts UUID-shaped values whose version/variant bits are
// not RFC-generated. Vorta uses deterministic UUID values for some seeded assets;
// syntax is checked here, while record existence/site authorization remains RLS-gated.
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ALLOWED_ROLES = new Set(["maintenance_manager", "site_admin", "vorta_admin"]);

type EntityType = "equipment" | "spare";

interface SourceRecord {
  id: string;
  site_id: string;
  image_url: string | null;
  image_source_url: string | null;
  image_source_type: string | null;
  image_attribution: string | null;
  image_alt_text: string | null;
  image_verification_status: string | null;
  image_match_basis: string | null;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function normaliseRole(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[-\s]+/g, "_");
}

function safeRemoteUrl(value: unknown): URL | null {
  if (typeof value !== "string" || !value.trim()) return null;

  try {
    const url = new URL(value);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;

    const host = url.hostname.toLowerCase();
    if (
      host === "localhost" ||
      host === "::1" ||
      host.endsWith(".local") ||
      /^127\./.test(host) ||
      /^10\./.test(host) ||
      /^192\.168\./.test(host) ||
      /^169\.254\./.test(host)
    ) {
      return null;
    }

    const private172 = host.match(/^172\.(\d{1,3})\./);
    if (private172) {
      const second = Number(private172[1]);
      if (second >= 16 && second <= 31) return null;
    }

    return url;
  } catch {
    return null;
  }
}

async function fetchVerifiedImage(sourceUrl: URL, sourcePage: string | null): Promise<Response> {
  let current = sourceUrl;

  for (let redirectCount = 0; redirectCount <= 3; redirectCount += 1) {
    const response = await fetch(current, {
      redirect: "manual",
      signal: AbortSignal.timeout(12_000),
      headers: {
        Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36",
        ...(sourcePage ? { Referer: sourcePage } : {}),
      },
    });

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location || redirectCount === 3) {
        throw new Error("Verified image source redirected unexpectedly.");
      }
      const next = safeRemoteUrl(new URL(location, current).toString());
      if (!next) throw new Error("Verified image source redirected to a blocked address.");
      current = next;
      continue;
    }

    return response;
  }

  throw new Error("Verified image source could not be resolved.");
}

function detectImageContentType(bytes: Uint8Array): "image/jpeg" | "image/png" | "image/webp" | null {
  if (
    bytes.length >= 3 &&
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes[2] === 0xff
  ) {
    return "image/jpeg";
  }

  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return "image/png";
  }

  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return "image/webp";
  }

  return null;
}

function extensionFor(contentType: string): string {
  if (contentType === "image/png") return "png";
  if (contentType === "image/webp") return "webp";
  return "jpg";
}

async function sourceHash(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 24);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Authentication required" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    if (!supabaseUrl || !anonKey || !serviceKey) {
      return json({ error: "Media cache is not configured" }, 503);
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });
    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false },
    });

    const token = authHeader.slice("Bearer ".length);
    const { data: userData, error: userError } = await userClient.auth.getUser(token);
    if (userError || !userData.user) return json({ error: "Authentication required" }, 401);

    const { entityType, entityId } = (await req.json()) as {
      entityType?: EntityType;
      entityId?: string;
    };
    if ((entityType !== "equipment" && entityType !== "spare") || !entityId || !UUID_PATTERN.test(entityId)) {
      return json({ error: "Invalid media target" }, 400);
    }

    const { data: profile } = await admin
      .from("profiles")
      .select("role")
      .eq("id", userData.user.id)
      .maybeSingle();
    if (!ALLOWED_ROLES.has(normaliseRole(profile?.role))) {
      return json({ error: "Media caching is not authorised for this role" }, 403);
    }

    const table = entityType === "equipment" ? "equipment_assets" : "equipment_components";
    const { data: visibleRecord, error: visibleError } = await userClient
      .from(table)
      .select("id,site_id")
      .eq("id", entityId)
      .maybeSingle();
    if (visibleError || !visibleRecord) return json({ error: "Media target is not authorised" }, 403);

    const { data: rawSource, error: sourceError } = await admin
      .from(table)
      .select(
        "id,site_id,image_url,image_source_url,image_source_type,image_attribution,image_alt_text,image_verification_status,image_match_basis",
      )
      .eq("id", entityId)
      .eq("site_id", visibleRecord.site_id)
      .maybeSingle();
    if (sourceError || !rawSource) return json({ error: "Verified media source is unavailable" }, 404);

    const source = rawSource as SourceRecord;
    if (source.image_verification_status !== "verified" || !source.image_match_basis) {
      return json({ error: "Only verified Vorta media can be cached" }, 409);
    }
    if (entityType === "spare" && source.image_match_basis !== "exact_part") {
      return json({ error: "Spare media is not an exact-part match" }, 409);
    }

    const sourceUrl = safeRemoteUrl(source.image_url);
    if (!sourceUrl) return json({ error: "Verified media URL is unavailable" }, 409);
    const sourcePage = safeRemoteUrl(source.image_source_url)?.toString() ?? null;

    const entityColumn = entityType === "equipment" ? "equipment_id" : "component_id";
    const { data: existing } = await admin
      .from("vorta_entity_images")
      .select("id,storage_path,source_type,alt_text,original_filename,uploaded_by,created_at")
      .eq("site_id", source.site_id)
      .eq("entity_type", entityType)
      .eq(entityColumn, entityId)
      .eq("source_type", "oem_cached")
      .eq("source_url", sourceUrl.toString())
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existing) {
      const { data: signed, error: signedError } = await admin.storage
        .from(BUCKET)
        .createSignedUrl(existing.storage_path, 24 * 60 * 60);
      if (!signedError && signed?.signedUrl) {
        return json({
          image: {
            id: existing.id,
            entityType,
            entityId,
            storagePath: existing.storage_path,
            signedUrl: signed.signedUrl,
            sourceType: existing.source_type,
            altText: existing.alt_text,
            originalFilename: existing.original_filename,
            uploadedBy: existing.uploaded_by,
            createdAt: existing.created_at,
          },
          cached: true,
        });
      }
    }

    const imageResponse = await fetchVerifiedImage(sourceUrl, sourcePage);
    if (!imageResponse.ok) {
      return json({ error: `Verified media source returned ${imageResponse.status}` }, 502);
    }

    const contentLength = Number(imageResponse.headers.get("content-length") ?? "0");
    if (Number.isFinite(contentLength) && contentLength > MAX_BYTES) {
      return json({ error: "Verified media source exceeds the 5 MB Vorta limit" }, 413);
    }

    const bytes = new Uint8Array(await imageResponse.arrayBuffer());
    if (bytes.length <= 0 || bytes.length > MAX_BYTES) {
      return json({ error: "Verified media source exceeds the Vorta image limits" }, 413);
    }

    // Some manufacturer CDNs return valid image bytes with generic or incorrect
    // Content-Type headers. Verify the payload itself rather than trusting metadata.
    const contentType = detectImageContentType(bytes);
    if (!contentType) {
      return json({ error: "Verified media source did not contain a supported image payload" }, 415);
    }

    const hash = await sourceHash(sourceUrl.toString());
    const storagePath = `${source.site_id}/${entityType}/${entityId}/oem-${hash}.${extensionFor(contentType)}`;
    const { error: uploadError } = await admin.storage
      .from(BUCKET)
      .upload(storagePath, bytes, {
        contentType,
        cacheControl: "86400",
        upsert: false,
      });
    if (uploadError && !uploadError.message.toLowerCase().includes("already exists")) {
      return json({ error: `Vorta media cache upload failed: ${uploadError.message}` }, 502);
    }

    const originalFilename = decodeURIComponent(sourceUrl.pathname.split("/").pop() || `verified.${extensionFor(contentType)}`);
    const target =
      entityType === "equipment"
        ? { equipment_id: entityId, component_id: null }
        : { equipment_id: null, component_id: entityId };

    const { data: inserted, error: insertError } = await admin
      .from("vorta_entity_images")
      .upsert(
        {
          site_id: source.site_id,
          entity_type: entityType,
          ...target,
          storage_bucket: BUCKET,
          storage_path: storagePath,
          source_type: "oem_cached",
          source_url: sourceUrl.toString(),
          attribution: source.image_attribution,
          alt_text: source.image_alt_text,
          is_primary: false,
          uploaded_by: userData.user.id,
          original_filename: originalFilename,
          content_type: contentType,
          file_size_bytes: bytes.length,
        },
        { onConflict: "storage_path" },
      )
      .select("id,storage_path,source_type,alt_text,original_filename,uploaded_by,created_at")
      .single();
    if (insertError || !inserted) {
      return json({ error: `Vorta media cache metadata failed: ${insertError?.message ?? "unknown error"}` }, 502);
    }

    const { data: signed, error: signedError } = await admin.storage
      .from(BUCKET)
      .createSignedUrl(storagePath, 24 * 60 * 60);
    if (signedError || !signed?.signedUrl) {
      return json({ error: "Cached Vorta image could not be opened" }, 502);
    }

    return json({
      image: {
        id: inserted.id,
        entityType,
        entityId,
        storagePath,
        signedUrl: signed.signedUrl,
        sourceType: inserted.source_type,
        altText: inserted.alt_text,
        originalFilename: inserted.original_filename,
        uploadedBy: inserted.uploaded_by,
        createdAt: inserted.created_at,
      },
      cached: true,
    });
  } catch (error) {
    console.error("cache-verified-media failed", error);
    return json({ error: error instanceof Error ? error.message : "Media caching failed" }, 500);
  }
});
