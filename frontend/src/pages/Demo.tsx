import { Link } from 'react-router-dom';
import { ArrowRight, ShieldAlert } from 'lucide-react';
import { SiteNav } from '@/components/SiteNav';
import { ExecutionTrace } from '@/components/ExecutionTrace';
import { ReliabilityScore } from '@/components/ReliabilityScore';
import { exampleTrace } from '@/data/showcase';

export default function Demo() {
  return (
    <div className="min-h-screen bg-ink-950">
      <SiteNav />
      <main className="mx-auto max-w-6xl px-5 pb-24 pt-28 sm:px-8">
        <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.24em] text-signal-400">CURATED PUBLIC DEMO</p>
            <h1 className="massive mt-4 text-[clamp(3rem,8vw,6rem)] text-bone-50">
              ONE UNSAFE REFUND.<br /><span className="text-fault-500">FULL EVIDENCE.</span>
            </h1>
          </div>
          <p className="max-w-md text-sm leading-relaxed text-bone-400">
            This fixed example contains no customer data. It shows how Aegis turns a
            policy breach into a trace a developer can reproduce and gate in CI.
          </p>
        </div>
        <div className="mt-12 grid gap-6 lg:grid-cols-[0.72fr_1.28fr]">
          <section className="flex flex-col items-center justify-center border border-fault-500/25 bg-fault-500/5 p-8 text-center">
            <ReliabilityScore score={30} size="xl" />
            <div className="mt-6 flex items-center gap-2 font-mono text-xs uppercase tracking-wider text-fault-400">
              <ShieldAlert className="h-4 w-4" /> RELEASE BLOCKED
            </div>
            <p className="mt-4 text-sm leading-relaxed text-bone-400">
              The agent claimed a refund succeeded after the policy check showed the order
              was outside the allowed window.
            </p>
          </section>
          <section className="border border-bone-600/20 bg-ink-900/60 p-6">
            <p className="mb-5 font-mono text-[11px] uppercase tracking-wider text-bone-500">EXECUTION TRACE</p>
            <ExecutionTrace events={exampleTrace} />
          </section>
        </div>
        <div className="mt-8 border border-bone-600/20 bg-ink-900/50 p-6">
          <p className="font-mono text-[11px] uppercase tracking-wider text-flux-400">RECOMMENDED FIX</p>
          <p className="mt-3 text-sm leading-relaxed text-bone-200">
            Require an eligibility result before exposing the refund action, then keep this
            scenario in the release dataset so the same mistake cannot silently return.
          </p>
        </div>
        <div className="mt-10 flex flex-wrap gap-4">
          <Link to="/auth?next=/app/agents/new"
            className="inline-flex min-h-12 items-center gap-2 border border-signal-500/45 bg-signal-500/10 px-6 font-mono text-xs uppercase tracking-wider text-signal-300">
            TEST YOUR AGENT <ArrowRight className="h-4 w-4" />
          </Link>
          <Link to="/how-it-works"
            className="inline-flex min-h-12 items-center border border-bone-600/30 px-6 font-mono text-xs uppercase tracking-wider text-bone-300">
            HOW IT WORKS
          </Link>
        </div>
      </main>
    </div>
  );
}
