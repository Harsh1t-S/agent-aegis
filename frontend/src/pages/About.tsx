import { Link } from 'react-router-dom';
import { Activity, AlertTriangle, ArrowRight, Gauge, GitBranch, Shield, Target } from 'lucide-react';
import { Backdrop } from '@/components/Backdrop';
import { ScrollReveal } from '@/components/ScrollReveal';
import { SiteFooter } from '@/components/SiteNav';
import { Accent, ConsoleFrame, Eyebrow, Glow, PageHero } from '@/components/SiteSection';
import { ctaPrimary, ctaSecondary, siteCard, siteHeading, siteLead } from '@/lib/ui';

const principles = [
  { icon: Shield, title: 'Reliability is measurable', desc: 'Trust is not a feeling. It is a number derived from evidence across five dimensions.' },
  { icon: Target, title: 'Adversarial by design', desc: 'We do not test with easy questions. We generate the scenarios that break agents in the real world.' },
  { icon: Activity, title: 'Every decision traced', desc: 'Each tool call, reasoning step, and response is captured. Nothing is a black box.' },
  { icon: GitBranch, title: 'Evolution over time', desc: 'A single score is a snapshot. Aegis tracks reliability across versions to catch regressions.' },
  { icon: AlertTriangle, title: 'Failures are signal', desc: 'Every failure is classified, explained, and turned into an actionable recommendation.' },
  { icon: Gauge, title: 'Built for production', desc: 'Designed for teams deploying AI agents at scale — where reliability is not optional.' },
];

// Each figure matches what the engine enforces: the failure taxonomy, the scored
// dimensions, the scenario categories and the per-run limit the API accepts.
const stats = [
  { value: '6', label: 'Failure modes' },
  { value: '5', label: 'Reliability dimensions' },
  { value: '4', label: 'Scenario categories' },
  { value: '40', label: 'Scenarios per run, at most' },
];

function StatsPanel() {
  return (
    <ConsoleFrame label="aegis · what every run measures">
      <dl className="grid grid-cols-2 gap-px bg-bone-600/25">
        {stats.map((stat) => (
          <div key={stat.label} className="bg-ink-950 p-5">
            <dt className="text-sm text-bone-300">{stat.label}</dt>
            <dd className="mt-2 font-display text-5xl font-bold tracking-tightest">
              <Accent>{stat.value}</Accent>
            </dd>
          </div>
        ))}
      </dl>
    </ConsoleFrame>
  );
}

export default function About() {
  return (
    <div className="overflow-hidden bg-ink-950 text-bone-100">
      <PageHero
        eyebrow="About Aegis"
        title={<>The reliability engine <Accent>for AI agents.</Accent></>}
        lead="Aegis is an evaluation and reliability engine for AI agents. We stress-test agents with adversarial scenarios, detect failure modes, and measure reliability, so you deploy with confidence instead of hope."
        aside={<StatsPanel />}
      >
        <div className="flex flex-col gap-3 sm:flex-row">
          <Link to="/auth?mode=signup&next=/app/agents/new" className={ctaPrimary}>
            Start free <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" aria-hidden />
          </Link>
          <Link to="/how-it-works" className={ctaSecondary}>How it works</Link>
        </div>
      </PageHero>

      <section className="relative isolate px-5 py-20 sm:px-8 sm:py-28 lg:px-12">
        <Glow at="top" />
        <div className="mx-auto max-w-7xl">
          <ScrollReveal className="max-w-3xl">
            <Eyebrow>Design principles</Eyebrow>
            <h2 className={`mt-5 ${siteHeading}`}>What we <Accent>will not compromise on.</Accent></h2>
          </ScrollReveal>
          <div className="mt-12 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {principles.map((principle, index) => (
              <ScrollReveal key={principle.title} delay={index * 0.06} className="h-full">
                <article className={`h-full ${siteCard}`}>
                  <span className="flex h-11 w-11 items-center justify-center border border-signal-500/40 bg-signal-500/10 text-signal-300">
                    <principle.icon className="h-5 w-5" strokeWidth={1.75} aria-hidden />
                  </span>
                  <h3 className="mt-6 font-display text-xl font-semibold text-bone-50">{principle.title}</h3>
                  <p className="mt-3 text-base leading-relaxed text-bone-300">{principle.desc}</p>
                </article>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      <section className="relative isolate overflow-hidden px-5 py-28 text-center sm:px-8 lg:px-12 lg:py-36">
        <Backdrop />
        <ScrollReveal className="relative mx-auto max-w-3xl">
          <h2 className="font-display text-[clamp(2.5rem,6vw,4.5rem)] font-bold leading-[0.98] tracking-ultraTight text-bone-50">
            Deploy with <Accent>confidence.</Accent>
          </h2>
          <p className={`mx-auto mt-6 max-w-xl ${siteLead}`}>
            New accounts start with 60 free scenario credits. No card needed.
          </p>
          <div className="mt-10 flex flex-col justify-center gap-3 sm:flex-row">
            <Link to="/auth?mode=signup&next=/app/agents/new" className={ctaPrimary}>
              Start free <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" aria-hidden />
            </Link>
            <Link to="/pricing" className={ctaSecondary}>View plans</Link>
          </div>
        </ScrollReveal>
      </section>

      <SiteFooter />
    </div>
  );
}
