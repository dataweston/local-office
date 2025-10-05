import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';
import type { UserRole } from '@local-office/db';

import { IS_PUBLIC_KEY, ROLES_KEY } from './auth.constants';
import type { AuthenticatedUser } from './auth.types';

export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);

export const CurrentUser = createParamDecorator((data: unknown, ctx: ExecutionContext): AuthenticatedUser | undefined => {
  const request = ctx.switchToHttp().getRequest();
  return request.user as AuthenticatedUser | undefined;
});
