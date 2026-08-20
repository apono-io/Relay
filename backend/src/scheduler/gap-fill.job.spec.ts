import { GapFillJob } from './gap-fill.job';
import { PrEventSource } from '@/domains/pull-requests/pr-enums';
import {
  NormalizedEvent,
  NormalizedPullRequest,
} from '@/domains/ingestion/github-event-normalizer.service';
import { SyncStatusService } from '@/infrastructure/sync/sync-status.service';

const NOW = new Date('2026-07-07T12:00:00Z');

function node(number: number, updatedAt: string) {
  return { number, updatedAt };
}

function page(
  nodes: any[],
  hasNextPage = false,
  endCursor: string | null = null,
) {
  return { nodes, pageInfo: { hasNextPage, endCursor } };
}

type Deps = {
  lookbackHours?: number;
  repos?: string[];
  pages?: Record<string, any[]>;
  staleNumbers?: Record<string, number[]>;
  staleNodes?: Record<string, any[]>;
  insertedPerPr?: number;
  configured?: boolean;
};

function build(deps: Deps = {}) {
  const lookbackHours = deps.lookbackHours ?? 24;
  const repos = deps.repos ?? ['apono-io/apono-mono'];
  const pagesByRepo = deps.pages ?? {};
  const staleNumbersByRepo = deps.staleNumbers ?? {};
  const staleNodesByRepo = deps.staleNodes ?? {};

  const fetchCalls: { repo: string; opts: any }[] = [];
  const fetchByNumberCalls: { repo: string; numbers: number[] }[] = [];
  const persistCalls: {
    header: NormalizedPullRequest;
    events: NormalizedEvent[];
    source?: PrEventSource;
  }[] = [];

  const configService = {
    get: (key: string) =>
      key === 'GAP_FILL_LOOKBACK_HOURS' ? lookbackHours : undefined,
  };

  const github = {
    isConfigured: () => deps.configured ?? true,
    fetchPullRequestTimelines: (repo: string, opts: any) => {
      fetchCalls.push({ repo, opts });
      const queue = pagesByRepo[repo] ?? [page([])];
      const idx = fetchCalls.filter((c) => c.repo === repo).length - 1;
      return Promise.resolve(queue[Math.min(idx, queue.length - 1)]);
    },
    fetchPullRequestTimelinesByNumbers: (repo: string, numbers: number[]) => {
      fetchByNumberCalls.push({ repo, numbers });
      const nodes = (staleNodesByRepo[repo] ?? []).filter((n) =>
        numbers.includes(n.number),
      );
      return Promise.resolve(nodes);
    },
  };

  const pullRequests = {
    findOpenNumbersUpdatedBefore: (repo: string) =>
      Promise.resolve(staleNumbersByRepo[repo] ?? []),
  };

  const normalizer = {
    normalizeBackfillNode: (repo: string, n: any) => ({
      pullRequest: { repo, number: n.number } as NormalizedPullRequest,
      events: [{ externalId: `e-${n.number}` } as NormalizedEvent],
    }),
  };

  const ingest = {
    repos: () => repos,
    persistPr: (
      header: NormalizedPullRequest,
      events: NormalizedEvent[],
      source?: PrEventSource,
    ) => {
      persistCalls.push({ header, events, source });
      return Promise.resolve(deps.insertedPerPr ?? 0);
    },
  };

  const logger = { log: () => {} };

  const settingsRepo = {
    findOne: () => Promise.resolve(null),
    save: () => Promise.resolve(undefined),
    create: (value: unknown) => value,
  };
  const syncStatus = new SyncStatusService(settingsRepo as never);
  const schedulerRegistry = { addInterval: () => {} };
  const job = new GapFillJob(
    configService as any,
    github as any,
    normalizer as any,
    ingest as any,
    pullRequests as any,
    logger as any,
    syncStatus,
    schedulerRegistry as any,
  );
  return { job, fetchCalls, fetchByNumberCalls, persistCalls, syncStatus };
}

