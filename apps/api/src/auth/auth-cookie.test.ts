import { describe, expect, it } from 'vitest';
import type { Response } from 'express';

import {
  AUTH_COOKIE_NAME,
  CSRF_COOKIE_NAME,
  clearAuthCookie,
  parseCookie,
  setAuthCookie,
  setAuthCookies
} from './auth-cookie.js';

describe('auth cookie helpers', () => {
  it('sets an HttpOnly SameSite cookie', () => {
    const response = createResponse();

    setAuthCookie(response, 'jwt-token', 60);

    expect(response.headers['Set-Cookie']).toContain(`${AUTH_COOKIE_NAME}=jwt-token`);
    expect(response.headers['Set-Cookie']).toContain('HttpOnly');
    expect(response.headers['Set-Cookie']).toContain('SameSite=Lax');
    expect(response.headers['Set-Cookie']).toContain('Max-Age=60');
  });

  it('clears the auth cookie', () => {
    const response = createResponse();

    clearAuthCookie(response);

    const cookies = asCookieArray(response.headers['Set-Cookie']);

    expect(cookies.some((cookie) => cookie.includes(`${AUTH_COOKIE_NAME}=`))).toBe(true);
    expect(cookies.some((cookie) => cookie.includes(`${CSRF_COOKIE_NAME}=`))).toBe(true);
    expect(cookies.every((cookie) => cookie.includes('Max-Age=0'))).toBe(true);
  });

  it('sets auth and csrf cookies together', () => {
    const response = createResponse();

    setAuthCookies(response, {
      accessToken: 'jwt-token',
      csrfToken: 'csrf-token',
      maxAgeSeconds: 60
    });

    const cookies = asCookieArray(response.headers['Set-Cookie']);

    expect(cookies.some((cookie) => cookie.includes(`${AUTH_COOKIE_NAME}=jwt-token`))).toBe(true);
    expect(cookies.some((cookie) => cookie.includes(`${CSRF_COOKIE_NAME}=csrf-token`))).toBe(true);
    expect(
      cookies.find((cookie) => cookie.includes(`${CSRF_COOKIE_NAME}=csrf-token`))
    ).not.toContain('HttpOnly');
  });

  it('parses cookie values by name', () => {
    expect(parseCookie('other=1; abi_access_token=jwt%20token', AUTH_COOKIE_NAME)).toBe(
      'jwt token'
    );
  });

  it('ignores malformed encoded cookie values', () => {
    expect(parseCookie('abi_access_token=%E0%A4%A', AUTH_COOKIE_NAME)).toBeUndefined();
  });
});

function createResponse(): {
  readonly headers: Record<string, string | readonly string[]>;
  readonly getHeader: (name: string) => string | readonly string[] | undefined;
  readonly setHeader: (name: string, value: string | readonly string[]) => void;
} & Response {
  const headers: Record<string, string | readonly string[]> = {};

  return {
    headers,
    getHeader: (name: string) => headers[name],
    setHeader: (name: string, value: string | readonly string[]) => {
      headers[name] = value;
    }
  } as {
    readonly headers: Record<string, string | readonly string[]>;
    readonly getHeader: (name: string) => string | readonly string[] | undefined;
    readonly setHeader: (name: string, value: string | readonly string[]) => void;
  } & Response;
}

function asCookieArray(value: string | readonly string[] | undefined): readonly string[] {
  return typeof value === 'string' ? [value] : value ?? [];
}
