import assert from 'node:assert/strict';
import { test } from 'node:test';
import handler, { apiOrigin } from '../api/proxy.js';

test('production keeps the established API while previews require an isolated origin', () => {
  assert.equal(apiOrigin({ VERCEL_ENV: 'production' }), 'https://agent-aegis-api.vercel.app');
  assert.throws(() => apiOrigin({ VERCEL_ENV: 'preview' }), /Preview API not configured/);
  assert.throws(() => apiOrigin({ VERCEL_ENV: 'preview', AEGIS_API_ORIGIN: 'https://agent-aegis-api.vercel.app' }), /isolated API/);
  assert.equal(apiOrigin({ VERCEL_ENV: 'preview', AEGIS_API_ORIGIN: 'https://preview-api.example.test' }), 'https://preview-api.example.test');
  for (const origin of ['http://example.test', 'https://user:pass@example.test', 'https://example.test/api']) {
    assert.throws(() => apiOrigin({ AEGIS_API_ORIGIN: origin }));
  }
});

const response = () => ({
  code: 200, headers: {}, data: undefined,
  setHeader(key, value) { this.headers[key] = value; return this; },
  status(code) { this.code = code; return this; },
  json(data) { this.data = data; return this; },
  send(data) { this.data = data; return this; },
});

test('proxy preserves body, query, owner authorization and upstream error status', async () => {
  const originalFetch = globalThis.fetch;
  const priorOrigin = process.env.AEGIS_API_ORIGIN;
  process.env.AEGIS_API_ORIGIN = 'https://preview-api.example.test';
  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push({ url: String(url), options });
    return Response.json({ detail: 'Owner access required' }, { status: 401 });
  };
  try {
    const res = response();
    await handler({ method: 'POST', query: { __aegis_path: 'agents/abc/evaluate', seed: '42' },
      headers: { authorization: 'Bearer synthetic-owner-key', 'content-type': 'application/json' },
      body: { adapter: 'llm' } }, res);
    assert.equal(calls[0].url, 'https://preview-api.example.test/api/agents/abc/evaluate?seed=42');
    assert.equal(calls[0].options.headers.Authorization, 'Bearer synthetic-owner-key');
    assert.equal(calls[0].options.body, '{"adapter":"llm"}');
    assert.equal(res.code, 401);
    assert.equal(res.headers['Cache-Control'], 'no-store');
    assert.match(res.data.toString(), /Owner access required/);
    const bad = response();
    await handler({ method: 'GET', query: { __aegis_path: '../health' }, headers: {} }, bad);
    assert.equal(bad.code, 400);
    assert.equal(calls.length, 1);
  } finally {
    globalThis.fetch = originalFetch;
    if (priorOrigin === undefined) delete process.env.AEGIS_API_ORIGIN;
    else process.env.AEGIS_API_ORIGIN = priorOrigin;
  }
});
