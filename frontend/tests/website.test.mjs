import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { loadUi } from './load-ui.mjs';

const { default: NewAgent } = await loadUi('pages/app/NewAgent.tsx');
const { default: Compare } = await loadUi('pages/app/Compare.tsx');
const { default: TestTrace } = await loadUi('pages/app/TestTrace.tsx');
const { default: EvaluationResults } = await loadUi('pages/app/EvaluationResults.tsx');
const { OwnerAccess } = await loadUi('components/OwnerAccess.tsx');
const { ownerKey, setOwnerKey } = await loadUi('lib/owner-access.ts');
const settings = await loadUi('lib/workspace-settings.ts');
const { evaluationPath, evaluationVerdict, hasAgentScore } = await loadUi('lib/format.ts');

const originalFetch = globalThis.fetch;
const originalStorage = globalThis.localStorage;
let tree;
const messages = [];
globalThis.websiteTestToast = Object.fromEntries(['info', 'success', 'error'].map((name) =>
  [name, (...args) => messages.push([name, ...args])]));

function storage(value = null, removeThrows = false) {
  return {
    getItem: () => value,
    setItem: (_key, next) => { value = next; },
    removeItem: () => { if (removeThrows) throw new Error('Storage blocked'); value = null; },
  };
}

afterEach(async () => {
  await act(async () => tree?.unmount());
  tree = undefined;
  globalThis.fetch = originalFetch;
  globalThis.localStorage = storage();
  settings.saveSettings(settings.DEFAULT_SETTINGS); // clear any temporary settings
  globalThis.localStorage = originalStorage;
  messages.length = 0;
  setOwnerKey('');
});

function Location() {
  const location = useLocation();
  return React.createElement('output', { id: 'location' }, location.pathname + location.search);
}

async function mount(Page, path = '/', entry = '/') {
  await act(async () => {
    tree = renderer.create(React.createElement(MemoryRouter, { initialEntries: [entry] },
      React.createElement(Location), React.createElement(Routes, null,
        React.createElement(Route, { path, element: React.createElement(Page) }),
        React.createElement(Route, { path: '*', element: React.createElement('div', null, 'Destination') }),
      )));
  });
}

const pageText = () => JSON.stringify(tree.toJSON());
const location = () => tree.root.findByProps({ id: 'location' }).children.join('');
const button = (text) => tree.root.findAllByType('button').find((b) =>
  JSON.stringify(b.children.map((child) => typeof child === 'string' ? child : child.props.children)).includes(text));
const click = async (control) => {
  assert.ok(control, 'Control exists');
  assert.ok(!control.props.disabled, 'Control is enabled');
  await act(async () => control.props.onClick());
};
const draft = { name: 'New agent', description: '', domain: '', systemPrompt: 'Check orders.',
  tools: [{ name: 'get_order', description: 'Read an order', risk: 'low' }], savedAt: Date.now() };

test('corrupt saved drafts cannot crash the new-agent form', async () => {
  for (const bad of [{ ...draft, name: 42 }, { ...draft, tools: 'wrong shape' },
                     { ...draft, tools: [null] }, { ...draft, savedAt: undefined }]) {
    globalThis.localStorage = storage(JSON.stringify(bad));
    await mount(NewAgent);
    assert.equal(tree.root.findByProps({ id: 'agent-name' }).props.value, '');
    await act(async () => tree.unmount());
    tree = undefined;
  }
});

test('agent creation succeeds even when clearing the draft is blocked', async () => {
  globalThis.localStorage = storage(JSON.stringify(draft), true);
  let created = 0;
  globalThis.fetch = async () => {
    created += 1;
    return Response.json({ id: 'created', tools: draft.tools });
  };
  await mount(NewAgent);
  for (let step = 0; step < 3; step += 1) await click(button('CONTINUE'));
  await click(button('CREATE AGENT'));
  assert.equal(created, 1);
  assert.equal(location(), '/app/agents/created');
  assert.ok(!messages.some(([tone]) => tone === 'error'));
});

test('manually duplicated tool names block the review step', async () => {
  globalThis.localStorage = storage(JSON.stringify({ ...draft, tools: [
    ...draft.tools, { ...draft.tools[0], name: ' get_order ' },
  ] }));
  await mount(NewAgent);
  await click(button('CONTINUE'));
  await click(button('CONTINUE'));
  assert.equal(button('CONTINUE').props.disabled, true);
  assert.match(pageText(), /Duplicate tool name/);
});

test('invalid stored settings never send an unsupported adapter or invalid suite size', () => {
  globalThis.localStorage = storage(JSON.stringify({ scenariosPerRun: 'bad', adapter: 'http', adversarial: 'false' }));
  assert.deepEqual(settings.runOptionsFor('v2'), {
    versionLabel: 'v2', perCategory: 3, adapter: 'llm', adversarial: true,
  });
  assert.equal(settings.perCategoryFor(NaN), 3);
});

