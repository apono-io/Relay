import { MetricsService } from './metrics.service';
import { PullRequest } from '@/domains/pull-requests/entities/pull-request.entity';
import { PrState, WaitingOn } from '@/domains/pull-requests/pr-enums';
import { SyncStatusService } from '@/infrastructure/sync/sync-status.service';

const NOW = new Date('2026-02-01T00:00:00Z');

function pr(overrides: Partial<PullRequest>): PullRequest {
  return {
    isBot: false,
    isRevert: false,
    state: PrState.OPEN,
    approvedWithZeroComments: false,
    waitRounds: [],
    waitingOn: WaitingOn.NONE,
    ...overrides,
  } as PullRequest;
}

describe('MetricsService.percentile', () => {
  it('returns null for an empty set', () => {
    expect(MetricsService.percentile([], 0.5)).toBeNull();
  });

  it('returns the single value', () => {
    expect(MetricsService.percentile([5], 0.9)).toBe(5);
  });

  it('computes the median', () => {
    expect(MetricsService.percentile([10, 20, 30, 40], 0.5)).toBe(25);
  });

  it('interpolates the p90', () => {
    expect(MetricsService.percentile([10, 20, 30, 40], 0.9)).toBe(37);
  });
});

describe('MetricsService.buildSummary', () => {
  const prs = [
    pr({
      state: PrState.MERGED,
      cycleTime: 36000,
      waitRounds: [
        { round: 1, reviewerWaitSeconds: 3600, authorWaitSeconds: null },
        { round: 2, reviewerWaitSeconds: 1800, authorWaitSeconds: 7200 },
      ],
    }),
    pr({
      state: PrState.MERGED,
      cycleTime: 72000,
      approvedAt: NOW,
      approvedWithZeroComments: true,
      waitRounds: [
        { round: 1, reviewerWaitSeconds: 7200, authorWaitSeconds: null },
      ],
    }),
    pr({
      isBot: true,
      waitRounds: [
        { round: 1, reviewerWaitSeconds: 999999, authorWaitSeconds: null },
      ],
    }),
    pr({ isRevert: true, state: PrState.MERGED, cycleTime: 1 }),
    pr({
      state: PrState.OPEN,
      waitingOn: WaitingOn.REVIEWER,
      reviewDueAt: new Date('2026-01-30T00:00:00Z'),
      waitRounds: [
        { round: 1, reviewerWaitSeconds: null, authorWaitSeconds: null },
      ],
    }),
  ];

  const summary = MetricsService.buildSummary(prs, NOW);

  it('excludes bots and reverts from prCount', () => {
    expect(summary.prCount).toBe(3);
  });

  it('reports reviewer wait median per round (round 1 labelled pickup)', () => {
    expect(summary.reviewerWaitByRound[0].label).toContain('round 1 (pickup)');
    expect(summary.reviewerWaitByRound[0].medianSeconds).toBe(5400);
    expect(summary.reviewerWaitByRound[0].sampleSize).toBe(2);
    expect(summary.reviewerWaitByRound[1].medianSeconds).toBe(1800);
  });

  it('reports author wait per round', () => {
    const round2 = summary.authorWaitByRound.find((m) =>
      m.label.includes('round 2'),
    );
    expect(round2?.medianSeconds).toBe(7200);
  });

  it('computes cycle median over merged eligible PRs only', () => {
    expect(summary.cycleTime.medianSeconds).toBe(54000);
    expect(summary.cycleTime.sampleSize).toBe(2);
  });

  it('computes quality guardrails', () => {
    expect(summary.quality.revertRate).toBeCloseTo(0.2);
    expect(summary.quality.approvedWithZeroCommentsRate).toBeCloseTo(0.5);
  });

  it('counts SLA misses (reviewer overdue)', () => {
    expect(summary.slaMisses).toBe(1);
  });

  it('returns every waiting PR so urgent rows are never crowded out by stalled ones', () => {
    const many = Array.from({ length: 30 }, (_, i) =>
      pr({
        number: i + 1,
        state: PrState.OPEN,
        waitingOn: WaitingOn.REVIEWER,
        openedAt: new Date('2026-01-31T00:00:00Z'),
      }),
    );
    const result = MetricsService.buildSummary(many, NOW);
    expect(result.stuckNow).toHaveLength(30);
    expect(result.waitingCount).toBe(30);
  });

  it('reports the share of PRs whose pickup exceeded the SLA', () => {
    const withPickups = [
      pr({ state: PrState.MERGED, pickupTime: 3600 }),
      pr({ state: PrState.MERGED, pickupTime: 10800 }),
      pr({ state: PrState.MERGED, pickupTime: 14400 }),
      pr({ state: PrState.MERGED, pickupTime: null as unknown as number }),
    ];
    const result = MetricsService.buildSummary(withPickups, NOW, [], 120);
    expect(result.slaMissRate).toBeCloseTo(2 / 3);
  });
});

