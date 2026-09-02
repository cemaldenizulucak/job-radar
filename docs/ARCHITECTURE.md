# JobRadar — Technical Architecture

This document proposes the technical architecture for JobRadar. It is a design document only. No application features, source adapters, or new dependencies are introduced by this document.

Related documents:

- [PRD.md](./PRD.md) — product requirements
- [DATABASE.md](./DATABASE.md) — entities and relationships
- [API.md](./API.md) — HTTP API surface
- [ROADMAP.md](./ROADMAP.md) — implementation phases
- [SOURCE_INTEGRATIONS.md](./SOURCE_INTEGRATIONS.md) — job-source providers

---

## 1. Current repository state

The repo is a **pnpm + Turborepo** monorepo. The existing layout must be preserved.

```text
job-radar/
  apps/mobile     Expo SDK 57 starter (React Native, Expo Router)
  apps/api        NestJS 12 ESM starter (Hello World)
  packages/       workspace glob exists; no packages yet
  docs/
```

Observed facts:

| Area | Today | Target (this proposal) |
| --- | --- | --- |
| `apps/mobile` | Expo template: Home / Explore tabs | JobRadar screens and feature modules |
| `apps/api` | Single `AppController` returning `"Hello World!"` | Feature modules, discovery pipeline, adapter registry |
| `packages/*` | Empty | `types`, `validation`, `config` |
| Database | None wired | PostgreSQL via Supabase |
| Auth | None | Supabase Auth tokens validated by NestJS |
| Job sources | None | Adapter interface only; LinkedIn and Kariyer.net **not implemented** |
| Scheduling | None | Backend scheduler (not on-device) |

Existing stack that must be kept:

- pnpm workspaces (`apps/*`, `packages/*`)
- Turborepo
- NestJS 12, TypeScript, ESM (`"type": "module"`, NodeNext resolution, `.js` import specifiers)
- Expo SDK 57, Expo Router, TypeScript `strict`
- Vitest on the API

Planned libraries from the PRD that are **not installed yet** and must not be added in this phase:

- Mobile: Zustand, TanStack Query, React Hook Form, Zod
- API: database client/ORM, scheduler, auth guard, queue
- Shared: Zod in `packages/validation`

---

## 2. Goals and constraints

Non-negotiable product rules:

1. Preserve the current monorepo shape.
2. Mobile app lives in `apps/mobile`.
3. NestJS API lives in `apps/api`.
4. Shared code lives in `packages/`.
5. Job sources are **adapters**, never inlined into core job logic.
6. Duplicate listings are **never deleted**.
7. Duplicate relationships are stored in **separate tables**.
8. One job listing may match **many saved searches**.
9. Scheduled discovery runs on the **backend**, even if the phone is offline.
10. LinkedIn and Kariyer.net access methods are **not implemented** until a later decision.
11. Backend secrets never ship in the mobile app.
12. Environment files are not committed (`.env` is already gitignored).

Architectural style:

- Feature-based modules on both API and mobile
- Strong TypeScript; no `any`
- UI separated from business logic
- External (source) payloads validated before persistence
- Shared types and Zod schemas where mobile and API share contracts

---

## 3. High-level system

```text
┌──────────────────────────┐
│  apps/mobile (Expo)      │
│  UI, local state,        │
│  TanStack Query client   │
└────────────┬─────────────┘
             │ HTTPS + Bearer JWT
             ▼
┌──────────────────────────┐         ┌─────────────────────────┐
│  apps/api (NestJS)       │         │  Supabase               │
│  Auth, CRUD, tabs,       │────────▶│  Auth + PostgreSQL      │
│  notifications API       │         │  (data store only)      │
│                          │         └─────────────────────────┘
│  Scheduler               │
│       │                  │
│       ▼                  │
│  Discovery orchestrator  │
│       │                  │
│       ├─ Source registry │
│       │    ├─ LinkedIn   │  ← interface reserved, not implemented
│       │    └─ Kariyer.net│  ← interface reserved, not implemented
│       ├─ Normalizer      │
│       ├─ Job store       │
│       ├─ Search matcher  │
│       ├─ Duplicate detector
│       └─ Notifier        │
└──────────────────────────┘
```

**Mobile never talks to job sources.** It only talks to the NestJS API (plus Supabase Auth for login/session). Saved searches, jobs, favorites, applications, notifications, and profiles go through Nest.

**Supabase is infrastructure**, not the application layer: PostgreSQL, Auth, and later optional Realtime. All job-discovery business rules run inside NestJS.

