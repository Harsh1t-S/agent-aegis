import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Check, Loader2, TriangleAlert } from 'lucide-react';
import { ScrollReveal } from '@/components/ScrollReveal';
import { SiteFooter } from '@/components/SiteNav';
import { Accent, Glow, PageHero } from '@/components/SiteSection';
import { useAuth } from '@/contexts/AuthContext';
import { api, ApiError } from '@/lib/api';
import { openRazorpayCheckout } from '@/lib/razorpay';
import { useResource } from '@/hooks/useResource';
import { buttonPrimary, ctaSecondary, noticeError, siteCard } from '@/lib/ui';

const plans = [
  {
    key: 'starter' as const,
    name: 'Starter',
    price: '₹1,999',
    credits: '500 scenarios a month',
    description: 'For one team proving a support agent before release.',
    features: ['Private workspace', '2 concurrent scenarios', '90-day trace history', 'CI release gate', 'API keys and audit log', '3 team members'],
  },
  {
    key: 'team' as const,
    name: 'Team',
    price: '₹9,999',
    credits: '5,000 scenarios a month',
    description: 'For teams evaluating multiple agents and releases.',
    features: ['Up to 5 workspaces', '5 concurrent scenarios', 'One-year trace history', 'CI release gate', 'API keys and audit log', '20 team members'],
  },
];

export default function Pricing() {
  const auth = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const config = useResource(() => api.publicConfig(), []);

  const choose = async (plan: 'starter' | 'team') => {
    if (!auth.user) {
      navigate('/auth?next=/app/billing');
      return;
    }
    if (!config.data?.checkoutAvailable) {
      navigate('/about');
      return;
    }
    setBusy(plan);
    setError(null);
    try {
      const order = await api.checkout(plan);
      const payment = await openRazorpayCheckout(order);
      await api.verifyPayment(plan, payment);
      navigate('/app/billing');
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'Checkout could not be opened.');
    } finally {
      setBusy(null);
    }
  };

  const actionLabel = (name: string) => (
    !config.data?.checkoutAvailable ? 'Request a pilot' : auth.user ? `Choose ${name}` : 'Sign in to choose'
  );

  return (
    <div className="overflow-hidden bg-ink-950 text-bone-100">
      <PageHero
        center
        eyebrow="Pricing"
        title={<>Pay for <Accent>evidence.</Accent></>}
        lead="Start with a bounded design-partner pilot. Every plan includes private evidence, scoped usage, and a release gate you can explain to your team."
      />

      <section className="relative isolate px-5 pb-24 sm:px-8 lg:px-12">
        <Glow at="top" />
        <div className="mx-auto max-w-5xl">
          <ScrollReveal>
            <div className="flex flex-col gap-5 border border-signal-500/35 bg-signal-500/[0.06] p-6 sm:flex-row sm:items-center sm:justify-between sm:p-7">
              <div>
                <p className="text-sm font-medium text-signal-300">Pilot trial · Free</p>
                <p className="mt-1 font-display text-2xl font-semibold text-bone-50">Start with 60 scenario credits.</p>
                <p className="mt-1 text-base text-bone-300">One workspace and 14 days of trace history. No card needed.</p>
              </div>
              <Link to="/auth?mode=signup&next=/app/agents/new" className={`${ctaSecondary} shrink-0`}>
                Start free <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
            </div>
          </ScrollReveal>

          <div className="mt-5 grid gap-5 md:grid-cols-2">
            {plans.map((plan, index) => (
              <ScrollReveal key={plan.key} delay={index * 0.08} className="h-full">
                <section className={`flex h-full flex-col ${siteCard}`}>
                  <h2 className="text-sm font-medium text-signal-300">{plan.name}</h2>
                  <p className="mt-3 flex items-baseline gap-2">
                    <span className="font-display text-5xl font-bold tracking-tightest text-bone-50">{plan.price}</span>
                    <span className="text-base text-bone-300">/ month</span>
                  </p>
                  <p className="mt-4 font-display text-xl font-semibold text-bone-50">{plan.credits}</p>
                  <p className="mt-2 text-base leading-relaxed text-bone-300">{plan.description}</p>
                  <ul className="mt-6 space-y-3 border-t border-bone-600/25 pt-6">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex items-center gap-3 text-base text-bone-200">
                        <Check className="h-4 w-4 shrink-0 text-flux-400" aria-hidden /> {feature}
                      </li>
                    ))}
                  </ul>
                  <div className="mt-auto pt-8">
                    <button
                      type="button"
                      onClick={() => void choose(plan.key)}
                      disabled={busy !== null || config.loading}
                      className={`${buttonPrimary} min-h-12 w-full text-base`}
                    >
                      {busy === plan.key && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
                      {busy === plan.key ? 'Opening checkout…' : actionLabel(plan.name)}
                    </button>
                  </div>
                </section>
              </ScrollReveal>
            ))}
          </div>

          {error && (
            <p role="alert" className={`mx-auto mt-6 max-w-2xl ${noticeError}`}>
              <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden /> {error}
            </p>
          )}
          <p className="mt-10 text-center text-base text-bone-300">
            Need a hands-on pilot?{' '}
            <Link to="/about" className="text-signal-300 hover:text-signal-200 hover:underline">See what a pilot includes</Link>
          </p>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
