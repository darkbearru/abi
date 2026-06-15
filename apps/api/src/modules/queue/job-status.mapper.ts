import type { GenerationJob, Prisma } from '@prisma/client';

import type { QueueJobResponse } from './queue.types.js';

export function mapGenerationJobToResponse(job: GenerationJob): QueueJobResponse {
  const input = job.input as Prisma.JsonObject;

  return {
    id: job.id,
    queueName: getString(input.queueName, 'unknown'),
    name: getString(input.name, 'unknown'),
    status: job.status,
    progress: job.progress,
    projectId: job.projectId,
    userId: job.userId,
    sceneId: job.sceneId,
    bookAnalysisId: job.bookAnalysisId,
    input: job.input,
    output: job.output,
    error: job.error,
    createdAt: job.createdAt.toISOString(),
    updatedAt: job.updatedAt.toISOString()
  };
}

function getString(value: unknown, fallback: string): string {
  return typeof value === 'string' ? value : fallback;
}
