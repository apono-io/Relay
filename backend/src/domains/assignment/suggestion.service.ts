import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { subDays } from 'date-fns';
import { In, IsNull, Repository } from 'typeorm';
import { PullRequest } from '@/domains/pull-requests/entities/pull-request.entity';
import { PrEvent } from '@/domains/pull-requests/entities/pr-event.entity';
import { PrEventType, PrState } from '@/domains/pull-requests/pr-enums';
import { PeopleService } from '@/domains/people/people.service';
import { numberSetting } from '@/core/config/config-number';
import { Suggestion } from './entities/suggestion.entity';
import { AssignmentEngine, DEFAULT_ENGINE_CONFIG } from './assignment-engine';
import { CandidateStatsService, PersonRef } from './candidate-stats.service';
import {
  AssignmentComparison,
  SuggestionOutcomeRow,
} from './models/assignment-comparison.model';

export type SweepSummary = {
  prsConsidered: number;
  suggestionsRecorded: number;
  outcomesResolved: number;
};

const COMPARISON_ROWS = 50;

@Injectable()
export class SuggestionService {
  constructor(
    @InjectRepository(Suggestion)
    private readonly suggestionRepo: Repository<Suggestion>,
    @InjectRepository(PullRequest)
    private readonly prRepo: Repository<PullRequest>,
    @InjectRepository(PrEvent)
    private readonly eventRepo: Repository<PrEvent>,
    private readonly candidateStats: CandidateStatsService,
    private readonly people: PeopleService,
    private readonly configService: ConfigService,
  ) {}

  async sweep(now: Date = new Date()): Promise<SweepSummary> {
    const stats = await this.candidateStats.build(now);
    const summary: SweepSummary = {
      prsConsidered: 0,
      suggestionsRecorded: 0,
      outcomesResolved: 0,
    };

    const maxAgeDays = numberSetting(
      this.configService,
      'SUGGESTION_MAX_PR_AGE_DAYS',
      7,
    );
    const targets = await this.prRepo
      .createQueryBuilder('pr')
      .where('pr.state = :state', { state: PrState.OPEN })
      .andWhere('pr."isDraft" = false')
      .andWhere('pr."isBot" = false')
      .andWhere('cardinality(pr."requestedReviewers") = 0')
      .andWhere('pr."firstReviewAt" IS NULL')
      .andWhere('COALESCE(pr."openedAt", pr."createdAt") >= :freshCutoff', {
        freshCutoff: subDays(now, maxAgeDays),
      })
      .getMany();
    summary.prsConsidered = targets.length;

    const existing = await this.suggestionRepo.find({ select: ['prId'] });
    const known = new Set(existing.map((row) => row.prId));

    for (const pr of targets) {
      if (known.has(pr.id)) {
        continue;
      }
      const rules = stats.rulesByRepo[pr.repo] ?? [];
      const area = AssignmentEngine.classify(pr.filePaths, rules);
      const author = stats.personByLogin.get(pr.authorLogin.toLowerCase());
      const result = AssignmentEngine.rank({
        authorPersonId: author?.personId ?? null,
        authorLogin: pr.authorLogin,
        requestedReviewers: pr.requestedReviewers,
        area,
        candidates: stats.candidates,
        config: DEFAULT_ENGINE_CONFIG,
      });
      if (result.picks.length === 0) {
        continue;
      }
      await this.suggestionRepo.save(
        this.suggestionRepo.create({
          prId: pr.id,
          repo: pr.repo,
          prNumber: pr.number,
          area: area.area,
          risk: area.risk,
          picks: result.picks,
          generatedAt: now,
        }),
      );
      summary.suggestionsRecorded += 1;
    }

    summary.outcomesResolved = await this.resolveOutcomes(
      stats.personByLogin,
      now,
    );
    return summary;
  }

