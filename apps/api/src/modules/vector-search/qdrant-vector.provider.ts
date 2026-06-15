import { Injectable } from '@nestjs/common';

import type {
  VectorEntityType,
  VectorPoint,
  VectorProvider,
  VectorSearchFilter,
  VectorSearchResult
} from './ports/vector-provider.js';

interface QdrantPoint {
  readonly id: string;
  readonly score: number;
  readonly payload?: unknown;
}

@Injectable()
export class QdrantVectorProvider implements VectorProvider {
  private readonly baseUrl = (process.env.QDRANT_URL ?? 'http://localhost:6333').replace(
    /\/$/,
    ''
  );
  private readonly collectionName =
    process.env.QDRANT_COLLECTION_BOOK_KNOWLEDGE ?? 'abi_book_knowledge';

  async ensureCollection(vectorSize: number): Promise<void> {
    const response = await fetch(`${this.baseUrl}/collections/${this.collectionName}`);

    if (response.ok) {
      return;
    }

    if (response.status !== 404) {
      throw new Error(
        `Qdrant collection check failed with status ${String(response.status)}.`
      );
    }

    await this.request(`/collections/${this.collectionName}`, {
      method: 'PUT',
      body: {
        vectors: {
          size: vectorSize,
          distance: 'Cosine'
        }
      }
    });
  }

  async upsert(points: readonly VectorPoint[]): Promise<void> {
    if (points.length === 0) {
      return;
    }

    await this.request(`/collections/${this.collectionName}/points?wait=true`, {
      method: 'PUT',
      body: {
        points: points.map((point) => ({
          id: point.id,
          vector: point.vector,
          payload: point.payload
        }))
      }
    });
  }

  async deleteByFilter(filter: VectorSearchFilter): Promise<void> {
    await this.request(`/collections/${this.collectionName}/points/delete?wait=true`, {
      method: 'POST',
      body: {
        filter: toQdrantFilter(filter)
      }
    });
  }

  async search(
    vector: readonly number[],
    filter: VectorSearchFilter,
    limit: number
  ): Promise<readonly VectorSearchResult[]> {
    const response = await this.request<{
      readonly result?: readonly QdrantPoint[];
    }>(`/collections/${this.collectionName}/points/search`, {
      method: 'POST',
      body: {
        vector,
        limit,
        with_payload: true,
        filter: toQdrantFilter(filter)
      }
    });

    return (response.result ?? []).map((point) => ({
      id: point.id,
      score: point.score,
      payload: toVectorPayload(point.payload)
    }));
  }

  private async request<T = unknown>(
    path: string,
    options: {
      readonly method: 'GET' | 'POST' | 'PUT';
      readonly body?: unknown;
    }
  ): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: options.method,
      headers: {
        'content-type': 'application/json'
      },
      ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) })
    });

    if (!response.ok) {
      const message = await response.text();

      throw new Error(
        `Qdrant request failed with status ${String(response.status)}: ${message.slice(0, 500)}`
      );
    }

    return (await response.json()) as T;
  }
}

function toQdrantFilter(filter: VectorSearchFilter): Record<string, unknown> {
  const must: Record<string, unknown>[] = [];

  if (filter.projectId) {
    must.push({
      key: 'projectId',
      match: {
        value: filter.projectId
      }
    });
  }

  if (filter.entityTypes && filter.entityTypes.length > 0) {
    must.push({
      key: 'entityType',
      match: {
        any: [...filter.entityTypes]
      }
    });
  }

  return { must };
}

function toVectorPayload(payload: unknown): VectorSearchResult['payload'] {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error('Qdrant point payload is missing or invalid.');
  }

  const value = payload as Record<string, unknown>;
  const entityType = value.entityType;
  const entityId = value.entityId;
  const sourceEntity = value.sourceEntity;
  const text = value.text;

  if (
    !isVectorEntityType(entityType) ||
    typeof entityId !== 'string' ||
    typeof sourceEntity !== 'string' ||
    typeof text !== 'string'
  ) {
    throw new Error('Qdrant point payload does not match vector payload shape.');
  }

  return {
    ...(typeof value.projectId === 'string' ? { projectId: value.projectId } : {}),
    ...(typeof value.bookId === 'string' ? { bookId: value.bookId } : {}),
    ...(typeof value.bookAnalysisId === 'string'
      ? { bookAnalysisId: value.bookAnalysisId }
      : {}),
    entityType,
    entityId,
    sourceEntity,
    ...(typeof value.title === 'string' ? { title: value.title } : {}),
    text,
    metadata:
      value.metadata && typeof value.metadata === 'object' && !Array.isArray(value.metadata)
        ? toMetadata(value.metadata as Record<string, unknown>)
        : {}
  };
}

function isVectorEntityType(value: unknown): value is VectorEntityType {
  return (
    value === 'BookChunk' ||
    value === 'CharacterVersion' ||
    value === 'LocationVersion' ||
    value === 'TimelineEvent'
  );
}

function toMetadata(
  value: Record<string, unknown>
): Record<string, string | number | boolean | null> {
  return Object.fromEntries(
    Object.entries(value).filter(
      (entry): entry is [string, string | number | boolean | null] =>
        typeof entry[1] === 'string' ||
        typeof entry[1] === 'number' ||
        typeof entry[1] === 'boolean' ||
        entry[1] === null
    )
  );
}
