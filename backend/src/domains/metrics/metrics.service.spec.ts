import { MetricsService } from './metrics.service';
import { PullRequest } from '@/domains/pull-requests/entities/pull-request.entity';
import { PrState, WaitingOn } from '@/domains/pull-requests/pr-enums';

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
      waitRounds: [{ round: 1, reviewerWaitSeconds: 7200, authorWaitSeconds: null }],
    }),
    pr({ isBot: true, waitRounds: [{ round: 1, reviewerWaitSeconds: 999999, authorWaitSeconds: null }] }),
    pr({ isRevert: true, state: PrState.MERGED, cycleTime: 1 }),
    pr({
      state: PrState.OPEN,
      waitingOn: WaitingOn.REVIEWER,
      reviewDueAt: new Date('2026-01-30T00:00:00Z'),
      waitRounds: [{ round: 1, reviewerWaitSeconds: null, authorWaitSeconds: null }],
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
    const round2 = summary.authorWaitByRound.find((m) => m.label.includes('round 2'));
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
});
