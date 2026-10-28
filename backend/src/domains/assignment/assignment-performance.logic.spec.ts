import {
  buildPerformance,
  PerformanceRow,
} from './assignment-performance.logic';

function row(overrides: Partial<PerformanceRow> = {}): PerformanceRow {
  return {
    shadow: false,
    requestedAt: new Date('2026-03-02T10:00:00Z'),
    requestedLogin: 'adi-tamir',
    firstReviewAt: null,
    reviews: [],
    ...overrides,
  };
}

const hoursAfterRequest = (hours: number) =>
  new Date(new Date('2026-03-02T10:00:00Z').getTime() + hours * 3_600_000);

describe('buildPerformance', () => {
  it('returns empty numbers with no requests', () => {
    expect(buildPerformance([], 12)).toEqual({
      requested: 0,
      reviewed: 0,
      reviewedByPick: 0,
      pickReviewedRate: null,
      medianFirstReviewSeconds: null,
      weekly: [],
    });
  });

  it('counts only reviews Relay requested on GitHub, while Actually assign was on', () => {
    const result = buildPerformance(
      [
        row(),
        row({ shadow: true, firstReviewAt: hoursAfterRequest(1) }),
        row({ shadow: null, firstReviewAt: hoursAfterRequest(1) }),
      ],
      12,
    );
    expect(result.requested).toBe(1);
    expect(result.reviewed).toBe(0);
    expect(result.medianFirstReviewSeconds).toBeNull();
  });

  it('measures the first review from the moment Relay requested it', () => {
    const result = buildPerformance(
      [
        row({ firstReviewAt: hoursAfterRequest(1) }),
        row({ firstReviewAt: hoursAfterRequest(2) }),
        row({ firstReviewAt: hoursAfterRequest(5) }),
        row(),
      ],
      12,
    );
    expect(result.reviewed).toBe(3);
    expect(result.medianFirstReviewSeconds).toBe(7200);
  });

  it('does not count a review that came before the request', () => {
    const result = buildPerformance(
      [row({ firstReviewAt: hoursAfterRequest(-1) })],
      12,
    );
    expect(result.reviewed).toBe(0);
    expect(result.medianFirstReviewSeconds).toBeNull();
  });

  it('shares reviewed-by-the-pick over the requests that got a review', () => {
    const result = buildPerformance(
      [
        row({
          firstReviewAt: hoursAfterRequest(1),
          reviews: [{ login: 'Adi-Tamir', at: hoursAfterRequest(1) }],
        }),
        row({
          firstReviewAt: hoursAfterRequest(1),
          reviews: [
            { login: 'omer-tal', at: hoursAfterRequest(1) },
            { login: 'adi-tamir', at: hoursAfterRequest(3) },
          ],
        }),
        row({
          firstReviewAt: hoursAfterRequest(1),
          reviews: [{ login: 'omer-tal', at: hoursAfterRequest(1) }],
        }),
        row(),
      ],
      12,
    );
    expect(result.reviewed).toBe(3);
    expect(result.reviewedByPick).toBe(2);
    expect(result.pickReviewedRate).toBeCloseTo(2 / 3);
  });

  it("does not count the pick's review from before the request", () => {
    const result = buildPerformance(
      [
        row({
          firstReviewAt: hoursAfterRequest(1),
          reviews: [
            { login: 'adi-tamir', at: hoursAfterRequest(-2) },
            { login: 'omer-tal', at: hoursAfterRequest(1) },
          ],
        }),
      ],
      12,
    );
    expect(result.reviewedByPick).toBe(0);
  });

  it('groups requests into weeks starting on Monday, with each week’s median', () => {
    const result = buildPerformance(
      [
        row({
          requestedAt: new Date('2026-03-03T10:00:00Z'),
          firstReviewAt: new Date('2026-03-03T11:00:00Z'),
        }),
        row({
          requestedAt: new Date('2026-03-05T10:00:00Z'),
          firstReviewAt: new Date('2026-03-05T13:00:00Z'),
        }),
        row({ requestedAt: new Date('2026-03-10T10:00:00Z') }),
      ],
      12,
    );
    expect(result.weekly).toEqual([
      {
        week: 'Mar 2',
        weekStart: '2026-03-02',
        requested: 2,
        medianFirstReviewSeconds: 7200,
      },
      {
        week: 'Mar 9',
        weekStart: '2026-03-09',
        requested: 1,
        medianFirstReviewSeconds: null,
      },
    ]);
  });

  it('keeps only the trailing weeks it is asked for', () => {
    const result = buildPerformance(
      [
        row({ requestedAt: new Date('2026-01-05T10:00:00Z') }),
        row({ requestedAt: new Date('2026-01-12T10:00:00Z') }),
        row({ requestedAt: new Date('2026-01-19T10:00:00Z') }),
      ],
      2,
    );
    expect(result.weekly.map((point) => point.weekStart)).toEqual([
      '2026-01-12',
      '2026-01-19',
    ]);
  });
});
