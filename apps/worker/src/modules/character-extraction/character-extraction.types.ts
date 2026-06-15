import type { ExtractedFactType } from '@prisma/client';

export interface CharacterExtractionJobInput {
  readonly bookId: string;
  readonly analysisId: string;
  readonly chunkId: string;
}

export interface SavedExtractedFact {
  readonly type: ExtractedFactType;
  readonly entityName: string;
  readonly sourceChunkId: string;
  readonly confidence: number;
  readonly quote?: string;
  readonly chapterIndex: number;
  readonly timelineHint?: string;
}
