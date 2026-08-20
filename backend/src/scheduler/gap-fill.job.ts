import { Injectable, OnModuleInit } from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { subHours } from 'date-fns';
import { LoggerService } from '@/infrastructure/logging/logger.service';
import { GitHubClient } from '@/infrastructure/clients/github.client';
import { SyncStatusService } from '@/infrastructure/sync/sync-status.service';
import { numberSetting } from '@/core/config/config-number';
import { GithubEventNormalizer } from '@/domains/ingestion/github-event-normalizer.service';
import { PrIngestService } from '@/domains/ingestion/pr-ingest.service';
import { PrEventSource } from '@/domains/pull-requests/pr-enums';
import { PullRequestsService } from '@/domains/pull-requests/pull-requests.service';

export type GapFillSummary = {
  reposProcessed: number;
  prsScanned: number;
  prsReconciled: number;
  eventsInserted: number;
};

const RECONCILE_BATCH_SIZE = 20;
const SYNC_OVERLAP_HOURS = 1;

@Injectable()
export class GapFillJob implements OnModuleInit {
  constructor(
    private readonly configService: ConfigService,
    private readonly github: GitHubClient,
    private readonly normalizer: GithubEventNormalizer,
    private readonly ingest: PrIngestService,
    private readonly pullRequests: PullRequestsService,
    private readonly logger: LoggerService,
    private readonly syncStatus: SyncStatusService,
    private readonly schedulerRegistry: SchedulerRegistry,
  ) {}

  onModuleInit(): void {
    const minutes = Math.max(
      1,
      numberSetting(this.configService, 'GAP_FILL_INTERVAL_MINUTES', 10),
    );
    const handle = setInterval(() => void this.run(), minutes * 60 * 1000);
    this.schedulerRegistry.addInterval('gap-fill', handle);
    void this.run();
  }

  async run(): Promise<void> {
    if (!this.github.isConfigured()) {
      return;
    }
    try {
      const summary = await this.pull();
      this.logger.log(`Gap-fill done: ${JSON.stringify(summary)}`);
    } catch (error) {
      this.logger.error(
        `Gap-fill failed: ${(error as Error).message}`,
        (error as Error).stack,
        GapFillJob.name,
      );
    }
  }

  async runNow(): Promise<Date | null> {
    if (this.github.isConfigured()) {
      const summary = await this.pull();
      this.logger.log(`Manual sync done: ${JSON.stringify(summary)}`);
    }
    return this.syncStatus.lastSyncedAt;
  }

  async pull(now: Date = new Date()): Promise<GapFillSummary> {
    const cutoff = this.cutoffFor(now);
    const repos = await this.ingest.repos();

    const summary: GapFillSummary = {
      reposProcessed: 0,
      prsScanned: 0,
      prsReconciled: 0,
      eventsInserted: 0,
    };
    for (const repo of repos) {
      const perRepo = await this.pullRepo(repo, cutoff);
      const reconcile = await this.reconcileRepo(repo, cutoff);
      summary.reposProcessed += 1;
      summary.prsScanned += perRepo.prsScanned;
      summary.prsReconciled += reconcile.prsReconciled;
      summary.eventsInserted +=
        perRepo.eventsInserted + reconcile.eventsInserted;
    }
    await this.syncStatus.markSynced(now);
    return summary;
  }

  private cutoffFor(now: Date): Date {
    const lookbackHours = numberSetting(
      this.configService,
      'GAP_FILL_LOOKBACK_HOURS',
      24,
    );
    const windowCutoff = subHours(now, lookbackHours);
    const lastSynced = this.syncStatus.lastSyncedAt;
    if (!lastSynced) {
      return windowCutoff;
    }
    const resumeCutoff = subHours(lastSynced, SYNC_OVERLAP_HOURS);
    return resumeCutoff < windowCutoff ? resumeCutoff : windowCutoff;
  }

  private async pullRepo(
    repo: string,
    cutoff: Date,
  ): Promise<{ prsScanned: number; eventsInserted: number }> {
    let after: string | null = null;
    let prsScanned = 0;
    let eventsInserted = 0;

    while (true) {
      const page = await this.github.fetchPullRequestTimelines(repo, {
        first: 25,
        after,
        orderBy: 'UPDATED_AT',
      });
      let reachedCutoff = false;

      for (const node of page.nodes) {
        if (new Date(node.updatedAt) < cutoff) {
          reachedCutoff = true;
          break;
        }
        const { pullRequest, events } = this.normalizer.normalizeBackfillNode(
          repo,
          node,
        );
        eventsInserted += await this.ingest.persistPr(
          pullRequest,
          events,
          PrEventSource.GAP_FILL,
        );
        prsScanned += 1;
      }

      if (reachedCutoff || !page.pageInfo.hasNextPage) {
        break;
      }
      after = page.pageInfo.endCursor;
    }

    return { prsScanned, eventsInserted };
  }

  private async reconcileRepo(
    repo: string,
    cutoff: Date,
  ): Promise<{ prsReconciled: number; eventsInserted: number }> {
    const numbers = await this.pullRequests.findOpenNumbersUpdatedBefore(
      repo,
      cutoff,
    );
    let prsReconciled = 0;
    let eventsInserted = 0;

    for (let i = 0; i < numbers.length; i += RECONCILE_BATCH_SIZE) {
      const batch = numbers.slice(i, i + RECONCILE_BATCH_SIZE);
      const nodes = await this.github.fetchPullRequestTimelinesByNumbers(
        repo,
        batch,
      );
      for (const node of nodes) {
        const { pullRequest, events } = this.normalizer.normalizeBackfillNode(
          repo,
          node,
        );
        eventsInserted += await this.ingest.persistPr(
          pullRequest,
          events,
          PrEventSource.GAP_FILL,
        );
        prsReconciled += 1;
      }
    }

    return { prsReconciled, eventsInserted };
  }
}
