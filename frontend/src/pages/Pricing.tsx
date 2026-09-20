import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Check } from 'lucide-react';
import { SiteNav } from '@/components/SiteNav';
import { useAuth } from '@/contexts/AuthContext';
import { api, ApiError } from '@/lib/api';
import { openRazorpayCheckout } from '@/lib/razorpay';
import { useResource } from '@/hooks/useResource';

const plans = [
  {
    key: 'starter' as const,
    name: 'STARTER',
    price: '₹1,999 / month',
    credits: '500 scenarios / month',
    description: 'For one team proving a support agent before release.',
    features: ['Private workspace', '2 concurrent scenarios', '90-day trace history', 'CI release gate', '3 team members'],
  },
  {
    key: 'team' as const,
    name: 'TEAM',
    price: '₹9,999 / month',
    credits: '5,000 scenarios / month',
    description: 'For teams evaluating multiple agents and releases.',
    features: ['Up to 5 workspaces', '5 concurrent scenarios', 'One-year trace history', 'API keys and audit log', '20 team members'],
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
      await openRazorpayCheckout(order);
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'Checkout could not be opened.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="min-h-screen bg-ink-950">
      <SiteNav />
      <main className="px-5 pb-24 pt-32 sm:px-8">
        <div className="mx-auto max-w-5xl text-center">
          <p className="font-mono text-xs uppercase tracking-[0.24em] text-signal-400">PLANS</p>
          <h1 className="massive mt-4 text-[clamp(3rem,8vw,6rem)] text-bone-50">PAY FOR EVIDENCE.</h1>
          <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-bone-400">
            Start with a bounded design-partner pilot. Every plan includes private evidence,
            scoped usage, and a release gate you can explain to your team.
          </p>
        </div>
        <div className="mx-auto mt-14 grid max-w-5xl gap-5 md:grid-cols-2">
          {plans.map((plan) => (
            <section key={plan.key} className="border border-bone-600/25 bg-ink-900/70 p-7">
              <p className="font-mono text-xs tracking-[0.2em] text-signal-400">{plan.name}</p>
              <p className="mt-3 font-mono text-2xl text-bone-50">{plan.price}</p>
              <h2 className="massive mt-4 text-3xl text-bone-50">{plan.credits}</h2>
              <p className="mt-3 min-h-12 text-sm leading-relaxed text-bone-400">{plan.description}</p>
              <ul className="mt-7 space-y-3">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-center gap-3 text-sm text-bone-200">
                    <Check className="h-4 w-4 text-flux-400" /> {feature}
                  </li>
                ))}
              </ul>
              <button type="button" onClick={() => void choose(plan.key)} disabled={busy !== null || config.loading}
                className="mt-8 min-h-12 w-full border border-signal-500/45 bg-signal-500/10 font-mono text-xs uppercase tracking-wider text-signal-300 disabled:opacity-50">
                {busy === plan.key ? 'OPENING CHECKOUT…' : !config.data?.checkoutAvailable ? 'REQUEST A PILOT' : auth.user ? 'CHOOSE PLAN' : 'SIGN IN TO CHOOSE'}
              </button>
            </section>
          ))}
        </div>
        {error && <p role="alert" className="mx-auto mt-6 max-w-2xl text-center text-sm text-fault-400">{error}</p>}
        <p className="mt-10 text-center text-sm text-bone-500">
          Need a hands-on pilot? <Link to="/about" className="text-signal-400 hover:underline">See what a pilot includes</Link>.
        </p>
      </main>
    </div>
  );
}
