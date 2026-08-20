import { Mutation, Query, Resolver } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { AuthUser, AuthenticatedUser } from './models/auth-user.model';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CurrentUser } from './decorators/current-user.decorator';
import { GithubLinkService } from './github-link.service';
import { getPermissionsForRole } from '@/core/rbac/permissions.constants';
import { RequirePermissions } from '@/core/rbac/require-permissions.decorator';
import { Permissions } from '@/core/rbac/permissions.constants';

@Resolver(() => AuthUser)
export class AuthResolver {
  constructor(private readonly githubLinkService: GithubLinkService) {}

  @Query(() => AuthUser, { name: 'me' })
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() user: AuthenticatedUser): AuthUser {
    return { ...user, permissions: getPermissionsForRole(user.role) };
  }

  @Query(() => Boolean, { name: 'githubLinkAvailable' })
  @UseGuards(JwtAuthGuard)
  githubLinkAvailable(): boolean {
    return this.githubLinkService.isConfigured();
  }

  @Mutation(() => String, { name: 'startGithubLink' })
  @RequirePermissions(Permissions.IDENTITY_LINK)
  startGithubLink(@CurrentUser() user: AuthenticatedUser): string {
    return this.githubLinkService.authorizeUrl(user.id);
  }
}
