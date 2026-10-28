# Relay — current state and roadmap

Updated 2026-08-19. The scaffold-era build order is done; this file now tracks what the
app does, what is still open, and the order of the next features.

## Where the app stands

Phase 1 (baseline + live pipeline + dashboard) is complete, Phase 2 landed, and the
assignment engine that was planned as Phase 3 is built and running in test mode. Slack is
the only planned feature with no code. Everything below runs locally under Tilt.

Relay watches **two** repositories, `apono-io/apono-mono` and `apono-io/integrations`,
holding roughly 3,700 pull requests and 42,000 events backfilled to November 2025. The
roster is 17 people, all active. These numbers move; treat them as a scale, not a fact to
cite.

| Area | State |
|---|---|
| Ingestion: backfill (3 quarters), normalizer, PhaseComputer, idempotency | done |
| Live sync: gap-fill every minute + at boot, stale-PR reconcile pass, sync indicator on every page | done |
| Match-to-DORA validation (AC-2: ≤10% gap, passed 2026-07-07) | done |
| Dashboard: needs-reviewer / in-progress / stalled sections, expandable PR timelines | done |
| Analytics: KPI cards, opened-vs-merged, time-to-merge trend, open-PR age, review depth, wait rounds | done |
| Personal inbox: My PRs + My Reviews through `github_identities` | done |
| People & RBAC: seeding, identity linking, roles, permissions guard, active/disabled gate | done |
| Settings pages: user settings (profile, theme, GitHub link) + admin System settings (People) | done |
| GitHub OAuth linking flow | code-complete; needs a GitHub OAuth App (`GITHUB_OAUTH_CLIENT_ID/SECRET`). Until then Settings hides the button and points to the manual link under System settings → People |
| Assignment slice 1: PR file paths ingested + history backfilled | done |
| Assignment slice 2: repos in System settings (add with GitHub validation), per-repo area rules auto-seeded + editable | done |
| Assignment slice 3: mastery index, deterministic engine (TDD), quiet-phase recording, admin comparison panel | done |
| Assignment slices 4–5 in shadow mode: personal modes (off/hybrid/auto), Assign-reviewer button, auto-assign after grace window, reviewer→author pairs on every row | done — the "Actually assign" toggle (System settings, default off) keeps every assignment app-only ("test") until the team trusts it |
| Assignment polish: a submitted review counts as engagement (no assign over an active review), actual reviewers shown on in-progress and merged rows, Approved chip once review is done, multi-reviewer pairs, per-pick "why" explanation, reset-assignment control | done |
| Assignment hardening: repeat-pick damping (no back-to-back picks while someone comparable is free), race-safe atomic claim with GitHub rollback, self-review/duplicate-review stats fixes, honest reason phrases, NaN-safe config reads, full unit coverage of the actions service | done — 161 backend tests |
| Focus batch: My PRs is a my-turn checklist, repo chip + sensitivity dots on every PR table, approved PRs leave My Reviews, review rounds named in the timeline, menu split into personal / Team, email-only Add person, Assignment-engine performance view | done — 191 backend tests |
| `@relay assign` / `@relay skip` PR comment commands: read in the one-minute sync, author-only, skip blocks auto-assign, replies on the PR only while live assignment is on | done — 240 backend tests |
| Teams: System settings → Teams (name, lead, members; one team per person), `@relay team` picks within the author's team and asks the lead only when every other pickable member has the lead threshold of open reviews or more (one global setting under Engine settings), a bare `@relay` assigns org-wide, and the reply shows the area's sensitivity and links to Relay (`RELAY_URL`) | done — 332 backend tests |
| Live-ready writes: the Apono Relay GitHub App (installation found automatically), GitHub writes only as the App, a PR reply that explains the pick, a faster sync (20-second scan, separate 10-minute re-check, no overlapping runs), pending reviews no longer break the sync, Relay's own comments out of review metrics | done — 280 backend tests |

Known limits:

- A token already issued keeps its role for up to one day; deactivating a person blocks
  the next sign-in, not the current session.
- `@relay` commands usually take effect within 10–15 seconds locally
  (`GAP_FILL_INTERVAL_SECONDS=20`). An `assign` older than `COMMAND_MAX_AGE_HOURS`
  (default 24) is ignored; a skip of any age is kept. While `assignment.actuallyAssign`
  is off, Relay still replies as its App but names the pick in bold instead of
  @-mentioning them and requests no review, so nobody is notified.
