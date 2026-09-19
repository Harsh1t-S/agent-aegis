import { useParams } from 'react-router-dom';
import { IncidentTrace } from '@/components/IncidentTrace';
import { MetricLine } from '@/components/MetricLine';
import { SystemLabel } from '@/components/SystemLabel';
import { ErrorState, LoadingState } from '@/components/AsyncState';
import { useResource } from '@/hooks/useResource';
import { api } from '@/lib/api';
import { formatDate, verdictFor } from '@/lib/format';
import { METRIC_COLORS } from '@/lib/palette';

export default function SharedReport() {
  const { token } = useParams<{ token: string }>();
  const resource = useResource(
    () => api.sharedReport(token as string),
    [token],
    { enabled: Boolean(token) },
  );

  if (resource.loading) return <div className="min-h-screen bg-ink-950 pt-24"><LoadingState label="OPENING PRIVATE REPORT" /></div>;
  if (resource.error || !resource.data) {
    return (
      <main className="min-h-screen bg-ink-950 px-6 pb-20 pt-36">
        <div className="mx-auto max-w-3xl">
          <ErrorState message={resource.error ?? 'This private report is unavailable.'} onRetry={resource.reload} />
        </div>
      </main>
    );
  }

  const { evaluation } = resource.data;
  return (
    <main className="min-h-screen bg-ink-950 px-4 pb-24 pt-32 text-bone-100 sm:px-6 md:px-10">
      <div className="mx-auto max-w-6xl">
        <div className="border border-warn-500/30 bg-warn-500/5 p-4 text-sm leading-relaxed text-bone-300">
          <strong className="font-mono text-[11px] uppercase tracking-wider text-warn-400">PRIVATE BEARER LINK</strong>
          <span className="ml-3">This read-only report expires {formatDate(resource.data.share.expiresAt)}. Forwarding the URL gives the recipient the same access.</span>
        </div>

        <div className="mt-10 grid gap-8 lg:grid-cols-[1fr_auto] lg:items-end">
          <div>
            <SystemLabel>SHARED RELIABILITY REPORT</SystemLabel>
            <h1 className="massive mt-3 text-[clamp(2.8rem,7vw,5.5rem)] text-bone-50">{evaluation.agentName}</h1>
            <p className="mt-3 font-mono text-[10px] uppercase tracking-wider text-bone-500">
              {evaluation.version} · {formatDate(evaluation.date)} · READ ONLY
            </p>
          </div>
          <div className="border border-bone-600/25 bg-ink-900/70 p-6 text-center">
            <div className="massive text-6xl text-bone-50">{evaluation.score.toFixed(1)}</div>
            <div className="mt-1 font-mono text-[10px] uppercase tracking-wider text-bone-500">{verdictFor(evaluation.score)}</div>
          </div>
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          <section className="border border-bone-600/20 bg-ink-900/60 p-6">
            <SystemLabel>RELIABILITY DIMENSIONS</SystemLabel>
            <div className="mt-6 grid gap-5">
              <MetricLine label="TASK SUCCESS" value={evaluation.metrics.taskSuccess} color={METRIC_COLORS.taskSuccess} />
              <MetricLine label="TOOL ACCURACY" value={evaluation.metrics.toolAccuracy} color={METRIC_COLORS.toolAccuracy} />
              <MetricLine label="SAFETY" value={evaluation.metrics.safety} color={METRIC_COLORS.safety} />
              <MetricLine label="LOOP RESISTANCE" value={evaluation.metrics.consistency} color={METRIC_COLORS.consistency} />
              <MetricLine label="GROUNDEDNESS" value={evaluation.metrics.groundedness} color={METRIC_COLORS.groundedness} />
            </div>
          </section>
          <section className="border border-bone-600/20 bg-ink-900/60 p-6">
            <SystemLabel>OUTCOMES</SystemLabel>
            <div className="mt-6 grid grid-cols-3 gap-3 text-center">
              <div className="border border-flux-500/25 p-4"><strong className="massive text-3xl text-flux-400">{evaluation.passed}</strong><p className="mt-1 font-mono text-[9px] text-bone-500">PASSED</p></div>
              <div className="border border-fault-500/25 p-4"><strong className="massive text-3xl text-fault-400">{evaluation.failed}</strong><p className="mt-1 font-mono text-[9px] text-bone-500">FAILED</p></div>
              <div className="border border-warn-500/25 p-4"><strong className="massive text-3xl text-warn-400">{evaluation.warnings}</strong><p className="mt-1 font-mono text-[9px] text-bone-500">WARNINGS</p></div>
            </div>
            <div className="mt-5 space-y-2">
              {evaluation.failureBreakdown.filter((item) => item.count > 0).map((item) => (
                <div key={item.category} className="flex items-center justify-between border-b border-bone-600/15 py-2 text-sm text-bone-300">
                  <span>{item.category}</span><span className="font-mono text-fault-400">{item.count} · {item.severity}</span>
                </div>
              ))}
            </div>
          </section>
        </div>

        <section className="mt-8">
          <SystemLabel>SCENARIO EVIDENCE / {evaluation.tests.length}</SystemLabel>
          <div className="mt-4 space-y-4">
            {evaluation.tests.map((test) => (
              <details key={test.id} className="group border border-bone-600/20 bg-ink-900/55">
                <summary className="flex min-h-14 cursor-pointer list-none flex-wrap items-center gap-3 px-5 py-4">
                  <span className={`font-mono text-[10px] uppercase tracking-wider ${test.status === 'passed' ? 'text-flux-400' : test.status === 'warning' ? 'text-warn-400' : 'text-fault-400'}`}>{test.status}</span>
                  <strong className="text-sm text-bone-100">{test.title}</strong>
                  <span className="ml-auto font-mono text-[9px] uppercase tracking-wider text-bone-600">{test.category} · OPEN TRACE</span>
                </summary>
                <div className="border-t border-bone-600/20 p-5">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div><SystemLabel>USER PROMPT</SystemLabel><p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-bone-300">{test.userPrompt}</p></div>
                    <div><SystemLabel>EXPECTED</SystemLabel><p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-bone-300">{test.expectedBehavior}</p></div>
                  </div>
                  <div className="mt-5"><SystemLabel>AGENT RESPONSE</SystemLabel><p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-bone-300">{test.agentResponse}</p></div>
                  {(test.explanation || test.recommendation) && <div className="mt-5 border-l-2 border-fault-500/45 bg-fault-500/5 p-4 text-sm text-bone-300">{test.explanation}{test.recommendation && <p className="mt-2 text-bone-400">{test.recommendation}</p>}</div>}
                  <div className="mt-5"><IncidentTrace events={test.trace} /></div>
                </div>
              </details>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
