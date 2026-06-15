import { createParsedBookText } from '../create-parsed-book.js';
import type { BookParser, BookParserMetadata, ParsedBookText } from '../types.js';

export class TxtParser implements BookParser {
  public constructor(private readonly metadata: BookParserMetadata = {}) {}

  public parse(input: Uint8Array): Promise<ParsedBookText> {
    return Promise.resolve(createParsedBookText(Buffer.from(input).toString('utf8'), this.metadata));
  }
}
