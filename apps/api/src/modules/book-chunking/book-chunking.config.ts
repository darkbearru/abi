const DEFAULT_BOOK_CHUNK_TARGET_TOKENS = 1_800;
const DEFAULT_BOOK_CHUNK_OVERLAP_TOKENS = 200;

export const BOOK_CHUNKING_CONFIG = 'ABI_BOOK_CHUNKING_CONFIG';

export interface BookChunkingConfig {
  readonly targetTokenCount: number;
  readonly overlapTokenCount: number;
}

export function getBookChunkingConfig(): BookChunkingConfig {
  const targetTokenCount = readPositiveInteger(
    process.env.BOOK_CHUNK_TARGET_TOKENS,
    DEFAULT_BOOK_CHUNK_TARGET_TOKENS
  );
  const overlapTokenCount = readPositiveInteger(
    process.env.BOOK_CHUNK_OVERLAP_TOKENS,
    DEFAULT_BOOK_CHUNK_OVERLAP_TOKENS
  );

  return {
    targetTokenCount,
    overlapTokenCount: Math.min(overlapTokenCount, targetTokenCount - 1)
  };
}

function readPositiveInteger(value: string | undefined, fallback: number): number {
  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    return fallback;
  }

  return parsed;
}
