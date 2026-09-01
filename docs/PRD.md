# JobRadar - Product Requirements Document

## 1. Product Overview

JobRadar is a mobile job discovery and job application tracking application.

The main problem it solves is the need to manually visit multiple job platforms several times a day and repeatedly search with different keywords and filters.

The system will automatically run saved job searches at scheduled times, collect matching job listings from supported sources, and display the results in one mobile application.

Initial target users are the project owner and spouse, but the product architecture should support multiple users in the future.

---

## 2. Main Goal

The application should allow users to:

- Create multiple job search profiles.
- Define different keywords and filters for each search.
- Select job listing sources.
- Automatically run searches several times per day.
- View newly discovered job listings.
- See which source each job came from.
- See which saved search matched each job.
- View duplicate listings instead of removing them.
- Detect and visually mark duplicate or related job listings.
- Favorite listings.
- Track application status.
- Receive notifications for newly discovered jobs.
- Eventually receive AI-based relevance scores.

---

## 3. Initial Job Sources

MVP target sources:

- LinkedIn
- Kariyer.net

Important:

Source integrations must be implemented through an adapter architecture.

Do not hard-code scraping logic into application business logic.

The exact access method for each source will be decided separately based on technical feasibility and platform usage rules.

---

## 4. Saved Searches

A user can create multiple saved searches.

Example:

### Search A
Name:
Frontend Developer

Keywords:
- Frontend Developer
- React Developer
- Frontend Engineer

Technologies:
- React
- Next.js
- TypeScript

Locations:
- Istanbul
- Remote

Work types:
- Remote
- Hybrid

Sources:
- LinkedIn
- Kariyer.net

### Search B
Name:
Angular

Keywords:
- Angular Developer
- Frontend Developer

Technologies:
- Angular
- TypeScript

Locations:
- Istanbul

Sources:
- LinkedIn
- Kariyer.net

---

## 5. Search Result Tabs

Search results must be filterable using clickable tabs.

Example:

Sources:

- All x 10
- LinkedIn x 4
- Kariyer.net x 6

Saved searches:

- Frontend x 3
- React x 5
- Angular x 2

Clicking a tab filters the visible job listing results.

A job can match more than one saved search.

---

## 6. Duplicate Job Behavior

Duplicate job listings must NOT be deleted.

If the same or highly similar job appears on multiple sources:

Example:

LinkedIn:
ABC Technology - Frontend Developer

Kariyer.net:
ABC Technology - Frontend Developer

Both listings should remain visible.

The application should additionally mark them as related duplicates.

Example UI indicator:

"Same job detected on 2 sources"

Duplicate relationships should be stored separately from the job listing itself.

---

## 7. Job Listing Information

Each job listing should support:

- Job title
- Company name
- Description
- Location
- Work model
- Experience level
- Salary information if available
- Technologies if detected
- Job source
- Original job URL
- Publication date if available
- First discovered date
- Saved searches that matched the job
- AI relevance score in future
- Duplicate relationship
- Favorite state
- Application state

---

## 8. Job Detail Screen

The job detail screen should show:

- Job title
- Company
- Source
- Location
- Work model
- Publication date
- Discovery date
- Technologies
- Description
- Matching saved searches
- Related duplicate jobs
- AI relevance score
- AI relevance explanation
- Original job listing link
- Favorite action
- Application status action

---

## 9. Scheduled Searches

Saved searches should run automatically.

Initial default schedule:

- Morning
- Midday
- Evening

Example:

08:00
13:00
19:00

Exact schedule should be configurable later.

Scheduled processing must happen on the backend, not on the mobile device.

The system should continue working even when the user's phone is offline or the mobile application is closed.

---

## 10. Job Discovery Pipeline

Expected backend flow:

1. Scheduled search starts.
2. Load active saved searches.
3. Load selected sources.
4. Query each source adapter.
5. Normalize source-specific job data.
6. Store discovered jobs.
7. Match jobs to saved searches.
8. Detect related duplicate listings.
9. Calculate AI relevance score if enabled.
10. Create user notifications.
11. Mobile app retrieves results through the API.

---

## 11. Notifications

Users should receive notifications when new jobs are discovered.

Example:

"5 new jobs found"

Future notification detail:

- 2 highly relevant
- 2 relevant
- 1 review recommended

Notifications should open the relevant results in the mobile application.

---

## 12. Favorites

Users can favorite any job listing.

Favorite jobs must remain accessible independently of search result lists.

---

## 13. Application Tracking

Users should be able to track the status of a job application.

Initial statuses:

- NEW
- REVIEWING
- APPLIED
- INTERVIEW
- OFFER
- REJECTED

Application status should belong to the user, not globally to the job listing.

---

## 14. Mobile Navigation

Initial bottom navigation:

1. Jobs
2. Searches
3. Applications
4. Profile

---

## 15. Main Screens

Initial screens:

- Login
- Register
- Jobs
- Job Detail
- Searches
- Create Search
- Edit Search
- Search Detail
- Applications
- Profile

---

## 16. AI Features

AI should not be responsible for discovering jobs.

AI should operate after jobs are discovered.

Future AI inputs:

- User profile
- User CV
- Saved search criteria
- Job description

Expected AI output:

- Relevance score
- Matching strengths
- Missing skills
- Short explanation
- Application recommendation

Example:

Relevance: 92%

Strengths:
- React matches
- TypeScript matches
- Frontend experience matches

Missing:
- Redux Toolkit

Recommendation:
Worth applying

---

## 17. Architecture Principles

The project must use a monorepo architecture.

Current structure:

job-radar/
- apps/mobile
- apps/api
- packages/types
- packages/validation
- packages/config
- docs
- .cursor/rules
- .github/workflows

Architecture principles:

- Feature-based architecture
- Strong TypeScript typing
- Avoid any
- Separate UI and business logic
- Separate source adapters from core job logic
- Validate external data
- Shared types where appropriate
- Shared Zod validation schemas where appropriate
- Do not expose backend secrets to the mobile app
- Environment variables must not be committed
- Modules should have clear responsibilities

---

## 18. Technology Stack

### Mobile

- React Native
- Expo SDK 57
- TypeScript
- Expo Router
- Zustand
- TanStack Query
- React Hook Form
- Zod

### Backend

- Node.js
- NestJS
- TypeScript
- ESM

### Database / Infrastructure

- PostgreSQL
- Supabase

### AI

- OpenAI API

### Package Management

- pnpm

### Monorepo

- Turborepo

---

## 19. MVP Scope

MVP should include:

- Authentication
- Multiple saved searches
- Search filters
- Source selection
- Scheduled backend processing
- Job storage
- Source separation
- Saved-search result tabs
- Duplicate display
- Duplicate detection
- Job details
- Favorites
- Application tracking
- Notifications

AI relevance scoring can be implemented after the base job pipeline is stable.

---

## 20. Out of Scope for Initial MVP

Do not implement initially:

- Automatic job applications
- Automatic CV submission
- Interview chatbot
- Salary negotiation
- CV generation
- Cover letter generation
- Social networking features
- Employer accounts
- Paid subscriptions
- Advanced analytics

---

## 21. Core Product Principle

The application must prioritize:

1. Reliable job discovery
2. Clear source visibility
3. Multiple saved search support
4. No hidden duplicate removal
5. Fast filtering
6. Simple mobile UX
7. Extensible source integration architecture