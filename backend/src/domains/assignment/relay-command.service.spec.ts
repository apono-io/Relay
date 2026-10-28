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
  command: 'assign' | 'team' | 'skip' | 'help' | 'unknown',
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
  const github = {
    createIssueComment: jest.fn().mockResolvedValue(undefined),
    canWrite: jest.fn().mockReturnValue(true),
  };
  const service = new RelayCommandService(
    eventRepo as never,
    candidateStats as never,
    actions as never,
    github as never,
    configService as never,
    logger as never,
  );
  return {
    service,
    qb,
    actions,
    logger,
    candidateStats,
    github,
    configService,
  };
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
      'org',
    );
    expect(summary).toEqual({
      assigned: 1,
      skipped: 0,
      refused: 0,
      notAuthor: 0,
      ignored: 0,
      answered: 0,
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
      answered: 0,
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
    const { service, github } = setup([commandEvent('assign')]);
    await service.processPending(NOW);
    expect(github.createIssueComment).toHaveBeenCalledWith(
      'org/app',
      7,
      expect.stringMatching(/^Requested a review from @expert\./),
    );
  });

  it('confirms a skip', async () => {
    const { service, github } = setup([commandEvent('skip')]);
    await service.processPending(NOW);
    expect(github.createIssueComment).toHaveBeenCalledWith(
      'org/app',
      7,
      "#### Relay will stay off this pull request\nGot it. Relay won't pick a reviewer here.",
    );
  });

  it('explains a refusal', async () => {
    const { service, github, actions } = setup([commandEvent('assign')]);
    actions.assign.mockRejectedValue(
      new BadRequestException('Drafts do not get a reviewer.'),
    );
    await service.processPending(NOW);
    expect(github.createIssueComment).toHaveBeenCalledWith(
      'org/app',
      7,
      '#### No reviewer picked\nDrafts do not get a reviewer.',
    );
  });

  it('stays quiet for a command from someone other than the author', async () => {
    const { service, github } = setup([commandEvent('assign', 'reviewer')]);
    await service.processPending(NOW);
    expect(github.createIssueComment).not.toHaveBeenCalled();
  });

  it('never replies without the App', async () => {
    const { service, github } = setup([
      commandEvent('assign'),
      commandEvent('skip', 'author', { id: 'event-2' }),
    ]);
    github.canWrite.mockReturnValue(false);
    await service.processPending(NOW);
    expect(github.createIssueComment).not.toHaveBeenCalled();
  });

  it('a failed reply keeps the outcome', async () => {
    const { service, qb, github, logger } = setup([commandEvent('assign')]);
    github.createIssueComment.mockRejectedValue(new Error('403'));
    const summary = await service.processPending(NOW);
    expect(summary.assigned).toBe(1);
    expect(outcomePatches(qb)).toEqual([{ outcome: 'assigned' }]);
    expect(logger.warn).toHaveBeenCalled();
  });

  it('records a stale skip without replying', async () => {
    const { service, qb, github } = setup([
      commandEvent('skip', 'author', { occurredAt: subHours(NOW, 30) }),
    ]);
    const summary = await service.processPending(NOW);
    expect(summary.skipped).toBe(1);
    expect(outcomePatches(qb)).toEqual([{ outcome: 'skipped' }]);
    expect(github.createIssueComment).not.toHaveBeenCalled();
  });
});

