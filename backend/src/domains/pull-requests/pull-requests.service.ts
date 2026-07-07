import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { PullRequest } from './entities/pull-request.entity';
import { PrEvent } from './entities/pr-event.entity';
import { PhaseComputer } from './phase-computer.service';
import { WaitingOn } from './pr-enums';

@Injectable()
export class PullRequestsService {
  constructor(
    @InjectRepository(PullRequest) private readonly prRepo: Repository<PullRequest>,
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
      where: [{ waitingOn: WaitingOn.REVIEWER }, { waitingOn: WaitingOn.AUTHOR }],
      order: { reviewDueAt: 'ASC' },
    });
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

    const slaMinutes = Number(this.configService.get('DEFAULT_REVIEW_SLA_MINUTES') ?? 120);
    const computed = this.phaseComputer.compute(events, slaMinutes);

    Object.assign(pr, {
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
    });

    return this.prRepo.save(pr);
  }
}
