import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { subDays } from 'date-fns';
import { PullRequest } from '@/domains/pull-requests/entities/pull-request.entity';
import { PrEvent } from '@/domains/pull-requests/entities/pr-event.entity';
import { AreaRule } from '@/domains/repos/entities/area-rule.entity';
import { Suggestion } from './entities/suggestion.entity';
import { PrEventType, PrState } from '@/domains/pull-requests/pr-enums';
import { PeopleService } from '@/domains/people/people.service';
import { PersonSettingsService } from '@/domains/people/person-settings.service';
import { AssignmentModeValue } from '@/domains/people/entities/person-settings.entity';
import {
  AreaRuleLike,
  AssignmentEngine,
  Candidate,
  MASTERY_WINDOW_DAYS,
  MasteryActivity,
} from './assignment-engine';
import {
  ReviewRow,
  dedupeReviewsPerPr,
  recentReviewCounts,
  relayPickLoad,
  requestedReviewerLoad,
} from './candidate-stats.logic';

const FAIRNESS_WINDOW_DAYS = 14;

export type PersonRef = { personId: string; displayName: string };

export type CandidateStats = {
  candidates: Candidate[];
  rulesByRepo: Record<string, AreaRuleLike[]>;
  personByLogin: Map<string, PersonRef>;
  modeByPersonId: Map<string, AssignmentModeValue>;
};

@Injectable()
export class CandidateStatsService {
  constructor(
    @InjectRepository(PullRequest)
    private readonly prRepo: Repository<PullRequest>,
    @InjectRepository(PrEvent)
    private readonly eventRepo: Repository<PrEvent>,
    @InjectRepository(AreaRule)
    private readonly ruleRepo: Repository<AreaRule>,
    @InjectRepository(Suggestion)
    private readonly suggestionRepo: Repository<Suggestion>,
    private readonly people: PeopleService,
    private readonly personSettings: PersonSettingsService,
  ) {}

  async build(now: Date = new Date()): Promise<CandidateStats> {
    const [
      people,
      rules,
      authored,
      reviews,
      openPrs,
      relayAssignments,
      modeByPersonId,
    ] = await Promise.all([
      this.people.findAll(),
      this.ruleRepo.find(),
      this.recentAuthoredPrs(now),
      this.recentReviews(now),
      this.prRepo.find({
        where: { state: PrState.OPEN },
        select: ['requestedReviewers'],
      }),
      this.activeRelayAssignments(),
      this.personSettings.modesByPersonId(),
    ]);

    const rulesByRepo: Record<string, AreaRuleLike[]> = {};
    for (const rule of rules) {
      (rulesByRepo[rule.repo] ??= []).push(rule);
    }

    const dedupedReviews = dedupeReviewsPerPr(reviews);
    const activities: MasteryActivity[] = [
      ...authored.map((pr) => ({
        login: pr.authorLogin,
        repo: pr.repo,
        filePaths: pr.filePaths,
        occurredAt: pr.openedAt ?? pr.createdAt,
      })),
      ...dedupedReviews.map((review) => ({
        login: review.actorLogin,
        repo: review.repo,
        filePaths: review.filePaths,
        occurredAt: review.occurredAt,
      })),
    ];
    const mastery = AssignmentEngine.buildMastery(activities, rulesByRepo, now);

    const openLoad = requestedReviewerLoad(openPrs);
    const relayLoad = relayPickLoad(
      relayAssignments.map((assignment) => assignment.assignedLogin),
    );
    const recentReviewCount = recentReviewCounts(
      dedupedReviews,
      subDays(now, FAIRNESS_WINDOW_DAYS),
    );

    const personByLogin = new Map<string, PersonRef>();
    const candidates: Candidate[] = people.map((person) => {
      const displayName = person.displayName || person.email;
      const logins = person.identities.map((identity) => identity.login);
      for (const login of logins) {
        personByLogin.set(login.toLowerCase(), {
          personId: person.id,
          displayName,
        });
      }

      const masteryByArea: Record<string, number> = {};
      let openReviewRequests = 0;
      let activeRelayPicks = 0;
      let reviewsLast14Days = 0;
      for (const login of logins) {
        const key = login.toLowerCase();
        for (const [area, weight] of Object.entries(mastery.get(key) ?? {})) {
          masteryByArea[area] = (masteryByArea[area] ?? 0) + weight;
        }
        const relayPicks = relayLoad.get(key) ?? 0;
        openReviewRequests += (openLoad.get(key) ?? 0) + relayPicks;
        activeRelayPicks += relayPicks;
        reviewsLast14Days += recentReviewCount.get(key) ?? 0;
      }

      return {
        personId: person.id,
        displayName,
        logins,
        active: person.active,
        assignmentMode: modeByPersonId.get(person.id),
        masteryByArea,
        openReviewRequests,
        activeRelayPicks,
        reviewsLast14Days,
      };
    });

    return { candidates, rulesByRepo, personByLogin, modeByPersonId };
  }

  private activeRelayAssignments(): Promise<{ assignedLogin: string }[]> {
    return this.suggestionRepo
      .createQueryBuilder('s')
      .innerJoin(PullRequest, 'pr', 'pr.id = s."prId"::uuid')
      .select('s."assignedLogin"', 'assignedLogin')
      .where('s."assignedAt" IS NOT NULL')
      .andWhere('s."assignedLogin" IS NOT NULL')
      .andWhere('pr.state = :state', { state: PrState.OPEN })
      .andWhere('cardinality(pr."requestedReviewers") = 0')
      .getRawMany<{ assignedLogin: string }>();
  }

  private recentAuthoredPrs(now: Date): Promise<PullRequest[]> {
    return this.prRepo
      .createQueryBuilder('pr')
      .select([
        'pr.repo',
        'pr.authorLogin',
        'pr.filePaths',
        'pr.openedAt',
        'pr.createdAt',
      ])
      .where('pr."isBot" = false')
      .andWhere('COALESCE(pr."openedAt", pr."createdAt") >= :cutoff', {
        cutoff: subDays(now, MASTERY_WINDOW_DAYS),
      })
      .getMany();
  }

  private async recentReviews(now: Date): Promise<ReviewRow[]> {
    const rows = await this.eventRepo
      .createQueryBuilder('event')
      .innerJoin('event.pullRequest', 'pr')
      .select([
        'event."actorLogin" AS "actorLogin"',
        'event."occurredAt" AS "occurredAt"',
        'event."prId" AS "prId"',
        'pr.repo AS repo',
        'pr."filePaths" AS "filePaths"',
      ])
      .where('event.type = :type', { type: PrEventType.REVIEW_SUBMITTED })
      .andWhere('event."occurredAt" >= :cutoff', {
        cutoff: subDays(now, MASTERY_WINDOW_DAYS),
      })
      .andWhere('event."actorLogin" IS NOT NULL')
      .andWhere('LOWER(event."actorLogin") != LOWER(pr."authorLogin")')
      .andWhere('pr."isBot" = false')
      .getRawMany<ReviewRow>();
    return rows;
  }
}
