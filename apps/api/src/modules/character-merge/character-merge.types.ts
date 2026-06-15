import type { EntityConflictType, ExtractedFactType, Prisma } from '@prisma/client';

export interface MergeableExtractedFact {
  readonly id: string;
  readonly type: ExtractedFactType;
  readonly entityName: string;
  readonly value: Prisma.JsonValue;
  readonly confidence: number;
  readonly chapterIndex: number;
  readonly timelineHint?: string | null;
}

export interface PlannedCharacterVersion {
  readonly version: number;
  readonly age?: string;
  readonly appearance: Prisma.JsonObject;
  readonly personality?: Prisma.JsonObject;
  readonly speechManner?: string;
  readonly clothing?: Prisma.JsonObject;
  readonly timelineRange?: Prisma.JsonObject;
  readonly confidenceScore: number;
  readonly sourceFactIds: readonly string[];
}

export interface PlannedCharacter {
  readonly canonicalName: string;
  readonly aliases: readonly string[];
  readonly versions: readonly PlannedCharacterVersion[];
  readonly sourceFactIds: readonly string[];
}

export interface PlannedEntityConflict {
  readonly type: EntityConflictType;
  readonly characterCanonicalName?: string;
  readonly summary: string;
  readonly options: Prisma.InputJsonValue;
  readonly sourceFactIds: readonly string[];
}

export interface CharacterMergePlan {
  readonly characters: readonly PlannedCharacter[];
  readonly conflicts: readonly PlannedEntityConflict[];
}
