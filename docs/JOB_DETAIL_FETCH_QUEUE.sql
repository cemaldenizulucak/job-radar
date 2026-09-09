-- Persistent detail-fetch queue and query cursors.
-- Re-runnable in the Supabase SQL editor. NestJS does not migrate the schema.
-- Mobile/anon clients must not read or write these tables or RPCs.

create table if not exists public.job_detail_fetch_queue (
  job_id uuid primary key references public.jobs (id) on delete cascade,
  source_id text not null,
  source_job_id text not null,
  source_url text not null,
  priority integer not null,
  reason text not null,
  query_term_kind text,
  query_term text,
  query_location text,
  attempts integer not null default 0,
  next_attempt_at timestamptz not null default now(),
  status text not null default 'pending',
  last_error_category text,
  lease_expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.discovery_query_cursors (
  saved_search_id uuid not null,
  source_id text not null,
  fingerprint text not null,
  next_index integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (saved_search_id, source_id)
);

alter table public.job_detail_fetch_queue
  add column if not exists lease_expires_at timestamptz;

update public.job_detail_fetch_queue
set attempts = 0
where attempts < 0;

update public.discovery_query_cursors
set next_index = 0
where next_index < 0;

delete from public.discovery_query_cursors as cursor_row
where not exists (
  select 1
  from public.saved_searches as search_row
  where search_row.id = cursor_row.saved_search_id
);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'job_detail_fetch_queue_status_check'
      and conrelid = 'public.job_detail_fetch_queue'::regclass
  ) then
    alter table public.job_detail_fetch_queue
      add constraint job_detail_fetch_queue_status_check
      check (status in ('pending', 'in_progress', 'failed'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'job_detail_fetch_queue_attempts_nonnegative'
      and conrelid = 'public.job_detail_fetch_queue'::regclass
  ) then
    alter table public.job_detail_fetch_queue
      add constraint job_detail_fetch_queue_attempts_nonnegative
      check (attempts >= 0);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'discovery_query_cursors_next_index_nonnegative'
      and conrelid = 'public.discovery_query_cursors'::regclass
  ) then
    alter table public.discovery_query_cursors
      add constraint discovery_query_cursors_next_index_nonnegative
      check (next_index >= 0);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'discovery_query_cursors_saved_search_id_fkey'
      and conrelid = 'public.discovery_query_cursors'::regclass
  ) then
    alter table public.discovery_query_cursors
      add constraint discovery_query_cursors_saved_search_id_fkey
      foreign key (saved_search_id)
      references public.saved_searches (id)
      on delete cascade;
  end if;
end $$;

drop index if exists public.job_detail_fetch_queue_due_idx;

create index if not exists job_detail_fetch_queue_due_idx
  on public.job_detail_fetch_queue (status, next_attempt_at, priority, job_id);

create or replace function public.claim_job_detail_fetch(
  p_source_id text,
  p_limit integer,
  p_now timestamptz default now(),
  p_lease_seconds integer default 120
)
returns setof public.job_detail_fetch_queue
language plpgsql
security definer
set search_path = public
as $$
declare
  v_limit integer := greatest(coalesce(p_limit, 0), 0);
  v_now timestamptz := coalesce(p_now, now());
  v_lease integer := greatest(coalesce(p_lease_seconds, 120), 1);
begin
  return query
  with picked as (
    select queue.job_id
    from public.job_detail_fetch_queue as queue
    where queue.source_id = p_source_id
      and (
        (queue.status = 'pending' and queue.next_attempt_at <= v_now)
        or (
          queue.status = 'in_progress'
          and queue.lease_expires_at is not null
          and queue.lease_expires_at <= v_now
        )
      )
    order by queue.priority asc, queue.next_attempt_at asc, queue.job_id asc
    limit v_limit
    for update skip locked
  )
  update public.job_detail_fetch_queue as queue
  set
    status = 'in_progress',
    lease_expires_at = v_now + make_interval(secs => v_lease),
    updated_at = v_now
  from picked
  where queue.job_id = picked.job_id
  returning queue.*;
end;
$$;

create or replace function public.upsert_discovery_query_cursor(
  p_saved_search_id uuid,
  p_source_id text,
  p_fingerprint text,
  p_next_index integer,
  p_observed_next_index integer
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_next integer := greatest(coalesce(p_next_index, 0), 0);
  v_observed integer := greatest(coalesce(p_observed_next_index, 0), 0);
begin
  insert into public.discovery_query_cursors as cursor_row (
    saved_search_id,
    source_id,
    fingerprint,
    next_index,
    updated_at
  )
  values (
    p_saved_search_id,
    p_source_id,
    p_fingerprint,
    v_next,
    now()
  )
  on conflict (saved_search_id, source_id) do update
  set
    fingerprint = excluded.fingerprint,
    next_index = excluded.next_index,
    updated_at = now()
  where cursor_row.fingerprint is distinct from excluded.fingerprint
     or cursor_row.next_index = v_observed;
end;
$$;

alter table public.job_detail_fetch_queue enable row level security;
alter table public.discovery_query_cursors enable row level security;

revoke all on table public.job_detail_fetch_queue from anon, authenticated, public;
revoke all on table public.discovery_query_cursors from anon, authenticated, public;

grant select, insert, update, delete on table public.job_detail_fetch_queue
  to service_role;
grant select, insert, update, delete on table public.discovery_query_cursors
  to service_role;

revoke all on function public.claim_job_detail_fetch(text, integer, timestamptz, integer)
  from public, anon, authenticated;
revoke all on function public.upsert_discovery_query_cursor(uuid, text, text, integer, integer)
  from public, anon, authenticated;

grant execute on function public.claim_job_detail_fetch(text, integer, timestamptz, integer)
  to service_role;
grant execute on function public.upsert_discovery_query_cursor(uuid, text, text, integer, integer)
  to service_role;