**AI is post-discovery.** It must not fetch jobs. It scores listings that already exist. It is out of MVP except as a reserved module.

---

## 4. Monorepo layout (target)

Do not create these folders in this documentation phase. This is the intended shape.

```text
job-radar/
  apps/
    mobile/                 # Expo Router app
      src/
        app/                # routes / screens
        features/           # feature modules (logic, hooks, UI pieces)
        lib/                # API client, query client
        store/              # Zustand (UI state only)
        components/         # cross-feature UI
        constants/
        hooks/
    api/                    # NestJS
      src/
        auth/
        users/
        searches/
        jobs/
        favorites/
        applications/
        notifications/
        discovery/
        sources/
        matching/
        duplicates/
        health/
        ai/                 # reserved, empty until post-MVP
  packages/
    types/                  # shared DTOs, enums, domain types
    validation/             # shared Zod schemas
    config/                 # source catalog, default schedule, enums
  docs/
```

Workspace wiring (when packages are created later):

- `apps/api` and `apps/mobile` depend on `packages/types` and `packages/validation`
- `apps/api` may also depend on `packages/config`
- `packages/validation` depends on `packages/types` and Zod
- Mobile must not import API-internal modules
- API must not import React Native / Expo code

---

## 5. Backend modules

NestJS modules are feature-based. Each module owns its HTTP controllers (if public), services, and persistence access. Cross-module use goes through exported services, not by reaching into another module’s tables ad hoc.

### 5.1 Public / HTTP modules

| Module | Responsibility |
| --- | --- |
| `AuthModule` | Validate Supabase JWTs, expose current user to request context. No password storage in NestJS. |
| `UsersModule` | Application profile (`profiles`): display name, timezone, notification preferences. |
| `SearchesModule` | CRUD for saved searches, including keywords, technologies, locations, work models, selected sources, active flag. |
| `JobsModule` | User-visible job feed, source/search tab counts, job detail (including matching searches and related duplicates). Does **not** delete listings because they are duplicates. |
| `FavoritesModule` | Per-user favorites, independent of the feed. |
| `ApplicationsModule` | Per-user application status. Status is never stored on `job_listings`. |
| `NotificationsModule` | In-app notification list, read state, device token registration for push. |
| `HealthModule` | Liveness/readiness for hosting. |

### 5.2 Internal / pipeline modules (no public source-scraping endpoints)

| Module | Responsibility |
| --- | --- |
| `SourcesModule` | `JobSourceAdapter` interface, `SourceRegistry`, source catalog ids. Adapters are the **only** place a platform’s access method may live. |
| `DiscoveryModule` | Scheduler + orchestrator. Loads active searches, calls adapters, drives the pipeline. Runs on the server process, not on the device. |
| `MatchingModule` | After a listing is stored, evaluate it against **all** of that user’s active saved searches. Writes `job_search_matches` only. |
| `DuplicatesModule` | Detect related listings and write `duplicate_groups` / `duplicate_group_members`. Never deletes `job_listings` rows. |
| `AiModule` | Reserved. Relevance scoring after discovery. Disabled for MVP. |

`AppModule` composes the modules above. The current Hello World controller is replaced later; it is not part of the product API.

### 5.3 Proposed API source tree

```text
apps/api/src/
  main.ts
  app.module.ts
  auth/
    auth.module.ts
    auth.guard.ts
  users/
  searches/
  jobs/
  favorites/
  applications/
  notifications/
  discovery/
    discovery.module.ts
    discovery.scheduler.ts
    discovery.orchestrator.ts
  sources/
    sources.module.ts
    job-source.adapter.ts          # interface only
    source-registry.ts
    adapters/                      # one file per source, unimplemented
  matching/
  duplicates/
  health/
  ai/                              # reserved
```

---

## 6. Source adapter pattern

Core job logic must not contain LinkedIn- or Kariyer.net-specific HTTP, HTML, or SDK calls.

### 6.1 Contract (conceptual)

```text
JobSourceAdapter
  sourceId: SourceId
  displayName: string
  capabilities:
    supportsKeywordSearch
    supportsLocation
    supportsRemoteFilter
    supportsExperienceLevel
  isEnabled(): boolean
  search(query: SourceSearchQuery): Promise<SourceSearchResult>
```

`SourceSearchQuery` is already normalized (keywords, technologies, locations, work models, experience levels). Adapters translate that into whatever the source needs.

