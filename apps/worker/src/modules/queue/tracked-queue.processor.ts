import { WorkerHost } from '@nestjs/bullmq';
import type { Prisma } from '@prisma/client';
import type { Job } from 'bullmq';

import type { PrismaService } from '../../prisma/prisma.service.js';
import type { QueueName } from './queue.constants.js';

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
        progress: 10
      }
    });
    await job.updateProgress(10);

    const output = await this.handle(job);

    await job.updateProgress(100);
    await this.prisma.generationJob.update({
      where: { id: generationJobId },
      data: {
        status: 'COMPLETED',
        progress: 100,
        output: {
          queueName: this.queueName,
          bullJobId: String(job.id),
          completedAt: new Date().toISOString(),
          ...(output ?? {})
        } satisfies Prisma.InputJsonObject
      }
    });
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
          message: error.message
        }
      }
    });
  }
}

function getGenerationJobId(job: Job<Record<string, unknown>>): string {
  const value = job.data.generationJobId;

  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`Queue job "${String(job.id)}" is missing generationJobId.`);
  }

  return value;
}
