import type { AiGeneratedImage, AiUsage } from './types.js';

export function extractTextFromOpenAiResponse(response: unknown): string {
  if (!isRecord(response)) {
    return '';
  }

  const outputText = response.output_text;

  if (typeof outputText === 'string') {
    return outputText;
  }

  const choices = response.choices;

  if (Array.isArray(choices)) {
    const firstChoice: unknown = choices[0];

    if (isRecord(firstChoice)) {
      const message = firstChoice.message;

      if (!isRecord(message)) {
        return '';
      }

      const content = message.content;

      if (typeof content === 'string') {
        return content;
      }
    }
  }

  const output = response.output;

  if (!Array.isArray(output)) {
    return '';
  }

  return output
    .flatMap((item) => {
      if (!isRecord(item) || !Array.isArray(item.content)) {
        return [];
      }

      return item.content.flatMap((contentItem) => {
        if (!isRecord(contentItem)) {
          return [];
        }

        const text = contentItem.text;

        return typeof text === 'string' ? [text] : [];
      });
    })
    .join('');
}

export function extractUsageFromOpenAiResponse(response: unknown): AiUsage | undefined {
  if (!isRecord(response) || !isRecord(response.usage)) {
    return undefined;
  }

  const inputTokens = readNumber(response.usage.input_tokens ?? response.usage.prompt_tokens);
  const outputTokens = readNumber(response.usage.output_tokens ?? response.usage.completion_tokens);
  const totalTokens = readNumber(response.usage.total_tokens);

  return {
    ...(inputTokens === undefined ? {} : { inputTokens }),
    ...(outputTokens === undefined ? {} : { outputTokens }),
    ...(totalTokens === undefined ? {} : { totalTokens })
  };
}

export function extractImagesFromOpenAiResponse(response: unknown): readonly AiGeneratedImage[] {
  if (!isRecord(response) || !Array.isArray(response.data)) {
    return [];
  }

  return response.data.flatMap((item) => {
    if (!isRecord(item)) {
      return [];
    }

    const b64Json = typeof item.b64_json === 'string' ? item.b64_json : undefined;
    const url = typeof item.url === 'string' ? item.url : undefined;

    if (b64Json === undefined && url === undefined) {
      return [];
    }

    return [
      {
        ...(b64Json === undefined ? {} : { b64Json }),
        ...(url === undefined ? {} : { url }),
        mimeType: 'image/png'
      }
    ];
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function readNumber(value: unknown): number | undefined {
  return typeof value === 'number' ? value : undefined;
}
