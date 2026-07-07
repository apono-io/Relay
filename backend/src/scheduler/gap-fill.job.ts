import { Injectable } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { subHours } from 'date-fns';
import { LoggerService } from '@/infrastructure/logging/logger.service';
import { GitHubClient } from '@/infrastructure/clients/github.client';
import { GithubEventNormalizer } from '@/domains/ingestion/github-event-normalizer.service';
import { PrIngestService } from '@/domains/ingestion/pr-ingest.service';
import { PrEventSource } from '@/domains/pull-requests/pr-enums';

export type GapFillSummary = {
  reposProcessed: number;
  prsScanned: number;
  eventsInserted: number;
};

@Injectable()
export class GapFillJob {
  constructor(
    private readonly configService: ConfigService,
    private readonly github: GitHubClient,
    private readonly normalizer: GithubEventNormalizer,
    private readonly ingest: PrIngestService,
    private readonly logger: LoggerService,
  ) {}

  @Interval('gap-fill', 10 * 60 * 1000)
  async run(): Promise<void> {
    if (!this.github.isConfigured()) {
      return;
    }
    const summary = await this.pull();
    this.logger.log(`Gap-fill done: ${JSON.stringify(summary)}`);
  }

  async pull(now: Date = new Date()): Promise<GapFillSummary> {
    const lookbackHours = Number(this.configService.get('GAP_FILL_LOOKBACK_HOURS') ?? 24);
    const cutoff = subHours(now, lookbackHours);
    const repos = this.ingest.repos();

    const summary: GapFillSummary = { reposProcessed: 0, prsScanned: 0, eventsInserted: 0 };
    for (const repo of repos) {
      const perRepo = await this.pullRepo(repo, cutoff);
      summary.reposProcessed += 1;
      summary.prsScanned += perRepo.prsScanned;
      summary.eventsInserted += perRepo.eventsInserted;
    }
    return summary;
  }

  private async pullRepo(repo: string, cutoff: Date): Promise<{ prsScanned: number; eventsInserted: number }> {
    let after: string | null = null;
    let prsScanned = 0;
    let eventsInserted = 0;

    while (true) {
      const page = await this.github.fetchPullRequestTimelines(repo, { first: 25, after, orderBy: 'UPDATED_AT' });
      let reachedCutoff = false;

      for (const node of page.nodes) {
        if (new Date(node.updatedAt) < cutoff) {
          reachedCutoff = true;
          break;
        }
        const { pullRequest, events } = this.normalizer.normalizeBackfillNode(repo, node);
        eventsInserted += await this.ingest.persistPr(pullRequest, events, PrEventSource.GAP_FILL);
        prsScanned += 1;
      }

      if (reachedCutoff || !page.pageInfo.hasNextPage) {
        break;
      }
      after = page.pageInfo.endCursor;
    }

    return { prsScanned, eventsInserted };
  }
}
