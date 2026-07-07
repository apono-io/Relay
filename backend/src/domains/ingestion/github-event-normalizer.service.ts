import { Injectable } from '@nestjs/common';
import { PrEventType, PrEventSource } from '@/domains/pull-requests/pr-enums';

export type NormalizedEvent = {
  repo: string;
  prNumber: number;
  prNodeId?: string;
  type: PrEventType;
  actorLogin?: string;
  payload?: Record<string, unknown>;
  occurredAt: Date;
  source: PrEventSource;
  externalId: string;
};

export type NormalizedPullRequest = {
  repo: string;
  number: number;
  nodeId: string;
  title: string;
  url: string;
  authorLogin: string;
  isDraft: boolean;
  isBot: boolean;
  isRevert: boolean;
};

export type BackfillResult = {
  pullRequest: NormalizedPullRequest;
  events: NormalizedEvent[];
};

type ExternalIdInput =
  | { kind: 'review'; nodeId: string }
  | { kind: 'comment'; nodeId: string }
  | { kind: 'commit'; sha: string }
  | { kind: 'check'; suiteNodeId: string; headSha: string }
  | { kind: 'pr-lifecycle'; prNodeId: string; type: PrEventType }
  | { kind: 'pr-transition'; prNodeId: string; type: PrEventType; occurredAt: Date }
  | { kind: 'review-request'; prNodeId: string; type: PrEventType; reviewer: string; occurredAt: Date };

const iso = (value: unknown): Date => new Date(value as string);
const isBotLogin = (login: string | undefined): boolean => !!login && login.endsWith('[bot]');
const looksLikeRevert = (title: string): boolean => /^revert\b/i.test(title.trim());

@Injectable()
export class GithubEventNormalizer {
  buildExternalId(input: ExternalIdInput): string {
    switch (input.kind) {
      case 'review':
        return `review:${input.nodeId}`;
      case 'comment':
        return `comment:${input.nodeId}`;
      case 'commit':
        return `commit:${input.sha}`;
      case 'check':
        return `check:${input.suiteNodeId}:${input.headSha}`;
      case 'pr-lifecycle':
        return `pr:${input.prNodeId}:${input.type}`;
      case 'pr-transition':
        return `pr:${input.prNodeId}:${input.type}:${input.occurredAt.toISOString()}`;
      case 'review-request':
        return `pr:${input.prNodeId}:${input.type}:${input.reviewer}:${input.occurredAt.toISOString()}`;
    }
  }

  normalizeWebhook(deliveryType: string, payload: Record<string, any>): NormalizedEvent[] {
    switch (deliveryType) {
      case 'pull_request':
        return this.webhookPullRequest(payload);
      case 'pull_request_review':
        return this.webhookReview(payload);
      case 'pull_request_review_comment':
      case 'issue_comment':
        return this.webhookComment(payload);
      case 'push':
        return this.webhookPush(payload);
      case 'check_suite':
        return this.webhookCheckSuite(payload);
      default:
        return [];
    }
  }

  normalizeBackfillNode(repo: string, prNode: Record<string, any>): BackfillResult {
    const prNodeId = prNode.id as string;
    const prNumber = prNode.number as number;
    const authorLogin = prNode.author?.login ?? 'unknown';
    const base = { repo, prNumber, prNodeId, source: PrEventSource.BACKFILL };

    const events: NormalizedEvent[] = [];

    events.push({
      ...base,
      type: PrEventType.PR_OPENED,
      actorLogin: authorLogin,
      payload: { isDraft: !!prNode.isDraft },
      occurredAt: iso(prNode.createdAt),
      externalId: this.buildExternalId({ kind: 'pr-lifecycle', prNodeId, type: PrEventType.PR_OPENED }),
    });

    if (prNode.mergedAt) {
      events.push({
        ...base,
        type: PrEventType.PR_MERGED,
        actorLogin: prNode.mergedBy?.login ?? authorLogin,
        occurredAt: iso(prNode.mergedAt),
        externalId: this.buildExternalId({ kind: 'pr-lifecycle', prNodeId, type: PrEventType.PR_MERGED }),
      });
    } else if (prNode.closedAt) {
      events.push({
        ...base,
        type: PrEventType.PR_CLOSED,
        actorLogin: authorLogin,
        occurredAt: iso(prNode.closedAt),
        externalId: this.buildExternalId({ kind: 'pr-lifecycle', prNodeId, type: PrEventType.PR_CLOSED }),
      });
    }

    for (const node of prNode.commits?.nodes ?? []) {
      const commit = node.commit ?? node;
      const sha = commit.oid as string;
      events.push({
        ...base,
        type: PrEventType.COMMIT_PUSHED,
        actorLogin: commit.author?.user?.login ?? authorLogin,
        payload: {
          oid: sha,
          authoredDate: commit.authoredDate,
          pushedDate: commit.pushedDate ?? commit.committedDate,
        },
        occurredAt: iso(commit.pushedDate ?? commit.committedDate ?? commit.authoredDate),
        externalId: this.buildExternalId({ kind: 'commit', sha }),
      });
    }

    for (const review of prNode.reviews?.nodes ?? []) {
      const state = String(review.state ?? '').toLowerCase();
      const type = state === 'dismissed' ? PrEventType.REVIEW_DISMISSED : PrEventType.REVIEW_SUBMITTED;
      events.push({
        ...base,
        type,
        actorLogin: review.author?.login,
        payload: { state },
        occurredAt: iso(review.submittedAt ?? review.createdAt),
        externalId: this.buildExternalId({ kind: 'review', nodeId: review.id }),
      });
    }

    for (const comment of prNode.comments?.nodes ?? []) {
      events.push({
        ...base,
        type: PrEventType.COMMENT,
        actorLogin: comment.author?.login,
        occurredAt: iso(comment.createdAt),
        externalId: this.buildExternalId({ kind: 'comment', nodeId: comment.id }),
      });
    }

    for (const item of prNode.timelineItems?.nodes ?? []) {
      const mapped = this.backfillTimelineItem(base, prNodeId, item);
      if (mapped) {
        events.push(mapped);
      }
    }

    const rollup = prNode.commits?.nodes?.[prNode.commits.nodes.length - 1]?.commit?.statusCheckRollup;
    if (rollup?.state) {
      const headSha = prNode.commits.nodes[prNode.commits.nodes.length - 1].commit.oid as string;
      events.push({
        ...base,
        type: PrEventType.CHECK_STATE_CHANGED,
        payload: { state: this.mapCheckState(rollup.state) },
        occurredAt: iso(prNode.updatedAt ?? prNode.createdAt),
        externalId: this.buildExternalId({ kind: 'check', suiteNodeId: prNodeId, headSha }),
      });
    }

    const pullRequest: NormalizedPullRequest = {
      repo,
      number: prNumber,
      nodeId: prNodeId,
      title: prNode.title,
      url: prNode.url,
      authorLogin,
      isDraft: !!prNode.isDraft,
      isBot: isBotLogin(authorLogin) || prNode.author?.__typename === 'Bot',
      isRevert: looksLikeRevert(prNode.title ?? ''),
    };

    return { pullRequest, events };
  }

