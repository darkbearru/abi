export interface ParsedBookText {
  readonly rawText: string;
  readonly normalizedText: string;
  readonly chapters: readonly ParsedChapter[];
  readonly metadata: {
    readonly title?: string;
    readonly author?: string;
    readonly language?: string;
  };
}

export interface ParsedChapter {
  readonly index: number;
  readonly title?: string;
  readonly text: string;
  readonly startOffset: number;
  readonly endOffset: number;
}

export interface BookParser {
  parse(input: Uint8Array): Promise<ParsedBookText>;
}

export interface BookParserMetadata {
  readonly title?: string;
  readonly author?: string;
  readonly language?: string;
}
