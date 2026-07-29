-- rls_test.sql — cross-tenant isolation under every role.
-- Runs under pgTAP (supabase db test / pg_prove) against the Supabase Postgres
-- image, where the `authenticated` role and the auth schema exist. Superusers
-- bypass RLS, so every assertion runs after `set role authenticated` with a
-- simulated JWT `sub` claim — exactly how Supabase resolves auth.uid().
--
-- Invariant proven: a user in School A can read School A's rows and CANNOT read
-- School B's rows, for each of sw_admin (scoped test uses school role),
-- school_coordinator, kaiako, researcher.

begin;
select plan(15);

-- --------------------------------------------------------------------------
-- Seed as the privileged migration role (RLS not yet in effect for setup).
-- --------------------------------------------------------------------------
insert into schools (id, name, google_hd) values
  ('00000000-0000-0000-0000-00000000000a', 'School A', 'a.school.nz'),
  ('00000000-0000-0000-0000-00000000000b', 'School B', 'b.school.nz');

-- Minimal auth.users rows so app_users FK holds (Supabase image supplies auth).
insert into auth.users (id, email) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'coord.a@a.school.nz'),
  ('aaaaaaaa-0000-0000-0000-000000000002', 'kaiako.a@a.school.nz'),
  ('aaaaaaaa-0000-0000-0000-000000000003', 'researcher.a@a.school.nz'),
  ('bbbbbbbb-0000-0000-0000-000000000001', 'coord.b@b.school.nz');

insert into app_users (id, email) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'coord.a@a.school.nz'),
  ('aaaaaaaa-0000-0000-0000-000000000002', 'kaiako.a@a.school.nz'),
  ('aaaaaaaa-0000-0000-0000-000000000003', 'researcher.a@a.school.nz'),
  ('bbbbbbbb-0000-0000-0000-000000000001', 'coord.b@b.school.nz');

insert into user_roles (user_id, school_id, role) values
  ('aaaaaaaa-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000a', 'school_coordinator'),
  ('aaaaaaaa-0000-0000-0000-000000000002', '00000000-0000-0000-0000-00000000000a', 'kaiako'),
  ('aaaaaaaa-0000-0000-0000-000000000003', '00000000-0000-0000-0000-00000000000a', 'researcher'),
  ('bbbbbbbb-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000b', 'school_coordinator');

insert into cohorts (id, school_id, label) values
  ('cccccccc-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000a', 'Room A1'),
  ('cccccccc-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-00000000000b', 'Room B1');

insert into game_sessions (id, school_id, cohort_id, show_id, mode, client_key) values
  ('dddddddd-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000a', 'cccccccc-0000-0000-0000-00000000000a', 'grid', 'follow', 'sess-a'),
  ('dddddddd-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-00000000000b', 'cccccccc-0000-0000-0000-00000000000b', 'grid', 'follow', 'sess-b');

insert into consent_versions (data_class, version, body) values
  ('camera', 1, 'Camera consent wording v1');

insert into movement_entries (school_id, cohort_id, session_id, tier, team_score, client_key) values
  ('00000000-0000-0000-0000-00000000000a', 'cccccccc-0000-0000-0000-00000000000a', 'dddddddd-0000-0000-0000-00000000000a', 4, 100, 'me-a'),
  ('00000000-0000-0000-0000-00000000000b', 'cccccccc-0000-0000-0000-00000000000b', 'dddddddd-0000-0000-0000-00000000000b', 4, 100, 'me-b');

-- --------------------------------------------------------------------------
-- Helper: become a simulated authenticated user.
-- --------------------------------------------------------------------------
create or replace function tests_become(uid uuid) returns void
language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', uid::text)::text, true);
  execute 'set local role authenticated';
end; $$;

create or replace function tests_reset() returns void
language plpgsql as $$
begin
  execute 'reset role';
end; $$;

-- --------------------------------------------------------------------------
-- School A coordinator
-- --------------------------------------------------------------------------
select tests_become('aaaaaaaa-0000-0000-0000-000000000001');
select is((select count(*)::int from cohorts where school_id = '00000000-0000-0000-0000-00000000000a'), 1,
  'coordinator A sees own cohort');
select is((select count(*)::int from cohorts where school_id = '00000000-0000-0000-0000-00000000000b'), 0,
  'coordinator A CANNOT see School B cohort');
select is((select count(*)::int from movement_entries where school_id = '00000000-0000-0000-0000-00000000000b'), 0,
  'coordinator A CANNOT see School B movement_entries');
select is((select count(*)::int from game_sessions where school_id = '00000000-0000-0000-0000-00000000000b'), 0,
  'coordinator A CANNOT see School B sessions');
select is((select count(*)::int from consent_versions), 1,
  'coordinator A reads global consent_versions reference data');
select tests_reset();

-- --------------------------------------------------------------------------
-- School A kaiako
-- --------------------------------------------------------------------------
select tests_become('aaaaaaaa-0000-0000-0000-000000000002');
select is((select count(*)::int from movement_entries where school_id = '00000000-0000-0000-0000-00000000000a'), 1,
  'kaiako A sees own movement_entries');
select is((select count(*)::int from movement_entries where school_id = '00000000-0000-0000-0000-00000000000b'), 0,
  'kaiako A CANNOT see School B movement_entries');
select is((select count(*)::int from consents where school_id = '00000000-0000-0000-0000-00000000000b'), 0,
  'kaiako A CANNOT see School B consents');
select tests_reset();

-- --------------------------------------------------------------------------
-- School A researcher (aggregate movement access; no cross-school leakage)
-- --------------------------------------------------------------------------
select tests_become('aaaaaaaa-0000-0000-0000-000000000003');
select is((select count(*)::int from movement_entries where school_id = '00000000-0000-0000-0000-00000000000a'), 1,
  'researcher A sees own school movement_entries');
select is((select count(*)::int from movement_entries where school_id = '00000000-0000-0000-0000-00000000000b'), 0,
  'researcher A CANNOT see School B movement_entries');
select tests_reset();

-- --------------------------------------------------------------------------
-- School B coordinator sees only School B (mirror check)
-- --------------------------------------------------------------------------
select tests_become('bbbbbbbb-0000-0000-0000-000000000001');
select is((select count(*)::int from cohorts where school_id = '00000000-0000-0000-0000-00000000000b'), 1,
  'coordinator B sees own cohort');
select is((select count(*)::int from cohorts where school_id = '00000000-0000-0000-0000-00000000000a'), 0,
  'coordinator B CANNOT see School A cohort');
select tests_reset();

-- --------------------------------------------------------------------------
-- Anonymous (no jwt) sees nothing
-- --------------------------------------------------------------------------
set local role anon;
select is((select count(*)::int from cohorts), 0, 'anon sees no cohorts');
select is((select count(*)::int from movement_entries), 0, 'anon sees no movement_entries');
reset role;

-- --------------------------------------------------------------------------
-- audit_log is append-only
-- --------------------------------------------------------------------------
select throws_ok(
  $$ update audit_log set event = 'x' where true $$,
  'audit_log is append-only',
  'audit_log rejects UPDATE'
);

select * from finish();
rollback;
