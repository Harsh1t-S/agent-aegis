# Aegis

Aegis is a private SaaS for release-testing AI agents that can take consequential support and operations actions. It generates stateful scenarios from an agent policy and tool schema, runs them against mocked tools, records the full trace, and produces evidence-backed findings and paired version comparisons.

The product has two test paths:

- **Prompt simulation** runs the supplied prompt and tools through a configured OpenAI-compatible model. The deterministic behavioral stand-in is free and is the default for a new workspace.
- **Connected agent** calls the customer's runner so its orchestration, retrieval and memory are part of the test. Aegis still executes tools in an isolated sandbox.

## SaaS architecture

```text
Browser on Vercel
  ├─ Supabase Auth session
  └─ FastAPI on Vercel
       ├─ Postgres/Supabase: private tenant data, jobs, usage, audit, billing
       ├─ Stripe: Checkout, portal, signed webhooks
       └─ durable evaluation_jobs queue
                 │
                 ▼
       outbound-only GPU worker
       ├─ Python evaluation worker
       ├─ isolated mock-tool service
       └─ Ollama / any OpenAI-compatible model
```

Customer data routes require a Supabase session or a hashed workspace API key. Every evaluator row carries a `workspace_id`; application queries scope it automatically and the Postgres migration adds forced RLS as a second boundary. The public site uses fixed curated data and never reads the latest customer evaluation.

## Local development

Backend:

```bash
python -m venv .venv
.venv/Scripts/pip install -r requirements.txt   # Windows
copy .env.example .env
.venv/Scripts/uvicorn app.main:app --env-file .env --reload
```

Frontend:

```bash
cd frontend
copy .env.example .env.local
npm ci
npm run dev
```

The examples enable single-user local auth, SQLite schema creation and the deterministic stand-in. No model request or paid service is needed to build an agent and run a baseline.

## Self-host a model at the lowest practical cost

Do not train a foundation model from scratch for this product. Start with a pretrained tool-capable model, record real false positives and missed failures, and consider a small LoRA fine-tune only after there is a labeled benchmark proving what should improve.

The included stack uses `qwen3.5:4b` through Ollama's OpenAI-compatible API. Ollama lists that quantized model at roughly 3.4 GB, which makes it a reasonable first test on a 6 GB RTX 4050. Runtime overhead and context cache also consume memory, so use `qwen3.5:2b` if the 4B model spills heavily to CPU. Model size is not evidence of evaluator quality; run the repository benchmark and a human-reviewed pilot set before using it for a release verdict.

1. Install Docker Desktop, current NVIDIA drivers and NVIDIA Container Toolkit support.
2. Copy `.env.worker.example` to `.env.worker` and set the production Postgres URL.
3. Start the private stack:

```bash
docker compose --env-file .env.worker -f docker-compose.inference.yml up -d --build
docker compose --env-file .env.worker -f docker-compose.inference.yml logs -f worker
```

Ollama's port is not published. The worker connects to it over the Compose network, claims durable jobs from Postgres, and can be stopped whenever there is no pilot traffic. The API and frontend remain available while the GPU worker is off; evaluations stay queued.

For a hosted pilot, run the same Compose file on an NVIDIA EC2 instance or another GPU host. Keep the instance stopped between pilot sessions, attach an encrypted volume for the model cache, allow outbound Postgres/HTTPS traffic, and expose no inbound Ollama port. A T4-class instance has more memory headroom than the laptop; choose a larger model only after measuring tool-call accuracy and scenario latency. Check current regional on-demand and Spot pricing before choosing an instance because those rates change.

