import { z } from 'zod';
import { describe, expect, it, vi } from 'vitest';

import {
  AiInvalidJsonError,
  AiProviderNotFoundError,
  AiProviderRegistry,
  AiProviderRequestError,
  AiSchemaValidationError,
  AiTimeoutError,
  MockAiProvider,
  OpenAiTextProvider,
  createAiRequestLogPayload,
  type AiRequestLogger,
  type OpenAiHttpClient
} from './index.js';

class TestLogger implements AiRequestLogger {
  readonly started: unknown[] = [];
  readonly succeeded: unknown[] = [];
  readonly failed: unknown[] = [];

  requestStarted(payload: unknown): void {
    this.started.push(payload);
  }

  requestSucceeded(payload: unknown): void {
    this.succeeded.push(payload);
  }

  requestFailed(payload: unknown): void {
    this.failed.push(payload);
  }
}

describe('AiProviderRegistry', () => {
  it('delegates text and image calls to registered providers', async () => {
    const provider = new MockAiProvider({
      id: 'mock',
      textResponses: ['hello'],
      imageResponses: [{ providerId: 'mock', images: [{ url: 'https://example.test/image.png' }] }]
    });
    const registry = new AiProviderRegistry([provider], [provider]);

    await expect(registry.generateText('mock', { prompt: 'say hello' })).resolves.toMatchObject({
      providerId: 'mock',
      text: 'hello'
    });
    await expect(registry.generateImage('mock', { prompt: 'draw' })).resolves.toMatchObject({
      providerId: 'mock',
      images: [{ url: 'https://example.test/image.png' }]
    });
  });

  it('throws a typed error when provider is missing', () => {
    const registry = new AiProviderRegistry();

    expect(() => registry.getTextProvider('missing')).toThrow(AiProviderNotFoundError);
  });
});

describe('OpenAiTextProvider', () => {
  it('retries retryable provider errors', async () => {
    const httpClient = createHttpClient([
      new AiProviderRequestError('rate limited', { statusCode: 429 }),
      { output_text: 'ok' }
    ]);
    const provider = new OpenAiTextProvider(httpClient, {
      logger: new TestLogger(),
      retryPolicy: {
        maxAttempts: 2,
        initialDelayMs: 0,
        maxDelayMs: 0
      }
    });

    await expect(provider.generateText({ prompt: 'hello' })).resolves.toMatchObject({
      text: 'ok'
    });
    expect(httpClient.postJson).toHaveBeenCalledTimes(2);
  });

  it('times out slow provider calls', async () => {
    const httpClient: OpenAiHttpClient = {
      postJson: vi.fn(<TResponse>() => {
        return new Promise<TResponse>(() => {
            // Intentionally never resolves.
          });
      }) as OpenAiHttpClient['postJson'],
      postForm: vi.fn()
    };
    const provider = new OpenAiTextProvider(httpClient, {
      logger: new TestLogger(),
      timeoutMs: 5,
      retryPolicy: {
        maxAttempts: 1,
        initialDelayMs: 0
      }
    });

    await expect(provider.generateText({ prompt: 'hello' })).rejects.toThrow(AiTimeoutError);
  });

  it('throws a typed error for invalid structured JSON', async () => {
    const httpClient = createHttpClient([{ output_text: 'not json' }]);
    const provider = new OpenAiTextProvider(httpClient, {
      logger: new TestLogger(),
      retryPolicy: {
        maxAttempts: 1,
        initialDelayMs: 0
      }
    });

    await expect(
      provider.extractStructuredData({
        prompt: 'extract',
        schema: z.object({ title: z.string() })
      })
    ).rejects.toThrow(AiInvalidJsonError);
  });

  it('extracts structured JSON from provider responses with surrounding text', async () => {
    const httpClient = createHttpClient([
      { output_text: 'Here is the JSON:\n{"title":"Book"}\nDone.' }
    ]);
    const provider = new OpenAiTextProvider(httpClient, {
      logger: new TestLogger(),
      retryPolicy: {
        maxAttempts: 1,
        initialDelayMs: 0
      }
    });

    await expect(
      provider.extractStructuredData({
        prompt: 'extract',
        schema: z.object({ title: z.string() })
      })
    ).resolves.toEqual({ title: 'Book' });
  });

  it('extracts structured JSON arrays from fenced provider responses', async () => {
    const httpClient = createHttpClient([
      { output_text: '```json\n[{"title":"One"},{"title":"Two"}]\n```' }
    ]);
    const provider = new OpenAiTextProvider(httpClient, {
      logger: new TestLogger(),
      retryPolicy: {
        maxAttempts: 1,
        initialDelayMs: 0
      }
    });

    await expect(
      provider.extractStructuredData({
        prompt: 'extract',
        schema: z.array(z.object({ title: z.string() }))
      })
    ).resolves.toEqual([{ title: 'One' }, { title: 'Two' }]);
  });

  it('validates structured JSON through zod', async () => {
    const httpClient = createHttpClient([{ output_text: '{"title":123}' }]);
    const provider = new OpenAiTextProvider(httpClient, {
      logger: new TestLogger(),
      retryPolicy: {
        maxAttempts: 1,
        initialDelayMs: 0
      }
    });

    await expect(
      provider.extractStructuredData({
        prompt: 'extract',
        schema: z.object({ title: z.string() })
      })
    ).rejects.toThrow(AiSchemaValidationError);
  });

  it('does not include full prompt text in log payload by default', () => {
    const payload = createAiRequestLogPayload({
      providerId: 'openai',
      operation: 'generateText',
      model: 'gpt-test',
      input: 'full book text should not be persisted'
    });

    expect(payload).toMatchObject({
      providerId: 'openai',
      operation: 'generateText',
      inputCharCount: 38
    });
    expect(payload.inputSha256).toHaveLength(64);
    expect('input' in payload).toBe(false);
  });
});

function createHttpClient(responses: readonly unknown[]): OpenAiHttpClient & {
  readonly postJson: OpenAiHttpClient['postJson'] & ReturnType<typeof vi.fn>;
  readonly postForm: ReturnType<typeof vi.fn>;
} {
  let index = 0;
  const postJson = vi.fn(<TResponse>() => {
    const response = responses[index];
    index += 1;

    if (response instanceof Error) {
      return Promise.reject(response);
    }

    return Promise.resolve(response as TResponse);
  }) as OpenAiHttpClient['postJson'] & ReturnType<typeof vi.fn>;

  return {
    postJson,
    postForm: vi.fn()
  };
}
