import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { test } from 'node:test';
import React from 'react';
import renderer, { act } from 'react-test-renderer';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const reactUrl = pathToFileURL(require.resolve('react')).href;
async function moduleUrl(relative, replacements = []) {
  let source = await readFile(new URL(relative, import.meta.url), 'utf8');
  for (const [from, to] of replacements) source = source.replaceAll(from, to);
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
    fileName: fileURLToPath(new URL(relative, import.meta.url)),
  });
  return `data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`;
}

// Resolve the same aliases and environment substitution that Vite resolves.
const ownerUrl = await moduleUrl('../src/lib/owner-access.ts');
const apiUrl = await moduleUrl('../src/lib/api.ts', [
  ['import.meta.env', '({})'], ["'@/lib/owner-access'", JSON.stringify(ownerUrl)],
]);
const hookUrl = await moduleUrl('../src/hooks/useResource.ts', [
  ["'@/lib/api'", JSON.stringify(apiUrl)], ["'react'", JSON.stringify(reactUrl)],
]);
const { useResource } = await import(hookUrl);
const { parseToolSchema, toolsToJson } = await import(await moduleUrl('../src/lib/tool-schema.ts'));
const { api } = await import(apiUrl);
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

test('a completed or errored trace stops polling without clearing the result', async () => {
  let calls = 0;
  let tree;
  function Probe() {
    const resource = useResource(async () => ({ status: ++calls === 1 ? 'pending' : 'error' }), [], {
      pollMs: 10, pollWhile: (run) => run.status === 'pending',
    });
    return React.createElement('span', null, resource.data?.status ?? 'loading');
  }
  try {
    await act(async () => { tree = renderer.create(React.createElement(Probe)); });
    await act(async () => { await delay(60); });
    assert.equal(calls, 2);
    assert.deepEqual(tree.toJSON().children, ['error']);
  } finally {
    await act(async () => { tree?.unmount(); });
  }
});

test('nested MCP tool envelopes retain names and argument schemas', () => {
  const tools = [{ name: 'check_order', description: 'Lookup', inputSchema: {
    type: 'object', properties: { id: { type: 'string' } }, required: ['id'],
  } }];
  const result = parseToolSchema(JSON.stringify({ result: { tools } }));
  assert.deepEqual(result.errors, []);
  assert.equal(result.tools[0].name, 'check_order');
  assert.deepEqual(result.tools[0].parameters, tools[0].inputSchema);
  assert.deepEqual(parseToolSchema(toolsToJson(result.tools)).tools, result.tools);
});

test('OpenAI imports and duplicate handling remain intact', () => {
  const tool = { type: 'function', function: { name: 'lookup', parameters: { type: 'object' } } };
  const result = parseToolSchema(JSON.stringify({ tools: [tool, tool] }));
  assert.equal(result.tools.length, 1);
  assert.match(result.errors[0], /Duplicate/);
});

test('validation errors retain field names and actionable messages', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({ detail: [
    { loc: ['body', 'perCategory'], msg: 'Input should be greater than or equal to 1' },
  ] }), { status: 422 });
  try {
    await assert.rejects(api.evaluate('test'), /perCategory: Input should be greater/);
  } finally {
    globalThis.fetch = original;
  }
});

test('progress polling waits for the prior response before starting another request', async () => {
  let finish;
  let calls = 0;
  let tree;
  function Probe() {
    const resource = useResource(() => {
      calls += 1;
      return new Promise((resolve) => { finish = resolve; });
    }, [], { pollMs: 10 });
    return React.createElement('span', null, resource.data ?? 'loading');
  }
  try {
    await act(async () => { tree = renderer.create(React.createElement(Probe)); });
    await act(async () => { await delay(45); });
    assert.equal(calls, 1, 'slow progress requests must never overlap');
    await act(async () => { finish('first result'); });
    await act(async () => { await delay(30); });
    assert.equal(calls, 2);
    assert.deepEqual(tree.toJSON().children, ['first result']);
  } finally {
    await act(async () => { tree?.unmount(); });
  }
});

test('switching records clears old data and ignores late responses', async () => {
  const pending = new Map();
  let tree;
  function Probe({ id, enabled = true }) {
    const resource = useResource(() => new Promise((resolve) => pending.set(id, resolve)), [id], { enabled });
    return React.createElement('span', null, resource.loading ? 'loading' : resource.data ?? 'empty');
  }
  try {
    await act(async () => { tree = renderer.create(React.createElement(Probe, { id: 'a' })); });
    await act(async () => { pending.get('a')('Agent A'); });
    assert.deepEqual(tree.toJSON().children, ['Agent A']);
    await act(async () => { tree.update(React.createElement(Probe, { id: 'b' })); });
    assert.deepEqual(tree.toJSON().children, ['loading']);
    await act(async () => { tree.update(React.createElement(Probe, { id: 'c' })); });
    await act(async () => { pending.get('b')('Stale agent B'); });
    assert.deepEqual(tree.toJSON().children, ['loading']);
    await act(async () => { pending.get('c')('Agent C'); });
    assert.deepEqual(tree.toJSON().children, ['Agent C']);
    await act(async () => { tree.update(React.createElement(Probe, { id: 'c', enabled: false })); });
    assert.deepEqual(tree.toJSON().children, ['empty']);
  } finally {
    await act(async () => { tree?.unmount(); });
  }
});
