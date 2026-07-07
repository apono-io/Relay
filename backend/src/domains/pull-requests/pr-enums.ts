import { registerEnumType } from '@nestjs/graphql';

export enum PrEventType {
  PR_OPENED = 'pr_opened',
  PR_READY_FOR_REVIEW = 'pr_ready_for_review',
  PR_CONVERTED_TO_DRAFT = 'pr_converted_to_draft',
  REVIEW_REQUESTED = 'review_requested',
  REVIEW_REQUEST_REMOVED = 'review_request_removed',
  REVIEW_SUBMITTED = 'review_submitted',
  REVIEW_DISMISSED = 'review_dismissed',
  COMMIT_PUSHED = 'commit_pushed',
  CHECK_STATE_CHANGED = 'check_state_changed',
  COMMENT = 'comment',
  PR_MERGED = 'pr_merged',
  PR_CLOSED = 'pr_closed',
}

export enum PrEventSource {
  WEBHOOK = 'webhook',
  BACKFILL = 'backfill',
  GAP_FILL = 'gap_fill',
}

export enum PrState {
  OPEN = 'open',
  MERGED = 'merged',
  CLOSED = 'closed',
}

export enum WaitingOn {
  AUTHOR = 'author',
  REVIEWER = 'reviewer',
  CI = 'ci',
  NONE = 'none',
}

export enum CheckState {
  PENDING = 'pending',
  PASSING = 'passing',
  FAILING = 'failing',
}

export enum PrSize {
  XS = 'XS',
  S = 'S',
  M = 'M',
  L = 'L',
  XL = 'XL',
}

registerEnumType(PrEventType, { name: 'PrEventType' });
registerEnumType(PrEventSource, { name: 'PrEventSource' });
registerEnumType(PrState, { name: 'PrState' });
registerEnumType(WaitingOn, { name: 'WaitingOn' });
registerEnumType(CheckState, { name: 'CheckState' });
registerEnumType(PrSize, { name: 'PrSize' });
