# Relay

Internal app that shortens how long a pull request waits to merge. Relay records the full
event history of every PR, rebuilds each PR's timeline, and reports where reviews get
stuck — not just the first pickup, but the reviewer-vs-author split of every review round
that the DORA dashboard reports only as one combined Rework Time.

This repository is cloned from the apono-backoffice stack: NestJS + code-first GraphQL
(Apollo) + TypeORM/Postgres on the backend, React 19 + MUI 7 + Apollo Client on the
frontend, Google OAuth for login, and Tilt for local orchestration.

## What the app does today

- **Dashboard** — every open PR that waits on someone, split into three sections:
  *Needs a reviewer* (nobody assigned — the attention chip pulses), *In progress*
  (reviewer, author, or CI has the ball), and *Stalled over a week*. Each row expands
  into the PR lifecycle timeline (opened → ready → first review → approved → merged).
- **Analytics** — KPI cards (time to merge, review pickup, merged this week, waiting
  now) over a panel grid: opened-vs-merged weekly flow, time-to-merge trend (median +
  p90), open-PR age distribution, review depth (zero-comment approvals + reverts), and
  the per-round wait breakdown.
- **My PRs / My Reviews** — the personal inbox: your open PRs with who holds the ball,
  your recently merged, and everything waiting on your review.
- **People & roster** (in System settings, admins only) — people seeded from commit
  author emails, GitHub identity linking, manual entry, and an active/disabled switch
  that gates login, tracking, and every future nudge. Unresolved GitHub logins surface
  in the same table for one-click resolution.
- **Settings** — profile, light/dark theme, and self-service GitHub account linking.
- **Live sync** — a gap-fill job pulls GitHub every minute (and at boot), a reconcile
  pass self-heals PRs that changed while Relay was offline, and every page shows the
  last sync time with a manual refresh button.

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
| `core/auth` | Google OAuth + JWT login (apono.io only), person-backed roles, GitHub account linking. |
| `core/rbac` | Permission constants and the `PermissionsGuard` (`resource:action`). |
| `infrastructure` | Logger, sync-status, and the GitHub client (read-only PAT locally, GitHub App when deployed). |
| `domains/people` | Roster: people, `github_identities` (one person, many logins), commit-email seeding, roster health. |
| `domains/pull-requests` | `PullRequest` + `PrEvent` entities and the `PhaseComputer` (phases + per-round Reviewer/Author waits + waiting_on). |
| `domains/ingestion` | `GithubEventNormalizer` (canonical event ids), `BackfillService`, and the webhook controller (deployed path). |
| `domains/repos` | Watched repositories (add with GitHub validation) and per-repo area rules with private risk levels. |
| `domains/assignment` | Deterministic reviewer-assignment engine (mastery from PR history, availability, fairness) recording quiet-phase suggestions. |
| `domains/metrics` | Dashboard + analytics aggregation (median + p90 per wait round, cycle, weekly flow, quality guardrails). |
| `scheduler` | `@nestjs/schedule` jobs: gap-fill every minute + boot (the local live mechanism, with a stale-PR reconcile pass), the assignment sweep every five minutes, and metrics refresh. |

## Local development

Relay runs entirely on your laptop. It authenticates to GitHub with a read-only
fine-grained personal access token (no GitHub App needed until deployment).

1. Copy `.env.example` to `backend/.env` and fill in `GITHUB_PAT`, `GITHUB_REPOS`, and the
   Google OAuth values.
2. Run `yarn install` at the root.
3. Run `tilt up` (or `yarn dev`) — it starts Postgres in a container (host port 5433),
   the backend, and the frontend.
4. First run: `yarn backfill` then `yarn seed-people` in `backend/`.

Backend: http://localhost:3100 — GraphQL playground at `/graphql`.
Frontend: http://localhost:5174.

Everyone on the roster starts **disabled**; `ADMIN_EMAILS` bootstraps the first admin,
who enables people from System settings → People.

## Status

Phase 1 (baseline + live pipeline + dashboard) is complete and validated against the
DORA dashboard (≤10% gap). Large parts of Phase 2 landed too: the personal inbox
(My PRs / My Reviews), people management with RBAC, and the analytics page. The smart
assignment engine runs in its quiet phase: it records who it would pick for every
reviewer-less PR and writes nothing to GitHub; admins compare its picks against what
the team did from System settings. See `NEXT-STEPS.md` for the current state and the
roadmap (assignment modes and triggers, Slack).

The full design lives in `docs/PR app SPEC/`.
