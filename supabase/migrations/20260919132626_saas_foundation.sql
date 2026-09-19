-- Aegis SaaS foundation
-- Apply with the Supabase migration role before deploying this release.
set search_path = aegis, public;

create schema if not exists aegis;
create schema if not exists private;

create table if not exists aegis.user_profiles (
  id varchar primary key,
  email varchar(320) not null default '',
  display_name varchar(200) not null default '',
  created_at timestamp not null default now(),
  updated_at timestamp not null default now()
);

create table if not exists aegis.organizations (
  id varchar primary key,
  name varchar(200) not null,
  slug varchar(120) not null unique,
  created_by varchar not null,
  billing_email varchar(320) not null default '',
  created_at timestamp not null default now()
);
create index if not exists ix_organizations_created_by
  on aegis.organizations (created_by);

create table if not exists aegis.organization_memberships (
  id varchar primary key,
  organization_id varchar not null references aegis.organizations(id) on delete cascade,
  user_id varchar not null,
  role varchar(20) not null default 'member',
  status varchar(20) not null default 'active',
  joined_at timestamp not null default now(),
  constraint uq_membership_organization_user unique (organization_id, user_id),
  constraint ck_membership_role check (role in ('owner', 'admin', 'member', 'viewer')),
  constraint ck_membership_status check (status in ('active', 'suspended'))
);
create index if not exists ix_memberships_user
  on aegis.organization_memberships (user_id, status);
create index if not exists ix_memberships_organization
  on aegis.organization_memberships (organization_id);

create table if not exists aegis.workspaces (
  id varchar primary key,
  organization_id varchar not null references aegis.organizations(id) on delete cascade,
  name varchar(200) not null,
  slug varchar(120) not null,
  settings jsonb not null default '{}'::jsonb,
  retention_days integer not null default 90 check (retention_days between 1 and 3650),
  is_demo boolean not null default false,
  created_at timestamp not null default now(),
  constraint uq_workspace_organization_slug unique (organization_id, slug)
);
create index if not exists ix_workspaces_organization
  on aegis.workspaces (organization_id);
create index if not exists ix_workspaces_demo
  on aegis.workspaces (is_demo) where is_demo;

create table if not exists aegis.workspace_invitations (
  id varchar primary key,
  organization_id varchar not null references aegis.organizations(id) on delete cascade,
  email varchar(320) not null,
  role varchar(20) not null default 'member',
  token_hash varchar(64) not null unique,
  invited_by varchar not null,
  status varchar(20) not null default 'pending',
  expires_at timestamp not null,
  created_at timestamp not null default now(),
  accepted_at timestamp null,
  constraint ck_invitation_role check (role in ('admin', 'member', 'viewer')),
  constraint ck_invitation_status check (status in ('pending', 'accepted', 'superseded', 'revoked'))
);
create index if not exists ix_invitations_org_status
  on aegis.workspace_invitations (organization_id, status);
create index if not exists ix_invitations_email
  on aegis.workspace_invitations (email);

create table if not exists aegis.workspace_api_keys (
  id varchar primary key,
  workspace_id varchar not null references aegis.workspaces(id) on delete cascade,
  name varchar(120) not null,
  prefix varchar(24) not null,
  secret_hash varchar(64) not null unique,
  created_by varchar not null,
  scopes jsonb not null default '[]'::jsonb,
  created_at timestamp not null default now(),
  last_used_at timestamp null,
  expires_at timestamp null,
  revoked_at timestamp null
);
create index if not exists ix_api_keys_workspace
  on aegis.workspace_api_keys (workspace_id, created_at desc);
create index if not exists ix_api_keys_prefix
  on aegis.workspace_api_keys (prefix);

