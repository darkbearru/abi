import { extname } from 'node:path';

import { EpubParser } from './parsers/epub-parser.js';
import { Fb2Parser } from './parsers/fb2-parser.js';
import { PdfParser } from './parsers/pdf-parser.js';
import { TxtParser } from './parsers/txt-parser.js';
import type { BookParser, BookParserMetadata, ParsedBookText } from './types.js';

export interface CreateBookParserInput {
  readonly filename?: string;
  readonly mimeType?: string;
  readonly metadata?: BookParserMetadata;
}

export class UnsupportedBookFormatError extends Error {
  constructor() {
    super('Unsupported book format.');
    this.name = 'UnsupportedBookFormatError';
  }
}

export function createBookParser(input: CreateBookParserInput): BookParser {
  const extension = input.filename ? extname(input.filename).toLowerCase() : '';
  const metadata = input.metadata ?? {};

  if (extension === '.txt' || input.mimeType === 'text/plain') {
    return new TxtParser(metadata);
  }

  if (extension === '.pdf' || input.mimeType === 'application/pdf') {
    return new PdfParser(metadata);
  }

  if (extension === '.epub' || input.mimeType === 'application/epub+zip') {
    return new EpubParser(metadata);
  }

  if (
    extension === '.fb2' ||
    input.mimeType === 'application/x-fictionbook+xml' ||
    input.mimeType === 'application/xml' ||
    input.mimeType === 'text/xml'
  ) {
    return new Fb2Parser(metadata);
  }

  throw new UnsupportedBookFormatError();
}

export function parseBook(
  input: Uint8Array,
  parserInput: CreateBookParserInput
): Promise<ParsedBookText> {
  return createBookParser(parserInput).parse(input);
}
