import { createHash } from 'node:crypto';

import type { ParsedChapter } from '@abi/book-parser';

export interface WorkerBookChunk {
  readonly id: string;
  readonly bookId: string;
  readonly bookAnalysisId: string;
  readonly chapterIndex: number;
  readonly text: string;
  readonly startOffset: number;
  readonly endOffset: number;
  readonly tokenEstimate: number;
  readonly orderIndex: number;
}

const ESTIMATED_CHARS_PER_TOKEN = 4;

export function createWorkerBookChunks(input: {
  readonly bookId: string;
  readonly bookAnalysisId: string;
  readonly normalizedText: string;
  readonly chapters: readonly ParsedChapter[];
  readonly targetTokenCount: number;
  readonly overlapTokenCount: number;
}): readonly WorkerBookChunk[] {
  if (!input.normalizedText.trim()) {
    return [];
  }

  const targetChars = Math.max(1, Math.floor(input.targetTokenCount)) * ESTIMATED_CHARS_PER_TOKEN;
  const overlapChars =
    Math.max(0, Math.min(Math.floor(input.overlapTokenCount), input.targetTokenCount - 1)) *
    ESTIMATED_CHARS_PER_TOKEN;
  const chapters = normalizeChapters(input.normalizedText, input.chapters);
  const chunks: WorkerBookChunk[] = [];

  for (const chapter of chapters) {
    appendChapterChunks(input.bookId, input.bookAnalysisId, chapter, targetChars, overlapChars, chunks);
  }

  return chunks;
}

function normalizeChapters(
  normalizedText: string,
  chapters: readonly ParsedChapter[]
): readonly ParsedChapter[] {
  if (chapters.length === 0) {
    return [
      {
        index: 0,
        text: normalizedText,
        startOffset: 0,
        endOffset: normalizedText.length
      }
    ];
  }

  return chapters
    .filter((chapter) => chapter.endOffset > chapter.startOffset)
    .map((chapter) => ({
      ...chapter,
      text: normalizedText.slice(chapter.startOffset, chapter.endOffset)
    }))
    .sort((left, right) => left.startOffset - right.startOffset);
}

function appendChapterChunks(
  bookId: string,
  bookAnalysisId: string,
  chapter: ParsedChapter,
  targetChars: number,
  overlapChars: number,
  chunks: WorkerBookChunk[]
): void {
  let localStart = 0;

  while (localStart < chapter.text.length) {
    const hardEnd = Math.min(localStart + targetChars, chapter.text.length);
    const localEnd = findChunkEnd(chapter.text, localStart, hardEnd, targetChars);
    const trimmed = trimRange(chapter.text, localStart, localEnd);

    if (trimmed.text) {
      const startOffset = chapter.startOffset + trimmed.start;
      const endOffset = chapter.startOffset + trimmed.end;
      const orderIndex = chunks.length;

      chunks.push({
        id: createStableChunkId(bookId, orderIndex, startOffset, endOffset, trimmed.text),
        bookId,
        bookAnalysisId,
        chapterIndex: chapter.index,
        text: trimmed.text,
        startOffset,
        endOffset,
        tokenEstimate: Math.max(1, Math.ceil(trimmed.text.length / ESTIMATED_CHARS_PER_TOKEN)),
        orderIndex
      });
    }

    if (localEnd >= chapter.text.length) {
      break;
    }

    localStart = Math.max(localStart + 1, localEnd - overlapChars);
  }
}

function findChunkEnd(text: string, start: number, hardEnd: number, targetChars: number): number {
  if (hardEnd >= text.length) {
    return text.length;
  }

  const paragraphEnd = text.lastIndexOf('\n\n', hardEnd);

  if (paragraphEnd > start + Math.floor(targetChars * 0.5)) {
    return paragraphEnd;
  }

  const whitespaceEnd = findLastWhitespace(text, start, hardEnd);

  if (whitespaceEnd > start + Math.floor(targetChars * 0.75)) {
    return whitespaceEnd;
  }

  return hardEnd;
}

function findLastWhitespace(text: string, start: number, end: number): number {
  for (let index = end; index > start; index -= 1) {
    if (/\s/.test(text.charAt(index - 1))) {
      return index - 1;
    }
  }

  return -1;
}

function trimRange(text: string, start: number, end: number): {
  readonly start: number;
  readonly end: number;
  readonly text: string;
} {
  let trimmedStart = start;
  let trimmedEnd = end;

  while (trimmedStart < trimmedEnd && /\s/.test(text.charAt(trimmedStart))) {
    trimmedStart += 1;
  }

  while (trimmedEnd > trimmedStart && /\s/.test(text.charAt(trimmedEnd - 1))) {
    trimmedEnd -= 1;
  }

  return {
    start: trimmedStart,
    end: trimmedEnd,
    text: text.slice(trimmedStart, trimmedEnd)
  };
}

function createStableChunkId(
  bookId: string,
  orderIndex: number,
  startOffset: number,
  endOffset: number,
  text: string
): string {
  const hash = createHash('sha256')
    .update(bookId)
    .update(String(orderIndex))
    .update(String(startOffset))
    .update(String(endOffset))
    .update(text)
    .digest('hex')
    .slice(0, 32);

  return [
    hash.slice(0, 8),
    hash.slice(8, 12),
    hash.slice(12, 16),
    hash.slice(16, 20),
    hash.slice(20, 32)
  ].join('-');
}
