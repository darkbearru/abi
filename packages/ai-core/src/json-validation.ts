import type { ZodType } from 'zod';

import { AiInvalidJsonError, AiSchemaValidationError } from './errors.js';

export function parseAndValidateJson<T>(rawText: string, schema: ZodType<T>): T {
  const jsonText = unwrapJsonText(rawText);
  let parsed: unknown;

  try {
    parsed = JSON.parse(jsonText);
  } catch {
    throw new AiInvalidJsonError(rawText);
  }

  const result = schema.safeParse(parsed);

  if (!result.success) {
    throw new AiSchemaValidationError(result.error);
  }

  return result.data;
}

function unwrapJsonText(rawText: string): string {
  const trimmed = rawText.trim();
  const fenced = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(trimmed);

  return fenced?.[1]?.trim() ?? trimmed;
}
