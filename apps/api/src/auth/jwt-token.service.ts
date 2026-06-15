import { createHmac, timingSafeEqual } from 'node:crypto';

import { Injectable, UnauthorizedException } from '@nestjs/common';

import { getAuthConfig } from './auth.config.js';
import type { AuthenticatedUser, JwtPayload } from './auth.types.js';

interface JwtHeader {
  readonly alg: 'HS256';
  readonly typ: 'JWT';
}

@Injectable()
export class JwtTokenService {
  sign(user: AuthenticatedUser): string {
    const config = getAuthConfig();
    const issuedAt = Math.floor(Date.now() / 1000);
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      name: user.name,
      iat: issuedAt,
      exp: issuedAt + config.jwtExpiresInSeconds
    };
    const header: JwtHeader = { alg: 'HS256', typ: 'JWT' };
    const encodedHeader = encodeJson(header);
    const encodedPayload = encodeJson(payload);
    const signingInput = `${encodedHeader}.${encodedPayload}`;
    const signature = sign(signingInput, config.jwtSecret);

    return `${signingInput}.${signature}`;
  }

  verify(token: string): JwtPayload {
    const config = getAuthConfig();
    const parts = token.split('.');

    if (parts.length !== 3) {
      throw new UnauthorizedException('Invalid authentication token.');
    }

    const [encodedHeader, encodedPayload, signature] = parts as [string, string, string];
    const expectedSignature = sign(`${encodedHeader}.${encodedPayload}`, config.jwtSecret);

    if (!safeEqual(signature, expectedSignature)) {
      throw new UnauthorizedException('Invalid authentication token.');
    }

    const header = decodeJson(encodedHeader) as Partial<JwtHeader>;

    if (header.alg !== 'HS256' || header.typ !== 'JWT') {
      throw new UnauthorizedException('Unsupported authentication token.');
    }

    const payload = decodeJson(encodedPayload) as Partial<JwtPayload>;

    if (
      typeof payload.sub !== 'string' ||
      typeof payload.email !== 'string' ||
      typeof payload.iat !== 'number' ||
      typeof payload.exp !== 'number'
    ) {
      throw new UnauthorizedException('Invalid authentication token payload.');
    }

    if (payload.exp <= Math.floor(Date.now() / 1000)) {
      throw new UnauthorizedException('Authentication token has expired.');
    }

    return {
      sub: payload.sub,
      email: payload.email,
      ...(payload.name === undefined ? {} : { name: payload.name }),
      iat: payload.iat,
      exp: payload.exp
    };
  }
}

function encodeJson(value: unknown): string {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

function decodeJson(value: string): unknown {
  try {
    return JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as unknown;
  } catch {
    throw new UnauthorizedException('Invalid authentication token encoding.');
  }
}

function sign(value: string, secret: string): string {
  return createHmac('sha256', secret).update(value).digest('base64url');
}

function safeEqual(actual: string, expected: string): boolean {
  const actualBuffer = Buffer.from(actual);
  const expectedBuffer = Buffer.from(expected);

  return (
    actualBuffer.byteLength === expectedBuffer.byteLength &&
    timingSafeEqual(actualBuffer, expectedBuffer)
  );
}
