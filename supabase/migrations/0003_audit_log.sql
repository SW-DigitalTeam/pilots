-- 0003_audit_log.sql
-- Append-only audit log. Tier downgrades, consent withdrawals, and plausibility
-- failures write here. It is never updated or deleted — a failed evidence check
-- downgrades the tier and records WHY here; it never silently drops data.

create table audit_log (
  id          bigint generated always as identity primary key,
  at          timestamptz not null default now(),
  actor       uuid,                       -- auth.uid() or null for system jobs
  school_id   uuid references schools (id) on delete set null,
  event       text not null,              -- e.g. 'tier_downgrade', 'consent_withdrawn'
  subject_table text,
  subject_id  uuid,
  detail      jsonb not null default '{}'::jsonb
);
create index audit_log_school_idx on audit_log (school_id, at desc);
create index audit_log_event_idx on audit_log (event, at desc);

-- Append-only: block UPDATE and DELETE for everyone, including the owner.
create or replace function audit_log_immutable()
returns trigger
language plpgsql
as $$
begin
  raise exception 'audit_log is append-only';
end;
$$;

create trigger audit_log_no_update
  before update on audit_log
  for each row execute function audit_log_immutable();
create trigger audit_log_no_delete
  before delete on audit_log
  for each row execute function audit_log_immutable();

-- Writer used by server-side validators and jobs (SECURITY DEFINER so it can
-- insert under RLS). Callers pass the reason for the record.
create or replace function write_audit(
  p_event text,
  p_school uuid,
  p_subject_table text,
  p_subject_id uuid,
  p_detail jsonb default '{}'::jsonb
)
returns void
language sql
security definer
set search_path = public
as $$
  insert into audit_log (actor, school_id, event, subject_table, subject_id, detail)
  values (auth.uid(), p_school, p_event, p_subject_table, p_subject_id, coalesce(p_detail, '{}'::jsonb));
$$;

-- RLS: append-only, school-scoped reads.
alter table audit_log enable row level security;
alter table audit_log force  row level security;

create policy audit_log_read on audit_log for select
  using (auth_is_sw_admin() or school_id in (select auth_school_ids()));
-- No INSERT/UPDATE/DELETE policies: writes go exclusively through write_audit()
-- (SECURITY DEFINER); the immutability triggers block mutation regardless.

comment on table audit_log is
  'Append-only. Tier downgrades and consent withdrawals are recorded here; rows are never updated or deleted.';
