import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { VortaLogo } from "../../components/VortaLogo";
import { useAuth } from "../../lib/auth";
import { supabase } from "../../lib/supabaseClient";

type Member = {
  userId: string;
  email: string | null;
  fullName: string | null;
  role: string;
  portalRole?: string;
  active: boolean;
};

type Invitation = {
  id: string;
  email: string;
  full_name: string | null;
  app_role: string;
};

type AdminPayload = {
  callerRole: string;
  members: Member[];
  invitations: Invitation[];
};

const ROLES = [
  ["site_admin", "Site Admin"],
  ["maintenance_manager", "Maintenance Manager"],
  ["maintenance_planner", "Maintenance Planner"],
  ["reliability_engineer", "Reliability Engineer"],
  ["engineer", "Engineer"],
  ["production_manager", "Production Manager"],
  ["operator", "Operator"],
  ["contractor_admin", "Contractor Admin"],
  ["contractor_engineer", "Contractor Engineer"],
] as const;

const fieldClass =
  "h-10 rounded-lg border border-slate-700 bg-[#0b0e14] px-3 text-sm text-slate-200 outline-none disabled:opacity-50";

const roleLabel = (value: string) =>
  value === "site_owner"
    ? "Site Owner"
    : ROLES.find(([role]) => role === value)?.[1] ?? value.replaceAll("_", " ");

