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
| 12 | `PeopleService.seedFromConfig` + unmapped-logins report | Task 12 |
| 13 | Match-to-DORA E2E check (backfill a fixture, assert aggregates within 10%) | Task 20 |

## Before you start

- POC team + the list of repositories (Relay is multi-repo) — set `GITHUB_REPOS`.
- A read-only fine-grained PAT scoped to those repos — set `GITHUB_PAT`.
- The exact DORA definitions to match: size thresholds, bot rule, revert/draft filters.
  Task 20 cannot pass until these match.
- The Phase-1 global default review SLA — set `DEFAULT_REVIEW_SLA_MINUTES`.
- Check the external `apono-connector` repo for an existing apono-user to github-login
  mapping before seeding the roster by hand.

## Deliberately not in Phase 1

No inbox, no Slack, no reminders, no auto-assignment, no admin UI, no deployment, no GitHub
App, no webhooks. Phase 1 runs locally on a PAT and stays fresh through gap-fill polling.
The App and webhooks arrive with deployment and reuse the same normalizer.