create table if not exists aegis.subscriptions (
  organization_id varchar primary key references aegis.organizations(id) on delete cascade,
  provider varchar(30) not null default 'stripe',
  provider_customer_id varchar(120) unique,
  provider_subscription_id varchar(120) unique,
  plan varchar(30) not null default 'trial',
  status varchar(30) not null default 'trialing',
  current_period_start timestamp null,
  current_period_end timestamp null,
  cancel_at_period_end boolean not null default false,
  provider_event_created_at timestamp null,
  updated_at timestamp not null default now()
);
alter table aegis.subscriptions
  add column if not exists provider_event_created_at timestamp null;

create table if not exists aegis.billing_webhook_events (
  id varchar primary key,
  provider varchar(30) not null default 'stripe',
  event_type varchar(120) not null,
  payload jsonb not null default '{}'::jsonb,
  status varchar(20) not null default 'received',
  received_at timestamp not null default now(),
  processed_at timestamp null,
  error text null
);
create index if not exists ix_billing_webhook_status
  on aegis.billing_webhook_events (status, received_at);

create table if not exists aegis.usage_reservations (
  id varchar primary key,
  workspace_id varchar not null references aegis.workspaces(id) on delete cascade,
  evaluation_id varchar null,
  idempotency_key varchar(160) not null unique,
  reserved_units integer not null check (reserved_units > 0),
  reserved_cost_usd double precision not null default 0 check (reserved_cost_usd >= 0),
  settled_units integer not null default 0 check (settled_units >= 0),
  refunded_units integer not null default 0 check (refunded_units >= 0),
  status varchar(20) not null default 'reserved',
  expires_at timestamp not null,
  created_at timestamp not null default now(),
  updated_at timestamp not null default now(),
  constraint ck_usage_reservation_totals check (
    settled_units + refunded_units <= reserved_units
  )
);
alter table aegis.usage_reservations
  add column if not exists reserved_cost_usd double precision not null default 0;
create index if not exists ix_usage_reservations_workspace_status
  on aegis.usage_reservations (workspace_id, status, expires_at);
create index if not exists ix_usage_reservations_evaluation
  on aegis.usage_reservations (evaluation_id);

create table if not exists aegis.usage_events (
  id varchar primary key,
  workspace_id varchar not null references aegis.workspaces(id) on delete cascade,
  reservation_id varchar null references aegis.usage_reservations(id) on delete set null,
  test_run_id varchar null,
  kind varchar(30) not null,
  units integer not null default 0,
  input_tokens integer not null default 0,
  output_tokens integer not null default 0,
  estimated_cost_usd double precision not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  idempotency_key varchar(180) not null unique,
  created_at timestamp not null default now()
);
create index if not exists ix_usage_events_workspace_created
  on aegis.usage_events (workspace_id, created_at);
create index if not exists ix_usage_events_reservation
  on aegis.usage_events (reservation_id);
create index if not exists ix_usage_events_test_run
  on aegis.usage_events (test_run_id);

create table if not exists aegis.audit_events (
  id varchar primary key,
  workspace_id varchar not null references aegis.workspaces(id) on delete cascade,
  actor_user_id varchar null,
  action varchar(120) not null,
  target_type varchar(80) not null default '',
  target_id varchar not null default '',
  detail jsonb not null default '{}'::jsonb,
  created_at timestamp not null default now()
);
create index if not exists ix_audit_workspace_created
  on aegis.audit_events (workspace_id, created_at desc, id desc);
create index if not exists ix_audit_actor
  on aegis.audit_events (actor_user_id);
create index if not exists ix_audit_action
  on aegis.audit_events (action);

create table if not exists aegis.notification_deliveries (
  id varchar primary key,
  workspace_id varchar not null references aegis.workspaces(id) on delete cascade,
  evaluation_id varchar not null,
  channel varchar(30) not null default 'email',
  destination varchar(320) not null,
  status varchar(20) not null default 'queued',
  attempts integer not null default 0,
  provider_id varchar(160) null,
  error text null,
  created_at timestamp not null default now(),
  sent_at timestamp null,
  constraint uq_notification_evaluation_channel_destination
    unique (evaluation_id, channel, destination)
);
create index if not exists ix_notification_workspace_status
  on aegis.notification_deliveries (workspace_id, status, created_at);
