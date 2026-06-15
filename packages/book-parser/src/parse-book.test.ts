import { describe, expect, it } from 'vitest';

import { createBookParser } from './parse-book.js';
import { Fb2Parser } from './parsers/fb2-parser.js';
import { TxtParser } from './parsers/txt-parser.js';

describe('createBookParser', () => {
  it('selects parsers from extension or mime type', () => {
    expect(createBookParser({ filename: 'a.txt' })).toBeInstanceOf(TxtParser);
    expect(createBookParser({ mimeType: 'application/x-fictionbook+xml' })).toBeInstanceOf(
      Fb2Parser
    );
  });
});