describe('RelayCommandService reply explains the pick', () => {
  function liveSetup(assignment: Record<string, unknown>) {
    const ctx = setup([commandEvent('assign')]);
    ctx.actions.assign.mockResolvedValue({ shadow: false, ...assignment });
    return ctx;
  }

  it("mirrors the app's Why popover: three checks, counted or not", async () => {
    const { service, github } = liveSetup({
      login: 'EthanHemo',
      area: 'Frontend',
      sensitivity: 2,
      reason: 'worked on Frontend recently and has no open reviews',
      signals: {
        areaRank: 2,
        areaPool: 15,
        openReviewRequests: 0,
        reviewsLast14Days: 19,
      },
    });
    await service.processPending(NOW);
    expect(github.createIssueComment).toHaveBeenCalledWith(
      'org/app',
      7,
      [
        'Requested a review from @EthanHemo.',
        '',
        '#### Why EthanHemo?',
        'This pull request touches **Frontend** · Sensitivity ●●○○○ Normal',
        '',
        '✅ **Familiarity:** worked on Frontend recently',
        '✅ **Availability:** no open review requests right now',
        '⚪ **Fairness:** 19 reviews in the last 14 days',
        '',
        '<sub>Relay weighs recent work on this code, current review load, and reviews done in the last 14 days. Everyone gets the same three checks.</sub>',
        '',
        '[Open in Relay](http://localhost:5174/dashboard)',
      ].join('\n'),
    );
  });

  it('marks a check not counted when the signal is not in their favour', async () => {
    const { service, github } = liveSetup({
      login: 'EthanHemo',
      area: null,
      reason: 'has not reviewed lately',
      signals: {
        areaRank: null,
        areaPool: 15,
        openReviewRequests: 1,
        reviewsLast14Days: 0,
      },
    });
    await service.processPending(NOW);
    const body = github.createIssueComment.mock.calls[0][2] as string;
    expect(body).not.toContain('This pull request touches');
    expect(body).toContain(
      '⚪ **Familiarity:** no recent work on this part of the code',
    );
    expect(body).toContain(
      '⚪ **Availability:** 1 open review request right now',
    );
    expect(body).toContain('✅ **Fairness:** no reviews in the last 14 days');
  });

  it('falls back to the reason phrases when a pick has no signals', async () => {
    const { service, github } = liveSetup({
      login: 'EthanHemo',
      area: null,
      reason: 'has no open reviews and has not reviewed lately',
      signals: null,
    });
    await service.processPending(NOW);
    const body = github.createIssueComment.mock.calls[0][2] as string;
    expect(body).toContain('✅ Has no open reviews');
    expect(body).toContain('✅ Has had a lighter review load lately');
    expect(body).not.toContain('has not reviewed');
  });

  it("never shows the engine's rank or pool size", async () => {
    const { service, github } = liveSetup({
      login: 'EthanHemo',
      area: 'Frontend',
      reason: 'worked on Frontend recently',
      signals: {
        areaRank: 7,
        areaPool: 15,
        openReviewRequests: 0,
        reviewsLast14Days: 3,
      },
    });
    await service.processPending(NOW);
    const body = github.createIssueComment.mock.calls[0][2] as string;
    expect(body).not.toMatch(/\b(7|15)\b/);
    expect(body).toContain('3 reviews in the last 14 days');
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
    const { service, github } = setup(
      [commandEvent('assign')],
      [{ personId: 'p-author', active: false }],
    );
    await service.processPending(NOW);
    expect(github.createIssueComment).not.toHaveBeenCalled();
  });
});

describe('RelayCommandService in test mode', () => {
  it('announces a pick that stayed a test without mentioning or requesting anyone', async () => {
    const { service, github, actions } = setup([commandEvent('assign')]);
    actions.assign.mockResolvedValue({
      login: 'EthanHemo',
      shadow: true,
      area: null,
      reason:
        'worked on this part of the code recently and has no open reviews',
      signals: {
        areaRank: 2,
        areaPool: 15,
        openReviewRequests: 0,
        reviewsLast14Days: 19,
      },
    });
    await service.processPending(NOW);
    expect(github.createIssueComment).toHaveBeenCalledWith(
      'org/app',
      7,
      [
        'Relay would request a review from **EthanHemo**.',
        '',
        '#### Why EthanHemo?',
        '✅ **Familiarity:** worked on this part of the code recently',
        '✅ **Availability:** no open review requests right now',
        '⚪ **Fairness:** 19 reviews in the last 14 days',
        '',
        '<sub>Relay weighs recent work on this code, current review load, and reviews done in the last 14 days. Everyone gets the same three checks.</sub>',
        '',
        '> [!NOTE]',
        '> Test mode: no review was requested, and EthanHemo was not notified.',
        '',
        '[Open in Relay](http://localhost:5174/dashboard)',
      ].join('\n'),
    );
    const body = github.createIssueComment.mock.calls[0][2] as string;
    expect(body).not.toContain('@');
  });

  it('re-checks that Relay can write before each reply', async () => {
    const { service, github } = setup([
      commandEvent('skip'),
      commandEvent('skip', 'author', { id: 'event-2' }),
    ]);
    github.canWrite.mockReturnValueOnce(true).mockReturnValue(false);
    await service.processPending(NOW);
    expect(github.createIssueComment).toHaveBeenCalledTimes(1);
  });
});

describe('RelayCommandService help', () => {
  const HELP = [
    '#### Relay commands',
    'Comment one of these on a pull request you opened:',
    '',
    '- `@relay`: Relay requests a reviewer who looks like a good fit, and explains why.',
    '- `@relay team`: the same, but only from your team.',
    '- `@relay skip`: Relay stays off this pull request.',
    '- `@relay help`: this list.',
    '',
    '<sub>Relay acts only on commands from the pull request author.</sub>',
    '',
    '[Open in Relay](http://localhost:5174/dashboard)',
  ].join('\n');

  it('answers @relay help with the command list, also for someone other than the author', async () => {
    const { service, qb, github, actions } = setup([
      commandEvent('help', 'reviewer'),
    ]);
    const summary = await service.processPending(NOW);
    expect(actions.assign).not.toHaveBeenCalled();
    expect(summary.answered).toBe(1);
    expect(outcomePatches(qb)).toEqual([{ outcome: 'answered' }]);
    expect(github.createIssueComment).toHaveBeenCalledWith('org/app', 7, HELP);
  });

  it('tells the author an unknown command is not known yet, with the list', async () => {
    const { service, github } = setup([commandEvent('unknown')]);
    await service.processPending(NOW);
    expect(github.createIssueComment).toHaveBeenCalledWith(
      'org/app',
      7,
      HELP.replace(
        '#### Relay commands\n',
        "#### Relay commands\nRelay doesn't know that command yet.\n\n",
      ),
    );
  });

  it('stays quiet on an unknown command from someone else', async () => {
    const { service, github } = setup([commandEvent('unknown', 'reviewer')]);
    const summary = await service.processPending(NOW);
    expect(summary.notAuthor).toBe(1);
    expect(github.createIssueComment).not.toHaveBeenCalled();
  });
});

