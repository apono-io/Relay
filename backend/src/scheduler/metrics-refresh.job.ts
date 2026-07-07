import { Injectable } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { LoggerService } from '@/infrastructure/logging/logger.service';

@Injectable()
export class MetricsRefreshJob {
  constructor(private readonly logger: LoggerService) {}

  @Interval('metrics-refresh', 15 * 60 * 1000)
  async run(): Promise<void> {
    this.logger.debug('Metrics-refresh tick: recompute dashboard aggregates (safety net)');
  }
}
