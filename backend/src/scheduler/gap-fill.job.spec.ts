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
  fetchFails?: boolean;
  commandsFail?: boolean;
  config?: Record<string, unknown>;
  holdFetch?: Promise<void>;
  holdReconcile?: Promise<void>;
  reconcileFails?: boolean;
  failRepos?: string[];
};

function build(deps: Deps = {}) {
  const lookbackHours = deps.lookbackHours ?? 24;
  const repos = deps.repos ?? ['apono-io/apono-mono'];
  const pagesByRepo = deps.pages ?? {};
  const staleNumbersByRepo = deps.staleNumbers ?? {};
  const staleNodesByRepo = deps.staleNodes ?? {};

  const fetchCalls: { repo: string; opts: any }[] = [];
  const callLog: string[] = [];
  const fetchByNumberCalls: { repo: string; numbers: number[] }[] = [];
  const persistCalls: {
    header: NormalizedPullRequest;
    events: NormalizedEvent[];
    source?: PrEventSource;
  }[] = [];

  const configService = {
    get: (key: string) =>
      key === 'GAP_FILL_LOOKBACK_HOURS' ? lookbackHours : deps.config?.[key],
  };

  const github = {
    isConfigured: () => deps.configured ?? true,
    fetchPullRequestTimelines: (repo: string, opts: any) => {
      fetchCalls.push({ repo, opts });
      callLog.push('fetch');
      if (deps.failRepos?.includes(repo)) {
        return Promise.reject(new Error('GitHub is down'));
      }
      if (deps.fetchFails) {
        return Promise.reject(new Error('GitHub is down'));
      }
      if (deps.holdFetch) {
        const queue = pagesByRepo[repo] ?? [page([])];
        return deps.holdFetch.then(() => queue[0]);
      }
      const queue = pagesByRepo[repo] ?? [page([])];
      const idx = fetchCalls.filter((c) => c.repo === repo).length - 1;
      return Promise.resolve(queue[Math.min(idx, queue.length - 1)]);
    },
    fetchPullRequestTimelinesByNumbers: (repo: string, numbers: number[]) => {
      fetchByNumberCalls.push({ repo, numbers });
      callLog.push('reconcile');
      if (deps.reconcileFails) {
        return Promise.reject(new Error('GitHub is down'));
      }
      if (deps.holdReconcile) {
        return deps.holdReconcile.then(() => []);
      }
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

  const logger = { log: () => {}, warn: () => {}, error: () => {} };
  const commands = {
    processPending: jest.fn(() => {
      callLog.push('commands');
      return deps.commandsFail
        ? Promise.reject(new Error('command store unavailable'))
        : Promise.resolve({
            assigned: 0,
            skipped: 0,
            refused: 0,
            notAuthor: 0,
            ignored: 0,
          });
    }),
  };

  const settingsRepo = {
    findOne: () => Promise.resolve(null),
    save: () => Promise.resolve(undefined),
    create: (value: unknown) => value,
  };
  const syncStatus = new SyncStatusService(settingsRepo as never);
  const schedulerRegistry = { addInterval: jest.fn() };
  const job = new GapFillJob(
    configService as any,
    github as any,
    normalizer as any,
    ingest as any,
    pullRequests as any,
    logger as any,
    syncStatus,
    schedulerRegistry as any,
    commands as any,
  );
  return {
    job,
    fetchCalls,
    fetchByNumberCalls,
    persistCalls,
    syncStatus,
    commands,
    callLog,
  };
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
    const summary = await job.reconcile(NOW);
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
    await job.reconcile(NOW);
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
    const summary = await job.reconcile(NOW);
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

  it('resumes from just before the last sync when it is fresh', async () => {
    const { job, syncStatus, persistCalls } = build({
      lookbackHours: 24,
      pages: {
        'apono-io/apono-mono': [
          page([
            node(1, '2026-07-07T11:58:00Z'), // after the last sync
            node(2, '2026-07-07T11:52:00Z'), // inside the 5-minute overlap
            node(3, '2026-07-07T11:00:00Z'), // already seen by earlier syncs
          ]),
        ],
      },
      insertedPerPr: 1,
    });
    await syncStatus.markSynced(new Date('2026-07-07T11:55:00Z'));
    await job.pull(NOW);
    expect(persistCalls.map((c) => c.header.number)).toEqual([1, 2]);
  });

  it('the re-check still covers the full lookback window when the last sync is fresh', async () => {
    let cutoffSeen: Date | null = null;
    const { job, syncStatus } = build({ lookbackHours: 24 });
    (job as any).pullRequests.findOpenNumbersUpdatedBefore = (
      _repo: string,
      cutoff: Date,
    ) => {
      cutoffSeen = cutoff;
      return Promise.resolve([]);
    };
    await syncStatus.markSynced(new Date('2026-07-07T11:55:00Z'));
    await job.reconcile(NOW);
    expect(cutoffSeen).toEqual(new Date('2026-07-06T12:00:00Z'));
  });

  it('a failing repo does not stop the others, and the sync is not marked done', async () => {
    const { job, persistCalls, syncStatus, commands } = build({
      repos: ['org/broken', 'org/ok'],
      pages: {
        'org/ok': [page([node(2, '2026-07-07T11:59:00Z')])],
      },
      failRepos: ['org/broken'],
      insertedPerPr: 1,
    });
    await expect(job.pull(NOW)).rejects.toThrow('org/broken');
    expect(persistCalls.map((c) => c.header.repo)).toEqual(['org/ok']);
    expect(commands.processPending).toHaveBeenCalled();
    expect(syncStatus.lastSyncedAt).toBeNull();
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

describe('GapFillJob.run and @relay commands', () => {
  it('processes commands after a successful pull', async () => {
    const { job, commands } = build();
    await job.run();
    expect(commands.processPending).toHaveBeenCalledTimes(1);
  });

  it('still handles stored commands when GitHub fails, without marking the sync done', async () => {
    const { job, commands, syncStatus } = build({ fetchFails: true });
    await job.run();
    expect(commands.processPending).toHaveBeenCalledTimes(1);
    expect(syncStatus.lastSyncedAt).toBeNull();
  });

  it('a command failure does not fail the sync', async () => {
    const { job, syncStatus } = build({ commandsFail: true });
    await expect(job.run()).resolves.toBeUndefined();
    expect(syncStatus.lastSyncedAt).not.toBeNull();
  });

  it('runNow also processes commands', async () => {
    const { job, commands } = build();
    await job.runNow();
    expect(commands.processPending).toHaveBeenCalledTimes(1);
  });
});

describe('GapFillJob speed', () => {
  it('handles a new command as soon as its page is ingested', async () => {
    const { job, callLog } = build({
      pages: {
        'apono-io/apono-mono': [
          page([node(1, '2026-07-07T11:59:00Z')], true, 'c1'),
          page([node(2, '2026-07-07T11:00:00Z')]),
        ],
      },
      staleNumbers: { 'apono-io/apono-mono': [9] },
      insertedPerPr: 1,
    });
    await job.pull(NOW);
    expect(callLog.slice(0, 3)).toEqual(['fetch', 'commands', 'fetch']);
  });

  it('does not look for commands after a page that stored nothing new', async () => {
    const { job, commands } = build({
      pages: {
        'apono-io/apono-mono': [page([node(1, '2026-07-07T11:59:00Z')])],
      },
      insertedPerPr: 0,
    });
    await job.pull(NOW);
    expect(commands.processPending).toHaveBeenCalledTimes(1);
  });

  it('the recent-PR scan never waits on the re-check of older open PRs', async () => {
    const { job, fetchByNumberCalls } = build({
      staleNumbers: { 'apono-io/apono-mono': [9] },
    });
    await job.pull(NOW);
    expect(fetchByNumberCalls).toHaveLength(0);
  });

  it('runs the re-check on its own 10-minute timer', () => {
    jest.useFakeTimers();
    const spy = jest.spyOn(global, 'setInterval');
    try {
      const { job } = build({ configured: false });
      job.onModuleInit();
      expect(spy).toHaveBeenCalledWith(expect.any(Function), 10 * 60_000);
    } finally {
      spy.mockRestore();
      jest.clearAllTimers();
      jest.useRealTimers();
    }
  });

  it('skips a re-check while the previous one is still going', async () => {
    let release!: () => void;
    const holdReconcile = new Promise<void>((resolve) => (release = resolve));
    const { job, fetchByNumberCalls } = build({
      staleNumbers: { 'apono-io/apono-mono': [9] },
      holdReconcile,
    });
    const first = job.runReconcile();
    const second = job.runReconcile();
    release();
    await Promise.all([first, second]);
    expect(fetchByNumberCalls).toHaveLength(1);
  });

  it('a re-check failure is logged, not thrown', async () => {
    const { job } = build({
      staleNumbers: { 'apono-io/apono-mono': [9] },
      reconcileFails: true,
    });
    await expect(job.runReconcile()).resolves.toBeUndefined();
  });

  it('skips a scheduled run while the previous one is still going', async () => {
    let release!: () => void;
    const holdFetch = new Promise<void>((resolve) => (release = resolve));
    const { job, fetchCalls } = build({ holdFetch });
    const first = job.run();
    await job.run();
    expect(fetchCalls).toHaveLength(1);
    release();
    await first;
  });

  it('a manual sync waits for the run in flight instead of starting another', async () => {
    let release!: () => void;
    const holdFetch = new Promise<void>((resolve) => (release = resolve));
    const { job, fetchCalls, syncStatus } = build({ holdFetch });
    const scheduled = job.run();
    const manual = job.runNow();
    release();
    await scheduled;
    await expect(manual).resolves.toEqual(syncStatus.lastSyncedAt);
    expect(fetchCalls).toHaveLength(1);
  });

  it('reads the interval in seconds when GAP_FILL_INTERVAL_SECONDS is set', () => {
    jest.useFakeTimers();
    const spy = jest.spyOn(global, 'setInterval');
    try {
      const { job } = build({
        config: { GAP_FILL_INTERVAL_SECONDS: 20 },
        configured: false,
      });
      job.onModuleInit();
      expect(spy).toHaveBeenCalledWith(expect.any(Function), 20_000);
    } finally {
      spy.mockRestore();
      jest.clearAllTimers();
      jest.useRealTimers();
    }
  });
});
