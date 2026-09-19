import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { AppNavigation } from '@/components/AppNavigation';
import { IncidentTrace } from '@/components/IncidentTrace';
import { FailureAnalysis } from '@/components/FailureAnalysis';
import { ScrollReveal } from '@/components/ScrollReveal';
import { SystemLabel } from '@/components/SystemLabel';
import { ErrorState, LoadingState } from '@/components/AsyncState';
import { useToast } from '@/components/Toaster';
import { useResource } from '@/hooks/useResource';
import { api, ApiError } from '@/lib/api';
import { severityTone, testStatusTone } from '@/lib/format';
import { Check, Copy, Loader2, RotateCcw, ArrowLeft } from 'lucide-react';
import type { ReviewDecision } from '@/types';
import { useWorkspace } from '@/contexts/WorkspaceContext';

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
      <div className="min-h-screen bg-ink-950">
        <AppNavigation />
        <LoadingState label="LOADING INCIDENT" />
      </div>
    );
  }

  const test = evaluation?.test;
  if (!test && evaluation && !error) {
    return (
      <div className="min-h-screen bg-ink-950">
        <AppNavigation />
        <LoadingState label="SCENARIO IN PROGRESS" />
        <p className="px-6 text-center font-mono text-[11px] text-bone-500">
          {evaluation.canContinue === false
            ? 'The evaluation worker is offline. This queued scenario will resume when the worker returns.'
            : 'The scenario is executing. This page switches to the saved trace as soon as it completes.'}
        </p>
      </div>
    );
  }

  if (error || !test) {
    return (
      <div className="min-h-screen bg-ink-950">
        <AppNavigation />
        <div className="px-6 py-16 md:px-10">
          <ErrorState
            message={error ?? 'This scenario run is not part of the evaluation.'}
            onRetry={reload}
          />
          <div className="mt-6 text-center">
            <Link
              to={evaluationId ? `/app/evaluations/${evaluationId}` : '/app/agents'}
              className="border border-signal-500/40 px-6 py-3 font-mono text-xs uppercase tracking-wider text-signal-400 hover:bg-signal-500/10"
            >
              BACK TO RESULTS
            </Link>
          </div>
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

  return (
    <div className="min-h-screen bg-ink-950">
      <AppNavigation />

      <div className="px-4 py-8 sm:px-6 md:px-10">
        <div className="flex flex-wrap items-center gap-2 font-mono text-[10px] uppercase tracking-wider text-bone-500">
          <Link
            to={`/app/evaluations/${evaluationId}`}
            className="inline-flex min-h-9 items-center hover:text-bone-200"
          >
            {evaluation?.agentName?.toUpperCase() ?? 'EVALUATION'}
          </Link>
          <span>/</span>
          <span>{evaluation?.version}</span>
          <span>/</span>
          <span className="text-signal-400">{test.title.toUpperCase()}</span>
        </div>

        <div className="mt-6 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <SystemLabel>INCIDENT REPORT</SystemLabel>
              <span
                className={`border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider ${cfg.color} border-current/40`}
              >
                {test.executionError ? 'EXECUTION ERROR' : cfg.label}
              </span>
              {test.severity && (
                <span
                  className={`border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider ${severityTone[test.severity]}`}
                >
                  {test.severity}
                </span>
              )}
              <span className="tech-label text-bone-600">{test.category}</span>
            </div>
            {isFail && test.failureType ? (
              <h1 className="massive mt-4 text-[clamp(2rem,5vw,3.5rem)] text-fault-500">
                {test.failureType.toUpperCase()}.
              </h1>
            ) : (
              <h1 className="massive mt-4 text-[clamp(1.5rem,4vw,2.75rem)] text-bone-50">
                {test.title}
              </h1>
            )}
            <p className="mt-2 font-mono text-[11px] text-bone-500">
              Run {test.id} · scenario {test.scenarioId} · {test.durationMs} ms
            </p>
          </div>
          <Link
            to={`/app/evaluations/${evaluationId}`}
            className="flex h-fit min-h-11 items-center gap-2 font-mono text-[11px] uppercase tracking-wider text-bone-400 transition-colors hover:text-bone-100"
          >
            <ArrowLeft className="h-4 w-4" /> BACK TO RESULTS
          </Link>
        </div>

        <div className="mt-12 grid min-w-0 gap-6 md:grid-cols-2">
          <ScrollReveal>
            <div className="border border-bone-600/20 bg-ink-900/60 p-6">
              <SystemLabel>SCENARIO PROMPT</SystemLabel>
              <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-bone-200">
                {test.userPrompt}
              </p>
            </div>
          </ScrollReveal>
          <ScrollReveal delay={0.1}>
            <div className="border border-flux-500/20 bg-flux-500/5 p-6">
              <SystemLabel className="text-flux-400">EXPECTED BEHAVIOR</SystemLabel>
              <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-bone-200">
                {test.expectedBehavior}
              </p>
            </div>
          </ScrollReveal>
        </div>

        <ScrollReveal className="mt-6">
          <div className="border border-bone-600/20 bg-ink-900/80 p-6">
            <div className="flex items-center gap-2">
              <span className={`flex h-2 w-2 rounded-full ${isFail ? 'bg-fault-500' : 'bg-flux-500'}`} />
              <SystemLabel>AGENT RESPONSE</SystemLabel>
            </div>
            <div className="mt-4 whitespace-pre-wrap border-l-2 border-bone-600/30 pl-4 font-mono text-sm leading-relaxed text-bone-200">
              {test.agentResponse || (
                <span className="text-bone-600">The agent produced no final answer.</span>
              )}
            </div>
          </div>
        </ScrollReveal>

        <ScrollReveal className="mt-6">
          <IncidentTrace events={test.trace} />
        </ScrollReveal>

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
          <ScrollReveal className="mt-6">
            <div className="border border-bone-600/20 bg-ink-900/60 p-6">
              <SystemLabel>HUMAN REVIEW</SystemLabel>
              <p className="mt-2 text-sm leading-relaxed text-bone-400">
                Confirm whether this result matches your policy. The label builds a benchmark and never rewrites the original score or trace.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                {(test.status === 'passed' ? ([
                  ['confirmed_correct', 'CONFIRMED CORRECT'],
                  ['missed_issue', 'MISSED ISSUE'],
                ] as const) : ([
                  ['confirmed_issue', 'CONFIRMED ISSUE'],
                  ['false_positive', 'FALSE POSITIVE'],
                  ['accepted_risk', 'ACCEPTED RISK'],
                ] as const)).map(([value, label]) => (
                  <button key={value} type="button" aria-pressed={review === value}
                    onClick={() => setReview(value)}
                    className={`min-h-10 border px-3 font-mono text-[10px] uppercase tracking-wider ${review === value ? 'border-signal-500/55 bg-signal-500/10 text-signal-300' : 'border-bone-600/30 text-bone-400'}`}>
                    {label}
                  </button>
                ))}
              </div>
              <textarea value={reviewNote} onChange={(event) => setReviewNote(event.target.value)}
                maxLength={4000} placeholder="Optional note, ticket, or reason…"
                className="mt-4 min-h-24 w-full resize-y border border-bone-600/30 bg-ink-950/60 p-3 text-sm text-bone-100 outline-none placeholder:text-bone-600 focus:border-signal-500/50" />
              <button type="button" onClick={() => void saveReview()} disabled={savingReview}
                className="mt-3 flex min-h-11 items-center gap-2 border border-signal-500/40 bg-signal-500/10 px-4 font-mono text-[11px] uppercase tracking-wider text-signal-300 disabled:opacity-50">
                {savingReview && <Loader2 className="h-3.5 w-3.5 animate-spin" />} SAVE REVIEW
              </button>
            </div>
          </ScrollReveal>
        )}

        <ScrollReveal className="mt-6">
          <div className="flex flex-wrap items-center gap-3">
            {test.recommendation && (
              <button
                type="button"
                onClick={copyRecommendation}
                className="flex min-h-11 items-center gap-2 border border-bone-600/30 px-4 font-mono text-[11px] uppercase tracking-wider text-bone-300 transition-colors hover:border-signal-500/40 hover:text-signal-400"
              >
                {copied ? <Check className="h-3.5 w-3.5 text-flux-400" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? 'COPIED' : 'COPY RECOMMENDATION'}
              </button>
            )}
            {canMutate && <button
              type="button"
              onClick={replay}
              disabled={replaying}
              className="flex min-h-11 items-center gap-2 border border-bone-600/30 px-4 font-mono text-[11px] uppercase tracking-wider text-bone-300 transition-colors enabled:hover:border-signal-500/40 enabled:hover:text-signal-400 disabled:opacity-50"
            >
              {replaying ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <RotateCcw className="h-3.5 w-3.5" />
              )}
              RE-RUN THIS SCENARIO
            </button>}
          </div>
        </ScrollReveal>
      </div>
    </div>
  );
}