describe('MetricsService.weeklyPhases', () => {
  const wk1a = new Date('2026-01-05T00:00:00Z');
  const wk1b = new Date('2026-01-07T00:00:00Z');
  const wk2 = new Date('2026-01-14T00:00:00Z');

  it('buckets merged PRs by ISO week and medians each phase', () => {
    const points = MetricsService.weeklyPhases([
      pr({
        state: PrState.MERGED,
        mergedAt: wk1a,
        codingTime: 100,
        pickupTime: 200,
        reworkTime: 0,
        mergeTime: 50,
      }),
      pr({
        state: PrState.MERGED,
        mergedAt: wk1b,
        codingTime: 300,
        pickupTime: 400,
        reworkTime: 10,
        mergeTime: 150,
      }),
      pr({
        state: PrState.MERGED,
        mergedAt: wk2,
        codingTime: 999,
        pickupTime: 1,
        reworkTime: 1,
        mergeTime: 1,
      }),
    ]);
    expect(points).toHaveLength(2);
    expect(points[0].week).toBe(MetricsService.isoWeek(wk1a));
    expect(points[0].prCount).toBe(2);
    expect(points[0].codingSeconds).toBe(200);
    expect(points[0].pickupSeconds).toBe(300);
    expect(points[1].week).toBe(MetricsService.isoWeek(wk2));
    expect(points[1].prCount).toBe(1);
  });

  it('ignores open PRs', () => {
    const points = MetricsService.weeklyPhases([
      pr({ state: PrState.OPEN, mergedAt: undefined }),
    ]);
    expect(points).toHaveLength(0);
  });
});

describe('MetricsService.stuckNow', () => {
  const now = new Date('2026-02-01T00:00:00Z');
  const slaMinutes = 120;

  it('lists open non-draft waiting PRs sorted by wait descending', () => {
    const stuck = MetricsService.stuckNow(
      [
        pr({
          repo: 'o/r',
          number: 1,
          title: 'a',
          url: 'u1',
          authorLogin: 'alice',
          state: PrState.OPEN,
          waitingOn: WaitingOn.REVIEWER,
          openedAt: new Date('2026-01-31T00:00:00Z'),
          requestedReviewers: ['bob'],
          reviewDueAt: new Date('2026-01-31T12:00:00Z'),
        }),
        pr({
          repo: 'o/r',
          number: 2,
          title: 'b',
          url: 'u2',
          authorLogin: 'carol',
          state: PrState.OPEN,
          waitingOn: WaitingOn.AUTHOR,
          openedAt: new Date('2026-01-20T00:00:00Z'),
        }),
        pr({ state: PrState.OPEN, waitingOn: WaitingOn.NONE, openedAt: now }),
        pr({
          state: PrState.OPEN,
          isDraft: true,
          waitingOn: WaitingOn.REVIEWER,
          openedAt: now,
        }),
        pr({
          state: PrState.MERGED,
          waitingOn: WaitingOn.REVIEWER,
          openedAt: now,
        }),
      ],
      now,
      slaMinutes,
    );
    expect(stuck.map((s) => s.number)).toEqual([2, 1]);
    expect(stuck[1].slaBreached).toBe(true);
    expect(stuck[1].requestedReviewers).toEqual(['bob']);
    expect(stuck[0].slaBreached).toBe(false);
  });

  it('reports the current round wait for reviewer rows, derived from reviewDueAt minus the SLA', () => {
    const stuck = MetricsService.stuckNow(
      [
        pr({
          number: 1,
          state: PrState.OPEN,
          waitingOn: WaitingOn.REVIEWER,
          openedAt: new Date('2026-01-20T00:00:00Z'),
          reviewDueAt: new Date('2026-01-31T12:00:00Z'),
        }),
      ],
      now,
      slaMinutes,
    );
    expect(stuck[0].waitingSeconds).toBe(50400);
  });

  it('reports seconds until the review is due, negative when overdue', () => {
    const stuck = MetricsService.stuckNow(
      [
        pr({
          number: 1,
          state: PrState.OPEN,
          waitingOn: WaitingOn.REVIEWER,
          openedAt: new Date('2026-01-31T00:00:00Z'),
          reviewDueAt: new Date('2026-02-01T01:00:00Z'),
        }),
        pr({
          number: 2,
          state: PrState.OPEN,
          waitingOn: WaitingOn.REVIEWER,
          openedAt: new Date('2026-01-31T00:00:00Z'),
          reviewDueAt: new Date('2026-01-31T22:00:00Z'),
        }),
        pr({
          number: 3,
          state: PrState.OPEN,
          waitingOn: WaitingOn.AUTHOR,
          openedAt: new Date('2026-01-31T00:00:00Z'),
        }),
      ],
      now,
      slaMinutes,
    );
    expect(stuck.find((s) => s.number === 1)?.dueInSeconds).toBe(3600);
    expect(stuck.find((s) => s.number === 2)?.dueInSeconds).toBe(-7200);
    expect(stuck.find((s) => s.number === 3)?.dueInSeconds).toBeNull();
  });

  it('keeps open-age for author rows and reviewer rows without a due date', () => {
    const stuck = MetricsService.stuckNow(
      [
        pr({
          number: 1,
          state: PrState.OPEN,
          waitingOn: WaitingOn.AUTHOR,
          openedAt: new Date('2026-01-31T00:00:00Z'),
        }),
        pr({
          number: 2,
          state: PrState.OPEN,
          waitingOn: WaitingOn.REVIEWER,
          openedAt: new Date('2026-01-30T00:00:00Z'),
          reviewDueAt: undefined,
        }),
      ],
      now,
      slaMinutes,
    );
    expect(stuck.find((s) => s.number === 1)?.waitingSeconds).toBe(86400);
    expect(stuck.find((s) => s.number === 2)?.waitingSeconds).toBe(172800);
  });

  it('exposes the current round number from waitRounds, defaulting to 1', () => {
    const stuck = MetricsService.stuckNow(
      [
        pr({
          number: 1,
          state: PrState.OPEN,
          waitingOn: WaitingOn.REVIEWER,
          openedAt: new Date('2026-01-31T00:00:00Z'),
          reviewDueAt: new Date('2026-01-31T12:00:00Z'),
          waitRounds: [
            { round: 1, reviewerWaitSeconds: 3600, authorWaitSeconds: 600 },
            { round: 2, reviewerWaitSeconds: null, authorWaitSeconds: null },
          ],
        }),
        pr({
          number: 2,
          state: PrState.OPEN,
          waitingOn: WaitingOn.AUTHOR,
          openedAt: new Date('2026-01-31T00:00:00Z'),
        }),
      ],
      now,
      slaMinutes,
    );
    expect(stuck.find((s) => s.number === 1)?.roundNumber).toBe(2);
    expect(stuck.find((s) => s.number === 2)?.roundNumber).toBe(1);
  });
});

