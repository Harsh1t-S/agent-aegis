import { useParams } from 'react-router-dom';
import { LockKeyhole } from 'lucide-react';
import { IncidentTrace } from '@/components/IncidentTrace';
import { MetricLine } from '@/components/MetricLine';
import { ErrorState, LoadingState } from '@/components/AsyncState';
import { Eyebrow, Glow } from '@/components/SiteSection';
import { useResource } from '@/hooks/useResource';
import { api } from '@/lib/api';
import { formatDate, verdictFor } from '@/lib/format';
import { METRIC_COLORS } from '@/lib/palette';
import { sectionTitle } from '@/lib/ui';

const fieldTitle = 'text-xs font-medium text-bone-400';

export default function SharedReport() {
  const { token } = useParams<{ token: string }>();
  const resource = useResource(
    () => api.sharedReport(token as string),
    [token],
    { enabled: Boolean(token) },
  );

  if (resource.loading) return <div className="min-h-screen bg-ink-950 pt-24"><LoadingState label="Opening private report" /></div>;
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
    <main className="relative isolate min-h-screen bg-ink-950 px-4 pb-24 pt-28 text-bone-100 sm:px-6 md:px-10">
      <Glow at="top" />
      <div className="mx-auto max-w-6xl">
        <p className="flex items-start gap-2 border border-warn-500/30 bg-warn-500/5 p-4 text-sm leading-relaxed text-bone-300">
          <LockKeyhole className="mt-0.5 h-4 w-4 shrink-0 text-warn-400" aria-hidden />
          <span>
            <strong className="font-semibold text-warn-300">Private link.</strong>{' '}
            This read-only report expires {formatDate(resource.data.share.expiresAt)}. Forwarding the URL gives the recipient the same access.
          </span>
        </p>

        <div className="mt-10 grid gap-8 lg:grid-cols-[1fr_auto] lg:items-end">
          <div className="min-w-0">
            <Eyebrow>Shared reliability report</Eyebrow>
            <h1 className="mt-4 break-words font-display text-[clamp(2.4rem,6vw,4.5rem)] font-bold leading-[1.02] tracking-ultraTight text-bone-50">
              {evaluation.agentName}
            </h1>
            <p className="mt-3 text-sm text-bone-300">
              {evaluation.version} · {formatDate(evaluation.date)} · Read only
            </p>
          </div>
          <div className="relative border border-bone-600/30 bg-ink-900/70 px-8 py-6 text-center">
            <div aria-hidden className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-signal-400/70 to-transparent" />
            <div className="font-display text-6xl font-bold tracking-tightest text-bone-50">{evaluation.score.toFixed(1)}</div>
            <div className="mt-1 text-sm text-bone-300">{verdictFor(evaluation.score)}</div>
          </div>
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          <section className="border border-bone-600/25 bg-ink-900/60 p-6">
            <h2 className={sectionTitle}>Reliability dimensions</h2>
            <div className="mt-6 grid gap-5">
              <MetricLine label="Task success" value={evaluation.metrics.taskSuccess} color={METRIC_COLORS.taskSuccess} />
              <MetricLine label="Tool accuracy" value={evaluation.metrics.toolAccuracy} color={METRIC_COLORS.toolAccuracy} />
              <MetricLine label="Safety" value={evaluation.metrics.safety} color={METRIC_COLORS.safety} />
              <MetricLine label="Loop resistance" value={evaluation.metrics.consistency} color={METRIC_COLORS.consistency} />
              <MetricLine label="Groundedness" value={evaluation.metrics.groundedness} color={METRIC_COLORS.groundedness} />
            </div>
          </section>
          <section className="border border-bone-600/25 bg-ink-900/60 p-6">
            <h2 className={sectionTitle}>Outcomes</h2>
            <div className="mt-6 grid grid-cols-3 gap-3 text-center">
              <div className="border border-flux-500/25 p-4"><strong className="font-display text-3xl font-bold text-flux-400">{evaluation.passed}</strong><p className="mt-1 text-sm text-bone-300">Passed</p></div>
              <div className="border border-fault-500/25 p-4"><strong className="font-display text-3xl font-bold text-fault-400">{evaluation.failed}</strong><p className="mt-1 text-sm text-bone-300">Failed</p></div>
              <div className="border border-warn-500/25 p-4"><strong className="font-display text-3xl font-bold text-warn-400">{evaluation.warnings}</strong><p className="mt-1 text-sm text-bone-300">Warnings</p></div>
            </div>
            <div className="mt-5 space-y-2">
              {evaluation.failureBreakdown.filter((item) => item.count > 0).map((item) => (
                <div key={item.category} className="flex items-center justify-between gap-3 border-b border-bone-600/15 py-2 text-sm text-bone-300">
                  <span>{item.category}</span><span className="font-mono text-fault-400">{item.count} · {item.severity}</span>
                </div>
              ))}
            </div>
          </section>
        </div>

        <section className="mt-10">
          <h2 className={sectionTitle}>Scenario evidence · {evaluation.tests.length}</h2>
          <div className="mt-4 space-y-4">
            {evaluation.tests.map((test) => (
              <details key={test.id} className="group border border-bone-600/25 bg-ink-900/55">
                <summary className="flex min-h-14 cursor-pointer list-none flex-wrap items-center gap-3 px-5 py-4">
                  <span className={`text-sm font-semibold capitalize ${test.status === 'passed' ? 'text-flux-400' : test.status === 'warning' ? 'text-warn-400' : 'text-fault-400'}`}>{test.status}</span>
                  <strong className="text-sm text-bone-100">{test.title}</strong>
                  <span className="ml-auto text-sm text-bone-400">{test.category} · Open trace</span>
                </summary>
                <div className="border-t border-bone-600/20 p-5">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div><p className={fieldTitle}>User prompt</p><p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-bone-300">{test.userPrompt}</p></div>
                    <div><p className={fieldTitle}>Expected</p><p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-bone-300">{test.expectedBehavior}</p></div>
                  </div>
                  <div className="mt-5"><p className={fieldTitle}>Agent response</p><p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-bone-300">{test.agentResponse}</p></div>
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
