import { Prisma, type GenerationJob } from '@prisma/client';
import { InjectQueue } from '@nestjs/bullmq';
import { BadRequestException, Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import { Queue } from 'bullmq';

import { PrismaService } from '../../prisma/prisma.service.js';
import {
  DEFAULT_BACKOFF_DELAY_MS,
  DEFAULT_JOB_ATTEMPTS,
  QUEUE_NAMES,
  type QueueName
} from './queue.constants.js';
import { mapGenerationJobToResponse } from './job-status.mapper.js';
import type { CreateQueueJobInput, QueueJobResponse } from './queue.types.js';

type QueueRegistry = Record<QueueName, Queue>;
const DEFAULT_RECOVERY_LIMIT = 100;
const TERMINAL_JOB_STATUSES = new Set<GenerationJob['status']>([
  'COMPLETED',
  'FAILED',
  'CANCELLED'
]);

@Injectable()
export class QueueService implements OnModuleInit {
  private readonly queues: QueueRegistry;

  constructor(
    @InjectQueue('book-analysis') bookAnalysisQueue: Queue,
    @InjectQueue('chunk-extraction') chunkExtractionQueue: Queue,
    @InjectQueue('entity-merge') entityMergeQueue: Queue,
    @InjectQueue('vector-indexing') vectorIndexingQueue: Queue,
    @InjectQueue('graph-sync') graphSyncQueue: Queue,
    @InjectQueue('image-generation') imageGenerationQueue: Queue,
    @InjectQueue('image-validation') imageValidationQueue: Queue,
    private readonly prisma: PrismaService
  ) {
    this.queues = {
      'book-analysis': bookAnalysisQueue,
      'chunk-extraction': chunkExtractionQueue,
      'entity-merge': entityMergeQueue,
      'vector-indexing': vectorIndexingQueue,
      'graph-sync': graphSyncQueue,
      'image-generation': imageGenerationQueue,
      'image-validation': imageValidationQueue
    };
  }

  async onModuleInit(): Promise<void> {
    if (process.env.QUEUE_RECOVERY_ON_API_STARTUP !== 'true') {
      return;
    }

    await this.recoverQueuedJobs();
  }

  async createJob(input: CreateQueueJobInput): Promise<QueueJobResponse> {
    const userId =
      input.userId ??
      (input.projectId === undefined ? undefined : await this.resolveProjectUserId(input.projectId));

    if (userId === undefined) {
      throw new BadRequestException('Queue jobs must include userId or a valid projectId.');
    }

    const generationJob = await this.prisma.generationJob.create({
      data: {
        ...(input.projectId === undefined ? {} : { projectId: input.projectId }),
        userId,
        ...(input.sceneId === undefined ? {} : { sceneId: input.sceneId }),
        ...(input.bookAnalysisId === undefined ? {} : { bookAnalysisId: input.bookAnalysisId }),
        ...(input.visualStyleId === undefined ? {} : { visualStyleId: input.visualStyleId }),
        status: 'QUEUED',
        progress: 0,
        input: {
          queueName: input.queueName,
          name: input.name,
          payload: redactQueuePayload(input.payload),
          attempts: DEFAULT_JOB_ATTEMPTS
        }
      }
    });

    try {
      if (shouldPruneAnalysisJobHistory(input.queueName, input.bookAnalysisId)) {
        await pruneAnalysisJobHistory(
          this.prisma,
          generationJob.id,
          input.bookAnalysisId,
          input.queueName
        );
      }
      await this.queues[input.queueName].add(
        input.name,
        {
          ...input.payload,
          userId,
          generationJobId: generationJob.id
        },
        {
          jobId: generationJob.id,
          attempts: DEFAULT_JOB_ATTEMPTS,
          backoff: {
            type: 'exponential',
            delay: DEFAULT_BACKOFF_DELAY_MS
          },
          removeOnComplete: {
            age: 86_400,
            count: 1_000
          },
          removeOnFail: false
        }
      );
    } catch (error) {
      await this.prisma.generationJob.update({
        where: { id: generationJob.id },
        data: {
          status: 'FAILED',
          error: {
            queueName: input.queueName,
            name: input.name,
            stage: 'enqueue',
            message: error instanceof Error ? error.message : 'Unknown queue enqueue error.'
          }
        }
      });

      throw error;
    }

    return mapGenerationJobToResponse(generationJob);
  }

  async getJob(jobId: string): Promise<QueueJobResponse> {
    const job = await this.prisma.generationJob.findUnique({ where: { id: jobId } });

    if (!job) {
      throw new NotFoundException(`Job "${jobId}" was not found.`);
    }

    return mapGenerationJobToResponse(job);
  }

  async getProjectJobs(projectId: string): Promise<readonly QueueJobResponse[]> {
    const jobs = await this.prisma.generationJob.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' }
    });

    return jobs.map(mapGenerationJobToResponse);
  }

  async cancelJob(jobId: string): Promise<QueueJobResponse> {
    const job = await this.prisma.generationJob.findUnique({ where: { id: jobId } });

    if (!job) {
      throw new NotFoundException(`Job "${jobId}" was not found.`);
    }

    if (TERMINAL_JOB_STATUSES.has(job.status)) {
      return mapGenerationJobToResponse(job);
    }

    const input = toJsonObject(job.input);
    const queueName = toQueueName(input?.queueName);

    if (queueName !== undefined) {
      const bullJob = await this.queues[queueName].getJob(job.id);
      await bullJob?.remove().catch(() => undefined);
    }

    const cancelled = await this.prisma.generationJob.update({
      where: { id: job.id },
      data: {
        status: 'CANCELLED',
        error: Prisma.JsonNull,
        output: {
          ...(toJsonObject(job.output) ?? {}),
          cancelledAt: new Date().toISOString()
        }
      }
    });

    return mapGenerationJobToResponse(cancelled);
  }

  getQueueNames(): readonly QueueName[] {
    return QUEUE_NAMES;
  }

  private async resolveProjectUserId(projectId: string): Promise<string | undefined> {
    const project = await this.prisma.userBookProject.findUnique({
      where: { id: projectId },
      select: { userId: true }
    });

    return project?.userId;
  }

  async recoverQueuedJobs(limit = getRecoveryLimit()): Promise<number> {
    const jobs = await this.prisma.generationJob.findMany({
      where: { status: 'QUEUED' },
      orderBy: { createdAt: 'asc' },
      take: limit
    });
    let recovered = 0;

    for (const job of jobs) {
      if (await this.recoverQueuedJob(job)) {
        recovered += 1;
      }
    }

    return recovered;
  }

  private async recoverQueuedJob(job: GenerationJob): Promise<boolean> {
    const input = toJsonObject(job.input);
    const queueName = toQueueName(input?.queueName);
    const name = getString(input?.name);
    const payload = toJsonObject(input?.payload);

    if (queueName === undefined || name === undefined || payload === undefined) {
      await this.markRecoverySkipped(job, 'Tracked job input cannot be recovered.');
      return false;
    }

    try {
      await this.queues[queueName].add(
        name,
        {
          ...payload,
          generationJobId: job.id
        },
        {
          jobId: job.id,
          attempts: DEFAULT_JOB_ATTEMPTS,
          backoff: {
            type: 'exponential',
            delay: DEFAULT_BACKOFF_DELAY_MS
          },
          removeOnComplete: {
            age: 86_400,
            count: 1_000
          },
          removeOnFail: false
        }
      );

      return true;
    } catch (error) {
      await this.prisma.generationJob.update({
        where: { id: job.id },
        data: {
          error: {
            stage: 'recovery',
            message: error instanceof Error ? error.message : 'Unknown queue recovery error.'
          }
        }
      });

      return false;
    }
  }

  private async markRecoverySkipped(job: GenerationJob, reason: string): Promise<void> {
    await this.prisma.generationJob.update({
      where: { id: job.id },
      data: {
        error: {
          stage: 'recovery',
          skipped: true,
          reason
        }
      }
    });
  }
}

