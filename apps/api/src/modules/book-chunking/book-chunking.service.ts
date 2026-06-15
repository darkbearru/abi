import { createHash } from 'node:crypto';

import { Inject, Injectable, Optional } from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service.js';
import { VectorIndexService } from '../vector-search/vector-index.service.js';
import {
  BOOK_CHUNKING_CONFIG,
  type BookChunkingConfig,
  getBookChunkingConfig
} from './book-chunking.config.js';
import type {
  BookChunkItem,
  BookChunkSourceChapter,
  CreateBookChunksInput
} from './book-chunking.types.js';

const ESTIMATED_CHARS_PER_TOKEN = 4;

@Injectable()
export class BookChunkingService {
  private readonly config: BookChunkingConfig;

  public constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
    @Optional()
    @Inject(BOOK_CHUNKING_CONFIG)
    config?: BookChunkingConfig,
    @Optional()
    @Inject(VectorIndexService)
    private readonly vectorIndex?: VectorIndexService
  ) {
    this.config = normalizeConfig(config ?? getBookChunkingConfig());
  }

  public createChunks(input: CreateBookChunksInput): readonly BookChunkItem[] {
    if (!input.normalizedText.trim()) {
      return [];
    }

    const chunkState = {
      orderIndex: 0,
      chunks: [] as BookChunkItem[]
    };
    const chapters = this.getSourceChapters(input.normalizedText, input.chapters);

    for (const chapter of chapters) {
      this.appendChapterChunks(input, chapter, chunkState);
    }

    return chunkState.chunks;
  }

  public async chunkAndSave(
    input: CreateBookChunksInput
  ): Promise<readonly BookChunkItem[]> {
    const chunks = this.createChunks(input);

    await this.prisma.$transaction(async (tx) => {
      await tx.bookChunk.deleteMany({
        where: {
          bookId: input.bookId
        }
      });

      if (chunks.length === 0) {
        return;
      }

      await tx.bookChunk.createMany({
        data: chunks.map((chunk) => ({
          id: chunk.id,
          bookId: chunk.bookId,
          ...(chunk.bookAnalysisId === undefined
            ? {}
            : { bookAnalysisId: chunk.bookAnalysisId }),
          chapterIndex: chunk.chapterIndex,
          text: chunk.text,
          startOffset: chunk.startOffset,
          endOffset: chunk.endOffset,
          tokenEstimate: chunk.tokenEstimate,
          orderIndex: chunk.orderIndex
        }))
      });
    });

    if (chunks.length > 0) {
      await this.vectorIndex?.indexBookChunks(chunks);
    }

    return chunks;
  }

  private getSourceChapters(
    normalizedText: string,
    chapters: readonly BookChunkSourceChapter[] | undefined
  ): readonly BookChunkSourceChapter[] {
    if (!chapters || chapters.length === 0) {
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

  private appendChapterChunks(
    input: CreateBookChunksInput,
    chapter: BookChunkSourceChapter,
    state: { orderIndex: number; chunks: BookChunkItem[] }
  ): void {
    const maxChars = this.config.targetTokenCount * ESTIMATED_CHARS_PER_TOKEN;
    const overlapChars = this.config.overlapTokenCount * ESTIMATED_CHARS_PER_TOKEN;
    let localStart = 0;

    while (localStart < chapter.text.length) {
      const hardEnd = Math.min(localStart + maxChars, chapter.text.length);
      const localEnd = this.findChunkEnd(chapter.text, localStart, hardEnd, maxChars);
      const trimmed = trimRange(chapter.text, localStart, localEnd);

      if (trimmed.text) {
        const startOffset = chapter.startOffset + trimmed.start;
        const endOffset = chapter.startOffset + trimmed.end;
        const orderIndex = state.orderIndex;
        const chunk = {
          id: createStableChunkId(input.bookId, orderIndex, startOffset, endOffset, trimmed.text),
          bookId: input.bookId,
          ...(input.bookAnalysisId === undefined
            ? {}
            : { bookAnalysisId: input.bookAnalysisId }),
          chapterIndex: chapter.index,
          text: trimmed.text,
          startOffset,
          endOffset,
          tokenEstimate: estimateTokenCount(trimmed.text),
          orderIndex
        };

        state.chunks.push(chunk);
        state.orderIndex += 1;
      }

      if (localEnd >= chapter.text.length) {
        break;
      }

      localStart = Math.max(localStart + 1, localEnd - overlapChars);
    }
  }

  private findChunkEnd(
    text: string,
    start: number,
    hardEnd: number,
    maxChars: number
  ): number {
    if (hardEnd >= text.length) {
      return text.length;
    }

    const minParagraphEnd = start + Math.floor(maxChars * 0.5);
    const paragraphEnd = text.lastIndexOf('\n\n', hardEnd);

    if (paragraphEnd > minParagraphEnd) {
      return paragraphEnd;
    }

    const minWordEnd = start + Math.floor(maxChars * 0.75);
    const wordEnd = findLastWhitespace(text, start, hardEnd);

    if (wordEnd > minWordEnd) {
      return wordEnd;
    }

    return hardEnd;
  }
}

function normalizeConfig(config: BookChunkingConfig): BookChunkingConfig {
  const targetTokenCount = Math.max(1, Math.floor(config.targetTokenCount));
  const overlapTokenCount = Math.max(
    0,
    Math.min(Math.floor(config.overlapTokenCount), targetTokenCount - 1)
  );

  return {
    targetTokenCount,
    overlapTokenCount
  };
}

function estimateTokenCount(text: string): number {
  return Math.max(1, Math.ceil(text.length / ESTIMATED_CHARS_PER_TOKEN));
}

function findLastWhitespace(text: string, start: number, end: number): number {
  for (let index = end; index > start; index -= 1) {
    if (/\s/.test(text.charAt(index - 1))) {
      return index - 1;
    }
  }

  return -1;
}

function trimRange(
  text: string,
  start: number,
  end: number
): { readonly start: number; readonly end: number; readonly text: string } {
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
    .update(
      [
        bookId,
        String(orderIndex),
        String(startOffset),
        String(endOffset),
        text
      ].join(':')
    )
    .digest('hex');

  return [
    hash.slice(0, 8),
    hash.slice(8, 12),
    `4${hash.slice(13, 16)}`,
    `${((Number.parseInt(hash.slice(16, 18), 16) & 0x3f) | 0x80).toString(16)}${hash.slice(18, 20)}`,
    hash.slice(20, 32)
  ].join('-');
}
