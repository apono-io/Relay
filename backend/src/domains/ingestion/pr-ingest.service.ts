import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import {
  NormalizedEvent,
  NormalizedPullRequest,
} from './github-event-normalizer.service';
import { PrEvent } from '@/domains/pull-requests/entities/pr-event.entity';
import { PullRequest } from '@/domains/pull-requests/entities/pull-request.entity';
import { Repo } from '@/domains/repos/entities/repo.entity';
import { PullRequestsService } from '@/domains/pull-requests/pull-requests.service';
import { PrEventSource } from '@/domains/pull-requests/pr-enums';

@Injectable()
export class PrIngestService {
  constructor(
    @InjectRepository(PrEvent) private readonly eventRepo: Repository<PrEvent>,
    @InjectRepository(PullRequest)
    private readonly prRepo: Repository<PullRequest>,
    @InjectRepository(Repo) private readonly repoRepo: Repository<Repo>,
    private readonly pullRequests: PullRequestsService,
    private readonly configService: ConfigService,
  ) {}

  async repos(): Promise<string[]> {
    const rows = await this.repoRepo.find({ order: { name: 'ASC' } });
    if (rows.length > 0) {
      return rows.map((row) => row.name);
    }
    return (this.configService.get<string>('GITHUB_REPOS') || '')
      .split(',')
      .map((r) => r.trim())
      .filter(Boolean);
  }

  async persistPr(
    header: NormalizedPullRequest,
    events: NormalizedEvent[],
    sourceOverride?: PrEventSource,
  ): Promise<number> {
    let pr = await this.prRepo.findOne({
      where: { repo: header.repo, number: header.number },
    });
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
      filePaths: header.filePaths,
    });
    pr = await this.prRepo.save(pr);

    const rows = events.map((e) => ({
      prId: pr!.id,
      type: e.type,
      actorLogin: e.actorLogin,
      payload: e.payload as Record<string, any>,
      occurredAt: e.occurredAt,
      source: sourceOverride ?? e.source,
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
