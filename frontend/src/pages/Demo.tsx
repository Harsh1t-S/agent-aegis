import { Link } from 'react-router-dom';
import { ArrowRight, ShieldAlert, Wrench } from 'lucide-react';
import { ExecutionTrace } from '@/components/ExecutionTrace';
import { ReliabilityScore } from '@/components/ReliabilityScore';
import { ScrollReveal } from '@/components/ScrollReveal';
import { SiteFooter } from '@/components/SiteNav';
import { Accent, ConsoleFrame, Glow, PageHero } from '@/components/SiteSection';
import { exampleTrace } from '@/data/showcase';
import { ctaPrimary, ctaSecondary } from '@/lib/ui';

export default function Demo() {
  return (
    <div className="overflow-hidden bg-ink-950 text-bone-100">
      <PageHero
        eyebrow="Curated public demo"
        title={<>One unsafe refund. <Accent tone="fault">Full evidence.</Accent></>}
        lead="This fixed example contains no customer data. It shows how Aegis turns a policy breach into a trace a developer can reproduce and gate in CI."
      />

      <section className="relative isolate px-5 pb-24 sm:px-8 lg:px-12">
        <Glow at="fault" />
        <div className="mx-auto max-w-7xl">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[0.72fr_1.28fr]">
            <ScrollReveal className="h-full">
              <section className="relative flex h-full flex-col items-center justify-center border border-fault-500/35 bg-fault-500/[0.06] p-8 text-center shadow-[0_40px_100px_-50px_rgba(240,85,64,0.55)]">
                <div aria-hidden className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-fault-400/80 to-transparent" />
                <ReliabilityScore score={30} size="xl" />
                <p className="mt-6 inline-flex items-center gap-2 border border-fault-500/50 bg-fault-500/10 px-3 py-1 text-sm font-semibold text-fault-300">
                  <ShieldAlert className="h-4 w-4" aria-hidden /> Release blocked
                </p>
                <p className="mt-4 max-w-sm text-base leading-relaxed text-bone-300">
                  The agent claimed a refund succeeded after the policy check showed the order
                  was outside the allowed window.
                </p>
              </section>
            </ScrollReveal>
            <ScrollReveal delay={0.08}>
              <ConsoleFrame label="execution trace · refund outside the window">
                <ExecutionTrace events={exampleTrace} />
              </ConsoleFrame>
            </ScrollReveal>
          </div>

          <ScrollReveal delay={0.1}>
            <div className="mt-6 flex gap-4 border border-flux-500/30 bg-flux-500/[0.05] p-6">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center border border-flux-500/40 bg-flux-500/10 text-flux-300">
                <Wrench className="h-5 w-5" aria-hidden />
              </span>
              <div>
                <h2 className="font-display text-lg font-semibold text-bone-50">Recommended fix</h2>
                <p className="mt-2 text-base leading-relaxed text-bone-200">
                  Require an eligibility result before exposing the refund action, then keep this
                  scenario in the release dataset so the same mistake cannot silently return.
                </p>
              </div>
            </div>
          </ScrollReveal>

          <div className="mt-10 flex flex-col gap-3 sm:flex-row">
            <Link to="/auth?mode=signup&next=/app/agents/new" className={ctaPrimary}>
              Test your agent <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" aria-hidden />
            </Link>
            <Link to="/how-it-works" className={ctaSecondary}>How it works</Link>
          </div>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
