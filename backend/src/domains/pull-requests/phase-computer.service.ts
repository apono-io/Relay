import { Injectable } from '@nestjs/common';
import { PrEvent } from './entities/pr-event.entity';
import { PrEventType, WaitingOn, CheckState } from './pr-enums';

export type WaitRound = {
  round: number;
  reviewerWaitSeconds: number | null;
  authorWaitSeconds: number | null;
};

export type ComputedPhases = {
  firstCommitAt?: Date;
  openedAt?: Date;
  readyAt?: Date;
  firstReviewAt?: Date;
  approvedAt?: Date;
  lastCommitAt?: Date;
  mergedAt?: Date;
  closedAt?: Date;

  codingTime?: number;
  pickupTime?: number;
  reworkTime?: number;
  mergeTime?: number;
  cycleTime?: number;
  leadTime?: number;

  reviewerWaitTime?: number;
  authorWaitTime?: number;
  waitRounds: WaitRound[];
  reworkCycles: number;

  reviewCommentCount: number;
  approvedWithZeroComments: boolean;
  checkState?: CheckState;

  waitingOn: WaitingOn;
  requestedReviewers: string[];
  reviewDueAt?: Date;
};

type ReviewState = 'approved' | 'changes_requested' | 'commented';

const seconds = (from: Date, to: Date): number => (to.getTime() - from.getTime()) / 1000;
const nonNegative = (value: number): number => (value < 0 ? 0 : value);

@Injectable()
export class PhaseComputer {
  compute(events: PrEvent[], defaultSlaMinutes: number): ComputedPhases {
    const ordered = [...events].sort((a, b) => a.occurredAt.getTime() - b.occurredAt.getTime());

    const openedAt = this.firstTime(ordered, PrEventType.PR_OPENED);
    const openedDraft = this.openedAsDraft(ordered);
    const readyTransitions = this.readyTransitions(ordered, openedAt, openedDraft);
    const { firstCommitAt, lastCommitAt } = this.commitBounds(ordered);
    const mergedAt = this.firstTime(ordered, PrEventType.PR_MERGED);
    const closedAt = this.firstTime(ordered, PrEventType.PR_CLOSED);

    const firstCountedReview = this.firstCountedReview(ordered, readyTransitions);
    const readyAt = this.readyAtForPickup(readyTransitions, firstCountedReview?.occurredAt);
    const firstReviewAt = firstCountedReview?.occurredAt;

    const rounds = this.walkWaitRounds(ordered, readyAt);
    const approvedAt = this.standingApprovalAt(ordered);
    const reworkCycles = this.countChangesRequested(ordered, readyAt);
    const requestedReviewers = this.finalRequestedReviewers(ordered);
    const checkState = this.latestCheckState(ordered);
    const reviewCommentCount = this.countComments(ordered);

    const pickupTime =
      readyAt && firstReviewAt
        ? nonNegative(seconds(readyAt, firstReviewAt))
        : this.hadOnlyPreReadyReview(ordered, readyTransitions)
          ? 0
          : undefined;

    const reworkTime =
      firstReviewAt && lastCommitAt ? nonNegative(seconds(firstReviewAt, lastCommitAt)) : firstReviewAt ? 0 : undefined;

    const codingTime = firstCommitAt && openedAt ? nonNegative(seconds(firstCommitAt, openedAt)) : undefined;
    const mergeTime = approvedAt && mergedAt ? nonNegative(seconds(approvedAt, mergedAt)) : undefined;
    const cycleTime = openedAt && mergedAt ? nonNegative(seconds(openedAt, mergedAt)) : undefined;
    const leadTime = firstCommitAt && mergedAt ? nonNegative(seconds(firstCommitAt, mergedAt)) : undefined;

    const reviewerWaitTime = this.sum(rounds.map((r) => r.reviewerWaitSeconds));
    const authorWaitTime = this.sum(rounds.map((r) => r.authorWaitSeconds));

    const waitingOn = this.computeWaitingOnState(ordered, readyAt, mergedAt, closedAt, checkState);
    const reviewDueAt =
      waitingOn === WaitingOn.REVIEWER ? this.reviewDueAt(rounds, readyAt, ordered, defaultSlaMinutes) : undefined;

    const approvedWithZeroComments = !!approvedAt && reviewCommentCount === 0 && reworkCycles === 0;

    return {
      firstCommitAt,
      openedAt,
      readyAt,
      firstReviewAt,
      approvedAt,
      lastCommitAt,
      mergedAt,
      closedAt,
      codingTime,
      pickupTime,
      reworkTime,
      mergeTime,
      cycleTime,
      leadTime,
      reviewerWaitTime,
      authorWaitTime,
      waitRounds: rounds,
      reworkCycles,
      reviewCommentCount,
      approvedWithZeroComments,
      checkState,
      waitingOn,
      requestedReviewers,
      reviewDueAt,
    };
  }

