import {
  AssignmentEngine,
  Candidate,
  DEFAULT_ENGINE_CONFIG,
  EngineConfig,
  RankInput,
} from './assignment-engine';

const NOW = new Date('2026-07-01T00:00:00Z');

const RULES = [
  { pattern: 'frontend/**', area: 'Frontend', risk: 2 },
  { pattern: 'backend/**', area: 'Backend', risk: 3 },
  { pattern: 'backend/src/core/auth/**', area: 'Auth', risk: 5 },
];

function candidate(overrides: Partial<Candidate>): Candidate {
  return {
    personId: 'p-default',
    displayName: 'Default',
    logins: ['default'],
    active: true,
    masteryByArea: {},
    openReviewRequests: 0,
    activeRelayPicks: 0,
    reviewsLast14Days: 0,
    ...overrides,
  };
}

function rankInput(overrides: Partial<RankInput>): RankInput {
  return {
    authorPersonId: 'p-author',
    authorLogin: 'author',
    requestedReviewers: [],
    area: { area: 'Frontend', risk: 2 },
    candidates: [],
    ...overrides,
  };
}

describe('AssignmentEngine.classify', () => {
  it('matches a folder glob against file paths', () => {
    const match = AssignmentEngine.classify(
      ['frontend/src/pages/App.tsx'],
      RULES,
    );
    expect(match).toEqual({ area: 'Frontend', risk: 2 });
  });

  it('picks the highest-risk matching rule', () => {
    const match = AssignmentEngine.classify(
      ['frontend/src/App.tsx', 'backend/src/core/auth/guard.ts'],
      RULES,
    );
    expect(match).toEqual({ area: 'Auth', risk: 5 });
  });

  it('breaks a risk tie by pattern order deterministically', () => {
    const rules = [
      { pattern: 'b/**', area: 'B', risk: 2 },
      { pattern: 'a/**', area: 'A', risk: 2 },
    ];
    const match = AssignmentEngine.classify(['a/x.ts', 'b/y.ts'], rules);
    expect(match.area).toBe('A');
  });

  it('prefers the more specific pattern when risks are equal', () => {
    const rules = [
      { pattern: 'backend/**', area: 'Backend', risk: 2 },
      { pattern: 'backend/java/ms/assistant/**', area: 'Assistant', risk: 2 },
    ];
    const match = AssignmentEngine.classify(
      ['backend/java/ms/assistant/src/tool.kt', 'backend/java/core/db.kt'],
      rules,
    );
    expect(match.area).toBe('Assistant');
  });

  it('falls back to no area at default risk when nothing matches', () => {
    const match = AssignmentEngine.classify(
      ['docs/readme.md'],
      [{ pattern: 'frontend/**', area: 'Frontend', risk: 2 }],
    );
    expect(match).toEqual({ area: null, risk: 2 });
  });

  it('does not let a single star cross directory boundaries', () => {
    expect(AssignmentEngine.matchesPattern('frontend/*', 'frontend/a.ts')).toBe(
      true,
    );
    expect(
      AssignmentEngine.matchesPattern('frontend/*', 'frontend/src/a.ts'),
    ).toBe(false);
  });
});

describe('AssignmentEngine.matchAreas', () => {
  it('returns every distinct area the paths touch', () => {
    const areas = AssignmentEngine.matchAreas(
      ['frontend/src/App.tsx', 'backend/src/api.ts'],
      RULES,
    );
    expect(areas).toEqual(['Backend', 'Frontend']);
  });
});

describe('AssignmentEngine.recencyWeight', () => {
  it('weighs fresh activity fully', () => {
    expect(AssignmentEngine.recencyWeight(NOW, NOW)).toBe(1);
  });

  it('halves the weight at the half-life', () => {
    const sixtyDaysAgo = new Date('2026-05-02T00:00:00Z');
    expect(AssignmentEngine.recencyWeight(sixtyDaysAgo, NOW)).toBeCloseTo(0.5);
  });

  it('drops activity older than the window', () => {
    const old = new Date('2025-12-01T00:00:00Z');
    expect(AssignmentEngine.recencyWeight(old, NOW)).toBe(0);
  });
});

