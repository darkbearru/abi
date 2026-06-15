import type { Prisma } from '@prisma/client';

import type { QueueName } from './queue.constants.js';

export interface CreateQueueJobInput {
  readonly queueName: QueueName;
  readonly name: string;
  readonly payload: Record<string, unknown>;
  readonly projectId?: string;
  readonly userId?: string;
  readonly sceneId?: string;
  readonly bookAnalysisId?: string;
  readonly visualStyleId?: string;
}

export interface QueueJobResponse {
  readonly id: string;
  readonly queueName: string;
  readonly name: string;
  readonly status: 'QUEUED' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  readonly progress: number;
  readonly projectId: string | null;
  readonly userId: string | null;
  readonly sceneId: string | null;
  readonly bookAnalysisId: string | null;
  readonly input: Prisma.JsonValue;
  readonly output: Prisma.JsonValue | null;
  readonly error: Prisma.JsonValue | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}
