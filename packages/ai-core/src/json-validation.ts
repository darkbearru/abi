import type { ZodType, ZodTypeDef } from 'zod';

import { AiInvalidJsonError, AiSchemaValidationError } from './errors.js';

export function parseAndValidateJson<T>(
  rawText: string,
  schema: ZodType<T, ZodTypeDef, unknown>
): T {
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

  if (fenced?.[1] !== undefined) {
    return fenced[1].trim();
  }

  return extractFirstBalancedJson(trimmed) ?? trimmed;
}

function extractFirstBalancedJson(text: string): string | undefined {
  for (let start = 0; start < text.length; start += 1) {
    const opening = text[start];

    if (opening !== '{' && opening !== '[') {
      continue;
    }

    const candidate = readBalancedJsonCandidate(text, start, opening);

    if (candidate !== undefined) {
      return candidate;
    }
  }

  return undefined;
}

function readBalancedJsonCandidate(
  text: string,
  start: number,
  opening: '{' | '['
): string | undefined {
  const closing = opening === '{' ? '}' : ']';
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = start; index < text.length; index += 1) {
    const char = text[index];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === '\\') {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }

      continue;
    }

    if (char === '"') {
      inString = true;
      continue;
    }

    if (char === opening) {
      depth += 1;
      continue;
    }

    if (char === closing) {
      depth -= 1;

      if (depth === 0) {
        return text.slice(start, index + 1);
      }
    }
  }

  return undefined;
}
