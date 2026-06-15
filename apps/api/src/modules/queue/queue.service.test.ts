import { describe, expect, it, vi } from 'vitest';

import { QueueService } from './queue.service.js';

describe('QueueService', () => {
  it('creates a tracked generation job and enqueues BullMQ job', async () => {
    const add = vi.fn().mockResolvedValue(undefined);
    const prisma = {
      generationJob: {
        create: vi.fn().mockResolvedValue({
          id: 'job-1',
          projectId: 'project-1',
          userId: 'user-1',
          sceneId: null,
          bookAnalysisId: null,
          status: 'QUEUED',
          progress: 0,
          input: {
            queueName: 'image-generation',
            name: 'generate-scene',
            payload: { sceneId: 'scene-1' },
            attempts: 3
          },
          output: null,
          error: null,
          createdAt: new Date('2026-06-15T00:00:00.000Z'),
          updatedAt: new Date('2026-06-15T00:00:00.000Z')
        })
      }
    };
    const service = new QueueService(
      { add } as never,
      { add } as never,
      { add } as never,
      { add } as never,
      { add } as never,
      { add } as never,
      { add } as never,
      prisma as never
    );

    await expect(
      service.createJob({
        queueName: 'image-generation',
        name: 'generate-scene',
        projectId: 'project-1',
        userId: 'user-1',
        payload: { sceneId: 'scene-1' }
      })
    ).resolves.toMatchObject({
      id: 'job-1',
      queueName: 'image-generation',
      name: 'generate-scene',
      status: 'QUEUED',
      progress: 0
    });
    expect(add).toHaveBeenCalledWith(
      'generate-scene',
      { sceneId: 'scene-1', generationJobId: 'job-1' },
      expect.objectContaining({
        attempts: 3,
        jobId: 'job-1',
        removeOnFail: false
      })
    );
  });

  it('marks tracked job as failed when BullMQ enqueue fails', async () => {
    const add = vi.fn().mockRejectedValue(new Error('Redis unavailable'));
    const update = vi.fn().mockResolvedValue({});
    const prisma = {
      generationJob: {
        create: vi.fn().mockResolvedValue({
          id: 'job-1',
          projectId: 'project-1',
          userId: 'user-1',
          sceneId: null,
          bookAnalysisId: null,
          status: 'QUEUED',
          progress: 0,
          input: {
            queueName: 'book-analysis',
            name: 'analyze-book',
            payload: { bookId: 'book-1' },
            attempts: 3
          },
          output: null,
          error: null,
          createdAt: new Date('2026-06-15T00:00:00.000Z'),
          updatedAt: new Date('2026-06-15T00:00:00.000Z')
        }),
        update
      }
    };
    const service = new QueueService(
      { add } as never,
      { add } as never,
      { add } as never,
      { add } as never,
      { add } as never,
      { add } as never,
      { add } as never,
      prisma as never
    );

    await expect(
      service.createJob({
        queueName: 'book-analysis',
        name: 'analyze-book',
        projectId: 'project-1',
        userId: 'user-1',
        payload: { bookId: 'book-1' }
      })
    ).rejects.toThrow('Redis unavailable');
    expect(update).toHaveBeenCalledOnce();

    const updatePayload = update.mock.calls[0]?.[0] as
      | {
          readonly where?: { readonly id?: string };
          readonly data?: {
            readonly status?: string;
            readonly error?: { readonly stage?: string; readonly message?: string };
          };
        }
      | undefined;

    expect(updatePayload?.where?.id).toBe('job-1');
    expect(updatePayload?.data?.status).toBe('FAILED');
    expect(updatePayload?.data?.error).toMatchObject({
      stage: 'enqueue',
      message: 'Redis unavailable'
    });
  });

  it('rejects ownerless jobs', async () => {
    const add = vi.fn().mockResolvedValue(undefined);
    const prisma = {
      generationJob: {
        create: vi.fn()
      }
    };
    const service = new QueueService(
      { add } as never,
      { add } as never,
      { add } as never,
      { add } as never,
      { add } as never,
      { add } as never,
      { add } as never,
      prisma as never
    );

    await expect(
      service.createJob({
        queueName: 'book-analysis',
        name: 'analyze-book',
        payload: { bookId: 'book-1' }
      })
    ).rejects.toThrow('Queue jobs must include projectId or userId.');
    expect(prisma.generationJob.create).not.toHaveBeenCalled();
  });
});
