# JobRadar — Database

PostgreSQL (hosted on Supabase) is the system of record. This document describes the **logical schema**, invariants, and indexes. No migrations or ORM code are created in this phase.

ORM choice (Prisma, Drizzle, TypeORM, or SQL) is deferred. Names below are logical; snake_case is the intended SQL naming.

Auth users live in **Supabase Auth** (`auth.users`). Application tables live in `public`.

---

## 1. Design invariants

1. **Job listings are a shared catalog.** One row per source-specific posting, not per user.
2. **Duplicates are never deleted.** Cross-source “same job” is a relationship, not a merge.
3. **A listing may match many saved searches** (including several searches owned by the same user).
4. **Favorites and application status are per user**, never columns on `job_listings`.
5. **Users only see listings that match at least one of their saved searches**, unless they open a favorite or an application that they created.
6. Source-specific payloads may be stored for debugging; they are not the API contract.

---

## 2. Entity relationship overview

```text
auth.users
    │ 1
    │
    ▼ *
profiles ──────────── device_tokens
    │                 notifications
    │
    ├──────────── * saved_searches
    │                    │
    │                    ├──── * saved_search_sources
    │                    │
    │                    └──── * job_search_matches * ──── job_listings
    │                                                      │
    ├──────────── * job_favorites * ───────────────────────┤
    │                                                      │
    └──────────── * job_applications * ────────────────────┘
                                                               │
                                                               * duplicate_group_members
                                                                      │
                                                                      ▼
                                                             duplicate_groups

discovery_runs ──── * discovery_run_items
                         (saved_search_id, source)

job_relevance_scores (future, per user + listing)
```

Cardinality that the product depends on:

| Relationship | Type | Notes |
| --- | --- | --- |
| User → saved searches | 1:N | Multiple search profiles per user |
| Saved search → sources | N:M via `saved_search_sources` | LinkedIn and/or Kariyer.net (ids reserved) |
| Job listing → saved searches | N:M via `job_search_matches` | One job, many searches |
| User → favorites | N:M via `job_favorites` | Independent of the feed |
| User → applications | 1:N (`job_applications`) | At most one application row per user+listing |
| Job listing → duplicate group | N:1 optional | Listing stays in `job_listings` |

---

## 3. Enumerations

Store as Postgres enums or check constraints. TypeScript mirrors belong in `packages/types` later.

### `source_id`

| Value | Label | Implemented now |
| --- | --- | --- |
| `linkedin` | LinkedIn | No |
| `kariyer_net` | Kariyer.net | No |

New sources add a value + adapter. Do not encode source-specific columns on `job_listings`.

### `work_model`

`remote` | `hybrid` | `onsite` | `unknown`

### `application_status`

`NEW` | `REVIEWING` | `APPLIED` | `INTERVIEW` | `OFFER` | `REJECTED`

Owned by the user application row, not the listing.

### `discovery_run_status`

`running` | `succeeded` | `partial` | `failed`

### `discovery_item_status`

`succeeded` | `failed` | `skipped_disabled_source`

### `notification_type`

MVP: `JOB_DISCOVERY` (digest of new matches from a discovery run)

Future: `high_relevance_digest` (AI)

### `duplicate_detection_method`

`normalized_exact` | `fuzzy` | `manual` | `embedding` (last two unused in MVP)

---

## 4. Tables

UUIDs as primary keys unless noted. `created_at` / `updated_at` are `timestamptz`.

### 4.1 `profiles`

Application user, 1:1 with `auth.users`.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid PK | Equals `auth.users.id` |
| `display_name` | text | |
| `timezone` | text | IANA name, e.g. `Europe/Istanbul`. Scheduling decision still open. |
| `notifications_enabled` | boolean | Default true |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | |

### 4.2 `saved_searches`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid PK | |
| `user_id` | uuid FK → profiles | |
| `name` | text | e.g. “Frontend Developer” |
| `keywords` | text[] | e.g. Frontend Developer, React Developer |
| `technologies` | text[] | e.g. React, Next.js |
| `locations` | text[] | e.g. Istanbul, Remote |
| `work_models` | `work_model`[] | Empty means any |
| `is_active` | boolean | Inactive searches are not fetched; existing matches remain |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | |

Filter lists stay on the search row (arrays). They are not first-class entities.

Schedule times are **global defaults** for MVP (08:00 / 13:00 / 19:00). Per-search cron is a later column if needed (`cron_expression` or `schedule_slot_ids`).

### 4.3 `saved_search_sources`

Which adapters a search is allowed to query.

| Column | Type | Notes |
| --- | --- | --- |
| `saved_search_id` | uuid FK → saved_searches ON DELETE CASCADE | |
| `source_id` | `source_id` | |
| PK | `(saved_search_id, source_id)` | |

### 4.4 `job_listings`

