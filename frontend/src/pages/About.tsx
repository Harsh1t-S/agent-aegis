import { Link } from 'react-router-dom';
import { MassiveHeading } from '@/components/MassiveHeading';
import { ScrollReveal } from '@/components/ScrollReveal';
import { SystemLabel } from '@/components/SystemLabel';
import { Shield, Target, Activity, GitBranch, AlertTriangle, Gauge } from 'lucide-react';

const principles = [
  { icon: Shield, title: 'Reliability is measurable', desc: 'Trust is not a feeling. It is a number derived from evidence across five dimensions.' },
  { icon: Target, title: 'Adversarial by design', desc: 'We do not test with easy questions. We generate the scenarios that break agents in the real world.' },
  { icon: Activity, title: 'Every decision traced', desc: 'Each tool call, reasoning step, and response is captured. Nothing is a black box.' },
  { icon: GitBranch, title: 'Evolution over time', desc: 'A single score is a snapshot. Aegis tracks reliability across versions to catch regressions.' },
  { icon: AlertTriangle, title: 'Failures are signal', desc: 'Every failure is classified, explained, and turned into an actionable recommendation.' },
  { icon: Gauge, title: 'Built for production', desc: 'Designed for teams deploying AI agents at scale — where reliability is not optional.' },
];

export default function About() {
  return (
    <div className="relative min-h-screen bg-ink-950 pt-16">
      <div className="absolute inset-0 grid-bg opacity-20" />

      {/* Hero */}
      <section className="relative flex min-h-[70vh] flex-col items-center justify-center px-6 text-center">
        <SystemLabel className="mb-8">AEGIS / PRODUCT</SystemLabel>
        <MassiveHeading
          lines={['THE AGENT', 'RELIABILITY', 'ENGINE.']}
          className="text-[clamp(2.5rem,9vw,7rem)] text-bone-50"
        />
        <ScrollReveal delay={0.4} className="mt-8 max-w-xl">
          <p className="text-sm text-bone-300 md:text-base">
            Aegis is an evaluation and reliability engine for AI agents. We stress-test agents
            with adversarial scenarios, detect failure modes, and measure reliability — so you
            deploy confidence, not hope.
          </p>
        </ScrollReveal>
      </section>

      {/* Principles */}
      <section className="relative px-6 py-20">
        <div className="mx-auto max-w-5xl">
          <SystemLabel className="mb-12 block text-center">DESIGN PRINCIPLES</SystemLabel>
          <div className="grid gap-px bg-bone-600/20 md:grid-cols-2 lg:grid-cols-3">
            {principles.map((p, i) => (
              <ScrollReveal key={p.title} delay={i * 0.08}>
                <div className="h-full border border-bone-600/20 bg-ink-900/60 p-8 transition-colors hover:bg-ink-850/60">
                  <p.icon className="h-6 w-6 text-violet-400" strokeWidth={1.5} />
                  <h3 className="mt-4 font-display text-lg font-semibold text-bone-50">{p.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-bone-400">{p.desc}</p>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="relative px-6 py-20">
        <div className="mx-auto max-w-4xl">
          <div className="grid grid-cols-2 gap-px bg-bone-600/20 md:grid-cols-4">
            {[
              { value: '6', label: 'FAILURE MODES' },
              { value: '5', label: 'RELIABILITY DIMENSIONS' },
              { value: '50', label: 'SCENARIOS PER RUN' },
              { value: '7', label: 'SCENARIO CATEGORIES' },
            ].map((stat, i) => (
              <ScrollReveal key={stat.label} delay={i * 0.1}>
                <div className="border border-bone-600/20 bg-ink-900/60 p-6 text-center">
                  <div className="massive text-4xl text-violet-400 md:text-5xl">{stat.value}</div>
                  <SystemLabel className="mt-2 block">{stat.label}</SystemLabel>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="relative flex min-h-[50vh] flex-col items-center justify-center px-6 text-center">
        <MassiveHeading
          lines={['DEPLOY', 'CONFIDENCE.']}
          className="text-[clamp(2rem,8vw,6rem)] text-violet-400"
        />
        <Link
          to="/app"
          className="group mt-12 border border-violet-500/40 bg-violet-500/10 px-10 py-4 font-mono text-sm uppercase tracking-[0.2em] text-violet-400 transition-all hover:bg-violet-500/20"
        >
          LAUNCH AEGIS →
        </Link>
      </section>
    </div>
  );
}
