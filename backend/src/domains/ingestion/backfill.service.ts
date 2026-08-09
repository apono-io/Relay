import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { subQuarters } from 'date-fns';
import { GitHubClient } from '@/infrastructure/clients/github.client';
import { LoggerService } from '@/infrastructure/logging/logger.service';
import { GithubEventNormalizer } from './github-event-normalizer.service';
import { PrIngestService } from './pr-ingest.service';

export type BackfillSummary = {
  reposProcessed: number;
  prsProcessed: number;
  eventsInserted: number;
};

@Injectable()
export class BackfillService {
  constructor(
    private readonly github: GitHubClient,
    private readonly normalizer: GithubEventNormalizer,
    private readonly ingest: PrIngestService,
    private readonly configService: ConfigService,
    private readonly logger: LoggerService,
  ) {}

  async runRepo(repo: string): Promise<BackfillSummary> {
    const quarters = Number(this.configService.get('BACKFILL_QUARTERS') ?? 3);
    const maxPrs = Number(this.configService.get('BACKFILL_MAX_PRS') ?? 0);
    const cutoff = subQuarters(new Date(), quarters);
    this.logger.log(`Backfill for ${repo} since ${cutoff.toISOString()}`);
    const perRepo = await this.backfillRepo(repo, cutoff, maxPrs);
    const summary: BackfillSummary = {
      reposProcessed: 1,
      prsProcessed: perRepo.prsProcessed,
      eventsInserted: perRepo.eventsInserted,
    };
    this.logger.log(`Backfill for ${repo} done: ${JSON.stringify(summary)}`);
    return summary;
  }

  async run(): Promise<BackfillSummary> {
    const repos = await this.ingest.repos();
    const quarters = Number(this.configService.get('BACKFILL_QUARTERS') ?? 3);
    const maxPrs = Number(this.configService.get('BACKFILL_MAX_PRS') ?? 0);
    const cutoff = subQuarters(new Date(), quarters);

    this.logger.log(
      `Backfill: ${repos.length} repo(s), since ${cutoff.toISOString()}${maxPrs ? `, max ${maxPrs} PRs/repo` : ''}`,
    );

    const summary: BackfillSummary = {
      reposProcessed: 0,
      prsProcessed: 0,
      eventsInserted: 0,
    };

    for (const repo of repos) {
      const perRepo = await this.backfillRepo(repo, cutoff, maxPrs);
      summary.reposProcessed += 1;
      summary.prsProcessed += perRepo.prsProcessed;
      summary.eventsInserted += perRepo.eventsInserted;
    }

    this.logger.log(`Backfill done: ${JSON.stringify(summary)}`);
    return summary;
  }

  private async backfillRepo(
    repo: string,
    cutoff: Date,
    maxPrs: number,
  ): Promise<{ prsProcessed: number; eventsInserted: number }> {
    let after: string | null = null;
    let prsProcessed = 0;
    let eventsInserted = 0;

    while (true) {
      const page = await this.github.fetchPullRequestTimelines(repo, {
        first: 25,
        after,
      });
      let reachedCutoff = false;

      for (const node of page.nodes) {
        if (new Date(node.createdAt) < cutoff) {
          reachedCutoff = true;
          break;
        }
        const { pullRequest, events } = this.normalizer.normalizeBackfillNode(
          repo,
          node,
        );
        eventsInserted += await this.ingest.persistPr(pullRequest, events);
        prsProcessed += 1;
        if (maxPrs && prsProcessed >= maxPrs) {
          this.logger.log(`${repo}: hit max ${maxPrs} PRs, stopping`);
          return { prsProcessed, eventsInserted };
        }
      }

      if (reachedCutoff || !page.pageInfo.hasNextPage) {
        break;
      }
      after = page.pageInfo.endCursor;
    }

    return { prsProcessed, eventsInserted };
  }
}
