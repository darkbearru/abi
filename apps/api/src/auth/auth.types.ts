import type { Request } from 'express';

export interface AuthenticatedUser {
  readonly id: string;
  readonly email: string;
  readonly name: string | null;
}

export interface AuthenticatedRequest extends Request {
  readonly user?: AuthenticatedUser;
}

export interface JwtPayload {
  readonly sub: string;
  readonly email: string;
  readonly name?: string | null;
  readonly iat: number;
  readonly exp: number;
}
