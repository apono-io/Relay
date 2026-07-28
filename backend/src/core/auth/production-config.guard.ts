import { ConfigService } from '@nestjs/config';

const DEFAULT_JWT_SECRET = 'change-me';

export function assertProductionConfigSafe(configService: ConfigService): void {
  if (configService.get<string>('NODE_ENV') !== 'production') {
    return;
  }

  const jwtSecret = configService.get<string>('JWT_SECRET');
  if (!jwtSecret || jwtSecret === DEFAULT_JWT_SECRET) {
    throw new Error(
      'SECURITY: JWT_SECRET is missing or still the default in production. Every token would be forgeable. Refusing to start.',
    );
  }

  const missing = ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET'].filter(
    (key) => !configService.get<string>(key),
  );
  if (missing.length > 0) {
    throw new Error(
      `SECURITY: ${missing.join(' and ')} not set in production. Sign-in cannot work. Refusing to start.`,
    );
  }
}
