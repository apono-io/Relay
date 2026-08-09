import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Suggestion } from './entities/suggestion.entity';
import { AppSetting } from './entities/app-setting.entity';
import { PullRequest } from '@/domains/pull-requests/entities/pull-request.entity';
import { PrEvent } from '@/domains/pull-requests/entities/pr-event.entity';
import { AreaRule } from '@/domains/repos/entities/area-rule.entity';
import { PeopleModule } from '@/domains/people/people.module';
import { CandidateStatsService } from './candidate-stats.service';
import { SuggestionService } from './suggestion.service';
import { AssignmentActionsService } from './assignment-actions.service';
import { AppSettingsService } from './app-settings.service';
import { AssignmentResolver } from './assignment.resolver';

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
  ],
  providers: [
    CandidateStatsService,
    SuggestionService,
    AssignmentActionsService,
    AppSettingsService,
    AssignmentResolver,
  ],
  exports: [SuggestionService, AssignmentActionsService],
})
export class AssignmentModule {}
