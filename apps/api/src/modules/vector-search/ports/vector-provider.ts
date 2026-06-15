export type VectorEntityType =
  | 'BookChunk'
  | 'CharacterVersion'
  | 'LocationVersion'
  | 'TimelineEvent';

export interface VectorPayload {
  readonly projectId?: string;
  readonly bookId?: string;
  readonly bookAnalysisId?: string;
  readonly entityType: VectorEntityType;
  readonly entityId: string;
  readonly sourceEntity: string;
  readonly title?: string;
  readonly text: string;
  readonly metadata?: Record<string, string | number | boolean | null>;
}

export interface VectorPoint {
  readonly id: string;
  readonly vector: readonly number[];
  readonly payload: VectorPayload;
}

export interface VectorSearchFilter {
  readonly projectId?: string;
  readonly entityTypes?: readonly VectorEntityType[];
}

export interface VectorSearchResult {
  readonly id: string;
  readonly score: number;
  readonly payload: VectorPayload;
}

export interface VectorProvider {
  ensureCollection(vectorSize: number): Promise<void>;
  upsert(points: readonly VectorPoint[]): Promise<void>;
  deleteByFilter(filter: VectorSearchFilter): Promise<void>;
  search(
    vector: readonly number[],
    filter: VectorSearchFilter,
    limit: number
  ): Promise<readonly VectorSearchResult[]>;
}

export const VECTOR_PROVIDER = 'ABI_VECTOR_PROVIDER';
