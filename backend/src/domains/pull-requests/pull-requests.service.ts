import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { PullRequest } from './entities/pull-request.entity';
import { PrEvent } from './entities/pr-event.entity';
import { PhaseComputer, isBotReviewer } from './phase-computer.service';
import { WaitingOn, PrState, PrEventType } from './pr-enums';
import {
  buildReviewRounds,
  ReviewEventRow,
  ReviewRoundEntry,
} from './review-rounds.logic';

type VerdictRow = {
  prId: string;
  type: string;
  actorLogin: string | null;
  state: string | null;
  occurredAt: Date;
};

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
      .andWhere('pr."isDraft" = false')
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

  findOpenReviewedBy(logins: string[]): Promise<PullRequest[]> {
    if (logins.length === 0) {
      return Promise.resolve([]);
    }
    return this.reviewerInvolvementQuery(logins)
      .andWhere('pr.state = :state', { state: PrState.OPEN })
      .andWhere('pr."isDraft" = false')
      .andWhere(
        `COALESCE((
           SELECT verdict.payload->>'state'
           FROM pr_events verdict
           WHERE verdict."prId" = pr.id
             AND verdict.type IN (:...verdictTypes)
             AND LOWER(verdict."actorLogin") = ANY(:logins)
           ORDER BY verdict."occurredAt" DESC
           LIMIT 1
         ), '') != 'approved'`,
        {
          logins: lowered(logins),
          verdictTypes: [
            PrEventType.REVIEW_SUBMITTED,
            PrEventType.REVIEW_DISMISSED,
          ],
        },
      )
      .orderBy('pr."openedAt"', 'ASC', 'NULLS LAST')
      .getMany();
  }

  findRecentlyMergedReviewedBy(
    logins: string[],
    since: Date,
  ): Promise<PullRequest[]> {
    if (logins.length === 0) {
      return Promise.resolve([]);
    }
    return this.reviewerInvolvementQuery(logins)
      .andWhere('pr.state = :state', { state: PrState.MERGED })
      .andWhere('pr."mergedAt" >= :since', { since })
      .orderBy('pr."mergedAt"', 'DESC')
      .getMany();
  }

  private reviewerInvolvementQuery(logins: string[]) {
    return this.prRepo
      .createQueryBuilder('pr')
      .where('LOWER(pr."authorLogin") != ALL(:logins)', {
        logins: lowered(logins),
      })
      .andWhere(
        `(EXISTS (SELECT 1 FROM unnest(pr."requestedReviewers") reviewer WHERE LOWER(reviewer) = ANY(:logins))
          OR EXISTS (SELECT 1 FROM pr_events event WHERE event."prId" = pr.id AND event.type = :reviewType AND LOWER(event."actorLogin") = ANY(:logins)))`,
        { logins: lowered(logins), reviewType: PrEventType.REVIEW_SUBMITTED },
      );
  }

  async humanReviewerLogins(
    prId: string,
    authorLogin: string,
  ): Promise<string[]> {
    const rows = await this.eventRepo
      .createQueryBuilder('event')
      .select('event.actorLogin', 'actorLogin')
      .distinct(true)
      .where('event."prId" = :prId', { prId })
      .andWhere('event.type = :type', { type: PrEventType.REVIEW_SUBMITTED })
      .andWhere('event."actorLogin" IS NOT NULL')
      .getRawMany<{ actorLogin: string }>();
    const bots = this.botReviewers();
    const author = authorLogin.toLowerCase();
    return rows
      .map((row) => row.actorLogin)
      .filter(
        (login) =>
          !isBotReviewer(login, bots) && login.toLowerCase() !== author,
      );
  }

  async reviewRoundsFor(
    prId: string,
    authorLogin: string,
  ): Promise<ReviewRoundEntry[]> {
    const rows = await this.reviewVerdictRows([prId]);
    return buildReviewRounds(this.humanVerdicts(rows, authorLogin));
  }

  async reviewRoundsForMany(
    prs: { id: string; authorLogin: string }[],
  ): Promise<Map<string, ReviewRoundEntry[]>> {
    const result = new Map<string, ReviewRoundEntry[]>();
    if (prs.length === 0) {
      return result;
    }
    const rows = await this.reviewVerdictRows(prs.map((pr) => pr.id));
    const byPr = new Map<string, VerdictRow[]>();
    for (const row of rows) {
      const existing = byPr.get(row.prId);
      if (existing) {
        existing.push(row);
      } else {
        byPr.set(row.prId, [row]);
      }
    }
    for (const pr of prs) {
      const verdicts = this.humanVerdicts(
        byPr.get(pr.id) ?? [],
        pr.authorLogin,
      );
      result.set(pr.id, buildReviewRounds(verdicts));
    }
    return result;
  }

  private async reviewVerdictRows(prIds: string[]): Promise<VerdictRow[]> {
    const rows = await this.eventRepo
      .createQueryBuilder('event')
      .select('event.prId', 'prId')
      .addSelect('event.type', 'type')
      .addSelect('event.actorLogin', 'actorLogin')
      .addSelect("event.payload->>'state'", 'state')
      .addSelect('event.occurredAt', 'occurredAt')
      .where('event."prId" IN (:...prIds)', { prIds })
      .andWhere('event.type IN (:...types)', {
        types: [PrEventType.REVIEW_SUBMITTED, PrEventType.REVIEW_DISMISSED],
      })
      .orderBy('event."occurredAt"', 'ASC')
      .getRawMany<VerdictRow>();
    return rows.map((row) => ({
      ...row,
      occurredAt: new Date(row.occurredAt),
    }));
  }

  private humanVerdicts(
    rows: VerdictRow[],
    authorLogin: string,
  ): ReviewEventRow[] {
    const bots = this.botReviewers();
    const author = authorLogin.toLowerCase();
    return rows
      .filter((row) => {
        const login = row.actorLogin;
        if (!login) {
          return false;
        }
        return !isBotReviewer(login, bots) && login.toLowerCase() !== author;
      })
      .map((row) => ({
        type: row.type,
        actorLogin: row.actorLogin,
        state: row.state,
        occurredAt: row.occurredAt,
      }));
  }

  private botReviewers(): Set<string> {
    return new Set(
      (
        this.configService.get<string>('GITHUB_BOT_REVIEWERS') ??
        'github-code-quality,claude,copilot-pull-request-reviewer'
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
