# JobRadar — Implementation Roadmap

This roadmap sequences work **after** architecture review. It does not authorize implementation in the current documentation pass.

Rules that stay true in every phase:

- Do not add LinkedIn or Kariyer.net access until an explicit access-method decision.
- Do not delete duplicate listings.
- Discovery stays on the backend.
- Preserve `apps/mobile`, `apps/api`, and `packages/*`.

---

## Current checkpoint

| Item | Status |
| --- | --- |
| Product requirements | [PRD.md](./PRD.md) written |
| Architecture, database, API | Proposed in this docs set — **awaiting review** |
| Production application code | Not started (NestJS / Expo starters only) |
| Shared packages | Not created |
| New dependencies | Not added |
| Source adapters | Not implemented |

**Stop here until the architecture is accepted** (or revision notes are applied).

---

## Phase 0 — Documentation review (now)

- Review [ARCHITECTURE.md](./ARCHITECTURE.md), [DATABASE.md](./DATABASE.md), [API.md](./API.md).
- Confirm: global job catalog, duplicate groups, many-to-many search matches, NestJS as sole app API.
- Record decisions that this proposal left open only if they block Phase 1 (ORM, auth library, hosting can wait until foundation spikes).

**Exit:** Architecture approved or amended in git.

---

## Phase 1 — Foundation (no job sources)

Goal: wire the monorepo so later features have types, env, and a database — still without product screens or adapters.

- Create `packages/types`, `packages/validation`, `packages/config` (catalog with `implemented: false`).
- Add `.env.example` placeholders (no secrets).
- Choose and add **one** DB client/ORM (decision).
- Create migrations for the schema in [DATABASE.md](./DATABASE.md), including duplicate tables and `job_search_matches`.
- NestJS: `HealthModule`, config loading, ESM-friendly workspace imports.
- Supabase project + Auth spike: JWT verification from a protected `/v1/me` stub.
- Mobile: API base URL config only; do not rebuild UX yet.
- Spike: Expo Metro resolving workspace packages.

**Exit:** `GET /health` and authenticated `GET /v1/me` work locally against Postgres. No LinkedIn/Kariyer code.

**Still not allowed:** source HTTP clients, production UI, AI.

---

## Phase 2 — Domain API (CRUD)

Goal: persist users’ searches and user-job overlays without a live discovery pipeline.

- `SearchesModule` full CRUD.
- `JobsModule` feed/detail/tabs against **seeded or fixture listings** (SQL seeds or a test inserter — not a source adapter).
- `FavoritesModule`, `ApplicationsModule`.
- Prove: one listing, two `job_search_matches`, tab counts (`All` ≠ sum of search tabs).
- Prove: two listings, one `duplicate_groups`, both remain GET-able.
- Shared Zod on write paths.

**Exit:** API e2e covers searches, feed filters, favorites, application status. Mobile still optional.

---

## Phase 3 — Discovery pipeline with disabled adapters

Goal: scheduler + orchestrator + registry exist, and they **skip** unimplemented sources safely.

- `SourcesModule`: `JobSourceAdapter`, `SourceRegistry`.
- LinkedIn and Kariyer.net **stubs** with `isEnabled() === false` (or equivalent). No network calls.
- Optional **in-memory mock adapter** behind an env flag `ENABLE_MOCK_SOURCE=true` for local demos only. Not a product source.
- `DiscoveryModule`: scheduler slots 08:00 / 13:00 / 19:00, `discovery_runs` accounting.
- Normalizer + Zod for adapter payloads.
- Upsert `job_listings` identity rules.
- `MatchingModule`: match against all of the user’s active searches.
- Internal `POST /v1/internal/discovery/run`.

**Exit:** A scheduled run completes with `skipped_disabled_source` for catalog sources; with mock flag, listings appear in the API feed.

**Still not allowed:** real LinkedIn or Kariyer.net access.

---

## Phase 4 — Duplicate detection

- `DuplicatesModule` conservative normalized company + title grouping.
- Never deletes listings.
- Job detail returns `duplicateJobs`.
- Tests for two-source pairs and three-member groups.

**Exit:** Fixture or mock listings show “Same job detected on N sources” data in the API.

---

## Phase 5 — Notifications

- Persist digest rows when new matches appear in a run.
- `GET /v1/notifications` + read APIs.
- Device token register (schema only is acceptable if push provider is undecided).
- Push send can wait until Expo Notifications is chosen.

**Exit:** After a mock discovery run, a user has an in-app “N new jobs found” row.

---

## Phase 6 — Mobile product UI

Replace the Expo Home / Explore starter.

- Auth screens (Supabase).
- Tabs: Jobs, Searches, Applications, Profile.
- Jobs: source tabs + saved-search tabs, list, detail, favorite, application status, duplicate indicator, outbound URL.
- Searches: list, create, edit, detail (criteria + matched count).
- Applications list.
- Profile: sign out, notification toggle.
- TanStack Query + Zustand + RHF + Zod as specified in the PRD.
- Feature-folder layout from [ARCHITECTURE.md](./ARCHITECTURE.md).

**Exit:** Owner can sign in, create two searches, see fixture/mock jobs, filter tabs, favorite, and change application status. Discovery still does not hit real job boards.

Verify in a real client (simulator or device), not only screenshots: tab filtering, detail duplicates, favorites surviving search-tab changes.

---

## Phase 7 — Real source adapters (blocked)

**Blocked on:** written decision per source (API vs other allowed method vs out of scope).

Then, one source at a time:

1. Enable `isEnabled()` for that `SourceId`.
2. Implement adapter only under `apps/api/src/sources/adapters/`.
3. Validate payloads; respect rate limits; log `discovery_run_items`.
4. Do not put source logic in `JobsModule` or mobile.

If a source cannot be accessed legally/technically, keep `implemented: false` and keep the rest of the product running with mock/fixtures.

---

## Phase 8 — AI relevance (after pipeline is stable)

- `AiModule` + `job_relevance_scores`.
- Inputs: profile/CV (when stored), search criteria, job description.
- Outputs: score, strengths, missing skills, short explanation, recommendation.
- Jobs API exposes nullable `relevance` fields.
- Notification copy may later split “highly relevant / relevant / review”.

AI must not fetch jobs.

---

## Phase 9 — Hardening

- GitHub Actions: lint, typecheck, API tests, (optional) mobile typecheck.
- Hosting for an always-on API + scheduled runs.
- Rate limits, logging, sanitization of HTML descriptions.
- Stale-listing policy implementation.
- Cursor-based pagination tuning, indexes from production query plans.
- `.cursor/rules` if the team wants persistent agent guidance.

---

## Explicitly not on the roadmap (PRD out of scope)

- Automatic applications / CV submission
- Interview chatbot
- Salary negotiation
- CV or cover-letter generation
- Social networking
- Employer accounts
- Paid subscriptions
- Advanced analytics

---

## Suggested dependency order

```text
Phase 0 review
    → Phase 1 foundation
        → Phase 2 domain API
            → Phase 3 pipeline (stubs + optional mock)
                → Phase 4 duplicates
                → Phase 5 notifications
                    → Phase 6 mobile
                        → Phase 7 real adapters (if approved)
                            → Phase 8 AI
                                → Phase 9 hardening
```

Phases 4 and 5 can proceed in parallel after Phase 3. Phase 6 can start against Phase 2 fixtures before mock discovery exists, but tab + “new jobs” UX is only complete once 3–5 exist.

---

## Immediate next step after review

If this architecture is accepted: start **Phase 1** only (packages, database, auth spike). Do not implement LinkedIn, Kariyer.net, or mobile feature screens in the same change.
