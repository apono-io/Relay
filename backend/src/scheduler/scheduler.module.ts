import { Module } from '@nestjs/common';
import { IngestionModule } from '@/domains/ingestion/ingestion.module';
import { GapFillJob } from './gap-fill.job';
import { MetricsRefreshJob } from './metrics-refresh.job';

@Module({
  imports: [IngestionModule],
  providers: [GapFillJob, MetricsRefreshJob],
})
export class SchedulerModule {}
