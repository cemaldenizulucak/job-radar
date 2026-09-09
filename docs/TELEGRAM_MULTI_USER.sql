-- JobRadar multi-user Telegram linking + per-user send ledger
-- Re-runnable in the Supabase SQL editor. NestJS does not migrate the schema.
-- Does not delete existing telegram_job_notifications, notifications,
-- saved_searches, favorites, or application rows.
--
-- NestJS uses the service role (bypasses RLS) for linking, webhooks, and
-- discovery sends. Keep RLS on so the anon key cannot read chat IDs or hashes.

-- ---------------------------------------------------------------------------
-- 1. public.user_telegram_connections
-- ---------------------------------------------------------------------------

create table if not exists public.user_telegram_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  telegram_chat_id text not null,
  telegram_user_id text,
  telegram_username text,
  connected_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id),
  unique (telegram_chat_id)
);

create index if not exists user_telegram_connections_chat_id_idx
  on public.user_telegram_connections (telegram_chat_id);

create or replace function public.set_user_telegram_connections_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists user_telegram_connections_set_updated_at
  on public.user_telegram_connections;

create trigger user_telegram_connections_set_updated_at
before update on public.user_telegram_connections
for each row
execute procedure public.set_user_telegram_connections_updated_at();

alter table public.user_telegram_connections enable row level security;

revoke all on table public.user_telegram_connections from public, anon, authenticated;

grant select, insert, update, delete
  on table public.user_telegram_connections to service_role;

-- Authenticated clients may read their own row, but not the raw chat ID.
grant select (
  id,
  user_id,
  telegram_user_id,
  telegram_username,
  connected_at,
  updated_at
) on table public.user_telegram_connections to authenticated;

drop policy if exists user_telegram_connections_select_own
  on public.user_telegram_connections;

create policy user_telegram_connections_select_own
  on public.user_telegram_connections
  for select
  to authenticated
  using (auth.uid() = user_id);

comment on table public.user_telegram_connections is
  'One Telegram private chat per JobRadar user. Chat IDs are service-role only.';

-- ---------------------------------------------------------------------------
-- 2. public.telegram_link_codes — hashed, single-use, 10-minute codes
-- ---------------------------------------------------------------------------

create table if not exists public.telegram_link_codes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  code_hash text not null,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

create unique index if not exists telegram_link_codes_one_active_per_user_uidx
  on public.telegram_link_codes (user_id)
  where consumed_at is null;

create unique index if not exists telegram_link_codes_hash_uidx
  on public.telegram_link_codes (code_hash);

create index if not exists telegram_link_codes_user_created_idx
  on public.telegram_link_codes (user_id, created_at desc);

alter table public.telegram_link_codes enable row level security;

revoke all on table public.telegram_link_codes from public, anon, authenticated;

grant select, insert, update, delete
  on table public.telegram_link_codes to service_role;

comment on table public.telegram_link_codes is
  'Hashed one-time Telegram link codes. Raw codes are never stored.';

comment on column public.telegram_link_codes.code_hash is
  'SHA-256 hex of the normalized JR-XXXXXXXX code. Not the raw code.';

-- ---------------------------------------------------------------------------
-- 3. public.telegram_processed_updates — webhook update_id dedupe
-- ---------------------------------------------------------------------------

create table if not exists public.telegram_processed_updates (
  update_id bigint primary key,
  processed_at timestamptz not null default now()
);

alter table public.telegram_processed_updates enable row level security;

revoke all on table public.telegram_processed_updates from public, anon, authenticated;

grant select, insert, update, delete
  on table public.telegram_processed_updates to service_role;

comment on table public.telegram_processed_updates is
  'Durable Telegram update_id set so a retried webhook cannot link twice.';

-- ---------------------------------------------------------------------------
-- 4. public.telegram_job_notifications — per-user send-once
-- ---------------------------------------------------------------------------

alter table public.telegram_job_notifications
  add column if not exists user_id uuid;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'telegram_job_notifications_user_id_fkey'
      and conrelid = 'public.telegram_job_notifications'::regclass
  ) then
    alter table public.telegram_job_notifications
      add constraint telegram_job_notifications_user_id_fkey
      foreign key (user_id) references auth.users (id) on delete cascade;
  end if;
end $$;

drop index if exists public.telegram_job_notifications_job_id_uidx;

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'telegram_job_notifications_job_id_key'
      and conrelid = 'public.telegram_job_notifications'::regclass
  ) then
    alter table public.telegram_job_notifications
      drop constraint telegram_job_notifications_job_id_key;
  end if;
end $$;

create unique index if not exists telegram_job_notifications_user_job_uidx
  on public.telegram_job_notifications (user_id, job_id)
  where user_id is not null;

create index if not exists telegram_job_notifications_user_status_idx
  on public.telegram_job_notifications (user_id, status);

comment on table public.telegram_job_notifications is
  'One row per (user, job) for Telegram send-once. pending/sending can retry; sent is final. Legacy rows may have null user_id.';

-- ---------------------------------------------------------------------------
-- 5. Atomic link: consume code + bind chat, or reject an already-used chat
-- ---------------------------------------------------------------------------

create or replace function public.link_telegram_account(
  p_code_hash text,
  p_telegram_chat_id text,
  p_telegram_user_id text,
  p_telegram_username text
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_code public.telegram_link_codes%rowtype;
  v_existing public.user_telegram_connections%rowtype;
  v_now timestamptz := clock_timestamp();
begin
  if p_code_hash is null or length(p_code_hash) = 0
     or p_telegram_chat_id is null or length(p_telegram_chat_id) = 0 then
    return jsonb_build_object('ok', false, 'reason', 'invalid_or_expired');
  end if;

  select *
  into v_code
  from public.telegram_link_codes
  where code_hash = p_code_hash
  for update;

  if not found
     or v_code.consumed_at is not null
     or v_code.expires_at <= v_now then
    return jsonb_build_object('ok', false, 'reason', 'invalid_or_expired');
  end if;

  select *
  into v_existing
  from public.user_telegram_connections
  where telegram_chat_id = p_telegram_chat_id
  for update;

  if found and v_existing.user_id <> v_code.user_id then
    return jsonb_build_object('ok', false, 'reason', 'chat_linked_to_other_user');
  end if;

  update public.telegram_link_codes
  set consumed_at = v_now
  where id = v_code.id
    and consumed_at is null
    and expires_at > v_now;

  if not found then
    return jsonb_build_object('ok', false, 'reason', 'invalid_or_expired');
  end if;

  insert into public.user_telegram_connections (
    user_id,
    telegram_chat_id,
    telegram_user_id,
    telegram_username,
    connected_at,
    updated_at
  ) values (
    v_code.user_id,
    p_telegram_chat_id,
    nullif(p_telegram_user_id, ''),
    nullif(p_telegram_username, ''),
    v_now,
    v_now
  )
  on conflict (user_id) do update
  set
    telegram_chat_id = excluded.telegram_chat_id,
    telegram_user_id = excluded.telegram_user_id,
    telegram_username = excluded.telegram_username,
    connected_at = excluded.connected_at,
    updated_at = excluded.updated_at;

  return jsonb_build_object('ok', true, 'user_id', v_code.user_id);
end;
$$;

revoke all on function public.link_telegram_account(text, text, text, text)
  from public, anon, authenticated;

grant execute on function public.link_telegram_account(text, text, text, text)
  to service_role;

comment on function public.link_telegram_account(text, text, text, text) is
  'Consume a hashed link code and bind telegram_chat_id to that user. Does not steal another user''s chat.';
