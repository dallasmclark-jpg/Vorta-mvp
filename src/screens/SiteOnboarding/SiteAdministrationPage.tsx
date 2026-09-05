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
  "site_admin",
  "maintenance_manager",
  "maintenance_planner",
  "reliability_engineer",
  "engineer",
  "production_manager",
  "operator",
  "contractor_admin",
  "contractor_engineer",
] as const;

const roleLabel = (role: string) =>
  role.split("_").map((word) => word[0]?.toUpperCase() + word.slice(1)).join(" ");
const fieldClass = "h-10 w-full border border-slate-700 px-3 text-sm text-slate-200";
const pageStyle = { backgroundColor: "#0b0e14" };
const panelStyle = { backgroundColor: "#11151d" };

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
  const assignableRoles = ROLES.filter((role) => isOwner || role !== "site_admin");

  const invoke = useCallback(async (body: Record<string, unknown>) => {
    if (!siteId) throw new Error("No active site.");
    const { data: result, error: requestError } = await supabase.functions.invoke("site-user-admin", {
      body: { ...body, siteId },
    });
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
      setError(loadError instanceof Error ? loadError.message : "Could not load access.");
    } finally {
      setLoading(false);
    }
  }, [invoke, siteId]);

  useEffect(() => { void load(); }, [load]);

  const act = async (body: Record<string, unknown>) => {
    if (working) return;
    setWorking(true);
    setMessage(null);
    setError(null);
    try {
      await invoke(body);
      setMessage("Access updated.");
      await load();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Change failed.");
    } finally {
      setWorking(false);
    }
  };

  const submitInvite = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!inviteEmail.trim()) return;
    await act({
      action: "invite",
      email: inviteEmail.trim(),
      fullName: inviteName.trim() || null,
      role: inviteRole,
    });
    setInviteName("");
    setInviteEmail("");
    setInviteRole("engineer");
  };

  const transfer = async (member: Member) => {
    if (!window.confirm(`Transfer Site Owner authority to ${member.fullName || member.email || "this user"}?`)) return;
    await act({ action: "transfer_owner", targetUserId: member.userId });
  };

  return (
    <div className="min-h-screen text-slate-100" style={pageStyle}>
      <header className="flex h-16 items-center justify-between border-b border-slate-800 px-4">
        <VortaLogo />
        <Link to="/dashboard" className="text-sm text-slate-400">Back to Vorta</Link>
      </header>
      <main className="mx-auto w-full p-4" style={{ maxWidth: 1024 }}>
        <h1 className="text-2xl font-semibold text-white">People & access</h1>
        {message && <p className="mt-4 text-sm text-blue-400">{message}</p>}
        {error && <p className="mt-4 text-sm text-red-400">{error}</p>}

        <section className="mt-6 border border-slate-800 p-4" style={panelStyle}>
          <h2 className="font-semibold text-white">Invite team member</h2>
          <form onSubmit={submitInvite} className="mt-4 grid gap-3">
            <input className={fieldClass} style={pageStyle} value={inviteName} onChange={(e) => setInviteName(e.target.value)} placeholder="Full name" disabled={working} />
            <input className={fieldClass} style={pageStyle} type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="Work email" required disabled={working} />
            <select className={fieldClass} style={pageStyle} value={inviteRole} onChange={(e) => setInviteRole(e.target.value)} disabled={working}>
              {assignableRoles.map((role) => <option key={role} value={role}>{roleLabel(role)}</option>)}
            </select>
            <button type="submit" disabled={working || !inviteEmail.trim()} className="h-10 bg-blue-600 px-4 text-sm font-semibold text-white disabled:opacity-50">Invite</button>
          </form>
        </section>

        <section className="mt-6 border border-slate-800" style={panelStyle}>
          <h2 className="border-b border-slate-800 p-4 font-semibold text-white">Site members</h2>
          {loading ? (
            <p className="p-4 text-sm text-slate-400">Loading…</p>
          ) : members.length === 0 ? (
            <p className="p-4 text-sm text-slate-400">No active members.</p>
          ) : (
            <div>
              {members.map((member) => {
                const memberIsOwner = member.role === "site_owner";
                const isSelf = member.userId === currentUserId;
                const canManage = isOwner || member.role !== "site_admin";
                return (
                  <div key={member.userId} className="border-b border-slate-800 p-4">
                    <p className="text-sm font-semibold text-slate-200">
                      {member.fullName || member.email || "Vorta user"}{memberIsOwner ? " · Site Owner" : ""}{isSelf ? " · You" : ""}
                    </p>
                    <p className="mt-1 text-sm text-slate-400">{member.email || "No email"}</p>
                    <div className="mt-3 grid gap-2">
                      {memberIsOwner ? (
                        <span className="text-sm text-slate-300">Site Admin</span>
                      ) : (
                        <select
                          className={fieldClass}
                          style={pageStyle}
                          aria-label={`Role for ${member.fullName || member.email || "member"}`}
                          value={member.portalRole || member.role}
                          disabled={working || !canManage}
                          onChange={(e) => void act({ action: "change_role", targetUserId: member.userId, role: e.target.value })}
                        >
                          {assignableRoles.map((role) => <option key={role} value={role}>{roleLabel(role)}</option>)}
                        </select>
                      )}
                      {isOwner && !memberIsOwner && !isSelf && <button type="button" disabled={working} onClick={() => void transfer(member)} className="h-10 border border-slate-700 px-3 text-sm text-slate-300">Transfer ownership</button>}
                      {!memberIsOwner && !isSelf && canManage && <button type="button" disabled={working} onClick={() => void act({ action: "deactivate", targetUserId: member.userId })} className="h-10 border border-slate-700 px-3 text-sm text-red-400">Deactivate</button>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {Boolean(data?.invitations.length) && (
          <section className="mt-6 border border-slate-800 p-4" style={panelStyle}>
            <h2 className="font-semibold text-white">Pending invitations</h2>
            {data?.invitations.map((invitation) => (
              <div key={invitation.id} className="mt-3 border-t border-slate-800 pt-3">
                <p className="text-sm text-slate-300">{invitation.full_name || invitation.email} · {roleLabel(invitation.app_role)}</p>
                <button type="button" disabled={working} onClick={() => void act({ action: "cancel_invite", invitationId: invitation.id })} className="mt-2 text-sm text-slate-400">Cancel</button>
              </div>
            ))}
          </section>
        )}

        <p className="mt-5 text-sm text-slate-500">Administration changes are recorded in the site audit log.</p>
      </main>
    </div>
  );
}
