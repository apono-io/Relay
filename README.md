# Relay

Internal app that shortens how long a pull request waits to merge. Relay records the full
event history of every PR, rebuilds each PR's timeline, and reports where reviews get
stuck — not just the first pickup, but the reviewer-vs-author split of every review round
that the DORA dashboard reports only as one combined Rework Time.

This repository is cloned from the apono-backoffice stack: NestJS + code-first GraphQL
(Apollo) + TypeORM/Postgres on the backend, React 19 + MUI 7 + Apollo Client on the
frontend, Google OAuth for login, and Tilt for local orchestration.

## Layout

```
backend/    NestJS service (GraphQL API, event ingestion, phase computation, jobs)
frontend/   React + MUI dashboard
scripts/    local dev helpers (db bootstrap)
Tiltfile    runs backend + frontend locally
```

### Backend modules

| Module | Responsibility |
|---|---|
| `core/auth` | Google OAuth + JWT login, restricted to the apono.io domain. |
| `infrastructure` | Logger and the GitHub client (read-only PAT locally, GitHub App when deployed). |
| `domains/people` | Roster: email to github_login mapping, team, role. |
| `domains/pull-requests` | `PullRequest` + `PrEvent` entities and the `PhaseComputer` (phases + per-round Reviewer/Author waits + waiting_on). |
| `domains/ingestion` | `GithubEventNormalizer` (canonical event ids), `BackfillService`, and the webhook controller (deployed path). |
| `domains/metrics` | Dashboard aggregation (median + p90 per wait round, cycle, SLA misses, quality guardrails). |
| `scheduler` | `@nestjs/schedule` jobs: gap-fill (the local live mechanism) and metrics refresh. |

## Local development

Relay runs entirely on your laptop for Phase 1. It authenticates to GitHub with a
read-only fine-grained personal access token (no GitHub App needed until deployment).

1. Copy `.env.example` to `backend/.env` and fill in `GITHUB_PAT`, `GITHUB_REPOS`, and the
   Google OAuth values.
2. Start Postgres (for example `docker run -e POSTGRES_PASSWORD=postgres -p 5432:5432 postgres`).
3. Run `yarn install` at the root.
4. Run `tilt up` (or `yarn dev`).

Backend: http://localhost:3000 — GraphQL playground at `/graphql`.
Frontend: http://localhost:5173.

## Status

This is a scaffold. Entities, module wiring, auth, the GitHub client, and the job schedule
are in place. The core logic (PhaseComputer, normalizer, backfill, gap-fill, metrics
aggregation) is stubbed and throws `not implemented`. See `NEXT-STEPS.md` for the build
order mapped to the Phase-1 spec tasks.

The full design lives in the apono-mono spec set under `docs/plans/PR app SPEC/`.
