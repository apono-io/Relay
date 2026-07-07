import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as jwt from 'jsonwebtoken';
import axios from 'axios';
import { LoggerService } from '../logging/logger.service';

type AuthMode = 'pat' | 'app';

const PR_TIMELINE_QUERY = `
query PullRequestTimelines($owner: String!, $name: String!, $first: Int!, $after: String) {
  repository(owner: $owner, name: $name) {
    pullRequests(first: $first, after: $after, orderBy: { field: CREATED_AT, direction: DESC }) {
      pageInfo { hasNextPage endCursor }
      nodes {
        id
        number
        title
        url
        isDraft
        createdAt
        updatedAt
        mergedAt
        closedAt
        author { login __typename }
        mergedBy { login }
        commits(last: 100) {
          nodes {
            commit {
              oid
              authoredDate
              committedDate
              pushedDate
              author { user { login } }
              statusCheckRollup { state }
            }
          }
        }
        reviews(first: 100) {
          nodes { id state submittedAt author { login } }
        }
        comments(first: 100) {
          nodes { id createdAt author { login } }
        }
        timelineItems(
          first: 100
          itemTypes: [READY_FOR_REVIEW_EVENT, CONVERT_TO_DRAFT_EVENT, REVIEW_REQUESTED_EVENT, REVIEW_REQUEST_REMOVED_EVENT]
        ) {
          nodes {
            __typename
            ... on ReadyForReviewEvent { createdAt actor { login } }
            ... on ConvertToDraftEvent { createdAt actor { login } }
            ... on ReviewRequestedEvent { createdAt actor { login } requestedReviewer { ... on User { login } } }
            ... on ReviewRequestRemovedEvent { createdAt actor { login } requestedReviewer { ... on User { login } } }
          }
        }
      }
    }
  }
}`;

@Injectable()
export class GitHubClient {
  private readonly authMode: AuthMode;
  private readonly pat: string;
  private readonly appId: string;
  private readonly installationId: string;
  private readonly privateKey: string;
  private accessToken: string | null = null;
  private tokenExpiry = 0;

  constructor(
    private readonly configService: ConfigService,
    private readonly loggerService: LoggerService,
  ) {
    this.authMode = (this.configService.get<string>('GITHUB_AUTH_MODE') as AuthMode) || 'pat';
    this.pat = this.configService.get<string>('GITHUB_PAT') || '';
    this.appId = this.configService.get<string>('GITHUB_APP_ID') || '';
    this.installationId = this.configService.get<string>('GITHUB_APP_INSTALLATION_ID') || '';
    this.privateKey = (this.configService.get<string>('GITHUB_APP_PRIVATE_KEY') || '').replace(/\\n/g, '\n');
  }

  isConfigured(): boolean {
    if (this.authMode === 'pat') {
      return !!this.pat;
    }
    return !!(this.appId && this.installationId && this.privateKey);
  }

  async fetchPullRequestTimelines(
    repo: string,
    opts: { first?: number; after?: string | null } = {},
  ): Promise<{ nodes: any[]; pageInfo: { hasNextPage: boolean; endCursor: string | null } }> {
    const [owner, name] = repo.split('/');
    const data = await this.graphql<{ repository: { pullRequests: any } }>(PR_TIMELINE_QUERY, {
      owner,
      name,
      first: opts.first ?? 25,
      after: opts.after ?? null,
    });
    const connection = data.repository.pullRequests;
    return { nodes: connection.nodes, pageInfo: connection.pageInfo };
  }

  async graphql<T = any>(query: string, variables: Record<string, unknown> = {}): Promise<T> {
    const token = await this.getToken();
    const response = await axios.post(
      'https://api.github.com/graphql',
      { query, variables },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
        },
      },
    );
    if (response.data.errors) {
      throw new Error(`GitHub GraphQL error: ${JSON.stringify(response.data.errors)}`);
    }
    return response.data.data as T;
  }

  async rest<T = any>(method: 'get' | 'post', path: string, body?: unknown): Promise<T> {
    const token = await this.getToken();
    const response = await axios.request<T>({
      method,
      url: `https://api.github.com${path}`,
      data: body,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
    });
    return response.data;
  }

  private async getToken(): Promise<string> {
    if (this.authMode === 'pat') {
      return this.pat;
    }
    return this.getInstallationToken();
  }

  private async getInstallationToken(): Promise<string> {
    const now = Math.floor(Date.now() / 1000);
    if (this.accessToken && this.tokenExpiry > now + 60) {
      return this.accessToken;
    }

    const appJwt = jwt.sign(
      { iat: now - 60, exp: now + 600, iss: this.appId },
      this.privateKey,
      { algorithm: 'RS256' },
    );

    const response = await axios.post(
      `https://api.github.com/app/installations/${this.installationId}/access_tokens`,
      {},
      {
        headers: {
          Authorization: `Bearer ${appJwt}`,
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
        },
      },
    );

    this.accessToken = response.data.token;
    this.tokenExpiry = now + 3600;
    return this.accessToken!;
  }
}
