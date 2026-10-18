import { Link } from 'react-router-dom';
import { ArrowRight, Cable, GitCompareArrows, ShieldAlert, ShieldX } from 'lucide-react';
import { Backdrop } from '@/components/Backdrop';
import { ExecutionTrace } from '@/components/ExecutionTrace';
import { Hero } from '@/components/Hero';
import { MetricLine } from '@/components/MetricLine';
import { ScrollReveal } from '@/components/ScrollReveal';
import { SiteFooter } from '@/components/SiteNav';
import { Accent, ConsoleFrame, Eyebrow, Glow } from '@/components/SiteSection';
import { exampleTrace } from '@/data/showcase';
import { METRIC_COLORS } from '@/lib/palette';
import { ctaPrimary, ctaSecondary, siteCard, siteHeading, siteLead } from '@/lib/ui';

const capabilities = [
  { icon: Cable, title: 'Test the real agent', copy: 'Connect a runner to include your orchestration, retrieval and memory, while Aegis supplies safe mocked tools.' },
  { icon: ShieldAlert, title: 'See the exact breach', copy: 'Inspect the prompt, tool arguments, result, final state and policy expectation behind every finding.' },
  { icon: GitCompareArrows, title: 'Gate the next release', copy: 'Compare the same immutable scenarios across versions and fail CI when a confirmed regression returns.' },
];

const workflow = [
  ['01', 'Choose a test path', 'Start free with prompt simulation or connect your agent runner.'],
  ['02', 'Import tools and policy', 'Paste a tool schema and the instructions that define safe behavior.'],
  ['03', 'Review the suite', 'Aegis builds realistic, ambiguous, edge and adversarial scenarios with executable expectations.'],
  ['04', 'Run and decide', 'Inspect evidence, classify findings, then save the run as a baseline.'],
];

const metrics = [
  { label: 'Task success', value: 83, color: METRIC_COLORS.taskSuccess },
  { label: 'Tool accuracy', value: 75, color: METRIC_COLORS.toolAccuracy },
  { label: 'Safety', value: 42, color: METRIC_COLORS.safety },
  { label: 'Loop resistance', value: 92, color: METRIC_COLORS.consistency },
  { label: 'Groundedness', value: 68, color: METRIC_COLORS.groundedness },
];

const section = 'relative isolate px-5 py-20 sm:px-8 sm:py-28 lg:px-12';
const bandSection = `${section} border-y border-bone-600/15 bg-ink-900/30`;

