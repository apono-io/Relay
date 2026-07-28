import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Person } from './entities/person.entity';
import { GithubIdentity } from './entities/github-identity.entity';
import { PullRequest } from '@/domains/pull-requests/entities/pull-request.entity';
import { PeopleService } from './people.service';
import { PeopleResolver } from './people.resolver';
import { CommitEmailResolver } from './commit-email-resolver.service';

@Module({
  imports: [TypeOrmModule.forFeature([Person, GithubIdentity, PullRequest])],
  providers: [PeopleService, PeopleResolver, CommitEmailResolver],
  exports: [PeopleService],
})
export class PeopleModule {}
