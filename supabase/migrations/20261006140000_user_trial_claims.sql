-- The free trial belongs to the person, not to an organization they can delete.
-- Deleting the final workspace removes its organization, and the next sign-in
-- used to create a new one with a fresh trial every time.
alter table aegis.user_profiles add column if not exists trial_claimed_at timestamp;

-- Everyone who already created an organization has claimed their trial.
update aegis.user_profiles profile
set trial_claimed_at = profile.created_at
where profile.trial_claimed_at is null
  and exists (
    select 1 from aegis.organizations organization
    where organization.created_by = profile.id
  );
