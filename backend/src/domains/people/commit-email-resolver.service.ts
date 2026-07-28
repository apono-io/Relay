import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GitHubClient } from '@/infrastructure/clients/github.client';
import { LoggerService } from '@/infrastructure/logging/logger.service';

export type UnresolvedReason =
  | 'no_pull_requests'
  | 'no_domain_email'
  | 'no_commit_author'
  | 'ambiguous_commit_authors'
  | 'fetch_failed';

export type CommitEmailProbe = {
  authorLogin: string;
  email: string | null;
  observedEmail: string | null;
  logins: string[];
  reason: UnresolvedReason | null;
};

export type CommitEntry = {
  login: string | null;
  email: string | null;
};

const COMMITTER_LOGINS_TO_IGNORE = new Set(['web-flow']);

@Injectable()
export class CommitEmailResolver {
  private readonly allowedDomain: string;
  private readonly pullRequestsToProbe: number;

  constructor(
    private readonly github: GitHubClient,
    private readonly configService: ConfigService,
    private readonly logger: LoggerService,
  ) {
    this.allowedDomain =
      this.configService.get<string>('ALLOWED_EMAIL_DOMAIN') || 'apono.io';
    this.pullRequestsToProbe = Number(
      this.configService.get('PEOPLE_SEED_PRS_PER_AUTHOR') ?? 3,
    );
  }

  static selectIdentity(
    authorLogin: string,
    commits: CommitEntry[],
    domain: string,
  ): CommitEmailProbe {
    const authored = commits.filter(
      (entry) =>
        entry.login &&
        !COMMITTER_LOGINS_TO_IGNORE.has(entry.login) &&
        !entry.login.endsWith('[bot]'),
    );

    const own = authored.filter((entry) => sameLogin(entry.login, authorLogin));
    const distinct = new Set(
      authored.map((entry) => entry.login!.toLowerCase()),
    );

    let attributable: CommitEntry[];
    if (own.length > 0) {
      attributable = own;
    } else if (distinct.size === 1) {
      attributable = authored;
    } else if (distinct.size === 0) {
      return miss(authorLogin, 'no_commit_author');
    } else {
      return miss(authorLogin, 'ambiguous_commit_authors');
    }

    const logins = new Map<string, string>([
      [authorLogin.toLowerCase(), authorLogin],
    ]);
    for (const entry of attributable) {
      logins.set(entry.login!.toLowerCase(), entry.login!);
    }

    const suffix = `@${domain.toLowerCase()}`;
    const onDomain = attributable.find((entry) =>
      entry.email?.toLowerCase().endsWith(suffix),
    );
    const observed = attributable.find((entry) => entry.email)?.email ?? null;

    if (onDomain?.email) {
      return {
        authorLogin,
        email: onDomain.email,
        observedEmail: onDomain.email,
        logins: Array.from(logins.values()),
        reason: null,
      };
    }

    return {
      authorLogin,
      email: null,
      observedEmail: observed,
      logins: Array.from(logins.values()),
      reason: 'no_domain_email',
    };
  }

  domain(): string {
    return this.allowedDomain;
  }

  async probe(
    authorLogin: string,
    pullRequests: { repo: string; number: number }[],
  ): Promise<CommitEmailProbe> {
    if (pullRequests.length === 0) {
      return miss(authorLogin, 'no_pull_requests');
    }

    const misses: CommitEmailProbe[] = [];

    for (const pullRequest of pullRequests.slice(0, this.pullRequestsToProbe)) {
      const commits = await this.fetchCommits(pullRequest);
      const result =
        commits === null
          ? miss(authorLogin, 'fetch_failed')
          : CommitEmailResolver.selectIdentity(
              authorLogin,
              commits,
              this.allowedDomain,
            );

      if (result.email) {
        return result;
      }
      misses.push(result);
    }

    return misses.find((entry) => entry.observedEmail) ?? misses[0];
  }

  private async fetchCommits(pullRequest: {
    repo: string;
    number: number;
  }): Promise<CommitEntry[] | null> {
    try {
      const response = await this.github.rest<any[]>(
        'get',
        `/repos/${pullRequest.repo}/pulls/${pullRequest.number}/commits?per_page=100`,
      );
      return response.map((commit) => ({
        login: commit?.author?.login ?? null,
        email: commit?.commit?.author?.email ?? null,
      }));
    } catch (error) {
      this.logger.warn(
        `Commit probe failed for ${pullRequest.repo}#${pullRequest.number}: ${(error as Error).message}`,
        CommitEmailResolver.name,
      );
      return null;
    }
  }
}

function sameLogin(a: string | null, b: string | null): boolean {
  return a !== null && b !== null && a.toLowerCase() === b.toLowerCase();
}

function miss(authorLogin: string, reason: UnresolvedReason): CommitEmailProbe {
  return {
    authorLogin,
    email: null,
    observedEmail: null,
    logins: [authorLogin],
    reason,
  };
}
