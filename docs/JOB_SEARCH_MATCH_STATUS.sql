-- Backward-compatible match status for job_search_matches.
-- Re-runnable in the Supabase SQL editor. NestJS does not migrate the schema.
-- Does not encode any listing, company, user, or saved search id.

alter table public.job_search_matches
  add column if not exists match_status text not null default 'verified';

update public.job_search_matches
set match_status = 'verified'
where match_status is null
   or match_status not in ('verified', 'unverified_source_candidate');

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'job_search_matches_match_status_check'
      and conrelid = 'public.job_search_matches'::regclass
  ) then
    alter table public.job_search_matches
      add constraint job_search_matches_match_status_check
      check (match_status in ('verified', 'unverified_source_candidate'));
  end if;
end $$;

create index if not exists job_search_matches_saved_search_id_idx
  on public.job_search_matches (saved_search_id);

create index if not exists job_search_matches_job_id_idx
  on public.job_search_matches (job_id);

create index if not exists job_search_matches_status_idx
  on public.job_search_matches (saved_search_id, match_status);

alter table public.job_search_matches enable row level security;

grant select, insert, update, delete on table public.job_search_matches
  to service_role;

comment on column public.job_search_matches.match_status is
  'verified = text evidence matched; unverified_source_candidate = listing came from a controlled source query but description could not be verified.';
