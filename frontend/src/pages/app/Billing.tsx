import { useState } from 'react';
import { ExternalLink, Loader2 } from 'lucide-react';
import { AppNavigation } from '@/components/AppNavigation';
import { AsyncBoundary } from '@/components/AsyncState';
import { SystemLabel } from '@/components/SystemLabel';
import { useToast } from '@/components/Toaster';
import { useResource } from '@/hooks/useResource';
import { api, ApiError } from '@/lib/api';
import { useWorkspace } from '@/contexts/WorkspaceContext';

export default function Billing() {
  const workspace = useWorkspace();
  const billing = useResource(() => api.billing(), [workspace.current?.id]);
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const canManage = workspace.current?.role === 'owner';

  const redirect = async (action: 'portal' | 'starter' | 'team') => {
    setBusy(action);
    try {
      const result = action === 'portal'
        ? await api.billingPortal()
        : await api.checkout(action);
      window.location.assign(result.url);
    } catch (cause) {
      toast.error('Billing could not open', cause instanceof ApiError ? cause.message : 'Try again.');
      setBusy(null);
    }
  };

  const data = billing.data;
  const percent = data ? Math.min((data.used + data.reserved) / Math.max(data.included, 1) * 100, 100) : 0;

  return (
    <div className="min-h-screen bg-ink-950">
      <AppNavigation />
      <main className="px-4 py-8 sm:px-6 md:px-10">
        <SystemLabel>WORKSPACE / BILLING</SystemLabel>
        <h1 className="massive mt-2 text-[clamp(2.5rem,6vw,4.5rem)] text-bone-50">USAGE & PLAN.</h1>
        <AsyncBoundary loading={billing.loading} error={billing.error} onRetry={billing.reload} label="LOADING BILLING">
          {data && (
            <>
              <div className="mt-10 grid gap-5 lg:grid-cols-4">
                <section className="border border-bone-600/20 bg-ink-900/60 p-6 lg:col-span-2">
                  <div className="flex items-end justify-between gap-4">
                    <div>
                      <SystemLabel>SCENARIO CREDITS</SystemLabel>
                      <p className="mt-3 font-mono text-3xl text-bone-50">{data.used + data.reserved} / {data.included}</p>
                    </div>
                    <p className="font-mono text-xs text-bone-500">{data.remaining} remaining</p>
                  </div>
                  <div className="mt-5 h-2 bg-ink-950">
                    <div className="h-full bg-signal-500" style={{ width: `${percent}%` }} />
                  </div>
                  <p className="mt-3 text-xs text-bone-500">
                    {data.used} settled · {data.reserved} reserved by queued evaluations
                  </p>
                </section>
                <section className="border border-bone-600/20 bg-ink-900/60 p-6">
                  <SystemLabel>CURRENT PLAN</SystemLabel>
                  <p className="massive mt-3 text-3xl text-signal-400">{data.plan.name}</p>
                  <p className="mt-2 font-mono text-xs uppercase text-bone-500">{data.subscriptionStatus}</p>
                  {data.customerConfigured && canManage && (
                    <button type="button" onClick={() => void redirect('portal')} disabled={busy !== null}
                      className="mt-5 flex min-h-10 items-center gap-2 font-mono text-[10px] uppercase tracking-wider text-signal-300">
                      {busy === 'portal' ? <Loader2 className="h-4 w-4 animate-spin" /> : <ExternalLink className="h-4 w-4" />}
                      MANAGE SUBSCRIPTION
                    </button>
                  )}
                </section>
                <section className="border border-bone-600/20 bg-ink-900/60 p-6">
                  <SystemLabel>MODEL SPEND CAP</SystemLabel>
                  <p className="mt-3 font-mono text-2xl text-bone-50">
                    ${(data.estimatedCostUsd + data.reservedCostUsd).toFixed(2)} / ${data.spendCapUsd.toFixed(2)}
                  </p>
                  <p className="mt-2 text-xs leading-relaxed text-bone-500">
                    ${data.estimatedCostUsd.toFixed(4)} settled · ${data.reservedCostUsd.toFixed(4)} reserved. Provider cost is estimated from configured rates.
                  </p>
                </section>
              </div>

              <div className="mt-6 grid gap-5 md:grid-cols-2">
                {data.plans.map((plan) => (
                  <section key={plan.key} className="border border-bone-600/20 bg-ink-900/50 p-6">
                    <SystemLabel>{plan.name}</SystemLabel>
                    <p className="mt-3 font-mono text-2xl text-bone-50">{plan.monthly_scenario_credits.toLocaleString()} scenarios</p>
                    <p className="mt-3 text-sm text-bone-400">
                      {plan.concurrency} concurrent · {plan.members} members · {plan.retention_days}-day retention
                    </p>
                    {canManage && (
                      <button type="button" disabled={busy !== null || (!data.customerConfigured
                        && (!data.checkoutAvailable || !plan.available))}
                        onClick={() => void redirect(data.customerConfigured
                          ? 'portal'
                          : plan.key as 'starter' | 'team')}
                        className="mt-6 min-h-11 w-full border border-signal-500/40 bg-signal-500/10 font-mono text-[11px] uppercase tracking-wider text-signal-300 disabled:opacity-40">
                        {busy === plan.key || (busy === 'portal' && data.customerConfigured)
                          ? 'OPENING…'
                          : data.customerConfigured ? 'CHANGE IN PORTAL' : 'SELECT PLAN'}
                      </button>
                    )}
                  </section>
                ))}
              </div>
              {!data.checkoutAvailable && (
                <p className="mt-5 border border-warn-500/30 p-4 text-sm text-warn-400">
                  Checkout remains disabled until Razorpay plans and webhook signing are configured.
                </p>
              )}
            </>
          )}
        </AsyncBoundary>
      </main>
    </div>
  );
}
