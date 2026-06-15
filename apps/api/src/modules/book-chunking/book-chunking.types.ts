export interface BookChunkSourceChapter {
  readonly index: number;
  readonly text: string;
  readonly startOffset: number;
  readonly endOffset: number;
}

export interface CreateBookChunksInput {
  readonly bookId: string;
  readonly bookAnalysisId?: string;
  readonly normalizedText: string;
  readonly chapters?: readonly BookChunkSourceChapter[];
}

export interface BookChunkItem {
  readonly id: string;
  readonly bookId: string;
  readonly bookAnalysisId?: string;
  readonly chapterIndex: number;
  readonly text: string;
  readonly startOffset: number;
  readonly endOffset: number;
  readonly tokenEstimate: number;
  readonly orderIndex: number;
}
