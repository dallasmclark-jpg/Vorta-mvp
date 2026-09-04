import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const ORIGINS = new Set([
  "https://vorta-app.netlify.app",
  "https://main--vorta-app.netlify.app",
  "https://pilot-live--vorta-app.netlify.app",
  "https://vorta.network",
  "https://www.vorta.network",
  "http://localhost:5173",
  "http://localhost:3000",
  "http://localhost:4173",
  "http://127.0.0.1:4173",
]);

const ADMIN_ROLES = new Set(["site_admin", "vorta_admin"]);
const INVITABLE_ROLES = new Set([
  "site_admin",
  "maintenance_manager",
  "maintenance_planner",
  "reliability_engineer",
  "engineer",
  "production_manager",
  "operator",
  "contractor_admin",
  "contractor_engineer",
]);

function roleKey(value: unknown): string {
  return typeof value === "string"
    ? value.trim().toLowerCase().replace(/[\s-]+/g, "_")
    : "";
}

function allowedOrigin(origin: string | null): boolean {
  if (!origin) return true;
  return ORIGINS.has(origin) || /^https:\/\/deploy-preview-\d+--vorta-app\.netlify\.app$/.test(origin);
}

function responseHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("origin");
  return {
    "Content-Type": "application/json",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
    ...(origin && allowedOrigin(origin) ? { "Access-Control-Allow-Origin": origin } : {}),
  };
}

function json(req: Request, body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: responseHeaders(req) });
}

function safeText(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, max) : null;
}

function validEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

