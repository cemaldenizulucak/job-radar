# JobRadar — HTTP API

Public API served by `apps/api` (NestJS). Mobile is the only planned client for MVP.

Auth: `Authorization: Bearer <Supabase access token>` on protected routes. The liveness root and location catalog (`/v1/locations/countries`, `/v1/locations/subdivisions`) are public. Temporary development endpoints are separately marked `@Public()` and gated by `ENABLE_DEV_ENDPOINTS`.

```text
Mobile
  ↓ Bearer JWT
NestJS
  ↓ service role
Supabase Postgres
```

The API derives the user from the token. Query/body `userId` is not trusted on protected routes.

Content type: `application/json`.

Errors: NestJS-style body `{ "statusCode": number, "message": string | string[], "error": string }`.

### Implemented MVP routes

Liveness and public catalog (no JWT):

| Method | Path |
| --- | --- |
| GET | `/` |
| GET | `/v1/locations/countries` |
| GET | `/v1/locations/subdivisions?countryCode=` |

Protected (JWT required). The user is taken from the token; client `userId` is ignored.

| Method | Path |
| --- | --- |
| GET | `/v1/jobs` |
| GET | `/v1/jobs/tabs` |
| GET | `/v1/jobs/:id` |
| PATCH | `/v1/jobs/:id/seen` |
| GET/POST/DELETE | `/v1/favorites`, `/v1/favorites/:jobId` |
| GET/POST/PATCH/DELETE | `/v1/applications`, `/v1/applications/:id` |
| GET/PATCH | `/v1/notifications`, `/v1/notifications/:id/read` |
| GET/PATCH | `/v1/profiles` | `country` and `city` are nullable. PATCH accepts any of `notificationsEnabled`, `country`, `city`. Saved search responses include `effectiveLocation` and `locationSource` (`search` / `profile` / `none`) resolved from the stored search location plus the authenticated user's profile. |
| POST/DELETE | `/v1/push-tokens` |
| GET/POST/PATCH/DELETE | `/v1/searches`, `/v1/searches/:id`, `/v1/searches/:id/toggle` | Search writes accept optional `countryCode`, `countryName`, `subdivisionCode`, `subdivisionName`. `locations[]` stays for older rows. |

Temporary development helpers (not used by mobile). Disabled unless `ENABLE_DEV_ENDPOINTS=true`. When disabled they return **404** and must stay off in production.

- `POST /v1/discovery/run`
- `POST /v1/discovery/rematch-matches`
- `POST /v1/scheduler/run`
- `POST /v1/notifications/test`

Job feed fields:

- `isSeen` — true after `PATCH /v1/jobs/:id/seen` for this user (`user_job_states`).
- `isNew` — true when the user's first `job_search_matches.matched_at` (or `discovered_at` if there is no match row) falls within `JOB_NEW_WINDOW_HOURS` (default 24) **and** the job is not seen.

`GET /v1/jobs?matchedOnly=true` returns only listings that match at least one of the current user's saved searches. `matchedOnly=false` returns active jobs in the source max-age window (default 30 days) and includes `isMatched` so unmatched collected jobs stay visible. Mobile Jobs defaults to Matched (`matchedOnly=true`) and can switch to All Results.

Required SQL for mark-seen: [USER_JOB_STATES.sql](./USER_JOB_STATES.sql).

---

The remainder of this document is the original contract proposal. Live paths in the table above win when they differ.

---

## 1. Principles

- The API is the **only** application gateway. Mobile does not query job sources and does not use the service-role key.
- Listings are never deleted because they are duplicates. There is no `DELETE /jobs/:id` for deduping.
- Feed endpoints return **distinct listings** for the current user. Matching searches and duplicate siblings are included as fields, not by duplicating the listing row.
- Tab counts are computed on the server so “All” vs search tabs stay consistent with many-to-many matches.
- Pagination is **cursor-based** for jobs (infinite scroll). Page size default from `packages/config` (proposed: 20).
- Adapter / discovery internals are not public except an optional locked-down manual trigger.

