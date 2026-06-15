import { describe, expect, it, vi } from 'vitest';

import { PdfParser } from './pdf-parser.js';

describe('PdfParser', () => {
  it('parses text returned by pdf-parse', async () => {
    const parsed = await new PdfParser(
      { title: 'Mock PDF' },
      vi.fn().mockResolvedValue({
        text: 'Chapter 1\nPDF text'
      })
    ).parse(Buffer.from('%PDF mock'));

    expect(parsed.metadata.title).toBe('Mock PDF');
    expect(parsed.normalizedText).toBe('Chapter 1\nPDF text');
    expect(parsed.chapters).toHaveLength(1);
  });
});