create index if not exists ix_notification_evaluation
  on aegis.notification_deliveries (evaluation_id);

-- A new staging or customer installation may not have the pre-SaaS evaluator
-- tables yet. Production already has them, so these definitions are deliberately
-- compatible CREATE IF NOT EXISTS statements before the tenant upgrade below.
create table if not exists aegis.agents (
  id varchar primary key,
  name varchar(200) not null unique,
  description text not null default '',
  endpoint_config jsonb not null default '{}'::jsonb,
  system_prompt text not null default '',
  tool_schema jsonb not null default '{}'::jsonb,
  profile jsonb not null default '{}'::jsonb,
  created_at timestamp not null default now()
);

create table if not exists aegis.agent_versions (
  id varchar primary key,
  agent_id varchar not null references aegis.agents(id) on delete cascade,
  version_label varchar(100) not null,
  config_snapshot jsonb not null default '{}'::jsonb,
  created_at timestamp not null default now()
);
create index if not exists ix_agent_versions_agent
  on aegis.agent_versions (agent_id, created_at);

create table if not exists aegis.mock_environments (
  id varchar primary key,
  name varchar(200) not null,
  tool_definitions jsonb not null default '{}'::jsonb,
  initial_state jsonb not null default '{}'::jsonb,
  injected_content jsonb not null default '{}'::jsonb
);

create table if not exists aegis.scenarios (
  id varchar primary key,
  name varchar(300) not null,
  category varchar(50) not null default 'realistic',
  subtype varchar(100) not null default 'general',
  initial_prompt text not null,
  expected_behavior jsonb not null default '{}'::jsonb,
  mock_environment_id varchar not null references aegis.mock_environments(id) on delete cascade,
  difficulty integer not null default 1,
  generator_version varchar(50) not null default 'manual',
  run_kind varchar(20) not null default 'suite',
  injected_content jsonb not null default '{}'::jsonb,
  fingerprint varchar(80) not null default ''
);
create index if not exists ix_scenarios_environment
  on aegis.scenarios (mock_environment_id);

create table if not exists aegis.test_runs (
  id varchar primary key,
  agent_version_id varchar not null references aegis.agent_versions(id) on delete cascade,
  scenario_id varchar not null references aegis.scenarios(id) on delete cascade,
  replayed_from_run_id varchar null references aegis.test_runs(id) on delete set null,
  status varchar(20) not null default 'pending',
  started_at timestamp null,
  completed_at timestamp null,
  seed integer not null default 0,
  outcome varchar(10) null,
  reliability_score double precision null,
  metrics jsonb null,
  final_state jsonb null,
  duration_ms integer null,
  provenance jsonb null
);
create index if not exists ix_test_runs_version_status
  on aegis.test_runs (agent_version_id, status);
create index if not exists ix_test_runs_scenario
  on aegis.test_runs (scenario_id);

create table if not exists aegis.execution_traces (
  id varchar primary key,
  test_run_id varchar not null references aegis.test_runs(id) on delete cascade,
  step_number integer not null,
  step_type varchar(30) not null,
  payload jsonb not null default '{}'::jsonb,
  timestamp timestamp not null default now(),
  latency_ms integer null
);
create index if not exists ix_execution_traces_run_step
  on aegis.execution_traces (test_run_id, step_number);

create table if not exists aegis.failure_annotations (
  id varchar primary key,
  test_run_id varchar not null references aegis.test_runs(id) on delete cascade,
  failure_type varchar(50) not null,
  severity varchar(20) not null,
  evidence jsonb not null default '{}'::jsonb,
  detector_version varchar(50) not null default 'rules-v2'
);
create index if not exists ix_failure_annotations_run
  on aegis.failure_annotations (test_run_id);

