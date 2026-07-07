import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { subQuarters } from 'date-fns';
import { GitHubClient } from '@/infrastructure/clients/github.client';
import { LoggerService } from '@/infrastructure/logging/logger.service';
import { GithubEventNormalizer, NormalizedEvent, NormalizedPullRequest } from './github-event-normalizer.service';
import { PrEvent } from '@/domains/pull-requests/entities/pr-event.entity';
import { PullRequest } from '@/domains/pull-requests/entities/pull-request.entity';
import { PullRequestsService } from '@/domains/pull-requests/pull-requests.service';

export type BackfillSummary = {
  reposProcessed: number;
  prsProcessed: number;
  eventsInserted: number;
};

@Injectable()
export class BackfillService {
  constructor(
    @InjectRepository(PrEvent) private readonly eventRepo: Repository<PrEvent>,
    @InjectRepository(PullRequest) private readonly prRepo: Repository<PullRequest>,
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

  async run(): Promise<BackfillSummary> {
    const repos = this.repos();
    const quarters = Number(this.configService.get('BACKFILL_QUARTERS') ?? 3);
    const maxPrs = Number(this.configService.get('BACKFILL_MAX_PRS') ?? 0);
    const cutoff = subQuarters(new Date(), quarters);

    this.logger.log(`Backfill: ${repos.length} repo(s), since ${cutoff.toISOString()}${maxPrs ? `, max ${maxPrs} PRs/repo` : ''}`);

    const summary: BackfillSummary = { reposProcessed: 0, prsProcessed: 0, eventsInserted: 0 };

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
      const page = await this.github.fetchPullRequestTimelines(repo, { first: 25, after });
      let reachedCutoff = false;

      for (const node of page.nodes) {
        if (new Date(node.createdAt) < cutoff) {
          reachedCutoff = true;
          break;
        }
        const { pullRequest, events } = this.normalizer.normalizeBackfillNode(repo, node);
        eventsInserted += await this.persistPr(pullRequest, events);
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

  private async persistPr(header: NormalizedPullRequest, events: NormalizedEvent[]): Promise<number> {
    let pr = await this.prRepo.findOne({ where: { repo: header.repo, number: header.number } });
    if (!pr) {
      pr = this.prRepo.create({ repo: header.repo, number: header.number });
    }
    Object.assign(pr, {
      title: header.title,
      url: header.url,
      authorLogin: header.authorLogin,
      isDraft: header.isDraft,
      isBot: header.isBot,
      isRevert: header.isRevert,
    });
    pr = await this.prRepo.save(pr);

    const rows = events.map((e) => ({
      prId: pr!.id,
      type: e.type,
      actorLogin: e.actorLogin,
      payload: e.payload as Record<string, any>,
      occurredAt: e.occurredAt,
      source: e.source,
      externalId: e.externalId,
    }));

    let inserted = 0;
    if (rows.length) {
      const result = await this.eventRepo
        .createQueryBuilder()
        .insert()
        .into(PrEvent)
        .values(rows)
        .orIgnore()
        .execute();
      inserted = result.identifiers.filter(Boolean).length;
    }

    await this.pullRequests.recomputeFromEvents(pr.id);
    return inserted;
  }
}
