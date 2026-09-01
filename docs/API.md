# JobRadar — HTTP API

Public API served by `apps/api` (NestJS). Mobile is the only planned client for MVP. This is a contract proposal; endpoints are not implemented in this phase.

Base path: `/v1`

Auth: `Authorization: Bearer <Supabase access token>` on all routes except health and auth bootstrap (if any).

Content type: `application/json`.

Errors: NestJS-style body `{ "statusCode": number, "message": string | string[], "error": string }` plus a stable `code` string when we implement (e.g. `SOURCE_DISABLED`).

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
| Health | `/health` | HealthModule |
| Current user | `/v1/me` | UsersModule |
| Saved searches | `/v1/searches` | SearchesModule |
| Jobs feed + detail | `/v1/jobs` | JobsModule |
| Favorites | `/v1/favorites` | FavoritesModule |
| Applications | `/v1/applications` | ApplicationsModule |
| Notifications | `/v1/notifications` | NotificationsModule |
| Devices | `/v1/devices` | NotificationsModule |
| Internal discovery | `/v1/internal/discovery` | DiscoveryModule |

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
| `matchedSearchIds` | One or more saved search UUIDs |
| `duplicateGroupSize` | `1` if ungrouped; `N` if related listings exist |
| `isFavorite` | Current user |
| `applicationStatus` | Current user, nullable if not tracking |
| `isNew` | Current user |
| `relevanceScore` | nullable; always null in MVP |

### `JobDetail` extends list item

| Field | Notes |
| --- | --- |
| `description` | |
| `experienceLevel` | nullable |
| `salary` | `{ min, max, currency, raw }` nullable parts |
| `technologies` | string[] |
| `matchedSearches` | `{ id, name }[]` |
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

Body: `name`, `keywords`, `technologies`, `locations`, `workModels`, `sourceIds`, optional `isActive` (default true).

Validate with shared Zod. `sourceIds` must be non-empty and members of the catalog. Unknown sources are rejected. Disabled-but-catalogued sources (LinkedIn, Kariyer.net) **are allowed on the search** so the user can express intent; discovery will skip them until adapters are enabled.

#### `GET /v1/searches/:id`

404 if not owned by the current user.

#### `PATCH /v1/searches/:id`

Partial update of the same fields as create.

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
| `q` | Optional text filter on title/company (later; not required for MVP) |
| `cursor` | Opaque pagination cursor |
| `limit` | Default 20, max 50 |

`sourceId` and `savedSearchId` compose: a listing must match the user, and both filters if present.

Sort: `first_discovered_at DESC` (newest discovered first). Alternative sorts (published date, relevance) are later.

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

#### `POST /v1/jobs/:id/view` (optional MVP)

Marks `is_new` false for this user. Can be folded into GET detail instead. Decision later.

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

#### `POST /v1/internal/discovery/run`

Protected by a server secret or admin-only auth (mechanism later). Starts one discovery run asynchronously or synchronously (decision later).

Response: `{ discoveryRunId, status }`.

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

Push payload (later) should be enough to open the Jobs tab:

```text
{ "type": "new_jobs_digest", "discoveryRunId": "...", "jobCount": 5 }
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
