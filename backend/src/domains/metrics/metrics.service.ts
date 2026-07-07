import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PullRequest } from '@/domains/pull-requests/entities/pull-request.entity';
import { PrState, WaitingOn } from '@/domains/pull-requests/pr-enums';
import { DashboardSummary, WaitMetric } from './models/dashboard.model';

const MAX_ROUNDS = 5;

@Injectable()
export class MetricsService {
  constructor(@InjectRepository(PullRequest) private readonly prRepo: Repository<PullRequest>) {}

  async dashboard(repo?: string, now: Date = new Date()): Promise<DashboardSummary> {
    const prs = await this.prRepo.find({ where: repo ? { repo } : {} });
    return MetricsService.buildSummary(prs, now);
  }

  static percentile(values: number[], p: number): number | null {
    const clean = values.filter((v) => v !== null && v !== undefined && !Number.isNaN(v));
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

  static buildSummary(allPrs: PullRequest[], now: Date): DashboardSummary {
    const eligible = allPrs.filter((pr) => !pr.isBot && !pr.isRevert);

    const reviewerWaitByRound = MetricsService.roundMetrics(eligible, 'reviewerWaitSeconds', 'Reviewer wait');
    const authorWaitByRound = MetricsService.roundMetrics(eligible, 'authorWaitSeconds', 'Author wait');

    const cycleValues = eligible
      .filter((pr) => pr.state === PrState.MERGED && pr.cycleTime != null)
      .map((pr) => pr.cycleTime as number);
    const cycleTime = MetricsService.metric('Cycle time', cycleValues);

    const mergedOrApproved = eligible.filter((pr) => pr.state === PrState.MERGED || pr.approvedAt != null);
    const approvedWithZeroCommentsRate = MetricsService.ratio(
      mergedOrApproved.filter((pr) => pr.approvedWithZeroComments).length,
      mergedOrApproved.length,
    );
    const revertRate = MetricsService.ratio(
      allPrs.filter((pr) => pr.isRevert).length,
      allPrs.length,
    );

    const slaMisses = eligible.filter(
      (pr) => pr.waitingOn === WaitingOn.REVIEWER && pr.reviewDueAt != null && pr.reviewDueAt < now,
    ).length;

    return {
      reviewerWaitByRound,
      authorWaitByRound,
      cycleTime,
      prCount: eligible.length,
      slaMisses,
      quality: { approvedWithZeroCommentsRate, revertRate },
    };
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
      const label = round === 1 && field === 'reviewerWaitSeconds' ? `${prefix} · round 1 (pickup)` : `${prefix} · round ${round}`;
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
