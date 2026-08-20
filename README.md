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
  into the PR lifecycle timeline (opened → ready → changes requested 1..N → approved →
  merged). Every row carries a repository chip and a sensitivity indicator.
- **Analytics** — KPI cards (time to merge, review pickup, merged this week, waiting
  now) over a panel grid: opened-vs-merged weekly flow, time-to-merge trend (median +
  p90), open-PR age distribution, review depth (zero-comment approvals + reverts), and
  the per-round wait breakdown.
- **My PRs** — the landing page and the only screen a developer needs day to day: a
  checklist of the pull requests where it is genuinely your turn (merge it, get a
  reviewer, fix the checks, address feedback), one action button each, with everything
  that waits on someone else folded away.
- **My Reviews** — the reviews still open for you; a PR you have approved drops out.
- **People & roster** (in System settings, admins only) — people seeded from commit
  author emails, GitHub identity linking, manual entry, and an active/disabled switch
  that gates login, tracking, and every future nudge. Unresolved GitHub logins surface
  in the same table for one-click resolution.
- **Settings** — profile, light/dark theme, and self-service GitHub account linking
  (shown only when a GitHub OAuth app is configured; otherwise Settings points to the
  manual link under System settings → People).
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
| `domains/assignment` | Deterministic reviewer-assignment engine (area knowledge from PR history, availability, fairness), the assign/reset actions, per-person assignment modes, and the engine performance view. |
| `domains/metrics` | Dashboard + analytics aggregation (median + p90 per wait round, cycle, weekly flow, quality guardrails). |
| `scheduler` | `@nestjs/schedule` jobs: gap-fill every minute + boot (the local live mechanism, with a stale-PR reconcile pass), the assignment sweep every five minutes, and metrics refresh. |

## Local development

Relay runs entirely on your laptop. It authenticates to GitHub with a read-only
fine-grained personal access token (no GitHub App needed until deployment).

1. Copy `.env.example` to `backend/.env` and fill in `GITHUB_PAT`, `GITHUB_REPOS`, and the
   Google OAuth values. `GITHUB_REPOS` only seeds the `repos` table on an empty database;
   once that table has rows it is the source of truth, and repositories are added from
   System settings → Repositories (which validates them against GitHub first).
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
DORA dashboard (≤10% gap). Phase 2 landed as well: the personal inbox, people management
with RBAC, and the analytics page.

The assignment engine is built and runs in **test mode**. It picks a reviewer for every
reviewer-less PR, shows the pick and its reasoning in the app, and supports per-person
modes (off / suggest-and-I-trigger / auto after a grace window). A separate switch,
`assignment.actuallyAssign`, defaults to **off**, so nothing is written to GitHub until
the team trusts the picks. An admin performance view tracks how often the engine agreed
with what the team actually did.

Slack delivery is **designed but not built** — see
`docs/PR app SPEC/2026-08-19-slack-integration-plan.md` for the decisions, the ordered
build steps, and the three setup actions that need a human inside Slack.

`NEXT-STEPS.md` is the live roadmap. The specs live in `docs/PR app SPEC/`, which has its
own index; note that `docs/` is deliberately not tracked by git.
