import { Module, Global } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LoggerService } from './logging/logger.service';
import { GitHubClient } from './clients/github.client';
import { SyncStatusService } from './sync/sync-status.service';
import { AppSetting } from '@/domains/assignment/entities/app-setting.entity';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([AppSetting])],
  providers: [LoggerService, GitHubClient, SyncStatusService],
  exports: [LoggerService, GitHubClient, SyncStatusService],
})
export class InfrastructureModule {}
