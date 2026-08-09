import { Injectable, OnModuleInit } from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { LoggerService } from '@/infrastructure/logging/logger.service';
import { numberSetting } from '@/core/config/config-number';
import { SuggestionService } from '@/domains/assignment/suggestion.service';
import { AssignmentActionsService } from '@/domains/assignment/assignment-actions.service';

@Injectable()
export class AssignmentSweepJob implements OnModuleInit {
  constructor(
    private readonly configService: ConfigService,
    private readonly suggestions: SuggestionService,
    private readonly actions: AssignmentActionsService,
    private readonly logger: LoggerService,
    private readonly schedulerRegistry: SchedulerRegistry,
  ) {}

  onModuleInit(): void {
    const minutes = Math.max(
      1,
      numberSetting(this.configService, 'ASSIGNMENT_SWEEP_INTERVAL_MINUTES', 5),
    );
    const handle = setInterval(() => void this.run(), minutes * 60 * 1000);
    this.schedulerRegistry.addInterval('assignment-sweep', handle);
    void this.run();
  }

  async run(): Promise<void> {
    try {
      const summary = await this.suggestions.sweep();
      const autoAssigned = await this.actions.autoAssign();
      this.logger.log(
        `Assignment sweep done: ${JSON.stringify({ ...summary, autoAssigned })}`,
      );
    } catch (error) {
      this.logger.error(
        `Assignment sweep failed: ${(error as Error).message}`,
        (error as Error).stack,
        AssignmentSweepJob.name,
      );
    }
  }
}
