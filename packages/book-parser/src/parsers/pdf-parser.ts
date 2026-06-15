import { createRequire } from 'node:module';

import { createParsedBookText } from '../create-parsed-book.js';
import type { BookParser, BookParserMetadata, ParsedBookText } from '../types.js';

const require = createRequire(import.meta.url);
const pdfParse = require('pdf-parse') as (input: Buffer) => Promise<{ text?: string; info?: unknown }>;

type PdfParseFunction = (input: Buffer) => Promise<{ text?: string; info?: unknown }>;

export class PdfParser implements BookParser {
  public constructor(
    private readonly metadata: BookParserMetadata = {},
    private readonly parsePdf: PdfParseFunction = pdfParse
  ) {}

  public async parse(input: Uint8Array): Promise<ParsedBookText> {
    const result = await this.parsePdf(Buffer.from(input));

    return createParsedBookText(result.text ?? '', this.metadata);
  }
}
