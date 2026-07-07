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
    this.logger.log('Gap-fill tick: re-pulling open + recently-merged PRs per repo');
    throw new Error('not implemented: re-pull recent PRs per repo, fill dropped events (spec task 10 - local live mechanism)');
  }
}
