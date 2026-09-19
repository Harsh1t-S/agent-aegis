import { Link } from 'react-router-dom';
import { MassiveHeading } from '@/components/MassiveHeading';
import { ScrollReveal } from '@/components/ScrollReveal';
import { SystemLabel } from '@/components/SystemLabel';
import { AgentCore } from '@/components/AgentCore';
import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';

const pipeline = [
  { num: '01', label: 'INPUT', desc: 'Submit your agent\'s system prompt, description, domain, and available tools.', detail: 'Aegis builds a behavioral profile of your agent — understanding its purpose, boundaries, and capabilities.' },
  { num: '02', label: 'STRESS TEST', desc: 'Aegis generates realistic and adversarial test scenarios.', detail: 'Normal requests, edge cases, ambiguous prompts, conflicting instructions, manipulation attempts, and tool-failure simulations.' },
  { num: '03', label: 'EXECUTE', desc: 'Your agent runs in a sandboxed environment.', detail: 'Every decision, tool call, and response is captured as an execution trace for analysis.' },
  { num: '04', label: 'DETECT', desc: 'Failures are detected and classified by failure mode.', detail: 'Hallucination, goal drift, tool misuse, unsafe actions, infinite loops, and overconfidence.' },
  { num: '05', label: 'ANALYZE', desc: 'A reliability score is calculated across five dimensions.', detail: 'Task success, tool accuracy, safety, loop resistance, and groundedness — each measured independently.' },
  { num: '06', label: 'EVOLVE', desc: 'Track improvements and regressions across versions.', detail: 'Compare scores, failure counts, and metric shifts to ensure every change moves you forward.' },
];

export default function HowItWorks() {
  return (
    <div className="relative min-h-screen bg-ink-950 pt-16">
      <div className="absolute inset-0 grid-bg opacity-20" />

      {/* Hero */}
      <section className="relative flex min-h-[80vh] flex-col items-center justify-center px-6 text-center">
        <SystemLabel className="mb-8">AEGIS / SYSTEM ARCHITECTURE</SystemLabel>
        <MassiveHeading
          lines={['HOW THE', 'SYSTEM', 'WORKS.']}
          className="text-[clamp(2.5rem,9vw,7rem)] text-bone-50"
        />
        <ScrollReveal delay={0.4} className="mt-8 max-w-lg">
          <p className="text-sm text-bone-300 md:text-base">
            Aegis takes your agent from black box to measurable reliability in six precise stages.
          </p>
        </ScrollReveal>

        <motion.div
          className="mt-12 max-w-full overflow-hidden opacity-40"
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 0.4 }}
          transition={{ duration: 1.5 }}
        >
          <AgentCore size={250} />
        </motion.div>
      </section>

      {/* Pipeline */}
      <section className="relative px-6 py-20">
        <div className="mx-auto max-w-5xl space-y-20">
          {pipeline.map((stage, i) => (
            <ScrollReveal key={stage.num} delay={i * 0.05}>
              <div className="grid gap-6 md:grid-cols-[auto_1fr] md:gap-12">
                <div className="flex flex-row items-center gap-4 md:flex-col md:items-start md:gap-2">
                  {/* These numerals are the only thing naming each stage, so they are not
                      allowed to be decoration: at /40 they sat at 1.98:1, under the
                      3:1 that large text needs. */}
                  <span className="massive text-5xl text-signal-400/70 md:text-7xl">{stage.num}</span>
                  <span className="tech-label text-signal-400">{stage.label}</span>
                </div>
                <div className="border-l border-bone-600/20 pl-0 md:pl-8">
                  <h3 className="font-display text-2xl font-semibold text-bone-50 md:text-3xl">
                    {stage.desc}
                  </h3>
                  <p className="mt-3 text-sm leading-relaxed text-bone-400 md:text-base">
                    {stage.detail}
                  </p>
                </div>
              </div>
            </ScrollReveal>
          ))}
        </div>
      </section>

      {/* Flow diagram */}
      <section className="relative px-6 py-20">
        <ScrollReveal className="mx-auto max-w-4xl">
          <div className="flex flex-wrap items-center justify-center gap-2 md:gap-4">
            {pipeline.map((stage, i) => (
              <div key={stage.num} className="flex items-center gap-2 md:gap-4">
                <div className="border border-signal-500/30 bg-signal-500/5 px-4 py-2">
                  <span className="font-mono text-xs uppercase tracking-wider text-signal-400">
                    {stage.label}
                  </span>
                </div>
                {i < pipeline.length - 1 && (
                  <ArrowRight className="h-4 w-4 text-bone-600" />
                )}
              </div>
            ))}
          </div>
        </ScrollReveal>
      </section>

      {/* CTA */}
      <section className="relative flex min-h-[60vh] flex-col items-center justify-center px-6 text-center">
        <MassiveHeading
          lines={['READY TO', 'TEST YOURS?']}
          className="text-[clamp(2rem,7vw,5rem)] text-bone-50"
        />
        <Link
          to="/app"
          className="group mt-12 border border-signal-500/40 bg-signal-500/10 px-10 py-4 font-mono text-sm uppercase tracking-[0.2em] text-signal-400 transition-all hover:bg-signal-500/20"
        >
          LAUNCH AEGIS →
        </Link>
      </section>
    </div>
  );
}
