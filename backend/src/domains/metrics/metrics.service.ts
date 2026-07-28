import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { format } from 'date-fns';
import { PullRequest } from '@/domains/pull-requests/entities/pull-request.entity';
import { PrEvent } from '@/domains/pull-requests/entities/pr-event.entity';
import { isBotReviewer } from '@/domains/pull-requests/phase-computer.service';
import { SyncStatusService } from '@/infrastructure/sync/sync-status.service';
import {
  PrEventType,
  PrState,
  WaitingOn,
} from '@/domains/pull-requests/pr-enums';
import {
  DashboardSummary,
  ReviewerLoad,
  StuckPr,
  WaitMetric,
  WeeklyPhasePoint,
  WeeklyQualityPoint,
} from './models/dashboard.model';

const MAX_ROUNDS = 5;

@Injectable()
export class MetricsService {
  constructor(
    @InjectRepository(PullRequest)
    private readonly prRepo: Repository<PullRequest>,
    @InjectRepository(PrEvent) private readonly eventRepo: Repository<PrEvent>,
    private readonly configService: ConfigService,
    private readonly syncStatus: SyncStatusService,
  ) {}

  async dashboard(
    repo?: string,
    now: Date = new Date(),
  ): Promise<DashboardSummary> {
    const prs = await this.prRepo.find({ where: repo ? { repo } : {} });
    const reviewerLogins = await this.reviewerLogins(repo);
    const slaMinutes = Number(
      this.configService.get('DEFAULT_REVIEW_SLA_MINUTES') ?? 120,
    );
    const botReviewers = new Set(
      (
        this.configService.get<string>('GITHUB_BOT_REVIEWERS') ??
        'github-code-quality,claude'
      )
        .split(',')
        .map((login) => login.trim().toLowerCase())
        .filter(Boolean),
    );
    const summary = MetricsService.buildSummary(
      prs,
      now,
      reviewerLogins,
      slaMinutes,
      botReviewers,
    );
    summary.lastSyncedAt =
      this.syncStatus.lastSyncedAt ?? (await this.latestIngestedAt());
    return summary;
  }

  async lastSynced(): Promise<Date | null> {
    return this.syncStatus.lastSyncedAt ?? (await this.latestIngestedAt());
  }

  private async latestIngestedAt(): Promise<Date | null> {
    const [latest] = await this.eventRepo.find({
      order: { createdAt: 'DESC' },
      take: 1,
    });
    return latest?.createdAt ?? null;
  }

  private async reviewerLogins(repo?: string): Promise<string[]> {
    const query = this.eventRepo
      .createQueryBuilder('event')
      .innerJoin(PullRequest, 'pr', 'pr.id = event.prId')
      .select('event.actorLogin', 'actorLogin')
      .where('event.type = :type', { type: PrEventType.REVIEW_SUBMITTED })
      .andWhere('event.actorLogin IS NOT NULL');
    if (repo) {
      query.andWhere('pr.repo = :repo', { repo });
    }
    const rows = await query.getRawMany<{ actorLogin: string }>();
    return rows.map((r) => r.actorLogin);
  }

  static isoWeek(date: Date): string {
    return format(date, "RRRR-'W'II");
  }

  static percentile(values: number[], p: number): number | null {
    const clean = values.filter(
      (v) => v !== null && v !== undefined && !Number.isNaN(v),
    );
    if (clean.length === 0) {
      return null;
    }
    const sorted = [...clean].sort((a, b) => a - b);
    if (sorted.length === 1) {
      return sorted[0];
    }
    const idx = p * (sorted.length - 1);
    const lo = Math.floor(idx);
    const hi = Math.ceil(idx);
    if (lo === hi) {
      return sorted[lo];
    }
    return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
  }

