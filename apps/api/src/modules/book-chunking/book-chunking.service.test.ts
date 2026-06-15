import { describe, expect, it } from 'vitest';

import type { PrismaService } from '../../prisma/prisma.service.js';
import { BookChunkingService } from './book-chunking.service.js';

const BOOK_ID = '11111111-1111-4111-8111-111111111111';

function createService(): BookChunkingService {
  return new BookChunkingService({} as PrismaService, {
    targetTokenCount: 15,
    overlapTokenCount: 2
  });
}

describe('BookChunkingService', () => {
  it('creates chunks with stable ordering', () => {
    const service = createService();
    const text = [
      'First paragraph has useful content.',
      'Second paragraph has useful content.',
      'Third paragraph closes the sample.'
    ].join('\n\n');

    const firstRun = service.createChunks({ bookId: BOOK_ID, normalizedText: text });
    const secondRun = service.createChunks({ bookId: BOOK_ID, normalizedText: text });

    expect(firstRun.map((chunk) => chunk.orderIndex)).toEqual([0, 1, 2]);
    expect(secondRun).toEqual(firstRun);
  });

  it('keeps overlap between adjacent chunks', () => {
    const service = createService();
    const text = [
      'First paragraph has useful content.',
      'Second paragraph has useful content.',
      'Third paragraph closes the sample.'
    ].join('\n\n');

    const chunks = service.createChunks({ bookId: BOOK_ID, normalizedText: text });

    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks[1]?.startOffset).toBeLessThan(chunks[0]?.endOffset ?? 0);
  });

  it('keeps offsets aligned with the normalized text', () => {
    const service = createService();
    const text = [
      'First paragraph has useful content.',
      'Second paragraph has useful content.',
      'Third paragraph closes the sample.'
    ].join('\n\n');

    const chunks = service.createChunks({ bookId: BOOK_ID, normalizedText: text });

    for (const chunk of chunks) {
      expect(text.slice(chunk.startOffset, chunk.endOffset)).toBe(chunk.text);
      expect(chunk.startOffset).toBeLessThan(chunk.endOffset);
    }
  });

  it('returns no chunks for empty input', () => {
    const service = createService();

    expect(service.createChunks({ bookId: BOOK_ID, normalizedText: ' \n\n ' })).toEqual([]);
  });

  it('falls back to splitting long paragraphs', () => {
    const service = new BookChunkingService({} as PrismaService, {
      targetTokenCount: 8,
      overlapTokenCount: 2
    });
    const text = Array.from({ length: 80 }, (_, index) => `word${String(index)}`).join(' ');

    const chunks = service.createChunks({ bookId: BOOK_ID, normalizedText: text });

    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks[0]?.text.length).toBeLessThanOrEqual(32);
    expect(chunks.every((chunk) => chunk.text.length > 0)).toBe(true);
    expect(chunks.every((chunk) => text.slice(chunk.startOffset, chunk.endOffset) === chunk.text)).toBe(true);
  });
});
