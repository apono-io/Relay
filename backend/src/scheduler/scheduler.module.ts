import { Module } from '@nestjs/common';
import { IngestionModule } from '@/domains/ingestion/ingestion.module';
import { PullRequestsModule } from '@/domains/pull-requests/pull-requests.module';
import { GapFillJob } from './gap-fill.job';
import { MetricsRefreshJob } from './metrics-refresh.job';

@Module({
  imports: [IngestionModule, PullRequestsModule],
  providers: [GapFillJob, MetricsRefreshJob],
  exports: [GapFillJob],
})
export class SchedulerModule {}
