# Source integrations

JobRadar talks to job boards only through `apps/api` source adapters. Mobile never calls LinkedIn or Kariyer.net. Discovery, matching, and persistence stay source-agnostic.

## How Discovery uses sources

```text
DiscoveryService
  → SourceRegistry.get(sourceId)
  → JobSourceAdapter.search(normalized query)
  → generic normalizeSourceJob / upsert by (source, external id)
```

`DiscoveryService` does not contain Kariyer.net or LinkedIn HTTP, HTML, or credential logic.

---

## Kariyer.net

**Public general job-search API:** not assumed.

**Provider interface:** `KariyerNetProvider` (`apps/api/src/sources/kariyer-net/`).

### Access methods

| Mode | Class | Network |
| --- | --- | --- |
| `mock` (default) | `KariyerNetMockProvider` | none — in-repo fixtures |
| `live` | `KariyerNetWebProvider` | sequential GETs of public `/is-ilanlari` HTML pages per saved search |

**Live provider** is a **personal, low-volume** reader of Kariyer.net’s normal public job-search pages. It is for a private two-user app.

It does **not**:

- bypass CAPTCHA or bot checks
- bypass login walls
- spoof a stealth browser to defeat anti-bot
- reverse-engineer private APIs
- crawl job-detail pages
- run parallel request floods

If Kariyer.net returns 401/403, a challenge page, or a login wall on **page 1**, the provider throws `SourceAuthenticationError` and **stops that source** for the run. LinkedIn and the scheduler continue.

If a **later page** is blocked or fails after at least one successful page, the provider **does not fail the source**. It keeps already-fetched jobs, stops pagination, and reports `stopReason = blocked_after_success`. JobRadar does not bypass CAPTCHA or challenge walls.

HTML parsing is **fragile**. Markup changes should fail with `SourceParseError`, not invent jobs.

**Credentials:** none are used. Do not add Kariyer.net cookies or tokens.

### Configuration

| Variable | Default |
| --- | --- |
| `KARIYER_NET_PROVIDER` | `mock` |
| `KARIYER_NET_BASE_URL` | `https://www.kariyer.net` |
| `KARIYER_NET_REQUEST_TIMEOUT_MS` | `10000` |
| `KARIYER_NET_REQUEST_DELAY_MS` | `750` |
| `KARIYER_NET_MAX_PAGES` | `10` |
| `JOB_SOURCE_MAX_AGE_DAYS` | `30` |
| `JOB_INACTIVE_AFTER_DAYS` | `7` |
| `DISCOVERY_INTERVAL_HOURS` | `1` |

Local live check (API already running, `ENABLE_DEV_ENDPOINTS=true`):

```text
LINKEDIN_PROVIDER=disabled
KARIYER_NET_PROVIDER=live
POST /v1/discovery/run
```

To go back to fixtures:

```text
KARIYER_NET_PROVIDER=mock
```

### Search URL

- Path: `/is-ilanlari` or `/is-ilanlari/{city-slug}` when a simple location is present
- Query: `kw` = joined keywords
- Pages: first page omits `cp`; later pages use `cp=2`, `cp=3`, …
- Sequential only, with `KARIYER_NET_REQUEST_DELAY_MS` between requests
- Stop when the oldest reliably parsed `publishedAt` on the page is older than `JOB_SOURCE_MAX_AGE_DAYS`, the page is empty, `KARIYER_NET_MAX_PAGES` is reached, or a later page is blocked after a successful page (`blocked_after_success`)
- **First-page rolling collection:** Kariyer.net often blocks pagination. Discovery runs every `DISCOVERY_INTERVAL_HOURS` (default 1). Each run observes current page 1; previously seen jobs stay in the database. Listings stay `is_active` until `JOB_INACTIVE_AFTER_DAYS` (default 7) without being seen. The feed shows active jobs published within `JOB_SOURCE_MAX_AGE_DAYS` (default 30), including rows with unknown `published_at`. A single run does not need to fetch the full 30-day catalog.
- Work type and experience are **not** encoded; JobRadar matching applies them after ingest

### Parser

1. Detect challenge / empty-result pages
2. Read public JSON-LD `JobPosting` if present
3. Read `/is-ilani/...` listing anchors and nearby card fields
4. Identity: numeric listing id from the URL, else a stable `kn-url-{sha256}` of the canonical URL
5. Missing card fields stay unset — never invented
6. No job-detail fetches unless we later decide a field is required and volume still stays tiny

### Plugging in a different live client

Implement `KariyerNetProvider` with `mode: 'live'` and pass it into `createKariyerNetProvider('live', provider)`, or change `createKariyerNetProviderFromConfig`. Do **not** change `DiscoveryService`.

---

## LinkedIn

