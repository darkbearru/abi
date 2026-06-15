import { OnWorkerEvent, Processor } from '@nestjs/bullmq';
import type { Job } from 'bullmq';

import { PrismaService } from '../../prisma/prisma.service.js';
import { TrackedQueueProcessor } from './tracked-queue.processor.js';

type QueueJob = Job<Record<string, unknown>>;

@Processor('book-analysis')
class BookAnalysisProcessor extends TrackedQueueProcessor {
  constructor(prisma: PrismaService) {
    super(prisma, 'book-analysis');
  }

  @OnWorkerEvent('failed')
  onFailed(job: QueueJob, error: Error): Promise<void> {
    return this.handleFailed(job, error);
  }
}

@Processor('chunk-extraction')
class ChunkExtractionProcessor extends TrackedQueueProcessor {
  constructor(prisma: PrismaService) {
    super(prisma, 'chunk-extraction');
  }

  @OnWorkerEvent('failed')
  onFailed(job: QueueJob, error: Error): Promise<void> {
    return this.handleFailed(job, error);
  }
}

@Processor('entity-merge')
class EntityMergeProcessor extends TrackedQueueProcessor {
  constructor(prisma: PrismaService) {
    super(prisma, 'entity-merge');
  }

  @OnWorkerEvent('failed')
  onFailed(job: QueueJob, error: Error): Promise<void> {
    return this.handleFailed(job, error);
  }
}

@Processor('vector-indexing')
class VectorIndexingProcessor extends TrackedQueueProcessor {
  constructor(prisma: PrismaService) {
    super(prisma, 'vector-indexing');
  }

  @OnWorkerEvent('failed')
  onFailed(job: QueueJob, error: Error): Promise<void> {
    return this.handleFailed(job, error);
  }
}

@Processor('graph-sync')
class GraphSyncProcessor extends TrackedQueueProcessor {
  constructor(prisma: PrismaService) {
    super(prisma, 'graph-sync');
  }

  @OnWorkerEvent('failed')
  onFailed(job: QueueJob, error: Error): Promise<void> {
    return this.handleFailed(job, error);
  }
}

@Processor('image-generation')
class ImageGenerationProcessor extends TrackedQueueProcessor {
  constructor(prisma: PrismaService) {
    super(prisma, 'image-generation');
  }

  @OnWorkerEvent('failed')
  onFailed(job: QueueJob, error: Error): Promise<void> {
    return this.handleFailed(job, error);
  }
}

@Processor('image-validation')
class ImageValidationProcessor extends TrackedQueueProcessor {
  constructor(prisma: PrismaService) {
    super(prisma, 'image-validation');
  }

  @OnWorkerEvent('failed')
  onFailed(job: QueueJob, error: Error): Promise<void> {
    return this.handleFailed(job, error);
  }
}

export const queueProcessors = [
  BookAnalysisProcessor,
  ChunkExtractionProcessor,
  EntityMergeProcessor,
  VectorIndexingProcessor,
  GraphSyncProcessor,
  ImageGenerationProcessor,
  ImageValidationProcessor
] as const;
