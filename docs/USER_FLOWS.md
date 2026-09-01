# JobRadar — User Flows

This document describes product user flows for the mobile app and the backend discovery process. It is documentation only. It does not change application code.

Related documents:

- [PRD.md](./PRD.md)
- [ARCHITECTURE.md](./ARCHITECTURE.md)
- [DATABASE.md](./DATABASE.md)
- [API.md](./API.md)
- [ROADMAP.md](./ROADMAP.md)

Auth screens sit outside the tab bar. After login, the app uses four bottom tabs: **Jobs**, **Searches**, **Applications**, **Profile**.

---

## 1. Product behavior that every flow must respect

These rules override local UI convenience.

1. **Duplicates are never hidden or deleted.** If the same role appears on LinkedIn and Kariyer.net, both listings stay in the catalog and in the feed.
2. **Each source-specific listing is a separate card.** The app does not collapse two sources into one row.
3. **Related duplicates are linked and marked.** Example: “Same job detected on 2 sources”. Opening detail shows sibling listings. Tapping a sibling opens that source’s listing, not a merged record.
4. **One listing can match several saved searches.** It appears once under **All**, and again under each matching search tab. Search tab counts may sum to more than **All**. Source tab counts (except **All**) sum to **All**.
5. **Source tabs and saved-search tabs are clickable.** Tapping a tab filters the visible list. Tabs are not labels only.
6. **Scheduled discovery runs on the backend.** The phone being closed, offline, or backgrounded does not stop 08:00 / 13:00 / 19:00 runs. The app only reads results from the NestJS API. It never queries LinkedIn or Kariyer.net itself.

Favorites and application status belong to the **current user**. They are not stored on the shared job listing.

---

## 2. High-level navigation map

Unauthenticated users cannot open tab screens.

```text
                    ┌────────────┐
                    │   Login    │◄──────────────┐
                    └─────┬──────┘               │
                          │                      │
                    ┌─────▼──────┐               │
                    │  Register  │               │
                    └─────┬──────┘               │
                          │ success              │ logout
                          ▼                      │
              ┌──────────────────────────────────┴─────────┐
              │              Authenticated shell            │
              │         bottom tabs (exactly four)          │
              │                                             │
              │  Jobs     Searches     Applications  Profile│
              └──┬──────────┬──────────────┬───────────┬────┘
                 │          │              │           │
                 ▼          ▼              ▼           ▼
```

### 2.1 Jobs tab

Entry: bottom tab **Jobs**. Default filters: source **All**, no saved-search tab selected (or an **All searches** equivalent: every matching listing).

| Destination | How the user gets there |
| --- | --- |
| Jobs list | Tab **Jobs**; also the target of a new-jobs push notification |
| Job detail | Tap a job card |
| Related duplicate detail | From job detail, tap a sibling listing |
| Original source page | From job detail, open original URL (system browser) |
| Favorites (independent list) | From **Profile → Favorites**, or a Favorites entry point that does not depend on search tabs |

Jobs list chrome (always visible when the list can load):

- **Source tabs (clickable):** All · LinkedIn · Kariyer.net, each with a count
- **Saved-search tabs (clickable):** one tab per saved search, each with a count
- Job cards: title, company, source, location, work model, “new” if unseen, duplicate mark if `duplicateGroupSize > 1`, favorite state, matching search names or chips

The user can select **one source tab** and **one saved-search tab** at the same time. Filters compose (see flows 8 and 9).

### 2.2 Searches tab

Entry: bottom tab **Searches**.

| Destination | How the user gets there |
| --- | --- |
| Searches list | Tab **Searches** |
| Create search | Primary action on the list (e.g. “Create search”) |
| Search detail | Tap a search row |
| Edit search | From search detail, “Edit” |
| Jobs filtered by that search | From search detail, “View jobs” (opens Jobs with that saved-search tab selected) |

Each row shows name, active/inactive state, selected sources, and a match count when known.

### 2.3 Applications tab

Entry: bottom tab **Applications**.

| Destination | How the user gets there |
| --- | --- |
| Applications list | Tab **Applications** |
| Job detail | Tap an application row |
| Status change | On the row or on job detail (same statuses) |

Statuses: `NEW`, `REVIEWING`, `APPLIED`, `INTERVIEW`, `OFFER`, `REJECTED`. Optional status chips filter the list.

### 2.4 Profile tab

Entry: bottom tab **Profile**.

| Destination | How the user gets there |
| --- | --- |
| Profile | Tab **Profile** |
| Favorites list | Profile → Favorites (independent of Jobs search tabs) |
| Notification preference | Toggle on Profile |
| Logout | Profile → Log out → Login |

### 2.5 Auth (outside tabs)

| Screen | Reachable from |
| --- | --- |
| Login | Cold start with no session; Register “Already have an account”; after logout |
| Register | Login “Create account” |

Password reset is not a required MVP screen in the PRD. If added later, it starts from Login.

---

## 3. Flow catalog

Actors:

