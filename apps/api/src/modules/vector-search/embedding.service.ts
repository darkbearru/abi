import { createHash } from 'node:crypto';

import { Injectable } from '@nestjs/common';

export interface EmbeddingService {
  readonly vectorSize: number;
  embed(text: string): readonly number[];
}

@Injectable()
export class HashEmbeddingService implements EmbeddingService {
  public readonly vectorSize: number;

  constructor() {
    this.vectorSize = getVectorSize();
  }

  embed(text: string): readonly number[] {
    const vector = Array.from({ length: this.vectorSize }, () => 0);
    const tokens = tokenize(text);

    for (const token of tokens) {
      const hash = createHash('sha256').update(token).digest();
      const index = hash.readUInt32BE(0) % this.vectorSize;
      const sign = hash.readUInt8(4) % 2 === 0 ? 1 : -1;
      const currentValue = vector[index] ?? 0;

      vector[index] = currentValue + sign * Math.log1p(token.length);
    }

    return normalizeVector(vector);
  }
}

function getVectorSize(): number {
  const configured = Number.parseInt(process.env.VECTOR_EMBEDDING_DIMENSIONS ?? '256', 10);

  return Number.isFinite(configured) && configured > 0 ? configured : 256;
}

function tokenize(text: string): readonly string[] {
  return text
    .toLowerCase()
    .normalize('NFKC')
    .split(/[^\p{L}\p{N}]+/u)
    .map((token) => token.trim())
    .filter((token) => token.length > 1);
}

function normalizeVector(vector: readonly number[]): readonly number[] {
  const norm = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));

  if (norm === 0) {
    return vector;
  }

  return vector.map((value) => value / norm);
}
