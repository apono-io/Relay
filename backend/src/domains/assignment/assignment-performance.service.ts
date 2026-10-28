import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Not, Repository } from 'typeorm';
import { PullRequest } from '@/domains/pull-requests/entities/pull-request.entity';
import { PrEvent } from '@/domains/pull-requests/entities/pr-event.entity';
import { PrEventType } from '@/domains/pull-requests/pr-enums';
import { Suggestion } from './entities/suggestion.entity';
import { AssignmentPerformance } from './models/assignment-performance.model';
import {
  buildPerformance,
  PerformanceRow,
} from './assignment-performance.logic';

const PERFORMANCE_WEEKS = 12;

@Injectable()
export class AssignmentPerformanceService {
  constructor(
    @InjectRepository(Suggestion)
    private readonly suggestionRepo: Repository<Suggestion>,
    @InjectRepository(PullRequest)
    private readonly prRepo: Repository<PullRequest>,
    @InjectRepository(PrEvent)
    private readonly eventRepo: Repository<PrEvent>,
  ) {}

  async performance(): Promise<AssignmentPerformance> {
    const assigned = await this.suggestionRepo.find({
      where: { assignedAt: Not(IsNull()), shadow: false },
    });
    if (assigned.length === 0) {
      return buildPerformance([], PERFORMANCE_WEEKS);
    }
    const prIds = assigned.map((suggestion) => suggestion.prId);
    const [prs, reviews] = await Promise.all([
      this.prRepo.find({
        where: { id: In(prIds) },
        select: ['id', 'firstReviewAt'],
      }),
      this.eventRepo.find({
        where: { prId: In(prIds), type: PrEventType.REVIEW_SUBMITTED },
        select: ['prId', 'actorLogin', 'occurredAt'],
      }),
    ]);
    const firstReviewByPr = new Map(
      prs.map((pr) => [pr.id, pr.firstReviewAt ?? null]),
    );

    const rows: PerformanceRow[] = assigned.map((suggestion) => ({
      shadow: suggestion.shadow ?? null,
      requestedAt: suggestion.assignedAt as Date,
      requestedLogin: suggestion.assignedLogin ?? '',
      firstReviewAt: firstReviewByPr.get(suggestion.prId) ?? null,
      reviews: reviews
        .filter((event) => event.prId === suggestion.prId && event.actorLogin)
        .map((event) => ({
          login: event.actorLogin as string,
          at: event.occurredAt,
        })),
    }));
    return buildPerformance(rows, PERFORMANCE_WEEKS);
  }
}
