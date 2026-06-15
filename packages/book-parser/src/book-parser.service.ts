import { Injectable } from '@nestjs/common';

import {
  createBookParser,
  parseBook,
  type CreateBookParserInput
} from './parse-book.js';
import type { BookParser, ParsedBookText } from './types.js';

@Injectable()
export class BookParserService {
  createParser(input: CreateBookParserInput): BookParser {
    return createBookParser(input);
  }

  parse(
    input: Uint8Array,
    parserInput: CreateBookParserInput
  ): Promise<ParsedBookText> {
    return parseBook(input, parserInput);
  }
}