export function SiteAdministrationPage(): JSX.Element {
  const { session, siteContext } = useAuth();
  const [data, setData] = useState<AdminPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [inviteName, setInviteName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("engineer");

  const siteId = siteContext?.siteId ?? null;
  const currentUserId = session?.user.id ?? null;
  const isOwner = data?.callerRole === "site_owner";
  const members = data?.members.filter((member) => member.active) ?? [];

  const invoke = useCallback(async (body: Record<string, unknown>) => {
    if (!siteId) throw new Error("No active Vorta site is available.");
    const { data: result, error: requestError } = await supabase.functions.invoke(
      "site-user-admin",
      { body: { ...body, siteId } },
    );
    if (requestError) throw requestError;
    if (result?.error) throw new Error(String(result.error));
    return result;
  }, [siteId]);

  const load = useCallback(async () => {
    if (!siteId) return;
    setLoading(true);
    setError(null);
    try {
      setData((await invoke({ action: "list" })) as AdminPayload);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Site administration could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [invoke, siteId]);

  useEffect(() => { void load(); }, [load]);

  const act = async (body: Record<string, unknown>, success: string) => {
    if (working) return;
    setWorking(true);
    setMessage(null);
    setError(null);
    try {
      await invoke(body);
      setMessage(success);
      await load();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "The change could not be completed.");
    } finally {
      setWorking(false);
    }
  };

  const submitInvite = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!inviteEmail.trim()) return;
    await act(
      {
        action: "invite",
        email: inviteEmail.trim(),
        fullName: inviteName.trim() || null,
        role: inviteRole,
      },
      "Invitation sent or existing Vorta account added.",
    );
    setInviteName("");
    setInviteEmail("");
    setInviteRole("engineer");
  };

  const transfer = async (member: Member) => {
    if (!window.confirm(`Transfer Site Owner authority to ${member.fullName || member.email || "this user"}?`)) return;
    await act(
      { action: "transfer_owner", targetUserId: member.userId },
      "Site ownership transferred.",
    );
  };

  return (
    <div className="min-h-screen bg-[#0b0e14] text-slate-100">
      <header className="flex h-16 items-center justify-between border-b border-slate-800 px-6">
        <VortaLogo />
        <Link to="/dashboard" className="text-sm text-slate-400">Back to Vorta</Link>
      </header>

      <main className="mx-auto w-full max-w-5xl px-4 py-8">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-white">People & access</h1>
            <p className="mt-1 text-sm text-slate-400">Invite users, assign roles and manage site access.</p>
          </div>
          <button type="button" onClick={() => void load()} disabled={loading || working} className="h-10 rounded-lg border border-slate-700 px-4 text-sm text-slate-300 disabled:opacity-50">Refresh</button>
        </div>

        {message && <p className="mt-5 text-sm text-emerald-400">{message}</p>}
        {error && <p className="mt-5 text-sm text-red-400">{error}</p>}

        <section className="mt-6 rounded-xl border border-slate-800 bg-[#11151d] p-5">
          <h2 className="font-semibold text-white">Invite team member</h2>
          <form onSubmit={submitInvite} className="mt-4 grid gap-3 md:grid-cols-4">
            <input className={fieldClass} value={inviteName} onChange={(e) => setInviteName(e.target.value)} placeholder="Full name" disabled={working} />
            <input className={fieldClass} type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="Work email" required disabled={working} />
            <select className={fieldClass} value={inviteRole} onChange={(e) => setInviteRole(e.target.value)} disabled={working}>
              {ROLES.filter(([role]) => isOwner || role !== "site_admin").map(([role, label]) => <option key={role} value={role}>{label}</option>)}
            </select>
            <button type="submit" disabled={working || !inviteEmail.trim()} className="h-10 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white disabled:opacity-50">Invite</button>
          </form>
        </section>

        <section className="mt-6 overflow-hidden rounded-xl border border-slate-800 bg-[#11151d]">
          <div className="flex items-center justify-between border-b border-slate-800 px-5 py-4">
            <h2 className="font-semibold text-white">Site members</h2>
            <span className="text-xs text-slate-500">{members.length} active</span>
          </div>

          {loading ? (
            <p className="p-5 text-sm text-slate-400">Loading site members…</p>
          ) : members.length === 0 ? (
            <p className="p-5 text-sm text-slate-400">No active members found.</p>
          ) : (
            <div className="divide-y divide-slate-800">
              {members.map((member) => {
                const memberIsOwner = member.role === "site_owner";
                const isSelf = member.userId === currentUserId;
                const canManage = isOwner || member.role !== "site_admin";
                return (
                  <div key={member.userId} className="grid gap-3 px-5 py-4 md:grid-cols-3 md:items-center">
                    <div>
                      <p className="text-sm font-semibold text-slate-200">
                        {member.fullName || member.email || "Vorta user"}{memberIsOwner ? " · Site Owner" : ""}{isSelf ? " · You" : ""}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">{member.email || "No email available"}</p>
                    </div>

                    {memberIsOwner ? (
                      <span className="text-sm text-slate-300">Site Admin</span>
                    ) : (
                      <select
                        className={fieldClass}
                        aria-label={`Role for ${member.fullName || member.email || "member"}`}
                        value={member.portalRole || member.role}
                        disabled={working || !canManage}
                        onChange={(e) => void act({ action: "change_role", targetUserId: member.userId, role: e.target.value }, "User role updated.")}
                      >
                        {ROLES.filter(([role]) => isOwner || role !== "site_admin").map(([role, label]) => <option key={role} value={role}>{label}</option>)}
                      </select>
                    )}

                    <div className="flex gap-2 md:justify-end">
                      {isOwner && !memberIsOwner && !isSelf && <button type="button" disabled={working} onClick={() => void transfer(member)} className="h-9 rounded-lg border border-slate-700 px-3 text-xs text-slate-300">Transfer ownership</button>}
                      {!memberIsOwner && !isSelf && canManage && <button type="button" disabled={working} onClick={() => void act({ action: "deactivate", targetUserId: member.userId }, "User access deactivated.")} className="h-9 rounded-lg border border-slate-700 px-3 text-xs text-red-300">Deactivate</button>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {Boolean(data?.invitations.length) && (
          <section className="mt-6 rounded-xl border border-slate-800 bg-[#11151d] p-5">
            <h2 className="font-semibold text-white">Pending invitations</h2>
            <div className="mt-3 divide-y divide-slate-800">
              {data?.invitations.map((invitation) => (
                <div key={invitation.id} className="flex items-center justify-between gap-3 py-3">
                  <p className="text-sm text-slate-300">{invitation.full_name || invitation.email} · {roleLabel(invitation.app_role)}</p>
                  <button type="button" disabled={working} onClick={() => void act({ action: "cancel_invite", invitationId: invitation.id }, "Invitation cancelled.")} className="text-xs text-slate-400">Cancel</button>
                </div>
              ))}
            </div>
          </section>
        )}

        <p className="mt-5 text-xs text-slate-500">Administration changes are recorded in the site audit log.</p>
      </main>
    </div>
  );
}
