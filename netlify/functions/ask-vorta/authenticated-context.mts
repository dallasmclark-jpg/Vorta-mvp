import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { validateAskVortaImage } from "../_shared/askVortaImageEvidence.mjs";
import type { AskVortaRequest, JsonRecord } from "./contracts.mjs";
import { jsonResponse, parseRequest } from "./request-context.mjs";

export type AuthenticatedAskVortaRequest =
  | { ok: true; request: AskVortaRequest; supabase: SupabaseClient; userId: string }
  | { ok: false; response: Response };

export async function authenticateAskVortaRequest(
  req: Request,
): Promise<AuthenticatedAskVortaRequest> {
  const bearer = req.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1]?.trim();
  if (!bearer) return { ok: false, response: jsonResponse({ error: "Authentication is required." }, 401) };

  const supabaseUrl = Netlify.env.get("VITE_SUPABASE_URL");
  const supabaseAnonKey = Netlify.env.get("VITE_SUPABASE_ANON_KEY");
  if (!supabaseUrl || !supabaseAnonKey || !Netlify.env.get("OPENAI_BASE_URL")) {
    return { ok: false, response: jsonResponse({ error: "Ask Vorta is not configured on this deployment." }, 503) };
  }

  const rawRequest = await req.json().catch(() => null);
  const rawImage = rawRequest && typeof rawRequest === "object" && !Array.isArray(rawRequest)
    ? (rawRequest as JsonRecord).image
    : null;
  if (rawImage != null) {
    const imageValidation = validateAskVortaImage(rawImage);
    if (!imageValidation.ok) {
      return { ok: false, response: jsonResponse({ error: imageValidation.message }, 400) };
    }
  }
  const request = parseRequest(rawRequest);
  if (!request) {
    return { ok: false, response: jsonResponse({ error: "The Ask Vorta request is invalid." }, 400) };
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${bearer}` } },
  });
  const { data: userData, error: userError } = await supabase.auth.getUser(bearer);
  if (userError || !userData.user) {
    return { ok: false, response: jsonResponse({ error: "Your Vorta session is not valid." }, 401) };
  }

  const userId = userData.user.id;
  const { data: access, error: accessError } = await supabase
    .from("user_site_access")
    .select("site_id")
    .eq("user_id", userId)
    .eq("site_id", request.siteId)
    .eq("active", true)
    .maybeSingle();
  if (accessError || !access) {
    return { ok: false, response: jsonResponse({ error: "You do not have access to the requested Vorta site." }, 403) };
  }

  return { ok: true, request, supabase, userId };
}
