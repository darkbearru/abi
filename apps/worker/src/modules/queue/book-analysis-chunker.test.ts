import { describe, expect, it } from 'vitest';

import { createWorkerBookChunks } from './book-analysis-chunker.js';

describe('createWorkerBookChunks', () => {
  it('creates stable ordered overlapping chunks without splitting paragraphs when possible', () => {
    const text = ['First paragraph has enough words to form a chunk.', 'Second paragraph continues the book.'].join(
      '\n\n'
    );
    const chunks = createWorkerBookChunks({
      bookId: 'book-1',
      bookAnalysisId: 'analysis-1',
      normalizedText: text,
      chapters: [
        {
          index: 0,
          text,
          startOffset: 0,
          endOffset: text.length
        }
      ],
      targetTokenCount: 8,
      overlapTokenCount: 2
    });

    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.map((chunk) => chunk.orderIndex)).toEqual(
      chunks.map((_, index) => index)
    );
    expect(chunks[1]?.startOffset).toBeLessThan(chunks[0]?.endOffset ?? 0);
    expect(chunks[0]?.bookAnalysisId).toBe('analysis-1');
  });
});
