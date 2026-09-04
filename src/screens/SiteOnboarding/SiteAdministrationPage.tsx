import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Crown,
  Mail,
  RefreshCw,
  ShieldCheck,
  UserMinus,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { Link } from "react-router-dom";
import { VortaLogo } from "../../components/VortaLogo";
import { useAuth } from "../../lib/auth";
import { supabase } from "../../lib/supabaseClient";

type Member = {
  userId: string;
  email: string | null;
  fullName: string | null;
  jobTitle: string | null;
  role: string;
  portalRole?: string;
  active: boolean;
  isDefault: boolean;
  createdAt: string;
};

type Invitation = {
  id: string;
  email: string;
  full_name: string | null;
  app_role: string;
  status: string;
  expires_at: string;
  created_at: string;
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

const roleLabel = (role: string): string => {
  if (role === "site_owner") return "Site Owner";
  return ROLES.find(([value]) => value === role)?.[1] ?? role.replaceAll("_", " ");
};

export function SiteAdministrationPage(): JSX.Element {
  const { session, siteContext } = useAuth();
  const [data, setData] = useState<AdminPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [inviteName, setInviteName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("engineer");

  const siteId = siteContext?.siteId ?? null;
  const currentUserId = session?.user.id ?? null;
  const isOwner = data?.callerRole === "site_owner";

  const invoke = useCallback(
    async (body: Record<string, unknown>) => {
      if (!siteId) throw new Error("No active Vorta site is available.");
      const { data: result, error: functionError } = await supabase.functions.invoke(
        "site-user-admin",
        { body: { ...body, siteId } },
      );
      if (functionError) throw functionError;
      if (result?.error) throw new Error(String(result.error));
      return result;
    },
    [siteId],
  );

  const load = useCallback(async (): Promise<void> => {
    if (!siteId) return;
    setLoading(true);
    setError(null);
    try {
      const result = (await invoke({ action: "list" })) as AdminPayload;
      setData(result);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Site administration could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [invoke, siteId]);

  useEffect(() => {
    void load();
  }, [load]);

  const activeMembers = useMemo(
    () => data?.members.filter((member) => member.active) ?? [],
    [data],
  );

  const runAction = async (
    body: Record<string, unknown>,
    success: string,
  ): Promise<void> => {
    if (working) return;
    setWorking(true);
    setError(null);
    setNotice(null);
    try {
      await invoke(body);
      setNotice(success);
      await load();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "The administration change could not be completed.");
    } finally {
      setWorking(false);
    }
  };

  const submitInvite = async (event: React.FormEvent): Promise<void> => {
    event.preventDefault();
    if (!inviteEmail.trim()) return;
    await runAction(
      {
        action: "invite",
        email: inviteEmail.trim(),
        fullName: inviteName.trim() || null,
        role: inviteRole,
      },
      "Invitation sent or existing Vorta account added to this site.",
    );
    setInviteName("");
    setInviteEmail("");
    setInviteRole("engineer");
  };

  const transferOwnership = async (member: Member): Promise<void> => {
    const accepted = window.confirm(
      `Transfer Site Owner authority to ${member.fullName || member.email || "this user"}? You will remain a Site Admin.`,
    );
    if (!accepted) return;
    await runAction(
      { action: "transfer_owner", targetUserId: member.userId },
      "Site ownership transferred successfully.",
    );
  };

  const fieldClass = "h-10 rounded-lg border border-slate-700 bg-[#0b0e14] px-3 text-sm text-slate-200 outline-none focus:border-blue-500/60 focus:ring-1 focus:ring-blue-500/30 disabled:opacity-60";

  return (
    <div className="min-h-screen bg-[#0b0e14] text-slate-100">
      <header className="flex h-16 items-center justify-between border-b border-slate-800 px-4 sm:px-6 lg:px-10">
        <VortaLogo />
        <Link to="/dashboard" className="inline-flex items-center gap-2 text-sm font-medium text-slate-400 hover:text-white">
          <ArrowLeft className="h-4 w-4" /> Back to Vorta
        </Link>
      </header>

      <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-blue-400">
              <ShieldCheck className="h-4 w-4" /> Site administration
            </div>
            <h1 className="mt-2 text-3xl font-semibold text-white">People & access</h1>
            <p className="mt-2 text-sm text-slate-400">
              Invite the site team, assign Vorta roles and manage access without Vorta support.
            </p>
          </div>
          <button type="button" onClick={() => void load()} disabled={loading || working} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-slate-700 px-4 text-sm font-semibold text-slate-300 hover:bg-white/[0.04] disabled:opacity-50">
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Refresh
          </button>
        </div>

        {notice && <div className="mt-6 rounded-xl border border-emerald-500/20 bg-emerald-500/[0.06] px-4 py-3 text-sm text-emerald-300">{notice}</div>}
        {error && <div className="mt-6 rounded-xl border border-red-500/20 bg-red-500/[0.06] px-4 py-3 text-sm text-red-300">{error}</div>}

        <section className="mt-8 rounded-2xl border border-slate-800 bg-[#11151d] p-5 sm:p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-blue-500/20 bg-blue-500/[0.08]"><UserPlus className="h-5 w-5 text-blue-400" /></div>
            <div><h2 className="font-semibold text-white">Invite a team member</h2><p className="text-xs text-slate-500">They receive a secure Vorta invitation by email.</p></div>
          </div>

          <form onSubmit={submitInvite} className="mt-5 grid gap-3 lg:grid-cols-[1fr_1.4fr_1fr_auto]">
            <input className={fieldClass} value={inviteName} onChange={(e) => setInviteName(e.target.value)} placeholder="Full name" disabled={working} />
            <input className={fieldClass} type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="Work email" required disabled={working} />
            <select className={fieldClass} value={inviteRole} onChange={(e) => setInviteRole(e.target.value)} disabled={working}>
              {ROLES.filter(([role]) => isOwner || role !== "site_admin").map(([role, label]) => <option key={role} value={role}>{label}</option>)}
            </select>
            <button type="submit" disabled={working || !inviteEmail.trim()} className="h-10 rounded-lg bg-blue-600 px-5 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50">Invite</button>
          </form>
        </section>

        <section className="mt-6 overflow-hidden rounded-2xl border border-slate-800 bg-[#11151d]">
          <div className="flex items-center justify-between border-b border-slate-800 px-5 py-4 sm:px-6">
            <div className="flex items-center gap-2"><Users className="h-5 w-5 text-slate-400" /><h2 className="font-semibold text-white">Site members</h2></div>
            <span className="text-xs text-slate-500">{activeMembers.length} active</span>
          </div>

          {loading ? (
            <div className="flex min-h-40 items-center justify-center"><RefreshCw className="h-5 w-5 animate-spin text-blue-400" /></div>
          ) : (
            <div className="divide-y divide-slate-800">
              {activeMembers.map((member) => {
                const memberIsOwner = member.role === "site_owner";
                const canManageAdmin = isOwner || member.role !== "site_admin";
                const isSelf = member.userId === currentUserId;
                return (
                  <div key={member.userId} className="grid gap-4 px-5 py-4 sm:px-6 lg:grid-cols-[1.5fr_1fr_auto] lg:items-center">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-sm font-semibold text-slate-100">{member.fullName || member.email || "Vorta user"}</p>
                        {memberIsOwner && <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/25 bg-amber-500/[0.08] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-300"><Crown className="h-3 w-3" /> Site Owner</span>}
                        {isSelf && <span className="text-[10px] font-medium text-slate-500">You</span>}
                      </div>
                      <div className="mt-1 flex items-center gap-1.5 text-xs text-slate-500"><Mail className="h-3.5 w-3.5" />{member.email || "No email available"}</div>
                    </div>

                    {memberIsOwner ? (
                      <div className="text-sm font-medium text-slate-300">Site Owner · Site Admin</div>
                    ) : (
                      <select
                        aria-label={`Role for ${member.fullName || member.email || "member"}`}
                        className={fieldClass}
                        value={member.portalRole || member.role}
                        disabled={working || !canManageAdmin}
                        onChange={(e) => void runAction({ action: "change_role", targetUserId: member.userId, role: e.target.value }, "User role updated.")}
                      >
                        {ROLES.filter(([role]) => isOwner || role !== "site_admin").map(([role, label]) => <option key={role} value={role}>{label}</option>)}
                      </select>
                    )}

                    <div className="flex flex-wrap gap-2 lg:justify-end">
                      {isOwner && !memberIsOwner && !isSelf && (
                        <button type="button" onClick={() => void transferOwnership(member)} disabled={working} className="h-9 rounded-lg border border-amber-500/25 px-3 text-xs font-semibold text-amber-300 hover:bg-amber-500/[0.07] disabled:opacity-50">Transfer ownership</button>
                      )}
                      {!memberIsOwner && !isSelf && canManageAdmin && (
                        <button type="button" onClick={() => void runAction({ action: "deactivate", targetUserId: member.userId }, "User access deactivated.")} disabled={working} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-red-500/20 px-3 text-xs font-semibold text-red-300 hover:bg-red-500/[0.06] disabled:opacity-50"><UserMinus className="h-3.5 w-3.5" /> Deactivate</button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {(data?.invitations.length ?? 0) > 0 && (
          <section className="mt-6 overflow-hidden rounded-2xl border border-slate-800 bg-[#11151d]">
            <div className="border-b border-slate-800 px-5 py-4 sm:px-6"><h2 className="font-semibold text-white">Pending invitations</h2></div>
            <div className="divide-y divide-slate-800">
              {data?.invitations.map((invitation) => (
                <div key={invitation.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                  <div><p className="text-sm font-medium text-slate-200">{invitation.full_name || invitation.email}</p><p className="mt-1 text-xs text-slate-500">{invitation.email} · {roleLabel(invitation.app_role)}</p></div>
                  <button type="button" onClick={() => void runAction({ action: "cancel_invite", invitationId: invitation.id }, "Invitation cancelled.")} disabled={working} className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-slate-700 px-3 text-xs font-semibold text-slate-400 hover:text-white disabled:opacity-50"><X className="h-3.5 w-3.5" /> Cancel</button>
                </div>
              ))}
            </div>
          </section>
        )}

        <div className="mt-6 rounded-xl border border-slate-800 bg-[#0f131a] px-4 py-3 text-xs leading-5 text-slate-500">
          Every invitation, role change, deactivation and ownership transfer is recorded in the Vorta site administration audit log.
        </div>
      </main>
    </div>
  );
}