export default function LandingPage() {
  return (
    <div className="overflow-hidden bg-ink-950 text-bone-100">
      <Hero />

      <section className={section}>
        <Glow at="top" />
        <div className="mx-auto max-w-7xl">
          <ScrollReveal className="max-w-3xl">
            <Eyebrow>Why teams use Aegis</Eyebrow>
            <h2 className={`mt-5 ${siteHeading}`}>
              A release decision <Accent>backed by evidence.</Accent>
            </h2>
            <p className={`mt-5 max-w-2xl ${siteLead}`}>
              Aegis tests the agent you actually ship, shows where it broke your policy, and
              keeps that failure from quietly coming back.
            </p>
          </ScrollReveal>
          <div className="mt-12 grid gap-4 md:grid-cols-3">
            {capabilities.map((item, index) => (
              <ScrollReveal key={item.title} delay={index * 0.08} className="h-full">
                <article className={`h-full ${siteCard}`}>
                  <span className="flex h-11 w-11 items-center justify-center border border-signal-500/40 bg-signal-500/10 text-signal-300 shadow-[0_0_24px_-8px_rgba(38,169,208,0.7)]">
                    <item.icon className="h-5 w-5" aria-hidden />
                  </span>
                  <h3 className="mt-6 font-display text-xl font-semibold text-bone-50">{item.title}</h3>
                  <p className="mt-3 text-base leading-relaxed text-bone-300">{item.copy}</p>
                </article>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      <section className={bandSection}>
        <Glow at="right" />
        <div className="mx-auto grid max-w-7xl grid-cols-1 items-center gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:gap-16">
          <ScrollReveal>
            <Eyebrow>From finding to fix</Eyebrow>
            <h2 className={`mt-5 ${siteHeading}`}>
              Every claim <Accent>has a trace.</Accent>
            </h2>
            <p className={`mt-5 max-w-xl ${siteLead}`}>
              The report preserves what the user asked, which tools ran, what state changed,
              which expectation failed and the evaluator version that made the decision.
            </p>
            <Link to="/demo" className={`mt-8 ${ctaSecondary}`}>
              Open the full example <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          </ScrollReveal>
          <ScrollReveal delay={0.1}>
            <ConsoleFrame
              label="trace · refund outside the window"
              badge={(
                <span className="inline-flex shrink-0 items-center gap-1.5 border border-fault-500/50 bg-fault-500/10 px-2 py-0.5 text-xs font-semibold text-fault-300">
                  <ShieldX className="h-3.5 w-3.5" aria-hidden /> Failed
                </span>
              )}
            >
              <ExecutionTrace events={exampleTrace} />
            </ConsoleFrame>
          </ScrollReveal>
        </div>
      </section>

      <section className={section}>
        <Glow at="left" />
        <div className="mx-auto max-w-7xl">
          <ScrollReveal className="max-w-3xl">
            <Eyebrow>Your first run</Eyebrow>
            <h2 className={`mt-5 ${siteHeading}`}>
              A short path to <Accent>a useful report.</Accent>
            </h2>
            <p className={`mt-5 max-w-2xl ${siteLead}`}>
              Runs use the hosted model by default, so the first report already tests your
              prompt. Connect your own agent when you want its full stack tested.
            </p>
          </ScrollReveal>
          <ol className="mt-12 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {workflow.map(([number, title, copy], index) => (
              <li key={number} className="h-full">
                <ScrollReveal delay={index * 0.06} className="h-full">
                  <div className={`h-full ${siteCard}`}>
                    <span className="flex h-10 w-10 items-center justify-center border border-signal-500/50 bg-ink-950 font-mono text-sm font-semibold text-signal-300">
                      {number}
                    </span>
                    <h3 className="mt-5 font-display text-lg font-semibold text-bone-50">{title}</h3>
                    <p className="mt-2 text-base leading-relaxed text-bone-300">{copy}</p>
                  </div>
                </ScrollReveal>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className={bandSection}>
        <Glow at="left" />
        <div className="mx-auto grid max-w-7xl grid-cols-1 items-center gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:gap-16">
          <ScrollReveal>
            <Eyebrow>Metrics with published meanings</Eyebrow>
            <h2 className={`mt-5 ${siteHeading}`}>
              Measure the <Accent>tested behavior.</Accent>
            </h2>
            <p className={`mt-5 max-w-xl ${siteLead}`}>
              Results describe performance on the recorded scenario set. Aegis does not claim
              universal safety, and severe unsafe actions cap the overall score.
            </p>
          </ScrollReveal>
          <ScrollReveal delay={0.1}>
            <ConsoleFrame label="reliability · five dimensions">
              <div className="grid gap-6">
                {metrics.map((metric, index) => (
                  <MetricLine key={metric.label} label={metric.label} value={metric.value} color={metric.color} delay={index * 0.05} />
                ))}
              </div>
            </ConsoleFrame>
            <p className="mt-3 text-xs text-bone-400">Illustrative curated result</p>
          </ScrollReveal>
        </div>
      </section>

      <section className="relative isolate overflow-hidden px-5 py-28 text-center sm:px-8 lg:px-12 lg:py-36">
        <Backdrop />
        <ScrollReveal className="relative mx-auto max-w-4xl">
          <h2 className="font-display text-[clamp(2.5rem,6vw,5rem)] font-bold leading-[0.98] tracking-ultraTight text-bone-50">
            Turn your next agent change <Accent>into a test.</Accent>
          </h2>
          <p className={`mx-auto mt-6 max-w-xl ${siteLead}`}>
            Create a private workspace, establish a bounded baseline, and keep the failures
            that matter in your release process.
          </p>
          <div className="mt-10 flex flex-col justify-center gap-3 sm:flex-row">
            <Link to="/auth?mode=signup&next=/app/agents/new" className={ctaPrimary}>
              Start a private workspace
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" aria-hidden />
            </Link>
            <Link to="/pricing" className={ctaSecondary}>View plans</Link>
          </div>
        </ScrollReveal>
      </section>

      <SiteFooter />
    </div>
  );
}
