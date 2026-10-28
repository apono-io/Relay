import { Field, Int, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class PeopleSyncResult {
  @Field(() => Int)
  peopleCreated: number;

  @Field(() => Int)
  identitiesLinked: number;

  // GitHub logins whose commits never carried a work address; they still need Add person.
  @Field(() => [String])
  stillNeedEmail: string[];
}
