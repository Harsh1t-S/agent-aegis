const PRODUCTION_ORIGIN = 'https://agent-aegis-api.vercel.app';
const PRODUCTION_HOSTS = new Set([
  'agent-aegis-api.vercel.app', 'aegis-api-eight.vercel.app',
  'aegis-api-harsh1t.vercel.app', 'aegis-api-git-main-harsh1t.vercel.app',
]);

export function apiOrigin(env = process.env) {
  const configured = env.AEGIS_API_ORIGIN?.trim();
  if (env.VERCEL_ENV === 'preview' && !configured) {
    throw new Error('Preview API not configured. Set AEGIS_API_ORIGIN to an isolated preview backend.');
  }
  const url = new URL(configured || PRODUCTION_ORIGIN);
  if (url.protocol !== 'https:' || url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
    throw new Error('AEGIS_API_ORIGIN must be an HTTPS origin without a path or credentials.');
  }
  if (env.VERCEL_ENV === 'preview' && PRODUCTION_HOSTS.has(url.hostname)) {
    throw new Error('Preview deployments must use an isolated API, not the production backend.');
  }
  return url.origin;
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  let origin;
  try { origin = apiOrigin(); } catch (error) {
    return res.status(503).json({ detail: error.message });
  }
  const path = req.query.__aegis_path;
  if (typeof path !== 'string' || !/^[a-zA-Z0-9_-]+(?:\/[a-zA-Z0-9_-]+)*$/.test(path)) {
    return res.status(400).json({ detail: 'Invalid API path.' });
  }
  const url = new URL(`/api/${path}`, origin);
  for (const [key, values] of Object.entries(req.query)) {
    if (key === '__aegis_path') continue;
    for (const value of Array.isArray(values) ? values : [values]) url.searchParams.append(key, value);
  }
  const headers = { Accept: 'application/json' };
  if (req.headers.authorization) headers.Authorization = req.headers.authorization;
  if (req.headers['content-type']) headers['Content-Type'] = req.headers['content-type'];
  let body;
  if (!['GET', 'HEAD'].includes(req.method) && req.body !== undefined) {
    body = typeof req.body === 'string' || Buffer.isBuffer(req.body) ? req.body : JSON.stringify(req.body);
  }
  try {
    const upstream = await fetch(url, { method: req.method, headers, body,
      redirect: 'error', signal: AbortSignal.timeout(55_000) });
    res.status(upstream.status);
    res.setHeader('Content-Type', upstream.headers.get('content-type') || 'application/json');
    return res.send(Buffer.from(await upstream.arrayBuffer()));
  } catch {
    return res.status(502).json({ detail: 'The evaluation API could not be reached. Please retry.' });
  }
}
