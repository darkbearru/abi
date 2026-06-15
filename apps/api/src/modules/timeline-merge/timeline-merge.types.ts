import type { ExtractedFactType, Prisma } from '@prisma/client';

export interface MergeableTimelineFact {
  readonly id: string;
  readonly type: ExtractedFactType;
  readonly entityName: string;
  readonly value: Prisma.JsonValue;
  readonly sourceChunkId: string;
  readonly confidence: number;
  readonly quote?: string | null;
  readonly chapterIndex: number;
  readonly timelineHint?: string | null;
  readonly createdAt?: Date;
}

export interface PlannedTimelineEvent {
  readonly title: string;
  readonly description: string | undefined;
  readonly chapterIndex: number;
  readonly absoluteDate: Date | undefined;
  readonly relativeOrder: number;
  readonly involvedCharacterNames: readonly string[];
  readonly involvedLocationNames: readonly string[];
  readonly sourceChunkIds: readonly string[];
  readonly sourceFactIds: readonly string[];
  readonly confidence: number;
  readonly relativeMarkers: Prisma.InputJsonObject | undefined;
}

export interface TimelineMergePlan {
  readonly events: readonly PlannedTimelineEvent[];
}
