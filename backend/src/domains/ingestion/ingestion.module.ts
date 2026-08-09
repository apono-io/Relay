import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PrEvent } from '@/domains/pull-requests/entities/pr-event.entity';
import { Repo } from '@/domains/repos/entities/repo.entity';
import { PullRequestsModule } from '@/domains/pull-requests/pull-requests.module';
import { GithubEventNormalizer } from './github-event-normalizer.service';
import { BackfillService } from './backfill.service';
import { PrIngestService } from './pr-ingest.service';
import { IngestionController } from './ingestion.controller';

@Module({
  imports: [TypeOrmModule.forFeature([PrEvent, Repo]), PullRequestsModule],
  controllers: [IngestionController],
  providers: [GithubEventNormalizer, BackfillService, PrIngestService],
  exports: [GithubEventNormalizer, BackfillService, PrIngestService],
})
export class IngestionModule {}
