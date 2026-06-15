import { describe, expect, it, vi } from 'vitest';

import type { AuthTokenProvider } from './auth';
import type { ApiError } from './errors';
import { NetworkError } from './errors';
import { ApiTransport } from './transport';

describe('ApiTransport', () => {
  it('adds placeholder auth token when provider returns one', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({ ok: true }));
    const tokenProvider: AuthTokenProvider = {
      getToken: () => 'test-token'
    };
    const transport = new ApiTransport({
      baseUrl: 'http://api.test',
      fetcher,
      tokenProvider,
      retryDelayMs: 0
    });

    await transport.request('/projects');

    const headers = getRequestHeaders(fetcher);
    expect(headers.get('Authorization')).toBe('Bearer test-token');
  });

  it('throws centralized ApiError for unsuccessful responses', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(jsonResponse({ message: ['Invalid input'] }, 400, 'Bad Request'));
    const transport = new ApiTransport({ baseUrl: 'http://api.test', fetcher, retryDelayMs: 0 });

    await expect(transport.request('/books/upload', { method: 'POST' })).rejects.toMatchObject({
      name: 'ApiError',
      status: 400,
      message: 'Invalid input'
    } satisfies Partial<ApiError>);
  });

  it('retries safe GET requests on transient failures', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockRejectedValueOnce(new TypeError('offline'))
      .mockResolvedValue(jsonResponse({ projects: [] }));
    const transport = new ApiTransport({ baseUrl: 'http://api.test', fetcher, retryDelayMs: 0 });

    await expect(transport.request('/projects')).resolves.toEqual({ projects: [] });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('does not retry unsafe POST requests', async () => {
    const fetcher = vi.fn<typeof fetch>().mockRejectedValue(new TypeError('offline'));
    const transport = new ApiTransport({ baseUrl: 'http://api.test', fetcher, retryDelayMs: 0 });

    await expect(transport.request('/books/upload', { method: 'POST' })).rejects.toBeInstanceOf(
      NetworkError
    );
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('serializes JSON bodies for non-FormData requests', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({ id: 'scene-1' }));
    const transport = new ApiTransport({ baseUrl: 'http://api.test', fetcher, retryDelayMs: 0 });

    await transport.request('/projects/project-1/scenes/generate', {
      method: 'POST',
      body: { text: 'Scene', styleId: 'style-1' }
    });

    const [, init] = fetcher.mock.calls[0] ?? [];
    expect(init?.body).toBe('{"text":"Scene","styleId":"style-1"}');
    expect(getRequestHeaders(fetcher).get('Content-Type')).toBe('application/json');
  });
});

function jsonResponse(payload: unknown, status = 200, statusText = 'OK'): Response {
  return new Response(JSON.stringify(payload), {
    status,
    statusText,
    headers: { 'Content-Type': 'application/json' }
  });
}

function getRequestHeaders(fetcher: ReturnType<typeof vi.fn<typeof fetch>>): Headers {
  const [, init] = fetcher.mock.calls[0] ?? [];
  return new Headers(init?.headers);
}
