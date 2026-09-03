-- Structured location on saved_searches. locations[] stays for older rows.
-- Run in the Supabase SQL editor.

alter table if exists public.saved_searches
  add column if not exists country_code text,
  add column if not exists country_name text,
  add column if not exists subdivision_code text,
  add column if not exists subdivision_name text;