describe('RelayCommandService teams, sensitivity and the Relay link', () => {
  function liveSetup(
    assignment: Record<string, unknown>,
    command: 'assign' | 'team' = 'team',
  ) {
    const ctx = setup([commandEvent(command)]);
    ctx.actions.assign.mockResolvedValue({
      shadow: false,
      login: 'EthanHemo',
      area: null,
      reason: 'has no open reviews',
      ...assignment,
    });
    return ctx;
  }
  const body = (github: { createIssueComment: jest.Mock }) =>
    github.createIssueComment.mock.calls[0][2] as string;

  it('@relay team runs a team-scoped assign', async () => {
    const { service, actions } = liveSetup({ teamName: 'Platform' });
    await service.processPending(NOW);
    expect(actions.assign).toHaveBeenCalledWith(
      'org/app',
      7,
      'p-author',
      'comment',
      'team',
    );
  });

  it('a bare or plain assign stays org-wide', async () => {
    const { service, actions } = liveSetup({}, 'assign');
    await service.processPending(NOW);
    expect(actions.assign).toHaveBeenCalledWith(
      'org/app',
      7,
      'p-author',
      'comment',
      'org',
    );
  });

  it('the reply names the team', async () => {
    const { service, github } = liveSetup({
      teamName: 'Platform',
      teamLeadFallback: false,
    });
    await service.processPending(NOW);
    expect(body(github)).toContain(
      'Requested a review from @EthanHemo.\nFrom the **Platform** team.\n',
    );
  });

  it('the reply explains a lead fallback', async () => {
    const { service, github } = liveSetup({
      teamName: 'Platform',
      teamLeadFallback: true,
      teamLeadThreshold: 2,
    });
    await service.processPending(NOW);
    expect(body(github)).toContain(
      'Everyone else on **Platform** already has 2 or more open reviews, so Relay asked the team lead.',
    );
  });

  it("shows sensitivity with the app's five levels", async () => {
    const { service, github } = liveSetup({ area: 'Auth', sensitivity: 5 });
    await service.processPending(NOW);
    expect(body(github)).toContain(
      'This pull request touches **Auth** · Sensitivity ●●●●● Critical',
    );
  });

  it('links to Relay at RELAY_URL', async () => {
    const { service, github, configService } = liveSetup({});
    configService.get.mockImplementation((key: string) =>
      key === 'RELAY_URL' ? 'https://relay.apono.io/' : undefined,
    );
    await service.processPending(NOW);
    expect(
      body(github).endsWith(
        '[Open in Relay](https://relay.apono.io/dashboard)',
      ),
    ).toBe(true);
  });
});

describe('RelayCommandService lead-fallback wording', () => {
  function replyFor(assignment: Record<string, unknown>) {
    const ctx = setup([commandEvent('team')]);
    ctx.actions.assign.mockResolvedValue({
      login: 'Lead',
      area: null,
      reason: 'has no open reviews',
      teamName: 'Platform',
      teamLeadFallback: true,
      teamLeadThreshold: 2,
      ...assignment,
    });
    return ctx;
  }
  const body = (github: { createIssueComment: jest.Mock }) =>
    github.createIssueComment.mock.calls[0][2] as string;

  it('says nobody else can take it when the others cannot be picked', async () => {
    const { service, github } = replyFor({
      shadow: false,
      teamLeadReason: 'unavailable',
    });
    await service.processPending(NOW);
    expect(body(github)).toContain(
      'Nobody else on **Platform** can take this one right now, so Relay asked the team lead.',
    );
    expect(body(github)).not.toContain('already has');
  });

  it('says "would ask" in test mode', async () => {
    const { service, github } = replyFor({
      shadow: true,
      teamLeadReason: 'loaded',
    });
    await service.processPending(NOW);
    expect(body(github)).toContain(
      'Everyone else on **Platform** already has 2 or more open reviews, so Relay would ask the team lead.',
    );
  });
});
