export const QUEUE_NAMES = [
  'book-analysis',
  'chunk-extraction',
  'entity-merge',
  'vector-indexing',
  'graph-sync',
  'image-generation',
  'image-validation'
] as const;

export type QueueName = (typeof QUEUE_NAMES)[number];

export const DEFAULT_JOB_ATTEMPTS = 3;
export const DEFAULT_BACKOFF_DELAY_MS = 5_000;
