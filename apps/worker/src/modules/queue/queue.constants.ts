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
