import { Module } from '@nestjs/common';
import { IngestionModule } from '@/domains/ingestion/ingestion.module';
import { PullRequestsModule } from '@/domains/pull-requests/pull-requests.module';
import { AssignmentModule } from '@/domains/assignment/assignment.module';
import { GapFillJob } from './gap-fill.job';
import { MetricsRefreshJob } from './metrics-refresh.job';
import { AssignmentSweepJob } from './assignment-sweep.job';

@Module({
  imports: [IngestionModule, PullRequestsModule, AssignmentModule],
  providers: [GapFillJob, MetricsRefreshJob, AssignmentSweepJob],
  exports: [GapFillJob],
})
export class SchedulerModule {}
