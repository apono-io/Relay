import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PullRequest } from './entities/pull-request.entity';
import { PrEvent } from './entities/pr-event.entity';
import { PhaseComputer } from './phase-computer.service';
import { PullRequestsService } from './pull-requests.service';
import { PullRequestsResolver } from './pull-requests.resolver';
import { PeopleModule } from '@/domains/people/people.module';
import { PrAreaModule } from '@/domains/repos/pr-area.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([PullRequest, PrEvent]),
    PeopleModule,
    PrAreaModule,
  ],
  providers: [PhaseComputer, PullRequestsService, PullRequestsResolver],
  exports: [PhaseComputer, PullRequestsService, TypeOrmModule],
})
export class PullRequestsModule {}
