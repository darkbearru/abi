import { WorkerHost } from '@nestjs/bullmq';
import { AiSchemaValidationError } from '@abi/ai-core';
import { Prisma } from '@prisma/client';
import type { Job } from 'bullmq';

import type { PrismaService } from '../../prisma/prisma.service.js';
import type { QueueName } from './queue.constants.js';

const JOB_HEARTBEAT_MS = Number(process.env.JOB_HEARTBEAT_MS ?? 5000);

export abstract class TrackedQueueProcessor extends WorkerHost {
  protected constructor(
    protected readonly prisma: PrismaService,
    protected readonly queueName: QueueName
  ) {
    super();
  }

  async process(job: Job<Record<string, unknown>>): Promise<void> {
    const generationJobId = getGenerationJobId(job);

    await this.prisma.generationJob.update({
      where: { id: generationJobId },
      data: {
        status: 'PROCESSING',
        progress: 10,
        error: Prisma.JsonNull
      }
    });
    await job.updateProgress(10);

    const heartbeat = this.startHeartbeat(generationJobId);

    try {
      const output = await this.handle(job);

      await job.updateProgress(100);
      await this.prisma.generationJob.update({
        where: { id: generationJobId },
        data: {
          status: 'COMPLETED',
          progress: 100,
          error: Prisma.JsonNull,
          output: {
            queueName: this.queueName,
            bullJobId: String(job.id),
            completedAt: new Date().toISOString(),
            ...(output ?? {})
          } satisfies Prisma.InputJsonObject
        }
      });
    } catch (error) {
      if (error instanceof QueueJobCancelledError) {
        await this.prisma.generationJob.update({
          where: { id: generationJobId },
          data: {
            status: 'CANCELLED',
            output: {
              queueName: this.queueName,
              bullJobId: String(job.id),
              cancelledAt: new Date().toISOString()
            } satisfies Prisma.InputJsonObject
          }
        });

        return;
      }

      throw error;
    } finally {
      clearInterval(heartbeat);
    }
  }

  protected async handle(
    job: Job<Record<string, unknown>>
  ): Promise<Prisma.InputJsonObject | undefined> {
    await job.updateProgress(50);
    await this.prisma.generationJob.update({
      where: { id: getGenerationJobId(job) },
      data: {
        progress: 50
      }
    });

    throw new Error(
      `Queue processor "${this.queueName}" is registered but business handler is not implemented yet.`
    );
  }

  async handleFailed(job: Job<Record<string, unknown>>, error: Error): Promise<void> {
    const generationJobId = getGenerationJobId(job);
    const attempts = typeof job.opts.attempts === 'number' ? job.opts.attempts : 1;
    const deadLetter = job.attemptsMade >= attempts;

    await this.prisma.generationJob.update({
      where: { id: generationJobId },
      data: {
        status: deadLetter ? 'FAILED' : 'PROCESSING',
        error: {
          queueName: this.queueName,
          bullJobId: String(job.id),
          attemptsMade: job.attemptsMade,
          attempts,
          deadLetter,
          message: error.message,
          ...serializeErrorDetails(error)
        }
      }
    });
  }

  private startHeartbeat(generationJobId: string): NodeJS.Timeout {
    return setInterval(() => {
      void this.prisma.generationJob
        .updateMany({
          where: {
            id: generationJobId,
            status: { not: 'CANCELLED' }
          },
          data: { status: 'PROCESSING' }
        })
        .catch(() => undefined);
    }, JOB_HEARTBEAT_MS);
  }
}

export class QueueJobCancelledError extends Error {
  constructor(generationJobId: string) {
    super(`Queue job "${generationJobId}" was cancelled.`);
    this.name = 'QueueJobCancelledError';
  }
}

export async function assertQueueJobNotCancelled(
  prisma: PrismaService,
  generationJobId: string
): Promise<void> {
  const job = await prisma.generationJob.findUnique({
    where: { id: generationJobId },
    select: { status: true }
  });

  if (job?.status === 'CANCELLED') {
    throw new QueueJobCancelledError(generationJobId);
  }
}

function serializeErrorDetails(error: Error): Prisma.InputJsonObject {
  if (error instanceof AiSchemaValidationError) {
    return {
      issues: error.issues.map((issue) => ({
        path: issue.path.map(String),
        code: issue.code,
        message: issue.message
      }))
    };
  }

  return {};
}

function getGenerationJobId(job: Job<Record<string, unknown>>): string {
  const value = job.data.generationJobId;

  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`Queue job "${String(job.id)}" is missing generationJobId.`);
  }

  return value;
}
