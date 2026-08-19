import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!isH3SwallowedErrorBody(body)) return response;

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function isH3SwallowedErrorBody(body: string): boolean {
  try {
    const payload = JSON.parse(body) as { unhandled?: unknown; message?: unknown };
    return payload.unhandled === true && payload.message === "HTTPError";
  } catch {
    return false;
  }
}

/**
 * Reverse-proxy `/api/*` to the evaluator backend.
 *
 * Keeping the dashboard and the API on one origin means one URL to share, no CORS
 * preflight, and no build-time API address baked into the bundle — the client just
 * calls a relative path. Override the target with AEGIS_API_URL.
 */
const ENV = (globalThis as { process?: { env?: Record<string, string | undefined> } })
  .process?.env;

// AEGIS_API_URL wins everywhere. On Vercel the evaluator is a sibling project, so
// fall back to its production alias; locally, fall back to the dev port. Neither
// default is a secret — the only secret in this system is DATABASE_URL, which the
// evaluator reads from its own environment.
const API_TARGET =
  ENV?.["AEGIS_API_URL"] ??
  (ENV?.["VERCEL"] ? "https://aegis-api-harsh1t.vercel.app" : "http://127.0.0.1:8770");

async function proxyApi(request: Request): Promise<Response | null> {
  const url = new URL(request.url);
  if (!url.pathname.startsWith("/api/")) return null;

  const target = new URL(url.pathname + url.search, API_TARGET);
  const headers = new Headers();
  const contentType = request.headers.get("content-type");
  if (contentType) headers.set("content-type", contentType);
  headers.set("accept", request.headers.get("accept") ?? "application/json");

  // Attach a body only when there genuinely is one. A DELETE arrives with no body,
  // and handing fetch a zero-length ArrayBuffer made the request throw — so every
  // delete came back as this handler's own 502 while the API itself was fine.
  const init: RequestInit = { method: request.method, headers };
  if (request.method !== "GET" && request.method !== "HEAD") {
    const body = await request.arrayBuffer();
    if (body.byteLength > 0) init.body = body;
  }

  try {
    const upstream = await fetch(target, init);
    const outHeaders = new Headers();
    const upstreamType = upstream.headers.get("content-type");
    if (upstreamType) outHeaders.set("content-type", upstreamType);
    outHeaders.set("cache-control", "no-store");

    // 204, 205 and 304 are null-body statuses: the Response constructor rejects
    // *any* body for them, including a zero-length buffer. Passing one through
    // threw here and surfaced as this handler's own 502, so every successful
    // delete looked like a proxy outage.
    const NULL_BODY = new Set([204, 205, 304]);
    const body = NULL_BODY.has(upstream.status) ? null : await upstream.arrayBuffer();
    return new Response(body, { status: upstream.status, headers: outHeaders });
  } catch (error) {
    console.error("API proxy failed", error);
    return new Response(
      JSON.stringify({ detail: "Evaluator API is unreachable from the web server." }),
      { status: 502, headers: { "content-type": "application/json" } },
    );
  }
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    try {
      const proxied = await proxyApi(request);
      if (proxied) return proxied;

      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      return await normalizeCatastrophicSsrResponse(response);
    } catch (error) {
      console.error(error);
      return new Response(renderErrorPage(), {
        status: 500,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }
  },
};
