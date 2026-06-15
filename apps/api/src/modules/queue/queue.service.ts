import type { Prisma } from '@prisma/client';
import { InjectQueue } from '@nestjs/bullmq';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
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

@Injectable()
export class QueueService {
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

  async createJob(input: CreateQueueJobInput): Promise<QueueJobResponse> {
    if (input.projectId === undefined && input.userId === undefined) {
      throw new BadRequestException('Queue jobs must include projectId or userId.');
    }

    const generationJob = await this.prisma.generationJob.create({
      data: {
        ...(input.projectId === undefined ? {} : { projectId: input.projectId }),
        ...(input.userId === undefined ? {} : { userId: input.userId }),
        ...(input.sceneId === undefined ? {} : { sceneId: input.sceneId }),
        ...(input.bookAnalysisId === undefined ? {} : { bookAnalysisId: input.bookAnalysisId }),
        ...(input.visualStyleId === undefined ? {} : { visualStyleId: input.visualStyleId }),
        status: 'QUEUED',
        progress: 0,
        input: {
          queueName: input.queueName,
          name: input.name,
          payload: input.payload as Prisma.InputJsonObject,
          attempts: DEFAULT_JOB_ATTEMPTS
        }
      }
    });

    try {
      await this.queues[input.queueName].add(
        input.name,
        {
          ...input.payload,
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

  getQueueNames(): readonly QueueName[] {
    return QUEUE_NAMES;
  }
}
