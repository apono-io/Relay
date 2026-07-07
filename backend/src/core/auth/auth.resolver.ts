import { Query, Resolver } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { AuthUser, AuthenticatedUser } from './models/auth-user.model';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CurrentUser } from './decorators/current-user.decorator';

@Resolver(() => AuthUser)
export class AuthResolver {
  @Query(() => AuthUser, { name: 'me' })
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() user: AuthenticatedUser): AuthUser {
    return user;
  }
}