-- Existing rows were the public showcase. Put them in a quarantined demo
-- workspace; the marketing site now reads curated static fixtures instead.
insert into aegis.user_profiles (id, email, display_name)
values ('00000000-0000-0000-0000-000000000001', 'system@aegis.invalid', 'Aegis system')
on conflict (id) do nothing;

insert into aegis.organizations (id, name, slug, created_by, billing_email)
values (
  '00000000-0000-0000-0000-000000000004',
  'Aegis curated demo',
  'aegis-demo',
  '00000000-0000-0000-0000-000000000001',
  'system@aegis.invalid'
)
on conflict (id) do nothing;

insert into aegis.organization_memberships
  (id, organization_id, user_id, role, status)
values (
  '00000000-0000-0000-0000-000000000006',
  '00000000-0000-0000-0000-000000000004',
  '00000000-0000-0000-0000-000000000001',
  'owner',
  'active'
)
on conflict (organization_id, user_id) do nothing;

insert into aegis.workspaces
  (id, organization_id, name, slug, settings, retention_days, is_demo)
values (
  '00000000-0000-0000-0000-000000000005',
  '00000000-0000-0000-0000-000000000004',
  'Curated demo',
  'demo',
  '{"scenariosPerRun": 12, "adversarial": true, "adapter": "behavioral"}'::jsonb,
  365,
  true
)
on conflict (id) do nothing;

-- Add workspace ownership and immutable-dataset metadata to the evaluator data.
alter table aegis.agents add column if not exists workspace_id varchar;
alter table aegis.agent_versions add column if not exists workspace_id varchar;
alter table aegis.agent_versions add column if not exists dataset_hash varchar(64) not null default '';
alter table aegis.mock_environments add column if not exists workspace_id varchar;
alter table aegis.scenarios add column if not exists workspace_id varchar;
alter table aegis.test_runs add column if not exists workspace_id varchar;
alter table aegis.test_runs add column if not exists input_tokens integer not null default 0;
alter table aegis.test_runs add column if not exists output_tokens integer not null default 0;
alter table aegis.test_runs add column if not exists estimated_cost_usd double precision not null default 0;
alter table aegis.execution_traces add column if not exists workspace_id varchar;
alter table aegis.failure_annotations add column if not exists workspace_id varchar;

update aegis.agents set workspace_id = '00000000-0000-0000-0000-000000000005'
where workspace_id is null;
update aegis.agent_versions v set workspace_id = a.workspace_id
from aegis.agents a where v.agent_id = a.id and v.workspace_id is null;
update aegis.test_runs r set workspace_id = v.workspace_id
from aegis.agent_versions v
where r.agent_version_id = v.id and r.workspace_id is null;
update aegis.scenarios s set workspace_id = r.workspace_id
from aegis.test_runs r where r.scenario_id = s.id and s.workspace_id is null;
update aegis.mock_environments e set workspace_id = s.workspace_id
from aegis.scenarios s
where s.mock_environment_id = e.id and e.workspace_id is null;
update aegis.execution_traces t set workspace_id = r.workspace_id
from aegis.test_runs r where t.test_run_id = r.id and t.workspace_id is null;
update aegis.failure_annotations f set workspace_id = r.workspace_id
from aegis.test_runs r where f.test_run_id = r.id and f.workspace_id is null;

