import { Args, Query, Resolver } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { PullRequest } from './entities/pull-request.entity';
import { PullRequestsService } from './pull-requests.service';
import { JwtAuthGuard } from '@/core/auth/guards/jwt-auth.guard';

@Resolver(() => PullRequest)
export class PullRequestsResolver {
  constructor(private readonly pullRequestsService: PullRequestsService) {}

  @Query(() => [PullRequest], { name: 'pullRequests' })
  @UseGuards(JwtAuthGuard)
  pullRequests(@Args('repo', { nullable: true }) repo?: string): Promise<PullRequest[]> {
    return this.pullRequestsService.findAll(repo);
  }

  @Query(() => [PullRequest], { name: 'stuckPullRequests' })
  @UseGuards(JwtAuthGuard)
  stuckPullRequests(): Promise<PullRequest[]> {
    return this.pullRequestsService.findStuck();
  }
}