  computeWaitRounds(events: PrEvent[]): WaitRound[] {
    const ordered = [...events].sort((a, b) => a.occurredAt.getTime() - b.occurredAt.getTime());
    const openedAt = this.firstTime(ordered, PrEventType.PR_OPENED);
    const readyTransitions = this.readyTransitions(ordered, openedAt, this.openedAsDraft(ordered));
    const firstCountedReview = this.firstCountedReview(ordered, readyTransitions);
    const readyAt = this.readyAtForPickup(readyTransitions, firstCountedReview?.occurredAt);
    return this.walkWaitRounds(ordered, readyAt);
  }

  computeWaitingOn(events: PrEvent[]): WaitingOn {
    const ordered = [...events].sort((a, b) => a.occurredAt.getTime() - b.occurredAt.getTime());
    const openedAt = this.firstTime(ordered, PrEventType.PR_OPENED);
    const readyTransitions = this.readyTransitions(ordered, openedAt, this.openedAsDraft(ordered));
    const firstCountedReview = this.firstCountedReview(ordered, readyTransitions);
    const readyAt = this.readyAtForPickup(readyTransitions, firstCountedReview?.occurredAt);
    const mergedAt = this.firstTime(ordered, PrEventType.PR_MERGED);
    const closedAt = this.firstTime(ordered, PrEventType.PR_CLOSED);
    return this.computeWaitingOnState(ordered, readyAt, mergedAt, closedAt, this.latestCheckState(ordered));
  }

  private firstTime(events: PrEvent[], type: PrEventType): Date | undefined {
    return events.find((e) => e.type === type)?.occurredAt;
  }

  private openedAsDraft(events: PrEvent[]): boolean {
    const opened = events.find((e) => e.type === PrEventType.PR_OPENED);
    return !!opened?.payload?.isDraft;
  }

  private readyTransitions(events: PrEvent[], openedAt: Date | undefined, openedDraft: boolean): Date[] {
    const transitions: Date[] = [];
    if (openedAt && !openedDraft) {
      transitions.push(openedAt);
    }
    for (const e of events) {
      if (e.type === PrEventType.PR_READY_FOR_REVIEW) {
        transitions.push(e.occurredAt);
      }
    }
    return transitions;
  }

  private isReadyAt(readyTransitions: Date[], at: Date): boolean {
    return readyTransitions.some((t) => t.getTime() <= at.getTime());
  }

  private firstCountedReview(events: PrEvent[], readyTransitions: Date[]): PrEvent | undefined {
    return events.find(
      (e) => e.type === PrEventType.REVIEW_SUBMITTED && this.isReadyAt(readyTransitions, e.occurredAt),
    );
  }

  private hadOnlyPreReadyReview(events: PrEvent[], readyTransitions: Date[]): boolean {
    const reviews = events.filter((e) => e.type === PrEventType.REVIEW_SUBMITTED);
    return reviews.length > 0 && !reviews.some((e) => this.isReadyAt(readyTransitions, e.occurredAt));
  }

  private readyAtForPickup(readyTransitions: Date[], firstReviewAt?: Date): Date | undefined {
    if (readyTransitions.length === 0) {
      return undefined;
    }
    if (!firstReviewAt) {
      return readyTransitions[0];
    }
    const before = readyTransitions.filter((t) => t.getTime() <= firstReviewAt.getTime());
    return before.length ? before[before.length - 1] : readyTransitions[0];
  }

  private commitBounds(events: PrEvent[]): { firstCommitAt?: Date; lastCommitAt?: Date } {
    const commits = events.filter((e) => e.type === PrEventType.COMMIT_PUSHED);
    if (commits.length === 0) {
      return {};
    }
    const authored = commits.map((e) => this.payloadDate(e, 'authoredDate') ?? e.occurredAt);
    const pushed = commits.map((e) => this.payloadDate(e, 'pushedDate') ?? e.occurredAt);
    return {
      firstCommitAt: new Date(Math.min(...authored.map((d) => d.getTime()))),
      lastCommitAt: new Date(Math.max(...pushed.map((d) => d.getTime()))),
    };
  }

  private walkWaitRounds(events: PrEvent[], readyAt?: Date): WaitRound[] {
    if (!readyAt) {
      return [];
    }
    const rounds: WaitRound[] = [];
    let round = 1;
    let reviewerStart: Date | undefined = readyAt;
    let authorStart: Date | undefined;
    let current: WaitRound = { round, reviewerWaitSeconds: null, authorWaitSeconds: null };

    for (const e of events) {
      if (e.occurredAt.getTime() < readyAt.getTime()) {
        continue;
      }
      if (e.type === PrEventType.REVIEW_SUBMITTED) {
        if (reviewerStart) {
          current.reviewerWaitSeconds = nonNegative(seconds(reviewerStart, e.occurredAt));
          reviewerStart = undefined;
        }
        if (this.reviewState(e) === 'changes_requested') {
          authorStart = e.occurredAt;
          rounds.push(current);
          round += 1;
          current = { round, reviewerWaitSeconds: null, authorWaitSeconds: null };
        }
      } else if (
        (e.type === PrEventType.COMMIT_PUSHED || e.type === PrEventType.REVIEW_REQUESTED) &&
        authorStart
      ) {
        current.authorWaitSeconds = nonNegative(seconds(authorStart, e.occurredAt));
        authorStart = undefined;
        reviewerStart = e.occurredAt;
      }
    }
    rounds.push(current);
    return rounds.filter((r) => r.reviewerWaitSeconds !== null || r.authorWaitSeconds !== null);
  }

