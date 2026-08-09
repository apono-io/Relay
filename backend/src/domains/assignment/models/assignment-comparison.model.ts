import {
  ObjectType,
  Field,
  ID,
  Int,
  Float,
  GraphQLISODateTime,
} from '@nestjs/graphql';

@ObjectType()
export class PickSignals {
  @Field(() => Int, { nullable: true })
  areaRank?: number | null;

  @Field(() => Int)
  areaPool: number;

  @Field(() => Int)
  openReviewRequests: number;

  @Field(() => Int)
  reviewsLast14Days: number;
}

@ObjectType()
export class SuggestionOutcomeRow {
  @Field(() => ID)
  id: string;

  @Field()
  repo: string;

  @Field(() => Int)
  prNumber: number;

  @Field()
  prTitle: string;

  @Field()
  prUrl: string;

  @Field(() => String, { nullable: true })
  area?: string | null;

  @Field()
  suggestedName: string;

  @Field()
  suggestedLogin: string;

  @Field()
  reason: string;

  @Field(() => PickSignals, { nullable: true })
  signals?: PickSignals | null;

  @Field(() => [String])
  actualNames: string[];

  @Field(() => Boolean, { nullable: true })
  matched?: boolean | null;

  @Field(() => GraphQLISODateTime)
  generatedAt: Date;

  @Field(() => GraphQLISODateTime, { nullable: true })
  resolvedAt?: Date | null;
}

@ObjectType()
export class AssignmentComparison {
  @Field(() => Int)
  recorded: number;

  @Field(() => Int)
  awaiting: number;

  @Field(() => Int)
  decided: number;

  @Field(() => Int)
  agreements: number;

  @Field(() => Float, { nullable: true })
  agreementRate?: number | null;

  @Field(() => [SuggestionOutcomeRow])
  rows: SuggestionOutcomeRow[];
}
