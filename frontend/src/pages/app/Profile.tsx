import { Link } from 'react-router-dom';
import { Check, Copy, CreditCard, KeyRound, LockKeyhole, LogOut } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { useToast } from '@/components/Toaster';
import { useAuth } from '@/contexts/AuthContext';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { buttonSecondary, card } from '@/lib/ui';

const PROVIDER_LABELS: Record<string, string> = {
  email: 'Email and password',
  google: 'Google',
  github: 'GitHub',
};

function when(iso?: string | null) {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime()) || date.getTime() === 0) return '—';
  return date.toLocaleString(undefined, {
    year: 'numeric', month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit',
  });
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1 border-b border-bone-600/25 py-4 last:border-b-0 sm:grid-cols-[180px_1fr] sm:gap-6">
      <dt className="text-sm text-bone-300">{label}</dt>
      <dd className="min-w-0 break-words text-sm text-bone-50">{children}</dd>
    </div>
  );
}

export default function Profile() {
  const auth = useAuth();
  const workspace = useWorkspace();
  const toast = useToast();
  const user = auth.user;
  const account = workspace.bootstrap?.user;
  const usage = workspace.bootstrap?.usage;
  const email = account?.email || user?.email || '';
  const name = account?.displayName || email.split('@')[0] || 'Account';
  const userId = account?.id || user?.id || '';
  const providers: string[] = (user?.app_metadata?.providers as string[] | undefined)
    ?? (user?.app_metadata?.provider ? [String(user.app_metadata.provider)] : ['email']);
  const verified = Boolean(user?.email_confirmed_at || user?.confirmed_at);
  const canAdminister = workspace.current?.role === 'owner' || workspace.current?.role === 'admin';

  const copyId = async () => {
    try {
      await navigator.clipboard.writeText(userId);
      toast.success('User ID copied');
    } catch {
      toast.error('Copy failed', 'Select the ID and copy it by hand.');
    }
  };

  return (
    <>
      <PageHeader
        crumbs={[{ label: 'Account' }, { label: 'Profile' }]}
        title="Profile"
        description="The account you sign in with and the workspaces it can open. Aegis never shows or stores your password in the dashboard."
        actions={(
          <button type="button" onClick={() => void auth.signOut()} className={buttonSecondary}>
            <LogOut className="h-4 w-4" aria-hidden /> Sign out
          </button>
        )}
      />

      <div className="grid min-w-0 gap-6 lg:grid-cols-3">
        <section className={`min-w-0 ${card} lg:col-span-2`}>
          <h2 className="font-display text-lg font-semibold text-bone-50">Sign-in details</h2>
          <dl className="mt-2">
            <Row label="Name">{name}</Row>
            <Row label="Email">
              <span className="mr-3">{email || '—'}</span>
              <span className={`inline-flex items-center gap-1 text-sm ${verified ? 'text-flux-400' : 'text-warn-400'}`}>
                {verified && <Check className="h-4 w-4" aria-hidden />}
                {verified ? 'Verified' : 'Not verified'}
              </span>
            </Row>
            <Row label="Sign-in method">
              {providers.map((provider) => PROVIDER_LABELS[provider] ?? provider).join(', ')}
            </Row>
            <Row label="User ID">
              <span className="flex flex-wrap items-center gap-3">
                <code className="break-all font-mono text-sm text-bone-200">{userId || '—'}</code>
                {userId && (
                  <button type="button" onClick={() => void copyId()} className={buttonSecondary}>
                    <Copy className="h-4 w-4" aria-hidden /> Copy
                  </button>
                )}
              </span>
            </Row>
            <Row label="Account created">{when(user?.created_at)}</Row>
            <Row label="Last sign-in">{when(user?.last_sign_in_at)}</Row>
          </dl>
        </section>

        <div className="grid min-w-0 content-start gap-6">
          <section className={card}>
            <h2 className="font-display text-lg font-semibold text-bone-50">Plan</h2>
            <p className="mt-3 font-display text-2xl font-semibold text-bone-50">{usage?.plan.name ?? '—'}</p>
            {usage && (
              <p className="mt-2 text-sm text-bone-300">
                {usage.used + usage.reserved} of {usage.included} scenario credits used this period
              </p>
            )}
            <Link to="/app/billing" className={`${buttonSecondary} mt-5 w-full`}>
              <CreditCard className="h-4 w-4" aria-hidden /> Billing
            </Link>
          </section>
          {providers.includes('email') && (
            <section className={card}>
              <h2 className="font-display text-lg font-semibold text-bone-50">Password</h2>
              <p className="mt-1 text-sm leading-relaxed text-bone-300">
                Set or change the password you sign in with.
              </p>
              <Link to="/auth/reset" className={`${buttonSecondary} mt-5 w-full`}>
                <LockKeyhole className="h-4 w-4" aria-hidden /> Change password
              </Link>
            </section>
          )}
          {canAdminister && (
            <section className={card}>
              <h2 className="font-display text-lg font-semibold text-bone-50">API keys</h2>
              <p className="mt-1 text-sm leading-relaxed text-bone-300">
                Keys for CI and scripts belong to the workspace, not to your account.
              </p>
              <Link to="/app/developer" className={`${buttonSecondary} mt-5 w-full`}>
                <KeyRound className="h-4 w-4" aria-hidden /> Manage keys
              </Link>
            </section>
          )}
        </div>

        <section className={`min-w-0 ${card} lg:col-span-3`}>
          <h2 className="font-display text-lg font-semibold text-bone-50">Workspaces</h2>
          <ul className="mt-2">
            {workspace.workspaces.map((item) => {
              const current = item.id === workspace.current?.id;
              return (
                <li key={item.id} className="flex flex-wrap items-center justify-between gap-3 border-b border-bone-600/25 py-4 last:border-b-0">
                  <div className="min-w-0">
                    <p className="break-words text-sm font-medium text-bone-50">{item.name}</p>
                    <p className="mt-0.5 text-sm capitalize text-bone-300">{item.role}</p>
                  </div>
                  {current ? (
                    <span className="text-sm font-medium text-signal-300">Current workspace</span>
                  ) : (
                    <button type="button"
                      onClick={() => { workspace.select(item.id); window.location.assign('/app'); }}
                      className={buttonSecondary}>
                      Switch
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      </div>
    </>
  );
}