alter table aegis.agents alter column workspace_id set not null;
alter table aegis.agent_versions alter column workspace_id set not null;
alter table aegis.mock_environments alter column workspace_id set not null;
alter table aegis.scenarios alter column workspace_id set not null;
alter table aegis.test_runs alter column workspace_id set not null;
alter table aegis.execution_traces alter column workspace_id set not null;
alter table aegis.failure_annotations alter column workspace_id set not null;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'fk_agents_workspace') then
    alter table aegis.agents add constraint fk_agents_workspace
      foreign key (workspace_id) references aegis.workspaces(id) on delete cascade;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'fk_agent_versions_workspace') then
    alter table aegis.agent_versions add constraint fk_agent_versions_workspace
      foreign key (workspace_id) references aegis.workspaces(id) on delete cascade;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'fk_mock_environments_workspace') then
    alter table aegis.mock_environments add constraint fk_mock_environments_workspace
      foreign key (workspace_id) references aegis.workspaces(id) on delete cascade;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'fk_scenarios_workspace') then
    alter table aegis.scenarios add constraint fk_scenarios_workspace
      foreign key (workspace_id) references aegis.workspaces(id) on delete cascade;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'fk_test_runs_workspace') then
    alter table aegis.test_runs add constraint fk_test_runs_workspace
      foreign key (workspace_id) references aegis.workspaces(id) on delete cascade;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'fk_execution_traces_workspace') then
    alter table aegis.execution_traces add constraint fk_execution_traces_workspace
      foreign key (workspace_id) references aegis.workspaces(id) on delete cascade;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'fk_failure_annotations_workspace') then
    alter table aegis.failure_annotations add constraint fk_failure_annotations_workspace
      foreign key (workspace_id) references aegis.workspaces(id) on delete cascade;
  end if;
end $$;

do $$
declare constraint_name text;
begin
  select conname into constraint_name
  from pg_constraint
  where conrelid = 'aegis.agents'::regclass
    and contype = 'u'
    and pg_get_constraintdef(oid) = 'UNIQUE (name)'
  limit 1;
  if constraint_name is not null then
    execute format('alter table aegis.agents drop constraint %I', constraint_name);
  end if;
  if not exists (
    select 1 from pg_constraint
    where conname = 'uq_agents_workspace_name'
      and conrelid = 'aegis.agents'::regclass
  ) then
    alter table aegis.agents add constraint uq_agents_workspace_name
      unique (workspace_id, name);
  end if;
end $$;

create index if not exists ix_agents_workspace_created
  on aegis.agents (workspace_id, created_at);
create index if not exists ix_agent_versions_workspace_created
  on aegis.agent_versions (workspace_id, created_at desc);
create index if not exists ix_agent_versions_dataset_hash
  on aegis.agent_versions (dataset_hash);
create index if not exists ix_mock_environments_workspace
  on aegis.mock_environments (workspace_id);
create index if not exists ix_scenarios_workspace_fingerprint
  on aegis.scenarios (workspace_id, fingerprint);
create index if not exists ix_test_runs_workspace_status
  on aegis.test_runs (workspace_id, status, completed_at);
create index if not exists ix_execution_traces_workspace_run
  on aegis.execution_traces (workspace_id, test_run_id, step_number);
create index if not exists ix_failure_annotations_workspace_run
  on aegis.failure_annotations (workspace_id, test_run_id);

create table if not exists aegis.evaluation_jobs (
  id varchar primary key,
  workspace_id varchar not null references aegis.workspaces(id) on delete cascade,
  test_run_id varchar not null references aegis.test_runs(id) on delete cascade,
  reservation_id varchar null references aegis.usage_reservations(id) on delete set null,
  status varchar(20) not null default 'queued',
  attempts integer not null default 0,
  max_attempts integer not null default 3,
  available_at timestamp not null default now(),
  lease_owner varchar(160) null,
  lease_until timestamp null,
  last_error text null,
  created_at timestamp not null default now(),
  updated_at timestamp not null default now(),
  completed_at timestamp null,
  constraint uq_evaluation_job_run unique (test_run_id),
  constraint ck_evaluation_job_status check (
    status in ('queued', 'running', 'cancel_requested', 'completed', 'failed', 'canceled')
  )
);
create index if not exists ix_jobs_claim
  on aegis.evaluation_jobs (status, available_at, created_at);
create index if not exists ix_jobs_workspace_status
  on aegis.evaluation_jobs (workspace_id, status, lease_until);