- **User** — person using `apps/mobile`
- **System** — NestJS API, scheduler, adapters, PostgreSQL / Supabase Auth

API names below are the intended contract from [API.md](./API.md).

---

## Flow 1 — User registration

### Preconditions

- The app is installed.
- The user does not have a JobRadar account, or is willing to create a new one.
- Device has network access.
- User is on **Login** or opens the app with no session.

### Trigger

User taps **Create account** on Login, or lands on **Register**.

### Main flow

1. User enters email, password, and optional display name.
2. Client validates the form (shared Zod schema): email format, password minimum length, required fields.
3. Mobile signs up through **Supabase Auth** (not a job-source API; NestJS does not store the password).
4. Supabase creates `auth.users`.
5. On success, mobile receives a session (access token + refresh token) and stores it securely.
6. Mobile calls `GET /v1/me` with the Bearer token. NestJS verifies the JWT and ensures a `profiles` row exists (create-on-first-seen if needed), using display name when provided.
7. If notification permission will be requested at first login, that may happen here or after the first Jobs visit (see Flow 16). It must not block registration.
8. App enters the authenticated shell on **Jobs**.

### Alternative flow

- User already has an account: after submit, Auth returns “user already registered”. App keeps the user on Register and offers **Go to login**.
- Email confirmation required by the Auth project: app shows “Check your email” and does not enter tabs until the session is valid. After confirmation, user continues at Login.

### Error cases

- Validation errors: inline field messages; no Auth call.
- Network failure: “Couldn’t create account. Check your connection and try again.” Session is not created.
- Weak password / Auth reject: show the Auth message without leaking internals.
- `GET /v1/me` fails after Auth succeeded: keep the session, retry profile load, show a recoverable error. Do not send the user to a half-created Jobs feed that assumes a profile.

### Result

- User has an Auth account and a `profiles` row.
- User is logged in (or pending email confirmation).
- No saved searches and no jobs yet. Jobs shows the empty state in Flow 17.

---

## Flow 2 — User login

### Preconditions

- User has a registered account.
- No valid session, or the previous session expired.
- User is on **Login**.

### Trigger

User submits email and password, or the app restores a valid stored session on cold start.

### Main flow

1. User enters email and password.
2. Client validates the form.
3. Mobile signs in through **Supabase Auth**.
4. On success, tokens are stored securely.
5. Mobile calls `GET /v1/me`.
6. App enters **Jobs**.
7. Jobs loads `GET /v1/jobs/tabs` and `GET /v1/jobs`. Searches, applications, and notifications hydrate in the background as the user visits those tabs.

### Alternative flow

- **Session restore:** cold start finds a valid refresh token, refreshes silently, calls `GET /v1/me`, skips Login.
- User taps **Create account** → Flow 1.
- User enables notifications later from Profile; login still succeeds if they deny OS permission.

### Error cases

- Empty or invalid fields: inline validation.
- Wrong email or password: generic “Email or password is incorrect.” Do not reveal which field is wrong.
- Unconfirmed email (if required): explain that confirmation is needed.
- Network failure: retry; stay on Login.
- Expired or revoked token on restore: clear session, show Login.
- API 401 after Auth succeeded: treat as logged out, show Login.

### Result

- Authenticated session.
- User sees Jobs (populated or empty, depending on searches and prior discovery).
- Backend discovery is unaffected by this login; it may already have run while the user was logged out.

---

## Flow 3 — Create saved search

### Preconditions

- User is logged in.
- User is on **Searches** (or navigates there).

### Trigger

User taps **Create search**.

### Main flow

1. App opens **Create Search**.
2. User enters:
   - Name (e.g. “Frontend Developer”)
   - Keywords (one or more)
   - Technologies (optional)
   - Locations (optional)
   - Work models (optional; empty means any)
   - Sources: at least one of LinkedIn, Kariyer.net (catalog sources are selectable even if adapters are not implemented yet)
3. User leaves **Active** on (default `isActive: true`).
4. User taps **Save**.
5. Client validates with shared Zod (name required, `sourceIds` non-empty, known source ids only).
6. Mobile `POST /v1/searches`.
7. API persists `saved_searches` and `saved_search_sources`.
8. App returns to **Search detail** or **Searches list** showing the new search.
9. Jobs **saved-search tabs** gain a new clickable tab (count 0 until matches exist).

The new search is included in the **next** backend discovery run. Creating a search does **not** scrape sources on the device and does **not** require a manual “Run now” for MVP.

### Alternative flow

- User cancels: discard draft, return to Searches. No API write.
- User creates a second search (e.g. “Angular”) with overlapping keywords. Both exist independently. Later, one listing may match both (Flow 7 and 9).
- User selects a source whose adapter is disabled: save still succeeds. Discovery records `skipped_disabled_source` until the source is implemented. The search remains valid intent.

### Error cases

- Validation: inline errors; no POST.
- Duplicate name: allowed unless product later forbids it; no extra unique constraint in the database design.
- Network / 5xx: keep the form values, show retry.
- 401: Flow 18 session expired path (re-login).
- Unknown `sourceId`: 400 from API; show “Select a valid source.”

