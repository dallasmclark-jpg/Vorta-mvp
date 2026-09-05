import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

const initialOnboarding = read(
  "supabase/migrations/20260904211755_self_service_site_onboarding.sql",
);
const separatedAuthority = read(
  "supabase/migrations/20260904212258_separate_site_ownership_authority.sql",
);
const hardenedOnboarding = read(
  "supabase/migrations/20260904221718_harden_site_onboarding_rpc_security.sql",
);
const restoredAuthority = read(
  "supabase/migrations/20260905121147_restore_hardened_site_owner_authority.sql",
);

assert.match(
  initialOnboarding,
  /create table if not exists public\.site_invitations/i,
  "Self-service onboarding must retain site invitation persistence",
);
assert.match(
  initialOnboarding,
  /create table if not exists public\.site_admin_audit_log/i,
  "Self-service onboarding must retain the admin audit trail",
);

assert.match(
  separatedAuthority,
  /add column if not exists owner_user_id uuid references auth\.users\(id\)/i,
  "Site ownership must be represented by sites.owner_user_id",
);
assert.match(
  separatedAuthority,
  /select site\.organisation_id, site\.owner_user_id/i,
  "Ownership transfer must verify the authoritative owner from the site row",
);
assert.match(
  separatedAuthority,
  /v_owner_user_id is distinct from p_actor_user_id/i,
  "Only the current authoritative Site Owner may transfer ownership",
);
assert.match(
  separatedAuthority,
  /revoke all on function public\.vorta_transfer_site_ownership\(uuid,uuid,uuid\) from public, anon, authenticated/i,
  "Ownership transfer must not be directly executable by browser roles",
);
assert.match(
  separatedAuthority,
  /grant execute on function public\.vorta_transfer_site_ownership\(uuid,uuid,uuid\) to service_role/i,
  "Ownership transfer must remain service-role mediated",
);

assert.match(
  hardenedOnboarding,
  /create or replace function private\.vorta_bootstrap_site_owner/i,
  "The privileged bootstrap implementation must live in the private schema",
);
assert.match(
  hardenedOnboarding,
  /create or replace function public\.vorta_bootstrap_site_owner[\s\S]*?language sql[\s\S]*?from private\.vorta_bootstrap_site_owner/i,
  "The Data API bootstrap entrypoint must remain an invoker SQL wrapper over the private implementation",
);
assert.doesNotMatch(
  hardenedOnboarding.match(/create or replace function public\.vorta_bootstrap_site_owner[\s\S]*?\$function\$;/i)?.[0] ?? "",
  /security definer/i,
  "The public bootstrap wrapper must not become SECURITY DEFINER",
);
assert.match(
  hardenedOnboarding,
  /revoke execute on function public\.vorta_bootstrap_site_owner\(text,text,text,text,text,text\) from public, anon/i,
  "Anonymous bootstrap execution must remain revoked",
);

assert.match(
  restoredAuthority,
  /insert into public\.sites\(organisation_id, name, address, region, created_by, owner_user_id\)/i,
  "The final hardened bootstrap must write the authoritative Site Owner",
);
assert.match(
  restoredAuthority,
  /values \(v_user_id, v_org_id, v_full_name, 'site_admin'\)/i,
  "The initial Site Owner must use the supported site_admin portal role",
);
assert.match(
  restoredAuthority,
  /values \(v_user_id, v_org_id, v_site_id, 'site_admin', true, true\)/i,
  "The initial Site Owner must receive active default site_admin access",
);
assert.match(
  restoredAuthority,
  /'authority', 'site_owner'[\s\S]*?'portal_role', 'site_admin'/i,
  "The audit event must distinguish ownership authority from portal role",
);
assert.match(
  restoredAuthority,
  /return query select v_org_id, v_site_id, 'site_admin'::text/i,
  "Bootstrap must return the supported portal role",
);
assert.match(
  restoredAuthority,
  /revoke execute on function private\.vorta_bootstrap_site_owner\(text,text,text,text,text,text\) from public, anon/i,
  "The hardened private implementation must remain unavailable to anonymous callers",
);
assert.match(
  restoredAuthority,
  /grant execute on function private\.vorta_bootstrap_site_owner\(text,text,text,text,text,text\) to authenticated, service_role/i,
  "The private bootstrap implementation must retain only the reviewed authenticated/server execution path",
);

console.log(
  "Site onboarding authority contracts passed: ownership stays in sites.owner_user_id, the owner uses site_admin portal access, and hardened RPC boundaries remain intact.",
);
