import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { GitHubClient } from '@/infrastructure/clients/github.client';
import { LoggerService } from '@/infrastructure/logging/logger.service';
import { GithubEventNormalizer } from './github-event-normalizer.service';
import { PrEvent } from '@/domains/pull-requests/entities/pr-event.entity';
import { PullRequestsService } from '@/domains/pull-requests/pull-requests.service';

@Injectable()
export class BackfillService {
  constructor(
    @InjectRepository(PrEvent) private readonly eventRepo: Repository<PrEvent>,
    private readonly github: GitHubClient,
    private readonly normalizer: GithubEventNormalizer,
    private readonly pullRequests: PullRequestsService,
    private readonly configService: ConfigService,
    private readonly logger: LoggerService,
  ) {}

  private repos(): string[] {
    return (this.configService.get<string>('GITHUB_REPOS') || '')
      .split(',')
      .map((r) => r.trim())
      .filter(Boolean);
  }

  async run(): Promise<void> {
    const repos = this.repos();
    const quarters = Number(this.configService.get('BACKFILL_QUARTERS') ?? 3);
    this.logger.log(`Backfill starting for ${repos.length} repo(s), ${quarters} quarter(s)`);
    throw new Error('not implemented: page each repo via GraphQL, normalize, upsert events, recompute PRs (spec task 7)');
  }
}
