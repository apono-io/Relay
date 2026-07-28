import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { PullRequest } from './entities/pull-request.entity';
import { PrEvent } from './entities/pr-event.entity';
import { PhaseComputer } from './phase-computer.service';
import { WaitingOn, PrState } from './pr-enums';

@Injectable()
export class PullRequestsService {
  constructor(
    @InjectRepository(PullRequest)
    private readonly prRepo: Repository<PullRequest>,
    @InjectRepository(PrEvent) private readonly eventRepo: Repository<PrEvent>,
    private readonly phaseComputer: PhaseComputer,
    private readonly configService: ConfigService,
  ) {}

  findAll(repo?: string): Promise<PullRequest[]> {
    return this.prRepo.find({
      where: repo ? { repo } : {},
      order: { updatedAt: 'DESC' },
    });
  }

  findStuck(): Promise<PullRequest[]> {
    return this.prRepo.find({
      where: [
        { waitingOn: WaitingOn.REVIEWER },
        { waitingOn: WaitingOn.AUTHOR },
      ],
      order: { reviewDueAt: 'ASC' },
    });
  }

  findOpenAuthoredBy(logins: string[]): Promise<PullRequest[]> {
    if (logins.length === 0) {
      return Promise.resolve([]);
    }
    return this.prRepo
      .createQueryBuilder('pr')
      .where('pr.state = :state', { state: PrState.OPEN })
      .andWhere('LOWER(pr."authorLogin") = ANY(:logins)', {
        logins: lowered(logins),
      })
      .orderBy('pr."openedAt"', 'DESC', 'NULLS LAST')
      .getMany();
  }

  findRecentlyMergedBy(logins: string[], since: Date): Promise<PullRequest[]> {
    if (logins.length === 0) {
      return Promise.resolve([]);
    }
    return this.prRepo
      .createQueryBuilder('pr')
      .where('pr.state = :state', { state: PrState.MERGED })
      .andWhere('pr."mergedAt" >= :since', { since })
      .andWhere('LOWER(pr."authorLogin") = ANY(:logins)', {
        logins: lowered(logins),
      })
      .orderBy('pr."mergedAt"', 'DESC')
      .getMany();
  }

  async findOpenNumbersUpdatedBefore(
    repo: string,
    cutoff: Date,
  ): Promise<number[]> {
    const rows = await this.prRepo
      .createQueryBuilder('pr')
      .select('pr.number', 'number')
      .where('pr.repo = :repo', { repo })
      .andWhere('pr.state = :state', { state: PrState.OPEN })
      .andWhere('pr."updatedAt" < :cutoff', { cutoff })
      .getRawMany<{ number: number }>();
    return rows.map((row) => Number(row.number));
  }

  findAwaitingReviewBy(logins: string[]): Promise<PullRequest[]> {
    if (logins.length === 0) {
      return Promise.resolve([]);
    }
    return this.prRepo
      .createQueryBuilder('pr')
      .where('pr.state = :state', { state: PrState.OPEN })
      .andWhere('pr."isDraft" = false')
      .andWhere(
        'EXISTS (SELECT 1 FROM unnest(pr."requestedReviewers") reviewer WHERE LOWER(reviewer) = ANY(:logins))',
        { logins: lowered(logins) },
      )
      .orderBy('pr."openedAt"', 'ASC', 'NULLS LAST')
      .getMany();
  }

  private botReviewers(): Set<string> {
    return new Set(
      (
        this.configService.get<string>('GITHUB_BOT_REVIEWERS') ??
        'github-code-quality,claude'
      )
        .split(',')
        .map((r) => r.trim().toLowerCase())
        .filter(Boolean),
    );
  }

  async recomputeAll(): Promise<number> {
    const prs = await this.prRepo.find({ select: { id: true } });
    for (const pr of prs) {
      await this.recomputeFromEvents(pr.id);
    }
    return prs.length;
  }

  async recomputeFromEvents(prId: string): Promise<PullRequest | null> {
    const pr = await this.prRepo.findOne({ where: { id: prId } });
    if (!pr) {
      return null;
    }

    const events = await this.eventRepo.find({
      where: { prId },
      order: { occurredAt: 'ASC' },
    });

    const slaMinutes = Number(
      this.configService.get('DEFAULT_REVIEW_SLA_MINUTES') ?? 120,
    );
    const computed = this.phaseComputer.compute(
      events,
      slaMinutes,
      this.botReviewers(),
    );

    const state = computed.mergedAt
      ? PrState.MERGED
      : computed.closedAt
        ? PrState.CLOSED
        : PrState.OPEN;

    Object.assign(pr, {
      state,
      firstCommitAt: computed.firstCommitAt,
      openedAt: computed.openedAt,
      readyAt: computed.readyAt,
      firstReviewAt: computed.firstReviewAt,
      approvedAt: computed.approvedAt,
      lastCommitAt: computed.lastCommitAt,
      mergedAt: computed.mergedAt,
      closedAt: computed.closedAt,
      codingTime: computed.codingTime,
      pickupTime: computed.pickupTime,
      reworkTime: computed.reworkTime,
      mergeTime: computed.mergeTime,
      cycleTime: computed.cycleTime,
      leadTime: computed.leadTime,
      reviewerWaitTime: computed.reviewerWaitTime,
      authorWaitTime: computed.authorWaitTime,
      reworkCycles: computed.reworkCycles,
      reviewCommentCount: computed.reviewCommentCount,
      approvedWithZeroComments: computed.approvedWithZeroComments,
      checkState: computed.checkState,
      waitingOn: computed.waitingOn,
      requestedReviewers: computed.requestedReviewers,
      reviewDueAt: computed.reviewDueAt,
      waitRounds: computed.waitRounds,
    });

    return this.prRepo.save(pr);
  }
}

function lowered(logins: string[]): string[] {
  return logins.map((login) => login.toLowerCase());
}
