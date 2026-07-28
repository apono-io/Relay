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