### Result

- A saved search owned by the user.
- It appears on Searches and as a Jobs search tab.
- If active, the backend will use it on the next scheduled run (08:00 / 13:00 / 19:00). Existing job listings are not deleted or rewritten just because a search was created.

---

## Flow 4 — Edit saved search

### Preconditions

- User is logged in.
- At least one saved search exists.
- User can open that search (own row only).

### Trigger

From **Search detail**, user taps **Edit**.

### Main flow

1. App opens **Edit Search** with current name, keywords, technologies, locations, work models, sources, and active flag.
2. User changes any fields (e.g. add “Next.js”, add Remote, add Kariyer.net).
3. User taps **Save**.
4. Client validates the same schema as create.
5. Mobile `PATCH /v1/searches/:id`.
6. API updates the search and replaces `saved_search_sources` as needed.
7. App returns to **Search detail** with updated criteria.
8. Jobs search tab **label** updates if the name changed.

Matching behavior after edit:

- **Future** discovery uses the new criteria to fetch.
- **Existing** `job_listings` rows are not deleted.
- The next pipeline match pass may add new `job_search_matches` or stop matching listings that no longer fit. Listings that no longer match this search disappear from **this** search tab but remain under **All** if they still match another search, and remain in Favorites / Applications if the user saved them.

### Alternative flow

- User cancels: no PATCH.
- User only toggles active: that is Flow 5; Edit can include the same control.
- User removes the last source: validation fails (sources must be non-empty).

### Error cases

- 404: search deleted elsewhere; return to Searches with “Search not found.”
- Validation / network / 401: same pattern as Flow 3.
- Concurrent edit: last write wins; acceptable for MVP (single household users).

### Result

- Search criteria persist.
- Duplicate listings in the catalog are untouched.
- Tab filters on Jobs reflect the new name and, after the next match pass, the new membership.

---

## Flow 5 — Enable or disable a saved search

### Preconditions

- User is logged in.
- A saved search exists.
- User is on **Searches list**, **Search detail**, or **Edit Search**.

### Trigger

User toggles **Active** off or on.

### Main flow — disable

1. User turns **Active** off.
2. Mobile `PATCH /v1/searches/:id` with `{ "isActive": false }` (or the same field in a full edit save).
3. API sets `is_active = false`.
4. UI shows Inactive (list badge and detail).
5. **Backend:** the next discovery run **does not fetch** for this search.
6. **Existing** `job_search_matches` and `job_listings` remain. The listing is not deleted.
7. Jobs: product default is that the search tab remains visible so the user can still review past matches, or the tab is shown as inactive. Either way, cards are not removed as a side effect of “hide duplicates.” Duplicates stay visible if they still match another active search or appear when this tab is opened.

Recommended MVP: inactive searches still appear as clickable Jobs tabs (dimmed) so past matches remain reachable. Discovery simply skips them.

### Main flow — enable

1. User turns **Active** on.
2. PATCH `{ "isActive": true }`.
3. The search is included in the next backend run.
4. No on-device fetch.

### Alternative flow

- User disables every search: Jobs **All** may still show previously matched listings (they remain matched until a future pass removes matches). Favorites and Applications remain fully reachable. Discovery fetches nothing for this user until a search is active again.
- User deletes a search instead of disabling: `DELETE /v1/searches/:id` removes match rows for that search only, **not** `job_listings`. Other searches’ matches stay. This is not the disable flow but is the nearby alternative.

### Error cases

- Toggle fails: revert the switch, toast error, keep previous `isActive`.
- 404 / 401: same as Flow 4.

### Result

- Inactive searches are not queried by scheduled discovery.
- No source-specific listing is deleted or hidden because of duplicate detection.
- The user can turn the search back on without recreating it.

---

## Flow 6 — Scheduled backend job discovery

This is a **system** flow. The user does not start it from the phone.

### Preconditions

- NestJS API process is running (always-on host).
- At least one user has at least one **active** saved search (otherwise the run completes with nothing to fetch).
- Source adapters may be enabled, disabled, or mock (implementation phase). Disabled catalog sources must be skipped, not crashed.

### Trigger

Backend scheduler fires at the default slots **08:00**, **13:00**, and **19:00** (user timezone deferred; until then a documented default timezone). Optional internal `POST /v1/internal/discovery/run` for operators/tests. **Not** Expo background fetch. **Not** a Jobs pull-to-refresh that hits LinkedIn.

### Main flow

1. Scheduler starts a `discovery_runs` row (`triggered_by: schedule`, `status: running`).
2. Orchestrator loads **all users’ active** saved searches and their `saved_search_sources`.
3. For each search × selected source:
   - If the adapter `isEnabled()` is false → `discovery_run_items` status `skipped_disabled_source`. Continue.
   - If enabled → adapter `search(normalized query)`.
4. Raw items are validated (Zod) and normalized. Invalid items are dropped, not stored half-written.
5. Each valid item is **upserted** into `job_listings` by `(source_id, external_id)` or `(source_id, canonical_url)`.
   - New row: set `first_discovered_at`.
   - Existing row: update mutable fields and `last_seen_at`. **Do not delete.**
