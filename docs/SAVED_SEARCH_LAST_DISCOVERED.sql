-- Persist the last time discovery ran for a saved search.
-- Used by Jobs "Son tarama" when that search is selected.
-- Run in the Supabase SQL editor.

alter table if exists public.saved_searches
  add column if not exists last_discovered_at timestamptz;