describe('AssignmentEngine.buildMastery', () => {
  it('credits every area an activity touches, with recency decay', () => {
    const mastery = AssignmentEngine.buildMastery(
      [
        {
          login: 'Alon',
          repo: 'org/app',
          filePaths: ['frontend/src/App.tsx', 'backend/src/api.ts'],
          occurredAt: NOW,
        },
        {
          login: 'alon',
          repo: 'org/app',
          filePaths: ['frontend/src/Page.tsx'],
          occurredAt: new Date('2026-05-02T00:00:00Z'),
        },
      ],
      { 'org/app': RULES },
      NOW,
    );
    const byArea = mastery.get('alon')!;
    expect(byArea.Frontend).toBeCloseTo(1.5);
    expect(byArea.Backend).toBeCloseTo(1);
  });

  it('applies only the rules of the activity repo', () => {
    const mastery = AssignmentEngine.buildMastery(
      [
        {
          login: 'alon',
          repo: 'org/other',
          filePaths: ['frontend/src/App.tsx'],
          occurredAt: NOW,
        },
      ],
      { 'org/app': RULES },
      NOW,
    );
    expect(mastery.get('alon')).toBeUndefined();
  });
});

describe('AssignmentEngine.rank hard filters', () => {
  const base = candidate({
    personId: 'p1',
    displayName: 'Alon',
    logins: ['alon'],
  });

  it('excludes inactive people', () => {
    const result = AssignmentEngine.rank(
      rankInput({ candidates: [{ ...base, active: false }] }),
    );
    expect(result.ranked).toEqual([]);
  });

  it('excludes people whose assignment mode is off', () => {
    const result = AssignmentEngine.rank(
      rankInput({ candidates: [{ ...base, assignmentMode: 'off' }] }),
    );
    expect(result.ranked).toEqual([]);
  });

  it('keeps people with no mode set', () => {
    const result = AssignmentEngine.rank(rankInput({ candidates: [base] }));
    expect(result.ranked).toHaveLength(1);
  });

  it('excludes people without a linked GitHub identity', () => {
    const result = AssignmentEngine.rank(
      rankInput({ candidates: [{ ...base, logins: [] }] }),
    );
    expect(result.ranked).toEqual([]);
  });

  it('excludes already-requested reviewers, case-insensitively', () => {
    const result = AssignmentEngine.rank(
      rankInput({ candidates: [base], requestedReviewers: ['ALON'] }),
    );
    expect(result.ranked).toEqual([]);
  });

  it('excludes the author at the person level, across second accounts', () => {
    const result = AssignmentEngine.rank(
      rankInput({
        authorPersonId: 'p1',
        authorLogin: 'alon-bot',
        candidates: [base],
      }),
    );
    expect(result.ranked).toEqual([]);
  });

  it('excludes the author by login when no person is linked', () => {
    const result = AssignmentEngine.rank(
      rankInput({
        authorPersonId: null,
        authorLogin: 'Alon',
        candidates: [base],
      }),
    );
    expect(result.ranked).toEqual([]);
  });
});

describe('AssignmentEngine.rank ordering', () => {
  it('prefers mastery in the PR area', () => {
    const result = AssignmentEngine.rank(
      rankInput({
        candidates: [
          candidate({
            personId: 'p1',
            displayName: 'Novice',
            logins: ['novice'],
          }),
          candidate({
            personId: 'p2',
            displayName: 'Expert',
            logins: ['expert'],
            masteryByArea: { Frontend: 5 },
          }),
        ],
      }),
    );
    expect(result.picks[0].displayName).toBe('Expert');
  });

  it('prefers the freer reviewer when mastery is equal', () => {
    const result = AssignmentEngine.rank(
      rankInput({
        candidates: [
          candidate({
            personId: 'p1',
            displayName: 'Busy',
            logins: ['busy'],
            masteryByArea: { Frontend: 3 },
            openReviewRequests: 4,
          }),
          candidate({
            personId: 'p2',
            displayName: 'Free',
            logins: ['free'],
            masteryByArea: { Frontend: 3 },
          }),
        ],
      }),
    );
    expect(result.picks[0].displayName).toBe('Free');
  });

  it('prefers whoever reviewed least lately as the last tie-break', () => {
    const result = AssignmentEngine.rank(
      rankInput({
        candidates: [
          candidate({
            personId: 'p1',
            displayName: 'Loaded',
            logins: ['loaded'],
            reviewsLast14Days: 6,
          }),
          candidate({
            personId: 'p2',
            displayName: 'Rested',
            logins: ['rested'],
          }),
        ],
      }),
    );
    expect(result.picks[0].displayName).toBe('Rested');
  });

  it('shifts weight toward mastery on a high-risk area', () => {
    const expert = candidate({
      personId: 'p1',
      displayName: 'Expert',
      logins: ['expert'],
      masteryByArea: { Auth: 5 },
      openReviewRequests: 3,
      reviewsLast14Days: 5,
    });
    const free = candidate({
      personId: 'p2',
      displayName: 'Free',
      logins: ['free'],
      masteryByArea: { Auth: 1 },
    });
    const lowRisk = AssignmentEngine.rank(
      rankInput({
        area: { area: 'Auth', risk: 1 },
        candidates: [expert, free],
      }),
    );
    const highRisk = AssignmentEngine.rank(
      rankInput({
        area: { area: 'Auth', risk: 5 },
        candidates: [expert, free],
      }),
    );
    expect(lowRisk.picks[0].displayName).toBe('Free');
    expect(highRisk.picks[0].displayName).toBe('Expert');
  });

  it('uses overall mastery when the PR matches no area', () => {
    const result = AssignmentEngine.rank(
      rankInput({
        area: { area: null, risk: 2 },
        candidates: [
          candidate({ personId: 'p1', displayName: 'New', logins: ['new'] }),
          candidate({
            personId: 'p2',
            displayName: 'Veteran',
            logins: ['veteran'],
            masteryByArea: { Backend: 2, Frontend: 2 },
          }),
        ],
      }),
    );
    expect(result.picks[0].displayName).toBe('Veteran');
  });

  it('breaks exact ties by display name', () => {
    const result = AssignmentEngine.rank(
      rankInput({
        candidates: [
          candidate({ personId: 'p2', displayName: 'Zoe', logins: ['zoe'] }),
          candidate({ personId: 'p1', displayName: 'Amir', logins: ['amir'] }),
        ],
      }),
    );
    expect(result.ranked.map((r) => r.displayName)).toEqual(['Amir', 'Zoe']);
  });
});

