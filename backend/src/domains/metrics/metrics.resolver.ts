import { Args, Query, Resolver } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { DashboardSummary } from './models/dashboard.model';
import { MetricsService } from './metrics.service';
import { JwtAuthGuard } from '@/core/auth/guards/jwt-auth.guard';

@Resolver(() => DashboardSummary)
export class MetricsResolver {
  constructor(private readonly metricsService: MetricsService) {}

  @Query(() => DashboardSummary, { name: 'dashboard' })
  @UseGuards(JwtAuthGuard)
  dashboard(@Args('repo', { nullable: true }) repo?: string): Promise<DashboardSummary> {
    return this.metricsService.dashboard(repo);
  }
}
