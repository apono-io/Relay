import { ObjectType, Field, ID } from '@nestjs/graphql';

@ObjectType('AuthUser')
export class AuthUser {
  @Field(() => ID)
  id: string;

  @Field()
  email: string;

  @Field({ nullable: true })
  name?: string;

  @Field({ nullable: true })
  picture?: string;
}

export type AuthenticatedUser = {
  id: string;
  email: string;
  name?: string;
  picture?: string;
};
