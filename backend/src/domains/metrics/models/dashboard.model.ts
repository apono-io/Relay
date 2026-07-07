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
}
