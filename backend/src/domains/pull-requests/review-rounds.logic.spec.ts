import { buildReviewRounds, ReviewEventRow } from './review-rounds.logic';
import { PrEventType } from './pr-enums';

function review(
  state: string,
  minutes: number,
  actorLogin = 'reviewer',
): ReviewEventRow {
  return {
    type: PrEventType.REVIEW_SUBMITTED,
    actorLogin,
    state,
    occurredAt: new Date(Date.UTC(2026, 0, 1, 0, minutes)),
  };
}

function dismissal(minutes: number): ReviewEventRow {
  return {
    type: PrEventType.REVIEW_DISMISSED,
    actorLogin: 'reviewer',
    state: 'dismissed',
    occurredAt: new Date(Date.UTC(2026, 0, 1, 0, minutes)),
  };
}

describe('buildReviewRounds', () => {
  it('returns nothing when no review has happened', () => {
    expect(buildReviewRounds([])).toEqual([]);
  });

  it('numbers each changes-requested review in order', () => {
    const rounds = buildReviewRounds([
      review('changes_requested', 10),
      review('changes_requested', 30),
    ]);
    expect(rounds.map((round) => [round.outcome, round.sequence])).toEqual([
      ['changes_requested', 1],
      ['changes_requested', 2],
    ]);
  });

  it('places the approval after the changes-requested rounds', () => {
    const rounds = buildReviewRounds([
      review('changes_requested', 10),
      review('approved', 40),
    ]);
    expect(rounds.map((round) => round.outcome)).toEqual([
      'changes_requested',
      'approved',
    ]);
  });

  it('sorts events that arrive out of order', () => {
    const rounds = buildReviewRounds([
      review('approved', 40),
      review('changes_requested', 10),
    ]);
    expect(rounds.map((round) => round.outcome)).toEqual([
      'changes_requested',
      'approved',
    ]);
  });

  it('drops an approval that was later dismissed', () => {
    const rounds = buildReviewRounds([review('approved', 10), dismissal(20)]);
    expect(rounds).toEqual([]);
  });

  it('keeps a re-approval that follows a dismissal', () => {
    const rounds = buildReviewRounds([
      review('approved', 10),
      dismissal(20),
      review('approved', 30),
    ]);
    expect(rounds.map((round) => round.outcome)).toEqual(['approved']);
    expect(rounds[0].at).toEqual(new Date(Date.UTC(2026, 0, 1, 0, 30)));
  });

  it('keeps only the first comment-only review', () => {
    const rounds = buildReviewRounds([
      review('commented', 10),
      review('commented', 20),
    ]);
    expect(rounds).toHaveLength(1);
    expect(rounds[0].outcome).toBe('commented');
    expect(rounds[0].at).toEqual(new Date(Date.UTC(2026, 0, 1, 0, 10)));
  });

  it('treats a missing state as a comment', () => {
    const rounds = buildReviewRounds([
      {
        type: PrEventType.REVIEW_SUBMITTED,
        actorLogin: 'reviewer',
        state: null,
        occurredAt: new Date(Date.UTC(2026, 0, 1, 0, 5)),
      },
    ]);
    expect(rounds.map((round) => round.outcome)).toEqual(['commented']);
  });

  it('normalizes an uppercase state from the payload', () => {
    const rounds = buildReviewRounds([review('CHANGES_REQUESTED', 10)]);
    expect(rounds.map((round) => round.outcome)).toEqual(['changes_requested']);
  });

  it('records who left each review', () => {
    const rounds = buildReviewRounds([
      review('changes_requested', 10, 'adi'),
      review('approved', 20, 'tomer'),
    ]);
    expect(rounds.map((round) => round.actorLogin)).toEqual(['adi', 'tomer']);
  });

  it('drops an approval that a later changes-requested review superseded', () => {
    const rounds = buildReviewRounds([
      review('approved', 10, 'adi'),
      review('changes_requested', 20, 'tomer'),
      review('changes_requested', 30, 'tomer'),
    ]);
    expect(rounds.map((round) => [round.outcome, round.sequence])).toEqual([
      ['changes_requested', 1],
      ['changes_requested', 2],
    ]);
  });

  it('keeps an approval that comes after the last changes-requested review', () => {
    const rounds = buildReviewRounds([
      review('changes_requested', 10),
      review('approved', 20),
    ]);
    expect(rounds.map((round) => round.outcome)).toEqual([
      'changes_requested',
      'approved',
    ]);
  });

  it('keeps a later changes-requested round after an approval was dismissed', () => {
    const rounds = buildReviewRounds([
      review('approved', 10),
      dismissal(15),
      review('changes_requested', 20),
    ]);
    expect(rounds.map((round) => [round.outcome, round.sequence])).toEqual([
      ['changes_requested', 1],
    ]);
  });
});
