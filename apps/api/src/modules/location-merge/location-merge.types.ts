import type { EntityConflictType, ExtractedFactType, Prisma } from '@prisma/client';

export interface MergeableLocationFact {
  readonly id: string;
  readonly type: ExtractedFactType;
  readonly entityName: string;
  readonly value: Prisma.JsonValue;
  readonly confidence: number;
  readonly chapterIndex: number;
  readonly timelineHint?: string | null;
}

export interface PlannedLocationVersion {
  readonly version: number;
  readonly description: string;
  readonly atmosphere?: Prisma.InputJsonObject;
  readonly palette?: Prisma.InputJsonObject;
  readonly era?: string;
  readonly socialContext?: Prisma.InputJsonObject;
  readonly lightingRules?: Prisma.InputJsonObject;
  readonly architectureRules?: Prisma.InputJsonObject;
  readonly recurringObjects?: Prisma.InputJsonObject;
  readonly referenceAssetIds: readonly string[];
  readonly confidenceScore: number;
  readonly sourceFactIds: readonly string[];
}

export interface PlannedLocation {
  readonly name: string;
  readonly parentName?: string;
  readonly aliases: readonly string[];
  readonly versions: readonly PlannedLocationVersion[];
  readonly sourceFactIds: readonly string[];
}

export interface PlannedLocationConflict {
  readonly type: EntityConflictType;
  readonly locationName?: string;
  readonly summary: string;
  readonly options: Prisma.InputJsonValue;
  readonly sourceFactIds: readonly string[];
}

export interface LocationMergePlan {
  readonly locations: readonly PlannedLocation[];
  readonly conflicts: readonly PlannedLocationConflict[];
}
