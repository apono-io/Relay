import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Person } from './entities/person.entity';
import { GithubIdentity } from './entities/github-identity.entity';
import { PersonSettings } from './entities/person-settings.entity';
import { PullRequest } from '@/domains/pull-requests/entities/pull-request.entity';
import { PeopleService } from './people.service';
import { PeopleResolver } from './people.resolver';
import { PersonSettingsService } from './person-settings.service';
import { PersonSettingsResolver } from './person-settings.resolver';
import { CommitEmailResolver } from './commit-email-resolver.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Person,
      GithubIdentity,
      PersonSettings,
      PullRequest,
    ]),
  ],
  providers: [
    PeopleService,
    PeopleResolver,
    PersonSettingsService,
    PersonSettingsResolver,
    CommitEmailResolver,
  ],
  exports: [PeopleService, PersonSettingsService],
})
export class PeopleModule {}
