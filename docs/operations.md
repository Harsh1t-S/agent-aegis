# Aegis operations runbook

This runbook covers the first paid-pilot architecture: Vercel serves the browser
and API, Postgres stores tenant state and the durable queue, and an outbound-only
GPU host runs the worker and Ollama.

## Deployment order

1. Create an isolated staging Supabase project, Stripe test account configuration,
   Vercel project and worker environment. Never point staging at production data.
2. Back up production before a database release.
3. Apply `supabase/migrations/20260919132626_saas_foundation.sql` with the migration
   identity. The API runtime identity is `aegis_app` and must not own tables.
4. Run the migration job and full CI suite against staging.
5. Deploy the API and frontend. Start one worker, run a reviewed connected-agent
   evaluation, close the browser, and verify that the worker completes it.
6. Verify Stripe test checkout, renewal, failed payment, plan change and cancellation.
7. Promote the same commit and migration to production, then verify `/health` and
   one free behavioral run before enabling model-backed traffic.

Rollback application code through Vercel's prior deployment. Do not reverse a
database migration by hand during an incident. Keep schema changes backward
compatible, restore into a new database when data recovery is required, and point
the application at it only after validation.

## Queue and delivery monitoring

Run this from the worker environment every minute:

```bash
python -m app.maintenance status
```

It emits one JSON object and exits nonzero when a job has exhausted retries, a
lease has expired, a billing webhook failed, a notification exhausted retries, or
the oldest queued job exceeds `AEGIS_QUEUE_ALERT_SECONDS` (300 seconds by
default). Send the nonzero exit and JSON to the host's alerting channel. A queue
can be nonempty and healthy while a worker is processing it.

Retry transient notification deliveries with:

```bash
python -m app.maintenance notifications
```

Inspect a failed job before requeueing it. Provider authentication and exhausted
balances are terminal configuration failures; repeated retries only spend time and
can obscure the incident.

Run retention daily, review its dry run, and only then apply it:

```bash
python -m app.maintenance retention
python -m app.maintenance retention --apply
```

## Backup and restore verification

Use the managed Postgres point-in-time recovery option available for the chosen
Supabase plan. Also take a logical backup before migrations:

```bash
pg_dump --format=custom --no-owner --no-acl "$DATABASE_URL" --file=aegis.backup
```

At least monthly, restore that file into a temporary, isolated database:

```bash
createdb aegis_restore_check
pg_restore --exit-on-error --no-owner --no-acl --dbname=aegis_restore_check aegis.backup
```

Point a staging API at the restored database with hosted authentication enabled.
Confirm tenant A cannot list tenant B's agents, compare row counts for organizations,
workspaces, evaluations, traces, usage events and audit events, and open one private
report from each test tenant. Destroy the temporary database after recording the
result and restore duration. A backup is not considered verified until this restore
drill succeeds.

## Incident priorities

- **Possible tenant-data exposure:** disable affected API traffic, preserve logs,
  rotate API-key pepper and exposed credentials as applicable, and determine the
  exact workspace and time window before restoring service.
- **Runaway model spend:** set the workspace model-spend cap to zero, stop workers,
  revoke the provider key, and inspect usage events before resuming.
- **Queue stall:** run the status command, verify Postgres connectivity, check the
  worker lease owner and Ollama health, then restart one worker. Expired leases are
  reclaimed without creating a second usage settlement.
- **Billing webhook failure:** retain the signed receipt, fix the handler or
  configuration, and replay the event from Stripe. Event IDs and provider creation
  times make replay idempotent and reject stale state changes.

Record every production drill and incident with the commit, migration, database
backup identifier, start/end time, affected workspaces and follow-up owner.
