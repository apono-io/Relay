export type IdentitySource = 'COMMIT_EMAIL' | 'MANUAL' | 'GITHUB_OAUTH';

export type GithubIdentity = {
  id: string;
  login: string;
  source: IdentitySource;
};

export type Person = {
  id: string;
  email: string;
  githubLogin: string | null;
  displayName: string | null;
  team: string | null;
  timezone: string | null;
  role: string;
  active: boolean;
  identities: GithubIdentity[];
};

export type RosterHealth = {
  unmappedLogins: string[];
};

export const SOURCE_LABELS: Record<IdentitySource, string> = {
  GITHUB_OAUTH: 'Verified',
  MANUAL: 'Typed in',
  COMMIT_EMAIL: 'Guessed',
};

export const SOURCE_HINTS: Record<IdentitySource, string> = {
  GITHUB_OAUTH: 'The person signed in to GitHub, so this login is certain.',
  MANUAL: 'An admin typed this login.',
  COMMIT_EMAIL: 'Read from a commit address. Worth confirming.',
};
