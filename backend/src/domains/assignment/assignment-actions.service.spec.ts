import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PrState } from '@/domains/pull-requests/pr-enums';
import { AssignmentModeValue } from '@/domains/people/entities/person-settings.entity';
import { AssignmentActionsService } from './assignment-actions.service';
import { Candidate } from './assignment-engine';
import { CandidateStats } from './candidate-stats.service';

const NOW = new Date('2026-08-03T12:00:00Z');

function chainableQb() {
  const chain: Record<string, jest.Mock> = {};
  const methods = [
    'insert',
    'values',
    'orIgnore',
    'update',
    'set',
    'where',
    'andWhere',
    'orderBy',
    'select',
    'distinct',
    'innerJoin',
  ];
  for (const method of methods) {
    chain[method] = jest.fn().mockReturnValue(chain);
  }
  chain.execute = jest.fn().mockResolvedValue({ affected: 1 });
  chain.getMany = jest.fn().mockResolvedValue([]);
  chain.getRawMany = jest.fn().mockResolvedValue([]);
  return chain;
}

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

function reviewerPool(): Candidate[] {
  return [
    candidate({
      personId: 'p-expert',
      displayName: 'Expert',
      logins: ['expert'],
      masteryByArea: { Frontend: 5 },
      reviewsLast14Days: 11,
    }),
    candidate({
      personId: 'p-second',
      displayName: 'Second',
      logins: ['second'],
      masteryByArea: { Frontend: 2 },
      reviewsLast14Days: 7,
    }),
    candidate({
      personId: 'p-swamped',
      displayName: 'Swamped',
      logins: ['swamped'],
      masteryByArea: { Frontend: 1 },
      openReviewRequests: 5,
      reviewsLast14Days: 20,
    }),
  ];
}

function statsWith(candidates: Candidate[]): CandidateStats {
  return {
    candidates,
    rulesByRepo: {
      'org/app': [{ pattern: 'frontend/**', area: 'Frontend', risk: 2 }],
    },
    personByLogin: new Map([
      ['author', { personId: 'p-author', displayName: 'Author' }],
    ]),
    modeByPersonId: new Map<string, AssignmentModeValue>([
      ['p-author', 'auto'],
    ]),
  };
}

function openPr(overrides: Record<string, unknown> = {}) {
  return {
    id: 'pr-uuid-1',
    repo: 'org/app',
    number: 11405,
    state: PrState.OPEN,
    isDraft: false,
    isBot: false,
    authorLogin: 'author',
    requestedReviewers: [] as string[],
    filePaths: ['frontend/src/App.tsx'],
    openedAt: new Date('2026-08-01T10:00:00Z'),
    createdAt: new Date('2026-08-01T10:00:00Z'),
    ...overrides,
  };
}

function setup() {
  const suggestionQb = chainableQb();
  const suggestionRepo = {
    findOne: jest.fn().mockResolvedValue(null),
    find: jest.fn().mockResolvedValue([]),
    update: jest.fn().mockResolvedValue(undefined),
    createQueryBuilder: jest.fn().mockReturnValue(suggestionQb),
  };
  const prQb = chainableQb();
  const prRepo = {
    findOne: jest.fn().mockResolvedValue(null),
    find: jest.fn().mockResolvedValue([]),
    createQueryBuilder: jest.fn().mockReturnValue(prQb),
  };
  const eventQb = chainableQb();
  const eventRepo = {
    createQueryBuilder: jest.fn().mockReturnValue(eventQb),
  };
  const candidateStats = {
    build: jest.fn().mockResolvedValue(statsWith(reviewerPool())),
  };
  const appSettings = { actuallyAssign: jest.fn().mockResolvedValue(false) };
  const github = {
    requestReviewers: jest.fn().mockResolvedValue(undefined),
    removeRequestedReviewers: jest.fn().mockResolvedValue(undefined),
  };
  const configService = { get: jest.fn() };
  const logger = { log: jest.fn(), warn: jest.fn(), error: jest.fn() };
  const service = new AssignmentActionsService(
    suggestionRepo as never,
    prRepo as never,
    eventRepo as never,
    candidateStats as never,
    appSettings as never,
    github as never,
    configService as never,
    logger as never,
  );
  return {
    service,
    suggestionRepo,
    suggestionQb,
    prRepo,
    prQb,
    eventRepo,
    eventQb,
    candidateStats,
    appSettings,
    github,
    configService,
    logger,
  };
}