describe('AssignmentEngine.rank picks and levers', () => {
  const config: EngineConfig = {
    ...DEFAULT_ENGINE_CONFIG,
    twoReviewerRiskThreshold: 5,
  };

  it('requires two reviewers at the risk threshold', () => {
    const result = AssignmentEngine.rank(
      rankInput({
        area: { area: 'Auth', risk: 5 },
        config,
        candidates: [
          candidate({ personId: 'p1', displayName: 'One', logins: ['one'] }),
          candidate({ personId: 'p2', displayName: 'Two', logins: ['two'] }),
          candidate({
            personId: 'p3',
            displayName: 'Three',
            logins: ['three'],
          }),
        ],
      }),
    );
    expect(result.requiredReviewers).toBe(2);
    expect(result.picks).toHaveLength(2);
  });

  it('spreads knowledge on low-risk areas when the lever is on', () => {
    const candidates = [
      candidate({
        personId: 'p1',
        displayName: 'Expert',
        logins: ['expert'],
        masteryByArea: { Frontend: 5 },
      }),
      candidate({
        personId: 'p2',
        displayName: 'Second',
        logins: ['second'],
        masteryByArea: { Frontend: 3 },
      }),
    ];
    const off = AssignmentEngine.rank(rankInput({ candidates }));
    const on = AssignmentEngine.rank(
      rankInput({
        candidates,
        config: { ...DEFAULT_ENGINE_CONFIG, knowledgeSpread: true },
      }),
    );
    expect(off.picks[0].displayName).toBe('Expert');
    expect(on.picks[0].displayName).toBe('Second');
  });

  it('keeps the expert first on high-risk areas even with the lever on', () => {
    const result = AssignmentEngine.rank(
      rankInput({
        area: { area: 'Auth', risk: 5 },
        config: { ...DEFAULT_ENGINE_CONFIG, knowledgeSpread: true },
        candidates: [
          candidate({
            personId: 'p1',
            displayName: 'Expert',
            logins: ['expert'],
            masteryByArea: { Auth: 5 },
          }),
          candidate({
            personId: 'p2',
            displayName: 'Second',
            logins: ['second'],
            masteryByArea: { Auth: 3 },
          }),
        ],
      }),
    );
    expect(result.picks[0].displayName).toBe('Expert');
  });
});

describe('AssignmentEngine.rank signals', () => {
  it('reports area rank, pool size, load, and recent reviews per candidate', () => {
    const result = AssignmentEngine.rank(
      rankInput({
        candidates: [
          candidate({
            personId: 'p1',
            displayName: 'Expert',
            logins: ['expert'],
            masteryByArea: { Frontend: 5 },
            openReviewRequests: 2,
            reviewsLast14Days: 3,
          }),
          candidate({
            personId: 'p2',
            displayName: 'Second',
            logins: ['second'],
            masteryByArea: { Frontend: 2 },
          }),
          candidate({
            personId: 'p3',
            displayName: 'Outsider',
            logins: ['outsider'],
          }),
        ],
      }),
    );
    const byName = new Map(
      result.ranked.map((r) => [r.displayName, r.signals]),
    );
    expect(byName.get('Expert')).toEqual({
      areaRank: 1,
      areaPool: 2,
      openReviewRequests: 2,
      reviewsLast14Days: 3,
    });
    expect(byName.get('Second')).toEqual({
      areaRank: 2,
      areaPool: 2,
      openReviewRequests: 0,
      reviewsLast14Days: 0,
    });
    expect(byName.get('Outsider')?.areaRank).toBeNull();
  });
});