create index if not exists ix_jobs_reservation
  on aegis.evaluation_jobs (reservation_id);

create table if not exists aegis.finding_reviews (
  id varchar primary key,
  workspace_id varchar not null references aegis.workspaces(id) on delete cascade,
  test_run_id varchar not null references aegis.test_runs(id) on delete cascade,
  reviewer_user_id varchar not null,
  decision varchar(30) not null,
  note text not null default '',
  created_at timestamp not null default now(),
  updated_at timestamp not null default now(),
  constraint uq_finding_review_run_reviewer unique (test_run_id, reviewer_user_id),
  constraint ck_finding_review_decision check (
    decision in (
      'confirmed_issue', 'false_positive', 'accepted_risk',
      'confirmed_correct', 'missed_issue'
    )
  )
);
create index if not exists ix_finding_reviews_workspace_run
  on aegis.finding_reviews (workspace_id, test_run_id);

create table if not exists aegis.report_shares (
  id varchar primary key,
  workspace_id varchar not null references aegis.workspaces(id) on delete cascade,
  evaluation_id varchar not null references aegis.agent_versions(id) on delete cascade,
  token_hash varchar(64) not null unique,
  created_by varchar not null,
  expires_at timestamp not null,
  revoked_at timestamp null,
  last_accessed_at timestamp null,
  created_at timestamp not null default now()
);
create index if not exists ix_report_shares_workspace_evaluation
  on aegis.report_shares (workspace_id, evaluation_id, created_at desc);
create index if not exists ix_report_shares_expiry
  on aegis.report_shares (expires_at) where revoked_at is null;

-- RLS helpers live outside the exposed application schema and always include
-- the caller identity in membership checks.
create or replace function private.aegis_is_worker()
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce(current_setting('app.worker', true), 'false') = 'true'
$$;

create or replace function private.aegis_is_member(org_id varchar)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1
    from aegis.organization_memberships membership
    where membership.organization_id = org_id
      and membership.user_id = current_setting('app.current_user_id', true)
      and membership.status = 'active'
  )
$$;

create or replace function private.aegis_can_access_workspace(target_workspace varchar)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1
    from aegis.workspaces workspace
    join aegis.organization_memberships membership
      on membership.organization_id = workspace.organization_id
    where workspace.id = target_workspace
      and membership.user_id = current_setting('app.current_user_id', true)
      and membership.status = 'active'
  )
$$;

revoke all on schema aegis from public;
revoke all on all tables in schema aegis from public;
revoke all on schema private from public;
revoke all on all functions in schema private from public;

-- Supabase defines anon/authenticated; plain Postgres staging databases may not.
-- Keep the migration portable while revoking them whenever they exist.
do $$
declare role_name text;
begin
  foreach role_name in array array['anon', 'authenticated']
  loop
    if exists (select 1 from pg_roles where rolname = role_name) then
      execute format('revoke all on schema aegis from %I', role_name);
      execute format('revoke all on all tables in schema aegis from %I', role_name);
      execute format('revoke all on schema private from %I', role_name);
      execute format('revoke all on all functions in schema private from %I', role_name);
    end if;
  end loop;
end $$;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'aegis_app') then
    execute 'grant usage on schema aegis, private to aegis_app';
    execute 'grant select, insert, update, delete on all tables in schema aegis to aegis_app';
    execute 'grant execute on function private.aegis_is_worker() to aegis_app';
    execute 'grant execute on function private.aegis_is_member(varchar) to aegis_app';
    execute 'grant execute on function private.aegis_can_access_workspace(varchar) to aegis_app';
  end if;
end $$;

-- Policies for identity and organization tables.
alter table aegis.user_profiles enable row level security;
alter table aegis.user_profiles force row level security;
drop policy if exists user_profiles_policy on aegis.user_profiles;
create policy user_profiles_policy on aegis.user_profiles
for all using (
  private.aegis_is_worker()
  or id = current_setting('app.current_user_id', true)
) with check (
  private.aegis_is_worker()
  or id = current_setting('app.current_user_id', true)
);