One row per posting **on a given source**. This table is never used as a duplicate-collapse target.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid PK | |
| `source_id` | `source_id` | Origin platform |
| `external_id` | text null | Source-native id when the adapter can supply one |
| `canonical_url` | text | Original listing URL |
| `title` | text | |
| `company_name` | text | |
| `title_normalized` | text | Lowercased / punctuation-stripped; matching aid |
| `company_normalized` | text | Matching aid |
| `description` | text null | |
| `location` | text null | |
| `work_model` | `work_model` null | |
| `experience_level` | text null | Keep free text until a taxonomy is agreed |
| `salary_min` | numeric null | |
| `salary_max` | numeric null | |
| `salary_currency` | text null | |
| `salary_raw` | text null | Unparsed source string |
| `technologies` | text[] | Detected or provided; may be empty |
| `published_at` | timestamptz null | Source publication date if known |
| `first_discovered_at` | timestamptz | Set once |
| `last_seen_at` | timestamptz | Updated on every successful re-fetch |
| `content_hash` | text null | Detect description/title changes |
| `raw_payload` | jsonb null | Adapter output for debug; not sent to mobile by default |
| `is_active` | boolean | Default true. Stale-listing policy deferred; column reserved. |

**Identity (do not treat as cross-source uniqueness):**

- Unique `(source_id, external_id)` where `external_id IS NOT NULL`
- Unique `(source_id, canonical_url)`

Upsert on those keys. Do **not** unique on `(company_normalized, title_normalized)`.

### 4.5 `job_search_matches`

Many-to-many: a listing can appear under multiple search tabs.

| Column | Type | Notes |
| --- | --- | --- |
| `job_listing_id` | uuid FK → job_listings ON DELETE CASCADE | |
| `saved_search_id` | uuid FK → saved_searches ON DELETE CASCADE | |
| `matched_at` | timestamptz | First time this pair was recorded |
| `last_matched_at` | timestamptz | Updated when the pipeline confirms the match again |
| `is_new` | boolean | True until the user has seen the listing in this search (or globally — decision later) |
| PK | `(job_listing_id, saved_search_id)` | |

Deleting a saved search removes its match rows, not the listing.

The Jobs feed for a user is:

```text
job_listings
  JOIN job_search_matches
  JOIN saved_searches ON saved_searches.user_id = :current_user
```

Tab counts:

- **Source tabs:** `COUNT(DISTINCT job_listing_id)` grouped by `job_listings.source_id` for that user.
- **Search tabs:** `COUNT(*)` (or distinct listings) grouped by `saved_search_id`.
- **All:** `COUNT(DISTINCT job_listing_id)` for that user.

Search tab counts may **sum to more than All**, because one listing can match several searches. Source tab counts should **sum to All**, because a listing has exactly one `source_id`.

### 4.6 `duplicate_groups`

Cluster of listings believed to be the same real-world job.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid PK | |
| `detection_method` | `duplicate_detection_method` | |
| `confidence` | numeric null | 0–1; optional for MVP exact matching |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | |

### 4.7 `duplicate_group_members`

| Column | Type | Notes |
| --- | --- | --- |
| `group_id` | uuid FK → duplicate_groups ON DELETE CASCADE | |
| `job_listing_id` | uuid FK → job_listings ON DELETE CASCADE | Unique: a listing is in at most one group |
| `added_at` | timestamptz | |
| PK | `(group_id, job_listing_id)` | |

A listing with no row here is simply not grouped. Grouping never deletes `job_listings`.

UI copy “Same job detected on 2 sources” = `COUNT(*)` members in the group (typically distinct `source_id`s).

**Why groups instead of only pairs:** three sources posting the same role become one group, not three pair rows the UI has to collapse. Pairwise edges can be added later if a graph algorithm needs them; they are not required for MVP.

### 4.8 `job_favorites`

| Column | Type | Notes |
| --- | --- | --- |
| `user_id` | uuid FK → profiles ON DELETE CASCADE | |
| `job_listing_id` | uuid FK → job_listings ON DELETE CASCADE | |
| `created_at` | timestamptz | |
| PK | `(user_id, job_listing_id)` | |

Favorites remain queryable even if the user deactivates every search (product: “accessible independently of search result lists”). If the listing is later marked inactive, the favorite row still exists.

### 4.9 `job_applications`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid PK | |
| `user_id` | uuid FK → profiles ON DELETE CASCADE | |
| `job_listing_id` | uuid FK → job_listings | |
| `status` | `application_status` | Default `NEW` when the user starts tracking |
| `notes` | text null | Optional; not in MVP UI unless added |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | |
| Unique | `(user_id, job_listing_id)` | |

Favoriting does **not** automatically insert an application row. The two features are independent.