---

## 2. Resource map

| Area | Prefix | Module |
| --- | --- | --- |
| Health | `/` | AppModule liveness |
| Saved searches | `/v1/searches` | SearchesModule |
| Location lookup | `/v1/locations` | LocationsModule |
| Jobs feed + detail | `/v1/jobs` | JobsModule |
| Favorites | `/v1/favorites` | FavoritesModule |
| Applications | `/v1/applications` | ApplicationsModule |
| Notifications | `/v1/notifications` | NotificationsModule |
| Push tokens | `/v1/push-tokens` | PushTokensModule |
| Profiles | `/v1/profiles` | ProfilesModule |
| Temporary discovery | `/v1/discovery` | DiscoveryModule (`ENABLE_DEV_ENDPOINTS`) |
| Temporary scheduler | `/v1/scheduler` | SchedulerModule (`ENABLE_DEV_ENDPOINTS`) |

---

## 3. Shared response shapes

Types will live in `packages/types`. Fields below are logical.

### `SourceId`

`"linkedin"` | `"kariyer_net"`

### `JobListItem`

| Field | Notes |
| --- | --- |
| `id` | Internal UUID |
| `sourceId` | |
| `title` | |
| `companyName` | |
| `location` | |
| `workModel` | |
| `publishedAt` | nullable |
| `firstDiscoveredAt` | |
| `canonicalUrl` | |
| `matchedSearchIds` | Saved search UUIDs for the current user; empty when unmatched |
| `isMatched` | `true` when `matchedSearchIds` is non-empty |
| `duplicateGroupSize` | `1` if ungrouped; `N` if related listings exist |
| `isFavorite` | Current user |
| `applicationStatus` | Current user, nullable if not tracking |
| `isNew` | Current user; false once seen |
| `isSeen` | Current user; persisted in `user_job_states` |
| `relevanceScore` | nullable; always null in MVP |

### `JobDetail` extends list item

| Field | Notes |
| --- | --- |
| `description` | |
| `experienceLevel` | nullable |
| `salary` | `{ min, max, currency, raw }` nullable parts |
| `technologies` | string[] |
| `matchedSearches` | `{ id, name, matchKind, terms, evidence[] }[]`. `matchKind` is `direct` or `skill`. Evidence is computed at read time from the listing text; it is not stored. Search `name` is display-only and is not a keyword. |
| `duplicateJobs` | `{ id, sourceId, title, companyName, canonicalUrl }[]` — siblings only, not self |
| `relevance` | null in MVP; later score, strengths, missing, explanation, recommendation |

`raw_payload` is omitted.

### `SavedSearch`

| Field | Notes |
| --- | --- |
| `id` | |
| `name` | |
| `keywords` | string[] |
| `technologies` | string[] |
| `locations` | string[] |
| `workModels` | string[] |
| `sourceIds` | `SourceId[]` |
| `isActive` | |
| `createdAt` | |
| `updatedAt` | |

### `JobTabs`

Used by the Jobs screen.

```text
{
  allCount: number,                    # distinct listings for this user
  sources: { id: SourceId | "all", label: string, count: number }[],
  savedSearches: { id: string, name: string, count: number }[]
}
```

`sources[0]` is `{ id: "all", count: allCount }`.

**Count rule:** `savedSearches[].count` may sum to more than `allCount`. Source counts except `"all"` should sum to `allCount`.

---

## 4. Endpoints

### 4.1 Health

#### `GET /health`

Unauthenticated. Process up.

#### `GET /health/ready`

Later: database reachable. Optional in MVP.

---

### 4.2 Current user

#### `GET /v1/me`

Returns `{ id, displayName, timezone, notificationsEnabled }`.

#### `PATCH /v1/me`

Body (all optional): `displayName`, `timezone`, `notificationsEnabled`.

---

### 4.3 Saved searches

#### `GET /v1/searches`

List current user’s searches, newest first.

#### `POST /v1/searches`

Body: `name`, `keywords`, `technologies`, `locations`, `workTypes`, `sources`, optional `isActive` (default true).

