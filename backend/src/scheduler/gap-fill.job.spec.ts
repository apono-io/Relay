import { GapFillJob } from './gap-fill.job';
import { PrEventSource } from '@/domains/pull-requests/pr-enums';
import { NormalizedEvent, NormalizedPullRequest } from '@/domains/ingestion/github-event-normalizer.service';

const NOW = new Date('2026-07-07T12:00:00Z');

function node(number: number, updatedAt: string) {
  return { number, updatedAt };
}

function page(nodes: any[], hasNextPage = false, endCursor: string | null = null) {
  return { nodes, pageInfo: { hasNextPage, endCursor } };
}

type Deps = {
  lookbackHours?: number;
  repos?: string[];
  pages?: Record<string, any[]>;
  insertedPerPr?: number;
};

function build(deps: Deps = {}) {
  const lookbackHours = deps.lookbackHours ?? 24;
  const repos = deps.repos ?? ['apono-io/apono-mono'];
  const pagesByRepo = deps.pages ?? {};

  const fetchCalls: { repo: string; opts: any }[] = [];
  const persistCalls: { header: NormalizedPullRequest; events: NormalizedEvent[]; source?: PrEventSource }[] = [];

  const configService = {
    get: (key: string) => (key === 'GAP_FILL_LOOKBACK_HOURS' ? lookbackHours : undefined),
  };

  const github = {
    isConfigured: () => true,
    fetchPullRequestTimelines: (repo: string, opts: any) => {
      fetchCalls.push({ repo, opts });
      const queue = pagesByRepo[repo] ?? [page([])];
      const idx = fetchCalls.filter((c) => c.repo === repo).length - 1;
      return Promise.resolve(queue[Math.min(idx, queue.length - 1)]);
    },
  };

  const normalizer = {
    normalizeBackfillNode: (repo: string, n: any) => ({
      pullRequest: { repo, number: n.number } as NormalizedPullRequest,
      events: [{ externalId: `e-${n.number}` } as NormalizedEvent],
    }),
  };

  const ingest = {
    repos: () => repos,
    persistPr: (header: NormalizedPullRequest, events: NormalizedEvent[], source?: PrEventSource) => {
      persistCalls.push({ header, events, source });
      return Promise.resolve(deps.insertedPerPr ?? 0);
    },
  };

  const logger = { log: () => {} };

  const job = new GapFillJob(configService as any, github as any, normalizer as any, ingest as any, logger as any);
  return { job, fetchCalls, persistCalls };
}

describe('GapFillJob.pull', () => {
  it('queries PRs ordered by UPDATED_AT', async () => {
    const { job, fetchCalls } = build({ pages: { 'apono-io/apono-mono': [page([node(1, '2026-07-07T11:00:00Z')])] } });
    await job.pull(NOW);
    expect(fetchCalls[0].opts.orderBy).toBe('UPDATED_AT');
  });

  it('ingests PRs updated within the lookback window and stamps source=gap_fill', async () => {
    const { job, persistCalls } = build({
      pages: { 'apono-io/apono-mono': [page([node(1, '2026-07-07T11:00:00Z')])] },
      insertedPerPr: 1,
    });
    const summary = await job.pull(NOW);
    expect(persistCalls).toHaveLength(1);
    expect(persistCalls[0].source).toBe(PrEventSource.GAP_FILL);
    expect(summary).toEqual({ reposProcessed: 1, prsScanned: 1, eventsInserted: 1 });
  });

  it('stops at the window cutoff and skips older PRs', async () => {
    const { job, persistCalls } = build({
      lookbackHours: 24,
      pages: {
        'apono-io/apono-mono': [
          page([
            node(1, '2026-07-07T11:00:00Z'), // 1h ago — in window
            node(2, '2026-07-05T00:00:00Z'), // >24h ago — out of window
            node(3, '2026-07-07T10:00:00Z'), // in window but after cutoff node
          ]),
        ],
      },
      insertedPerPr: 1,
    });
    const summary = await job.pull(NOW);
    expect(persistCalls.map((c) => c.header.number)).toEqual([1]);
    expect(summary.prsScanned).toBe(1);
  });

  it('paginates until the cutoff is reached', async () => {
    const { job, fetchCalls, persistCalls } = build({
      pages: {
        'apono-io/apono-mono': [
          page([node(1, '2026-07-07T11:00:00Z')], true, 'cursor-1'),
          page([node(2, '2026-07-05T00:00:00Z')]), // out of window -> stop
        ],
      },
      insertedPerPr: 1,
    });
    await job.pull(NOW);
    expect(fetchCalls).toHaveLength(2);
    expect(fetchCalls[1].opts.after).toBe('cursor-1');
    expect(persistCalls.map((c) => c.header.number)).toEqual([1]);
  });

  it('restores a dropped event: a missing event is re-inserted as gap_fill (AC-3)', async () => {
    // ingest reports 1 inserted -> the event was absent (dropped) and has been restored.
    const { job, persistCalls } = build({
      pages: { 'apono-io/apono-mono': [page([node(42, '2026-07-07T11:30:00Z')])] },
      insertedPerPr: 1,
    });
    const summary = await job.pull(NOW);
    expect(summary.eventsInserted).toBe(1);
    expect(persistCalls[0].source).toBe(PrEventSource.GAP_FILL);
  });

  it('sums across multiple repos', async () => {
    const { job, persistCalls } = build({
      repos: ['org/a', 'org/b'],
      pages: {
        'org/a': [page([node(1, '2026-07-07T11:00:00Z')])],
        'org/b': [page([node(2, '2026-07-07T11:00:00Z')])],
      },
      insertedPerPr: 2,
    });
    const summary = await job.pull(NOW);
    expect(persistCalls).toHaveLength(2);
    expect(summary).toEqual({ reposProcessed: 2, prsScanned: 2, eventsInserted: 4 });
  });
});
