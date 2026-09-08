-- Multi-select provinces on saved_searches. Keep scalar columns for older rows.
-- Run in the Supabase SQL editor after SAVED_SEARCH_LOCATION.sql.

alter table if exists public.saved_searches
  add column if not exists subdivision_codes text[] not null default '{}',
  add column if not exists subdivision_names text[] not null default '{}';

update public.saved_searches
set subdivision_codes = array[subdivision_code]
where subdivision_code is not null
  and btrim(subdivision_code) <> ''
  and cardinality(subdivision_codes) = 0;

update public.saved_searches
set subdivision_names = array[subdivision_name]
where subdivision_name is not null
  and btrim(subdivision_name) <> ''
  and cardinality(subdivision_names) = 0;
