-- The legacy repair installed the first helper functions as aegis_app. Because
-- the protected tables use FORCE ROW LEVEL SECURITY, those helpers recursively
-- invoked the policies they were evaluating. Install corrected helpers under
-- the migration identity and point every policy at them.
create or replace function private.aegis_is_member_v2(org_id varchar)
returns boolean language sql security definer stable set search_path = '' as $$
  select exists (
    select 1 from aegis.organization_memberships membership
    where membership.organization_id = org_id
      and membership.user_id = current_setting('app.current_user_id', true)
      and membership.status = 'active'
  )
$$;

create or replace function private.aegis_can_access_workspace_v2(target_workspace varchar)
returns boolean language sql security definer stable set search_path = '' as $$
  select exists (
    select 1 from aegis.workspaces workspace
    join aegis.organization_memberships membership
      on membership.organization_id = workspace.organization_id
    where workspace.id = target_workspace
      and membership.user_id = current_setting('app.current_user_id', true)
      and membership.status = 'active'
  )
$$;

revoke all on function private.aegis_is_member_v2(varchar) from public;
revoke all on function private.aegis_can_access_workspace_v2(varchar) from public;
grant execute on function private.aegis_is_member_v2(varchar) to aegis_app;
grant execute on function private.aegis_can_access_workspace_v2(varchar) to aegis_app;

alter policy organizations_policy on aegis.organizations using (
  private.aegis_is_worker() or private.aegis_is_member_v2(id)
  or created_by = current_setting('app.current_user_id', true)
);
alter policy organization_memberships_policy on aegis.organization_memberships
  using (private.aegis_is_worker() or private.aegis_is_member_v2(organization_id))
  with check (private.aegis_is_worker() or private.aegis_is_member_v2(organization_id)
    or user_id = current_setting('app.current_user_id', true));
alter policy workspaces_policy on aegis.workspaces
  using (private.aegis_is_worker() or private.aegis_is_member_v2(organization_id))
  with check (private.aegis_is_worker() or private.aegis_is_member_v2(organization_id));
alter policy workspace_invitations_policy on aegis.workspace_invitations
  using (private.aegis_is_worker() or private.aegis_is_member_v2(organization_id)
    or email = current_setting('app.current_user_email', true))
  with check (private.aegis_is_worker() or private.aegis_is_member_v2(organization_id));
alter policy subscriptions_policy on aegis.subscriptions
  using (private.aegis_is_worker() or private.aegis_is_member_v2(organization_id))
  with check (private.aegis_is_worker() or private.aegis_is_member_v2(organization_id));

do $$
declare table_name text;
begin
  foreach table_name in array array[
    'workspace_api_keys', 'usage_reservations', 'usage_events', 'audit_events',
    'notification_deliveries', 'report_shares', 'agents', 'agent_versions',
    'mock_environments', 'scenarios', 'test_runs', 'evaluation_jobs',
    'execution_traces', 'failure_annotations', 'finding_reviews'
  ] loop
    execute format(
      'alter policy tenant_policy on aegis.%I using ('
      || 'private.aegis_is_worker() or (workspace_id = current_setting(''app.current_workspace_id'', true) '
      || 'and private.aegis_can_access_workspace_v2(workspace_id))) with check ('
      || 'private.aegis_is_worker() or (workspace_id = current_setting(''app.current_workspace_id'', true) '
      || 'and private.aegis_can_access_workspace_v2(workspace_id)))', table_name);
  end loop;
end $$;
