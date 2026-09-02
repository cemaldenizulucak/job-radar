-- Job activity fields for public.jobs
-- Run in the Supabase SQL editor. NestJS does not migrate the schema.
--
-- is_active: listing is treated as currently available.
-- last_seen_at: last time discovery observed the listing from a source.
--
-- Existing rows stay active. last_seen_at is backfilled from updated_at /
-- discovered_at / created_at so the 7-day inactive window has a baseline.

alter table public.jobs
  add column if not exists is_active boolean not null default true;

alter table public.jobs
  add column if not exists last_seen_at timestamptz;

update public.jobs
set last_seen_at = coalesce(last_seen_at, updated_at, discovered_at, created_at, now())
where last_seen_at is null;

alter table public.jobs
  alter column last_seen_at set default now();

create index if not exists jobs_active_published_at_idx
  on public.jobs (is_active, published_at desc nulls last);

create index if not exists jobs_last_seen_at_idx
  on public.jobs (last_seen_at);