describe('AssignmentEngine.rank reasons', () => {
  it('explains a pick with a human sentence and no numbers', () => {
    const result = AssignmentEngine.rank(
      rankInput({
        candidates: [
          candidate({
            personId: 'p1',
            displayName: 'Alon',
            logins: ['alon'],
            masteryByArea: { Frontend: 4 },
          }),
          candidate({
            personId: 'p2',
            displayName: 'Dana',
            logins: ['dana'],
            masteryByArea: { Frontend: 1 },
            openReviewRequests: 2,
            reviewsLast14Days: 3,
          }),
        ],
      }),
    );
    expect(result.picks[0].reason).toBe(
      'worked on Frontend recently and has no open reviews',
    );
    for (const entry of result.ranked) {
      expect(entry.reason).not.toMatch(/\d/);
    }
  });

  it('falls back to a generic sentence when no signal stands out', () => {
    const result = AssignmentEngine.rank(
      rankInput({
        candidates: [
          candidate({
            personId: 'p1',
            displayName: 'Solo',
            logins: ['solo'],
            openReviewRequests: 1,
            reviewsLast14Days: 1,
          }),
        ],
      }),
    );
    expect(result.picks[0].reason).toBe('is available to review');
  });

  it('does not claim the lightest load when the whole pool is equally loaded', () => {
    const result = AssignmentEngine.rank(
      rankInput({
        candidates: [
          candidate({
            personId: 'p1',
            displayName: 'One',
            logins: ['one'],
            openReviewRequests: 2,
            reviewsLast14Days: 3,
          }),
          candidate({
            personId: 'p2',
            displayName: 'Two',
            logins: ['two'],
            openReviewRequests: 2,
            reviewsLast14Days: 3,
          }),
        ],
      }),
    );
    for (const entry of result.ranked) {
      expect(entry.reason).toBe('is available to review');
    }
  });

  it('states only personal facts, never comparisons', () => {
    const result = AssignmentEngine.rank(
      rankInput({
        candidates: [
          candidate({ personId: 'p1', displayName: 'One', logins: ['one'] }),
          candidate({ personId: 'p2', displayName: 'Two', logins: ['two'] }),
        ],
      }),
    );
    for (const entry of result.ranked) {
      expect(entry.reason).toBe('has no open reviews and has not reviewed lately');
      expect(entry.reason).not.toMatch(/best|well|least|lightest|most/);
    }
  });
});

describe('AssignmentEngine.rank repeat-pick damping', () => {
  const pool = (expertPicks: number, expertOpen: number) => [
    candidate({
      personId: 'p1',
      displayName: 'Expert',
      logins: ['expert'],
      masteryByArea: { Frontend: 5 },
      openReviewRequests: expertOpen,
      activeRelayPicks: expertPicks,
      reviewsLast14Days: 11,
    }),
    candidate({
      personId: 'p2',
      displayName: 'Second',
      logins: ['second'],
      masteryByArea: { Frontend: 2 },
      reviewsLast14Days: 7,
    }),
    candidate({
      personId: 'p3',
      displayName: 'Swamped',
      logins: ['swamped'],
      masteryByArea: { Frontend: 1 },
      openReviewRequests: 5,
      reviewsLast14Days: 20,
    }),
  ];

  it('rotates to the next reviewer once the expert holds an undelivered pick', () => {
    const first = AssignmentEngine.rank(rankInput({ candidates: pool(0, 0) }));
    const second = AssignmentEngine.rank(rankInput({ candidates: pool(1, 1) }));
    expect(first.picks[0].displayName).toBe('Expert');
    expect(second.picks[0].displayName).toBe('Second');
  });

  it('still picks the strongest fit when everyone holds a pick', () => {
    const candidates = pool(1, 1).map((entry) => ({
      ...entry,
      activeRelayPicks: 1,
      openReviewRequests: entry.openReviewRequests + 1,
    }));
    const result = AssignmentEngine.rank(rankInput({ candidates }));
    expect(result.picks[0].displayName).toBe('Expert');
  });
});
