import { detectChapters } from './chapter-detector.js';
import { normalizeBookText } from './text-normalizer.js';
import type { BookParserMetadata, ParsedBookText } from './types.js';

export function createParsedBookText(
  rawText: string,
  metadata: BookParserMetadata = {}
): ParsedBookText {
  const normalizedText = normalizeBookText(rawText);
  const chapters = detectChapters(normalizedText);

  return {
    rawText,
    normalizedText,
    chapters,
    metadata
  };
}