`SourceSearchResult` is `{ sourceId, jobs }` where each `SourceJobRaw` includes:

- source-specific `sourceJobId`
- `canonicalUrl`
- `title`, `companyName`
- optional `location`, `workModel`, `description`, `publishedAt`
- optional `rawMetadata` for adapter-only debug (not returned on public GETs; the normalizer does not persist it on job rows)

A **normalizer** (owned by `DiscoveryModule` / `SourcesModule`, not by individual adapters) maps raw items into a `JobListingDraft` / `NormalizedJob` and validates before persistence.

### 6.2 Registry

`SourceRegistry` maps `SourceId` → adapter instance. Saved searches store source ids, not class names.

Adding a source later means:

1. New `SourceId` in `packages/types` and `packages/config`
2. New adapter class registered in `SourceRegistry`
3. No change to matching, favorites, applications, or mobile feed logic

### 6.3 LinkedIn and Kariyer.net

Both ids belong in the source catalog so the product model is complete.

**LinkedIn** uses a provider behind `JobSourceAdapter`. Default `LINKEDIN_PROVIDER=disabled` contributes zero jobs and does not abort discovery. `mock` serves development fixtures. `live` uses `LinkedInWebProvider` (low-volume public `/jobs/search/` HTML) and never falls back to mock fixtures. See [SOURCE_INTEGRATIONS.md](./SOURCE_INTEGRATIONS.md).

**Kariyer.net** uses a provider behind `JobSourceAdapter`. Default `KARIYER_NET_PROVIDER=mock` serves development fixtures. `live` uses `KariyerNetWebProvider` (low-volume public listing HTML) and never falls back to mock fixtures. See [SOURCE_INTEGRATIONS.md](./SOURCE_INTEGRATIONS.md).

When a real access method is added, keep the same `JobSourceAdapter` surface. Source-specific HTTP, cookies, and credentials stay inside `sources/kariyer-net/*` (or `sources/adapters/*`) and environment variables — never in mobile or public GET responses.

---

## 7. Discovery pipeline

Scheduled processing happens only on the backend.

Default cadence: **every 2 hours** (`0 */2 * * *`) in **Europe/Istanbul**. Configurable via `DISCOVERY_INTERVAL_HOURS`. The phone being closed or offline must not stop discovery.

Pipeline, aligned with the PRD:

```text
1. Scheduler starts a discovery run every 2 hours, or a saved-search create/update triggers an immediate run for that search
2. Load the target saved searches (all active searches for scheduled runs; one search for immediate runs)
3. For each search, load selected sources
4. For each enabled adapter, query with the search criteria
5. Validate and normalize source payloads
6. Upsert job_listings (same source + same identity → update last_seen_at; never delete)
7. Match each upserted listing against all of that user's active searches
8. Detect duplicate relationships (write relationship rows only)
9. AI relevance (skipped until enabled)
10. Create per-user notifications for newly matched jobs
11. Mobile reads results through the API
```

### 7.1 Fetch vs match

These are different steps:

- **Fetch** uses a saved search’s filters to query a source (reduce noise and respect source query models).
- **Match** records every saved search the stored listing satisfies for that user.

A listing fetched because of “Frontend Developer” can also match “Angular” if it satisfies that search. That produces two `job_search_matches` rows and one `job_listings` row.

If two users would see the same source listing, there is still **one** `job_listings` row and separate match / favorite / application rows per user.

### 7.2 Identity and updates

A listing is identified by `(source, external_id)` when the source provides an id, otherwise `(source, canonical_url)`.

Re-discovery of the same listing updates `last_seen_at` and mutable fields (title, description, salary). `first_discovered_at` does not change.

Duplicate detection does **not** merge or delete these rows.

### 7.3 Failure isolation

One adapter or one search failing must not abort the whole run. `discovery_runs` / `discovery_run_items` record per-search-per-source outcomes (`succeeded` | `failed` | `skipped_disabled_source`).

---

## 8. Duplicate handling

Duplicates are a **relationship**, not a storage mode.

Rules:

- Both (or all) listings remain in `job_listings` and remain visible.
- The UI may show “Same job detected on N sources”.
- Relationships live in `duplicate_groups` + `duplicate_group_members` (see [DATABASE.md](./DATABASE.md)).
- No unique constraint may exist whose purpose is “only one row per real-world job across sources”.

MVP detection should be conservative (normalized company + title, same-ish location). Fuzzy / embedding-based grouping is a later decision.

---

## 9. Mobile feature modules