  private countChangesRequested(events: PrEvent[], readyAt?: Date): number {
    return events.filter(
      (e) =>
        e.type === PrEventType.REVIEW_SUBMITTED &&
        this.reviewState(e) === 'changes_requested' &&
        (!readyAt || e.occurredAt.getTime() >= readyAt.getTime()),
    ).length;
  }

  private standingApprovalAt(events: PrEvent[]): Date | undefined {
    let standing: Date | undefined;
    for (const e of events) {
      if (e.type === PrEventType.REVIEW_SUBMITTED && this.reviewState(e) === 'approved') {
        standing = e.occurredAt;
      } else if (e.type === PrEventType.REVIEW_DISMISSED) {
        standing = undefined;
      }
    }
    return standing;
  }

  private finalRequestedReviewers(events: PrEvent[]): string[] {
    const set = new Set<string>();
    for (const e of events) {
      const reviewer = (e.payload?.reviewer as string) || e.actorLogin;
      if (e.type === PrEventType.REVIEW_REQUESTED && reviewer) {
        set.add(reviewer);
      } else if (e.type === PrEventType.REVIEW_REQUEST_REMOVED && reviewer) {
        set.delete(reviewer);
      }
    }
    return [...set];
  }

  private latestCheckState(events: PrEvent[]): CheckState | undefined {
    const checks = events.filter((e) => e.type === PrEventType.CHECK_STATE_CHANGED);
    const last = checks[checks.length - 1];
    return last ? ((last.payload?.state as CheckState) ?? undefined) : undefined;
  }

  private countComments(events: PrEvent[]): number {
    return events.filter((e) => e.type === PrEventType.COMMENT).length;
  }

  private computeWaitingOnState(
    events: PrEvent[],
    readyAt: Date | undefined,
    mergedAt: Date | undefined,
    closedAt: Date | undefined,
    checkState: CheckState | undefined,
  ): WaitingOn {
    if (mergedAt || closedAt || !readyAt) {
      return WaitingOn.NONE;
    }
    const rounds = this.walkWaitRounds(events, readyAt);
    const last = rounds[rounds.length - 1];
    if (last && last.reviewerWaitSeconds === null && last.authorWaitSeconds === null) {
      return checkState === CheckState.FAILING ? WaitingOn.CI : WaitingOn.REVIEWER;
    }
    if (last && last.reviewerWaitSeconds !== null && last.authorWaitSeconds === null) {
      return checkState === CheckState.FAILING ? WaitingOn.CI : WaitingOn.AUTHOR;
    }
    if (this.standingApprovalAt(events)) {
      return WaitingOn.NONE;
    }
    return WaitingOn.REVIEWER;
  }

  private reviewDueAt(
    rounds: WaitRound[],
    readyAt: Date | undefined,
    events: PrEvent[],
    defaultSlaMinutes: number,
  ): Date | undefined {
    const start = this.currentReviewerWaitStart(events, readyAt);
    if (!start) {
      return undefined;
    }
    return new Date(start.getTime() + defaultSlaMinutes * 60 * 1000);
  }

  private currentReviewerWaitStart(events: PrEvent[], readyAt?: Date): Date | undefined {
    if (!readyAt) {
      return undefined;
    }
    let start: Date | undefined = readyAt;
    let authorStart: Date | undefined;
    for (const e of events) {
      if (e.occurredAt.getTime() < readyAt.getTime()) {
        continue;
      }
      if (e.type === PrEventType.REVIEW_SUBMITTED) {
        start = undefined;
        if (this.reviewState(e) === 'changes_requested') {
          authorStart = e.occurredAt;
        }
      } else if ((e.type === PrEventType.COMMIT_PUSHED || e.type === PrEventType.REVIEW_REQUESTED) && authorStart) {
        authorStart = undefined;
        start = e.occurredAt;
      }
    }
    return start;
  }

  private reviewState(e: PrEvent): ReviewState {
    return (e.payload?.state as ReviewState) ?? 'commented';
  }

  private payloadDate(e: PrEvent, key: string): Date | undefined {
    const raw = e.payload?.[key];
    return raw ? new Date(raw as string) : undefined;
  }

  private sum(values: (number | null)[]): number {
    let total = 0;
    for (const v of values) {
      total += v ?? 0;
    }
    return total;
  }
}