alter table aegis.organizations enable row level security;
alter table aegis.organizations force row level security;
drop policy if exists organizations_policy on aegis.organizations;
create policy organizations_policy on aegis.organizations
for all using (
  private.aegis_is_worker()
  or private.aegis_is_member(id)
  or created_by = current_setting('app.current_user_id', true)
) with check (
  private.aegis_is_worker()
  or created_by = current_setting('app.current_user_id', true)
);

alter table aegis.organization_memberships enable row level security;
alter table aegis.organization_memberships force row level security;
drop policy if exists organization_memberships_policy on aegis.organization_memberships;
create policy organization_memberships_policy on aegis.organization_memberships
for all using (
  private.aegis_is_worker()
  or private.aegis_is_member(organization_id)
) with check (
  private.aegis_is_worker()
  or private.aegis_is_member(organization_id)
  or user_id = current_setting('app.current_user_id', true)
);

alter table aegis.workspaces enable row level security;
alter table aegis.workspaces force row level security;
drop policy if exists workspaces_policy on aegis.workspaces;
create policy workspaces_policy on aegis.workspaces
for all using (
  private.aegis_is_worker()
  or private.aegis_is_member(organization_id)
) with check (
  private.aegis_is_worker()
  or private.aegis_is_member(organization_id)
);

alter table aegis.workspace_invitations enable row level security;
alter table aegis.workspace_invitations force row level security;
drop policy if exists workspace_invitations_policy on aegis.workspace_invitations;
create policy workspace_invitations_policy on aegis.workspace_invitations
for all using (
  private.aegis_is_worker()
  or private.aegis_is_member(organization_id)
  or email = current_setting('app.current_user_email', true)
) with check (
  private.aegis_is_worker()
  or private.aegis_is_member(organization_id)
);

alter table aegis.subscriptions enable row level security;
alter table aegis.subscriptions force row level security;
drop policy if exists subscriptions_policy on aegis.subscriptions;
create policy subscriptions_policy on aegis.subscriptions
for all using (
  private.aegis_is_worker()
  or private.aegis_is_member(organization_id)
) with check (
  private.aegis_is_worker()
  or private.aegis_is_member(organization_id)
);

alter table aegis.billing_webhook_events enable row level security;
alter table aegis.billing_webhook_events force row level security;
drop policy if exists billing_webhook_worker_policy on aegis.billing_webhook_events;
create policy billing_webhook_worker_policy on aegis.billing_webhook_events
for all using (private.aegis_is_worker())
with check (private.aegis_is_worker());

-- Every customer-owned table uses the same workspace predicate. Both the user
-- membership and selected workspace must agree; workers use a separate context.
do $$
declare table_name text;
begin
  foreach table_name in array array[
    'workspace_api_keys', 'usage_reservations', 'usage_events', 'audit_events',
    'notification_deliveries', 'report_shares',
    'agents', 'agent_versions', 'mock_environments', 'scenarios', 'test_runs',
    'evaluation_jobs', 'execution_traces', 'failure_annotations', 'finding_reviews'
  ]
  loop
    execute format('alter table aegis.%I enable row level security', table_name);
    execute format('alter table aegis.%I force row level security', table_name);
    execute format('drop policy if exists tenant_policy on aegis.%I', table_name);
    execute format(
      'create policy tenant_policy on aegis.%I for all using ('
      || 'private.aegis_is_worker() or (workspace_id = current_setting(''app.current_workspace_id'', true) '
      || 'and private.aegis_can_access_workspace(workspace_id))) with check ('
      || 'private.aegis_is_worker() or (workspace_id = current_setting(''app.current_workspace_id'', true) '
      || 'and private.aegis_can_access_workspace(workspace_id)))',
      table_name
    );
  end loop;
end $$;
