import { Link } from 'react-router-dom';
import { ArrowRight, PlayCircle } from 'lucide-react';
import { Backdrop } from '@/components/Backdrop';
import { ScrollReveal } from '@/components/ScrollReveal';
import { SiteFooter } from '@/components/SiteNav';
import { Accent, ConsoleFrame, Eyebrow, Glow, PageHero } from '@/components/SiteSection';
import { ctaPrimary, ctaSecondary, siteHeading, siteLead } from '@/lib/ui';

const pipeline = [
  { num: '01', label: 'Input', hint: 'Profile the prompt, domain and tools', desc: 'Submit your agent\'s system prompt, description, domain, and available tools.', detail: 'Aegis builds a behavioral profile of your agent — understanding its purpose, boundaries, and capabilities.' },
  { num: '02', label: 'Stress test', hint: 'Realistic and adversarial scenarios', desc: 'Aegis generates realistic and adversarial test scenarios.', detail: 'Normal requests, edge cases, ambiguous prompts, conflicting instructions, manipulation attempts, and tool-failure simulations.' },
  { num: '03', label: 'Execute', hint: 'A sandboxed run with mocked tools', desc: 'Your agent runs in a sandboxed environment.', detail: 'Every decision, tool call, and response is captured as an execution trace for analysis.' },
  { num: '04', label: 'Detect', hint: 'Each failure classified by mode', desc: 'Failures are detected and classified by failure mode.', detail: 'Hallucination, goal drift, tool misuse, unsafe actions, infinite loops, and overconfidence.' },
  { num: '05', label: 'Analyze', hint: 'A score across five dimensions', desc: 'A reliability score is calculated across five dimensions.', detail: 'Task success, tool accuracy, safety, loop resistance, and groundedness — each measured independently.' },
  { num: '06', label: 'Evolve', hint: 'Compare versions, gate the release', desc: 'Track improvements and regressions across versions.', detail: 'Compare scores, failure counts, and metric shifts to ensure every change moves you forward.' },
];

/** The six stages at a glance, drawn as a run in the hero's console. */
function PipelinePanel() {
  return (
    <ConsoleFrame label="aegis run · six stages">
      <ol className="relative space-y-1">
        <span aria-hidden className="absolute bottom-5 left-[1.125rem] top-5 w-px bg-gradient-to-b from-signal-400/70 via-bone-600/40 to-flux-500/50" />
        {pipeline.map((stage) => (
          <li key={stage.num} className="relative flex items-center gap-4 py-2">
            <span className="relative z-10 flex h-9 w-9 shrink-0 items-center justify-center border border-signal-500/50 bg-ink-950 font-mono text-xs font-semibold text-signal-300">
              {stage.num}
            </span>
            <span className="min-w-0">
              <span className="block font-display text-base font-semibold text-bone-50">{stage.label}</span>
              <span className="block text-sm text-bone-400">{stage.hint}</span>
            </span>
          </li>
        ))}
      </ol>
    </ConsoleFrame>
  );
}

export default function HowItWorks() {
  return (
    <div className="overflow-hidden bg-ink-950 text-bone-100">
      <PageHero
        eyebrow="How it works"
        title={<>Six stages from agent to <Accent>release decision.</Accent></>}
        lead="Aegis takes your agent from black box to measurable reliability: it profiles the agent, attacks it, traces every call, classifies what broke, scores it, and tracks the next version."
        aside={<PipelinePanel />}
      >
        <div className="flex flex-col gap-3 sm:flex-row">
          <Link to="/auth?mode=signup&next=/app/agents/new" className={ctaPrimary}>
            Start free <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" aria-hidden />
          </Link>
          <Link to="/demo" className={ctaSecondary}>
            <PlayCircle className="h-5 w-5" aria-hidden /> See the demo
          </Link>
        </div>
      </PageHero>

      <section className="relative isolate px-5 py-20 sm:px-8 sm:py-28 lg:px-12">
        <Glow at="left" />
        <div className="mx-auto max-w-5xl">
          <ScrollReveal className="max-w-3xl">
            <Eyebrow>The pipeline</Eyebrow>
            <h2 className={`mt-5 ${siteHeading}`}>What happens <Accent>in every run.</Accent></h2>
          </ScrollReveal>
          <ol className="relative mt-14">
            <span aria-hidden className="absolute bottom-0 left-[1.375rem] top-0 w-px bg-gradient-to-b from-signal-400/70 via-bone-600/40 to-transparent" />
            {pipeline.map((stage, index) => (
              <li key={stage.num} className="relative grid grid-cols-[2.75rem_1fr] gap-5 pb-14 last:pb-0 sm:gap-8">
                <span className="relative z-10 flex h-11 w-11 items-center justify-center border border-signal-500/50 bg-ink-950 font-mono text-sm font-semibold text-signal-300 shadow-[0_0_24px_-6px_rgba(38,169,208,0.7)]">
                  {stage.num}
                </span>
                <ScrollReveal delay={index * 0.04}>
                  <p className="text-sm font-medium text-signal-300">{stage.label}</p>
                  <h3 className="mt-2 font-display text-2xl font-semibold leading-snug text-bone-50 md:text-3xl">{stage.desc}</h3>
                  <p className="mt-3 max-w-2xl text-base leading-relaxed text-bone-300">{stage.detail}</p>
                </ScrollReveal>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="relative isolate overflow-hidden px-5 py-28 text-center sm:px-8 lg:px-12 lg:py-36">
        <Backdrop />
        <ScrollReveal className="relative mx-auto max-w-3xl">
          <h2 className="font-display text-[clamp(2.5rem,6vw,4.5rem)] font-bold leading-[0.98] tracking-ultraTight text-bone-50">
            Ready to <Accent>test yours?</Accent>
          </h2>
          <p className={`mx-auto mt-6 max-w-xl ${siteLead}`}>
            Paste a prompt and a tool schema. The first report is a few minutes away.
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
