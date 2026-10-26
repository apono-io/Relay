import { BadRequestException } from '@nestjs/common';
import { subHours } from 'date-fns';
import { RelayCommandService } from './relay-command.service';

const NOW = new Date('2026-10-22T12:00:00Z');

function chainableQb() {
  const chain: Record<string, jest.Mock> = {};
  for (const method of [
    'innerJoinAndSelect',
    'where',
    'andWhere',
    'orderBy',
    'update',
    'set',
    'setParameter',
    'setParameters',
  ]) {
    chain[method] = jest.fn().mockReturnValue(chain);
  }
  chain.execute = jest.fn().mockResolvedValue({ affected: 1 });
  chain.getMany = jest.fn().mockResolvedValue([]);
  return chain;
}

function commandEvent(
  command: 'assign' | 'skip',
  actorLogin = 'author',
  overrides: Record<string, unknown> = {},
) {
  return {
    id: 'event-1',
    prId: 'pr-1',
    actorLogin,
    payload: { command },
    occurredAt: subHours(NOW, 1),
    pullRequest: {
      id: 'pr-1',
      repo: 'org/app',
      number: 7,
      authorLogin: 'author',
    },
    ...overrides,
  };
}

function setup(events: unknown[] = [], candidates: unknown[] = []) {
  const qb = chainableQb();
  qb.getMany.mockResolvedValue(events);
  const eventRepo = { createQueryBuilder: jest.fn().mockReturnValue(qb) };
  const candidateStats = {
    build: jest.fn().mockResolvedValue({
      candidates,
      rulesByRepo: {},
      modeByPersonId: new Map(),
      personByLogin: new Map([
        [
          'author',
          {
            personId: 'p-author',
            displayName: 'Author',
            assignmentEnabled: true,
          },
        ],
        [
          'author-alt',
          {
            personId: 'p-author',
            displayName: 'Author',
            assignmentEnabled: true,
          },
        ],
        [
          'reviewer',
          {
            personId: 'p-reviewer',
            displayName: 'Reviewer',
            assignmentEnabled: true,
          },
        ],
      ]),
    }),
  };
  const actions = {
    assign: jest.fn().mockResolvedValue({ login: 'expert', shadow: false }),
  };
  const configService = { get: jest.fn() };
  const logger = { log: jest.fn(), warn: jest.fn(), error: jest.fn() };
  const appSettings = { actuallyAssign: jest.fn().mockResolvedValue(false) };
  const github = { createIssueComment: jest.fn().mockResolvedValue(undefined) };
  const service = new RelayCommandService(
    eventRepo as never,
    candidateStats as never,
    actions as never,
    appSettings as never,
    github as never,
    configService as never,
    logger as never,
  );
  return { service, qb, actions, logger, candidateStats, appSettings, github };
}

function outcomePatches(qb: Record<string, jest.Mock>) {
  return qb.setParameter.mock.calls
    .filter(([name]) => name === 'patch')
    .map(([, value]) => JSON.parse(value as string));
}

describe('RelayCommandService.processPending', () => {
  it('assigns when the author comments @relay assign', async () => {
    const { service, qb, actions } = setup([commandEvent('assign')]);
    const summary = await service.processPending(NOW);
    expect(actions.assign).toHaveBeenCalledWith(
      'org/app',
      7,
      'p-author',
      'comment',
    );
    expect(summary).toEqual({
      assigned: 1,
      skipped: 0,
      refused: 0,
      notAuthor: 0,
      ignored: 0,
    });
    expect(outcomePatches(qb)).toEqual([{ outcome: 'assigned' }]);
  });

  it('accepts a command from another login linked to the author', async () => {
    const { service, actions } = setup([commandEvent('assign', 'Author-Alt')]);
    await service.processPending(NOW);
    expect(actions.assign).toHaveBeenCalled();
  });

  it('refuses a command from someone other than the author', async () => {
    const { service, qb, actions } = setup([
      commandEvent('assign', 'reviewer'),
    ]);
    const summary = await service.processPending(NOW);
    expect(actions.assign).not.toHaveBeenCalled();
    expect(summary.notAuthor).toBe(1);
    expect(outcomePatches(qb)).toEqual([{ outcome: 'not-author' }]);
  });

  it('treats a commenter Relay does not know as not the author', async () => {
    const { service, actions } = setup([commandEvent('assign', 'stranger')]);
    const summary = await service.processPending(NOW);
    expect(actions.assign).not.toHaveBeenCalled();
    expect(summary.notAuthor).toBe(1);
  });

  it('records the refusal reason', async () => {
    const { service, qb, actions, logger } = setup([commandEvent('assign')]);
    actions.assign.mockRejectedValue(
      new BadRequestException(
        'The author has Relay assignment turned off, so Relay will not pick a reviewer here.',
      ),
    );
    const summary = await service.processPending(NOW);
    expect(summary.refused).toBe(1);
    expect(outcomePatches(qb)).toEqual([
      {
        outcome: 'refused',
        reason:
          'The author has Relay assignment turned off, so Relay will not pick a reviewer here.',
      },
    ]);
    expect(logger.warn).toHaveBeenCalled();
  });

  it('records an unexpected error as refused so it is never retried', async () => {
    const { service, qb, actions } = setup([commandEvent('assign')]);
    actions.assign.mockRejectedValue(new Error('socket hang up'));
    const summary = await service.processPending(NOW);
    expect(summary.refused).toBe(1);
    expect(outcomePatches(qb)[0].outcome).toBe('refused');
  });

  it('records a skip', async () => {
    const { service, qb, actions } = setup([commandEvent('skip')]);
    const summary = await service.processPending(NOW);
    expect(actions.assign).not.toHaveBeenCalled();
    expect(summary.skipped).toBe(1);
    expect(outcomePatches(qb)).toEqual([{ outcome: 'skipped' }]);
  });

  it('ignores assign commands older than the max age but keeps every skip', async () => {
    const { service, qb } = setup();
    await service.processPending(NOW);
    expect(qb.andWhere).toHaveBeenCalledWith(
      expect.stringMatching(/'skip'.*occurredAt|occurredAt.*'skip'/s),
      { since: subHours(NOW, 24) },
    );
  });

  it('does nothing when another run already claimed the command', async () => {
    const { service, qb, actions } = setup([commandEvent('assign')]);
    qb.execute.mockResolvedValueOnce({ affected: 0 });
    const summary = await service.processPending(NOW);
    expect(actions.assign).not.toHaveBeenCalled();
    expect(outcomePatches(qb)).toEqual([]);
    expect(summary).toEqual({
      assigned: 0,
      skipped: 0,
      refused: 0,
      notAuthor: 0,
      ignored: 0,
    });
  });

  it('skips building stats when nothing is pending', async () => {
    const { service, candidateStats } = setup();
    await service.processPending(NOW);
    expect(candidateStats.build).not.toHaveBeenCalled();
  });
});