describe('GapFillJob.pull', () => {
  it('queries PRs ordered by UPDATED_AT', async () => {
    const { job, fetchCalls } = build({
      pages: {
        'apono-io/apono-mono': [page([node(1, '2026-07-07T11:00:00Z')])],
      },
    });
    await job.pull(NOW);
    expect(fetchCalls[0].opts.orderBy).toBe('UPDATED_AT');
  });

  it('ingests PRs updated within the lookback window and stamps source=gap_fill', async () => {
    const { job, persistCalls } = build({
      pages: {
        'apono-io/apono-mono': [page([node(1, '2026-07-07T11:00:00Z')])],
      },
      insertedPerPr: 1,
    });
    const summary = await job.pull(NOW);
    expect(persistCalls).toHaveLength(1);
    expect(persistCalls[0].source).toBe(PrEventSource.GAP_FILL);
    expect(summary).toEqual({
      reposProcessed: 1,
      prsScanned: 1,
      prsReconciled: 0,
      eventsInserted: 1,
    });
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
      pages: {
        'apono-io/apono-mono': [page([node(42, '2026-07-07T11:30:00Z')])],
      },
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
    expect(summary).toEqual({
      reposProcessed: 2,
      prsScanned: 2,
      prsReconciled: 0,
      eventsInserted: 4,
    });
  });

  it('reconciles DB-open PRs missed by the window scan and stamps source=gap_fill', async () => {
    const { job, fetchByNumberCalls, persistCalls } = build({
      pages: { 'apono-io/apono-mono': [page([])] },
      staleNumbers: { 'apono-io/apono-mono': [11136, 11156] },
      staleNodes: {
        'apono-io/apono-mono': [
          node(11136, '2026-06-15T00:00:00Z'),
          node(11156, '2026-06-16T00:00:00Z'),
        ],
      },
      insertedPerPr: 1,
    });
    const summary = await job.pull(NOW);
    expect(fetchByNumberCalls).toEqual([
      { repo: 'apono-io/apono-mono', numbers: [11136, 11156] },
    ]);
    expect(persistCalls.map((c) => c.header.number)).toEqual([11136, 11156]);
    expect(persistCalls.every((c) => c.source === PrEventSource.GAP_FILL)).toBe(
      true,
    );
    expect(summary.prsReconciled).toBe(2);
    expect(summary.eventsInserted).toBe(2);
  });

  it('reconciles stale PRs in batches of 20', async () => {
    const numbers = Array.from({ length: 25 }, (_, i) => 1000 + i);
    const { job, fetchByNumberCalls } = build({
      pages: { 'apono-io/apono-mono': [page([])] },
      staleNumbers: { 'apono-io/apono-mono': numbers },
      staleNodes: {
        'apono-io/apono-mono': numbers.map((n) =>
          node(n, '2026-06-15T00:00:00Z'),
        ),
      },
    });
    await job.pull(NOW);
    expect(fetchByNumberCalls).toHaveLength(2);
    expect(fetchByNumberCalls[0].numbers).toHaveLength(20);
    expect(fetchByNumberCalls[1].numbers).toHaveLength(5);
  });

  it('skips a stale number GitHub no longer returns', async () => {
    const { job, persistCalls } = build({
      pages: { 'apono-io/apono-mono': [page([])] },
      staleNumbers: { 'apono-io/apono-mono': [11136, 99999] },
      staleNodes: {
        'apono-io/apono-mono': [node(11136, '2026-06-15T00:00:00Z')],
      },
    });
    const summary = await job.pull(NOW);
    expect(persistCalls.map((c) => c.header.number)).toEqual([11136]);
    expect(summary.prsReconciled).toBe(1);
  });

  it('marks the GitHub sync time after a pull', async () => {
    const { job, syncStatus } = build({
      pages: { 'apono-io/apono-mono': [page([])] },
    });
    await job.pull(NOW);
    expect(syncStatus.lastSyncedAt).toEqual(NOW);
  });

  it('scans back to the last successful sync after days of downtime', async () => {
    const { job, syncStatus, persistCalls } = build({
      lookbackHours: 24,
      pages: {
        'apono-io/apono-mono': [
          page([
            node(1, '2026-07-07T11:00:00Z'), // 1h ago — in the regular window
            node(2, '2026-07-05T00:00:00Z'), // 60h ago — outside window, inside the outage gap
            node(3, '2026-07-04T00:00:00Z'), // before the watermark — stop here
          ]),
        ],
      },
      insertedPerPr: 1,
    });
    await syncStatus.markSynced(new Date('2026-07-04T12:00:00Z')); // last success: 3 days ago
    const summary = await job.pull(NOW);
    expect(persistCalls.map((c) => c.header.number)).toEqual([1, 2]);
    expect(summary.prsScanned).toBe(2);
    expect(syncStatus.lastSyncedAt).toEqual(NOW);
  });

  it('keeps the regular window when the last sync is fresh', async () => {
    const { job, syncStatus, persistCalls } = build({
      lookbackHours: 24,
      pages: {
        'apono-io/apono-mono': [
          page([
            node(1, '2026-07-07T11:00:00Z'), // in window
            node(2, '2026-07-05T00:00:00Z'), // outside window — skipped
          ]),
        ],
      },
      insertedPerPr: 1,
    });
    await syncStatus.markSynced(new Date('2026-07-07T11:55:00Z'));
    await job.pull(NOW);
    expect(persistCalls.map((c) => c.header.number)).toEqual([1]);
  });
});

describe('GapFillJob.runNow', () => {
  it('pulls from GitHub and returns the new sync time', async () => {
    const { job, fetchCalls } = build({
      pages: { 'apono-io/apono-mono': [page([])] },
    });
    const syncedAt = await job.runNow();
    expect(fetchCalls.length).toBeGreaterThan(0);
    expect(syncedAt).toBeInstanceOf(Date);
  });

  it('returns null without pulling when GitHub is not configured', async () => {
    const { job, fetchCalls } = build({ configured: false });
    const syncedAt = await job.runNow();
    expect(fetchCalls).toHaveLength(0);
    expect(syncedAt).toBeNull();
  });
});
