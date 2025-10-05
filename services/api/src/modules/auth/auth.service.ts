import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { jwtVerify, type JWTPayload } from 'jose';
import { UserRole } from '@local-office/db';

import type { AuthenticatedUser } from './auth.types';

const ROLE_KEYS = ['roles', 'role', 'scope', 'permissions'];
const textEncoder = new TextEncoder();

function normalizeRoles(payload: JWTPayload): UserRole[] {
  const candidateValues: Array<string | string[]> = [];

  for (const [key, value] of Object.entries(payload)) {
    if (ROLE_KEYS.includes(key) || key.endsWith('/roles') || key.endsWith(':roles')) {
      candidateValues.push(value as any);
    }
  }

  const flattened = candidateValues.flatMap((value) => {
    if (Array.isArray(value)) {
      return value;
    }

    if (typeof value === 'string') {
      return value.split(/[\s,]+/);
    }

    return [];
  });

  const unique = new Set<string>();
  for (const entry of flattened) {
    if (typeof entry !== 'string') continue;
    const trimmed = entry.trim();
    if (!trimmed) continue;
    unique.add(trimmed.toUpperCase());
  }

  const allowed = new Set<string>(Object.values(UserRole));
  const roles: UserRole[] = [];

  for (const value of unique) {
    if (allowed.has(value)) {
      roles.push(value as UserRole);
    }
  }

  return roles;
}

@Injectable()
export class AuthService {
  private readonly secret: Uint8Array;
  private readonly audience?: string;
  private readonly issuer?: string;

  constructor(private readonly config: ConfigService) {
    const secret = this.config.get<string>('AUTH_JWT_SECRET');
    if (!secret) {
      throw new Error('AUTH_JWT_SECRET is required for Local Office API authentication.');
    }

    this.secret = textEncoder.encode(secret);
    this.audience = this.config.get<string>('AUTH_JWT_AUDIENCE') ?? undefined;
    this.issuer = this.config.get<string>('AUTH_JWT_ISSUER') ?? undefined;
  }

  async verify(token: string): Promise<AuthenticatedUser> {
    try {
      const { payload } = await jwtVerify(token, this.secret, {
        algorithms: ['HS256'],
        audience: this.audience,
        issuer: this.issuer
      });

      if (!payload.sub || typeof payload.sub !== 'string') {
        throw new UnauthorizedException('Token subject missing.');
      }

      const roles = normalizeRoles(payload);
      if (roles.length === 0) {
        throw new UnauthorizedException('Token missing authorized roles.');
      }

      const email = typeof payload.email === 'string' ? payload.email : null;
      const issuedAt = typeof payload.iat === 'number' ? new Date(payload.iat * 1000) : null;

      return {
        id: payload.sub,
        email,
        roles,
        issuedAt
      };
    } catch (error) {
      throw new UnauthorizedException('Invalid or expired token.');
    }
  }
}
