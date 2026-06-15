import { XMLParser } from 'fast-xml-parser';

import { createParsedBookText } from '../create-parsed-book.js';
import { compactMetadata } from '../metadata.js';
import type { BookParser, BookParserMetadata, ParsedBookText } from '../types.js';

export class Fb2Parser implements BookParser {
  public constructor(private readonly metadata: BookParserMetadata = {}) {}

  public parse(input: Uint8Array): Promise<ParsedBookText> {
    const parser = new XMLParser({
      ignoreAttributes: false,
      removeNSPrefix: true,
      trimValues: true
    });
    const parsed = parser.parse(Buffer.from(input).toString('utf8')) as unknown;
    const metadata = {
      ...extractFb2Metadata(parsed),
      ...this.metadata
    };

    return Promise.resolve(createParsedBookText(collectText(parsed).join('\n'), metadata));
  }
}

function extractFb2Metadata(parsed: unknown): BookParserMetadata {
  const description = getTitleInfo(parsed);
  const author = description ? collectAuthor(description.author) : undefined;

  return compactMetadata({
    title: description ? firstString(description['book-title']) : undefined,
    author,
    language: description ? firstString(description.lang) : undefined
  });
}

function collectAuthor(value: unknown): string | undefined {
  if (!value) {
    return undefined;
  }

  const author: unknown = Array.isArray(value) ? value[0] : value;

  if (!author || typeof author !== 'object') {
    return undefined;
  }

  const record = author as Record<string, unknown>;
  const names = [record['first-name'], record['middle-name'], record['last-name']]
    .map(firstString)
    .filter((name): name is string => Boolean(name));

  return names.length > 0 ? names.join(' ') : undefined;
}

function collectText(value: unknown): string[] {
  if (typeof value === 'string') {
    return [value];
  }

  if (Array.isArray(value)) {
    return value.flatMap((item) => collectText(item));
  }

  if (value && typeof value === 'object') {
    return Object.values(value).flatMap((nested) => collectText(nested));
  }

  return [];
}

function getTitleInfo(value: unknown): Record<string, unknown> | undefined {
  const path = ['FictionBook', 'description', 'title-info'] as const;
  let current: unknown = value;

  for (const key of path) {
    if (!current || typeof current !== 'object') {
      return undefined;
    }

    current = (current as Record<string, unknown>)[key];
  }

  return current && typeof current === 'object'
    ? (current as Record<string, unknown>)
    : undefined;
}

function firstString(value: unknown): string | undefined {
  if (typeof value === 'string') {
    return value;
  }

  if (Array.isArray(value)) {
    return firstString(value[0]);
  }

  if (value && typeof value === 'object') {
    const text = (value as Record<string, unknown>)['#text'];

    return typeof text === 'string' ? text : undefined;
  }

  return undefined;
}
