import { Module, Global } from '@nestjs/common';
import { LoggerService } from './logging/logger.service';
import { GitHubClient } from './clients/github.client';
import { SyncStatusService } from './sync/sync-status.service';

@Global()
@Module({
  providers: [LoggerService, GitHubClient, SyncStatusService],
  exports: [LoggerService, GitHubClient, SyncStatusService],
})
export class InfrastructureModule {}
