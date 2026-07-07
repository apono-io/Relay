import { Injectable } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { LoggerService } from '@/infrastructure/logging/logger.service';
import { GitHubClient } from '@/infrastructure/clients/github.client';
import { GithubEventNormalizer } from '@/domains/ingestion/github-event-normalizer.service';

@Injectable()
export class GapFillJob {
  constructor(
    private readonly configService: ConfigService,
    private readonly github: GitHubClient,
    private readonly normalizer: GithubEventNormalizer,
    private readonly logger: LoggerService,
  ) {}

  @Interval('gap-fill', 10 * 60 * 1000)
  async run(): Promise<void> {
    if (!this.github.isConfigured()) {
      return;
    }
    this.logger.debug('Gap-fill tick skipped: not implemented yet (spec task 10)');
  }
}
