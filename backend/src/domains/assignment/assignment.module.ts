import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Suggestion } from './entities/suggestion.entity';
import { AppSetting } from './entities/app-setting.entity';
import { PullRequest } from '@/domains/pull-requests/entities/pull-request.entity';
import { PrEvent } from '@/domains/pull-requests/entities/pr-event.entity';
import { AreaRule } from '@/domains/repos/entities/area-rule.entity';
import { PeopleModule } from '@/domains/people/people.module';
import { TeamsModule } from '@/domains/teams/teams.module';
import { CandidateStatsService } from './candidate-stats.service';
import { SuggestionService } from './suggestion.service';
import { AssignmentActionsService } from './assignment-actions.service';
import { AppSettingsService } from './app-settings.service';
import { AssignmentPerformanceService } from './assignment-performance.service';
import { AssignmentResolver } from './assignment.resolver';
import { RelayCommandService } from './relay-command.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Suggestion,
      AppSetting,
      PullRequest,
      PrEvent,
      AreaRule,
    ]),
    PeopleModule,
    TeamsModule,
  ],
  providers: [
    CandidateStatsService,
    SuggestionService,
    AssignmentActionsService,
    AppSettingsService,
    AssignmentPerformanceService,
    AssignmentResolver,
    RelayCommandService,
  ],
  exports: [SuggestionService, AssignmentActionsService, RelayCommandService],
})
export class AssignmentModule {}