6. **Match:** each upserted listing is evaluated against **all** of that user’s active searches, not only the search that fetched it. Write/update `job_search_matches`. One listing may get multiple match rows (e.g. Frontend and Angular).
7. **Duplicates:** detector may add `duplicate_groups` / `duplicate_group_members`. Related listings stay as separate `job_listings`. No merge delete.
8. AI scoring is skipped in MVP.
9. If the user gained **new** matches this run, insert one digest `notifications` row (e.g. title “5 new jobs found”), not one row per listing.
10. If push is configured and `notifications_enabled` and a `device_tokens` row exist, send a push whose payload is `{ type: "new_jobs_digest", discoveryRunId, jobCount }` — **not** the full job bodies.
11. Run finishes `succeeded` or `partial` if some items failed.
12. When the user later opens the app, mobile loads jobs via `GET /v1/jobs`. Discovery has already finished without the device.

### Alternative flow

- Phone offline or app killed: steps 1–11 still run. Push may fail; in-app notification still exists. User sees new jobs on next successful `GET /v1/jobs` (Flow 7).
- One adapter fails: isolate to that `discovery_run_items` row; other searches/sources continue (`partial`).
- Same listing rediscovered: upsert updates `last_seen_at`; `first_discovered_at` unchanged; user does not get a “new” match unless `is_new` rules say so (typically only first match).
- Two sources post the same role: two listings stored, then grouped. Both remain visible (Flow 11).
- No active searches: run completes quickly; no adapter calls required.

### Error cases

- Entire orchestrator crash: `discovery_runs.status = failed`, `error_summary` set. Next slot tries again. Mobile shows last known jobs; no silent wipe.
- Invalid adapter payload: skip item, count against the item error, do not abort the run.
- Database unavailable: run fails; API `/health/ready` may fail; mobile shows Flow 17 errors.

### Result

- Catalog and match tables are updated on the server.
- Duplicate relationships may be added; listings are never removed as duplicates.
- Users with new matches have an in-app (and optionally push) digest.
- Mobile does no source I/O.

---

## Flow 7 — New job appears in the Jobs screen

### Preconditions

- User is logged in.
- At least one saved search exists (usually active) so the user is allowed to see matches.
- Flow 6 has stored at least one `job_search_matches` row for this user. (During early implementation this may come from fixtures/mock rather than real adapters.)

### Trigger

User opens **Jobs**, returns to Jobs, pull-to-refresh (API only), or the app refetches after a push (Flow 16).

### Main flow

1. Mobile `GET /v1/jobs/tabs` and `GET /v1/jobs` (source All, no search filter unless a tab is selected).
2. API returns **distinct** listings for this user, newest `firstDiscoveredAt` first.
3. Source tabs show All / LinkedIn / Kariyer.net with counts. Saved-search tabs show each search with counts. **All tabs are tappable.**
4. A newly matched listing shows a **New** indicator when `isNew` is true.
5. If the listing is in a duplicate group (`duplicateGroupSize > 1`), the card shows a mark such as **Same job detected on 2 sources**. The LinkedIn card and the Kariyer.net card **both** appear in **All** if both matched the user. Neither is omitted.
6. If the listing matched two searches, `matchedSearchIds` has two ids. It appears **once** in All, and on **both** search tabs.
7. Opening the card is Flow 10. Viewing it may clear `isNew` (GET detail or `POST /v1/jobs/:id/view`).

### Alternative flow

- User had Jobs open during a run: next refetch (focus, interval, or pull) shows new cards. No local discovery.
- User has two searches; one new job matches both: one card in All; counts on both search tabs increase; All count increases by one, not two.
- User favorited nothing yet: favorite heart is empty; listing still shows.

### Error cases

- Empty feed: Flow 17 (no searches vs no matches).
- Load failure: Flow 17 error with retry. Do not invent listings.
- Stale cache: TanStack Query refetch; do not keep a “deleted duplicate” optimization — the server never deleted it.

### Result

- User sees each source-specific listing as its own row.
- New items are distinguishable.
- Duplicate marks do not remove rows.
- Multi-search matches are visible via chips and via multiple search tabs.

---

## Flow 8 — Filter jobs by source

### Preconditions

- User is on **Jobs**.
- Tabs have loaded (`GET /v1/jobs/tabs`).
- Source tabs are visible: **All**, **LinkedIn**, **Kariyer.net** (and future sources).

### Trigger

User taps a **source tab**.

### Main flow

1. User taps **LinkedIn** (example).
2. Client sets the selected source filter (`sourceId=linkedin`) and keeps the current saved-search tab if one is selected.
3. Mobile `GET /v1/jobs?sourceId=linkedin` (plus `savedSearchId` if set).
4. List shows only LinkedIn listings. Kariyer.net listings that are duplicates of those roles **remain in the catalog** but are not in this filtered list. They are still under **All** and **Kariyer.net**, and still linked from detail (Flow 11).
5. The LinkedIn tab shows selected state. Counts on tabs do not need to change (they are global facets, not “count inside current filter,” unless product later passes `q`).
6. User taps **All**: filter clears; both sources show again, including both members of a duplicate pair.