### 4.10 `notifications`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid PK | |
| `user_id` | uuid FK → profiles ON DELETE CASCADE | |
| `type` | `notification_type` | |
| `title` | text | e.g. “5 new jobs found” |
| `body` | text null | |
| `data` | jsonb | `{ "jobCount": 5, "discoveryRunId": "...", "savedSearchIds": [] }` |
| `read_at` | timestamptz null | |
| `created_at` | timestamptz | |

Digest-per-run (one notification summarizing new matches) is the MVP shape, not one notification per listing.

### 4.11 `device_tokens`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid PK | |
| `user_id` | uuid FK → profiles ON DELETE CASCADE | |
| `token` | text unique | Expo/FCM token |
| `platform` | text | `ios` \| `android` \| `web` |
| `updated_at` | timestamptz | |

### 4.12 `discovery_runs`

Operational history; not shown in the MVP mobile UI.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid PK | |
| `triggered_by` | text | `schedule` \| `manual` |
| `status` | `discovery_run_status` | |
| `started_at` | timestamptz | |
| `finished_at` | timestamptz null | |
| `error_summary` | text null | |

### 4.13 `discovery_run_items`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid PK | |
| `discovery_run_id` | uuid FK → discovery_runs ON DELETE CASCADE | |
| `saved_search_id` | uuid FK → saved_searches | |
| `source_id` | `source_id` | |
| `status` | `discovery_item_status` | |
| `jobs_fetched` | int | |
| `jobs_inserted` | int | |
| `jobs_updated` | int | |
| `error` | text null | |

### 4.14 `job_relevance_scores` (future, not MVP)

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid PK | |
| `user_id` | uuid FK → profiles | Score is personal |
| `job_listing_id` | uuid FK → job_listings | |
| `saved_search_id` | uuid null | Optional: score in the context of one search |
| `score` | int | 0–100 |
| `strengths` | text[] | |
| `missing_skills` | text[] | |
| `explanation` | text | |
| `recommendation` | text | e.g. Worth applying |
| `model` | text | |
| `computed_at` | timestamptz | |
| Unique | `(user_id, job_listing_id, saved_search_id)` | Treat null search as a distinct key |

AI must not write `job_listings`; it only writes this table.

### 4.15 Intentionally not a table

| Concept | Where it lives |
| --- | --- |
| Source catalog labels | `packages/config` |
| Adapter implementation | NestJS `SourcesModule` |
| Default clock times | `packages/config` until per-user schedules exist |

A `sources` table is optional later (feature flags, last successful fetch). Not required for MVP.

---

## 5. Indexes (initial)

| Table | Index | Purpose |
| --- | --- | --- |
| `saved_searches` | `(user_id, is_active)` | Load searches for a discovery run / list UI |
| `saved_search_sources` | `(source_id)` | All searches targeting a source |
| `job_listings` | `(source_id, last_seen_at desc)` | Source-filtered feeds |
| `job_listings` | `(company_normalized, title_normalized)` | Duplicate detector |
| `job_search_matches` | `(saved_search_id, matched_at desc)` | Search tab |
| `job_search_matches` | `(job_listing_id)` | Detail: which searches matched |
| `job_favorites` | `(user_id, created_at desc)` | Favorites list |
| `job_applications` | `(user_id, status)` | Applications board |
| `notifications` | `(user_id, created_at desc)` | Inbox |
| `duplicate_group_members` | `(job_listing_id)` | Detail: related jobs |

---

## 6. Row-level access (application rules)

Even if Postgres RLS is added later, NestJS must enforce:

- A user CRUD-owns only their `saved_searches`, `job_favorites`, `job_applications`, `notifications`, `device_tokens`, `profiles`.
- Job feed queries **must** join through that user’s searches (or favorites/applications).
- `raw_payload` is never exposed on public GETs.
- `discovery_runs` are admin/internal only.

Service-role / server connection bypasses RLS; that is why the API is the only writer for discovery.

---

## 7. Lifecycle examples

**Same role on two sources**

1. Insert LinkedIn row in `job_listings`.
2. Insert Kariyer.net row in `job_listings`.
3. Insert two members in one `duplicate_groups`.
4. Both rows appear in the feed. Detail shows the sibling listing.

**One listing, two saved searches**

1. One `job_listings` row.
2. Two `job_search_matches` rows (Frontend + Angular).
3. Jobs → All shows the listing once.
4. Jobs → Frontend and Jobs → Angular both include it.
5. Detail lists both search names.

**User B should not see User A’s matches**

Same `job_listings` row may exist globally, but User B’s feed is empty until User B has a matching saved search (or a favorite/application).

---

## 8. Open schema questions

See also [ARCHITECTURE.md](./ARCHITECTURE.md) §15.

- Soft-hide vs keep stale listings (`is_active` semantics).
- Whether `is_new` is per match or per user-listing (`job_views`).
- Whether `work_models` / keywords should become child tables if we need richer operators (AND/OR, exclude).
- Whether `raw_payload` should be TTL’d for privacy.
- Pairwise duplicate table if we later need “similar but not same cluster”.
