-- Per-user job visibility / read state for the NEW badge.
-- Run in the Supabase SQL editor. NestJS uses the service role.

create table if not exists public.user_job_states (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  job_id uuid not null,
  seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, job_id)
);

create index if not exists user_job_states_user_id_idx
  on public.user_job_states (user_id);

create or replace function public.set_user_job_states_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists user_job_states_set_updated_at on public.user_job_states;

create trigger user_job_states_set_updated_at
before update on public.user_job_states
for each row
execute procedure public.set_user_job_states_updated_at();

alter table public.user_job_states enable row level security;

-- Mobile never queries this table directly. NestJS uses the service role,
-- which bypasses RLS. Keep RLS on so the anon key cannot read or write states.
grant select, insert, update, delete on table public.user_job_states to service_role;