describe('RelayCommandService replies on GitHub', () => {
  it('replies on GitHub when live assignment is on', async () => {
    const { service, appSettings, github } = setup([commandEvent('assign')]);
    appSettings.actuallyAssign.mockResolvedValue(true);
    await service.processPending(NOW);
    expect(github.createIssueComment).toHaveBeenCalledWith(
      'org/app',
      7,
      expect.stringMatching(
        /^Requested a review from @expert, a good fit for this change\./,
      ),
    );
  });

  it('confirms a skip', async () => {
    const { service, appSettings, github } = setup([commandEvent('skip')]);
    appSettings.actuallyAssign.mockResolvedValue(true);
    await service.processPending(NOW);
    expect(github.createIssueComment).toHaveBeenCalledWith(
      'org/app',
      7,
      'Got it. Relay will stay off this pull request.',
    );
  });

  it('explains a refusal', async () => {
    const { service, appSettings, github, actions } = setup([
      commandEvent('assign'),
    ]);
    appSettings.actuallyAssign.mockResolvedValue(true);
    actions.assign.mockRejectedValue(
      new BadRequestException('Drafts do not get a reviewer.'),
    );
    await service.processPending(NOW);
    expect(github.createIssueComment).toHaveBeenCalledWith(
      'org/app',
      7,
      "Relay didn't pick a reviewer: Drafts do not get a reviewer.",
    );
  });

  it('stays quiet for a command from someone other than the author', async () => {
    const { service, appSettings, github } = setup([
      commandEvent('assign', 'reviewer'),
    ]);
    appSettings.actuallyAssign.mockResolvedValue(true);
    await service.processPending(NOW);
    expect(github.createIssueComment).not.toHaveBeenCalled();
  });

  it('never replies while live assignment is off', async () => {
    const { service, github } = setup([
      commandEvent('assign'),
      commandEvent('skip', 'author', { id: 'event-2' }),
    ]);
    await service.processPending(NOW);
    expect(github.createIssueComment).not.toHaveBeenCalled();
  });

  it('a failed reply keeps the outcome', async () => {
    const { service, qb, appSettings, github, logger } = setup([
      commandEvent('assign'),
    ]);
    appSettings.actuallyAssign.mockResolvedValue(true);
    github.createIssueComment.mockRejectedValue(new Error('403'));
    const summary = await service.processPending(NOW);
    expect(summary.assigned).toBe(1);
    expect(outcomePatches(qb)).toEqual([{ outcome: 'assigned' }]);
    expect(logger.warn).toHaveBeenCalled();
  });

  it('records a stale skip without replying', async () => {
    const { service, qb, appSettings, github } = setup([
      commandEvent('skip', 'author', { occurredAt: subHours(NOW, 30) }),
    ]);
    appSettings.actuallyAssign.mockResolvedValue(true);
    const summary = await service.processPending(NOW);
    expect(summary.skipped).toBe(1);
    expect(outcomePatches(qb)).toEqual([{ outcome: 'skipped' }]);
    expect(github.createIssueComment).not.toHaveBeenCalled();
  });
});

