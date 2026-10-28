import { Field, ID, InputType, ObjectType } from '@nestjs/graphql';
import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

@ObjectType('Team')
export class TeamModel {
  @Field(() => ID)
  id: string;

  @Field()
  name: string;

  @Field(() => ID, { nullable: true })
  leadPersonId: string | null;

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

// Every field carries a validator: the global ValidationPipe (whitelist) strips any
// field without one, which would silently drop the update.
@InputType()
export class UpdateTeamInput {
  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  name?: string;

  @Field(() => ID, { nullable: true })
  @IsOptional()
  @IsUUID()
  leadPersonId?: string | null;
}