- Webhooks exist only as the deployed path; locally the gap-fill is the live mechanism
  (`GAP_FILL_INTERVAL_MINUTES`, set to 1 locally, default 10 in code). It resumes from a
  watermark in `app_settings`, so downtime of any length self-heals on the first run after
  recovery. Verified twice, on 2026-08-13 and 2026-08-18.
- Tilt reports the Postgres container as healthy after it has died, and the backend
  `/health` endpoint does not touch the database, so neither signal catches a dead
  database. Check `docker ps` when data looks frozen.
- Relay writes to GitHub only as the Apono Relay GitHub App (`apono-relay[bot]`); with a
  personal token it only reads, and the `actuallyAssign` switch refuses to turn on. The
  App is still owned by a personal account and should be transferred to `apono-io`.
- Every area rule currently carries risk level 2, so the sensitivity indicator on PR rows
  is uniform until those levels are set apart.
- 16 of the 17 people have no display name, so any surface that names a person falls back
  to an email address.

## Roadmap

Three features were planned as one track: pick a reviewer, let the developer control it,
deliver it where people live. The first two shipped. Slack is what remains.

### Shipped — the assignment engine and personal control

Design: `docs/PR app SPEC/2026-07-29-smart-assignment-and-interaction-model.md`.

The engine crosses out ineligible people (active, mode not off, identity-linked, not the
author), then sorts by who has worked in the area recently (from PR history, not git
blame), who is free now, and who has reviewed least in 14 days. A private per-area risk
level shifts those weights. No score, rank, or risk value is shown to a developer — a
pick is a name plus one reason sentence and a three-line explanation of the factors.

Personal control works through `person_settings.assignmentMode`: **off** (suggestions
only), **hybrid** (Relay assigns when the developer triggers it, by button or an
`@relay assign` comment), **auto** (Relay assigns itself after a grace window). Relay
only ever acts on a PR with no requested reviewer, so choosing your own reviewer keeps
Relay out. All 17 people are set to `hybrid`.

Two switches keep this safe. `assignment.actuallyAssign` defaults to **off**, so picks
are recorded and displayed but never written to GitHub. The PAT is read-only, so turning
that switch on also requires a write-scoped token.

An admin performance view reports whether the engine is being used and whether it is
right: agreement with what the team actually did, usage over time, per-area breakdown,
and how picks spread across people.

### Next — Slack delivery (designed, not started)

Plan of record: `docs/PR app SPEC/2026-08-19-slack-integration-plan.md`, which carries
the decisions, the ordered build steps, and the rollout. The full design and its
nineteen acceptance criteria are in the companion `2026-08-17` design document, and the
human setup actions are in the `2026-08-17` runbook.

Slack multiplies the value of everything above, and it is the only remaining feature
that needs external infrastructure: an app installed in the company workspace, a bot
token, and an email lookup.

The design is gate-first for that reason. Every message passes one guard reading
`slack.deliveryMode` (`off` records only, then `allowlist`, then `everyone`; default
`off`), an email allowlist, and a per-person toggle, with `Person.active` outside all of
it. Every attempt lands in a `notification_deliveries` ledger with its outcome, so a
quiet phase shows what Relay would send before it sends anything — the same shape the
assignment quiet phase already uses.

Three message kinds only: assignment proposed, assignment released, and a reviewer
nudge. The nudge comes from a scanning job rather than a transition, because phases are
recomputed statelessly and no "just became stuck" event exists.

Assignment confirmation is a separate opt-in setting: Relay claims the pick and sends
*Take it* / *Pass*, GitHub is written only after acceptance, and a person who passes is
excluded from the next pick for that PR. Buttons arrive over Socket Mode, so there is no
public URL, no ingress, and no signing secret.

The human part is three visits to the Slack app page: generate a configuration token,
press Install and Allow, and create an app-level token. Everything else, including
creating and configuring the app through the App Manifest API, is automatable. That
division is a platform limit, not a preference — no Slack API method installs an app.

## Deliberately still out

No AI-based assignment (deterministic signals first — measure before adding models), no
manager views, no per-team SLA policies (first version is per person), no deployment.
Deployment (GitHub App + webhooks) stays a separate step and reuses the same normalizer;
nothing built locally is discarded.