### Alternative flow

- User taps **Kariyer.net** instead. Same pattern.
- User combines with a saved-search tab (Flow 9): e.g. LinkedIn + Frontend → listings that are LinkedIn **and** match Frontend.
- User taps the already selected source tab: keep selection (no toggle-off that hides the tab bar). **All** is how they reset source filter.

### Error cases

- Request fails: keep previous list, show error banner, retry.
- Count is 0 (e.g. LinkedIn x 0): show empty state for that filter (Flow 17), not a blank tab bar. Tab remains clickable.
- Unknown source query: API 400; client should only send catalog ids.

### Result

- Visible list is filtered by source.
- Duplicate siblings on another source are not deleted; they are one tap away via **All**, the other source tab, or detail related jobs.

---

## Flow 9 — Filter jobs by saved search

### Preconditions

- User is on **Jobs**.
- User has one or more saved searches, so search tabs exist and are clickable (e.g. Frontend, React, Angular).

### Trigger

User taps a **saved-search tab**.

### Main flow

1. User taps **Angular**.
2. Client sets `savedSearchId` to that search’s id. Source tab stays as-is (All or a specific source).
3. Mobile `GET /v1/jobs?savedSearchId=...` (and `sourceId` if not All).
4. List shows listings matched to Angular. A listing that also matched Frontend **still appears here** (it is the same `job_listings` row). Under **Frontend** it appears as well. Under **All** it appears **once**.
5. Search tab counts may sum to more than All; this is expected, not a bug.
6. User taps another search tab to switch. User needs a control to clear search filter (**All** for searches, or tapping a dedicated “All searches” chip). Recommended: an **All** search tab, or deselecting by tapping **All** on a first row of search chips. Documented MVP: include an **All searches** clickable tab that omits `savedSearchId`.

### Alternative flow

- Combined with Flow 8: Angular + Kariyer.net.
- From **Search detail → View jobs**: opens Jobs with that search tab preselected.
- Disabled search tab (if still shown): still clickable to review historical matches; discovery no longer fetches (Flow 5).

### Error cases

- Search deleted: 404 or empty; refresh tabs; drop invalid `savedSearchId`.
- Zero matches: empty state “No jobs for this search yet,” tabs still clickable.
- Network: same as Flow 8.

### Result

- Jobs list is filtered by the selected search.
- Multi-match listings are not duplicated inside one tab.
- They remain available on every matching search tab and on All.

---

## Flow 10 — Open job detail

### Preconditions

- User is logged in.
- A listing is visible on Jobs, Favorites, Applications, or a duplicate sibling list.
- The user is allowed to see it: it matches one of their searches, **or** it is favorited, **or** they have an application row.

### Trigger

User taps a job card (or a related-duplicate row).

### Main flow

1. App navigates to **Job detail** (`jobs/[id]`).
2. Mobile `GET /v1/jobs/:id`.
3. Screen shows:
   - Title, company, **source**, location, work model
   - Publication date (if any), first discovered date
   - Technologies, description
   - **Matching saved searches** (this user only) — one or many
   - **Related duplicate jobs** (siblings, each with its own source) — never a replacement for this listing
   - Favorite control
   - Application status control
   - Link to original listing URL
   - AI relevance: hidden or “coming soon” in MVP (null)
4. Opening detail may mark the listing as seen (`isNew` false).
5. User may scroll, favorite (Flow 12), change status (Flow 14), open URL, or open a sibling (Flow 11).

### Alternative flow

- Opened from Applications or Favorites: same detail; matching searches still listed; if the user disabled all searches, detail still loads because of favorite/application access rules.
- Opened from push → Jobs → card: same as above.
- Original URL: system browser; JobRadar listing is unchanged.

### Error cases

- 404: listing not visible to this user (or unknown id). Show “Job not found,” back to previous screen. Do not reveal other users’ catalog.
- Network: retry on detail; keep navigator stack.
- Missing description/salary: show em dash or “Not listed,” not an error.

### Result

- User sees one source-specific listing in full.
- Matching searches and duplicate siblings are explicit.
- Nothing is merged or deleted on open.

---

## Flow 11 — View duplicate-related jobs

### Preconditions

- At least two `job_listings` rows are members of the same `duplicate_groups`.
- Typical case: ABC Technology — Frontend Developer on LinkedIn **and** on Kariyer.net.
- User can access the listing they opened (Flow 10). Siblings are returned on that detail payload even when the current source tab would hide them.

### Trigger

User is on Job detail and views the related-duplicates section, or taps the list-card mark “Same job detected on 2 sources.”

### Main flow

1. Detail includes `duplicateJobs[]` (siblings only, not self), each with id, source, title, company, URL.
2. UI states clearly that these are **the same job on other sources**, not replacements.
3. **Both** (all) source listings remain independently visible:
   - In **Jobs → All**, two cards
   - In each source tab, the card for that source
   - In detail, the current listing plus sibling links
