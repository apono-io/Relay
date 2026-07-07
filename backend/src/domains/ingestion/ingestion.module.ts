import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PrEvent } from '@/domains/pull-requests/entities/pr-event.entity';
import { PullRequestsModule } from '@/domains/pull-requests/pull-requests.module';
import { GithubEventNormalizer } from './github-event-normalizer.service';
import { BackfillService } from './backfill.service';
import { IngestionController } from './ingestion.controller';

@Module({
  imports: [TypeOrmModule.forFeature([PrEvent]), PullRequestsModule],
  controllers: [IngestionController],
  providers: [GithubEventNormalizer, BackfillService],
  exports: [GithubEventNormalizer, BackfillService],
})
export class IngestionModule {}