describe('MetricsService.fairness', () => {
  it('counts reviews per login sorted descending', () => {
    expect(
      MetricsService.fairness(['bob', 'alice', 'bob', 'bob', 'alice']),
    ).toEqual([
      { login: 'bob', reviewCount: 3 },
      { login: 'alice', reviewCount: 2 },
    ]);
  });

  it('returns empty for no reviews', () => {
    expect(MetricsService.fairness([])).toEqual([]);
  });

  it('excludes bot-roster logins and [bot] suffixed logins', () => {
    const bots = new Set(['claude', 'github-code-quality']);
    expect(
      MetricsService.fairness(
        ['bob', 'claude', 'Claude', 'renovate[bot]', 'bob'],
        bots,
      ),
    ).toEqual([{ login: 'bob', reviewCount: 2 }]);
  });
});

describe('MetricsService.qualityTrend', () => {
  const wk1 = new Date('2026-01-05T00:00:00Z');

  it('computes per-week revert and zero-comment rates over merged PRs', () => {
    const trend = MetricsService.qualityTrend([
      pr({ state: PrState.MERGED, mergedAt: wk1, isRevert: true }),
      pr({
        state: PrState.MERGED,
        mergedAt: wk1,
        approvedWithZeroComments: true,
      }),
      pr({ state: PrState.OPEN, mergedAt: undefined }),
    ]);
    expect(trend).toHaveLength(1);
    expect(trend[0].prCount).toBe(2);
    expect(trend[0].revertRate).toBeCloseTo(0.5);
    expect(trend[0].approvedWithZeroCommentsRate).toBeCloseTo(0.5);
  });
});

describe('MetricsService.dashboard sync time', () => {
  function service(overrides: { syncedAt?: Date; latestEventAt?: Date } = {}) {
    const prRepo = { find: () => Promise.resolve([]) };
    const chain: any = {};
    chain.innerJoin = () => chain;
    chain.select = () => chain;
    chain.where = () => chain;
    chain.andWhere = () => chain;
    chain.getRawMany = () => Promise.resolve([]);
    const eventRepo = {
      createQueryBuilder: () => chain,
      find: () =>
        Promise.resolve(
          overrides.latestEventAt
            ? [{ createdAt: overrides.latestEventAt }]
            : [],
        ),
    };
    const configService = { get: () => undefined };
    const syncStatus = new SyncStatusService();
    if (overrides.syncedAt) {
      syncStatus.markSynced(overrides.syncedAt);
    }
    return new MetricsService(
      prRepo as any,
      eventRepo as any,
      configService as any,
      syncStatus,
    );
  }

  it('exposes the sync time once a pull has run', async () => {
    const syncedAt = new Date('2026-02-01T10:00:00Z');
    const summary = await service({ syncedAt }).dashboard(undefined, NOW);
    expect(summary.lastSyncedAt).toEqual(syncedAt);
  });

  it('falls back to the latest ingested event before the first pull', async () => {
    const latestEventAt = new Date('2026-01-31T22:00:00Z');
    const summary = await service({ latestEventAt }).dashboard(undefined, NOW);
    expect(summary.lastSyncedAt).toEqual(latestEventAt);
  });

  it('is null when nothing has ever been ingested', async () => {
    const summary = await service().dashboard(undefined, NOW);
    expect(summary.lastSyncedAt).toBeNull();
  });
});
