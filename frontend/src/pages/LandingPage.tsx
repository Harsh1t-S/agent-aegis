import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowRight, Cable, CheckCircle2, GitCompareArrows, LockKeyhole,
  PlayCircle, ShieldAlert, TerminalSquare,
} from 'lucide-react';
import { AgentCore } from '@/components/AgentCore';
import { ExecutionTrace } from '@/components/ExecutionTrace';
import { MassiveHeading } from '@/components/MassiveHeading';
import { MetricLine } from '@/components/MetricLine';
import { ReliabilityScore } from '@/components/ReliabilityScore';
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
      <section className="relative flex min-h-screen items-center px-5 pb-20 pt-28 sm:px-8 lg:px-12">
        <div className="absolute inset-0 grid-bg opacity-25" />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-ink-950/30 to-ink-950" />
        <div className="relative mx-auto grid w-full max-w-7xl gap-14 lg:grid-cols-[1.08fr_0.92fr] lg:items-center">
          <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }}>
            <SystemLabel className="text-signal-400">RELEASE TESTING FOR SUPPORT AGENTS</SystemLabel>
            <MassiveHeading lines={['CATCH UNSAFE', 'ACTIONS BEFORE', 'YOUR AGENT SHIPS.']}
              className="mt-5 text-[clamp(3rem,8vw,7rem)] leading-[0.86] text-bone-50" />
            <p className="mt-7 max-w-2xl text-base leading-relaxed text-bone-300 sm:text-lg">
              Aegis stress-tests refund, account and operations workflows against explicit
              policies. It shows the exact tool-call evidence and turns confirmed failures
              into repeatable release checks.
            </p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Link to="/auth?next=/app/agents/new"
                className="group inline-flex min-h-12 items-center justify-center gap-2 border border-signal-500/55 bg-signal-500/15 px-6 font-mono text-xs uppercase tracking-wider text-signal-300 hover:bg-signal-500/25">
                CONNECT YOUR AGENT <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Link>
              <Link to="/demo"
                className="inline-flex min-h-12 items-center justify-center gap-2 border border-bone-600/35 px-6 font-mono text-xs uppercase tracking-wider text-bone-200 hover:border-bone-400">
                <PlayCircle className="h-4 w-4" /> EXPLORE THE DEMO
              </Link>
            </div>
            <div className="mt-7 flex flex-wrap gap-x-6 gap-y-3 font-mono text-[10px] uppercase tracking-wider text-bone-500">
              <span className="flex items-center gap-2"><LockKeyhole className="h-3.5 w-3.5 text-flux-400" /> Private workspaces</span>
              <span className="flex items-center gap-2"><CheckCircle2 className="h-3.5 w-3.5 text-flux-400" /> Bounded trial credits</span>
              <span className="flex items-center gap-2"><TerminalSquare className="h-3.5 w-3.5 text-flux-400" /> CI-ready API keys</span>
            </div>
          </motion.div>

          <motion.div className="relative mx-auto w-full max-w-xl" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.2, duration: 0.8 }}>
            <div className="pointer-events-none absolute left-1/2 top-1/2 opacity-30" style={{ transform: 'translate(-50%, -50%)' }}>
              <AgentCore destabilized size={420} core={false} />
            </div>
            <div className="relative border border-fault-500/30 bg-ink-900/90 p-6 shadow-2xl shadow-fault-950/20 backdrop-blur-xl sm:p-8">
              <div className="flex items-center justify-between gap-3">
                <SystemLabel>CURATED RELEASE REPORT</SystemLabel>
                <span className="border border-fault-500/45 bg-fault-500/10 px-2 py-1 font-mono text-[10px] uppercase tracking-wider text-fault-400">BLOCKED</span>
              </div>
              <div className="mt-7 grid gap-6 sm:grid-cols-[auto_1fr] sm:items-center">
                <ReliabilityScore score={30} size="lg" />
                <div>
                  <p className="font-mono text-xs uppercase tracking-wider text-fault-400">Unauthorized refund</p>
                  <p className="mt-2 text-sm leading-relaxed text-bone-300">
                    The agent called <code className="text-bone-100">issue_refund</code> after
                    the eligibility check showed the order was outside the allowed window.
                  </p>
                </div>
              </div>
              <div className="mt-6 border-l-2 border-fault-500/60 bg-fault-500/5 p-4 font-mono text-xs leading-relaxed text-bone-300">
                check_order → ineligible<br /><span className="text-fault-400">issue_refund → $240.00</span>
              </div>
              <p className="mt-4 font-mono text-[9px] uppercase tracking-wider text-bone-600">Static publishable example · no customer data</p>
            </div>
          </motion.div>
        </div>
      </section>

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
              Use the deterministic stand-in while configuring the workspace, then switch
              to a self-hosted evaluator model or your connected agent when ready.
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
          <p className="mt-4 font-mono text-[9px] uppercase tracking-wider text-bone-600">Illustrative curated result</p>
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
