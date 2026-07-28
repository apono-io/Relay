import { Field, ObjectType } from '@nestjs/graphql';
import { Person } from '../entities/person.entity';

@ObjectType('RosterHealth')
export class RosterHealth {
  @Field(() => [String])
  unmappedLogins: string[];

  @Field(() => [Person])
  unresolvedPeople: Person[];
}