describe('AssignmentActionsService.assign guards', () => {
  it('rejects a pull request Relay does not know', async () => {
    const { service } = setup();
    await expect(service.assign('org/app', 999, null)).rejects.toThrow(
      NotFoundException,
    );
  });

  it('rejects a pull request that is no longer open', async () => {
    const { service, prRepo } = setup();
    prRepo.findOne.mockResolvedValue(openPr({ state: PrState.MERGED }));
    await expect(service.assign('org/app', 11405, null)).rejects.toThrow(
      'no longer open',
    );
  });

  it('rejects a draft', async () => {
    const { service, prRepo } = setup();
    prRepo.findOne.mockResolvedValue(openPr({ isDraft: true }));
    await expect(service.assign('org/app', 11405, null)).rejects.toThrow(
      'Drafts',
    );
  });

  it('rejects a pull request that already has a requested reviewer', async () => {
    const { service, prRepo } = setup();
    prRepo.findOne.mockResolvedValue(
      openPr({ requestedReviewers: ['someone'] }),
    );
    await expect(service.assign('org/app', 11405, null)).rejects.toThrow(
      'already has a requested reviewer',
    );
  });

  it('rejects when a human already reviewed', async () => {
    const { service, prRepo, eventQb } = setup();
    prRepo.findOne.mockResolvedValue(openPr());
    eventQb.getRawMany.mockResolvedValue([{ actorLogin: 'human-reviewer' }]);
    await expect(service.assign('org/app', 11405, null)).rejects.toThrow(
      'already reviewed',
    );
  });

  it('ignores bot and author reviews when checking for a human review', async () => {
    const { service, prRepo, eventQb, suggestionQb } = setup();
    prRepo.findOne.mockResolvedValue(openPr());
    eventQb.getRawMany.mockResolvedValue([
      { actorLogin: 'claude' },
      { actorLogin: 'Author' },
    ]);
    const result = await service.assign('org/app', 11405, null);
    expect(result.login).toBe('expert');
    expect(suggestionQb.set).toHaveBeenCalled();
  });

  it('rejects when Relay already assigned someone', async () => {
    const { service, prRepo, suggestionRepo } = setup();
    prRepo.findOne.mockResolvedValue(openPr());
    suggestionRepo.findOne.mockResolvedValue({
      assignedAt: NOW,
      assignedName: 'Expert',
      assignedLogin: 'expert',
    });
    await expect(service.assign('org/app', 11405, null)).rejects.toThrow(
      'already assigned',
    );
  });

  it('rejects when nobody is eligible', async () => {
    const { service, prRepo, candidateStats } = setup();
    prRepo.findOne.mockResolvedValue(openPr());
    candidateStats.build.mockResolvedValue(statsWith([]));
    await expect(service.assign('org/app', 11405, null)).rejects.toThrow(
      'No eligible reviewer',
    );
  });
});

describe('AssignmentActionsService.assign claim', () => {
  it('persists the pick with its reason and signals in shadow mode', async () => {
    const { service, prRepo, suggestionQb, github } = setup();
    prRepo.findOne.mockResolvedValue(openPr());
    const result = await service.assign('org/app', 11405, 'p-actor');
    expect(result).toMatchObject({
      login: 'expert',
      shadow: true,
      trigger: 'manual',
      area: 'Frontend',
    });
    expect(result.signals).toMatchObject({ areaRank: 1, areaPool: 3 });
    expect(suggestionQb.set).toHaveBeenCalledWith(
      expect.objectContaining({
        assignedLogin: 'expert',
        assignedByPersonId: 'p-actor',
        shadow: true,
        assignedReason: expect.stringContaining('Frontend'),
      }),
    );
    expect(github.requestReviewers).not.toHaveBeenCalled();
  });

  it('loses the claim race gracefully without touching GitHub', async () => {
    const { service, prRepo, suggestionQb, appSettings, github } = setup();
    prRepo.findOne.mockResolvedValue(openPr());
    appSettings.actuallyAssign.mockResolvedValue(true);
    suggestionQb.execute.mockResolvedValue({ affected: 0 });
    await expect(service.assign('org/app', 11405, null)).rejects.toThrow(
      BadRequestException,
    );
    expect(github.requestReviewers).not.toHaveBeenCalled();
  });

  it('releases the claim when GitHub refuses the reviewer request', async () => {
    const { service, prRepo, suggestionRepo, appSettings, github } = setup();
    prRepo.findOne.mockResolvedValue(openPr());
    appSettings.actuallyAssign.mockResolvedValue(true);
    github.requestReviewers.mockRejectedValue(new Error('GitHub refused'));
    await expect(service.assign('org/app', 11405, null)).rejects.toThrow(
      'GitHub refused',
    );
    expect(suggestionRepo.update).toHaveBeenCalledWith(
      { prId: 'pr-uuid-1' },
      expect.objectContaining({ assignedLogin: null, assignedAt: null }),
    );
  });

  it('refuses to assign on GitHub when the author has assignment off', async () => {
    const { service, prRepo, suggestionRepo, appSettings, candidateStats } =
      setup();
    prRepo.findOne.mockResolvedValue(openPr());
    appSettings.actuallyAssign.mockResolvedValue(true);
    const stats = statsWith(reviewerPool());
    stats.modeByPersonId.set('p-author', 'off');
    candidateStats.build.mockResolvedValue(stats);
    await expect(service.assign('org/app', 11405, null)).rejects.toThrow(
      'turned off',
    );
    expect(suggestionRepo.createQueryBuilder).not.toHaveBeenCalled();
  });
});

