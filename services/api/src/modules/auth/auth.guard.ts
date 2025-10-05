import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { UserRole } from '@local-office/db';

import { IS_PUBLIC_KEY, ROLES_KEY } from './auth.constants';
import { AuthService } from './auth.service';
import type { AuthenticatedUser } from './auth.types';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly reflector: Reflector, private readonly auth: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass()
    ]);
    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request & { user?: AuthenticatedUser }>();
    const authorization = request.headers['authorization'] ?? request.headers['Authorization'];

    if (!authorization || typeof authorization !== 'string') {
      throw new UnauthorizedException('Authorization header missing.');
    }

    const match = authorization.match(/^Bearer\s+(.+)$/i);
    if (!match) {
      throw new UnauthorizedException('Authorization header must use the Bearer scheme.');
    }

    const token = match[1].trim();
    if (!token) {
      throw new UnauthorizedException('Bearer token missing.');
    }

    const user = await this.auth.verify(token);

    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass()
    ]) ?? [];

    if (requiredRoles.length > 0 && !requiredRoles.some((role) => user.roles.includes(role))) {
      throw new ForbiddenException('Insufficient permissions for this resource.');
    }

    request.user = user;
    return true;
  }
}
