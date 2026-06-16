import { authTokenProvider, type AuthTokenProvider } from './auth';
import { ApiError, NetworkError } from './errors';

export type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';

export interface ApiRequestOptions extends Omit<RequestInit, 'body' | 'method'> {
  readonly body?: BodyInit | Record<string, unknown>;
  readonly method?: HttpMethod;
}

interface TransportOptions {
  readonly baseUrl?: string;
  readonly fetcher?: typeof fetch;
  readonly tokenProvider?: AuthTokenProvider;
  readonly retryDelayMs?: number;
}

const DEFAULT_RETRY_ATTEMPTS = 2;
const DEFAULT_RETRY_DELAY_MS = 150;
const CSRF_COOKIE_NAME = 'abi_csrf_token';
const CSRF_HEADER_NAME = 'X-CSRF-Token';

export class ApiTransport {
  private readonly baseUrl: string;
  private readonly fetcher: typeof fetch;
  private readonly tokenProvider: AuthTokenProvider;
  private readonly retryDelayMs: number;

  constructor(options: TransportOptions = {}) {
    this.baseUrl = options.baseUrl ?? getApiBaseUrl();
    this.fetcher = options.fetcher ?? globalThis.fetch.bind(globalThis);
    this.tokenProvider = options.tokenProvider ?? authTokenProvider;
    this.retryDelayMs = options.retryDelayMs ?? DEFAULT_RETRY_DELAY_MS;
  }

  async request<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
    const method = options.method ?? 'GET';
    const maxAttempts = method === 'GET' ? DEFAULT_RETRY_ATTEMPTS + 1 : 1;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        return await this.execute<T>(path, method, options);
      } catch (error) {
        if (!shouldRetry(error, method, attempt, maxAttempts)) {
          throw error;
        }

        await delay(this.retryDelayMs * attempt);
      }
    }

    throw new NetworkError('Request failed');
  }

  assetFileUrl(assetId: string): string {
    return `${this.baseUrl}/assets/${encodeURIComponent(assetId)}/file`;
  }

  async requestBlob(path: string, options: ApiRequestOptions = {}): Promise<Blob> {
    const method = options.method ?? 'GET';

    if (method !== 'GET') {
      throw new NetworkError('Blob requests only support safe GET requests');
    }

    const { body: ignoredBody, headers: inputHeaders, ...rest } = options;
    const headers = new Headers(inputHeaders);
    const token = this.tokenProvider.getToken();

    void ignoredBody;

    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }

    try {
      const response = await this.fetcher(`${this.baseUrl}${path}`, {
        ...rest,
        method,
        headers,
        credentials: rest.credentials ?? 'include'
      });

      if (!response.ok) {
        const text = await response.text();
        const payload = text ? parseJson(text) : null;

        throw new ApiError(getErrorMessage(payload, response.statusText), response.status, payload);
      }

      return await response.blob();
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }

      throw new NetworkError('Network request failed', error);
    }
  }

  private async execute<T>(
    path: string,
    method: HttpMethod,
    options: ApiRequestOptions
  ): Promise<T> {
    const { body, headers: inputHeaders, ...rest } = options;
    const headers = new Headers(inputHeaders);
    const token = this.tokenProvider.getToken();

    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }

    if (!isSafeMethod(method) && !headers.has(CSRF_HEADER_NAME)) {
      const csrfToken = getCookieValue(CSRF_COOKIE_NAME);

      if (csrfToken) {
        headers.set(CSRF_HEADER_NAME, csrfToken);
      }
    }

    const requestBody = serializeBody(body, headers);

    let response: Response;

    const init: RequestInit = {
      ...rest,
      method,
      headers,
      credentials: rest.credentials ?? 'include'
    };

    if (requestBody !== undefined) {
      init.body = requestBody;
    }

    try {
      response = await this.fetcher(`${this.baseUrl}${path}`, init);
    } catch (error) {
      throw new NetworkError('Network request failed', error);
    }

    const text = await response.text();
    const payload = text ? parseJson(text) : null;

    if (!response.ok) {
      throw new ApiError(getErrorMessage(payload, response.statusText), response.status, payload);
    }

    return payload as T;
  }
}

function isSafeMethod(method: HttpMethod): boolean {
  return method === 'GET';
}

function getCookieValue(name: string): string | undefined {
  if (typeof globalThis.document === 'undefined') {
    return undefined;
  }

  const prefix = `${name}=`;
  const cookie = globalThis.document.cookie
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(prefix));

  if (!cookie) {
    return undefined;
  }

  try {
    return decodeURIComponent(cookie.slice(prefix.length));
  } catch {
    return undefined;
  }
}

export const apiTransport = new ApiTransport();

function serializeBody(
  body: BodyInit | Record<string, unknown> | undefined,
  headers: Headers
): BodyInit | undefined {
  if (body === undefined) {
    return undefined;
  }

  if (body instanceof FormData) {
    return body;
  }

  if (typeof body === 'string' || body instanceof Blob || body instanceof ArrayBuffer) {
    return body;
  }

  headers.set('Content-Type', 'application/json');
  return JSON.stringify(body);
}

function shouldRetry(
  error: unknown,
  method: HttpMethod,
  attempt: number,
  maxAttempts: number
): boolean {
  if (method !== 'GET' || attempt >= maxAttempts) {
    return false;
  }

  if (error instanceof NetworkError) {
    return true;
  }

  return error instanceof ApiError && error.status >= 500;
}

function parseJson(value: string): unknown {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return value;
  }
}

function getApiBaseUrl(): string {
  const configuredUrl: unknown = import.meta.env.VITE_API_BASE_URL;

  return typeof configuredUrl === 'string' && configuredUrl.length > 0
    ? configuredUrl
    : 'http://localhost:3000';
}

function getErrorMessage(payload: unknown, fallback: string): string {
  if (payload && typeof payload === 'object' && 'message' in payload) {
    const message = (payload as { readonly message?: unknown }).message;

    if (typeof message === 'string') {
      return message;
    }

    if (Array.isArray(message)) {
      return message.filter((item): item is string => typeof item === 'string').join(', ');
    }
  }

  return fallback || 'Request failed';
}

async function delay(ms: number): Promise<void> {
  if (ms <= 0) {
    return;
  }

  await new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}
