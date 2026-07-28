import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { DashboardSummary } from './models/dashboard.model';
import { MetricsService } from './metrics.service';
import { JwtAuthGuard } from '@/core/auth/guards/jwt-auth.guard';
import { GapFillJob } from '@/scheduler/gap-fill.job';

@Resolver(() => DashboardSummary)
export class MetricsResolver {
  constructor(
    private readonly metricsService: MetricsService,
    private readonly gapFillJob: GapFillJob,
  ) {}

  @Query(() => DashboardSummary, { name: 'dashboard' })
  @UseGuards(JwtAuthGuard)
  dashboard(
    @Args('repo', { nullable: true }) repo?: string,
  ): Promise<DashboardSummary> {
    return this.metricsService.dashboard(repo);
  }

  @Query(() => Date, { name: 'lastSyncedAt', nullable: true })
  @UseGuards(JwtAuthGuard)
  lastSyncedAt(): Promise<Date | null> {
    return this.metricsService.lastSynced();
  }

  @Mutation(() => Date, { name: 'syncNow', nullable: true })
  @UseGuards(JwtAuthGuard)
  syncNow(): Promise<Date | null> {
    return this.gapFillJob.runNow();
  }
}
