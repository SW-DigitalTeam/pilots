-- 0001_core_schema.sql
-- Core identity, consent and evidence schema. School is the tenant.
-- RLS is enabled and FORCEd in 0002; the audit log lives in 0003.
--
-- No student PII lives anywhere in this schema by design: participants are
-- represented only as cohorts (classes). Only staff exist as identified users,
-- and they are the only rows tied to auth.users.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type user_role as enum ('sw_admin', 'school_coordinator', 'kaiako', 'researcher');
create type consent_data_class as enum ('camera', 'motion', 'survey');
create type consent_grantor as enum ('school', 'caregiver', 'participant');
create type game_mode as enum ('follow', 'dodge', 'pop');

-- Evidence tier. The CLIENT NEVER SETS THIS — the server assigns it after
-- plausibility checks (see 0003 audit log; validators land in a later migration).
--   0 self-reported | 1 kaiako-attested | 4 on-device pose
-- Stored as smallint with a check so unused tiers (2,3) are reserved but invalid
-- until their providers exist.
create domain evidence_tier as smallint
  check (value in (0, 1, 4));

-- ---------------------------------------------------------------------------
-- Tenancy root: schools
-- ---------------------------------------------------------------------------
create table schools (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  -- Google Workspace domain(s) allowlisted for this school's staff (hd claim).
  google_hd     text not null,
  region        text not null default 'Waikato',
  -- Regional leaderboard participation is per-school opt-in, aggregate only.
  regional_opt_in boolean not null default false,
  -- Per-pilot retention clock; the scheduled job enforces deletion after this.
  retention_months integer not null default 12,
  created_at    timestamptz not null default now()
);

comment on column schools.google_hd is
  'Allowlisted Google Workspace domain for staff sign-in (Google hd claim). Never personal Gmail.';

-- ---------------------------------------------------------------------------
-- Staff users (the only identified people in the system)
-- ---------------------------------------------------------------------------
create table app_users (
  id          uuid primary key references auth.users (id) on delete cascade,
  email       text not null,
  full_name   text,
  created_at  timestamptz not null default now()
);

create table user_roles (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references app_users (id) on delete cascade,
  school_id   uuid not null references schools (id) on delete cascade,
  role        user_role not null,
  created_at  timestamptz not null default now(),
  unique (user_id, school_id, role)
);
create index user_roles_user_idx on user_roles (user_id);
create index user_roles_school_idx on user_roles (school_id);

-- ---------------------------------------------------------------------------
-- Cohorts = classes/teams. No individual students, ever.
-- ---------------------------------------------------------------------------
create table cohorts (
  id          uuid primary key default gen_random_uuid(),
  school_id   uuid not null references schools (id) on delete cascade,
  label       text not null,               -- "Room 12", "9 Blue"
  created_at  timestamptz not null default now(),
  archived_at timestamptz
);
create index cohorts_school_idx on cohorts (school_id);

-- ---------------------------------------------------------------------------
-- Consent as data
-- ---------------------------------------------------------------------------
create table consent_versions (
  id          uuid primary key default gen_random_uuid(),
  data_class  consent_data_class not null,
  version     integer not null,
  body        text not null,               -- the wording presented
  published_at timestamptz not null default now(),
  active      boolean not null default true,
  unique (data_class, version)
);

-- A granted consent for a cohort against a specific version. Withdrawal is a
-- set withdrawn_at plus a cascade handled server-side (later migration/job).
create table consents (
  id                 uuid primary key default gen_random_uuid(),
  school_id          uuid not null references schools (id) on delete cascade,
  cohort_id          uuid not null references cohorts (id) on delete cascade,
  consent_version_id uuid not null references consent_versions (id),
  data_class         consent_data_class not null,
  grantor            consent_grantor not null,
  granted_at         timestamptz not null default now(),
  withdrawn_at       timestamptz
);
create index consents_cohort_idx on consents (cohort_id);
create index consents_active_idx on consents (cohort_id, data_class) where withdrawn_at is null;

-- ---------------------------------------------------------------------------
-- Game sessions + evidence
-- ---------------------------------------------------------------------------
create table game_sessions (
  id          uuid primary key default gen_random_uuid(),
  school_id   uuid not null references schools (id) on delete cascade,
  cohort_id   uuid not null references cohorts (id) on delete cascade,
  show_id     text not null,
  mode        game_mode not null,
  started_at  timestamptz not null default now(),
  ended_at    timestamptz,
  -- Idempotency for offline sync: a replayed insert is a no-op.
  client_key  text not null unique
);
create index game_sessions_cohort_idx on game_sessions (cohort_id);

-- Derived aggregates only. NO frames, NO landmarks — enforced by the absence of
-- any such column and by the privacy lint rules on the write path.
create table movement_entries (
  id                 uuid primary key default gen_random_uuid(),
  school_id          uuid not null references schools (id) on delete cascade,
  cohort_id          uuid not null references cohorts (id) on delete cascade,
  session_id         uuid references game_sessions (id) on delete cascade,
  -- Server-assigned. Defaults to the lowest tier; a validator elevates it.
  tier               evidence_tier not null default 0,
  active_seconds     numeric(10,2) not null default 0 check (active_seconds >= 0),
  movement_magnitude numeric(10,4) not null default 0 check (movement_magnitude >= 0),
  team_score         integer not null default 0 check (team_score >= 0),
  provider_id        text not null default 'cameraPose',
  client_key         text not null unique,          -- idempotent offline sync
  created_at         timestamptz not null default now()
);
create index movement_entries_cohort_idx on movement_entries (cohort_id);
create index movement_entries_tier_idx on movement_entries (tier);

comment on column movement_entries.tier is
  'Server-assigned evidence tier. Client submissions are clamped to 0 and elevated only by a server-side validator (see audit_log). Existing self-reported rows are Tier 0 and stay valid.';