4. User taps the Kariyer.net sibling.
5. App opens **that** listing’s detail (`GET /v1/jobs/:siblingId`). Favorite and application status are **per listing** (user can favorite LinkedIn and not Kariyer.net, or track application on one URL).
6. From the sibling, the user can return or open the original source URL for that source.

### Alternative flow

- Group size 3+ (future sources): copy “Same job detected on N sources”; list all siblings; still no deletion.
- User filters Jobs to LinkedIn: only the LinkedIn card is in the list; the mark still indicates more sources; detail still lists Kariyer.net sibling.
- Detector found no group: section hidden; no false “1 source” duplicate chrome.

### Error cases

- Sibling 404 (sibling not in user’s matches and not favorited): still show the sibling as a link with source + URL so the user can open the original posting, **or** allow GET if the parent was accessible (API should return siblings on the parent detail even when sibling would 404 alone). Preferred: parent detail includes enough sibling fields to navigate; opening sibling uses the same access as parent if they share a group the user already reached. If sibling GET 404s, open `canonicalUrl` in the browser instead of dropping the duplicate.
- Duplicate detector wrong: user still sees both jobs; they can ignore the mark. No user “delete duplicate” action in MVP.

### Result

- User understands the relationship without losing either listing.
- Each source remains a first-class job.
- Catalog rows are unchanged.

---

## Flow 12 — Favorite a job

### Preconditions

- User is on Job detail or a job card that includes a favorite control.
- User is allowed to access the listing (same as Flow 10).

### Trigger

User taps the favorite control (empty → filled).

### Main flow

1. Optimistic UI: heart fills.
2. Mobile `PUT /v1/jobs/:id/favorite` (idempotent).
3. API inserts `job_favorites` for `(user_id, job_listing_id)` if missing.
4. Listing `isFavorite` is true on subsequent feed/detail payloads.
5. The listing remains on Jobs according to search filters. Favoriting does **not** hide it, does **not** create an application row, and does **not** collapse duplicates. Favoriting the LinkedIn listing does not favorite the Kariyer.net sibling.

### Alternative flow

- User favorites from the list card without opening detail: same PUT.
- User favorites both source-specific duplicates: two favorite rows, two hearts.
- User has since disabled all searches: favorite still works if they still have access (match, existing favorite, or application). New favorites from a listing only on the feed require feed access (a match). From detail of an already matched job, disable-search does not remove the favorite.

### Error cases

- PUT fails: revert heart, toast “Couldn’t save favorite.”
- 404: cannot favorite a listing the user cannot access.
- 401: re-login.

### Result

- Listing is in the user’s favorites, independent of which Jobs tab is selected.
- User can find it under **Profile → Favorites** (`GET /v1/favorites`) even if search tabs would filter it out.

---

## Flow 13 — Remove a job from favorites

### Preconditions

- The listing is currently favorited by this user.
- User is on Job detail, job card, or the Favorites list.

### Trigger

User taps the favorite control (filled → empty), or **Remove** on the Favorites list.

### Main flow

1. Optimistic UI: heart empties.
2. Mobile `DELETE /v1/jobs/:id/favorite` (idempotent).
3. API deletes the `job_favorites` row if present.
4. Favorites list no longer includes it.
5. The listing **stays** on Jobs if it still matches a saved search. It is not deleted from `job_listings`. Duplicate siblings are unaffected. Application status is unaffected.

### Alternative flow

- DELETE when already not favorited: success, still unfavorited.
- Removing one source’s listing from favorites leaves the sibling favorited if it was.

### Error cases

- DELETE fails: restore filled heart, toast error.
- 401: re-login.

### Result

- Favorite overlay is gone for that user + listing.
- Job remains visible in discovery results and duplicate groups.

---

## Flow 14 — Change application status

### Preconditions

- User can access the listing.
- User is on **Job detail** or **Applications**.

### Trigger

User selects a status: `NEW`, `REVIEWING`, `APPLIED`, `INTERVIEW`, `OFFER`, `REJECTED`.

### Main flow

1. If the user had no application row, choosing a status **starts tracking** (including `NEW`).
2. Mobile `PUT /v1/jobs/:id/application` with `{ "status": "APPLIED" }` (example).
3. API upserts `job_applications` for this user + listing. Status is **not** written on `job_listings`.
4. Job detail and Applications list show the new status.
5. Another user’s view of the same catalog listing is unchanged.
6. Duplicate sibling keeps its own application row (or none). Applying on LinkedIn does not mark Kariyer.net as APPLIED.

### Alternative flow

- User changes APPLIED → INTERVIEW → OFFER, or to REJECTED.
- User removes tracking: `DELETE /v1/jobs/:id/application` (if exposed in UI, e.g. “Stop tracking”). Listing and favorites remain.
- Favoriting is independent; status change does not favorite.

### Error cases

