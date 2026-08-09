import {
  ReviewRow,
  dedupeReviewsPerPr,
  recentReviewCounts,
  relayPickLoad,
  requestedReviewerLoad,
} from './candidate-stats.logic';

function review(overrides: Partial<ReviewRow>): ReviewRow {
  return {
    actorLogin: 'alon',
    occurredAt: new Date('2026-07-20T10:00:00Z'),
    prId: 'pr-1',
    repo: 'org/app',
    filePaths: ['frontend/src/App.tsx'],
    ...overrides,
  };
}

describe('requestedReviewerLoad', () => {
  it('counts open review requests per login, case-insensitively', () => {
    const load = requestedReviewerLoad([
      { requestedReviewers: ['Alon', 'dana'] },
      { requestedReviewers: ['alon'] },
      { requestedReviewers: [] },
    ]);
    expect(load.get('alon')).toBe(2);
    expect(load.get('dana')).toBe(1);
  });
});

describe('relayPickLoad', () => {
  it('counts every undelivered relay pick per login', () => {
    const load = relayPickLoad(['Adi-Tamir', 'adi-tamir', 'dana']);
    expect(load.get('adi-tamir')).toBe(2);
    expect(load.get('dana')).toBe(1);
  });
});

describe('dedupeReviewsPerPr', () => {
  it('keeps one review per person per pull request, the most recent', () => {
    const early = review({ occurredAt: new Date('2026-07-10T10:00:00Z') });
    const late = review({ occurredAt: new Date('2026-07-21T10:00:00Z') });
    const otherPr = review({ prId: 'pr-2' });
    const deduped = dedupeReviewsPerPr([early, late, otherPr]);
    expect(deduped).toHaveLength(2);
    expect(
      deduped.find((row) => row.prId === 'pr-1')?.occurredAt,
    ).toEqual(late.occurredAt);
  });

  it('treats login casing as the same person', () => {
    const deduped = dedupeReviewsPerPr([
      review({ actorLogin: 'Alon' }),
      review({ actorLogin: 'alon' }),
    ]);
    expect(deduped).toHaveLength(1);
  });
});

describe('recentReviewCounts', () => {
  it('counts only reviews at or after the cutoff', () => {
    const cutoff = new Date('2026-07-15T00:00:00Z');
    const counts = recentReviewCounts(
      [
        review({ occurredAt: new Date('2026-07-20T10:00:00Z') }),
        review({
          prId: 'pr-2',
          occurredAt: new Date('2026-07-01T10:00:00Z'),
        }),
        review({
          actorLogin: 'Dana',
          prId: 'pr-3',
          occurredAt: new Date('2026-07-16T10:00:00Z'),
        }),
      ],
      cutoff,
    );
    expect(counts.get('alon')).toBe(1);
    expect(counts.get('dana')).toBe(1);
  });
});
