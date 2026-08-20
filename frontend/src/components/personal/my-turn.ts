import type { PersonalPr } from '@/types/personal';

export type TurnAction =
  | 'ready_to_merge'
  | 'needs_reviewer'
  | 'fix_ci'
  | 'address_feedback';

export type MyTurnItem = {
  pr: PersonalPr;
  action: TurnAction;
  headline: string;
  detail: string;
};

const ACTION_ORDER: TurnAction[] = [
  'ready_to_merge',
  'needs_reviewer',
  'fix_ci',
  'address_feedback',
];

export function hasReviewer(pr: PersonalPr): boolean {
  return pr.requestedReviewers.length > 0 || pr.reviewerLogins.length > 0;
}

export function changesRequestedCount(pr: PersonalPr): number {
  return pr.reviewRounds.filter(
    (round) => round.outcome === 'changes_requested',
  ).length;
}

export function classifyTurn(
  pr: PersonalPr,
  hasRelayPick: boolean,
): TurnAction | null {
  if (pr.mergedAt || pr.isDraft) {
    return null;
  }
  if (pr.approvedAt) {
    return 'ready_to_merge';
  }
  if (pr.checkState === 'FAILING') {
    return 'fix_ci';
  }
  if (pr.waitingOn === 'AUTHOR') {
    return 'address_feedback';
  }
  if (pr.waitingOn === 'REVIEWER' && !hasReviewer(pr) && !hasRelayPick) {
    return 'needs_reviewer';
  }
  return null;
}

export function describeTurn(pr: PersonalPr, action: TurnAction): MyTurnItem {
  const rounds = changesRequestedCount(pr);
  const lastChange = [...pr.reviewRounds]
    .reverse()
    .find((round) => round.outcome === 'changes_requested');

  if (action === 'ready_to_merge') {
    const approver = pr.reviewRounds.find(
      (round) => round.outcome === 'approved',
    )?.actorLogin;
    return {
      pr,
      action,
      headline: 'Ready to merge',
      detail: approver ? `${approver} approved it` : 'Approved and waiting on you',
    };
  }
  if (action === 'needs_reviewer') {
    return {
      pr,
      action,
      headline: 'Pick a reviewer',
      detail: 'Nobody is looking at this yet',
    };
  }
  if (action === 'fix_ci') {
    return {
      pr,
      action,
      headline: 'Checks are failing',
      detail: 'Review cannot finish until CI is green',
    };
  }
  return {
    pr,
    action,
    headline: rounds > 1 ? `Address feedback (round ${rounds})` : 'Address feedback',
    detail: lastChange?.actorLogin
      ? `${lastChange.actorLogin} requested changes`
      : 'The ball is with you',
  };
}

export function buildMyTurn(
  prs: PersonalPr[],
  hasRelayPick: (pr: PersonalPr) => boolean,
): { mine: MyTurnItem[]; waiting: PersonalPr[] } {
  const mine: MyTurnItem[] = [];
  const waiting: PersonalPr[] = [];

  for (const pr of prs) {
    const action = classifyTurn(pr, hasRelayPick(pr));
    if (action) {
      mine.push(describeTurn(pr, action));
    } else {
      waiting.push(pr);
    }
  }

  mine.sort((a, b) => {
    const byAction =
      ACTION_ORDER.indexOf(a.action) - ACTION_ORDER.indexOf(b.action);
    if (byAction !== 0) {
      return byAction;
    }
    return openedTime(a.pr) - openedTime(b.pr);
  });

  return { mine, waiting };
}

function openedTime(pr: PersonalPr): number {
  return pr.openedAt ? new Date(pr.openedAt).getTime() : Number.MAX_SAFE_INTEGER;
}