- Invalid status: 400; keep previous status.
- PUT fails: revert picker, toast error.
- 404 / 401: same as other job mutations.

### Result

- Per-user status persisted.
- Listing stays in Jobs / duplicate groups.
- Applications tab will show this row (Flow 15).

---

## Flow 15 — View Applications screen

### Preconditions

- User is logged in.

### Trigger

User taps bottom tab **Applications**.

### Main flow

1. Mobile `GET /v1/applications` (optional `status` query if a chip is selected).
2. Screen lists jobs this user is tracking, with status, company, title, source.
3. Optional clickable status chips filter the list (client sets `status=`).
4. User taps a row → Flow 10.
5. User can change status inline or on detail → Flow 14.
6. Duplicate pairs appear as **separate rows** if the user tracks both source listings. Neither is hidden.

### Alternative flow

- Empty: Flow 17 copy inviting the user to open a job and set a status. Tab is still available.
- Filter to `INTERVIEW`: only those rows; other applications remain stored.
- Listing no longer matches any active search: it **still appears here** (application access rule).

### Error cases

- Load failure: error + retry.
- 401: re-login.

### Result

- User sees an application-centric list, not the Jobs search tabs.
- Source identity remains on each row.
- No duplicate collapsing.

---

## Flow 16 — Receive and open a push notification

### Preconditions

- User is logged in (or was logged in when the token was registered).
- `profiles.notifications_enabled` is true.
- User granted OS notification permission.
- Device token registered via `PUT /v1/devices`.
- Flow 6 created a `new_jobs_digest` notification because new matches existed.
- Push provider is configured (Expo or equivalent). If push is not configured yet, the in-app notification row still exists.

### Trigger

OS shows a notification, e.g. **“5 new jobs found.”** User taps it. (Foreground banner tap is the same destination.)

### Main flow

1. Backend has already stored jobs and the digest; the push payload is `{ type: "new_jobs_digest", discoveryRunId, jobCount }` only.
2. User taps the notification.
3. OS opens JobRadar (cold start or resume).
4. If no session: **Login** first (Flow 2); after success, continue to Jobs with the pending deep link.
5. If session valid: app opens **Jobs** (not a fake list inside the notification).
6. App marks the digest read: `POST /v1/notifications/:id/read` when the id is known, or read-all for that run if wired later.
7. App `GET /v1/jobs` (and tabs). New listings show **New**. Data always comes from the API, never from the push body.
8. User continues with Flows 7–11.

Recommended: land on Jobs with source **All** and searches **All**, optionally scrolled to newest. Do not auto-hide the Kariyer.net copy of a LinkedIn job.

### Alternative flow

- User does not tap: jobs still appear next time they open Jobs. Discovery already finished on the backend.
- App in foreground during push: in-app banner; tap runs the same navigation.
- Permission denied: no OS push; Profile can explain how to enable; in-app `GET /v1/notifications` can still list digests if the UI includes an inbox later. MVP minimum is OS push + Jobs landing.
- `notifications_enabled` false: no push sent; discovery still stores jobs.
- User logged out on device: tapping notification opens Login; jobs are not shown for another account.

### Error cases

- Invalid/expired deep link: open Jobs default feed.
- Jobs fetch fails after tap: Jobs error state (Flow 17), not a blank “5 jobs” placeholder.
- Token invalid: next run skips push or refreshes token on next app start (`PUT /v1/devices`).

### Result

- User lands on the Jobs screen with current listings, including every source-specific duplicate.
- Backend work did not depend on the tap.

---

## Flow 17 — Error and empty states

This flow is the catalog of non-happy UI. Preconditions vary by screen.

### Trigger

A screen loads with no data, or a request fails, or the user has not finished setup.

### Main flow (empty states)

| Screen | When | What the user sees | Primary action |
| --- | --- | --- | --- |
| Jobs | Logged in, **no saved searches** | Explain that searches must be created before jobs can be collected. Do not imply the phone will search sources itself. | Go to **Create search** |
| Jobs | Searches exist, **zero matches** (adapters skipped or nothing found) | “No jobs yet. Searches run in the morning, midday, and evening. New jobs will appear here.” | Stay / open Searches to confirm criteria |
| Jobs | Filter source or search has **count 0** | “No jobs for this filter.” Source and search tabs remain **clickable** so the user can return to All. | Tap **All** or another tab |
| Jobs | Matches exist but current combined filters empty | Same as filter empty; do not delete listings | Change tabs |
| Searches | No searches | “Create a search to start collecting jobs from LinkedIn and Kariyer.net.” | Create search |
| Search detail | Search exists, zero matches | Criteria + “No matching jobs yet.” | Edit / View jobs |
| Applications | No `job_applications` | “Track a job from its detail screen.” | Go to Jobs |
| Applications | Status chip empty | “No applications with this status.” | Clear chip |
| Favorites | None | “Save jobs with the heart to find them here, even when you change search tabs.” | Go to Jobs |
| Job detail | Duplicate section | Hidden if no group; never “duplicates removed” | — |
| Profile | Normal | Account, notification toggle, logout | — |
| Notifications inbox (if present) | None | “You’ll be notified when new jobs are found.” | — |