describe('RelayCommandService reply explains the pick', () => {
  function liveSetup(assignment: Record<string, unknown>) {
    const ctx = setup([commandEvent('assign')]);
    ctx.appSettings.actuallyAssign.mockResolvedValue(true);
    ctx.actions.assign.mockResolvedValue({ shadow: false, ...assignment });
    return ctx;
  }

  it('names the reviewer, the area and the reasons', async () => {
    const { service, github } = liveSetup({
      login: 'EthanHemo',
      area: 'Frontend',
      reason: 'worked on Frontend recently and has no open reviews',
      signals: {
        areaRank: 2,
        areaPool: 15,
        openReviewRequests: 0,
        reviewsLast14Days: 20,
      },
    });
    await service.processPending(NOW);
    expect(github.createIssueComment).toHaveBeenCalledWith(
      'org/app',
      7,
      [
        'Requested a review from @EthanHemo, a good fit for this change.',
        '',
        '**Why EthanHemo**',
        'This change touches Frontend.',
        '- Worked on Frontend recently',
        '- Has no open reviews',
        '',
        'Relay weighs recent work on the code, current review load, and recent reviews the same way for everyone.',
      ].join('\n'),
    );
  });

  it('leaves out the area line when the change has no area', async () => {
    const { service, github } = liveSetup({
      login: 'EthanHemo',
      area: null,
      reason: 'worked on this part of the code recently',
    });
    await service.processPending(NOW);
    const body = github.createIssueComment.mock.calls[0][2] as string;
    expect(body).not.toContain('This change touches');
    expect(body).toContain('- Worked on this part of the code recently');
  });

  it('softens "has not reviewed lately" for a public comment', async () => {
    const { service, github } = liveSetup({
      login: 'EthanHemo',
      area: null,
      reason: 'has no open reviews and has not reviewed lately',
    });
    await service.processPending(NOW);
    const body = github.createIssueComment.mock.calls[0][2] as string;
    expect(body).toContain('- Has had a lighter review load lately');
    expect(body).not.toContain('has not reviewed');
  });

  it('never shows numbers from the engine', async () => {
    const { service, github } = liveSetup({
      login: 'EthanHemo',
      area: 'Frontend',
      reason: 'worked on Frontend recently and has no open reviews',
      signals: {
        areaRank: 2,
        areaPool: 15,
        openReviewRequests: 0,
        reviewsLast14Days: 20,
      },
    });
    await service.processPending(NOW);
    const body = github.createIssueComment.mock.calls[0][2] as string;
    expect(body).not.toMatch(/\d/);
  });
});

describe('RelayCommandService and who may command', () => {
  it('tells an author Relay does not know yet how to fix it', async () => {
    const { service, qb, actions } = setup([
      commandEvent('assign', 'NewHire', {
        pullRequest: {
          id: 'pr-1',
          repo: 'org/app',
          number: 7,
          authorLogin: 'newhire',
        },
      }),
    ]);
    const summary = await service.processPending(NOW);
    expect(actions.assign).not.toHaveBeenCalled();
    expect(summary.refused).toBe(1);
    expect(outcomePatches(qb)[0]).toEqual({
      outcome: 'refused',
      reason:
        "Relay doesn't know this GitHub account yet. Link it in Relay under Settings, or ask an admin to add it under System settings → People.",
    });
  });

  it('ignores a command from someone turned off in Relay', async () => {
    const { service, qb, actions } = setup(
      [commandEvent('assign')],
      [{ personId: 'p-author', active: false }],
    );
    const summary = await service.processPending(NOW);
    expect(actions.assign).not.toHaveBeenCalled();
    expect(summary.ignored).toBe(1);
    expect(outcomePatches(qb)).toEqual([{ outcome: 'ignored' }]);
  });

  it('stays quiet towards someone turned off in Relay', async () => {
    const { service, appSettings, github } = setup(
      [commandEvent('assign')],
      [{ personId: 'p-author', active: false }],
    );
    appSettings.actuallyAssign.mockResolvedValue(true);
    await service.processPending(NOW);
    expect(github.createIssueComment).not.toHaveBeenCalled();
  });
});

describe('RelayCommandService never writes while assignment stays a test', () => {
  it('does not claim a review request that stayed a test', async () => {
    const { service, appSettings, github, actions } = setup([
      commandEvent('assign'),
    ]);
    appSettings.actuallyAssign.mockResolvedValue(true);
    actions.assign.mockResolvedValue({ login: 'expert', shadow: true });
    await service.processPending(NOW);
    expect(github.createIssueComment).not.toHaveBeenCalled();
  });

  it('re-checks the switch before each reply', async () => {
    const { service, appSettings, github } = setup([
      commandEvent('skip'),
      commandEvent('skip', 'author', { id: 'event-2' }),
    ]);
    appSettings.actuallyAssign
      .mockResolvedValueOnce(true)
      .mockResolvedValue(false);
    await service.processPending(NOW);
    expect(github.createIssueComment).toHaveBeenCalledTimes(1);
  });
});
