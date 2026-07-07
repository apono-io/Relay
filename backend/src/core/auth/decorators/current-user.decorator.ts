import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { AuthenticatedUser } from '../models/auth-user.model';

export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthenticatedUser => {
    if (context.getType<'graphql' | 'http'>() === 'graphql') {
      const ctx = GqlExecutionContext.create(context);
      return ctx.getContext().req.user;
    }
    return context.switchToHttp().getRequest().user;
  },
);
