import { ObjectType, Field, Int, GraphQLISODateTime } from '@nestjs/graphql';
import { PickSignals } from './assignment-comparison.model';

@ObjectType()
export class RelayAssignment {
  @Field()
  repo: string;

  @Field(() => Int)
  number: number;

  @Field()
  login: string;

  @Field()
  displayName: string;

  @Field()
  shadow: boolean;

  @Field()
  trigger: string;

  @Field(() => GraphQLISODateTime)
  assignedAt: Date;

  @Field(() => String, { nullable: true })
  area?: string | null;

  @Field(() => String, { nullable: true })
  reason?: string | null;

  @Field(() => PickSignals, { nullable: true })
  signals?: PickSignals | null;
}

@ObjectType()
export class AssignmentSettings {
  @Field()
  actuallyAssign: boolean;
}
