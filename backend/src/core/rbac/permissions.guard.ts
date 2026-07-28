import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { GqlExecutionContext } from '@nestjs/graphql';
import { AuthenticatedUser } from '@/core/auth/models/auth-user.model';
import {
  getPermissionsForRole,
  PERMISSIONS_KEY,
} from './permissions.constants';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<string[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!required || required.length === 0) {
      return true;
    }

    const user = this.userFrom(context);
    if (!user) {
      throw new ForbiddenException('Not authenticated');
    }

    const granted = getPermissionsForRole(user.role);
    const missing = required.filter(
      (permission) => !granted.includes(permission),
    );
    if (missing.length > 0) {
      throw new ForbiddenException(`Missing permission: ${missing.join(', ')}`);
    }
    return true;
  }

  private userFrom(context: ExecutionContext): AuthenticatedUser | undefined {
    if (context.getType<'graphql' | 'http'>() === 'graphql') {
      return GqlExecutionContext.create(context).getContext().req?.user;
    }
    return context.switchToHttp().getRequest()?.user;
  }
}
