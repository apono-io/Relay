import { Field, ObjectType } from '@nestjs/graphql';
import { PullRequest } from '../entities/pull-request.entity';

@ObjectType('MyPullRequests')
export class MyPullRequests {
  @Field(() => [String])
  logins: string[];

  @Field(() => [PullRequest])
  open: PullRequest[];

  @Field(() => [PullRequest])
  recentlyMerged: PullRequest[];
}

@ObjectType('MyReviews')
export class MyReviews {
  @Field(() => [String])
  logins: string[];

  @Field(() => [PullRequest])
  waiting: PullRequest[];
}