Validate with shared Zod. `sources` must be non-empty and members of the catalog. Unknown sources are rejected. Disabled-but-catalogued sources (LinkedIn, Kariyer.net) **are allowed on the search** so the user can express intent; discovery will skip them until adapters are enabled.

If `isActive` is true, the API enqueues discovery **for that saved search only** and returns `discovery.status: pending` without waiting for the crawl. Other users’ searches are not scanned. Source failures do not roll back the created search. Poll `GET /v1/searches/:id` for the latest `discovery` object (`pending`, `completed`, `partial`, `failed`, or omitted when idle).

Response:

```json
{
  "search": { "id": "...", "name": "angular", "isActive": true },
  "discovery": {
    "status": "pending",
    "jobsFetched": 0,
    "matchesCreated": 0
  }
}
```

`discovery.status` is `pending`, `completed`, `partial`, `failed`, or `skipped` (inactive search). Mobile does not wait for the crawl to finish before opening Jobs.

#### `GET /v1/searches/:id`

404 if not owned by the current user.

#### `PATCH /v1/searches/:id`

Full replacement of the same fields as create. Response shape matches create (`search` + `discovery`).

Immediate discovery runs when the search stays (or becomes) active and any of these change: `keywords`, `technologies`, `locations`, `workTypes`, `experienceLevels`, `sources`. Activating a paused search also runs discovery. Renaming only, or pausing a search, does not rescan.

#### `PATCH /v1/searches/:id/toggle`

Body: `{ "isActive": boolean }`. Same `{ search, discovery }` response. Activating triggers discovery; pausing does not.

#### `DELETE /v1/searches/:id`

Deletes the search and its `job_search_matches` / `saved_search_sources`. Does **not** delete `job_listings`.

---

### 4.4 Jobs

#### `GET /v1/jobs`

Feed of distinct listings for the current user.

Query:

| Param | Meaning |
| --- | --- |
| `sourceId` | Filter to one source; omit or `all` for every source |
| `savedSearchId` | Filter to one saved search tab |
| `matchedOnly` | `true` = only jobs matched to the current user's saved searches; `false` = all active jobs in the 30-day window |
| `q` | Optional text filter on title/company (later; not required for MVP) |
| `cursor` | Opaque pagination cursor |
| `limit` | Default 20, max 50 |

`sourceId` and `savedSearchId` compose. With `matchedOnly=true`, a listing must match the user, and both filters if present. With `matchedOnly=false`, unmatched collected jobs are included; a `savedSearchId` still scopes to that search's matches.

Sort: `published_at DESC` (unknown dates last), then `discovered_at DESC`.

Response:

```text
{
  items: JobListItem[],
  nextCursor: string | null
}
```

#### `GET /v1/jobs/tabs`

Returns `JobTabs` for the current user, using the same visibility rules as the feed (not the current text filter, unless we later pass the same `q`).

No pagination.

#### `GET /v1/jobs/:id`

Detail. Allowed if the listing is in the user’s matches **or** favorited **or** has an application row. Otherwise 404 (not 403) to avoid leaking global catalog ids.

Includes `matchedSearches` (this user only) and `duplicateJobs` (siblings; each sibling included even if it also appears in the feed).

There is **no** endpoint that removes a listing because a duplicate exists.

#### `PATCH /v1/jobs/:id/seen`

Persists `user_job_states.seen_at` for the current user. Returns the same `JobDetail` with `isSeen: true` and `isNew: false`. Unknown ids are 404.

Mobile calls this after Job Detail loads successfully. The NEW badge stays until this write succeeds.

---

### 4.5 Favorites

#### `GET /v1/favorites`

Cursor-paginated list of favorited `JobListItem`s, independent of active searches.

#### `PUT /v1/jobs/:id/favorite`

Idempotent favorite. 404 if the user cannot access the listing (same rule as detail).

#### `DELETE /v1/jobs/:id/favorite`

Idempotent unfavorite.

---

### 4.6 Applications

#### `GET /v1/applications`

