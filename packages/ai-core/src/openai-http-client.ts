import { AiProviderRequestError } from './errors.js';

export interface OpenAiHttpClientRequestOptions {
  readonly signal?: AbortSignal;
}

export interface OpenAiHttpClient {
  postJson<TResponse>(
    path: string,
    body: unknown,
    options?: OpenAiHttpClientRequestOptions
  ): Promise<TResponse>;
  postForm<TResponse>(
    path: string,
    body: FormData,
    options?: OpenAiHttpClientRequestOptions
  ): Promise<TResponse>;
}

export interface FetchOpenAiHttpClientOptions {
  readonly apiKey: string;
  readonly baseUrl?: string;
  readonly organization?: string;
  readonly project?: string;
}

export class FetchOpenAiHttpClient implements OpenAiHttpClient {
  private readonly baseUrl: string;

  constructor(private readonly options: FetchOpenAiHttpClientOptions) {
    this.baseUrl = options.baseUrl ?? 'https://api.openai.com';
  }

  async postJson<TResponse>(
    path: string,
    body: unknown,
    options: OpenAiHttpClientRequestOptions = {}
  ): Promise<TResponse> {
    const requestInit: RequestInit = {
      method: 'POST',
      headers: {
        ...this.getHeaders(),
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body),
      ...(options.signal === undefined ? {} : { signal: options.signal })
    };
    const response = await fetch(`${this.baseUrl}${path}`, {
      ...requestInit
    });

    return parseOpenAiResponse<TResponse>(response);
  }

  async postForm<TResponse>(
    path: string,
    body: FormData,
    options: OpenAiHttpClientRequestOptions = {}
  ): Promise<TResponse> {
    const requestInit: RequestInit = {
      method: 'POST',
      headers: this.getHeaders(),
      body,
      ...(options.signal === undefined ? {} : { signal: options.signal })
    };
    const response = await fetch(`${this.baseUrl}${path}`, {
      ...requestInit
    });

    return parseOpenAiResponse<TResponse>(response);
  }

  private getHeaders(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.options.apiKey}`,
      ...(this.options.organization === undefined
        ? {}
        : { 'OpenAI-Organization': this.options.organization }),
      ...(this.options.project === undefined
        ? {}
        : { 'OpenAI-Project': this.options.project })
    };
  }
}

async function parseOpenAiResponse<TResponse>(response: Response): Promise<TResponse> {
  if (!response.ok) {
    throw new AiProviderRequestError('OpenAI request failed.', {
      statusCode: response.status,
      responseBody: await response.text()
    });
  }

  return (await response.json()) as TResponse;
}
