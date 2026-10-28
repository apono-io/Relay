import { Field, ID, InputType, Int, ObjectType } from '@nestjs/graphql';

@ObjectType('Team')
export class TeamModel {
  @Field(() => ID)
  id: string;

  @Field()
  name: string;

  @Field(() => ID, { nullable: true })
  leadPersonId: string | null;

  @Field(() => Int)
  leadThreshold: number;

  @Field(() => [ID])
  memberIds: string[];
}

@ObjectType()
export class TeamMembersResult {
  @Field(() => TeamModel)
  team: TeamModel;

  @Field(() => [ID])
  movedPersonIds: string[];
}

@InputType()
export class UpdateTeamInput {
  @Field({ nullable: true })
  name?: string;

  @Field(() => ID, { nullable: true })
  leadPersonId?: string | null;

  @Field(() => Int, { nullable: true })
  leadThreshold?: number;
}
