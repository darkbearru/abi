import AdmZip from 'adm-zip';
import { XMLParser } from 'fast-xml-parser';

import { createParsedBookText } from '../create-parsed-book.js';
import { compactMetadata } from '../metadata.js';
import { stripXmlTags } from '../text-normalizer.js';
import type { BookParser, BookParserMetadata, ParsedBookText } from '../types.js';

export class EpubParser implements BookParser {
  public constructor(private readonly metadata: BookParserMetadata = {}) {}

  public parse(input: Uint8Array): Promise<ParsedBookText> {
    const zip = new AdmZip(Buffer.from(input));
    const metadata = {
      ...this.extractMetadata(zip),
      ...this.metadata
    };
    const rawText = zip
      .getEntries()
      .filter((entry) => !entry.isDirectory && /\.(xhtml|html|htm)$/i.test(entry.entryName))
      .sort((left, right) => left.entryName.localeCompare(right.entryName))
      .map((entry) => stripXmlTags(entry.getData().toString('utf8')))
      .join('\n\n');

    return Promise.resolve(createParsedBookText(rawText, metadata));
  }

  private extractMetadata(zip: AdmZip): BookParserMetadata {
    const opfEntry = zip
      .getEntries()
      .find((entry) => !entry.isDirectory && /\.opf$/i.test(entry.entryName));

    if (!opfEntry) {
      return {};
    }

    const parser = new XMLParser({
      ignoreAttributes: false,
      removeNSPrefix: true,
      trimValues: true
    });
    const parsed = parser.parse(opfEntry.getData().toString('utf8')) as {
      package?: {
        metadata?: Record<string, unknown>;
      };
    };
    const metadata = parsed.package?.metadata ?? {};

    return compactMetadata({
      title: firstString(metadata.title),
      author: firstString(metadata.creator),
      language: firstString(metadata.language)
    });
  }
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
