import { ObjectType, Field, Int, Float } from '@nestjs/graphql';

@ObjectType()
export class AssignmentWeekPoint {
  @Field()
  week: string;

  @Field()
  weekStart: string;

  @Field(() => Int)
  requested: number;

  @Field(() => Float, { nullable: true })
  medianFirstReviewSeconds?: number | null;
}

// Counts only the reviews Relay requested on GitHub, while Actually assign was on.
@ObjectType()
export class AssignmentPerformance {
  @Field(() => Int)
  requested: number;

  @Field(() => Int)
  reviewed: number;

  @Field(() => Int)
  reviewedByPick: number;

  @Field(() => Float, { nullable: true })
  pickReviewedRate?: number | null;

  @Field(() => Float, { nullable: true })
  medianFirstReviewSeconds?: number | null;

  @Field(() => [AssignmentWeekPoint])
  weekly: AssignmentWeekPoint[];
}
