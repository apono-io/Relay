import {
  buildPerformance,
  PerformanceRow,
} from './assignment-performance.logic';

function row(overrides: Partial<PerformanceRow> = {}): PerformanceRow {
  return {
    generatedAt: new Date('2026-03-02T10:00:00Z'),
    resolvedAt: null,
    matched: null,
    assignedAt: null,
    assignedTrigger: null,
    shadow: null,
    area: null,
    pickedName: 'Adi Tamir',
    ...overrides,
  };
}

describe('buildPerformance', () => {
  it('returns empty aggregates with no rows', () => {
    const result = buildPerformance([], 12);
    expect(result.totals.recorded).toBe(0);
    expect(result.totals.agreementRate).toBeNull();
    expect(result.totals.coverageRate).toBeNull();
    expect(result.totals.medianDecisionSeconds).toBeNull();
    expect(result.weekly).toEqual([]);
    expect(result.byArea).toEqual([]);
    expect(result.spread).toEqual([]);
  });

  it('counts agreement only over decided rows', () => {
    const result = buildPerformance(
      [
        row({ matched: true, resolvedAt: new Date('2026-03-02T11:00:00Z') }),
        row({ matched: false, resolvedAt: new Date('2026-03-02T11:00:00Z') }),
        row(),
      ],
      12,
    );
    expect(result.totals.recorded).toBe(3);
    expect(result.totals.decided).toBe(2);
    expect(result.totals.agreements).toBe(1);
    expect(result.totals.agreementRate).toBeCloseTo(0.5);
    expect(result.totals.awaiting).toBe(1);
  });

  it('separates automatic from manual assignments', () => {
    const result = buildPerformance(
      [
        row({
          assignedAt: new Date('2026-03-02T12:00:00Z'),
          assignedTrigger: 'auto',
          shadow: true,
        }),
        row({
          assignedAt: new Date('2026-03-02T12:00:00Z'),
          assignedTrigger: 'manual',
          shadow: false,
        }),
        row(),
      ],
      12,
    );
    expect(result.totals.assigned).toBe(2);
    expect(result.totals.autoAssigned).toBe(1);
    expect(result.totals.manualAssigned).toBe(1);
    expect(result.totals.liveAssigned).toBe(1);
  });

  it('treats a row without a pick as uncovered', () => {
    const result = buildPerformance([row({ pickedName: null }), row()], 12);
    expect(result.totals.coverageRate).toBeCloseTo(0.5);
    expect(result.totals.peoplePicked).toBe(1);
  });

  it('reports the median decision latency in seconds', () => {
    const result = buildPerformance(
      [
        row({
          matched: true,
          generatedAt: new Date('2026-03-02T10:00:00Z'),
          resolvedAt: new Date('2026-03-02T10:10:00Z'),
        }),
        row({
          matched: false,
          generatedAt: new Date('2026-03-02T10:00:00Z'),
          resolvedAt: new Date('2026-03-02T10:30:00Z'),
        }),
      ],
      12,
    );
    expect(result.totals.medianDecisionSeconds).toBe(1200);
  });

  it('groups rows into weeks starting on Monday', () => {
    const result = buildPerformance(
      [
        row({ generatedAt: new Date('2026-03-03T10:00:00Z') }),
        row({ generatedAt: new Date('2026-03-05T10:00:00Z') }),
        row({ generatedAt: new Date('2026-03-10T10:00:00Z') }),
      ],
      12,
    );
    expect(result.weekly).toHaveLength(2);
    expect(result.weekly[0].recorded).toBe(2);
    expect(result.weekly[1].recorded).toBe(1);
    expect(result.weekly[0].weekStart < result.weekly[1].weekStart).toBe(true);
  });

  it('keeps only the requested number of trailing weeks', () => {
    const rows = [
      row({ generatedAt: new Date('2026-01-05T10:00:00Z') }),
      row({ generatedAt: new Date('2026-01-12T10:00:00Z') }),
      row({ generatedAt: new Date('2026-01-19T10:00:00Z') }),
    ];
    const result = buildPerformance(rows, 2);
    expect(result.weekly).toHaveLength(2);
    expect(result.weekly[0].weekStart).toBe('2026-01-12');
  });

  it('labels an unmapped area as whole repo', () => {
    const result = buildPerformance([row({ area: null })], 12);
    expect(result.byArea[0].area).toBe('Whole repo');
  });

  it('orders areas by how often they came up', () => {
    const result = buildPerformance(
      [
        row({ area: 'Backend Core' }),
        row({ area: 'Portal' }),
        row({ area: 'Portal' }),
      ],
      12,
    );
    expect(result.byArea.map((point) => point.area)).toEqual([
      'Portal',
      'Backend Core',
    ]);
  });

  it('counts how picks spread across people', () => {
    const result = buildPerformance(
      [
        row({ pickedName: 'Adi Tamir' }),
        row({ pickedName: 'Adi Tamir' }),
        row({ pickedName: 'Omer Tal' }),
      ],
      12,
    );
    expect(result.spread).toEqual([
      { displayName: 'Adi Tamir', picks: 2 },
      { displayName: 'Omer Tal', picks: 1 },
    ]);
  });

  it('ignores a negative latency caused by clock skew', () => {
    const result = buildPerformance(
      [
        row({
          matched: true,
          generatedAt: new Date('2026-03-02T10:00:00Z'),
          resolvedAt: new Date('2026-03-02T09:00:00Z'),
        }),
      ],
      12,
    );
    expect(result.totals.medianDecisionSeconds).toBeNull();
  });
});
