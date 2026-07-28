import {
  CommitEmailResolver,
  CommitEntry,
} from './commit-email-resolver.service';

const DOMAIN = 'apono.io';

function commit(login: string | null, email: string | null): CommitEntry {
  return { login, email };
}

describe('CommitEmailResolver.selectIdentity', () => {
  it('takes the work address from the author own commits (AC-1)', () => {
    const result = CommitEmailResolver.selectIdentity(
      'Dorsg',
      [commit('Dorsg', 'dor.s@apono.io')],
      DOMAIN,
    );
    expect(result.email).toBe('dor.s@apono.io');
    expect(result.logins).toEqual(['Dorsg']);
    expect(result.reason).toBeNull();
  });

  it('prefers a work address over a personal one on the same author', () => {
    const result = CommitEmailResolver.selectIdentity(
      'Dorsg',
      [commit('Dorsg', 'dor@gmail.com'), commit('Dorsg', 'dor.s@apono.io')],
      DOMAIN,
    );
    expect(result.email).toBe('dor.s@apono.io');
  });

  it('reports a personal address as unresolved and keeps it for the report (AC-2)', () => {
    const result = CommitEmailResolver.selectIdentity(
      'MikeCr4ft',
      [commit('MikeCr4ft', 'mikedavismaster25@gmail.com')],
      DOMAIN,
    );
    expect(result.email).toBeNull();
    expect(result.observedEmail).toBe('mikedavismaster25@gmail.com');
    expect(result.reason).toBe('no_domain_email');
  });

  it('attaches a second account when every commit carries one other login (AC-3)', () => {
    const result = CommitEmailResolver.selectIdentity(
      'omricarmel',
      [
        commit('omri-apono', 'omri.c@apono.io'),
        commit('omri-apono', 'omri.c@apono.io'),
      ],
      DOMAIN,
    );
    expect(result.email).toBe('omri.c@apono.io');
    expect(result.logins).toEqual(['omricarmel', 'omri-apono']);
  });

  it('prefers the author own commits over other contributors in the same pull request', () => {
    const result = CommitEmailResolver.selectIdentity(
      'Dorsg',
      [
        commit('someone-else', 'other@apono.io'),
        commit('Dorsg', 'dor.s@apono.io'),
      ],
      DOMAIN,
    );
    expect(result.email).toBe('dor.s@apono.io');
    expect(result.logins).toEqual(['Dorsg']);
  });

  it('refuses to guess when several other logins authored the commits', () => {
    const result = CommitEmailResolver.selectIdentity(
      'release-manager',
      [commit('alice', 'alice@apono.io'), commit('bob', 'bob@apono.io')],
      DOMAIN,
    );
    expect(result.email).toBeNull();
    expect(result.reason).toBe('ambiguous_commit_authors');
    expect(result.logins).toEqual(['release-manager']);
  });

  it('ignores the merge committer and bot accounts', () => {
    const result = CommitEmailResolver.selectIdentity(
      'tomy-apono',
      [
        commit('web-flow', 'noreply@github.com'),
        commit('dependabot[bot]', 'bot@github.com'),
        commit(null, 'tomybusbiba@Tomys-Macbook.local'),
      ],
      DOMAIN,
    );
    expect(result.email).toBeNull();
    expect(result.reason).toBe('no_commit_author');
  });

  it('matches the domain regardless of address casing', () => {
    const result = CommitEmailResolver.selectIdentity(
      'Dorsg',
      [commit('Dorsg', 'Dor.S@Apono.IO')],
      DOMAIN,
    );
    expect(result.email).toBe('Dor.S@Apono.IO');
  });

  it('matches the author login regardless of casing and keeps the casing GitHub reports', () => {
    const result = CommitEmailResolver.selectIdentity(
      'dorsg',
      [commit('Dorsg', 'dor.s@apono.io')],
      DOMAIN,
    );
    expect(result.email).toBe('dor.s@apono.io');
    expect(result.logins).toEqual(['Dorsg']);
  });

  it('does not match a domain that only ends with the allowed one', () => {
    const result = CommitEmailResolver.selectIdentity(
      'Dorsg',
      [commit('Dorsg', 'dor@not-apono.io')],
      DOMAIN,
    );
    expect(result.email).toBeNull();
    expect(result.reason).toBe('no_domain_email');
  });
});