Official references: [Ollama Docker deployment](https://docs.ollama.com/docker), [Ollama OpenAI compatibility](https://docs.ollama.com/api/openai-compatibility), and the [Qwen 3.5 model tags](https://ollama.com/library/qwen3.5).

The complete local and EC2 setup, shutdown, security and model-promotion process
is in [docs/model-hosting.md](docs/model-hosting.md).

## Connected customer agent

The starter runner and contract are documented in [docs/connected-agent.md](docs/connected-agent.md). The runner receives the complete conversation and tool schemas and returns one final response or one requested tool call. It must not use production tool credentials during an evaluation.

Connected URLs are validated before storage and again before each request. Hosted deployments require HTTPS, disable redirects, resolve DNS, and reject private, loopback, link-local, multicast and reserved addresses. An optional bearer token is encrypted with AES-GCM under `AEGIS_SECRET_ENCRYPTION_KEY`, returned to neither browser nor API client, and injected only by the worker. It is excluded from immutable evaluation snapshots. Give the worker the same encryption key and also enforce outbound network policy at the host/VPC boundary.

## Database and Supabase

Hosted Postgres is migration-only; application startup never alters it. Apply the checked migration with a migration identity before deploying the new API:

```bash
npx supabase@latest db push
```

The migration in `supabase/migrations/20260919132626_saas_foundation.sql` creates users, organizations, memberships, workspaces, invitations, API keys, subscriptions, usage reservations/events, the durable queue, audit events and finding reviews. It moves prior public showcase rows into a quarantined demo workspace, adds tenant indexes and enables forced RLS.

Set these hosted backend variables:

```dotenv
DATABASE_URL=postgresql+psycopg://...
SUPABASE_URL=https://PROJECT.supabase.co
SUPABASE_PUBLISHABLE_KEY=...
AEGIS_API_KEY_PEPPER=long-random-secret
AEGIS_SECRET_ENCRYPTION_KEY=base64-encoded-32-random-bytes
APP_URL=https://your-product.example
AEGIS_DURABLE_QUEUE=1
```

Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` on the frontend. Never put a service-role key, database password, model key or Stripe secret in a `VITE_` variable.

## Billing

Plans are server-owned entitlements: scenario credits, concurrency, retention, members, workspaces, CI access and an estimated model-spend ceiling. Quota and a conservative provider-cost estimate are reserved atomically before scenarios are created and settled once per completed run. Failed or canceled runs refund their reserved unit. Workspace administrators can lower the plan spend ceiling to zero or another amount. Token counts and estimated provider cost remain visible in Billing alongside the simpler scenario-credit allowance.

Set `LLM_RESERVED_COST_PER_SCENARIO_USD=0` for self-hosted inference. For an external provider, configure the known conservative per-scenario amount or token rates. When all pricing variables are omitted, Aegis reserves $0.25 per scenario so an unpriced provider cannot bypass the cap.

Configure Stripe:

```dotenv
STRIPE_SECRET_KEY=sk_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_STARTER_PRICE_ID=price_...
STRIPE_TEAM_PRICE_ID=price_...
```

Point the Stripe webhook at `POST /api/webhooks/stripe`. The handler verifies the raw-body signature, stores the event before applying it, deduplicates by Stripe event ID, and updates plan status for checkout, subscription and invoice events. Checkout remains disabled in the UI until both prices and the secret key exist.

## Notifications

Configure one transactional channel through Resend:

```dotenv
RESEND_API_KEY=re_...
RESEND_FROM_EMAIL=Aegis <evaluations@your-domain.example>
```

Give the API and worker the same values. Workspace owners can then enable a completion address in Settings. Delivery is idempotent per evaluation and destination, excludes prompts/traces/customer records, records provider status, and retries failed or interrupted sends up to three times with:

```bash
python -m app.maintenance notifications
```

Verify the sending domain before enabling customer delivery. The worker records successful sends in the audit trail.

## Evaluation integrity

- Scenario identity hashes the prompt, expected behavior, initial state, tool definitions and injected content.
- Each version records a suite hash, evaluator versions, target model and actual serving model.
- Release comparisons score only the exact paired scenario set. Coverage additions/removals are reported separately and an incompatible suite gets no score delta.
- Target models are pinned by default. Fallbacks require an explicit experimental run.
- Progress and trace `GET` requests never execute paid work. Workers claim jobs with leases and `SKIP LOCKED`, recover expired leases, bound retries, and settle usage idempotently.
- “Consistency” remains the compatibility key on the API, but the interface calls it **loop resistance**, which is what it actually measures. Aegis reports performance on the tested scenarios rather than universal safety.

## Human-reviewed benchmark

Every completed trace can be labeled by a team member. For flagged runs, record a
confirmed issue, false positive, or accepted risk. Sample passing runs too and mark
them confirmed correct or a missed issue; reviewing failures alone cannot measure
false negatives.

Owners and admins can download a privacy-minimized label set from **API & Audit →
Export reviewed benchmark**. The export contains scenario fingerprints, predicted
and human labels, finding categories and severity. It excludes prompts, responses,
traces and customer records. Score it with:

```bash
python -m app.benchmark aegis-reviewed-benchmark-2026-09-19.json
```

The result reports the confusion matrix, precision, recall, false-positive and
false-negative rates, Wilson 95% confidence intervals, and majority agreement for
scenario contracts that were run more than once. Treat missing denominators as
insufficient evidence. Use representative pilot labels and repeat important
scenarios before setting a release threshold.

## CI and API keys

Create a named workspace key under **API & Audit**. The raw key is shown once and only its hash is stored. `read`, `evaluate` and `admin` scopes are enforced by the API. Pass it as:

```http
Authorization: Bearer aegis_...
X-Workspace-ID: workspace-id
```

The release gate is available at `GET /api/evaluations/{evaluation_id}/ci-gate`. Use a key with `read` and `evaluate` for ordinary CI; do not grant `admin` unless the integration must change workspace configuration.

## Verification

```bash
pytest -q
cd frontend
npm ci
npm test
npm run typecheck
npm run lint
npm run build
```

The GitHub workflow runs these checks with reproducible installs. A production launch should additionally exercise Supabase Auth, Stripe test-mode renewals/failures/cancellations, the GPU worker, database backup restoration and a staging connected-agent journey.

Deployment order, health signals, alert conditions, incident steps and a repeatable
backup-restore drill are in [docs/operations.md](docs/operations.md). The worker can
emit monitor-friendly queue, webhook and notification health with:

```bash
python -m app.maintenance status
```

Run retention as a scheduled worker command. It is dry-run by default:

```bash
python -m app.maintenance retention
python -m app.maintenance retention --apply
```

It deletes evaluation evidence beyond each workspace's plan retention period and releases reservations that expired before work started. Usage settlement rows and subscription history remain for billing reconciliation.
