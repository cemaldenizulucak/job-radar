-- JobRadar Expo push token storage
-- Run in the Supabase SQL editor before enabling device registration.

create table if not exists public.user_push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  expo_push_token text not null,
  platform text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, expo_push_token)
);

create index if not exists user_push_tokens_user_active_idx
  on public.user_push_tokens (user_id)
  where is_active = true;

create or replace function public.set_user_push_tokens_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists user_push_tokens_set_updated_at on public.user_push_tokens;

create trigger user_push_tokens_set_updated_at
before update on public.user_push_tokens
for each row
execute procedure public.set_user_push_tokens_updated_at();

alter table public.user_push_tokens enable row level security;

-- Mobile never queries this table directly. NestJS uses the service role,
-- which bypasses RLS. Keep RLS on so the anon key cannot read tokens.
grant select, insert, update, delete on table public.user_push_tokens to service_role;