  private backfillTimelineItem(
    base: { repo: string; prNumber: number; prNodeId: string; source: PrEventSource },
    prNodeId: string,
    item: Record<string, any>,
  ): NormalizedEvent | null {
    const occurredAt = iso(item.createdAt);
    switch (item.__typename) {
      case 'ReadyForReviewEvent':
        return {
          ...base,
          type: PrEventType.PR_READY_FOR_REVIEW,
          actorLogin: item.actor?.login,
          occurredAt,
          externalId: this.buildExternalId({ kind: 'pr-transition', prNodeId, type: PrEventType.PR_READY_FOR_REVIEW, occurredAt }),
        };
      case 'ConvertToDraftEvent':
        return {
          ...base,
          type: PrEventType.PR_CONVERTED_TO_DRAFT,
          actorLogin: item.actor?.login,
          occurredAt,
          externalId: this.buildExternalId({ kind: 'pr-transition', prNodeId, type: PrEventType.PR_CONVERTED_TO_DRAFT, occurredAt }),
        };
      case 'ReviewRequestedEvent':
        return {
          ...base,
          type: PrEventType.REVIEW_REQUESTED,
          actorLogin: item.actor?.login,
          payload: { reviewer: item.requestedReviewer?.login },
          occurredAt,
          externalId: this.buildExternalId({
            kind: 'review-request',
            prNodeId,
            type: PrEventType.REVIEW_REQUESTED,
            reviewer: item.requestedReviewer?.login ?? 'unknown',
            occurredAt,
          }),
        };
      case 'ReviewRequestRemovedEvent':
        return {
          ...base,
          type: PrEventType.REVIEW_REQUEST_REMOVED,
          actorLogin: item.actor?.login,
          payload: { reviewer: item.requestedReviewer?.login },
          occurredAt,
          externalId: this.buildExternalId({
            kind: 'review-request',
            prNodeId,
            type: PrEventType.REVIEW_REQUEST_REMOVED,
            reviewer: item.requestedReviewer?.login ?? 'unknown',
            occurredAt,
          }),
        };
      default:
        return null;
    }
  }

