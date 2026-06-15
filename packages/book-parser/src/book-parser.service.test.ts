import { describe, expect, it } from 'vitest';

import { BookParserService } from './book-parser.service.js';

describe('BookParserService', () => {
  it('parses text books through the Nest injectable facade', async () => {
    const service = new BookParserService();

    await expect(
      service.parse(Buffer.from('Chapter 1\nHello   world'), {
        filename: 'book.txt',
        mimeType: 'text/plain'
      })
    ).resolves.toMatchObject({
      rawText: 'Chapter 1\nHello   world',
      normalizedText: 'Chapter 1\nHello world'
    });
  });
});
