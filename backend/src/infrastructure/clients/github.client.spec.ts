import { generateKeyPairSync } from 'crypto';
import axios from 'axios';
import { GitHubClient } from './github.client';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

const { privateKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  publicKeyEncoding: { type: 'spki', format: 'pem' },
});

function appClient(config: Record<string, string> = {}) {
  const values: Record<string, string> = {
    GITHUB_AUTH_MODE: 'app',
    GITHUB_APP_ID: '5426762',
    GITHUB_APP_PRIVATE_KEY: privateKey.replace(/\n/g, '\\n'),
    GITHUB_REPOS: 'apono-io/apono-mono,apono-io/integrations',
    ...config,
  };
  const configService = { get: (key: string) => values[key] };
  const logger = { log: jest.fn(), warn: jest.fn(), error: jest.fn() };
  return new GitHubClient(configService as never, logger as never);
}

beforeEach(() => {
  jest.resetAllMocks();
  mockedAxios.post.mockResolvedValue({ data: { token: 'installation-token' } });
  mockedAxios.request.mockResolvedValue({ data: { ok: true } });
});

describe('GitHubClient as a GitHub App', () => {
  it('treats the App as configured without an installation id', () => {
    expect(appClient().isConfigured()).toBe(true);
  });

  it('finds the installation through the App when no id is set', async () => {
    mockedAxios.get.mockResolvedValue({
      data: [{ id: 777, account: { login: 'apono-io' } }],
    });
    await appClient().rest('get', '/rate_limit');
    expect(mockedAxios.get).toHaveBeenCalledWith(
      'https://api.github.com/app/installations',
      expect.anything(),
    );
    expect(mockedAxios.post).toHaveBeenCalledWith(
      'https://api.github.com/app/installations/777/access_tokens',
      {},
      expect.anything(),
    );
    expect(mockedAxios.request).toHaveBeenCalledWith(
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer installation-token',
        }),
      }),
    );
  });

  it('picks the installation on the watched repos owner when there are several', async () => {
    mockedAxios.get.mockResolvedValue({
      data: [
        { id: 1, account: { login: 'Dorsg' } },
        { id: 777, account: { login: 'apono-io' } },
      ],
    });
    await appClient().rest('get', '/rate_limit');
    expect(mockedAxios.post).toHaveBeenCalledWith(
      'https://api.github.com/app/installations/777/access_tokens',
      {},
      expect.anything(),
    );
  });

  it('looks the installation up once, not on every token refresh', async () => {
    mockedAxios.get.mockResolvedValue({
      data: [{ id: 777, account: { login: 'apono-io' } }],
    });
    const client = appClient();
    await client.rest('get', '/rate_limit');
    await client.rest('get', '/rate_limit');
    expect(mockedAxios.get).toHaveBeenCalledTimes(1);
  });

  it('uses a configured installation id without looking it up', async () => {
    await appClient({ GITHUB_APP_INSTALLATION_ID: '42' }).rest(
      'get',
      '/rate_limit',
    );
    expect(mockedAxios.get).not.toHaveBeenCalled();
    expect(mockedAxios.post).toHaveBeenCalledWith(
      'https://api.github.com/app/installations/42/access_tokens',
      {},
      expect.anything(),
    );
  });

  it('explains when the App is not installed on the watched repos owner', async () => {
    mockedAxios.get.mockResolvedValue({
      data: [{ id: 1, account: { login: 'Dorsg' } }],
    });
    await expect(appClient().rest('get', '/rate_limit')).rejects.toThrow(
      'not installed on apono-io',
    );
  });
});
