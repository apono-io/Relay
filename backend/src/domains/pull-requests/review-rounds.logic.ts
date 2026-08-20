import { PrEventType } from './pr-enums';

export type ReviewEventRow = {
  type: string;
  actorLogin: string | null;
  state: string | null;
  occurredAt: Date;
};

export type ReviewRoundOutcome = 'changes_requested' | 'approved' | 'commented';

export type ReviewRoundEntry = {
  sequence: number;
  outcome: ReviewRoundOutcome;
  at: Date;
  actorLogin: string | null;
};

export function buildReviewRounds(
  events: ReviewEventRow[],
): ReviewRoundEntry[] {
  const ordered = [...events].sort(
    (a, b) => a.occurredAt.getTime() - b.occurredAt.getTime(),
  );
  const entries: ReviewRoundEntry[] = [];
  let changesRequested = 0;

  for (const event of ordered) {
    if (event.type === PrEventType.REVIEW_DISMISSED) {
      dropApprovals(entries);
      continue;
    }
    if (event.type !== PrEventType.REVIEW_SUBMITTED) {
      continue;
    }
    const state = (event.state ?? 'commented').toLowerCase();
    if (state === 'changes_requested') {
      dropApprovals(entries);
      changesRequested += 1;
      entries.push({
        sequence: changesRequested,
        outcome: 'changes_requested',
        at: event.occurredAt,
        actorLogin: event.actorLogin,
      });
      continue;
    }
    if (state === 'approved') {
      dropApprovals(entries);
      entries.push({
        sequence: 0,
        outcome: 'approved',
        at: event.occurredAt,
        actorLogin: event.actorLogin,
      });
      continue;
    }
    if (!entries.some((entry) => entry.outcome === 'commented')) {
      entries.push({
        sequence: 0,
        outcome: 'commented',
        at: event.occurredAt,
        actorLogin: event.actorLogin,
      });
    }
  }

  return entries;
}

function dropApprovals(entries: ReviewRoundEntry[]): void {
  for (let index = entries.length - 1; index >= 0; index -= 1) {
    if (entries[index].outcome === 'approved') {
      entries.splice(index, 1);
    }
  }
}
