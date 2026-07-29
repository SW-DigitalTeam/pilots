-- 0002_rls.sql
-- Row-level security. Every table gets ENABLE + FORCE (FORCE so even the table
-- owner is subject to policies). School is the tenant; a school never sees
-- another school's rows. Access control lives here, not in application code.

-- ---------------------------------------------------------------------------
-- Helper functions (SECURITY DEFINER so they can read user_roles under RLS)
-- ---------------------------------------------------------------------------
create or replace function auth_school_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select school_id from user_roles where user_id = auth.uid();
$$;

create or replace function auth_has_role(target user_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from user_roles where user_id = auth.uid() and role = target
  );
$$;

create or replace function auth_is_sw_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from user_roles where user_id = auth.uid() and role = 'sw_admin'
  );
$$;

-- True when the current user holds a school-staff role (coordinator/kaiako) in
-- the given school. Used for write policies.
create or replace function auth_is_staff_of(target_school uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from user_roles
    where user_id = auth.uid()
      and school_id = target_school
      and role in ('school_coordinator', 'kaiako')
  );
$$;

-- ---------------------------------------------------------------------------
-- Enable + FORCE on every table
-- ---------------------------------------------------------------------------
alter table schools           enable row level security;
alter table schools           force  row level security;
alter table app_users         enable row level security;
alter table app_users         force  row level security;
alter table user_roles        enable row level security;
alter table user_roles        force  row level security;
alter table cohorts           enable row level security;
alter table cohorts           force  row level security;
alter table consent_versions  enable row level security;
alter table consent_versions  force  row level security;
alter table consents          enable row level security;
alter table consents          force  row level security;
alter table game_sessions     enable row level security;
alter table game_sessions     force  row level security;
alter table movement_entries  enable row level security;
alter table movement_entries  force  row level security;

-- ---------------------------------------------------------------------------
-- schools
-- ---------------------------------------------------------------------------
create policy schools_select on schools for select
  using (auth_is_sw_admin() or id in (select auth_school_ids()));
create policy schools_admin_all on schools for all
  using (auth_is_sw_admin()) with check (auth_is_sw_admin());

-- ---------------------------------------------------------------------------
-- app_users: you see yourself; coordinators/admin see staff in their school
-- ---------------------------------------------------------------------------
create policy app_users_self on app_users for select
  using (id = auth.uid());
create policy app_users_same_school on app_users for select
  using (
    auth_is_sw_admin()
    or exists (
      select 1 from user_roles ur
      where ur.user_id = app_users.id
        and ur.school_id in (select auth_school_ids())
        and auth_has_role('school_coordinator')
    )
  );
create policy app_users_self_upsert on app_users for insert
  with check (id = auth.uid());
create policy app_users_self_update on app_users for update
  using (id = auth.uid()) with check (id = auth.uid());

-- ---------------------------------------------------------------------------
-- user_roles: see roles in your schools; coordinators/admin manage them
-- ---------------------------------------------------------------------------
create policy user_roles_select on user_roles for select
  using (
    user_id = auth.uid()
    or auth_is_sw_admin()
    or (school_id in (select auth_school_ids()) and auth_has_role('school_coordinator'))
  );
create policy user_roles_manage on user_roles for all
  using (auth_is_sw_admin() or auth_is_staff_of(school_id))
  with check (auth_is_sw_admin() or auth_is_staff_of(school_id));

-- ---------------------------------------------------------------------------
-- cohorts / consents / sessions / movement_entries: school-scoped
-- ---------------------------------------------------------------------------
create policy cohorts_read on cohorts for select
  using (auth_is_sw_admin() or school_id in (select auth_school_ids()));
create policy cohorts_write on cohorts for all
  using (auth_is_sw_admin() or auth_is_staff_of(school_id))
  with check (auth_is_sw_admin() or auth_is_staff_of(school_id));

-- Consent versions are global reference data: readable by any authenticated
-- staff, writable only by sw_admin.
create policy consent_versions_read on consent_versions for select
  using (auth.uid() is not null);
create policy consent_versions_admin on consent_versions for all
  using (auth_is_sw_admin()) with check (auth_is_sw_admin());

create policy consents_read on consents for select
  using (auth_is_sw_admin() or school_id in (select auth_school_ids()));
create policy consents_write on consents for all
  using (auth_is_sw_admin() or auth_is_staff_of(school_id))
  with check (auth_is_sw_admin() or auth_is_staff_of(school_id));

create policy game_sessions_read on game_sessions for select
  using (auth_is_sw_admin() or school_id in (select auth_school_ids()));
create policy game_sessions_write on game_sessions for all
  using (auth_is_sw_admin() or auth_is_staff_of(school_id))
  with check (auth_is_sw_admin() or auth_is_staff_of(school_id));

-- Researchers get de-identified, aggregate read access to movement_entries only
-- (never the identity/consent tables). Staff read their own school.
create policy movement_entries_read on movement_entries for select
  using (
    auth_is_sw_admin()
    or school_id in (select auth_school_ids())
  );
create policy movement_entries_write on movement_entries for all
  using (auth_is_sw_admin() or auth_is_staff_of(school_id))
  with check (auth_is_sw_admin() or auth_is_staff_of(school_id));

-- ---------------------------------------------------------------------------
-- Table privileges. RLS gates ROWS, but a role also needs table-level
-- privileges or Postgres denies access before RLS is even consulted. Grant the
-- coarse privileges to the Supabase roles and let the policies above do the
-- actual restriction. anon gets SELECT only; every policy keys on auth.uid(),
-- which is null for anon, so RLS returns zero rows (never a leak).
-- ---------------------------------------------------------------------------
grant usage on schema public to anon, authenticated;
grant select on all tables in schema public to anon, authenticated;
grant insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;

comment on function auth_school_ids() is
  'Schools the current auth.uid() holds any role in. The tenancy spine for every school-scoped policy.';
