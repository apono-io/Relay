import { Field, GraphQLISODateTime, Int, ObjectType } from '@nestjs/graphql';

@ObjectType('ReviewRound')
export class ReviewRoundModel {
  @Field(() => Int)
  sequence: number;

  @Field()
  outcome: string;

  @Field(() => GraphQLISODateTime)
  at: Date;

  @Field(() => String, { nullable: true })
  actorLogin?: string | null;
}
