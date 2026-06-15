import { describe, expect, it } from 'vitest';

import { TxtParser } from './txt-parser.js';

describe('TxtParser', () => {
  it('parses text and detects chapters', async () => {
    const parsed = await new TxtParser({ title: 'Manual Title' }).parse(
      Buffer.from('  Chapter 1\nHello   world\r\n\r\nChapter 2\nNext page  ')
    );

    expect(parsed.metadata.title).toBe('Manual Title');
    expect(parsed.normalizedText).toBe('Chapter 1\nHello world\n\nChapter 2\nNext page');
    expect(parsed.chapters).toEqual([
      {
        index: 0,
        title: 'Chapter 1',
        text: 'Chapter 1\nHello world',
        startOffset: 0,
        endOffset: 23
      },
      {
        index: 1,
        title: 'Chapter 2',
        text: 'Chapter 2\nNext page',
        startOffset: 23,
        endOffset: 42
      }
    ]);
  });
});