**Official jobs API:** not assumed.

**Provider interface:** `LinkedInProvider` (`apps/api/src/sources/linkedin/`).

### Access methods

| `LINKEDIN_PROVIDER` | Class | Network |
| --- | --- | --- |
| `disabled` (default) | `LinkedInDisabledProvider` | none — zero jobs, discovery continues |
| `mock` | `LinkedInMockProvider` | none — in-repo fixtures (`ABC Technology`, `Nova Labs`, `Delta Soft`) |
| `live` | `LinkedInWebProvider` | sequential GETs of public `/jobs/search/` HTML pages per saved search |

**Live provider** is a **personal, low-volume** reader of LinkedIn’s normal public guest job-search pages. It is for a private two-user app.

It does **not**:

- bypass CAPTCHA or bot checks
- bypass login walls
- spoof a stealth browser to defeat anti-bot
- reverse-engineer private APIs
- crawl job-detail pages
- use cookies, sessions, or credentials
- run parallel request floods

If LinkedIn returns 401/403/999, a challenge page, or a login wall on **page 1**, the provider throws `SourceAuthenticationError` and **stops that source** for the run. Kariyer.net and the scheduler continue.

If a **later page** is blocked or fails after at least one successful page, the provider **does not fail the source**. It keeps already-fetched jobs, stops pagination, and reports `stopReason = blocked_after_success`.

HTML parsing is **fragile**. Markup changes should fail with `SourceParseError`, not invent jobs.

Fixture files stay in the repo for tests. They are **not** inserted into the live database unless `LINKEDIN_PROVIDER=mock`. Live mode drops known mock fixture identities.

### Configuration

| Variable | Default |
| --- | --- |
| `LINKEDIN_PROVIDER` | `disabled` |
| `LINKEDIN_BASE_URL` | `https://www.linkedin.com` |
| `LINKEDIN_REQUEST_TIMEOUT_MS` | `10000` |
| `LINKEDIN_REQUEST_DELAY_MS` | `1000` |
| `LINKEDIN_MAX_PAGES` | `3` |

Local live check (API already running, `ENABLE_DEV_ENDPOINTS=true`):

```text
LINKEDIN_PROVIDER=live
KARIYER_NET_PROVIDER=live
curl -X POST http://localhost:3000/v1/discovery/run
```

To go back to skip LinkedIn:

```text
LINKEDIN_PROVIDER=disabled
```

### Search URL

- Path: `/jobs/search/`
- Query: `keywords` = joined keywords and technologies
- `location` = first saved-search location only
- `sortBy=DD` (newest first)
- `f_TPR=r{maxAgeDays * 86400}` (30 days → `r2592000`) when a positive max-age is present
- `f_WT` only when a **single** workplace type is requested (`1` on-site, `2` remote, `3` hybrid). Mixed workplace filters are omitted; JobRadar matching applies them
- Experience is **not** encoded
- Pages: first page omits `start`; later pages use `start=25`, `start=50`, … (25 results per page)
- Sequential only, with `LINKEDIN_REQUEST_DELAY_MS` between requests
- Stop when the page is empty, `LINKEDIN_MAX_PAGES` is reached, the oldest reliably parsed `publishedAt` is older than `JOB_SOURCE_MAX_AGE_DAYS`, a later page is blocked after a successful page (`blocked_after_success`), the final URL loops back to `start=0` (`pagination_loop`), or a page adds no new LinkedIn job ids (`no_new_jobs`)

### Parser

1. Detect challenge / login-wall / empty-result pages
2. Read public JSON-LD `JobPosting` if present
3. Read guest listing cards (`job-search-card` / `data-entity-urn="urn:li:jobPosting:{id}"`) and `/jobs/view/{id}` anchors
4. Identity: numeric LinkedIn job id. Listings without an id are dropped
5. Canonical URL: `https://www.linkedin.com/jobs/view/{id}` (relative and localized hosts are resolved)
6. Missing card fields stay unset — never invented
7. No job-detail fetches

Old mock rows already stored in `public.jobs` are not removed by disabling the adapter. Use [CLEAN_MOCK_DATA.sql](./CLEAN_MOCK_DATA.sql).

---

## Typed source errors

Discovery catches per-source failures and continues other sources:

| Error | Category |
| --- | --- |
| `SourceAuthenticationError` | `authentication` |
| `SourceRateLimitError` | `rate_limit` |
| `SourceUnavailableError` | `unavailable` |
| `SourceConfigurationError` | `configuration` |
| `SourceParseError` | `parse` |

Structured logs include `source`, `savedSearchId`, `durationMs`, `fetched`, `normalized`, and `errorCategory`. They must not include credentials, tokens, cookies, or search keyword payloads.
