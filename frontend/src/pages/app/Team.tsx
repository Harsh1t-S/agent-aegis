import { useState, type FormEvent } from 'react';
import { Building2, Copy, Loader2, Trash2, UserPlus } from 'lucide-react';
import { AppNavigation } from '@/components/AppNavigation';
import { AsyncBoundary } from '@/components/AsyncState';
import { SystemLabel } from '@/components/SystemLabel';
import { useToast } from '@/components/Toaster';
import { useResource } from '@/hooks/useResource';
import { api, ApiError } from '@/lib/api';
import { useWorkspace } from '@/contexts/WorkspaceContext';

export default function Team() {
  const workspace = useWorkspace();
  const canManage = workspace.current?.role === 'owner' || workspace.current?.role === 'admin';
  const members = useResource(() => api.members(), [workspace.current?.id]);
  const invitations = useResource(
    () => api.invitations(),
    [workspace.current?.id],
    { enabled: canManage },
  );
  const toast = useToast();
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'admin' | 'member' | 'viewer'>('member');
  const [busy, setBusy] = useState(false);
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [workspaceName, setWorkspaceName] = useState('');
  const [creatingWorkspace, setCreatingWorkspace] = useState(false);

  const invite = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setInviteUrl(null);
    try {
      const result = await api.invite(email.trim(), role);
      setInviteUrl(new URL(result.inviteUrl, window.location.origin).toString());
      setEmail('');
      invitations.reload();
      toast.success('Invitation created', 'Copy the one-time invitation link below.');
    } catch (cause) {
      toast.error('Could not invite member', cause instanceof ApiError ? cause.message : 'Try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-ink-950">
      <AppNavigation />
      <main className="px-4 py-8 sm:px-6 md:px-10">
        <SystemLabel>WORKSPACE / TEAM</SystemLabel>
        <h1 className="massive mt-2 text-[clamp(2.5rem,6vw,4.5rem)] text-bone-50">PEOPLE & ACCESS.</h1>
        <p className="mt-4 max-w-2xl text-sm leading-relaxed text-bone-400">
          Members inherit access to this organization’s workspaces. Roles are enforced by the API.
        </p>

        {canManage && (
          <form className="mt-8 flex max-w-2xl flex-col gap-3 border border-bone-600/20 bg-ink-900/40 p-5 sm:flex-row"
            onSubmit={async (event) => {
              event.preventDefault();
              setCreatingWorkspace(true);
              try {
                const created = await workspace.create(workspaceName.trim());
                setWorkspaceName('');
                toast.success(`${created.name} created`, 'It is now the active workspace.');
                window.location.assign('/app');
              } catch (cause) {
                toast.error('Workspace not created', cause instanceof ApiError ? cause.message : 'Try again.');
              } finally {
                setCreatingWorkspace(false);
              }
            }}>
            <input required maxLength={120} value={workspaceName}
              onChange={(event) => setWorkspaceName(event.target.value)}
              placeholder="New workspace name"
              className="min-h-11 flex-1 border border-bone-600/35 bg-ink-950 px-4 text-sm text-bone-50 outline-none focus:border-signal-400" />
            <button type="submit" disabled={creatingWorkspace}
              className="flex min-h-11 items-center justify-center gap-2 border border-bone-600/35 px-5 font-mono text-[11px] uppercase tracking-wider text-bone-300 disabled:opacity-50">
              {creatingWorkspace ? <Loader2 className="h-4 w-4 animate-spin" /> : <Building2 className="h-4 w-4" />} NEW WORKSPACE
            </button>
          </form>
        )}

        {canManage && (
          <form onSubmit={invite} className="mt-10 grid gap-3 border border-bone-600/20 bg-ink-900/60 p-5 md:grid-cols-[1fr_160px_auto]">
            <label className="sr-only" htmlFor="invite-email">Email address</label>
            <input id="invite-email" type="email" required value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="teammate@company.com"
              className="min-h-11 border border-bone-600/35 bg-ink-950 px-4 text-sm text-bone-50 outline-none focus:border-signal-400" />
            <label className="sr-only" htmlFor="invite-role">Role</label>
            <select id="invite-role" value={role}
              onChange={(event) => setRole(event.target.value as typeof role)}
              className="min-h-11 border border-bone-600/35 bg-ink-950 px-3 font-mono text-xs text-bone-200">
              <option value="admin">Admin</option>
              <option value="member">Member</option>
              <option value="viewer">Viewer</option>
            </select>
            <button type="submit" disabled={busy}
              className="flex min-h-11 items-center justify-center gap-2 border border-signal-500/45 bg-signal-500/10 px-5 font-mono text-xs text-signal-300 disabled:opacity-50">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
              INVITE
            </button>
          </form>
        )}

        {inviteUrl && (
          <div className="mt-4 flex flex-col gap-3 border border-flux-500/30 bg-flux-500/5 p-4 sm:flex-row sm:items-center">
            <code className="min-w-0 flex-1 break-all text-xs text-flux-300">{inviteUrl}</code>
            <button type="button" onClick={() => {
              void navigator.clipboard.writeText(inviteUrl);
              toast.success('Copied', 'Invitation link copied to your clipboard.');
            }} className="flex min-h-10 items-center justify-center gap-2 border border-flux-500/30 px-4 font-mono text-[10px] text-flux-300">
              <Copy className="h-3.5 w-3.5" /> COPY LINK
            </button>
          </div>
        )}

        <section className="mt-8 border border-bone-600/20 bg-ink-900/50">
          <AsyncBoundary loading={members.loading} error={members.error} onRetry={members.reload} label="LOADING MEMBERS">
            <div className="divide-y divide-bone-600/15">
              {(members.data ?? []).map((member) => (
                <div key={member.id} className="flex flex-col gap-2 p-5 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm text-bone-100">{member.displayName || member.email || member.id}</p>
                    {member.displayName && <p className="mt-1 text-xs text-bone-500">{member.email}</p>}
                  </div>
                  {canManage && member.role !== 'owner'
                    && (workspace.current?.role === 'owner' || member.role !== 'admin') ? (
                    <div className="flex items-center gap-2">
                      <select value={member.role}
                        aria-label={`Role for ${member.email || member.id}`}
                        onChange={async (event) => {
                          try {
                            await api.updateMemberRole(member.id, event.target.value as 'admin' | 'member' | 'viewer');
                            members.reload();
                          } catch (cause) {
                            toast.error('Role not changed', cause instanceof ApiError ? cause.message : 'Try again.');
                          }
                        }}
                        className="min-h-10 border border-bone-600/30 bg-ink-950 px-2 font-mono text-[10px] uppercase text-bone-300">
                        <option value="admin">Admin</option>
                        <option value="member">Member</option>
                        <option value="viewer">Viewer</option>
                      </select>
                      {member.id !== workspace.bootstrap?.user.id && (
                        <button type="button" aria-label={`Remove ${member.email || member.id}`}
                          onClick={async () => {
                            try {
                              await api.removeMember(member.id);
                              members.reload();
                              toast.success('Member removed');
                            } catch (cause) {
                              toast.error('Member not removed', cause instanceof ApiError ? cause.message : 'Try again.');
                            }
                          }}
                          className="flex h-10 w-10 items-center justify-center text-bone-500 hover:text-fault-400">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  ) : (
                    <span className="w-fit border border-bone-600/30 px-2 py-1 font-mono text-[10px] uppercase tracking-wider text-bone-300">
                      {member.role}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </AsyncBoundary>
        </section>

        {canManage && (
          <section className="mt-8 border border-bone-600/20 bg-ink-900/50">
            <div className="border-b border-bone-600/15 p-5">
              <SystemLabel>PENDING INVITATIONS</SystemLabel>
            </div>
            <AsyncBoundary loading={invitations.loading} error={invitations.error}
              onRetry={invitations.reload} label="LOADING INVITATIONS">
              <div className="divide-y divide-bone-600/15">
                {(invitations.data ?? []).map((invitation) => (
                  <div key={invitation.id} className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm text-bone-100">{invitation.email}</p>
                      <p className="mt-1 font-mono text-[10px] uppercase text-bone-500">
                        {invitation.role} · expires {new Date(invitation.expiresAt).toLocaleDateString()}
                      </p>
                    </div>
                    <button type="button" aria-label={`Revoke invitation for ${invitation.email}`}
                      onClick={async () => {
                        try {
                          await api.revokeInvitation(invitation.id);
                          invitations.reload();
                          toast.success('Invitation revoked');
                        } catch (cause) {
                          toast.error('Invitation not revoked', cause instanceof ApiError ? cause.message : 'Try again.');
                        }
                      }}
                      className="flex min-h-10 items-center gap-2 self-start px-2 font-mono text-[10px] uppercase text-bone-500 hover:text-fault-400 sm:self-auto">
                      <Trash2 className="h-4 w-4" /> REVOKE
                    </button>
                  </div>
                ))}
                {invitations.data?.length === 0 && (
                  <p className="p-5 text-sm text-bone-500">No pending invitations.</p>
                )}
              </div>
            </AsyncBoundary>
          </section>
        )}
      </main>
    </div>
  );
}
