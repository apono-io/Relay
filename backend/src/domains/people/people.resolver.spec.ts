import { PeopleResolver } from './people.resolver';

describe('PeopleResolver.syncPeopleFromGithub', () => {
  it('runs the roster seed 25 pull requests deep and lists who still needs an email', async () => {
    const peopleService = {
      seedFromCommitEmails: jest.fn().mockResolvedValue({
        authorsScanned: 4,
        peopleCreated: 2,
        identitiesLinked: 3,
        unresolved: [
          {
            login: 'MikeCr4ft',
            reason: 'no_domain_email',
            observedEmail: 'm@gmail.com',
          },
          { login: 'shayc331', reason: 'no_domain_email', observedEmail: null },
        ],
      }),
    };
    const resolver = new PeopleResolver(peopleService as never);
    await expect(resolver.syncPeopleFromGithub()).resolves.toEqual({
      peopleCreated: 2,
      identitiesLinked: 3,
      stillNeedEmail: ['MikeCr4ft', 'shayc331'],
    });
    expect(peopleService.seedFromCommitEmails).toHaveBeenCalledWith({
      probeDepth: 25,
    });
  });
});