  private async resolveOutcomes(
    personByLogin: Map<string, PersonRef>,
    now: Date,
  ): Promise<number> {
    const pending = await this.suggestionRepo.find({
      where: { resolvedAt: IsNull() },
    });
    if (pending.length === 0) {
      return 0;
    }
    const prs = await this.prRepo.find({
      where: { id: In(pending.map((row) => row.prId)) },
    });
    const prById = new Map(prs.map((pr) => [pr.id, pr]));

    let resolved = 0;
    for (const suggestion of pending) {
      const pr = prById.get(suggestion.prId);
      if (!pr) {
        continue;
      }
      let actualLogins: string[] = [];
      if (pr.requestedReviewers.length > 0) {
        actualLogins = pr.requestedReviewers;
      } else if (pr.firstReviewAt) {
        const firstReview = await this.eventRepo.findOne({
          where: { prId: pr.id, type: PrEventType.REVIEW_SUBMITTED },
          order: { occurredAt: 'ASC' },
        });
        if (firstReview?.actorLogin) {
          actualLogins = [firstReview.actorLogin];
        }
      }

      if (actualLogins.length === 0 && pr.state === PrState.OPEN) {
        continue;
      }

      suggestion.actualLogins = actualLogins;
      suggestion.resolvedAt = now;
      suggestion.matched =
        actualLogins.length > 0
          ? this.picksMatch(suggestion, actualLogins, personByLogin)
          : null;
      await this.suggestionRepo.save(suggestion);
      resolved += 1;
    }
    return resolved;
  }

  private picksMatch(
    suggestion: Suggestion,
    actualLogins: string[],
    personByLogin: Map<string, PersonRef>,
  ): boolean {
    const actualPersonIds = new Set(
      actualLogins
        .map((login) => personByLogin.get(login.toLowerCase())?.personId)
        .filter((id): id is string => Boolean(id)),
    );
    const actualLoginSet = new Set(
      actualLogins.map((login) => login.toLowerCase()),
    );
    return suggestion.picks.some(
      (pick) =>
        actualPersonIds.has(pick.personId) ||
        actualLoginSet.has(pick.login.toLowerCase()),
    );
  }

  async comparison(): Promise<AssignmentComparison> {
    const [suggestions, people] = await Promise.all([
      this.suggestionRepo.find({
        order: { generatedAt: 'DESC' },
        take: COMPARISON_ROWS,
      }),
      this.people.findAll(),
    ]);
    const nameByLogin = new Map<string, string>();
    for (const person of people) {
      for (const identity of person.identities) {
        nameByLogin.set(
          identity.login.toLowerCase(),
          person.displayName || person.email,
        );
      }
    }
    const [recorded, awaiting, decided, agreements] = await Promise.all([
      this.suggestionRepo.count(),
      this.suggestionRepo.count({ where: { resolvedAt: IsNull() } }),
      this.suggestionRepo
        .createQueryBuilder('s')
        .where('s."matched" IS NOT NULL')
        .getCount(),
      this.suggestionRepo.count({ where: { matched: true } }),
    ]);

    const prs = await this.prRepo.find({
      where: { id: In(suggestions.map((row) => row.prId)) },
      select: ['id', 'title', 'url'],
    });
    const prById = new Map(prs.map((pr) => [pr.id, pr]));

    const rows: SuggestionOutcomeRow[] = suggestions.map((suggestion) => {
      const pr = prById.get(suggestion.prId);
      const pick = suggestion.picks[0];
      return {
        id: suggestion.id,
        repo: suggestion.repo,
        prNumber: suggestion.prNumber,
        prTitle: pr?.title ?? `#${suggestion.prNumber}`,
        prUrl:
          pr?.url ??
          `https://github.com/${suggestion.repo}/pull/${suggestion.prNumber}`,
        area: suggestion.area,
        suggestedName: pick?.displayName ?? 'Nobody eligible',
        suggestedLogin: pick?.login ?? '',
        reason: pick?.reason ?? '',
        signals: pick?.signals ?? null,
        actualNames: suggestion.actualLogins.map(
          (login) => nameByLogin.get(login.toLowerCase()) ?? login,
        ),
        matched: suggestion.matched,
        generatedAt: suggestion.generatedAt,
        resolvedAt: suggestion.resolvedAt,
      };
    });

    return {
      recorded,
      awaiting,
      decided,
      agreements,
      agreementRate: decided > 0 ? agreements / decided : null,
      rows,
    };
  }
}
