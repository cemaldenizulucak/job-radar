-- Description-detail fetch bookkeeping for public.jobs
-- Run in the Supabase SQL editor. NestJS does not migrate the schema.
--
-- Used so a PM2 restart does not keep spending the Kariyer.net detail budget
-- on the same first empty list cards. These columns are not match evidence
-- and must not be sent on public GETs.

alter table public.jobs
  add column if not exists detail_fetch_attempts integer not null default 0;

alter table public.jobs
  add column if not exists detail_fetch_attempted_at timestamptz;

comment on column public.jobs.detail_fetch_attempts is
  'Count of description-page fetch attempts. Not match evidence.';

comment on column public.jobs.detail_fetch_attempted_at is
  'When the last description-page fetch was attempted. Used for backoff.';
