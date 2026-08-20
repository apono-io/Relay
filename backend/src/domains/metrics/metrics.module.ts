import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PullRequest } from '@/domains/pull-requests/entities/pull-request.entity';
import { PrEvent } from '@/domains/pull-requests/entities/pr-event.entity';
import { SchedulerModule } from '@/scheduler/scheduler.module';
import { PrAreaModule } from '@/domains/repos/pr-area.module';
import { PullRequestsModule } from '@/domains/pull-requests/pull-requests.module';
import { MetricsService } from './metrics.service';
import { MetricsResolver } from './metrics.resolver';

@Module({
  imports: [
    TypeOrmModule.forFeature([PullRequest, PrEvent]),
    SchedulerModule,
    PrAreaModule,
    PullRequestsModule,
  ],
  providers: [MetricsService, MetricsResolver],
  exports: [MetricsService],
})
export class MetricsModule {}
