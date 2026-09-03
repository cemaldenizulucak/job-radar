-- Grants and expected tables for remaining JobRadar features.
-- Run in the Supabase SQL editor. NestJS uses the service role.

-- Expected live tables (create only if they do not already exist).

create table if not exists public.favorites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  job_id uuid not null,
  created_at timestamptz not null default now(),
  unique (user_id, job_id)
);

create table if not exists public.applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  job_id uuid not null,
  status text not null check (
    status in ('NEW', 'REVIEWING', 'APPLIED', 'INTERVIEW', 'OFFER', 'REJECTED')
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, job_id)
);

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  full_name text,
  email text,
  notifications_enabled boolean default true,
  timezone text,
  country text,
  city text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists favorites_user_id_idx on public.favorites (user_id);
create index if not exists applications_user_id_idx on public.applications (user_id);

alter table public.favorites enable row level security;
alter table public.applications enable row level security;
alter table public.profiles enable row level security;

grant usage on schema public to service_role;

grant select, insert, update, delete on table public.favorites to service_role;
grant select, insert, update, delete on table public.applications to service_role;
grant select, insert, update on table public.profiles to service_role;

-- Live profiles tables may predate these columns. Safe to re-run.
alter table public.profiles add column if not exists display_name text;
alter table public.profiles add column if not exists full_name text;
alter table public.profiles add column if not exists email text;
alter table public.profiles add column if not exists notifications_enabled boolean default true;
alter table public.profiles add column if not exists timezone text;
alter table public.profiles add column if not exists country text;
alter table public.profiles add column if not exists city text;
alter table public.profiles add column if not exists updated_at timestamptz not null default now();
