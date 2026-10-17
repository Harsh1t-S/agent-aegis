import { useState } from 'react';
import { ExternalLink, Loader2 } from 'lucide-react';
import { buttonPrimary } from '@/lib/ui';
import { AsyncBoundary } from '@/components/AsyncState';
import { PageHeader } from '@/components/PageHeader';
import { SystemLabel } from '@/components/SystemLabel';
import { useToast } from '@/components/Toaster';
import { useResource } from '@/hooks/useResource';
import { api, ApiError } from '@/lib/api';
import { openRazorpayCheckout } from '@/lib/razorpay';
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
      if (action === 'portal') {
        const result = await api.billingPortal();
        window.location.assign(result.url);
      } else {
        const order = await api.checkout(action);
        const payment = await openRazorpayCheckout(order);
        await api.verifyPayment(action, payment);
        toast.success('Payment verified', `The ${action} plan is active for 30 days.`);
        await billing.reload();
        setBusy(null);
      }
    } catch (cause) {
      toast.error('Billing could not open', cause instanceof ApiError ? cause.message : 'Try again.');
      setBusy(null);
    }
  };

  const data = billing.data;
  const percent = data ? Math.min((data.used + data.reserved) / Math.max(data.included, 1) * 100, 100) : 0;

  return (
    <>
        <PageHeader
          crumbs={[{ label: 'Workspace' }, { label: 'Billing' }]}
          title="Billing"
          description="Scenario credits and model spend for this organization, and the plan that sets them."
        />
        <AsyncBoundary loading={billing.loading} error={billing.error} onRetry={billing.reload} label="Loading billing">
          {data && (
            <>
              <div className="mt-8 grid gap-5 lg:grid-cols-4">
                <section className="border border-bone-600/30 bg-ink-900 p-4 sm:p-6 lg:col-span-2">
                  <div className="flex items-end justify-between gap-4">
                    <div>
                      <SystemLabel>Scenario credits</SystemLabel>
                      <p className="mt-3 font-mono text-3xl text-bone-50">{data.used + data.reserved} / {data.included}</p>
                    </div>
                    <p className="font-mono text-sm text-bone-300">{data.remaining} remaining</p>
                  </div>
                  <div className="mt-5 h-2 bg-ink-950">
                    <div className="h-full bg-signal-500" style={{ width: `${percent}%` }} />
                  </div>
                  <p className="mt-3 text-sm text-bone-300">
                    {data.used} settled · {data.reserved} reserved by queued evaluations
                  </p>
                </section>
                <section className="border border-bone-600/30 bg-ink-900 p-4 sm:p-6">
                  <h2 className="font-display text-lg font-semibold text-bone-50">Current plan</h2>
                  <p className="massive mt-3 text-3xl text-signal-400">{data.plan.name}</p>
                  <p className="mt-2 font-mono text-sm text-bone-300">{data.subscriptionStatus.replace(/_/g, ' ')}</p>
                  {data.customerConfigured && data.billingMode === 'subscription' && canManage && (
                    <button type="button" onClick={() => void redirect('portal')} disabled={busy !== null}
                      className="mt-5 flex min-h-10 items-center gap-2 font-mono text-xs tracking-wider text-signal-300">
                      {busy === 'portal' ? <Loader2 className="h-4 w-4 animate-spin" /> : <ExternalLink className="h-4 w-4" />}
                      Manage subscription
                    </button>
                  )}
                  {data.customerConfigured && data.billingMode === 'one_time' && (
                    <p className="mt-5 font-mono text-sm tracking-wider text-flux-300">
                      Access through {new Date(data.periodEnd).toLocaleDateString()}
                    </p>
                  )}
                </section>
                <section className="border border-bone-600/30 bg-ink-900 p-4 sm:p-6">
                  <h2 className="font-display text-lg font-semibold text-bone-50">Model spend cap</h2>
                  <p className="mt-3 font-mono text-2xl text-bone-50">
                    ${(data.estimatedCostUsd + data.reservedCostUsd).toFixed(2)} / ${data.spendCapUsd.toFixed(2)}
                  </p>
                  <p className="mt-2 text-sm leading-relaxed text-bone-300">
                    ${data.estimatedCostUsd.toFixed(4)} settled · ${data.reservedCostUsd.toFixed(4)} reserved. Provider cost is estimated from configured rates.
                  </p>
                </section>
              </div>

              <div className="mt-6 grid gap-5 md:grid-cols-2">
                {data.plans.map((plan) => {
                  const active = plan.key === data.plan.key;
                  return (
                  <section key={plan.key}
                    aria-current={active ? 'true' : undefined}
                    className={`relative p-6 ${active
                      ? 'border-2 border-bone-50 bg-ink-900/80'
                      : 'border border-bone-600/20 bg-ink-900/50'}`}>
                    <div className="flex items-start justify-between gap-3">
                      <SystemLabel className={active ? 'text-bone-100' : ''}>{plan.name}</SystemLabel>
                      {active && (
                        <span className="bg-bone-50 px-2 py-0.5 font-mono text-xs font-bold tracking-wider text-ink-950">
                          Current plan
                        </span>
                      )}
                    </div>
                    <p className="mt-3 font-mono text-xl text-signal-300">
                      {plan.monthly_price_inr ? `₹${plan.monthly_price_inr.toLocaleString('en-IN')} / month` : 'Pilot access'}
                    </p>
                    <p className="mt-3 font-mono text-2xl text-bone-50">{plan.monthly_scenario_credits.toLocaleString()} scenarios</p>
                    <p className="mt-3 text-sm text-bone-400">
                      {plan.concurrency} concurrent · {plan.members} members · {plan.retention_days}-day retention
                    </p>
                    {canManage && (
                      <button type="button" disabled={busy !== null || data.customerConfigured
                        || !data.checkoutAvailable || !plan.available}
                        onClick={() => void redirect(data.customerConfigured
                          ? 'portal'
                          : plan.key as 'starter' | 'team')}
                        className={`${buttonPrimary} mt-6 w-full`}>
                        {busy === plan.key || (busy === 'portal' && data.customerConfigured)
                          ? 'OPENING…'
                          : data.customerConfigured
                            ? plan.key === data.plan.key ? 'Current plan' : 'Plan active'
                            : 'Select plan'}
                      </button>
                    )}
                  </section>
                  );
                })}
              </div>
              {!data.checkoutAvailable && (
                <p className="mt-5 border border-warn-500/30 p-4 text-sm text-warn-400">
                  Checkout remains disabled until Razorpay plans and webhook signing are configured.
                </p>
              )}
            </>
          )}
        </AsyncBoundary>
    </>
  );
}