  static buildSummary(
    allPrs: PullRequest[],
    now: Date,
    reviewerLogins: string[] = [],
    slaMinutes = 120,
    botReviewers: Set<string> = new Set(),
  ): DashboardSummary {
    const eligible = allPrs.filter((pr) => !pr.isBot && !pr.isRevert);

    const reviewerWaitByRound = MetricsService.roundMetrics(
      eligible,
      'reviewerWaitSeconds',
      'Reviewer wait',
    );
    const authorWaitByRound = MetricsService.roundMetrics(
      eligible,
      'authorWaitSeconds',
      'Author wait',
    );

    const cycleValues = eligible
      .filter((pr) => pr.state === PrState.MERGED && pr.cycleTime != null)
      .map((pr) => pr.cycleTime as number);
    const cycleTime = MetricsService.metric('Cycle time', cycleValues);

    const mergedOrApproved = eligible.filter(
      (pr) => pr.state === PrState.MERGED || pr.approvedAt != null,
    );
    const approvedWithZeroCommentsRate = MetricsService.ratio(
      mergedOrApproved.filter((pr) => pr.approvedWithZeroComments).length,
      mergedOrApproved.length,
    );
    const revertRate = MetricsService.ratio(
      allPrs.filter((pr) => pr.isRevert).length,
      allPrs.length,
    );

    const slaMisses = eligible.filter(
      (pr) =>
        pr.waitingOn === WaitingOn.REVIEWER &&
        pr.reviewDueAt != null &&
        pr.reviewDueAt < now,
    ).length;

    const pickups = eligible.filter((pr) => pr.pickupTime != null);
    const slaMissRate = MetricsService.ratio(
      pickups.filter((pr) => (pr.pickupTime as number) > slaMinutes * 60)
        .length,
      pickups.length,
    );

    const waitingCount = allPrs.filter(
      (pr) =>
        pr.state === PrState.OPEN &&
        !pr.isDraft &&
        pr.waitingOn !== WaitingOn.NONE &&
        pr.openedAt != null,
    ).length;

    return {
      reviewerWaitByRound,
      authorWaitByRound,
      cycleTime,
      prCount: eligible.length,
      slaMisses,
      slaMissRate,
      waitingCount,
      quality: { approvedWithZeroCommentsRate, revertRate },
      weeklyPhases: MetricsService.weeklyPhases(eligible),
      stuckNow: MetricsService.stuckNow(allPrs, now, slaMinutes),
      fairness: MetricsService.fairness(reviewerLogins, botReviewers),
      qualityTrend: MetricsService.qualityTrend(allPrs),
      lastSyncedAt: null,
    };
  }

  static weeklyPhases(prs: PullRequest[]): WeeklyPhasePoint[] {
    const merged = prs.filter(
      (pr) => pr.state === PrState.MERGED && pr.mergedAt != null,
    );
    const byWeek = MetricsService.groupBy(merged, (pr) =>
      MetricsService.isoWeek(pr.mergedAt as Date),
    );
    return [...byWeek.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([week, group]) => ({
        week,
        codingSeconds:
          MetricsService.percentile(
            MetricsService.pluck(group, 'codingTime'),
            0.5,
          ) ?? undefined,
        pickupSeconds:
          MetricsService.percentile(
            MetricsService.pluck(group, 'pickupTime'),
            0.5,
          ) ?? undefined,
        reworkSeconds:
          MetricsService.percentile(
            MetricsService.pluck(group, 'reworkTime'),
            0.5,
          ) ?? undefined,
        mergeSeconds:
          MetricsService.percentile(
            MetricsService.pluck(group, 'mergeTime'),
            0.5,
          ) ?? undefined,
        prCount: group.length,
      }));
  }

  static stuckNow(
    allPrs: PullRequest[],
    now: Date,
    slaMinutes = 120,
  ): StuckPr[] {
    return allPrs
      .filter(
        (pr) =>
          pr.state === PrState.OPEN &&
          !pr.isDraft &&
          pr.waitingOn !== WaitingOn.NONE &&
          pr.openedAt != null,
      )
      .map((pr) => ({
        repo: pr.repo,
        number: pr.number,
        title: pr.title,
        url: pr.url,
        authorLogin: pr.authorLogin,
        waitingOn: pr.waitingOn,
        waitingSeconds: MetricsService.currentWaitSeconds(pr, now, slaMinutes),
        requestedReviewers: pr.requestedReviewers ?? [],
        slaBreached: pr.reviewDueAt != null && pr.reviewDueAt < now,
        roundNumber: pr.waitRounds?.length || 1,
        dueInSeconds:
          pr.waitingOn === WaitingOn.REVIEWER && pr.reviewDueAt != null
            ? (pr.reviewDueAt.getTime() - now.getTime()) / 1000
            : null,
        openedAt: pr.openedAt ?? null,
        readyAt: pr.readyAt ?? null,
        firstReviewAt: pr.firstReviewAt ?? null,
        approvedAt: pr.approvedAt ?? null,
      }))
      .sort((a, b) => b.waitingSeconds - a.waitingSeconds);
  }