Expo Router owns **routes**. Feature folders own **behavior** (API hooks, form schemas, list components). Screens stay thin.

### 9.1 Bottom navigation (product)

Replace the starter Home / Explore tabs with:

1. Jobs
2. Searches
3. Applications
4. Profile

Auth screens sit outside the tab layout.

### 9.2 Feature modules

| Feature | Owns | Screens |
| --- | --- | --- |
| `features/auth` | Session, login/register forms, token storage | Login, Register |
| `features/jobs` | Feed, source/search tabs, detail, favorite toggle, duplicate indicator | Jobs, Job Detail |
| `features/searches` | Saved search CRUD, source checkboxes, schedule display | Searches, Create Search, Edit Search, Search Detail |
| `features/applications` | Status board / list, status updates | Applications |
| `features/profile` | Profile, notification prefs, sign out | Profile |
| `features/notifications` | Permission, deep-link handling, in-app list if shown | Opened from OS notification → Jobs (filtered) |

Shared UI (tabs, job cards, empty states) may live in `src/components` only if used by more than one feature.

### 9.3 Proposed route tree

```text
apps/mobile/src/app/
  _layout.tsx
  (auth)/
    login.tsx
    register.tsx
  (app)/
    _layout.tsx                 # four tabs
    jobs/index.tsx
    jobs/[id].tsx
    searches/index.tsx
    searches/create.tsx
    searches/[id]/index.tsx
    searches/[id]/edit.tsx
    applications/index.tsx
    profile/index.tsx
```

Deep links (later): notification tap opens Jobs with optional `savedSearchId` / highlight of new items. Scheme is currently `mobile` in `app.json`; product name/scheme can change later.

### 9.4 Client state split

| Tool | Use |
| --- | --- |
| TanStack Query | Server state: jobs, searches, applications, notifications |
| Zustand | UI-only: selected source tab, selected search tab, draft filters not yet submitted |
| React Hook Form + Zod | Create/edit search, auth forms; schemas from `packages/validation` |
| Expo SecureStore (later) | Refresh/session material if not fully handled by the auth SDK |

Business rules (matching, duplicates, scheduling) stay on the server. The app does not run discovery.

---

## 10. Shared packages

| Package | Contents | Consumers |
| --- | --- | --- |
| `packages/types` | `SourceId`, `WorkModel`, `ApplicationStatus`, API DTO types, tab facet types | api, mobile, validation |
| `packages/validation` | Zod schemas for search payloads, job filters, application status transitions | api, mobile |
| `packages/config` | Source catalog metadata (id, label, `implemented: false`), default schedule slots, pagination defaults | api, optionally mobile for labels |

`packages/config` must not contain secrets or access tokens.

---

## 11. Auth, secrets, configuration

Recommended implemented pattern:

```text
Mobile (Supabase Auth)
  ↓ Authorization: Bearer <access_token>
NestJS AuthGuard
  ↓ verified user id on request
Feature services
  ↓ service-role Supabase client
PostgreSQL
```

1. User signs up / logs in via **Supabase Auth** in the mobile app.
2. The shared mobile API client attaches `Authorization: Bearer <access_token>`.
3. `AuthGuard` verifies the JWT (`SUPABASE_JWT_SECRET` HS256 when configured, otherwise `supabase.auth.getUser`).
4. Controllers read the authenticated user from request context. Client-sent `userId` is ignored.
5. NestJS uses the **server-only** service-role key. Mobile never receives it.

The mobile app must never receive:

- Source credentials
- Service-role keys
- OpenAI keys
- Adapter implementation details

Required env groups:

