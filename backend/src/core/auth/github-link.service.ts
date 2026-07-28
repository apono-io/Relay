import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import axios from 'axios';
import { PeopleService } from '@/domains/people/people.service';
import { IdentitySource } from '@/domains/people/entities/github-identity.entity';
import { LoggerService } from '@/infrastructure/logging/logger.service';

const AUTHORIZE_URL = 'https://github.com/login/oauth/authorize';
const TOKEN_URL = 'https://github.com/login/oauth/access_token';
const USER_URL = 'https://api.github.com/user';
const LINK_SCOPE = 'read:user';

type LinkState = { personId: string; purpose: 'github-link' };

@Injectable()
export class GithubLinkService {
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly callbackUrl: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly jwtService: JwtService,
    private readonly peopleService: PeopleService,
    private readonly logger: LoggerService,
  ) {
    this.clientId =
      this.configService.get<string>('GITHUB_OAUTH_CLIENT_ID') || '';
    this.clientSecret =
      this.configService.get<string>('GITHUB_OAUTH_CLIENT_SECRET') || '';
    this.callbackUrl =
      this.configService.get<string>('GITHUB_OAUTH_CALLBACK_URL') ||
      'http://localhost:3100/auth/github/callback';
  }

  isConfigured(): boolean {
    return this.clientId.length > 0 && this.clientSecret.length > 0;
  }

  authorizeUrl(personId: string): string {
    if (!this.isConfigured()) {
      throw new ServiceUnavailableException(
        'GitHub account linking is not configured',
      );
    }
    const state = this.jwtService.sign(
      { personId, purpose: 'github-link' } satisfies LinkState,
      {
        expiresIn: '10m',
      },
    );
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: this.callbackUrl,
      scope: LINK_SCOPE,
      state,
      allow_signup: 'false',
    });
    return `${AUTHORIZE_URL}?${params.toString()}`;
  }

  async completeLink(code: string, state: string): Promise<{ login: string }> {
    const personId = this.personIdFromState(state);
    const accessToken = await this.exchangeCode(code);
    const login = await this.fetchLogin(accessToken);

    const identity = await this.peopleService.recordIdentity(
      personId,
      login,
      IdentitySource.GITHUB_OAUTH,
    );
    if (!identity) {
      throw new BadRequestException(
        `GitHub account ${login} is already linked to another person`,
      );
    }

    this.logger.log(
      `Linked GitHub account ${login} to person ${personId}`,
      GithubLinkService.name,
    );
    return { login };
  }

  private personIdFromState(state: string): string {
    try {
      const payload = this.jwtService.verify<LinkState>(state);
      if (payload.purpose !== 'github-link' || !payload.personId) {
        throw new Error('unexpected state payload');
      }
      return payload.personId;
    } catch {
      throw new BadRequestException(
        'The linking request expired. Start again.',
      );
    }
  }

  private async exchangeCode(code: string): Promise<string> {
    const response = await axios.post(
      TOKEN_URL,
      {
        client_id: this.clientId,
        client_secret: this.clientSecret,
        code,
        redirect_uri: this.callbackUrl,
      },
      { headers: { Accept: 'application/json' } },
    );
    const token = response.data?.access_token;
    if (!token) {
      throw new BadRequestException(
        `GitHub rejected the linking code: ${response.data?.error ?? 'unknown error'}`,
      );
    }
    return token;
  }

  private async fetchLogin(accessToken: string): Promise<string> {
    const response = await axios.get(USER_URL, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
    });
    const login = response.data?.login;
    if (!login) {
      throw new BadRequestException('GitHub did not return an account login');
    }
    return login;
  }
}
