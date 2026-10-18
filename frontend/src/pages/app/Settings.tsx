import { useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { NextSteps, PageHeader } from '@/components/PageHeader';
import { AsyncBoundary } from '@/components/AsyncState';
import { useToast } from '@/components/Toaster';
import { useResource } from '@/hooks/useResource';
import { api } from '@/lib/api';
import {
  DEFAULT_SETTINGS,
  perCategoryFor,
  useWorkspaceSettings,
} from '@/lib/workspace-settings';
import { ArrowRight, Check, RotateCcw } from 'lucide-react';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { buttonDanger, buttonPrimary, buttonSecondary, card, fieldHint, fieldInput, fieldLabel, sectionTitle } from '@/lib/ui';

/** An on/off row: the label and its explanation on the left, the switch on the right. */
function SwitchRow({
  checked,
  disabled,
  onToggle,
  label,
  detail,
}: {
  checked: boolean;
  disabled?: boolean;
  onToggle: () => void;
  label: string;
  detail: ReactNode;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={onToggle}
      className="mt-4 flex w-full items-center justify-between gap-4 border border-bone-600/40 bg-ink-950 p-4 text-left transition-colors hover:border-signal-500/50 disabled:cursor-not-allowed disabled:opacity-50"
    >
      <span className="min-w-0">
        <span className="block text-sm font-medium text-bone-50">{label}</span>
        <span className="mt-1 block text-sm leading-relaxed text-bone-300">{detail}</span>
      </span>
      <span className="flex shrink-0 items-center gap-2">
        <span className={`text-sm ${checked ? 'text-signal-300' : 'text-bone-400'}`}>{checked ? 'On' : 'Off'}</span>
        <span
          className={`relative h-6 w-11 rounded-full border transition-colors ${
            checked ? 'border-signal-400 bg-signal-500/30' : 'border-bone-600/60 bg-ink-850'
          }`}
        >
          <span
            className={`absolute top-1/2 h-4 w-4 -translate-y-1/2 rounded-full transition-all ${
              checked ? 'left-[calc(100%-1.25rem)] bg-signal-300' : 'left-1 bg-bone-400'
            }`}
          />
        </span>
      </span>
    </button>
  );
}

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
  const canCreate = workspace.current?.role !== 'viewer';

  useEffect(() => {
    setNotificationEmail(settings.notifications?.email ?? '');
  }, [settings.notifications?.email]);

  useEffect(() => {
    const value = settings.monthlySpendCapUsd ?? workspaceInfo.data?.usage.spendCapUsd;
    if (value !== undefined) setSpendCap(String(value));
  }, [settings.monthlySpendCapUsd, workspaceInfo.data?.usage.spendCapUsd]);

  const perCategory = perCategoryFor(settings.scenariosPerRun);
  const actual = perCategory * (settings.adversarial ? 4 : 3);

  const resetToDefaults = () => {
    const persisted = reset();
    toast.success(
      'Settings reset',
      `Back to ${DEFAULT_SETTINGS.scenariosPerRun} scenarios, adversarial coverage on, and the real model.${persisted ? '' : ' The workspace save is still being attempted.'}`,
    );
  };

  return (
    <>
      <PageHeader
        crumbs={[{ label: 'Workspace' }, { label: 'Run settings' }]}
        title="Run settings"
        description="Defaults for every evaluation in this workspace: which agent runs, how many scenarios, and how hard they push. Changes save as you make them."
        meta={(
          <p role="status" className="flex items-center gap-2 text-sm text-bone-300">
            {saving ? 'Saving…' : <><Check className="h-4 w-4 text-flux-400" aria-hidden /> All changes saved</>}
          </p>
        )}
        actions={(
          <>
            {canManageWorkspace && (
              <button type="button" onClick={resetToDefaults} className={buttonSecondary}>
                <RotateCcw className="h-4 w-4" aria-hidden /> Reset to defaults
              </button>
            )}
            <Link to="/app/agents" className={buttonPrimary}>
              Go to agents <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          </>
        )}
      />

      <div className="space-y-6">
        {!storageAvailable && (
          <p role="status" className="border border-warn-500/50 p-4 text-sm text-warn-300">
            The local cache is unavailable. Changes still save to the workspace, but this tab may take longer to restore them after a reload.
          </p>
        )}
        {saveError && <p role="alert" className="border border-fault-500/50 p-4 text-sm text-fault-300">{saveError}</p>}
        {!canManageWorkspace && (
          <p className="border border-bone-600/40 p-4 text-sm text-bone-200">
            These settings are read-only for your role. Ask a workspace administrator to change them.
          </p>
        )}

        <div className="grid min-w-0 gap-6 lg:grid-cols-2">
          <section className={`${card} min-w-0`}>
            <h2 className={sectionTitle}>Agent under test</h2>
            <p className="mt-1 text-sm leading-relaxed text-bone-300">
              What answers the scenarios when an agent uses prompt simulation.
            </p>
            <div className="mt-4 grid gap-3" role="group" aria-label="Agent under test">
              {(
                [
                  {
                    key: 'llm' as const,
                    title: 'Real model (default)',
                    detail:
                      'Runs your prompt and tools on the hosted model, so the score reflects your prompt. The exact model is pinned in every report.',
                  },
                  {
                    key: 'behavioral' as const,
                    title: 'Behavioral stand-in',
                    detail:
                      'A scripted agent that ignores the prompt and gives the same trace every time. Use it only for a reproducible demo; it does not test your prompt.',
                  },
                ]
              ).map((option) => {
                const selected = settings.adapter === option.key;
                return (
                  <button
                    key={option.key}
                    type="button"
                    aria-pressed={selected}
                    disabled={!canManageWorkspace}
                    onClick={() => update({ adapter: option.key })}
                    className={`flex min-w-0 items-start gap-3 border p-4 text-left transition-colors disabled:cursor-not-allowed ${
                      selected
                        ? 'border-signal-400 bg-signal-500/10'
                        : 'border-bone-600/40 hover:border-bone-300/60'
                    }`}
                  >
                    <span
                      aria-hidden
                      className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                        selected ? 'border-signal-400 bg-signal-500' : 'border-bone-500'
                      }`}
                    >
                      {selected && <Check className="h-3 w-3 text-ink-950" strokeWidth={3} />}
                    </span>
                    <span className="min-w-0">
                      <span className={`block text-base font-medium ${selected ? 'text-signal-300' : 'text-bone-50'}`}>
                        {option.title}
                      </span>
                      <span className="mt-1 block text-sm leading-relaxed text-bone-300">{option.detail}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          <div className="grid min-w-0 content-start gap-6">
            <section className={`${card} min-w-0`}>
              <h2 className={sectionTitle}>Suite size</h2>
              <label htmlFor="scenarios" className={`${fieldLabel} mt-4`}>
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
                className={`${fieldInput} mt-2 font-mono`}
              />
              <p className={fieldHint}>
                Scenarios are generated per category, so the number is rounded to a whole
                number per category. At {settings.scenariosPerRun} this run generates{' '}
                <span className="text-bone-100">{perCategory} per category</span> across{' '}
                {settings.adversarial ? 'four' : 'three'} categories, so{' '}
                <span className="text-bone-100">about {actual} scenarios</span>.
              </p>
            </section>

            <section className={`${card} min-w-0`}>
              <h2 className={sectionTitle}>Adversarial coverage</h2>
              <SwitchRow
                checked={settings.adversarial}
                disabled={!canManageWorkspace}
                onToggle={() => update({ adversarial: !settings.adversarial })}
                label="Adversarial scenarios"
                detail="Inject prompt-injection, jailbreak and contradictory-instruction variants into every run."
              />
              <p className={fieldHint}>
                This gates scenario generation, not the agent under test. Turning it off removes
                the hardest scenarios, so the score goes up. That is the honest reading, not an
                improvement.
              </p>
            </section>
          </div>
        </div>

        <div className="grid min-w-0 gap-6 lg:grid-cols-2">
          <section className={`${card} min-w-0`}>
            <h2 className={sectionTitle}>Model spend ceiling</h2>
            <p className="mt-1 text-sm leading-relaxed text-bone-300">
              Aegis reserves a conservative provider-cost estimate before starting a model-backed run. Behavioral and connected-agent runs reserve $0.
            </p>
            <label htmlFor="spend-cap" className={`${fieldLabel} mt-4`}>Monthly cap in USD</label>
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
              className={`${fieldInput} mt-2 font-mono disabled:opacity-50`} />
            {workspaceInfo.data && (
              <p className={fieldHint}>
                ${workspaceInfo.data.usage.estimatedCostUsd.toFixed(4)} settled · ${workspaceInfo.data.usage.reservedCostUsd.toFixed(4)} reserved · plan maximum ${workspaceInfo.data.usage.plan.monthly_model_spend_cap_usd.toFixed(2)}
              </p>
            )}
          </section>

          <section className={`${card} min-w-0`}>
            <h2 className={sectionTitle}>Scoring contract</h2>
            <p className="mt-1 text-sm leading-relaxed text-bone-300">
              Published by the API, not configurable here. A workspace that could move the
              weights or ceilings could make any agent look reliable.
            </p>
            <AsyncBoundary
              loading={scoring.loading}
              error={scoring.error}
              onRetry={scoring.reload}
              label="Loading contract"
            >
              {scoring.data && (
                <div className="mt-4 grid gap-5 sm:grid-cols-2">
                  <div>
                    <h3 className="text-sm font-medium text-bone-100">Weights</h3>
                    <ul className="mt-2 space-y-1">
                      {Object.entries(scoring.data.weights).map(([key, weight]) => (
                        <li key={key} className="flex items-center justify-between gap-3 text-sm">
                          <span className="text-bone-300">{key.replace(/_/g, ' ')}</span>
                          <span className="font-mono text-bone-50">{Math.round(weight * 100)}%</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-bone-100">Severity ceilings</h3>
                    <ul className="mt-2 space-y-1">
                      {scoring.data.gates.map((gate) => (
                        <li key={gate.when} className="text-sm text-bone-300">
                          <span className="font-mono text-bone-50">≤ {gate.atMost}</span> · {gate.when}
                        </li>
                      ))}
                    </ul>
                  </div>
                  {scoring.data.evaluator && (
                    <div className="sm:col-span-2">
                      <h3 className="text-sm font-medium text-bone-100">Deployed evaluator</h3>
                      <ul className="mt-2 grid gap-x-6 gap-y-1 sm:grid-cols-2">
                        {(['generator', 'guardrail', 'detector', 'profile', 'scorer'] as const).map((key) => (
                          <li key={key} className="flex items-center justify-between gap-3 text-sm">
                            <span className="text-bone-300">{key}</span>
                            <span className="font-mono text-bone-50">{scoring.data!.evaluator![key]}</span>
                          </li>
                        ))}
                        <li className="flex items-center justify-between gap-3 text-sm">
                          <span className="text-bone-300">commit</span>
                          <span className="truncate font-mono text-bone-50">
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

        {workspace.current?.role === 'owner' && (
          <>
            <section className={card}>
              <h2 className={sectionTitle}>Run notifications</h2>
              <p className="mt-1 text-sm leading-relaxed text-bone-300">
                Send one email after all scenarios finish. Emails contain status and counts only; prompts and traces remain in the private report.
              </p>
              <div className="mt-4 grid gap-4 md:grid-cols-2 md:items-end">
                <div>
                  <label htmlFor="notification-email" className={fieldLabel}>Destination email</label>
                  <input id="notification-email" type="email"
                    value={notificationEmail}
                    onChange={(event) => setNotificationEmail(event.target.value)}
                    onBlur={(event) => update({ notifications: {
                      emailEnabled: settings.notifications?.emailEnabled ?? false,
                      email: event.target.value.trim(),
                    } })}
                    className={`${fieldInput} mt-2`} />
                </div>
                <SwitchRow
                  checked={settings.notifications?.emailEnabled ?? false}
                  disabled={!workspaceInfo.data?.notificationsAvailable}
                  onToggle={() => update({ notifications: {
                    emailEnabled: !(settings.notifications?.emailEnabled ?? false),
                    email: notificationEmail.trim(),
                  } })}
                  label="Email notifications"
                  detail="One message per finished run."
                />
              </div>
              {workspaceInfo.data && !workspaceInfo.data.notificationsAvailable && (
                <p className="mt-3 text-sm text-warn-300">Email delivery is unavailable until an administrator configures Resend.</p>
              )}
            </section>

            <section className="border border-fault-500/40 bg-fault-500/5 p-4 sm:p-6">
              <h2 className="font-display text-lg font-semibold text-fault-300">Delete this workspace</h2>
              <p className="mt-1 max-w-3xl text-sm leading-relaxed text-bone-200">
                This permanently removes its agents, scenarios, traces, API keys and audit history. If it is the final workspace, the organization is removed too. An active subscription must be canceled first.
              </p>
              <label htmlFor="delete-workspace" className={`${fieldLabel} mt-4`}>
                Type <strong className="text-bone-50">{workspace.current.name}</strong> to confirm
              </label>
              <div className="mt-2 flex max-w-2xl flex-col gap-3 sm:flex-row">
                <input id="delete-workspace" value={deleteConfirmation}
                  onChange={(event) => setDeleteConfirmation(event.target.value)}
                  className={`${fieldInput} border-fault-500/40 sm:flex-1`} />
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
                  className={buttonDanger}>
                  {deleting ? 'Deleting…' : 'Delete workspace'}
                </button>
              </div>
            </section>
          </>
        )}
      </div>

      {canCreate && (
        <NextSteps
          steps={[
            { to: '/app/agents/new', label: 'Add an agent', hint: 'Paste its system prompt and tool schema.' },
            { to: '/app/agents', label: 'Run an existing agent', hint: 'Open an agent, then Review & run.' },
          ]}
        />
      )}
    </>
  );
}
