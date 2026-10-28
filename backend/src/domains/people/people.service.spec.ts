import { PeopleService } from './people.service';
import {
  GithubIdentity,
  IdentitySource,
  canTakeFromAnotherPerson,
  outranks,
  sourceRank,
} from './entities/github-identity.entity';

function identity(
  login: string,
  source: IdentitySource,
  createdAt: string,
): GithubIdentity {
  return { login, source, createdAt: new Date(createdAt) } as GithubIdentity;
}

describe('identity source ranking', () => {
  it('ranks a verified link above a typed one, and a typed one above a guess', () => {
    expect(sourceRank(IdentitySource.GITHUB_OAUTH)).toBeGreaterThan(
      sourceRank(IdentitySource.MANUAL),
    );
    expect(sourceRank(IdentitySource.MANUAL)).toBeGreaterThan(
      sourceRank(IdentitySource.COMMIT_EMAIL),
    );
  });

  it('lets an equal or higher source overwrite', () => {
    expect(
      outranks(IdentitySource.GITHUB_OAUTH, IdentitySource.COMMIT_EMAIL),
    ).toBe(true);
    expect(outranks(IdentitySource.MANUAL, IdentitySource.MANUAL)).toBe(true);
  });

  it('refuses a lower source (AC-5)', () => {
    expect(
      outranks(IdentitySource.COMMIT_EMAIL, IdentitySource.GITHUB_OAUTH),
    ).toBe(false);
    expect(outranks(IdentitySource.COMMIT_EMAIL, IdentitySource.MANUAL)).toBe(
      false,
    );
  });
});

describe('taking a login that sits on another person', () => {
  it('never takes a login a person proved by signing in to GitHub (AC-18)', () => {
    for (const incoming of Object.values(IdentitySource)) {
      expect(
        canTakeFromAnotherPerson(incoming, IdentitySource.GITHUB_OAUTH),
      ).toBe(false);
    }
  });

  it('moves a guessed login to a person who proves or types it (AC-19)', () => {
    expect(
      canTakeFromAnotherPerson(
        IdentitySource.GITHUB_OAUTH,
        IdentitySource.COMMIT_EMAIL,
      ),
    ).toBe(true);
    expect(
      canTakeFromAnotherPerson(
        IdentitySource.MANUAL,
        IdentitySource.COMMIT_EMAIL,
      ),
    ).toBe(true);
  });

  it('leaves a typed login alone when only a guess claims it', () => {
    expect(
      canTakeFromAnotherPerson(
        IdentitySource.COMMIT_EMAIL,
        IdentitySource.MANUAL,
      ),
    ).toBe(false);
  });
});

describe('PeopleService.pickDisplayLogin', () => {
  it('returns nothing when a person owns no identity', () => {
    expect(PeopleService.pickDisplayLogin([])).toBeNull();
  });

  it('shows the highest-ranked login', () => {
    const identities = [
      identity(
        'omri-apono',
        IdentitySource.COMMIT_EMAIL,
        '2026-01-01T00:00:00Z',
      ),
      identity(
        'omricarmel',
        IdentitySource.GITHUB_OAUTH,
        '2026-02-01T00:00:00Z',
      ),
    ];
    expect(PeopleService.pickDisplayLogin(identities)).toBe('omricarmel');
  });

  it('keeps the oldest login when two identities share the highest rank', () => {
    const identities = [
      identity('second', IdentitySource.COMMIT_EMAIL, '2026-02-01T00:00:00Z'),
      identity('first', IdentitySource.COMMIT_EMAIL, '2026-01-01T00:00:00Z'),
    ];
    expect(PeopleService.pickDisplayLogin(identities)).toBe('first');
  });
});

describe('PeopleService.seedFromCommitEmails (Sync from GitHub)', () => {
  function seeded(
    authorCount: number,
    emailFor: (login: string) => string | null,
  ) {
    let inFlight = 0;
    let maxInFlight = 0;
    const resolver = {
      domain: () => 'apono.io',
      probe: jest.fn(async (login: string) => {
        inFlight += 1;
        maxInFlight = Math.max(maxInFlight, inFlight);
        await new Promise((resolve) => setTimeout(resolve, 5));
        inFlight -= 1;
        const email = emailFor(login);
        return {
          authorLogin: login,
          email,
          observedEmail: email ?? `${login}@gmail.com`,
          logins: [login],
          reason: email ? null : 'no_domain_email',
        };
      }),
    };
    const service = new PeopleService(
      {} as never,
      {} as never,
      {} as never,
      resolver as never,
      { get: jest.fn() } as never,
      { log: jest.fn(), warn: jest.fn(), error: jest.fn() } as never,
    );
    const authors = Array.from({ length: authorCount }, (_, i) => ({
      login: `dev${i}`,
      pullRequests: [{ repo: 'org/app', number: i + 1 }],
    }));
    const internals = service as unknown as Record<string, jest.Mock>;
    internals.authorsWithRecentPullRequests = jest
      .fn()
      .mockResolvedValue(authors);
    internals.findIdentity = jest.fn().mockResolvedValue(null);
    internals.findByEmail = jest.fn().mockResolvedValue(null);
    internals.ensurePerson = jest.fn(async (email: string) => ({
      id: `p-${email}`,
    }));
    internals.recordIdentity = jest.fn().mockResolvedValue({ id: 'i1' });
    return { service, resolver, internals, maxInFlight: () => maxInFlight };
  }

  it('looks as deep as asked for unknown authors', async () => {
    const { service, resolver } = seeded(2, () => null);
    await service.seedFromCommitEmails({ probeDepth: 25 });
    expect(resolver.probe).toHaveBeenCalledWith(
      'dev0',
      [{ repo: 'org/app', number: 1 }],
      25,
    );
  });

  it('probes several authors at once, at most five', async () => {
    const { service, maxInFlight } = seeded(12, () => null);
    const summary = await service.seedFromCommitEmails({ probeDepth: 25 });
    expect(maxInFlight()).toBeGreaterThan(1);
    expect(maxInFlight()).toBeLessThanOrEqual(5);
    expect(summary.unresolved).toHaveLength(12);
  });

  it('adds a person for each author whose commits carry a work address', async () => {
    const { service, internals } = seeded(3, (login) =>
      login === 'dev1' ? 'dev1@apono.io' : null,
    );
    const summary = await service.seedFromCommitEmails({ probeDepth: 25 });
    expect(summary.peopleCreated).toBe(1);
    expect(internals.ensurePerson).toHaveBeenCalledWith('dev1@apono.io');
    expect(summary.unresolved.map((entry) => entry.login)).toEqual([
      'dev0',
      'dev2',
    ]);
  });
});
