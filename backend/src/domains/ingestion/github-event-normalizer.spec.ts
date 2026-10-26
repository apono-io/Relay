import {
  GithubEventNormalizer,
  parseRelayCommand,
} from './github-event-normalizer.service';
import { PrEventType } from '@/domains/pull-requests/pr-enums';

const REPO = 'apono-io/apono-mono';
const PR_NODE = 'PR_node_1';
const READY_AT = '2026-01-02T10:00:00.000Z';

function backfillNode(
  overrides: Record<string, any> = {},
): Record<string, any> {
  return {
    id: PR_NODE,
    number: 42,
    title: 'Add a feature',
    url: 'https://github.com/apono-io/apono-mono/pull/42',
    isDraft: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    mergedAt: null,
    closedAt: null,
    author: { login: 'alice', __typename: 'User' },
    commits: { nodes: [] },
    reviews: { nodes: [] },
    comments: { nodes: [] },
    timelineItems: { nodes: [] },
    ...overrides,
  };
}

describe('GithubEventNormalizer', () => {
  let normalizer: GithubEventNormalizer;

  beforeEach(() => {
    normalizer = new GithubEventNormalizer();
  });

  describe('backfill mapping', () => {
    it('maps a PR node to a PR_OPENED event with a lifecycle external id', () => {
      const { events } = normalizer.normalizeBackfillNode(REPO, backfillNode());
      const opened = events.find((e) => e.type === PrEventType.PR_OPENED);
      expect(opened?.externalId).toBe(`pr:${PR_NODE}:pr_opened`);
      expect(opened?.payload).toEqual({ isDraft: false });
    });

    it('maps mergedAt to a PR_MERGED event', () => {
      const { events } = normalizer.normalizeBackfillNode(
        REPO,
        backfillNode({ mergedAt: '2026-01-03T00:00:00.000Z' }),
      );
      expect(events.some((e) => e.type === PrEventType.PR_MERGED)).toBe(true);
    });

    it('maps commits to COMMIT_PUSHED with a commit-sha external id', () => {
      const node = backfillNode({
        commits: {
          nodes: [
            {
              commit: {
                oid: 'sha_1',
                authoredDate: '2026-01-01T00:00:00.000Z',
                pushedDate: '2026-01-01T01:00:00.000Z',
              },
            },
          ],
        },
      });
      const { events } = normalizer.normalizeBackfillNode(REPO, node);
      const commit = events.find((e) => e.type === PrEventType.COMMIT_PUSHED);
      expect(commit?.externalId).toBe('commit:sha_1');
    });

    it('maps a dismissed review to REVIEW_DISMISSED', () => {
      const node = backfillNode({
        reviews: {
          nodes: [
            {
              id: 'PRR_1',
              state: 'DISMISSED',
              submittedAt: READY_AT,
              author: { login: 'bob' },
            },
          ],
        },
      });
      const { events } = normalizer.normalizeBackfillNode(REPO, node);
      expect(events.find((e) => e.externalId === 'review:PRR_1')?.type).toBe(
        PrEventType.REVIEW_DISMISSED,
      );
    });

    it('maps a ReadyForReviewEvent timeline item', () => {
      const node = backfillNode({
        isDraft: true,
        timelineItems: {
          nodes: [
            {
              __typename: 'ReadyForReviewEvent',
              createdAt: READY_AT,
              actor: { login: 'alice' },
            },
          ],
        },
      });
      const { events } = normalizer.normalizeBackfillNode(REPO, node);
      expect(
        events.some((e) => e.type === PrEventType.PR_READY_FOR_REVIEW),
      ).toBe(true);
    });

    it('extracts PR metadata including bot and revert detection', () => {
      const bot = normalizer.normalizeBackfillNode(
        REPO,
        backfillNode({
          title: 'Revert "Add a feature"',
          author: { login: 'dependabot[bot]', __typename: 'Bot' },
        }),
      );
      expect(bot.pullRequest.isBot).toBe(true);
      expect(bot.pullRequest.isRevert).toBe(true);
    });

    it('extracts the file paths the PR touches', () => {
      const result = normalizer.normalizeBackfillNode(
        REPO,
        backfillNode({
          files: {
            nodes: [
              { path: 'frontend/src/App.tsx' },
              { path: 'backend/src/main.ts' },
              { path: null },
            ],
          },
        }),
      );
      expect(result.pullRequest.filePaths).toEqual([
        'frontend/src/App.tsx',
        'backend/src/main.ts',
      ]);
    });

    it('defaults file paths to an empty list when the node has none', () => {
      const result = normalizer.normalizeBackfillNode(REPO, backfillNode());
      expect(result.pullRequest.filePaths).toEqual([]);
    });
  });

  describe('bot comment authors', () => {
    it('keeps the [bot] suffix GitHub GraphQL drops for a Bot author', () => {
      const { events } = normalizer.normalizeBackfillNode(
        REPO,
        backfillNode({
          comments: {
            nodes: [
              {
                id: 'C1',
                createdAt: READY_AT,
                author: { login: 'apono-relay', __typename: 'Bot' },
                body: 'Requested a review from @EthanHemo, a good fit for this change.',
              },
              {
                id: 'C2',
                createdAt: READY_AT,
                author: { login: 'alice', __typename: 'User' },
                body: 'thanks',
              },
            ],
          },
        }),
      );
      const authors = events
        .filter((e) => e.type === PrEventType.COMMENT)
        .map((e) => e.actorLogin);
      expect(authors).toEqual(['apono-relay[bot]', 'alice']);
    });
  });

  describe('pending reviews', () => {
    it('leaves out a review that is still pending (no submittedAt yet)', () => {
      const { events } = normalizer.normalizeBackfillNode(
        REPO,
        backfillNode({
          reviews: {
            nodes: [
              {
                id: 'R1',
                state: 'PENDING',
                submittedAt: null,
                author: { login: 'Dorsg' },
              },
              {
                id: 'R2',
                state: 'APPROVED',
                submittedAt: READY_AT,
                author: { login: 'Dorsg' },
              },
            ],
          },
        }),
      );
      const reviews = events.filter(
        (e) =>
          e.type === PrEventType.REVIEW_SUBMITTED ||
          e.type === PrEventType.REVIEW_DISMISSED,
      );
      expect(reviews.map((e) => e.externalId)).toEqual(['review:R2']);
      expect(events.every((e) => !Number.isNaN(e.occurredAt.getTime()))).toBe(
        true,
      );
    });
  });

  describe('@relay commands in comments', () => {
    it.each([
      ['@relay assign', 'assign'],
      ['@Relay   ASSIGN please', 'assign'],
      ['/relay skip', 'skip'],
      ['thanks!\n@relay assign', 'assign'],
      ['  @relay skip', 'skip'],
      ["don't @relay assign yet", null],
      ['> @relay assign', null],
      ['```\n@relay assign\n```', null],
      ['@relayer assign', null],
      ['@relay unknown', null],
      ['@relay assignment', null],
      [null, null],
    ])('parses %j as %j', (body, expected) => {
      expect(parseRelayCommand(body)).toBe(expected);
    });

    it('records the command in the comment payload', () => {
      const { events } = normalizer.normalizeBackfillNode(
        REPO,
        backfillNode({
          comments: {
            nodes: [
              {
                id: 'C1',
                createdAt: READY_AT,
                author: { login: 'dev' },
                body: '@relay assign',
              },
            ],
          },
        }),
      );
      const comments = events.filter((e) => e.type === PrEventType.COMMENT);
      expect(comments).toHaveLength(1);
      expect(comments[0].payload).toEqual({ command: 'assign' });
      expect(comments[0].externalId).toBe('comment:C1');
    });

    it('leaves a plain comment without a payload', () => {
      const { events } = normalizer.normalizeBackfillNode(
        REPO,
        backfillNode({
          comments: {
            nodes: [
              {
                id: 'C1',
                createdAt: READY_AT,
                author: { login: 'dev' },
                body: 'looks good',
              },
            ],
          },
        }),
      );
      const comment = events.find((e) => e.type === PrEventType.COMMENT);
      expect(comment?.payload).toBeUndefined();
    });

    it('merges recentComments without duplicating events', () => {
      const c1 = {
        id: 'C1',
        createdAt: READY_AT,
        author: { login: 'dev' },
        body: 'first',
      };
      const c2 = {
        id: 'C2',
        createdAt: READY_AT,
        author: { login: 'dev' },
        body: '@relay skip',
      };
      const { events } = normalizer.normalizeBackfillNode(
        REPO,
        backfillNode({
          comments: { nodes: [c1] },
          recentComments: { nodes: [c1, c2] },
        }),
      );
      const ids = events
        .filter((e) => e.type === PrEventType.COMMENT)
        .map((e) => e.externalId);
      expect(ids).toEqual(['comment:C1', 'comment:C2']);
    });

    it('records the command from an issue_comment webhook', () => {
      const [event] = normalizer.normalizeWebhook('issue_comment', {
        repository: { full_name: REPO },
        issue: { number: 42, node_id: PR_NODE },
        comment: {
          node_id: 'C9',
          user: { login: 'dev' },
          created_at: READY_AT,
          body: '/relay assign',
        },
      });
      expect(event.payload).toEqual({ command: 'assign' });
    });
  });

  describe('webhook mapping', () => {
    it('maps a pull_request opened webhook', () => {
      const events = normalizer.normalizeWebhook('pull_request', {
        action: 'opened',
        repository: { full_name: REPO },
        sender: { login: 'alice' },
        pull_request: {
          number: 42,
          node_id: PR_NODE,
          draft: false,
          created_at: '2026-01-01T00:00:00.000Z',
        },
      });
      expect(events[0].type).toBe(PrEventType.PR_OPENED);
    });

    it('drops unknown event types', () => {
      expect(normalizer.normalizeWebhook('deployment', {})).toEqual([]);
    });
  });

  describe('canonical external id (backfill and webhook agree)', () => {
    it('PR_OPENED matches across sources', () => {
      const backfill = normalizer.normalizeBackfillNode(REPO, backfillNode());
      const webhook = normalizer.normalizeWebhook('pull_request', {
        action: 'opened',
        repository: { full_name: REPO },
        sender: { login: 'alice' },
        pull_request: {
          number: 42,
          node_id: PR_NODE,
          draft: false,
          created_at: '2026-01-01T00:00:00.000Z',
        },
      });
      const bId = backfill.events.find(
        (e) => e.type === PrEventType.PR_OPENED,
      )!.externalId;
      expect(webhook[0].externalId).toBe(bId);
    });

    it('a review matches across sources by review node id', () => {
      const backfill = normalizer.normalizeBackfillNode(
        REPO,
        backfillNode({
          reviews: {
            nodes: [
              {
                id: 'PRR_9',
                state: 'APPROVED',
                submittedAt: READY_AT,
                author: { login: 'bob' },
              },
            ],
          },
        }),
      );
      const webhook = normalizer.normalizeWebhook('pull_request_review', {
        action: 'submitted',
        repository: { full_name: REPO },
        pull_request: { number: 42, node_id: PR_NODE },
        review: {
          node_id: 'PRR_9',
          state: 'approved',
          submitted_at: READY_AT,
          user: { login: 'bob' },
        },
      });
      const bId = backfill.events.find(
        (e) => e.type === PrEventType.REVIEW_SUBMITTED,
      )!.externalId;
      expect(webhook[0].externalId).toBe(bId);
      expect(bId).toBe('review:PRR_9');
    });

    it('a commit matches across sources by sha', () => {
      const backfill = normalizer.normalizeBackfillNode(
        REPO,
        backfillNode({
          commits: {
            nodes: [
              {
                commit: {
                  oid: 'sha_7',
                  authoredDate: READY_AT,
                  pushedDate: READY_AT,
                },
              },
            ],
          },
        }),
      );
      const webhook = normalizer.normalizeWebhook('push', {
        repository: { full_name: REPO },
        ref: 'refs/heads/feature',
        commits: [
          { id: 'sha_7', timestamp: READY_AT, author: { username: 'alice' } },
        ],
      });
      const bId = backfill.events.find(
        (e) => e.type === PrEventType.COMMIT_PUSHED,
      )!.externalId;
      expect(webhook[0].externalId).toBe(bId);
    });

    it('a ready-for-review transition matches across sources by timestamp', () => {
      const backfill = normalizer.normalizeBackfillNode(
        REPO,
        backfillNode({
          isDraft: true,
          timelineItems: {
            nodes: [{ __typename: 'ReadyForReviewEvent', createdAt: READY_AT }],
          },
        }),
      );
      const webhook = normalizer.normalizeWebhook('pull_request', {
        action: 'ready_for_review',
        repository: { full_name: REPO },
        pull_request: { number: 42, node_id: PR_NODE, updated_at: READY_AT },
      });
      const bId = backfill.events.find(
        (e) => e.type === PrEventType.PR_READY_FOR_REVIEW,
      )!.externalId;
      expect(webhook[0].externalId).toBe(bId);
    });

    it('a replayed webhook delivery yields identical external ids', () => {
      const delivery = {
        action: 'submitted',
        repository: { full_name: REPO },
        pull_request: { number: 42, node_id: PR_NODE },
        review: {
          node_id: 'PRR_9',
          state: 'approved',
          submitted_at: READY_AT,
          user: { login: 'bob' },
        },
      };
      const first = normalizer.normalizeWebhook(
        'pull_request_review',
        delivery,
      );
      const replay = normalizer.normalizeWebhook(
        'pull_request_review',
        delivery,
      );
      expect(replay.map((e) => e.externalId)).toEqual(
        first.map((e) => e.externalId),
      );
    });
  });
});
