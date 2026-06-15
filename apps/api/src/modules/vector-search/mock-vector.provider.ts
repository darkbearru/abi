import type {
  VectorPoint,
  VectorProvider,
  VectorSearchFilter,
  VectorSearchResult
} from './ports/vector-provider.js';

export class MockVectorProvider implements VectorProvider {
  private readonly points = new Map<string, VectorPoint>();
  private collectionSize: number | undefined;

  ensureCollection(vectorSize: number): Promise<void> {
    this.collectionSize = vectorSize;

    return Promise.resolve();
  }

  upsert(points: readonly VectorPoint[]): Promise<void> {
    for (const point of points) {
      if (this.collectionSize !== undefined && point.vector.length !== this.collectionSize) {
        throw new Error('Vector size does not match mock collection size.');
      }

      this.points.set(point.id, point);
    }

    return Promise.resolve();
  }

  deleteByFilter(filter: VectorSearchFilter): Promise<void> {
    for (const [id, point] of this.points.entries()) {
      if (matchesFilter(point, filter)) {
        this.points.delete(id);
      }
    }

    return Promise.resolve();
  }

  search(
    vector: readonly number[],
    filter: VectorSearchFilter,
    limit: number
  ): Promise<readonly VectorSearchResult[]> {
    return Promise.resolve([...this.points.values()]
      .filter((point) => matchesFilter(point, filter))
      .map((point) => ({
        id: point.id,
        score: cosineSimilarity(vector, point.vector),
        payload: point.payload
      }))
      .sort((left, right) => right.score - left.score)
      .slice(0, limit));
  }
}

function matchesFilter(point: VectorPoint, filter: VectorSearchFilter): boolean {
  if (filter.projectId && point.payload.projectId !== filter.projectId) {
    return false;
  }

  if (
    filter.entityTypes &&
    filter.entityTypes.length > 0 &&
    !filter.entityTypes.includes(point.payload.entityType)
  ) {
    return false;
  }

  return true;
}

function cosineSimilarity(left: readonly number[], right: readonly number[]): number {
  const length = Math.min(left.length, right.length);
  let dot = 0;
  let leftNorm = 0;
  let rightNorm = 0;

  for (let index = 0; index < length; index += 1) {
    const leftValue = left[index] ?? 0;
    const rightValue = right[index] ?? 0;

    dot += leftValue * rightValue;
    leftNorm += leftValue * leftValue;
    rightNorm += rightValue * rightValue;
  }

  if (leftNorm === 0 || rightNorm === 0) {
    return 0;
  }

  return dot / Math.sqrt(leftNorm * rightNorm);
}