Query: optional `status`. Returns listings plus `status` / `updatedAt`.

#### `PUT /v1/jobs/:id/application`

Body: `{ "status": ApplicationStatus }`.

Creates the row if missing. Status belongs to the current user only.

#### `DELETE /v1/jobs/:id/application`

Stops tracking. Does not delete the listing.

---

### 4.7 Notifications

#### `GET /v1/notifications`

Newest first, cursor optional. Includes `readAt`.

#### `POST /v1/notifications/:id/read`

Sets `read_at` if null.

#### `POST /v1/notifications/read-all`

Optional convenience.

#### `PUT /v1/devices`

Body: `{ token, platform }`. Upsert device token for push (implementation later).

#### `DELETE /v1/devices/:token`

Unregister.

---

### 4.8 Internal discovery

Not called by the mobile app.

#### `POST /v1/discovery/run`

Returns a `DiscoveryRunSummary`, including Kariyer.net rolling-collection fields:

- `kariyerNetPagesFetched`
- `kariyerNetJobsCollected`
- `stopReason` (`max_age` | `no_results` | `max_pages` | `blocked_after_success` | `null`)

`blocked_after_success` means a later page was blocked after at least one successful page; accumulated jobs were kept.

#### `POST /v1/discovery/rematch-matches`

Re-evaluates stored `job_search_matches` with the current matcher. Does **not** fetch LinkedIn or Kariyer.net. Does **not** delete job listings or application rows.

Body: `{ "dryRun": true }` (default) returns a preview report. `{ "dryRun": false }` applies inserts/deletes of match rows only.

Unavailable (404) unless `ENABLE_DEV_ENDPOINTS=true`.

#### `POST /v1/scheduler/run`

Unavailable (404) unless `ENABLE_DEV_ENDPOINTS=true`. Default is disabled. Do not enable in production.

Used for local testing and as a hook if an external cron pings the API. The production path is still the **in-process scheduler**.

There are **no** public endpoints to “search LinkedIn” or “search Kariyer.net”.

---

## 5. Auth endpoints

Supabase Auth HTTP APIs handle register, login, refresh, and password reset. NestJS does not duplicate password grants.

If the mobile SDK talks to Supabase Auth directly, NestJS only verifies JWTs.

If we later wrap auth:

| Method | Path | Notes |
| --- | --- | --- |
| `POST` | `/v1/auth/register` | Proxy to Supabase |
| `POST` | `/v1/auth/login` | Proxy to Supabase |
| `POST` | `/v1/auth/logout` | Invalidate / ignore client tokens |

Preferred: **direct Supabase Auth from mobile + NestJS guard**. Wrapper routes are optional.

---

## 6. Source catalog (read-only, optional)

#### `GET /v1/sources`

Returns catalog from `packages/config`:

```text
{ id: SourceId, label: string, implemented: boolean }[]
```

For MVP both `implemented` flags are `false`. The Create Search UI can still list them.

---

## 7. Validation

Request bodies and query enums are validated with **Zod schemas in `packages/validation`**, reused by React Hook Form on mobile.

Adapter output is validated with a **separate** Zod schema (`SourceJobRaw`) before insert. Invalid items are dropped and counted on `discovery_run_items.error` / a skipped counter — they are not persisted as half-rows.

---

## 8. Notifications to mobile behavior

Push payload is enough to open the Jobs tab:

```text
{ "type": "JOB_DISCOVERY", "route": "/jobs" }
```

The listing data is always loaded via `GET /v1/jobs`, not embedded in the push.

---

## 9. Rate limiting and versioning

- Public `/v1` is versioned so mobile and API can evolve.
- Rate limits (per user / per IP) are a later hardening step.
- Internal discovery trigger must be strictly rate-limited to avoid stampeding adapters.

---

## 10. Out of scope for this API

- Scraping or source-proxy endpoints
- Employer accounts
- Automatic apply / CV upload
- AI scoring routes until `AiModule` is enabled (`POST /v1/jobs/:id/relevance` would be the future shape)
- Admin UI
