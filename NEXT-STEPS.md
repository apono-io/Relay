# Relay — current state and roadmap

Updated 2026-07-30. The scaffold-era build order is done; this file now tracks what the
app does, what is still open, and the order of the next features.

## Where the app stands

Phase 1 (baseline + live pipeline + dashboard) is complete, and several Phase-2 pieces
landed early. Everything below is built, tested, and running locally under Tilt.

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
| GitHub OAuth linking flow | code-complete; needs a GitHub OAuth App (`GITHUB_OAUTH_CLIENT_ID/SECRET`) |
| Assignment slice 1: PR file paths ingested + history backfilled | done |
| Assignment slice 2: repos in System settings (add with GitHub validation), per-repo area rules auto-seeded + editable | done |
| Assignment slice 3: mastery index, deterministic engine (TDD), quiet-phase recording, admin comparison panel | done |
| Assignment slices 4–5 in shadow mode: personal modes (off/hybrid/auto), Assign-reviewer button, auto-assign after grace window, reviewer→author pairs on every row | done — the "Actually assign" toggle (System settings, default off) keeps every assignment app-only ("test") until the team trusts it |
| Assignment polish: a submitted review counts as engagement (no assign over an active review), actual reviewers shown on in-progress and merged rows, Approved chip once review is done, multi-reviewer pairs, per-pick "why" explanation, reset-assignment control | done |
| Assignment hardening: repeat-pick damping (no back-to-back picks while someone comparable is free), race-safe atomic claim with GitHub rollback, self-review/duplicate-review stats fixes, honest reason phrases, NaN-safe config reads, full unit coverage of the actions service | done — 161 backend tests |

Known limits:

- A token already issued keeps its role for up to one day; deactivating a person blocks
  the next sign-in, not the current session.
- Webhooks exist only as the deployed path; locally the 1-minute gap-fill is the live
  mechanism.
- The GitHub PAT is read-only, so Relay cannot write anything back to GitHub yet
  (that changes with assignment, below).

## Roadmap — next three features, in order

The three candidate features (Slack integration, smart assignment, assignment triggers)
are one track: pick a reviewer, let the developer control it, deliver it where people
live. The full design is fixed in
`docs/PR app SPEC/2026-07-29-smart-assignment-and-interaction-model.md`; the summary:

### 1. Smart assignment engine — deterministic, no AI — SLICES 1–3 SHIPPED

Auto-assignment **is** the interface: PR opens → grace window → Relay requests a
reviewer → the reviewer gets a native GitHub notification. No new habits. The engine
crosses out ineligible people (active, mode not off, identity-linked, not the author),
then sorts by who knows the area (from PR history — no git blame), who is free now, and
who reviewed least in 14 days, with admin-configured weights. A private per-area risk
level (admin table **per repository**, auto-seeded from folder structure) shifts the
weights; no score or risk value is ever shown to developers — a suggestion is a name
plus one reason sentence.

Built so far: file-path ingestion (slice 1), repositories + area rules in System
settings (slice 2), and the engine itself running **quiet** (slice 3) — a sweep every
five minutes records the pick Relay would make for every reviewer-less PR into the
`suggestions` table, resolves what the team actually did, and a System-settings panel
compares the two. Nothing is written to GitHub; the PAT stays read-only.

The quiet phase needs two things to become meaningful: activate the real roster in
People (only active people are candidates), and let it run for a while before judging
the agreement rate.

### 2. Personal control — suggestions for everyone, assignment by mode

The engine always generates suggestions for reviewer-less PRs; the personal setting
only controls whether Relay acts. `person_settings.assignmentMode`: **off** (default —
suggestions only), **hybrid** (Relay assigns when the developer triggers it: the Assign
button or an `@relay assign` comment), **auto** (Relay assigns by itself after the grace
window). Relay only ever acts on a PR that has no requested reviewer — pick your own
reviewer and Relay stays out. `@relay skip` blocks a single PR in auto mode.
The web UI gives developers visibility when they want it and their settings; admins
additionally manage people, permissions, area rules, weights, and integrations.

### 3. Slack integration

Slack is the delivery channel, and it multiplies the value of everything above — but it
is the only feature that needs new external infrastructure (a Slack app, bot token,
`users.lookupByEmail`). Scope for the first slice:

- Resolve person → Slack user by email; cache in `person_settings.slackUserId`.
- Nudge DM when a PR crosses the review-SLA while waiting on a reviewer, on **every**
  review round, honoring `nudgesEnabled` and `Person.active`.
- Message actions: "On it", "Reassign" (calls the assignment engine), "Mute today".
- A daily team-channel digest of the stalled section is the cheap second message type.

The identity chain (stuck PR → login → person → email → Slack user) exists end to end
today; a nudge for an unresolved login degrades to a roster-report entry.

## Deliberately still out

No AI-based assignment (deterministic signals first — measure before adding models), no
manager views, no per-team SLA policies (first version is per person), no deployment.
Deployment (GitHub App + webhooks) stays a separate step and reuses the same normalizer;
nothing built locally is discarded.
