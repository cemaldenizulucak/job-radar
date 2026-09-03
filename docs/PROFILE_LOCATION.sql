-- Profile home location used as the default saved-search location.
-- Nullable so existing accounts keep working without a setup step.
-- Safe to re-run. Does not drop or rewrite existing profile rows.

alter table public.profiles add column if not exists country text;
alter table public.profiles add column if not exists city text;

grant select, insert, update on table public.profiles to service_role;