Empty Jobs must **not** be implemented by hiding duplicate cards. If two sources matched, empty is wrong.

### Main flow (error states)

| Situation | User-facing behavior |
| --- | --- |
| Offline on any tab | Banner or full-screen “You’re offline.” Retry when network returns. Cached lists may show if TanStack Query has data; label them as possibly stale. |
| `GET /v1/jobs` 5xx / timeout | Error on Jobs with **Retry**. Do not clear already displayed cards unless the refetch explicitly returns empty. |
| `GET /v1/jobs/:id` 404 | “Job not found.” Back. |
| `GET /v1/searches` fails | Searches error + retry. Creating a search is disabled until reload succeeds (avoid blind POSTs) or POST is still allowed with a warning. |
| Mutations fail (favorite, status, save search) | Restore previous UI; toast with retry. |
| 401 / refresh failed | Session expired message → Login (Flow 18). |
| Registration/login errors | Stay on auth screens; see Flows 1–2. |
| Push open but API down | Jobs error state, not a fake digest list. |

### Alternative flow

- Partial discovery (`partial` run): user may see some new jobs; no special error unless zero jobs and they expected more. Do not show adapter stack traces.
- Disabled sources: empty Jobs with searches present is expected until adapters are enabled; copy should not blame the user.

### Error cases (meta)

- Error UI itself must not call source adapters.
- Retry only hits NestJS.

### Result

- User can always use clickable tabs to escape a filter empty state.
- Failures are recoverable without data loss or duplicate deletion.
- Setup emptiness is distinguished from outages.

---

## Flow 18 — User logout

### Preconditions

- User is logged in.
- User is on **Profile** (or a session-expired dialog).

### Trigger

User taps **Log out** and confirms, or the app forces logout on unrecoverable 401.

### Main flow

1. User taps **Log out**.
2. Confirm: “Log out of JobRadar?”
3. On confirm:
   - `DELETE /v1/devices/:token` if a push token was registered (best-effort; do not block logout on failure).
   - Sign out of **Supabase Auth** (invalidate/discard session locally).
   - Clear in-memory query cache (jobs, searches, applications) so the next account cannot see this user’s feed.
   - Clear secure session storage.
4. Navigate to **Login**; authenticated tabs are unmounted.
5. **Backend discovery continues** for this user account on the server. Logout does not pause 08:00 / 13:00 / 19:00 and does not delete listings, matches, favorites, or applications.

### Alternative flow

- User cancels confirm: stay on Profile.
- Forced 401: skip confirm; same cleanup; Login with “Session expired.”
- User logs in as the spouse on the same device: they see only their searches and matches, not the previous profile’s favorites.

### Error cases

- Device unregister fails: still log out locally; orphan token may get 4xx on next push until it is replaced.
- Sign-out network fail: still clear local session so the device is not stuck authenticated.

### Result

- Device has no usable JWT.
- User sees Login.
- Server-side jobs and duplicate relationships remain for the account.
- Next login is Flow 2.

---

## 4. Cross-flow examples

### 4.1 One listing, two searches

User has searches **Frontend** and **Angular**. Discovery stores one LinkedIn listing that matches both.

- Jobs → All: **one** card
- Jobs → Frontend: the card
- Jobs → Angular: the same card
- Detail: both search names listed
- Source tabs: LinkedIn count +1, All +1, Kariyer.net unchanged

### 4.2 Same role, two sources

ABC Technology — Frontend Developer on LinkedIn and Kariyer.net.

- All: **two** cards, each marked related
- LinkedIn tab: LinkedIn card only, still marked
- Kariyer.net tab: Kariyer.net card only, still marked
- Detail of either: sibling link
- Neither card is removed when the user favorites one, applies to one, or disables a search that only selected one source

### 4.3 Phone off during a run

19:00 run completes on the API. User’s phone is off. In the morning the user opens Jobs (or taps “5 new jobs found”) and sees both source listings. The device did not run discovery.

---

## 5. Screen inventory (flow coverage)

| Screen | Flows |
| --- | --- |
| Register | 1, 17 |
| Login | 2, 16 (if locked), 18 |
| Jobs | 7, 8, 9, 12, 16, 17 |
| Job detail | 10, 11, 12, 13, 14, 17 |
| Searches | 3, 5, 17 |
| Create search | 3, 17 |
| Edit search | 4, 5, 17 |
| Search detail | 4, 5, 9 (view jobs), 17 |
| Applications | 14, 15, 17 |
| Profile | 13 (via Favorites), 16 (permission), 18 |
| Favorites list | 12, 13, 17 |
| Backend only | 6 |

---

## 6. Out of scope for these flows

- Automatic apply / CV upload
- AI relevance as a required UI (reserved fields only)
- Running discovery from the mobile OS
- Deleting a listing because a duplicate exists
- LinkedIn / Kariyer.net access methods (adapters may be skipped; flows still hold with fixtures or mock)
