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

function setup(events: unknown[] = []) {
  const qb = chainableQb();
  qb.getMany.mockResolvedValue(events);
  const eventRepo = { createQueryBuilder: jest.fn().mockReturnValue(qb) };
  const candidateStats = {
    build: jest.fn().mockResolvedValue({
      candidates: [],
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
    assign: jest.fn().mockResolvedValue({ login: 'expert' }),
  };
  const configService = { get: jest.fn() };
  const logger = { log: jest.fn(), warn: jest.fn(), error: jest.fn() };
  const service = new RelayCommandService(
    eventRepo as never,
    candidateStats as never,
    actions as never,
    configService as never,
    logger as never,
  );
  return { service, qb, actions, logger, candidateStats };
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

  it('ignores commands older than the max age', async () => {
    const { service, qb } = setup();
    await service.processPending(NOW);
    expect(qb.andWhere).toHaveBeenCalledWith(
      expect.stringContaining('occurredAt'),
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
    });
  });

  it('skips building stats when nothing is pending', async () => {
    const { service, candidateStats } = setup();
    await service.processPending(NOW);
    expect(candidateStats.build).not.toHaveBeenCalled();
  });
});
