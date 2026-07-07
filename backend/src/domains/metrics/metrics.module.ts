import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PullRequest } from '@/domains/pull-requests/entities/pull-request.entity';
import { PrEvent } from '@/domains/pull-requests/entities/pr-event.entity';
import { MetricsService } from './metrics.service';
import { MetricsResolver } from './metrics.resolver';

@Module({
  imports: [TypeOrmModule.forFeature([PullRequest, PrEvent])],
  providers: [MetricsService, MetricsResolver],
  exports: [MetricsService],
})
export class MetricsModule {}