  private static currentWaitSeconds(
    pr: PullRequest,
    now: Date,
    slaMinutes: number,
  ): number {
    if (pr.waitingOn === WaitingOn.REVIEWER && pr.reviewDueAt != null) {
      const roundStart = pr.reviewDueAt.getTime() - slaMinutes * 60 * 1000;
      return (now.getTime() - roundStart) / 1000;
    }
    return (now.getTime() - (pr.openedAt as Date).getTime()) / 1000;
  }

  static fairness(
    reviewerLogins: string[],
    botReviewers: Set<string> = new Set(),
  ): ReviewerLoad[] {
    const counts = new Map<string, number>();
    for (const login of reviewerLogins) {
      if (isBotReviewer(login, botReviewers)) {
        continue;
      }
      counts.set(login, (counts.get(login) ?? 0) + 1);
    }
    return [...counts.entries()]
      .map(([login, reviewCount]) => ({ login, reviewCount }))
      .sort((a, b) => b.reviewCount - a.reviewCount);
  }

  static qualityTrend(allPrs: PullRequest[]): WeeklyQualityPoint[] {
    const merged = allPrs.filter(
      (pr) => pr.state === PrState.MERGED && pr.mergedAt != null,
    );
    const byWeek = MetricsService.groupBy(merged, (pr) =>
      MetricsService.isoWeek(pr.mergedAt as Date),
    );
    return [...byWeek.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([week, group]) => ({
        week,
        approvedWithZeroCommentsRate: MetricsService.ratio(
          group.filter((pr) => pr.approvedWithZeroComments).length,
          group.length,
        ),
        revertRate: MetricsService.ratio(
          group.filter((pr) => pr.isRevert).length,
          group.length,
        ),
        prCount: group.length,
      }));
  }

  private static pluck(
    prs: PullRequest[],
    field: 'codingTime' | 'pickupTime' | 'reworkTime' | 'mergeTime',
  ): number[] {
    return prs.map((pr) => pr[field]).filter((v): v is number => v != null);
  }

  private static groupBy<T>(
    items: T[],
    key: (item: T) => string,
  ): Map<string, T[]> {
    const map = new Map<string, T[]>();
    for (const item of items) {
      const k = key(item);
      const bucket = map.get(k);
      if (bucket) {
        bucket.push(item);
      } else {
        map.set(k, [item]);
      }
    }
    return map;
  }

  private static roundMetrics(
    prs: PullRequest[],
    field: 'reviewerWaitSeconds' | 'authorWaitSeconds',
    prefix: string,
  ): WaitMetric[] {
    const maxRound = Math.min(
      MAX_ROUNDS,
      prs.reduce((max, pr) => Math.max(max, pr.waitRounds?.length ?? 0), 0),
    );

    const metrics: WaitMetric[] = [];
    for (let round = 1; round <= maxRound; round += 1) {
      const values = prs
        .map((pr) => pr.waitRounds?.find((r) => r.round === round)?.[field])
        .filter((v): v is number => v != null);
      if (values.length === 0) {
        continue;
      }
      const label =
        round === 1 && field === 'reviewerWaitSeconds'
          ? `${prefix} · round 1 (pickup)`
          : `${prefix} · round ${round}`;
      metrics.push(MetricsService.metric(label, values));
    }
    return metrics;
  }

  private static metric(label: string, values: number[]): WaitMetric {
    return {
      label,
      medianSeconds: MetricsService.percentile(values, 0.5) ?? undefined,
      p90Seconds: MetricsService.percentile(values, 0.9) ?? undefined,
      sampleSize: values.length,
    };
  }

  private static ratio(numerator: number, denominator: number): number {
    return denominator === 0 ? 0 : numerator / denominator;
  }
}
