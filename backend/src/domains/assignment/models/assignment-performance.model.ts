import { ObjectType, Field, Int, Float } from '@nestjs/graphql';

@ObjectType()
export class AssignmentWeekPoint {
  @Field()
  week: string;

  @Field()
  weekStart: string;

  @Field(() => Int)
  recorded: number;

  @Field(() => Int)
  decided: number;

  @Field(() => Int)
  agreements: number;

  @Field(() => Int)
  assigned: number;

  @Field(() => Float, { nullable: true })
  agreementRate?: number | null;
}

@ObjectType()
export class AssignmentAreaPoint {
  @Field()
  area: string;

  @Field(() => Int)
  recorded: number;

  @Field(() => Int)
  decided: number;

  @Field(() => Int)
  agreements: number;

  @Field(() => Float, { nullable: true })
  agreementRate?: number | null;
}

@ObjectType()
export class AssignmentSpreadPoint {
  @Field()
  displayName: string;

  @Field(() => Int)
  picks: number;
}

@ObjectType()
export class AssignmentTotals {
  @Field(() => Int)
  recorded: number;

  @Field(() => Int)
  decided: number;

  @Field(() => Int)
  agreements: number;

  @Field(() => Int)
  awaiting: number;

  @Field(() => Int)
  assigned: number;

  @Field(() => Int)
  autoAssigned: number;

  @Field(() => Int)
  manualAssigned: number;

  @Field(() => Int)
  liveAssigned: number;

  @Field(() => Int)
  peoplePicked: number;

  @Field(() => Float, { nullable: true })
  agreementRate?: number | null;

  @Field(() => Float, { nullable: true })
  coverageRate?: number | null;

  @Field(() => Float, { nullable: true })
  medianDecisionSeconds?: number | null;
}

@ObjectType()
export class AssignmentPerformance {
  @Field(() => AssignmentTotals)
  totals: AssignmentTotals;

  @Field(() => [AssignmentWeekPoint])
  weekly: AssignmentWeekPoint[];

  @Field(() => [AssignmentAreaPoint])
  byArea: AssignmentAreaPoint[];

  @Field(() => [AssignmentSpreadPoint])
  spread: AssignmentSpreadPoint[];
}
