# Relay — Phase 1 build order

This scaffold gives you the skeleton: entities, module wiring, auth, the GitHub client
(PAT + App), the GraphQL API shape, the frontend shell, and the job schedule. The pieces
that carry the logic are stubbed and throw `not implemented`, each tagged with the spec
task it maps to.

Build order follows the spec's Phase-1 backbone. The PhaseComputer is test-first: its spec
file (`backend/src/domains/pull-requests/phase-computer.spec.ts`) already lists the edge
cases as `it.todo` — turn each into a real test before writing the code.

| Step | File to implement | Spec task |
|---|---|---|
| 1 | Confirm scaffold builds and boots (`yarn install`, `tilt up`) | Task 1 |
| 2 | Auth end to end (already wired — verify Google login issues a JWT and `me` resolves) | Task 2 |
| 3 | GitHub client GraphQL/REST calls against a repo with the PAT | Tasks 3, 4 |
| 4 | `GithubEventNormalizer.buildExternalId` + `normalizeBackfillNode` | Task 6 |
| 5 | `PhaseComputer.compute` + `computeWaitRounds` + `computeWaitingOn` (TDD) | Task 8 |
| 6 | `PullRequestsService.recomputeFromEvents` (persist derived row) | Task 8 |
| 7 | `BackfillService.run` (iterate `GITHUB_REPOS`, page 3 quarters) | Task 7 |
| 8 | `GapFillJob.run` (the local live path) | Task 10 |
| 9 | `MetricsService.dashboard` + `percentile` (median + p90 per round) | Task 11 |
| 10 | Dashboard UI zones beyond the metric cards (stuck-now, fairness, quality trend) | Task 16 |
| 11 | `IngestionController` webhook path (deployed only — needs the GitHub App) | Task 9 |
| 12 | ~~`PeopleService.seedFromCommitEmails` + unmapped-logins report~~ **done** | Task 12 |
| 13 | Match-to-DORA E2E check (backfill a fixture, assert aggregates within 10%) | Task 20 |

## Before you start

- POC team + the list of repositories (Relay is multi-repo) — set `GITHUB_REPOS`.
- A read-only fine-grained PAT scoped to those repos — set `GITHUB_PAT`.
- The exact DORA definitions to match: size thresholds, bot rule, revert/draft filters.
  Task 20 cannot pass until these match.
- The Phase-1 global default review SLA — set `DEFAULT_REVIEW_SLA_MINUTES`.
- The apono-user to github-login mapping question is settled — no need to check it again.
  Apono's GitHub provider (`apono-agent/providers/github/github/common.go`) resolves an email
  through org verified-domain emails, SAML/SCIM identities, then public-profile search. All
  three return nothing for `apono-io`: no verified domain, Team plan so no SAML, and no public
  emails. It is also reachable only behind a system-admin endpoint. Relay reads commit author
  emails instead — see `docs/PR app SPEC/2026-07-28-people-identity-and-rbac.md`.

## Deliberately not in Phase 1

No inbox, no Slack, no reminders, no auto-assignment, no admin UI, no deployment, no GitHub
App, no webhooks. Phase 1 runs locally on a PAT and stays fresh through gap-fill polling.
The App and webhooks arrive with deployment and reuse the same normalizer.

## People identity and roles — built

Tasks 12 and 45 to 48 turned `people` into a real roster with role-based access. Spec:
`docs/PR app SPEC/2026-07-28-people-identity-and-rbac.md`. This supersedes the "no admin UI"
line above — the admin UI landed here, scoped to people management only.

| Step | Work | Spec task | State |
|---|---|---|---|
| 1 | `github_identities` table (one person, many logins) | Task 45 | done |
| 2 | Seed the roster from commit author emails | Task 12 | done |
| 3 | `rosterHealth` query (unmapped + unresolved) | Task 12 | done |
| 4 | Person lookup at login, `role` claim, `active` gate | Task 46 | done |
| 5 | Permission constants + `PermissionsGuard` | Task 47 | done |
| 6 | People mutations behind the guard | Task 47 | done |
| 7 | GitHub account linking via OAuth | Task 48 | needs an OAuth App |
| 8 | People admin page + guarded nav entry | Task 48 | done |

Run `yarn seed-people` in `backend/` after a backfill. On the current data it creates 16 people
from 21 author logins and reports the 5 it cannot settle. Re-running is safe: a confirmed
mapping is never replaced by a later guess.

Step 7 is code-complete but inert until a GitHub OAuth App exists. Create one at
<https://github.com/settings/developers> with the callback
`http://localhost:3100/auth/github/callback`, then set `GITHUB_OAUTH_CLIENT_ID` and
`GITHUB_OAUTH_CLIENT_SECRET`. Until then `startGithubLink` answers "not configured".

## Still open after this

- "My PRs" and "My Reviews" can now resolve the viewer to author logins through
  `github_identities`. The two views still render placeholders — that is the next slice.
- A token already issued keeps its role for up to one day. Deactivating a person blocks the
  next sign-in, not the current session.
- Slack nudges and managed assignment: the identity chain is ready end to end; design for the
  missing `person_settings` piece and the three opt-in surfaces is fixed in
  `docs/PR app SPEC/2026-07-28-slack-nudge-and-assignment-readiness.md`.