async function pruneAnalysisJobHistory(
  prisma: PrismaService,
  currentJobId: string,
  bookAnalysisId: string,
  queueName: QueueName
): Promise<void> {
  const jobs = await prisma.generationJob.findMany({
    where: { bookAnalysisId },
    orderBy: { createdAt: 'desc' },
    select: { id: true, input: true }
  });
  const staleJobIds = jobs
    .filter((job) => job.id !== currentJobId)
    .filter((job) => toQueueName(toJsonObject(job.input)?.queueName) === queueName)
    .map((job) => job.id);

  if (staleJobIds.length === 0) {
    return;
  }

  await prisma.generationJob.deleteMany({
    where: { id: { in: staleJobIds } }
  });
}

function shouldPruneAnalysisJobHistory(
  queueName: QueueName,
  bookAnalysisId: string | undefined
): bookAnalysisId is string {
  return (
    bookAnalysisId !== undefined &&
    (queueName === 'book-analysis' || queueName === 'chunk-extraction')
  );
}

function redactQueuePayload(payload: Record<string, unknown>): Prisma.InputJsonObject {
  const redacted: Record<string, Prisma.InputJsonValue> = {};

  for (const [key, value] of Object.entries(payload)) {
    redacted[key] = shouldRedactKey(key) ? redactValue(value) : toJsonValue(value);
  }

  return redacted;
}

function shouldRedactKey(key: string): boolean {
  return ['rawText', 'normalizedText', 'bookText', 'text', 'quote'].includes(key);
}

function redactValue(value: unknown): Prisma.InputJsonObject {
  const text = typeof value === 'string' ? value : JSON.stringify(value);

  return {
    redacted: true,
    length: text.length,
    preview: text.slice(0, 120)
  };
}

function toJsonValue(value: unknown): Prisma.InputJsonValue {
  if (value === undefined || value === null) {
    return { redacted: false, value: null };
  }

  if (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map(toJsonValue);
  }

  if (typeof value === 'object') {
    return redactQueuePayload(value as Record<string, unknown>);
  }

  return typeof value === 'bigint' ? value.toString() : `[${typeof value}]`;
}

function toJsonObject(value: unknown): Prisma.JsonObject | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value : undefined;
}

function toQueueName(value: unknown): QueueName | undefined {
  return typeof value === 'string' && QUEUE_NAMES.includes(value as QueueName)
    ? (value as QueueName)
    : undefined;
}

function getString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function getRecoveryLimit(): number {
  const configured = Number.parseInt(process.env.QUEUE_RECOVERY_LIMIT ?? '', 10);

  return Number.isFinite(configured) && configured > 0 ? configured : DEFAULT_RECOVERY_LIMIT;
}
