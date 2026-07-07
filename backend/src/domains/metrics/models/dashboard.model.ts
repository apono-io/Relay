import { ObjectType, Field, Float, Int } from '@nestjs/graphql';

@ObjectType('WaitMetric')
export class WaitMetric {
  @Field()
  label: string;

  @Field(() => Float, { nullable: true })
  medianSeconds?: number;

  @Field(() => Float, { nullable: true })
  p90Seconds?: number;

  @Field(() => Int)
  sampleSize: number;
}

@ObjectType('QualityGuardrail')
export class QualityGuardrail {
  @Field(() => Float)
  approvedWithZeroCommentsRate: number;

  @Field(() => Float)
  revertRate: number;
}

@ObjectType('WeeklyPhasePoint')
export class WeeklyPhasePoint {
  @Field()
  week: string;

  @Field(() => Float, { nullable: true })
  codingSeconds?: number;

  @Field(() => Float, { nullable: true })
  pickupSeconds?: number;

  @Field(() => Float, { nullable: true })
  reworkSeconds?: number;

  @Field(() => Float, { nullable: true })
  mergeSeconds?: number;

  @Field(() => Int)
  prCount: number;
}

@ObjectType('StuckPr')
export class StuckPr {
  @Field()
  repo: string;

  @Field(() => Int)
  number: number;

  @Field()
  title: string;

  @Field()
  url: string;

  @Field()
  authorLogin: string;

  @Field()
  waitingOn: string;

  @Field(() => Float)
  waitingSeconds: number;

  @Field(() => [String])
  requestedReviewers: string[];

  @Field()
  slaBreached: boolean;
}

@ObjectType('ReviewerLoad')
export class ReviewerLoad {
  @Field()
  login: string;

  @Field(() => Int)
  reviewCount: number;
}

@ObjectType('WeeklyQualityPoint')
export class WeeklyQualityPoint {
  @Field()
  week: string;

  @Field(() => Float)
  approvedWithZeroCommentsRate: number;

  @Field(() => Float)
  revertRate: number;

  @Field(() => Int)
  prCount: number;
}

@ObjectType('DashboardSummary')
export class DashboardSummary {
  @Field(() => [WaitMetric])
  reviewerWaitByRound: WaitMetric[];

  @Field(() => [WaitMetric])
  authorWaitByRound: WaitMetric[];

  @Field(() => WaitMetric)
  cycleTime: WaitMetric;

  @Field(() => Int)
  prCount: number;

  @Field(() => Int)
  slaMisses: number;

  @Field(() => QualityGuardrail)
  quality: QualityGuardrail;

  @Field(() => [WeeklyPhasePoint])
  weeklyPhases: WeeklyPhasePoint[];

  @Field(() => [StuckPr])
  stuckNow: StuckPr[];

  @Field(() => [ReviewerLoad])
  fairness: ReviewerLoad[];

  @Field(() => [WeeklyQualityPoint])
  qualityTrend: WeeklyQualityPoint[];
}