describe('AssignmentActionsService.autoAssign', () => {
  it('rotates picks within one sweep instead of stacking one person', async () => {
    const { service, prQb, suggestionQb } = setup();
    prQb.getMany.mockResolvedValue([
      openPr({ id: 'pr-uuid-1', number: 11405 }),
      openPr({ id: 'pr-uuid-2', number: 11410 }),
    ]);
    const assigned = await service.autoAssign(NOW);
    expect(assigned).toBe(2);
    const picks = suggestionQb.set.mock.calls.map(
      (call) => call[0].assignedLogin,
    );
    expect(picks).toEqual(['expert', 'second']);
  });

  it('skips authors who did not opt into auto assignment', async () => {
    const { service, prQb, candidateStats, suggestionQb } = setup();
    const stats = statsWith(reviewerPool());
    stats.modeByPersonId.set('p-author', 'hybrid');
    candidateStats.build.mockResolvedValue(stats);
    prQb.getMany.mockResolvedValue([openPr()]);
    const assigned = await service.autoAssign(NOW);
    expect(assigned).toBe(0);
    expect(suggestionQb.set).not.toHaveBeenCalled();
  });

  it('skips pull requests that already carry an assignment', async () => {
    const { service, prQb, suggestionRepo, suggestionQb } = setup();
    suggestionRepo.find.mockResolvedValue([{ prId: 'pr-uuid-1' }]);
    prQb.getMany.mockResolvedValue([
      openPr({ id: 'pr-uuid-1', number: 11405 }),
      openPr({ id: 'pr-uuid-2', number: 11410 }),
    ]);
    const assigned = await service.autoAssign(NOW);
    expect(assigned).toBe(1);
    expect(suggestionQb.set).toHaveBeenCalledTimes(1);
  });

  it('keeps sweeping when one pull request fails', async () => {
    const { service, prQb, suggestionRepo, logger, suggestionQb } = setup();
    prQb.getMany.mockResolvedValue([
      openPr({ id: 'pr-uuid-1', number: 11405 }),
      openPr({ id: 'pr-uuid-2', number: 11410 }),
    ]);
    suggestionRepo.findOne
      .mockResolvedValueOnce({
        assignedAt: NOW,
        assignedName: 'Expert',
        assignedLogin: 'expert',
      })
      .mockResolvedValue(null);
    const assigned = await service.autoAssign(NOW);
    expect(assigned).toBe(1);
    expect(logger.warn).toHaveBeenCalled();
    expect(suggestionQb.set).toHaveBeenCalledTimes(1);
  });
});

describe('AssignmentActionsService.reset', () => {
  it('rejects when there is nothing to reset', async () => {
    const { service } = setup();
    await expect(service.reset('org/app', 11405)).rejects.toThrow(
      'no assignment to reset',
    );
  });

  it('clears a shadow assignment without touching GitHub', async () => {
    const { service, suggestionRepo, github } = setup();
    suggestionRepo.findOne.mockResolvedValue({
      prId: 'pr-uuid-1',
      assignedAt: NOW,
      assignedLogin: 'expert',
      shadow: true,
    });
    await expect(service.reset('org/app', 11405)).resolves.toBe(true);
    expect(github.removeRequestedReviewers).not.toHaveBeenCalled();
    expect(suggestionRepo.update).toHaveBeenCalledWith(
      { prId: 'pr-uuid-1' },
      expect.objectContaining({ assignedLogin: null, assignedAt: null }),
    );
  });

  it('removes the GitHub review request while it is still pending', async () => {
    const { service, suggestionRepo, prRepo, github } = setup();
    suggestionRepo.findOne.mockResolvedValue({
      prId: 'pr-uuid-1',
      assignedAt: NOW,
      assignedLogin: 'expert',
      shadow: false,
    });
    prRepo.findOne.mockResolvedValue(
      openPr({ requestedReviewers: ['Expert'] }),
    );
    await service.reset('org/app', 11405);
    expect(github.removeRequestedReviewers).toHaveBeenCalledWith(
      'org/app',
      11405,
      ['expert'],
    );
  });

  it('skips GitHub when the reviewer is no longer requested', async () => {
    const { service, suggestionRepo, prRepo, github } = setup();
    suggestionRepo.findOne.mockResolvedValue({
      prId: 'pr-uuid-1',
      assignedAt: NOW,
      assignedLogin: 'expert',
      shadow: false,
    });
    prRepo.findOne.mockResolvedValue(openPr({ requestedReviewers: [] }));
    await service.reset('org/app', 11405);
    expect(github.removeRequestedReviewers).not.toHaveBeenCalled();
    expect(suggestionRepo.update).toHaveBeenCalled();
  });
});