async function findAuthUserByEmail(adminClient: any, email: string): Promise<any | null> {
  const wanted = email.toLowerCase();
  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await adminClient.auth.admin.listUsers({ page, perPage: 100 });
    if (error) throw error;
    const users = data?.users ?? [];
    const found = users.find((candidate: any) => String(candidate.email ?? "").toLowerCase() === wanted);
    if (found) return found;
    if (users.length < 100) return null;
  }
  return null;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: allowedOrigin(req.headers.get("origin")) ? 204 : 403,
      headers: responseHeaders(req),
    });
  }
  if (req.method !== "POST") return json(req, { error: "Method not allowed" }, 405);
  if (!allowedOrigin(req.headers.get("origin"))) return json(req, { error: "Origin not allowed" }, 403);

  try {
    const authorization = req.headers.get("authorization");
    const url = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!authorization || !url || !anonKey || !serviceRoleKey) {
      return json(req, { error: "Authentication required" }, 401);
    }

    const token = authorization.replace(/^Bearer\s+/i, "").trim();
    const authClient = createClient(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: userResult, error: userError } = await authClient.auth.getUser(token);
    const user = userResult.user;
    if (userError || !user) return json(req, { error: "Authentication could not be verified" }, 401);

    const db = createClient(url, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const payload = await req.json().catch(() => ({}));
    const action = safeText(payload?.action, 40) ?? "list";
    const siteId = safeText(payload?.siteId, 80);
    if (!siteId) return json(req, { error: "Site is required" }, 400);

    const { data: callerAccess, error: callerAccessError } = await db
      .from("user_site_access")
      .select("site_id,organisation_id,app_role,active")
      .eq("user_id", user.id)
      .eq("site_id", siteId)
      .eq("active", true)
      .maybeSingle();

    if (callerAccessError || !callerAccess) return json(req, { error: "Site access could not be verified" }, 403);

    const { data: site, error: siteError } = await db
      .from("sites")
      .select("id,organisation_id,owner_user_id")
      .eq("id", siteId)
      .maybeSingle();
    if (siteError || !site || site.organisation_id !== callerAccess.organisation_id) {
      return json(req, { error: "Site administration scope could not be verified" }, 403);
    }

    const accessRole = roleKey(callerAccess.app_role);
    const isOwner = site.owner_user_id === user.id;
    if (!isOwner && !ADMIN_ROLES.has(accessRole)) return json(req, { error: "Site administration access is required" }, 403);
    const callerRole = isOwner ? "site_owner" : accessRole;
    const organisationId = callerAccess.organisation_id;

    if (action === "list") {
      const { data: accessRows, error: accessError } = await db
        .from("user_site_access")
        .select("user_id,app_role,is_default,active,created_at,updated_at")
        .eq("site_id", siteId)
        .eq("organisation_id", organisationId)
        .order("created_at", { ascending: true });
      if (accessError) throw accessError;

      const userIds = Array.from(new Set((accessRows ?? []).map((row: any) => row.user_id)));
      const { data: profiles, error: profilesError } = userIds.length
        ? await db.from("profiles").select("id,full_name,job_title").in("id", userIds)
        : { data: [], error: null };
      if (profilesError) throw profilesError;

      const profileMap = new Map((profiles ?? []).map((profile: any) => [profile.id, profile]));
      const members = await Promise.all((accessRows ?? []).map(async (row: any) => {
        const { data: authUserResult } = await db.auth.admin.getUserById(row.user_id);
        const authUser = authUserResult?.user;
        const profile = profileMap.get(row.user_id) as any;
        return {
          userId: row.user_id,
          email: authUser?.email ?? null,
          fullName: profile?.full_name ?? null,
          jobTitle: profile?.job_title ?? null,
          role: row.user_id === site.owner_user_id ? "site_owner" : roleKey(row.app_role),
          portalRole: roleKey(row.app_role),
          active: Boolean(row.active),
          isDefault: Boolean(row.is_default),
          createdAt: row.created_at,
        };
      }));

      const { data: invitations, error: inviteError } = await db
        .from("site_invitations")
        .select("id,email,full_name,app_role,status,expires_at,created_at")
        .eq("site_id", siteId)
        .eq("organisation_id", organisationId)
        .in("status", ["pending", "failed"])
        .order("created_at", { ascending: false });
      if (inviteError) throw inviteError;

      return json(req, { callerRole, members, invitations: invitations ?? [] });
    }

    if (action === "invite") {
      const email = (safeText(payload?.email, 320) ?? "").toLowerCase();
      const fullName = safeText(payload?.fullName, 120);
      const inviteRole = roleKey(payload?.role);
      if (!email || !validEmail(email)) return json(req, { error: "A valid work email is required" }, 400);
      if (!INVITABLE_ROLES.has(inviteRole)) return json(req, { error: "Unsupported site role" }, 400);
      if (!isOwner && inviteRole === "site_admin") {
        return json(req, { error: "Only the Site Owner can appoint another Site Admin" }, 403);
      }

      const existingAuthUser = await findAuthUserByEmail(db, email);
      if (existingAuthUser) {
        const { data: existingProfile, error: existingProfileError } = await db
          .from("profiles")
          .select("id,organisation_id,full_name,role")
          .eq("id", existingAuthUser.id)
          .maybeSingle();
        if (existingProfileError) throw existingProfileError;
        if (existingProfile?.organisation_id && existingProfile.organisation_id !== organisationId) {
          return json(req, { error: "That Vorta account belongs to a different organisation" }, 409);
        }

        const { data: existingAccess } = await db
          .from("user_site_access")
          .select("user_id,active")
          .eq("user_id", existingAuthUser.id)
          .eq("site_id", siteId)
          .maybeSingle();
        if (existingAccess?.active) return json(req, { error: "That user already has active access to this site" }, 409);

        const { error: profileUpsertError } = await db.from("profiles").upsert({
          id: existingAuthUser.id,
          organisation_id: organisationId,
          full_name: fullName ?? existingProfile?.full_name ?? existingAuthUser.user_metadata?.full_name ?? null,
          role: existingProfile?.organisation_id ? existingProfile.role : inviteRole,
          updated_at: new Date().toISOString(),
        }, { onConflict: "id" });
        if (profileUpsertError) throw profileUpsertError;

        const { error: accessUpsertError } = await db.from("user_site_access").upsert({
          user_id: existingAuthUser.id,
          organisation_id: organisationId,
          site_id: siteId,
          app_role: inviteRole,
          is_default: false,
          active: true,
          updated_at: new Date().toISOString(),
        }, { onConflict: "user_id,site_id" });
        if (accessUpsertError) throw accessUpsertError;

        await db.from("site_admin_audit_log").insert({
          organisation_id: organisationId,
          site_id: siteId,
          actor_user_id: user.id,
          target_user_id: existingAuthUser.id,
          action: "EXISTING_USER_ADDED",
          new_value: { email, role: inviteRole },
        });

        return json(req, { status: "added", message: "Existing Vorta account added to the site. They can sign in now." });
      }

      const { data: invitation, error: invitationError } = await db
        .from("site_invitations")
        .insert({
          organisation_id: organisationId,
          site_id: siteId,
          email,
          app_role: inviteRole,
          full_name: fullName,
          invited_by: user.id,
        })
        .select("id,email,app_role")
        .single();
      if (invitationError) {
        if (invitationError.code === "23505") return json(req, { error: "A pending invitation already exists for that email" }, 409);
        throw invitationError;
      }

      const origin = req.headers.get("origin");
      const redirectBase = origin && allowedOrigin(origin) ? origin : "https://vorta-app.netlify.app";
      const { data: invitedUser, error: authInviteError } = await db.auth.admin.inviteUserByEmail(email, {
        data: {
          full_name: fullName,
          vorta_invitation_id: invitation.id,
        },
        redirectTo: `${redirectBase}/auth/callback?invite=1`,
      });

      if (authInviteError) {
        await db.from("site_invitations").update({ status: "failed", updated_at: new Date().toISOString() }).eq("id", invitation.id);
        return json(req, { error: authInviteError.message }, 400);
      }

      await db.from("site_invitations").update({
        auth_user_id: invitedUser.user?.id ?? null,
        updated_at: new Date().toISOString(),
      }).eq("id", invitation.id);

      await db.from("site_admin_audit_log").insert({
        organisation_id: organisationId,
        site_id: siteId,
        actor_user_id: user.id,
        target_user_id: invitedUser.user?.id ?? null,
        action: "USER_INVITED",
        new_value: { email, role: inviteRole, invitation_id: invitation.id },
      });

      return json(req, { status: "invited", invitationId: invitation.id });
    }

    if (action === "cancel_invite") {
      const invitationId = safeText(payload?.invitationId, 80);
      if (!invitationId) return json(req, { error: "Invitation is required" }, 400);
      const { data: invitation, error: invitationError } = await db
        .from("site_invitations")
        .select("id,email,status")
        .eq("id", invitationId)
        .eq("site_id", siteId)
        .eq("organisation_id", organisationId)
        .maybeSingle();
      if (invitationError || !invitation) return json(req, { error: "Invitation not found" }, 404);
      if (invitation.status !== "pending" && invitation.status !== "failed") return json(req, { error: "Invitation is no longer active" }, 409);
      const { error: cancelError } = await db.from("site_invitations").update({ status: "cancelled", updated_at: new Date().toISOString() }).eq("id", invitationId);
      if (cancelError) throw cancelError;
      await db.from("site_admin_audit_log").insert({
        organisation_id: organisationId,
        site_id: siteId,
        actor_user_id: user.id,
        action: "INVITATION_CANCELLED",
        previous_value: { email: invitation.email, status: invitation.status },
        new_value: { status: "cancelled" },
      });
      return json(req, { status: "cancelled" });
    }

    const targetUserId = safeText(payload?.targetUserId, 80);
    if (!targetUserId) return json(req, { error: "Target user is required" }, 400);
    if (targetUserId === user.id && action === "deactivate") return json(req, { error: "You cannot deactivate your own account" }, 400);

    const { data: targetAccess, error: targetError } = await db
      .from("user_site_access")
      .select("user_id,app_role,active,is_default")
      .eq("user_id", targetUserId)
      .eq("site_id", siteId)
      .eq("organisation_id", organisationId)
      .maybeSingle();
    if (targetError || !targetAccess) return json(req, { error: "Site member not found" }, 404);
    const targetIsOwner = targetUserId === site.owner_user_id;
    const targetRole = targetIsOwner ? "site_owner" : roleKey(targetAccess.app_role);

    if (action === "deactivate") {
      if (targetIsOwner) return json(req, { error: "Transfer Site Ownership before deactivating the owner" }, 409);
      if (!isOwner && roleKey(targetAccess.app_role) === "site_admin") {
        return json(req, { error: "Only the Site Owner can deactivate another Site Admin" }, 403);
      }
      const { error: deactivateError } = await db.from("user_site_access").update({
        active: false,
        is_default: false,
        updated_at: new Date().toISOString(),
      }).eq("user_id", targetUserId).eq("site_id", siteId);
      if (deactivateError) throw deactivateError;
      await db.from("site_admin_audit_log").insert({
        organisation_id: organisationId,
        site_id: siteId,
        actor_user_id: user.id,
        target_user_id: targetUserId,
        action: "USER_DEACTIVATED",
        previous_value: { role: targetRole, active: targetAccess.active },
        new_value: { role: roleKey(targetAccess.app_role), active: false },
      });
      return json(req, { status: "deactivated" });
    }

    if (action === "change_role") {
      const nextRole = roleKey(payload?.role);
      if (!INVITABLE_ROLES.has(nextRole)) return json(req, { error: "Unsupported site role" }, 400);
      if (targetIsOwner) return json(req, { error: "Use Transfer Ownership to change the Site Owner" }, 409);
      if (!isOwner && (roleKey(targetAccess.app_role) === "site_admin" || nextRole === "site_admin")) {
        return json(req, { error: "Only the Site Owner can change Site Admin access" }, 403);
      }
      const { error: roleError } = await db.from("user_site_access").update({
        app_role: nextRole,
        updated_at: new Date().toISOString(),
      }).eq("user_id", targetUserId).eq("site_id", siteId);
      if (roleError) throw roleError;
      await db.from("site_admin_audit_log").insert({
        organisation_id: organisationId,
        site_id: siteId,
        actor_user_id: user.id,
        target_user_id: targetUserId,
        action: "USER_ROLE_CHANGED",
        previous_value: { role: targetRole },
        new_value: { role: nextRole },
      });
      return json(req, { status: "updated", role: nextRole });
    }

    if (action === "transfer_owner") {
      if (!isOwner) return json(req, { error: "Only the current Site Owner can transfer ownership" }, 403);
      if (!targetAccess.active) return json(req, { error: "The new Site Owner must be active" }, 409);
      const { error: transferError } = await db.rpc("vorta_transfer_site_ownership", {
        p_actor_user_id: user.id,
        p_target_user_id: targetUserId,
        p_site_id: siteId,
      });
      if (transferError) throw transferError;
      return json(req, { status: "transferred" });
    }

    return json(req, { error: "Unsupported administration action" }, 400);
  } catch (error) {
    console.error("site-user-admin failed", error);
    return json(req, { error: error instanceof Error ? error.message : "Site administration request failed" }, 500);
  }
});
