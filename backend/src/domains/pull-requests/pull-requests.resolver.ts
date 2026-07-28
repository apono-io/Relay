import { Args, Query, Resolver } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { subDays } from 'date-fns';
import { PullRequest } from './entities/pull-request.entity';
import { PullRequestsService } from './pull-requests.service';
import { MyPullRequests, MyReviews } from './models/personal-prs.model';
import { JwtAuthGuard } from '@/core/auth/guards/jwt-auth.guard';
import { CurrentUser } from '@/core/auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '@/core/auth/models/auth-user.model';
import { PeopleService } from '@/domains/people/people.service';

const MERGED_WINDOW_DAYS = 14;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

@Resolver(() => PullRequest)
export class PullRequestsResolver {
  constructor(
    private readonly pullRequestsService: PullRequestsService,
    private readonly peopleService: PeopleService,
  ) {}

  @Query(() => [PullRequest], { name: 'pullRequests' })
  @UseGuards(JwtAuthGuard)
  pullRequests(
    @Args('repo', { nullable: true }) repo?: string,
  ): Promise<PullRequest[]> {
    return this.pullRequestsService.findAll(repo);
  }

  @Query(() => [PullRequest], { name: 'stuckPullRequests' })
  @UseGuards(JwtAuthGuard)
  stuckPullRequests(): Promise<PullRequest[]> {
    return this.pullRequestsService.findStuck();
  }

  @Query(() => MyPullRequests, { name: 'myPullRequests' })
  @UseGuards(JwtAuthGuard)
  async myPullRequests(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<MyPullRequests> {
    const logins = await this.viewerLogins(user);
    const [open, recentlyMerged] = await Promise.all([
      this.pullRequestsService.findOpenAuthoredBy(logins),
      this.pullRequestsService.findRecentlyMergedBy(
        logins,
        subDays(new Date(), MERGED_WINDOW_DAYS),
      ),
    ]);
    return { logins, open, recentlyMerged };
  }

  @Query(() => MyReviews, { name: 'myReviews' })
  @UseGuards(JwtAuthGuard)
  async myReviews(@CurrentUser() user: AuthenticatedUser): Promise<MyReviews> {
    const logins = await this.viewerLogins(user);
    const waiting = await this.pullRequestsService.findAwaitingReviewBy(logins);
    return { logins, waiting };
  }

  private async viewerLogins(user: AuthenticatedUser): Promise<string[]> {
    const person = UUID_PATTERN.test(user.id)
      ? await this.peopleService.findById(user.id)
      : await this.peopleService.findByEmail(user.email);
    return person?.identities.map((identity) => identity.login) ?? [];
  }
}
