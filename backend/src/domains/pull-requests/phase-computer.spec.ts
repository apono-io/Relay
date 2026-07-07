import { PhaseComputer } from './phase-computer.service';
import { PrEvent } from './entities/pr-event.entity';
import { PrEventType, PrEventSource, WaitingOn, CheckState } from './pr-enums';

const T0 = new Date('2026-01-01T00:00:00Z');
const h = (n: number): Date => new Date(T0.getTime() + n * 3600 * 1000);

let seq = 0;
function ev(
  type: PrEventType,
  occurredAt: Date,
  payload: Record<string, unknown> = {},
  actorLogin = 'author',
): PrEvent {
  seq += 1;
  return {
    id: `e${seq}`,
    prId: 'pr1',
    type,
    actorLogin,
    payload,
    occurredAt,
    source: PrEventSource.BACKFILL,
    externalId: `x${seq}`,
    createdAt: occurredAt,
  } as PrEvent;
}

const SLA = 120;

describe('PhaseComputer', () => {
  let computer: PhaseComputer;

  beforeEach(() => {
    computer = new PhaseComputer();
  });

  it('is defined', () => {
    expect(computer).toBeDefined();
  });

  it('computes pickup_time as the first Reviewer Wait round (ready_at -> first review)', () => {
    const events = [
      ev(PrEventType.PR_OPENED, h(0), { isDraft: false }),
      ev(PrEventType.REVIEW_SUBMITTED, h(2), { state: 'approved' }, 'reviewer'),
    ];
    const result = computer.compute(events, SLA);
    expect(result.pickupTime).toBe(7200);
    expect(result.waitRounds[0].reviewerWaitSeconds).toBe(7200);
  });

  it('splits Rework into per-round Reviewer Wait and Author Wait', () => {
    const events = [
      ev(PrEventType.PR_OPENED, h(0), { isDraft: false }),
      ev(PrEventType.REVIEW_SUBMITTED, h(2), { state: 'changes_requested' }, 'reviewer'),
      ev(PrEventType.COMMIT_PUSHED, h(5), { authoredDate: h(5).toISOString(), pushedDate: h(5).toISOString() }),
      ev(PrEventType.REVIEW_SUBMITTED, h(6), { state: 'approved' }, 'reviewer'),
    ];
    const result = computer.compute(events, SLA);
    expect(result.waitRounds[0].reviewerWaitSeconds).toBe(7200);
    expect(result.waitRounds[1].authorWaitSeconds).toBe(3 * 3600);
    expect(result.waitRounds[1].reviewerWaitSeconds).toBe(3600);
    expect(result.reviewerWaitTime).toBe(7200 + 3600);
    expect(result.authorWaitTime).toBe(3 * 3600);
  });

  it('counts a review submitted while draft as not started until ready_at', () => {
    const events = [
      ev(PrEventType.PR_OPENED, h(0), { isDraft: true }),
      ev(PrEventType.REVIEW_SUBMITTED, h(1), { state: 'commented' }, 'reviewer'),
      ev(PrEventType.PR_READY_FOR_REVIEW, h(2)),
      ev(PrEventType.REVIEW_SUBMITTED, h(3), { state: 'approved' }, 'reviewer'),
    ];
    const result = computer.compute(events, SLA);
    expect(result.readyAt).toEqual(h(2));
    expect(result.firstReviewAt).toEqual(h(3));
    expect(result.pickupTime).toBe(3600);
  });

  it('never produces a negative pickup_time when the only review was pre-ready', () => {
    const events = [
      ev(PrEventType.PR_OPENED, h(0), { isDraft: true }),
      ev(PrEventType.REVIEW_SUBMITTED, h(1), { state: 'commented' }, 'reviewer'),
    ];
    const result = computer.compute(events, SLA);
    expect(result.pickupTime).toBe(0);
  });

  it('does not count draft time as waiting for a ready -> draft -> ready PR', () => {
    const events = [
      ev(PrEventType.PR_OPENED, h(0), { isDraft: true }),
      ev(PrEventType.PR_READY_FOR_REVIEW, h(1)),
      ev(PrEventType.PR_CONVERTED_TO_DRAFT, h(2)),
      ev(PrEventType.PR_READY_FOR_REVIEW, h(3)),
      ev(PrEventType.REVIEW_SUBMITTED, h(4), { state: 'approved' }, 'reviewer'),
    ];
    const result = computer.compute(events, SLA);
    expect(result.readyAt).toEqual(h(3));
    expect(result.pickupTime).toBe(3600);
  });

  it('sets pickup_time to null for a self-merged PR with no reviewer', () => {
    const events = [
      ev(PrEventType.PR_OPENED, h(0), { isDraft: false }),
      ev(PrEventType.PR_MERGED, h(1)),
    ];
    const result = computer.compute(events, SLA);
    expect(result.pickupTime).toBeUndefined();
    expect(result.cycleTime).toBe(3600);
  });

  it('clamps rework_time to 0 when approved with no further commits', () => {
    const events = [
      ev(PrEventType.COMMIT_PUSHED, h(0), { authoredDate: h(0).toISOString(), pushedDate: h(0).toISOString() }),
      ev(PrEventType.PR_OPENED, h(0), { isDraft: false }),
      ev(PrEventType.REVIEW_SUBMITTED, h(2), { state: 'approved' }, 'reviewer'),
    ];
    const result = computer.compute(events, SLA);
    expect(result.reworkTime).toBe(0);
  });

  it('excludes merge_time when merged without a standing approval (dismissed)', () => {
    const events = [
      ev(PrEventType.PR_OPENED, h(0), { isDraft: false }),
      ev(PrEventType.REVIEW_SUBMITTED, h(1), { state: 'approved' }, 'reviewer'),
      ev(PrEventType.REVIEW_DISMISSED, h(2), {}, 'reviewer'),
      ev(PrEventType.PR_MERGED, h(3)),
    ];
    const result = computer.compute(events, SLA);
    expect(result.approvedAt).toBeUndefined();
    expect(result.mergeTime).toBeUndefined();
  });

  it('uses the last standing approval at merge for approved_at', () => {
    const events = [
      ev(PrEventType.PR_OPENED, h(0), { isDraft: false }),
      ev(PrEventType.REVIEW_SUBMITTED, h(1), { state: 'approved' }, 'reviewer'),
      ev(PrEventType.REVIEW_DISMISSED, h(2), {}, 'reviewer'),
      ev(PrEventType.REVIEW_SUBMITTED, h(3), { state: 'approved' }, 'reviewer'),
      ev(PrEventType.PR_MERGED, h(4)),
    ];
    const result = computer.compute(events, SLA);
    expect(result.approvedAt).toEqual(h(3));
    expect(result.mergeTime).toBe(3600);
  });

  it('uses earliest authored commit and latest pushed commit (rebase safe)', () => {
    const events = [
      ev(PrEventType.COMMIT_PUSHED, h(5), { authoredDate: h(0).toISOString(), pushedDate: h(5).toISOString() }),
      ev(PrEventType.COMMIT_PUSHED, h(6), { authoredDate: h(1).toISOString(), pushedDate: h(6).toISOString() }),
      ev(PrEventType.PR_OPENED, h(6), { isDraft: false }),
    ];
    const result = computer.compute(events, SLA);
    expect(result.firstCommitAt).toEqual(h(0));
    expect(result.lastCommitAt).toEqual(h(6));
  });

  it('counts each changes-requested -> re-review loop as one rework cycle', () => {
    const events = [
      ev(PrEventType.PR_OPENED, h(0), { isDraft: false }),
      ev(PrEventType.REVIEW_SUBMITTED, h(1), { state: 'changes_requested' }, 'reviewer'),
      ev(PrEventType.COMMIT_PUSHED, h(2), { authoredDate: h(2).toISOString(), pushedDate: h(2).toISOString() }),
      ev(PrEventType.REVIEW_SUBMITTED, h(3), { state: 'changes_requested' }, 'reviewer'),
      ev(PrEventType.COMMIT_PUSHED, h(4), { authoredDate: h(4).toISOString(), pushedDate: h(4).toISOString() }),
      ev(PrEventType.REVIEW_SUBMITTED, h(5), { state: 'approved' }, 'reviewer'),
    ];
    const result = computer.compute(events, SLA);
    expect(result.reworkCycles).toBe(2);
  });

  it('ends a Reviewer Wait round at the first review from any requested reviewer', () => {
    const events = [
      ev(PrEventType.PR_OPENED, h(0), { isDraft: false }),
      ev(PrEventType.REVIEW_REQUESTED, h(0), { reviewer: 'alice' }),
      ev(PrEventType.REVIEW_REQUESTED, h(0), { reviewer: 'bob' }),
      ev(PrEventType.REVIEW_SUBMITTED, h(2), { state: 'approved' }, 'bob'),
    ];
    const result = computer.compute(events, SLA);
    expect(result.pickupTime).toBe(7200);
  });

  it('reflects the latest check state', () => {
    const events = [
      ev(PrEventType.PR_OPENED, h(0), { isDraft: false }),
      ev(PrEventType.CHECK_STATE_CHANGED, h(1), { state: CheckState.PENDING }),
      ev(PrEventType.CHECK_STATE_CHANGED, h(2), { state: CheckState.PASSING }),
    ];
    const result = computer.compute(events, SLA);
    expect(result.checkState).toBe(CheckState.PASSING);
  });

  it('derives waiting_on and review_due_at for an open unreviewed PR', () => {
    const events = [ev(PrEventType.PR_OPENED, h(0), { isDraft: false })];
    const result = computer.compute(events, SLA);
    expect(result.waitingOn).toBe(WaitingOn.REVIEWER);
    expect(result.reviewDueAt).toEqual(new Date(h(0).getTime() + SLA * 60 * 1000));
  });

  it('marks author-waiting after a changes-requested review', () => {
    const events = [
      ev(PrEventType.PR_OPENED, h(0), { isDraft: false }),
      ev(PrEventType.REVIEW_SUBMITTED, h(1), { state: 'changes_requested' }, 'reviewer'),
    ];
    const result = computer.compute(events, SLA);
    expect(result.waitingOn).toBe(WaitingOn.AUTHOR);
  });
});
