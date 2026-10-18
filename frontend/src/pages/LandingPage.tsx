import { Link } from 'react-router-dom';
import { ArrowRight, Cable, GitCompareArrows, ShieldAlert } from 'lucide-react';
import { ExecutionTrace } from '@/components/ExecutionTrace';
import { Hero } from '@/components/Hero';
import { MassiveHeading } from '@/components/MassiveHeading';
import { MetricLine } from '@/components/MetricLine';
import { ScrollReveal } from '@/components/ScrollReveal';
import { SystemLabel } from '@/components/SystemLabel';
import { exampleTrace } from '@/data/showcase';

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

export default function LandingPage() {
  return (
    <div className="overflow-hidden bg-ink-950 text-bone-100">
      <Hero />

      <section className="border-y border-bone-600/20 bg-ink-900/45 px-5 py-20 sm:px-8">
        <div className="mx-auto max-w-7xl">
          <ScrollReveal>
            <SystemLabel>WHY TEAMS USE AEGIS</SystemLabel>
            <h2 className="massive mt-4 max-w-4xl text-[clamp(2.5rem,6vw,5rem)] leading-[0.92] text-bone-50">
              A RELEASE DECISION<br /><span className="text-signal-400">BACKED BY EVIDENCE.</span>
            </h2>
          </ScrollReveal>
          <div className="mt-12 grid gap-px border border-bone-600/20 bg-bone-600/20 md:grid-cols-3">
            {capabilities.map((item, index) => (
              <ScrollReveal key={item.title} delay={index * 0.08} className="bg-ink-950 p-7">
                <item.icon className="h-5 w-5 text-signal-400" />
                <h3 className="mt-5 font-mono text-sm uppercase tracking-wider text-bone-100">{item.title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-bone-400">{item.copy}</p>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      <section className="px-5 py-24 sm:px-8">
        <div className="mx-auto grid max-w-7xl gap-14 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
          <ScrollReveal>
            <SystemLabel>FROM FINDING TO FIX</SystemLabel>
            <MassiveHeading lines={['EVERY CLAIM', 'HAS A TRACE.']} className="mt-4 text-[clamp(2.7rem,6vw,5.5rem)] text-bone-50" />
            <p className="mt-6 max-w-xl text-sm leading-relaxed text-bone-400">
              The report preserves what the user asked, which tools ran, what state changed,
              which expectation failed and the evaluator version that made the decision.
            </p>
            <Link to="/demo" className="mt-7 inline-flex items-center gap-2 font-mono text-xs uppercase tracking-wider text-signal-400 hover:text-signal-300">
              OPEN THE FULL EXAMPLE <ArrowRight className="h-4 w-4" />
            </Link>
          </ScrollReveal>
          <ScrollReveal delay={0.1} className="border border-bone-600/20 bg-ink-900/60 p-6 sm:p-8">
            <ExecutionTrace events={exampleTrace} />
          </ScrollReveal>
        </div>
      </section>

      <section className="border-y border-bone-600/20 bg-ink-900/45 px-5 py-24 sm:px-8">
        <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-[0.8fr_1.2fr]">
          <ScrollReveal>
            <SystemLabel>FIRST RUN</SystemLabel>
            <h2 className="massive mt-4 text-[clamp(2.5rem,6vw,5rem)] text-bone-50">A SHORT PATH TO A USEFUL REPORT.</h2>
            <p className="mt-5 text-sm leading-relaxed text-bone-400">
              Runs use the hosted model by default, so the first report already tests
              your prompt. Connect your own agent when you want its full stack tested.
            </p>
          </ScrollReveal>
          <ol className="grid gap-3">
            {workflow.map(([number, title, copy], index) => (
              <ScrollReveal key={number} delay={index * 0.06}>
                <li className="grid gap-3 border border-bone-600/20 bg-ink-950/70 p-5 sm:grid-cols-[3rem_12rem_1fr] sm:items-center">
                  <span className="font-mono text-xs text-signal-400">{number}</span>
                  <span className="font-mono text-xs uppercase tracking-wider text-bone-100">{title}</span>
                  <span className="text-sm leading-relaxed text-bone-400">{copy}</span>
                </li>
              </ScrollReveal>
            ))}
          </ol>
        </div>
      </section>

      <section className="px-5 py-24 sm:px-8">
        <div className="mx-auto max-w-5xl text-center">
          <SystemLabel>METRICS WITH PUBLISHED MEANINGS</SystemLabel>
          <MassiveHeading lines={['MEASURE THE', 'TESTED BEHAVIOR.']} className="mt-4 text-[clamp(2.5rem,6vw,5rem)] text-bone-50" />
          <p className="mx-auto mt-5 max-w-2xl text-sm leading-relaxed text-bone-400">
            Results describe performance on the recorded scenario set. Aegis does not claim
            universal safety, and severe unsafe actions cap the overall score.
          </p>
          <div className="mx-auto mt-10 grid max-w-2xl gap-5 text-left">
            <MetricLine label="TASK SUCCESS" value={83} color="#26a9d0" />
            <MetricLine label="TOOL ACCURACY" value={75} color="#1cb8d8" delay={0.05} />
            <MetricLine label="SAFETY" value={42} color="#22c57e" delay={0.1} />
            <MetricLine label="LOOP RESISTANCE" value={92} color="#5bc8e8" delay={0.15} />
            <MetricLine label="GROUNDEDNESS" value={68} color="#eda31c" delay={0.2} />
          </div>
          <p className="mt-4 font-mono text-xs uppercase tracking-wider text-bone-600">Illustrative curated result</p>
        </div>
      </section>

      <section className="relative border-t border-bone-600/20 px-5 py-28 text-center sm:px-8">
        <div className="pointer-events-none absolute inset-0 grid-bg opacity-20" />
        <div className="relative mx-auto max-w-4xl">
          <MassiveHeading lines={['TURN YOUR NEXT', 'AGENT CHANGE', 'INTO A TEST.']} className="text-[clamp(3rem,8vw,7rem)] text-bone-50" />
          <p className="mx-auto mt-6 max-w-xl text-sm leading-relaxed text-bone-400">
            Create a private workspace, establish a bounded baseline, and keep the failures
            that matter in your release process.
          </p>
          <div className="mt-9 flex flex-col justify-center gap-3 sm:flex-row">
            <Link to="/auth?next=/app/agents/new" className="inline-flex min-h-12 items-center justify-center gap-2 border border-signal-500/55 bg-signal-500/15 px-6 font-mono text-xs uppercase tracking-wider text-signal-300">
              START A PRIVATE WORKSPACE <ArrowRight className="h-4 w-4" />
            </Link>
            <Link to="/pricing" className="inline-flex min-h-12 items-center justify-center border border-bone-600/35 px-6 font-mono text-xs uppercase tracking-wider text-bone-200">VIEW PLANS</Link>
          </div>
        </div>
      </section>
    </div>
  );
}
