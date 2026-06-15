import type { ZodError } from 'zod';

export class AiProviderNotFoundError extends Error {
  constructor(providerId: string, providerType: 'text' | 'image') {
    super(`AI ${providerType} provider "${providerId}" is not registered.`);
    this.name = 'AiProviderNotFoundError';
  }
}

export class AiProviderRequestError extends Error {
  readonly statusCode: number | undefined;
  readonly responseBody: string | undefined;

  constructor(
    message: string,
    options: { readonly statusCode?: number; readonly responseBody?: string } = {}
  ) {
    super(message);
    this.name = 'AiProviderRequestError';
    this.statusCode = options.statusCode;
    this.responseBody = options.responseBody;
  }
}

export class AiTimeoutError extends Error {
  constructor(timeoutMs: number) {
    super(`AI provider request timed out after ${String(timeoutMs)}ms.`);
    this.name = 'AiTimeoutError';
  }
}

export class AiInvalidJsonError extends Error {
  readonly rawText: string;

  constructor(rawText: string) {
    super('AI provider returned invalid JSON.');
    this.name = 'AiInvalidJsonError';
    this.rawText = rawText;
  }
}

export class AiSchemaValidationError extends Error {
  readonly issues: ZodError['issues'];

  constructor(error: ZodError) {
    super('AI provider JSON did not match the requested schema.');
    this.name = 'AiSchemaValidationError';
    this.issues = error.issues;
  }
}