test('blocked storage keeps changed settings usable for runs in the same tab', () => {
  globalThis.localStorage = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('full'); } };
  assert.equal(settings.saveSettings({ scenariosPerRun: 20, adversarial: false, adapter: 'behavioral' }), false);
  assert.deepEqual(settings.runOptionsFor('v3'), {
    versionLabel: 'v3', perCategory: 5, adapter: 'behavioral', adversarial: false,
  });
});

const metrics = { taskSuccess: 100, toolAccuracy: 100, safety: 100, consistency: 100, groundedness: 100 };
const versions = ['v1', 'v2', 'v3'].map((id) => ({ id, version: id, status: 'completed', reliability: 100,
  metrics, failures: {}, passRate: 100, notes: '', createdAt: '2026-09-16T12:00:00Z' }));

test('comparison links retain both selections across reload', async () => {
  globalThis.fetch = async (url) => url === '/api/agents'
    ? Response.json([{ id: 'agent', name: 'Agent', versions: [...versions, { ...versions[0], id: 'v4', status: 'running' }] }])
    : Response.json({ shared_scenarios: 0, regressions: [], improvements: [], unchanged: 0,
        verdict: 'Highly Reliable', failure_type_delta: {} });
  await mount(Compare, '/app/compare', '/app/compare?agent=agent&baseline=v1&target=v3');
  assert.match(location(), /baseline=v1&target=v3/);
  const choices = tree.root.findAllByType('button').filter((b) => b.children.includes('v2'));
  await click(choices[0]);
  const shared = location();
  assert.match(shared, /baseline=v2&target=v3/);
  assert.ok(!tree.root.findAllByType('button').some((b) => b.children.includes('v4')));
  await act(async () => tree.unmount());
  await mount(Compare, '/app/compare', shared);
  assert.equal(location(), shared);
});

test('pending evaluations link to progress and never carry a reliability verdict', () => {
  assert.equal(evaluationPath({ id: 'eval', status: 'running' }), '/app/evaluations/eval/running');
  assert.equal(evaluationVerdict({ score: 0, status: 'running' }), 'In progress');
  assert.equal(evaluationVerdict({ score: 0, status: 'failed' }), 'Execution error');
  assert.equal(evaluationVerdict({ score: 0, status: 'completed' }), 'Unreliable');
  assert.equal(hasAgentScore({ status: 'running' }), false);
  assert.equal(hasAgentScore({ status: 'error' }), false);
});

test('opening an unfinished report resumes progress without loading diagnostics', async () => {
  const paths = [];
  globalThis.fetch = async (url) => {
    paths.push(url);
    return Response.json(url === '/api/scoring' ? {} : { id: 'eval', status: 'running' });
  };
  await mount(EvaluationResults, '/app/evaluations/:id', '/app/evaluations/eval');
  assert.equal(location(), '/app/evaluations/eval/running');
  assert.ok(!paths.some((path) => /guardrail|ci-gate/.test(path)));
});

test('a saved trace URL loads its exact run independently of latest report membership', async () => {
  const paths = [];
  globalThis.fetch = async (url) => {
    paths.push(url);
    return Response.json({ evaluationId: 'eval', agentName: 'Agent', version: 'v1', status: 'complete',
      test: { id: 'old-run', scenarioId: 'scenario', title: 'Original run', status: 'passed',
        category: 'realistic', durationMs: 5, userPrompt: 'Check order', expectedBehavior: 'Look it up',
        agentResponse: 'Done', trace: [] } });
  };
  await mount(TestTrace, '/app/evaluations/:evaluationId/tests/:testId', '/app/evaluations/eval/tests/old-run');
  assert.match(pageText(), /Original run/);
  assert.deepEqual(paths, ['/api/evaluations/eval/tests/old-run']);
});

test('owner access stores only a validated key and clears it when locking', async () => {
  globalThis.fetch = async (_url, options) => Response.json({ required: true, configured: true,
    authorized: options.headers.Authorization === 'Bearer synthetic-owner-key' });
  await mount(OwnerAccess);
  const enter = async (value) => act(async () => {
    tree.root.findByProps({ id: 'owner-access-key' }).props.onChange({ target: { value } });
  });
  const submit = async () => act(async () => {
    await tree.root.findByType('form').props.onSubmit({ preventDefault() {} });
  });
  await enter('wrong');
  await submit();
  assert.equal(ownerKey(), '');
  assert.match(pageText(), /not valid/);
  await enter('synthetic-owner-key');
  await submit();
  assert.equal(ownerKey(), 'synthetic-owner-key');
  assert.match(pageText(), /Actions unlocked/);
  await click(button('LOCK ACTIONS'));
  assert.equal(ownerKey(), '');
});
