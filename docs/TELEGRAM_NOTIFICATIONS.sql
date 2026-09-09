-- JobRadar notifications schema alignment + Telegram send ledger
-- Re-runnable in the Supabase SQL editor. NestJS does not migrate the schema.
-- Does not delete existing notification rows.
--
-- Root cause of `column notifications.data does not exist`:
-- NestJS selects/inserts `message`, `is_read`, and `data`, while a live table
-- may still be the older shape (`body`, `read_at`, no `data`).
--
-- NestJS never writes `body` or `read_at`. PostgREST rejects unknown columns, so
-- dual-writing those names would break databases that already moved to the new
-- shape. This script keeps legacy columns in place (old SQL/PostgREST readers
-- still work) and syncs them from `message` / `is_read` when they exist.
--
-- If `body` is NOT NULL, dropping that constraint is unnecessary: a BEFORE
-- INSERT/UPDATE trigger copies `message` → `body` so new API inserts satisfy
-- NOT NULL without Nest sending `body`. `body` itself is not dropped.
--
-- Telegram send-once state does not belong on `notifications` (per-user inbox,
-- requires user_id). New matches are tracked in `telegram_job_notifications`
-- keyed by job_id.

-- ---------------------------------------------------------------------------
-- 1. public.notifications — keep inbox inserts working
-- ---------------------------------------------------------------------------

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  type text not null,
  title text not null,
  message text,
  data jsonb,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.notifications add column if not exists data jsonb;
alter table public.notifications add column if not exists message text;
alter table public.notifications add column if not exists is_read boolean not null default false;
alter table public.notifications add column if not exists title text;
alter table public.notifications add column if not exists type text;
alter table public.notifications add column if not exists user_id uuid;
alter table public.notifications add column if not exists created_at timestamptz not null default now();

-- Copy legacy body → message without overwriting rows that already have message.
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'notifications'
      and column_name = 'body'
  ) then
    update public.notifications
    set message = coalesce(message, body)
    where message is null and body is not null;

    update public.notifications
    set body = coalesce(body, message)
    where body is null and message is not null;

    -- Empty string (not NULL) so a leftover NOT NULL on body stays valid.
    -- Does not wipe existing body text.
    update public.notifications
    set body = ''
    where body is null;

    execute 'alter table public.notifications alter column body set default ''''';

    execute $fn$
      create or replace function public.sync_notifications_body_message()
      returns trigger
      language plpgsql
      as $trig$
      begin
        if new.message is null then
          new.message := new.body;
        else
          new.body := new.message;
        end if;

        if new.body is null then
          new.body := coalesce(new.message, '');
        end if;

        if new.message is null then
          new.message := new.body;
        end if;

        return new;
      end;
      $trig$;
    $fn$;

    execute 'drop trigger if exists notifications_sync_body_message on public.notifications';
    execute $trg$
      create trigger notifications_sync_body_message
      before insert or update on public.notifications
      for each row
      execute procedure public.sync_notifications_body_message()
    $trg$;
  end if;
end $$;

-- Copy legacy read_at → is_read. Keep read_at for old readers.
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'notifications'
      and column_name = 'read_at'
  ) then
    update public.notifications
    set is_read = true
    where is_read = false and read_at is not null;

    execute $fn$
      create or replace function public.sync_notifications_read_state()
      returns trigger
      language plpgsql
      as $trig$
      begin
        if new.read_at is not null then
          new.is_read := true;
        elsif tg_op = 'UPDATE' and old.read_at is not null and new.read_at is null then
          new.is_read := false;
        end if;

        if new.is_read is true and new.read_at is null then
          new.read_at := now();
        end if;

        return new;
      end;
      $trig$;
    $fn$;

    execute 'drop trigger if exists notifications_sync_read_state on public.notifications';
    execute $trg$
      create trigger notifications_sync_read_state
      before insert or update on public.notifications
      for each row
      execute procedure public.sync_notifications_read_state()
    $trg$;
  end if;
end $$;

create index if not exists notifications_user_created_idx
  on public.notifications (user_id, created_at desc);

alter table public.notifications enable row level security;

grant select, insert, update, delete on table public.notifications to service_role;

comment on column public.notifications.data is
  'Optional jsonb payload for inbox rows (discoveryRunId, savedSearchId, newJobCount).';

comment on column public.notifications.message is
  'Canonical inbox text used by NestJS. Legacy body is kept in sync by trigger when that column exists.';

-- ---------------------------------------------------------------------------
-- 2. public.telegram_job_notifications — durable Telegram dedupe
-- ---------------------------------------------------------------------------

create table if not exists public.telegram_job_notifications (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null,
  status text not null default 'pending',
  payload jsonb not null default '{}'::jsonb,
  claimed_at timestamptz,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

create unique index if not exists telegram_job_notifications_job_id_uidx
  on public.telegram_job_notifications (job_id);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'telegram_job_notifications_status_check'
      and conrelid = 'public.telegram_job_notifications'::regclass
  ) then
    alter table public.telegram_job_notifications
      add constraint telegram_job_notifications_status_check
      check (status in ('pending', 'sending', 'sent'));
  end if;
end $$;

create index if not exists telegram_job_notifications_status_idx
  on public.telegram_job_notifications (status);

alter table public.telegram_job_notifications enable row level security;

grant select, insert, update, delete
  on table public.telegram_job_notifications to service_role;

comment on table public.telegram_job_notifications is
  'One row per job listing for Telegram send-once. pending/sending can retry; sent is final.';
