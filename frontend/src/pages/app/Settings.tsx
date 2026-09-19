import { useEffect, useState } from 'react';
import { AppNavigation } from '@/components/AppNavigation';
import { SystemLabel } from '@/components/SystemLabel';
import { MassiveHeading } from '@/components/MassiveHeading';
import { AsyncBoundary } from '@/components/AsyncState';
import { useToast } from '@/components/Toaster';
import { useResource } from '@/hooks/useResource';
import { api } from '@/lib/api';
import {
  DEFAULT_SETTINGS,
  perCategoryFor,
  useWorkspaceSettings,
} from '@/lib/workspace-settings';
import { RotateCcw } from 'lucide-react';
import { useWorkspace } from '@/contexts/WorkspaceContext';

export default function Settings() {
  const { settings, update, reset, storageAvailable, saving, saveError } = useWorkspaceSettings();
  const workspace = useWorkspace();
  const scoring = useResource(() => api.scoring(), []);
  const workspaceInfo = useResource(() => api.workspace(), [workspace.current?.id]);
  const toast = useToast();
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [notificationEmail, setNotificationEmail] = useState('');
  const [spendCap, setSpendCap] = useState('');
  const canManageWorkspace = workspace.current?.role === 'owner' || workspace.current?.role === 'admin';

  useEffect(() => {
    setNotificationEmail(settings.notifications?.email ?? '');
  }, [settings.notifications?.email]);

  useEffect(() => {
    const value = settings.monthlySpendCapUsd ?? workspaceInfo.data?.usage.spendCapUsd;
    if (value !== undefined) setSpendCap(String(value));
  }, [settings.monthlySpendCapUsd, workspaceInfo.data?.usage.spendCapUsd]);

  const perCategory = perCategoryFor(settings.scenariosPerRun);
  const actual = perCategory * (settings.adversarial ? 4 : 3);

  return (
    <div className="min-h-screen bg-ink-950">
      <AppNavigation />

      <div className="px-4 py-8 sm:px-6 md:px-10">
        <SystemLabel>WORKSPACE / DEFAULTS</SystemLabel>
        <MassiveHeading
          lines={['EVALUATION', 'DEFAULTS.']}
          className="mt-2 text-[clamp(2rem,6vw,4rem)] text-bone-50"
        />
        <p className="mt-4 max-w-2xl text-sm leading-relaxed text-bone-400">
          These defaults are saved to the active workspace and follow your team across
          devices. Each connected agent can still choose its own runner endpoint.
        </p>

        {!storageAvailable && (
          <p role="status" className="mt-4 border border-warn-500/40 p-4 text-sm text-warn-400">
            The local cache is unavailable. Changes still save to the workspace, but this tab may take longer to restore them after a reload.
          </p>
        )}
        {saveError && <p role="alert" className="mt-4 border border-fault-500/40 p-4 text-sm text-fault-400">{saveError}</p>}
        {!canManageWorkspace && (
          <p className="mt-4 border border-bone-600/25 p-4 text-sm text-bone-400">
            These settings are read-only for your role. Ask a workspace administrator to change them.
          </p>
        )}
        <div className="mt-10 grid min-w-0 gap-6 lg:grid-cols-2">
          <section className="min-w-0 border border-bone-600/20 bg-ink-900/60 p-5 sm:p-6">
            <SystemLabel>SUITE SIZE</SystemLabel>
            <label htmlFor="scenarios" className="mt-4 block text-sm text-bone-300">
              Scenarios per run
            </label>
            <input
              id="scenarios"
              type="number"
              min={4}
              max={40}
              disabled={!canManageWorkspace}
              value={settings.scenariosPerRun}
              onChange={(e) => {
                const raw = Number(e.target.value);
                if (!Number.isFinite(raw)) return;
                update({ scenariosPerRun: Math.max(4, Math.min(40, Math.round(raw))) });
              }}
              className="mt-2 w-full border border-bone-300/35 bg-ink-950/60 px-4 py-3 font-mono text-base text-bone-50 focus:border-signal-400/70 focus:outline-none sm:text-sm"
            />
            <p className="mt-3 font-mono text-[10px] leading-relaxed text-bone-500">
              Scenarios are generated per category, so the number is rounded to a whole
              number per category. At {settings.scenariosPerRun} this run generates{' '}
              <span className="text-bone-200">{perCategory} per category</span> across{' '}
              {settings.adversarial ? 'four' : 'three'} categories —{' '}
              <span className="text-bone-200">about {actual} scenarios</span>. Saying "12"
              and silently running 8 is exactly the kind of gap this product exists to
              catch.
            </p>
          </section>

          <section className="min-w-0 border border-bone-600/20 bg-ink-900/60 p-5 sm:p-6">
            <SystemLabel>ADVERSARIAL COVERAGE</SystemLabel>
            <button
              type="button"
              role="switch"
              aria-checked={settings.adversarial}
              disabled={!canManageWorkspace}
              onClick={() => update({ adversarial: !settings.adversarial })}
              className="mt-4 flex w-full items-center justify-between gap-4 border border-bone-600/25 bg-ink-950/40 p-4 text-left transition-colors hover:border-signal-500/40"
            >
              <span className="min-w-0">
                <span className="block text-sm text-bone-100">Adversarial scenarios</span>
                <span className="mt-1 block text-xs leading-relaxed text-bone-400">
                  Inject prompt-injection, jailbreak and contradictory-instruction variants
                  into every run.
                </span>
              </span>
              <span
                className={`relative h-6 w-11 shrink-0 rounded-full border transition-colors ${
                  settings.adversarial
                    ? 'border-signal-500/60 bg-signal-500/25'
                    : 'border-bone-600/40 bg-ink-850'
                }`}
              >
                <span
                  className={`absolute top-1/2 h-4 w-4 -translate-y-1/2 rounded-full transition-all ${
                    settings.adversarial
                      ? 'left-[calc(100%-1.25rem)] bg-signal-300'
                      : 'left-1 bg-bone-500'
                  }`}
                />
              </span>
            </button>
            <p className="mt-3 font-mono text-[10px] leading-relaxed text-bone-500">
              This gates scenario <span className="text-bone-200">generation</span>, not the
              agent under test. Turning it off removes the hardest scenarios, so the score
              goes <span className="text-bone-200">up</span> — that is the honest reading,
              not an improvement.
            </p>
          </section>

          <section className="min-w-0 border border-bone-600/20 bg-ink-900/60 p-5 sm:p-6">
            <SystemLabel>AGENT UNDER TEST</SystemLabel>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {(
                [
                  {
                    key: 'behavioral' as const,
                    title: 'Behavioral stand-in',
                    detail:
                      'A deterministic scripted agent. Same trace every time, so a demo and a regression diff are reproducible.',
                  },
                  {
                    key: 'llm' as const,
                    title: 'Real model',
                    detail:
                      'Runs the prompt and tools against the evaluator server model. This can be a self-hosted OpenAI-compatible model; the exact model is pinned in every report.',
                  },
                ]
              ).map((option) => (
                <button
                  key={option.key}
                  type="button"
                  aria-pressed={settings.adapter === option.key}
                  disabled={!canManageWorkspace}
                  onClick={() => update({ adapter: option.key })}
                  className={`min-w-0 border p-4 text-left transition-colors ${
                    settings.adapter === option.key
                      ? 'border-signal-500/50 bg-signal-500/10'
                      : 'border-bone-600/25 hover:border-bone-500/40'
                  }`}
                >
                  <span
                    className={`block font-mono text-[11px] uppercase tracking-wider ${
                      settings.adapter === option.key ? 'text-signal-300' : 'text-bone-300'
                    }`}
                  >
                    {option.title}
                  </span>
                  <span className="mt-2 block text-xs leading-relaxed text-bone-400">
                    {option.detail}
                  </span>
                </button>
              ))}
            </div>
          </section>

          <section className="min-w-0 border border-bone-600/20 bg-ink-900/60 p-5 sm:p-6">
            <SystemLabel>MODEL SPEND CEILING</SystemLabel>
            <p className="mt-2 text-xs leading-relaxed text-bone-400">
              Aegis reserves a conservative provider-cost estimate before starting a model-backed run. Free behavioral and connected-agent runs reserve $0.
            </p>
            <label htmlFor="spend-cap" className="mt-4 block text-sm text-bone-300">Monthly cap in USD</label>
            <input id="spend-cap" type="number" min={0} step="0.01"
              max={workspaceInfo.data?.usage.plan.monthly_model_spend_cap_usd}
              value={spendCap} disabled={!canManageWorkspace}
              onChange={(event) => setSpendCap(event.target.value)}
              onBlur={() => {
                const parsed = Number(spendCap);
                if (!Number.isFinite(parsed)) return;
                const planMaximum = workspaceInfo.data?.usage.plan.monthly_model_spend_cap_usd ?? parsed;
                const capped = Math.max(0, Math.min(parsed, planMaximum));
                setSpendCap(String(capped));
                update({ monthlySpendCapUsd: capped });
              }}
              className="mt-2 w-full border border-bone-300/35 bg-ink-950/60 px-4 py-3 font-mono text-base text-bone-50 disabled:opacity-50" />
            {workspaceInfo.data && (
              <p className="mt-3 font-mono text-[10px] leading-relaxed text-bone-500">
                ${workspaceInfo.data.usage.estimatedCostUsd.toFixed(4)} settled · ${workspaceInfo.data.usage.reservedCostUsd.toFixed(4)} reserved · plan maximum ${workspaceInfo.data.usage.plan.monthly_model_spend_cap_usd.toFixed(2)}
              </p>
            )}
          </section>

          <section className="min-w-0 border border-bone-600/20 bg-ink-900/60 p-5 sm:p-6">
            <SystemLabel>SCORING CONTRACT</SystemLabel>
            <p className="mt-2 text-xs leading-relaxed text-bone-400">
              Published by the API, not configurable here. Weights and severity ceilings are
              part of the contract a result is graded against — a workspace that could move
              them could make any agent look reliable.
            </p>
            <AsyncBoundary
              loading={scoring.loading}
              error={scoring.error}
              onRetry={scoring.reload}
              label="LOADING CONTRACT"
            >
              {scoring.data && (
                <div className="mt-4 space-y-4">
                  <div>
                    <p className="tech-label text-bone-600">WEIGHTS</p>
                    <ul className="mt-2 space-y-1">
                      {Object.entries(scoring.data.weights).map(([key, weight]) => (
                        <li
                          key={key}
                          className="flex items-center justify-between gap-3 font-mono text-[11px]"
                        >
                          <span className="uppercase tracking-wider text-bone-400">
                            {key.replace(/_/g, ' ')}
                          </span>
                          <span className="text-bone-100">{Math.round(weight * 100)}%</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <p className="tech-label text-bone-600">SEVERITY CEILINGS</p>
                    <ul className="mt-2 space-y-1">
                      {scoring.data.gates.map((gate) => (
                        <li key={gate.when} className="font-mono text-[11px] text-bone-400">
                          <span className="text-bone-100">≤ {gate.atMost}</span> — {gate.when}
                        </li>
                      ))}
                    </ul>
                  </div>
                  {scoring.data.evaluator && (
                    <div>
                      <p className="tech-label text-bone-600">DEPLOYED EVALUATOR</p>
                      <ul className="mt-2 space-y-1">
                        {(['generator', 'guardrail', 'detector', 'profile', 'scorer'] as const).map(
                          (key) => (
                            <li
                              key={key}
                              className="flex items-center justify-between gap-3 font-mono text-[11px]"
                            >
                              <span className="uppercase tracking-wider text-bone-400">
                                {key}
                              </span>
                              <span className="text-bone-100">
                                {scoring.data!.evaluator![key]}
                              </span>
                            </li>
                          ),
                        )}
                        <li className="flex items-center justify-between gap-3 font-mono text-[11px]">
                          <span className="uppercase tracking-wider text-bone-400">commit</span>
                          <span className="truncate text-bone-100">
                            {scoring.data.evaluator.commit.slice(0, 12)}
                          </span>
                        </li>
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </AsyncBoundary>
          </section>
        </div>

        <div className="mt-8 flex flex-wrap items-center gap-3 border-t border-bone-600/20 pt-6">
          <button
            type="button"
            disabled={!canManageWorkspace}
            onClick={() => {
              const persisted = reset();
              toast.success(
                'Settings reset',
                `Back to ${DEFAULT_SETTINGS.scenariosPerRun} scenarios, adversarial coverage on, and the free behavioral stand-in.${persisted ? '' : ' The workspace save is still being attempted.'}`,
              );
            }}
            className="flex min-h-11 items-center gap-2 border border-bone-600/35 px-4 font-mono text-[11px] uppercase tracking-wider text-bone-300 transition-colors hover:border-bone-400 hover:text-bone-100"
          >
            <RotateCcw className="h-3.5 w-3.5" /> RESET TO DEFAULTS
          </button>
          <p className="font-mono text-[10px] text-bone-600">
            {saving ? 'Saving workspace defaults…' : 'Workspace defaults are saved.'}
          </p>
        </div>

        {workspace.current?.role === 'owner' && (
          <>
          <section className="mt-12 max-w-2xl border border-fault-500/30 bg-fault-500/5 p-6">
            <SystemLabel className="text-fault-400">DANGER ZONE</SystemLabel>
            <h2 className="mt-3 font-mono text-sm uppercase tracking-wider text-bone-100">Delete this workspace</h2>
            <p className="mt-2 text-sm leading-relaxed text-bone-400">
              This permanently removes its agents, scenarios, traces, API keys and audit history. If it is the final workspace, the organization is removed too. An active subscription must be canceled first.
            </p>
            <label htmlFor="delete-workspace" className="mt-5 block text-xs text-bone-400">
              Type <strong className="text-bone-100">{workspace.current.name}</strong> to confirm
            </label>
            <div className="mt-2 flex flex-col gap-3 sm:flex-row">
              <input id="delete-workspace" value={deleteConfirmation}
                onChange={(event) => setDeleteConfirmation(event.target.value)}
                className="min-h-11 flex-1 border border-fault-500/30 bg-ink-950 px-4 text-sm text-bone-100 outline-none focus:border-fault-400" />
              <button type="button" disabled={deleting || deleteConfirmation !== workspace.current.name}
                onClick={async () => {
                  setDeleting(true);
                  try {
                    await api.deleteWorkspace(deleteConfirmation);
                    window.location.assign('/app');
                  } catch (cause) {
                    toast.error('Workspace not deleted', cause instanceof Error ? cause.message : 'Try again.');
                    setDeleting(false);
                  }
                }}
                className="min-h-11 border border-fault-500/50 px-5 font-mono text-[11px] uppercase tracking-wider text-fault-400 disabled:opacity-40">
                {deleting ? 'DELETING…' : 'DELETE WORKSPACE'}
              </button>
            </div>
          </section>

          <section className="mt-6 max-w-2xl border border-bone-600/20 bg-ink-900/60 p-5 sm:p-6">
            <SystemLabel>RUN NOTIFICATIONS</SystemLabel>
            <p className="mt-2 text-xs leading-relaxed text-bone-400">
              Send one email after all scenarios finish. Emails contain status and counts only; prompts and traces remain in the private report.
            </p>
            <label htmlFor="notification-email" className="mt-4 block text-xs text-bone-300">Destination email</label>
            <input id="notification-email" type="email"
              value={notificationEmail}
              onChange={(event) => setNotificationEmail(event.target.value)}
              onBlur={(event) => update({ notifications: {
                emailEnabled: settings.notifications?.emailEnabled ?? false,
                email: event.target.value.trim(),
              } })}
              className="mt-2 w-full border border-bone-600/35 bg-ink-950/60 px-4 py-3 text-sm text-bone-100 outline-none focus:border-signal-400" />
            <button type="button" role="switch"
              aria-checked={settings.notifications?.emailEnabled ?? false}
              disabled={!workspaceInfo.data?.notificationsAvailable}
              onClick={() => update({ notifications: {
                emailEnabled: !(settings.notifications?.emailEnabled ?? false),
                email: notificationEmail.trim(),
              } })}
              className="mt-4 min-h-11 w-full border border-bone-600/30 px-4 text-left font-mono text-[11px] uppercase tracking-wider text-bone-300 disabled:opacity-40">
              {settings.notifications?.emailEnabled ? 'EMAIL NOTIFICATIONS ON' : 'EMAIL NOTIFICATIONS OFF'}
            </button>
            {workspaceInfo.data && !workspaceInfo.data.notificationsAvailable && (
              <p className="mt-3 text-xs text-warn-400">Email delivery is unavailable until an administrator configures Resend.</p>
            )}
          </section>
          </>
        )}
      </div>
    </div>
  );
}
