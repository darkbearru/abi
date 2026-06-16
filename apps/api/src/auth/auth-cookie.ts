import type { Response } from 'express';
import { randomBytes } from 'node:crypto';

export const AUTH_COOKIE_NAME = 'abi_access_token';
export const CSRF_COOKIE_NAME = 'abi_csrf_token';
export const CSRF_HEADER_NAME = 'x-csrf-token';

const COOKIE_MAX_AGE_FALLBACK_SECONDS = 60 * 60 * 24 * 7;

export function createCsrfToken(): string {
  return randomBytes(32).toString('base64url');
}

export function setAuthCookie(
  response: Response,
  token: string,
  maxAgeSeconds = COOKIE_MAX_AGE_FALLBACK_SECONDS
): void {
  response.setHeader(
    'Set-Cookie',
    serializeCookie(AUTH_COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'Lax',
      path: '/',
      maxAge: maxAgeSeconds
    })
  );
}

export function setCsrfCookie(
  response: Response,
  token: string,
  maxAgeSeconds = COOKIE_MAX_AGE_FALLBACK_SECONDS
): void {
  appendSetCookieHeader(
    response,
    serializeCookie(CSRF_COOKIE_NAME, token, {
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'Lax',
      path: '/',
      maxAge: maxAgeSeconds
    })
  );
}

export function setAuthCookies(
  response: Response,
  input: {
    readonly accessToken: string;
    readonly csrfToken: string;
    readonly maxAgeSeconds: number;
  }
): void {
  setAuthCookie(response, input.accessToken, input.maxAgeSeconds);
  setCsrfCookie(response, input.csrfToken, input.maxAgeSeconds);
}

export function clearAuthCookie(response: Response): void {
  response.setHeader(
    'Set-Cookie',
    serializeCookie(AUTH_COOKIE_NAME, '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'Lax',
      path: '/',
      maxAge: 0
    })
  );
  appendSetCookieHeader(
    response,
    serializeCookie(CSRF_COOKIE_NAME, '', {
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'Lax',
      path: '/',
      maxAge: 0
    })
  );
}

export function parseCookie(header: string | undefined, name: string): string | undefined {
  if (!header) {
    return undefined;
  }

  for (const part of header.split(';')) {
    const [rawKey, ...rawValue] = part.trim().split('=');

    if (rawKey === name) {
      try {
        return decodeURIComponent(rawValue.join('='));
      } catch {
        return undefined;
      }
    }
  }

  return undefined;
}

function appendSetCookieHeader(response: Response, cookie: string): void {
  const current = response.getHeader('Set-Cookie');

  if (Array.isArray(current)) {
    response.setHeader('Set-Cookie', [...current, cookie]);
    return;
  }

  if (typeof current === 'string') {
    response.setHeader('Set-Cookie', [current, cookie]);
    return;
  }

  response.setHeader('Set-Cookie', cookie);
}

function serializeCookie(
  name: string,
  value: string,
  options: {
    readonly httpOnly: boolean;
    readonly secure: boolean;
    readonly sameSite: 'Lax' | 'Strict' | 'None';
    readonly path: string;
    readonly maxAge: number;
  }
): string {
  return [
    `${name}=${encodeURIComponent(value)}`,
    `Max-Age=${String(options.maxAge)}`,
    `Path=${options.path}`,
    `SameSite=${options.sameSite}`,
    options.httpOnly ? 'HttpOnly' : undefined,
    options.secure ? 'Secure' : undefined
  ]
    .filter((part): part is string => part !== undefined)
    .join('; ');
}