  private webhookPullRequest(payload: Record<string, any>): NormalizedEvent[] {
    const pr = payload.pull_request;
    const prNodeId = pr.node_id as string;
    const base = {
      repo: payload.repository.full_name as string,
      prNumber: pr.number as number,
      prNodeId,
      source: PrEventSource.WEBHOOK,
      actorLogin: payload.sender?.login,
    };

    switch (payload.action) {
      case 'opened':
        return [
          {
            ...base,
            type: PrEventType.PR_OPENED,
            payload: { isDraft: !!pr.draft },
            occurredAt: iso(pr.created_at),
            externalId: this.buildExternalId({ kind: 'pr-lifecycle', prNodeId, type: PrEventType.PR_OPENED }),
          },
        ];
      case 'ready_for_review': {
        const occurredAt = iso(payload.pull_request.updated_at ?? new Date().toISOString());
        return [
          {
            ...base,
            type: PrEventType.PR_READY_FOR_REVIEW,
            occurredAt,
            externalId: this.buildExternalId({ kind: 'pr-transition', prNodeId, type: PrEventType.PR_READY_FOR_REVIEW, occurredAt }),
          },
        ];
      }
      case 'converted_to_draft': {
        const occurredAt = iso(payload.pull_request.updated_at ?? new Date().toISOString());
        return [
          {
            ...base,
            type: PrEventType.PR_CONVERTED_TO_DRAFT,
            occurredAt,
            externalId: this.buildExternalId({ kind: 'pr-transition', prNodeId, type: PrEventType.PR_CONVERTED_TO_DRAFT, occurredAt }),
          },
        ];
      }
      case 'closed':
        if (pr.merged) {
          return [
            {
              ...base,
              type: PrEventType.PR_MERGED,
              occurredAt: iso(pr.merged_at),
              externalId: this.buildExternalId({ kind: 'pr-lifecycle', prNodeId, type: PrEventType.PR_MERGED }),
            },
          ];
        }
        return [
          {
            ...base,
            type: PrEventType.PR_CLOSED,
            occurredAt: iso(pr.closed_at),
            externalId: this.buildExternalId({ kind: 'pr-lifecycle', prNodeId, type: PrEventType.PR_CLOSED }),
          },
        ];
      case 'review_requested':
      case 'review_request_removed': {
        const type =
          payload.action === 'review_requested' ? PrEventType.REVIEW_REQUESTED : PrEventType.REVIEW_REQUEST_REMOVED;
        const reviewer = payload.requested_reviewer?.login ?? payload.requested_team?.slug ?? 'unknown';
        const occurredAt = iso(pr.updated_at ?? new Date().toISOString());
        return [
          {
            ...base,
            type,
            payload: { reviewer },
            occurredAt,
            externalId: this.buildExternalId({ kind: 'review-request', prNodeId, type, reviewer, occurredAt }),
          },
        ];
      }
      default:
        return [];
    }
  }

  private webhookReview(payload: Record<string, any>): NormalizedEvent[] {
    const pr = payload.pull_request;
    const review = payload.review;
    const state = String(review.state ?? '').toLowerCase();
    const dismissed = payload.action === 'dismissed' || state === 'dismissed';
    return [
      {
        repo: payload.repository.full_name,
        prNumber: pr.number,
        prNodeId: pr.node_id,
        type: dismissed ? PrEventType.REVIEW_DISMISSED : PrEventType.REVIEW_SUBMITTED,
        actorLogin: review.user?.login,
        payload: { state },
        occurredAt: iso(review.submitted_at ?? pr.updated_at),
        source: PrEventSource.WEBHOOK,
        externalId: this.buildExternalId({ kind: 'review', nodeId: review.node_id }),
      },
    ];
  }

  private webhookComment(payload: Record<string, any>): NormalizedEvent[] {
    const comment = payload.comment;
    const pr = payload.pull_request ?? payload.issue;
    return [
      {
        repo: payload.repository.full_name,
        prNumber: pr.number,
        prNodeId: pr.node_id,
        type: PrEventType.COMMENT,
        actorLogin: comment.user?.login,
        occurredAt: iso(comment.created_at),
        source: PrEventSource.WEBHOOK,
        externalId: this.buildExternalId({ kind: 'comment', nodeId: comment.node_id }),
      },
    ];
  }

  private webhookPush(payload: Record<string, any>): NormalizedEvent[] {
    const repo = payload.repository.full_name;
    const commits = payload.commits ?? [];
    return commits.map((commit: Record<string, any>) => ({
      repo,
      prNumber: 0,
      type: PrEventType.COMMIT_PUSHED,
      actorLogin: commit.author?.username,
      payload: { oid: commit.id, authoredDate: commit.timestamp, pushedDate: commit.timestamp, ref: payload.ref },
      occurredAt: iso(commit.timestamp),
      source: PrEventSource.WEBHOOK,
      externalId: this.buildExternalId({ kind: 'commit', sha: commit.id }),
    }));
  }

  private webhookCheckSuite(payload: Record<string, any>): NormalizedEvent[] {
    const suite = payload.check_suite;
    return [
      {
        repo: payload.repository.full_name,
        prNumber: suite.pull_requests?.[0]?.number ?? 0,
        prNodeId: suite.pull_requests?.[0]?.node_id,
        type: PrEventType.CHECK_STATE_CHANGED,
        payload: { state: this.mapCheckState(suite.conclusion ?? suite.status) },
        occurredAt: iso(suite.updated_at ?? new Date().toISOString()),
        source: PrEventSource.WEBHOOK,
        externalId: this.buildExternalId({ kind: 'check', suiteNodeId: suite.node_id, headSha: suite.head_sha }),
      },
    ];
  }

  private mapCheckState(raw: string): string {
    const value = String(raw ?? '').toLowerCase();
    if (['success', 'passing', 'completed'].includes(value)) {
      return 'passing';
    }
    if (['failure', 'failing', 'error', 'timed_out', 'cancelled', 'action_required'].includes(value)) {
      return 'failing';
    }
    return 'pending';
  }
}
