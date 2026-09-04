# Discovery scheduler

Scheduled discovery runs **in the NestJS API process**, not on the phone.

## Cadence (Europe/Istanbul)

| Setting | Default |
| --- | --- |
| Interval | every 1 hour |
| Cron | `0 * * * *` |
| Timezone | `Europe/Istanbul` |

| Environment | Default |
| --- | --- |
| `DISCOVERY_SCHEDULER_ENABLED` | `false` locally in `.env.example`; set `true` in production |
| `DISCOVERY_INTERVAL_HOURS` | `1` |
| `SCHEDULER_TIMEZONE` | `Europe/Istanbul` |

`SCHEDULER_ENABLED` is still read if `DISCOVERY_SCHEDULER_ENABLED` is unset, for older env files.

On API startup the host logs `Scheduler enabled: true/false`, `intervalHours`, and `timezone`. It does not log secrets.

The in-process cron only fires when the API process is running. Overlapping scheduled/manual runs are skipped (`POST /v1/scheduler/run` and the interval job share the same lock). Creating or updating a saved search enqueues background discovery for **that search only**; the HTTP response returns `discovery.status: pending` and does not wait for the crawl. Production scheduled runs do **not** require `ENABLE_DEV_ENDPOINTS`.

## New-match notifications

A discovery run notifies only when it **creates new `job_search_matches` rows**.

- 0 new matches → no inbox row, no push
- 1+ new matches for a user → one grouped `JOB_DISCOVERY` inbox row and the same Expo push
- Already-known matches are skipped by upsert and do not notify again

Copy example: title `3 new jobs found`, body `2 LinkedIn, 1 Kariyer.net`. Push data is `{ type: "JOB_DISCOVERY", route: "/jobs" }`.

## Expo push

| Environment | Required |
| --- | --- |
| `EXPO_ACCESS_TOKEN` | **Optional.** Expo Push accepts requests without it. Set it to authenticate as your Expo account (higher rate limits). |

Push tokens live in `user_push_tokens`. NestJS uses the service role. Invalid Expo tickets with `DeviceNotRegistered` deactivate the token. Push failures never fail discovery.

## Production

1. Host the API on a process that stays awake (Fly, Railway, Render background, VPS). Serverless sleep skips the interval.
2. Set:

```text
DISCOVERY_SCHEDULER_ENABLED=true
DISCOVERY_INTERVAL_HOURS=1
SCHEDULER_TIMEZONE=Europe/Istanbul
EXPO_ACCESS_TOKEN=
```

3. Keep `POST /v1/scheduler/run` and `POST /v1/discovery/run` for local testing with `ENABLE_DEV_ENDPOINTS=true`; they are not a substitute for cron in production.

If the API cannot stay warm, call `POST /v1/scheduler/run` from an external hourly cron in Europe/Istanbul. Do not use Expo background fetch as the source of truth.
