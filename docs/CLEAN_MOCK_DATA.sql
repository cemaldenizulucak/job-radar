-- JobRadar mock/fixture cleanup
-- Run in the Supabase SQL editor against the development database.
--
-- Deletes ONLY known development fixture listings that were inserted by:
--   LINKEDIN_PROVIDER=mock
--   KARIYER_NET_PROVIDER=mock
--
-- Does NOT delete live Kariyer.net jobs (numeric listing ids / real
-- /is-ilani/{slug}-{id} URLs such as Front-End Geliştirici).
--
-- Known fixture identities (keep in sync with:
--   apps/api/src/sources/adapters/linkedin-jobs.fixture.ts
--   apps/api/src/sources/kariyer-net/fixtures/kariyer-net-jobs.fixture.ts)
--
-- LinkedIn
--   source_job_id: li-abc-frontend, li-nova-react, li-delta-angular
--   original_url:  https://www.linkedin.com/jobs/view/abc-frontend
--                  https://www.linkedin.com/jobs/view/nova-react
--                  https://www.linkedin.com/jobs/view/delta-angular
--   company/title: ABC Technology / Frontend Developer
--                  Nova Labs / React Developer
--                  Delta Soft / Angular Developer
--
-- Kariyer.net mock
--   source_job_id: kn-abc-frontend, kn-pixel-react, kn-orbit-angular
--   original_url:  https://www.kariyer.net/is-ilani/abc-frontend
--                  https://www.kariyer.net/is-ilani/pixel-react
--                  https://www.kariyer.net/is-ilani/orbit-angular
--   company/title: ABC Technology / Frontend Developer
--                  Pixel Works / React Developer
--                  Orbit Digital / Angular Developer
--
-- Dependent tables deleted first:
--   job_search_matches, user_job_states, favorites, applications
-- Then mock jobs. Then orphaned duplicate_groups (< 2 remaining members).
--
-- Inspect the first result set (preview) in the SQL editor. The deletes run
-- in the same script inside a transaction.

begin;

create temporary table mock_job_ids on commit drop as
select j.id
from public.jobs j
where
  -- LinkedIn fixture identities (LinkedIn has no live provider yet)
  (
    j.source = 'linkedin'
    and (
      j.source_job_id in (
        'li-abc-frontend',
        'li-nova-react',
        'li-delta-angular'
      )
      or j.original_url in (
        'https://www.linkedin.com/jobs/view/abc-frontend',
        'https://www.linkedin.com/jobs/view/nova-react',
        'https://www.linkedin.com/jobs/view/delta-angular'
      )
      or (j.company, j.title) in (
        ('ABC Technology', 'Frontend Developer'),
        ('Nova Labs', 'React Developer'),
        ('Delta Soft', 'Angular Developer')
      )
    )
  )
  -- Kariyer.net fixture identities only (never numeric live listing ids)
  or (
    j.source = 'kariyer_net'
    and (
      j.source_job_id in (
        'kn-abc-frontend',
        'kn-pixel-react',
        'kn-orbit-angular'
      )
      or j.original_url in (
        'https://www.kariyer.net/is-ilani/abc-frontend',
        'https://www.kariyer.net/is-ilani/pixel-react',
        'https://www.kariyer.net/is-ilani/orbit-angular'
      )
      or (
        (j.company, j.title) in (
          ('ABC Technology', 'Frontend Developer'),
          ('Pixel Works', 'React Developer'),
          ('Orbit Digital', 'Angular Developer')
        )
        and j.original_url !~ '/[0-9]+/?$'
        and j.source_job_id !~ '^[0-9]+$'
      )
    )
  );

-- Preview: rows that will be deleted.
select
  j.id,
  j.source,
  j.source_job_id,
  j.company,
  j.title,
  j.original_url,
  j.duplicate_group_id
from public.jobs j
where j.id in (select id from mock_job_ids)
order by j.source, j.source_job_id;

delete from public.job_search_matches
where job_id in (select id from mock_job_ids);

do $$
begin
  if to_regclass('public.user_job_states') is not null then
    delete from public.user_job_states
    where job_id in (select id from mock_job_ids);
  end if;

  if to_regclass('public.favorites') is not null then
    delete from public.favorites
    where job_id in (select id from mock_job_ids);
  end if;

  if to_regclass('public.applications') is not null then
    delete from public.applications
    where job_id in (select id from mock_job_ids);
  end if;
end $$;

delete from public.jobs
where id in (select id from mock_job_ids);

-- Duplicate membership lives on jobs.duplicate_group_id.
-- Groups with fewer than 2 remaining jobs are no longer duplicates.
update public.jobs j
set duplicate_group_id = null
where j.duplicate_group_id is not null
  and (
    select count(*)
    from public.jobs remaining
    where remaining.duplicate_group_id = j.duplicate_group_id
  ) < 2;

delete from public.duplicate_groups g
where not exists (
  select 1
  from public.jobs j
  where j.duplicate_group_id = g.id
)
or (
  select count(*)
  from public.jobs j
  where j.duplicate_group_id = g.id
) < 2;

commit;