- API: `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, optional `SUPABASE_JWT_SECRET`, `JOB_NEW_WINDOW_HOURS` (default 24), `ENABLE_DEV_ENDPOINTS` (default `false`), `PORT`
- Mobile: public `EXPO_PUBLIC_API_BASE_URL`, public Supabase URL + publishable/anon key
- Later: source credentials, `OPENAI_API_KEY`

`.env` remains gitignored. `.env.example` may be added in the foundation phase with empty placeholders.

---

## 12. Scheduling and hosting

Discovery **must** be a backend concern.

Recommended MVP approach: NestJS in-process scheduler (`DiscoveryScheduler`) invoking `DiscoveryOrchestrator`.

Production cron (Europe/Istanbul): `0 */2 * * *` (`DISCOVERY_INTERVAL_HOURS=2`). Enable with `DISCOVERY_SCHEDULER_ENABLED=true`. Local default is `false`. See [SCHEDULER.md](./SCHEDULER.md).

Implications:

- The API process must be **always on**. Serverless sleep would skip the interval.
- Hosting choice (Fly, Railway, Render, VPS, NestJS Mau, etc.) is deferred.
- Alternatives if the API cannot stay warm: Postgres `pg_cron`, Supabase scheduled functions, or a queue worker. Those are later decisions; they must still call into the same orchestrator, not into mobile.

Do not use Expo background fetch as the source of truth for discovery.

---

## 13. Testing and quality (later implementation)

Not implemented now. Intended split:

- API unit tests: matcher, duplicate grouping, normalizer, orchestrator with a fake adapter
- API e2e: already Vitest + supertest; extend to authenticated resource tests
- Mobile: keep screens thin so hooks can be tested later
- Contract: Zod schemas in `packages/validation` are the shared gate for adapter output and HTTP bodies

CI (`.github/workflows`) is listed in the PRD but is not present yet. Add in a later phase.

---

## 14. Technical risks

| Risk | Why it matters | Mitigation direction |
| --- | --- | --- |
| Source access / ToS | LinkedIn and Kariyer.net may forbid scraping; APIs may be unavailable or partner-only | Adapter pattern + explicit “not implemented”; decide access method per source before any network code |
| Always-on scheduler | Free/serverless hosts sleep; missed runs break the product promise | Choose hosting that allows cron or a separate worker |
| Duplicate false positives | Unrelated jobs grouped → bad UX | Conservative MVP matcher; store confidence; allow later ungroup |
| Duplicate false negatives | User still sees near-copies without a link | Acceptable for MVP; improve algorithm later without schema rewrite |
| Source rate limits / blocking | Pipeline fails or IP banned | Per-source pacing, run isolation, backoff recorded on `discovery_run_items` |
| Unstable external ids | URL-only identity can duplicate the same source post | Prefer `external_id`; treat URL changes as an open identity problem |
| Over-fetch / overlapping searches | Two searches query the same source with similar keywords | Later: query coalescing; not required for two users |
| Timezones | 08:00 for whom? | Store IANA timezone on profile; until then document a single default TZ |
| JWT + ESM NestJS | Auth library choice vs current NodeNext ESM | Spike in foundation phase |
| Shared package consumption | NestJS ESM vs Expo Metro resolving `packages/*` | Workspace packages with explicit `exports`; spike early |
| HTML job descriptions | XSS in WebViews / Web | Store text/HTML separately; sanitize on render |
| Push reliability | Notifications are in MVP | Expo Push later; in-app inbox still works via API |
| Global catalog leakage | User A must not see User B’s matches | Feed always filtered through the current user’s `job_search_matches` |
| Stale listings | Jobs expire on the source | Policy deferred (keep forever vs mark inactive) |

---

## 15. Decisions to make later

These are intentionally **not** decided in this document.

1. **LinkedIn access method** — official API, partner feed, manual export, or none.
2. **Kariyer.net access method** — same.
3. **ORM / DB client** — Prisma, Drizzle, TypeORM, or `pg` + hand-written SQL.
4. **Auth verification library** — passport, `jose`, Supabase SSR helpers, etc.
5. **Where NestJS is hosted** and how cron is kept alive.
6. **Queue vs in-process** — BullMQ/Redis vs sequential orchestrator (needed if adapters become slow).
7. **Duplicate algorithm** — exact normalized keys vs fuzzy vs embeddings.
8. **Stale job policy** — keep visible, hide after unseen N days, or user-dismiss.
9. **“New” badge** — `job_search_matches.is_new` vs `job_views` table.
10. **User timezone vs single family timezone.**
11. **Push provider** — Expo Notifications vs FCM/APNs directly.
12. **Realtime** — poll vs Supabase Realtime vs websocket for new-job badges.
13. **Mock adapter** for local demos before real sources exist.
14. **Row Level Security** — extra defense in Postgres vs NestJS as sole data access path.
15. **Mobile scheme / app name** — currently Expo defaults (`mobile`).
16. **AI model, prompt, and scoring trigger** — after the pipeline is stable.

---

## 16. Explicitly out of this phase

- Production application code
- New npm/pnpm dependencies
- LinkedIn or Kariyer.net clients
- Database migrations
- Package scaffolding in `packages/`
- Replacing the Expo starter screens
- GitHub Actions

Implementation should wait for review of this architecture, then follow [ROADMAP.md](./ROADMAP.md).
