import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { NextSteps, PageHeader } from '@/components/PageHeader';
import { IncidentTrace } from '@/components/IncidentTrace';
import { FailureAnalysis } from '@/components/FailureAnalysis';
import { ErrorState, LoadingState } from '@/components/AsyncState';
import { useToast } from '@/components/Toaster';
import { useResource } from '@/hooks/useResource';
import { api, ApiError } from '@/lib/api';
import { severityTone, testStatusTone } from '@/lib/format';
import { Check, Copy, Loader2, RotateCcw, ArrowLeft } from 'lucide-react';
import type { ReviewDecision } from '@/types';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { buttonPrimary, buttonSecondary, card } from '@/lib/ui';

export default function TestTrace() {
  const { evaluationId, testId } = useParams<{ evaluationId: string; testId: string }>();
  const navigate = useNavigate();
  const workspace = useWorkspace();
  const canMutate = workspace.current?.role !== 'viewer';
  const toast = useToast();
  const [copied, setCopied] = useState(false);
  const [replaying, setReplaying] = useState(false);
  const [review, setReview] = useState<ReviewDecision>('confirmed_issue');
  const [reviewNote, setReviewNote] = useState('');
  const [savingReview, setSavingReview] = useState(false);
  const { data: evaluation, error, loading, reload } = useResource(
    () => api.testRun(evaluationId as string, testId as string),
    [evaluationId, testId],
    { enabled: Boolean(evaluationId && testId), pollMs: 2000,
      pollWhile: (run) => run.canContinue !== false && (run.status === 'pending' || run.status === 'running') },
  );
  const loadedTest = evaluation?.test;
  useEffect(() => {
    if (!loadedTest) return;
    setReview(loadedTest.review?.decision
      ?? (loadedTest.status === 'passed' ? 'confirmed_correct' : 'confirmed_issue'));
    setReviewNote(loadedTest.review?.note ?? '');
  }, [loadedTest]);

  if (loading) {
    return (
      <LoadingState label="Loading incident" />
    );
  }

  const test = evaluation?.test;
  if (!test && evaluation && !error && evaluation.status === 'canceled') {
    return (
      <div className="py-16 text-center">
        <p className="font-mono text-sm text-bone-400">Scenario canceled</p>
        <p className="mt-3 text-sm text-bone-300">
          This scenario was canceled before it produced a trace.
        </p>
      </div>
    );
  }
  if (!test && evaluation && !error) {
    return (
      <div>
        <LoadingState label="Scenario in progress" />
        <p className="text-center font-mono text-sm text-bone-300">
          {evaluation.canContinue === false
            ? 'The evaluation worker is offline. This queued scenario will resume when the worker returns.'
            : 'The scenario is executing. This page switches to the saved trace as soon as it completes.'}
        </p>
      </div>
    );
  }

  if (error || !test) {
    return (
      <div className="py-8">
        <ErrorState
          message={error ?? 'This scenario run is not part of the evaluation.'}
          onRetry={reload}
        />
        <div className="mt-6 text-center">
          <Link to={evaluationId ? `/app/evaluations/${evaluationId}` : '/app/evaluations'} className={buttonSecondary}>
            Back to report
          </Link>
        </div>
      </div>
    );
  }

  const cfg = testStatusTone[test.status];
  const isFail = test.status === 'failed';

  const copyRecommendation = async () => {
    if (!test.recommendation) return;
    try {
      await navigator.clipboard.writeText(test.recommendation);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
      toast.error('Could not copy', 'This browser blocked clipboard access.');
    }
  };

  const replay = async () => {
    setReplaying(true);
    try {
      const queued = await api.rerunTest(test.id);
      toast.success('Re-run queued', 'Following the replacement run.');
      navigate(`/app/evaluations/${evaluationId}/tests/${queued.runId}`, { replace: true });
    } catch (err) {
      toast.error(
        'Could not re-run',
        err instanceof ApiError ? err.message : 'The re-run was not queued.',
      );
    } finally {
      setReplaying(false);
    }
  };

  const saveReview = async () => {
    setSavingReview(true);
    try {
      await api.reviewFinding(test.id, review, reviewNote.trim());
      toast.success('Finding review saved', 'The decision is recorded in the workspace audit trail.');
    } catch (cause) {
      toast.error('Review not saved', cause instanceof Error ? cause.message : 'Try again.');
    } finally {
      setSavingReview(false);
    }
  };

  const nextSteps = [
    { to: `/app/evaluations/${evaluationId}`, label: 'Back to the full report', hint: 'Every scenario in this run.' },
    { to: '/app/compare', label: 'Compare versions', hint: 'Check whether a fix removed this failure.' },
    { to: '/app/agents', label: 'Open the agent', hint: 'Edit its prompt or tools, then run again.' },
  ];

  return (
    <>
        <PageHeader
          crumbs={[
            { label: 'Runs', to: '/app/evaluations' },
            { label: `${evaluation?.agentName ?? 'Evaluation'} ${evaluation?.version ?? ''}`.trim(), to: `/app/evaluations/${evaluationId}` },
            { label: 'Scenario' },
          ]}
          meta={(
            <>
              <span className={`border px-2 py-0.5 text-sm font-medium ${cfg.color} border-current/50`}>
                {test.executionError ? 'Execution error' : cfg.label}
              </span>
              {test.severity && (
                <span className={`border px-2 py-0.5 text-sm ${severityTone[test.severity]} capitalize`}>
                  {test.severity}
                </span>
              )}
              {isFail && test.failureType && <span className="text-sm font-medium text-fault-400">{test.failureType}</span>}
              <span className="text-sm text-bone-300">{test.category}</span>
            </>
          )}
          title={test.title}
          description={(
            <>
              <span className="font-mono text-sm text-bone-400">
                Run {test.id} · scenario {test.scenarioId} · {test.durationMs} ms
              </span>
            </>
          )}
          actions={(
            <>
              {canMutate && (
                <button type="button" onClick={replay} disabled={replaying} className={buttonSecondary}>
                  {replaying ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <RotateCcw className="h-4 w-4" aria-hidden />}
                  Re-run this scenario
                </button>
              )}
              <Link to={`/app/evaluations/${evaluationId}`} className={buttonPrimary}>
                <ArrowLeft className="h-4 w-4" aria-hidden /> Back to report
              </Link>
            </>
          )}
        />

        <div className="grid min-w-0 gap-6 md:grid-cols-2">
          <div>
            <div className={card}>
              <h2 className="font-display text-lg font-semibold text-bone-50">Scenario prompt</h2>
              <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-bone-200">
                {test.userPrompt}
              </p>
            </div>
          </div>
          <div>
            <div className="border border-flux-500/40 bg-flux-500/5 p-4 sm:p-6">
              <h2 className="font-display text-lg font-semibold text-flux-300">Expected behavior</h2>
              <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-bone-200">
                {test.expectedBehavior}
              </p>
            </div>
          </div>
        </div>

        <div className="mt-6">
          <div className={card}>
            <div className="flex items-center gap-2">
              <span className={`flex h-2 w-2 rounded-full ${isFail ? 'bg-fault-500' : 'bg-flux-500'}`} />
              <h2 className="font-display text-lg font-semibold text-bone-50">Agent response</h2>
            </div>
            <div className="mt-4 whitespace-pre-wrap border-l-2 border-bone-600/30 pl-4 font-mono text-sm leading-relaxed text-bone-200">
              {test.agentResponse || (
                <span className="text-bone-400">The agent produced no final answer.</span>
              )}
            </div>
          </div>
        </div>

        <div className="mt-6">
          <IncidentTrace events={test.trace} />
        </div>

        {(test.explanation || test.recommendation) && (
          <div className="mt-6">
            <FailureAnalysis
              why={test.explanation ?? 'No explanation was recorded for this run.'}
              recommendation={
                test.recommendation ?? 'No remediation was recorded for this run.'
              }
            />
          </div>
        )}

        {canMutate && !test.executionError && evaluation.canContinue !== false && (
          <div className="mt-6">
            <div className={card}>
              <h2 className="font-display text-lg font-semibold text-bone-50">Human review</h2>
              <p className="mt-2 text-sm leading-relaxed text-bone-300">
                Confirm whether this result matches your policy. The label builds a benchmark and never rewrites the original score or trace.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                {(test.status === 'passed' ? ([
                  ['confirmed_correct', 'Confirmed correct'],
                  ['missed_issue', 'Missed issue'],
                ] as const) : ([
                  ['confirmed_issue', 'Confirmed issue'],
                  ['false_positive', 'False positive'],
                  ['accepted_risk', 'Accepted risk'],
                ] as const)).map(([value, label]) => (
                  <button key={value} type="button" aria-pressed={review === value}
                    onClick={() => setReview(value)}
                    className={`min-h-11 border px-4 text-sm ${review === value ? 'border-signal-400 bg-signal-500/15 font-medium text-signal-300' : 'border-bone-600/40 text-bone-200 hover:border-bone-300/60'}`}>
                    {label}
                  </button>
                ))}
              </div>
              <textarea value={reviewNote} onChange={(event) => setReviewNote(event.target.value)}
                maxLength={4000} placeholder="Optional note, ticket, or reason…"
                className="mt-4 min-h-24 w-full resize-y border border-bone-600/40 bg-ink-950 p-3 text-sm text-bone-100 placeholder:text-bone-400 focus-visible:border-signal-400" />
              <button type="button" onClick={() => void saveReview()} disabled={savingReview} className={`${buttonSecondary} mt-3`}>
                {savingReview && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />} Save review
              </button>
            </div>
          </div>
        )}

        <div className="mt-6 flex flex-wrap items-center gap-3">
          {test.recommendation && (
            <button type="button" onClick={copyRecommendation} className={buttonSecondary}>
              {copied ? <Check className="h-4 w-4 text-flux-400" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />}
              {copied ? 'Copied' : 'Copy recommendation'}
            </button>
          )}
        </div>

        <NextSteps steps={nextSteps} />
    </>
  );
}
