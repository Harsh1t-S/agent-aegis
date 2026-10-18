import { useState, type FormEvent } from 'react';
import { Building2, Copy, Loader2, Trash2, UserPlus } from 'lucide-react';
import { buttonPrimary, buttonSecondary, card } from '@/lib/ui';
import { PageHeader } from '@/components/PageHeader';
import { AsyncBoundary } from '@/components/AsyncState';
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
    <>
        <PageHeader
          crumbs={[{ label: 'Workspace' }, { label: 'Team' }]}
          title="Team"
          description="Members inherit access to this organization’s workspaces. Roles are enforced by the API."
          actions={canManage && (
            <button type="button" className={buttonPrimary}
              onClick={() => {
                const field = document.getElementById('invite-email');
                field?.scrollIntoView({ block: 'center' });
                field?.focus();
              }}>
              <UserPlus className="h-4 w-4" aria-hidden /> Invite teammate
            </button>
          )}
        />

        {canManage && (
          <form onSubmit={invite} className={`mb-6 ${card}`}>
            <h2 className="font-display text-lg font-semibold text-bone-50">Invite a teammate</h2>
            <div className="mt-4 grid gap-4 md:grid-cols-[1fr_12rem_auto] md:items-end">
              <div>
                <label className="mb-2 block text-sm font-medium text-bone-100" htmlFor="invite-email">Email address</label>
                <input id="invite-email" type="email" required value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="teammate@company.com"
                  className="min-h-11 w-full border border-bone-600/40 bg-ink-950 px-3 text-sm text-bone-50 placeholder:text-bone-500 focus-visible:border-signal-400" />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-bone-100" htmlFor="invite-role">Role</label>
                <select id="invite-role" value={role}
                  onChange={(event) => setRole(event.target.value as typeof role)}
                  className="min-h-11 w-full border border-bone-600/40 bg-ink-950 px-3 text-sm text-bone-50 placeholder:text-bone-500 focus-visible:border-signal-400">
                  <option value="admin">Admin</option>
                  <option value="member">Member</option>
                  <option value="viewer">Viewer</option>
                </select>
              </div>
              <button type="submit" disabled={busy} className={buttonSecondary}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <UserPlus className="h-4 w-4" aria-hidden />}
                Send invite
              </button>
            </div>
          </form>
        )}

        {canManage && (
          <form className={`mb-6 ${card}`}
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
            <h2 className="font-display text-lg font-semibold text-bone-50">Create a workspace</h2>
            <div className="mt-4 flex flex-col gap-3 sm:flex-row">
              <label className="sr-only" htmlFor="workspace-name">Workspace name</label>
                          <input id="workspace-name" required maxLength={120} value={workspaceName}
              onChange={(event) => setWorkspaceName(event.target.value)}
              placeholder="New workspace name"
              className="min-h-11 w-full border border-bone-600/40 bg-ink-950 px-3 text-sm text-bone-50 placeholder:text-bone-500 focus-visible:border-signal-400 sm:flex-1" />
            <button type="submit" disabled={creatingWorkspace}
              className={buttonSecondary}>
              {creatingWorkspace ? <Loader2 className="h-4 w-4 animate-spin" /> : <Building2 className="h-4 w-4" />} New workspace
            </button>
            </div>
          </form>
        )}

        {inviteUrl && (
          <div className="mb-6 flex flex-col gap-3 border border-flux-500/40 bg-flux-500/5 p-4 sm:flex-row sm:items-center">
            <code className="min-w-0 flex-1 break-all text-sm text-flux-300">{inviteUrl}</code>
            <button type="button" onClick={() => {
              void navigator.clipboard.writeText(inviteUrl);
              toast.success('Copied', 'Invitation link copied to your clipboard.');
            }} className={buttonSecondary}>
              <Copy className="h-3.5 w-3.5" />Copy link
            </button>
          </div>
        )}

        <section className="mb-6 border border-bone-600/30 bg-ink-900">
          <div className="border-b border-bone-600/25 p-4 sm:p-6">
            <h2 className="font-display text-lg font-semibold text-bone-50">Members</h2>
          </div>
          <AsyncBoundary loading={members.loading} error={members.error} onRetry={members.reload} label="Loading members">
            <div className="divide-y divide-bone-600/25">
              {(members.data ?? []).map((member) => (
                <div key={member.id} className="flex flex-col gap-2 p-4 sm:p-6 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-medium text-bone-50">{member.displayName || member.email || member.id}</p>
                    {member.displayName && <p className="mt-1 text-sm text-bone-300">{member.email}</p>}
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
                        className="min-h-11 border border-bone-600/40 bg-ink-950 px-2 text-sm text-bone-100">
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
                          className="flex h-11 w-11 items-center justify-center text-bone-300 hover:text-fault-400">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  ) : (
                    <span className="w-fit border border-bone-600/40 px-2 py-1 text-sm capitalize text-bone-200">
                      {member.role}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </AsyncBoundary>
        </section>

        {canManage && (
          <section className="border border-bone-600/30 bg-ink-900">
            <div className="border-b border-bone-600/25 p-4 sm:p-6">
              <h2 className="font-display text-lg font-semibold text-bone-50">Pending invitations</h2>
            </div>
            <AsyncBoundary loading={invitations.loading} error={invitations.error}
              onRetry={invitations.reload} label="Loading invitations">
              <div className="divide-y divide-bone-600/25">
                {(invitations.data ?? []).map((invitation) => (
                  <div key={invitation.id} className="flex flex-col gap-3 p-4 sm:p-6 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm text-bone-100">{invitation.email}</p>
                      <p className="mt-1 text-sm text-bone-300">
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
                      className="flex min-h-11 items-center gap-2 self-start px-2 text-sm text-bone-300 hover:text-fault-300 sm:self-auto">
                      <Trash2 className="h-4 w-4" />Revoke
                    </button>
                  </div>
                ))}
                {invitations.data?.length === 0 && (
                  <p className="p-5 text-sm text-bone-300">No pending invitations.</p>
                )}
              </div>
            </AsyncBoundary>
          </section>
        )}
    </>
  );
}
