import { Module, Global } from '@nestjs/common';
import { LoggerService } from './logging/logger.service';
import { GitHubClient } from './clients/github.client';

@Global()
@Module({
  providers: [LoggerService, GitHubClient],
  exports: [LoggerService, GitHubClient],
})
export class InfrastructureModule {}
