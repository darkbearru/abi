import type { ExtractedFactType } from '@prisma/client';

export interface LocationExtractionJobInput {
  readonly bookId: string;
  readonly analysisId: string;
  readonly chunkId: string;
}

export interface SavedLocationExtractedFact {
  readonly type: ExtractedFactType;
  readonly entityName: string;
  readonly sourceChunkId: string;
  readonly confidence: number;
  readonly quote?: string;
  readonly chapterIndex: number;
  readonly timelineHint?: string;
}
