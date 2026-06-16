import type { Job } from 'bullmq';
import { describe, expect, it, vi } from 'vitest';

import type { PrismaService } from '../../prisma/prisma.service.js';
import { ImageGenerationProcessor } from './queue.processors.js';
import { TrackedQueueProcessor } from './tracked-queue.processor.js';

class TestProcessor extends TrackedQueueProcessor {
  constructor(prisma: PrismaService) {
    super(prisma, 'book-analysis');
  }
}

interface GenerationJobUpdatePayload {
  readonly where?: { readonly id?: string };
  readonly data?: {
    readonly status?: string;
    readonly error?: { readonly deadLetter?: boolean; readonly message?: string };
  };
}

describe('TrackedQueueProcessor', () => {
  it('does not mark jobs completed when business handler is not implemented', async () => {
    const update = vi.fn().mockResolvedValue({});
    const processor = new TestProcessor({
      generationJob: { update }
    } as unknown as PrismaService);
    const job = {
      id: 'bull-job-1',
      data: { generationJobId: 'job-1' },
      updateProgress: vi.fn().mockResolvedValue(undefined)
    } as unknown as Job<Record<string, unknown>>;

    await expect(processor.process(job)).rejects.toThrow('business handler is not implemented');
    const updatePayloads = update.mock.calls.map(
      (call): GenerationJobUpdatePayload | undefined => call[0] as GenerationJobUpdatePayload | undefined
    );

    expect(updatePayloads.some((payload) => payload?.data?.status === 'COMPLETED')).toBe(false);
  });

  it('marks exhausted failures as dead-letter failures', async () => {
    const update = vi.fn().mockResolvedValue({});
    const processor = new TestProcessor({
      generationJob: { update }
    } as unknown as PrismaService);
    const job = {
      id: 'bull-job-1',
      data: { generationJobId: 'job-1' },
      attemptsMade: 3,
      opts: { attempts: 3 }
    } as unknown as Job<Record<string, unknown>>;

    await processor.handleFailed(job, new Error('failed'));
    expect(update).toHaveBeenCalledOnce();

    const updatePayload = update.mock.calls[0]?.[0] as GenerationJobUpdatePayload | undefined;

    expect(updatePayload?.where?.id).toBe('job-1');
    expect(updatePayload?.data?.status).toBe('FAILED');
    expect(updatePayload?.data?.error).toMatchObject({
      deadLetter: true,
      message: 'failed'
    });
  });

  it('creates a scene asset for image-generation jobs', async () => {
    const update = vi.fn().mockResolvedValue({});
    const createGenerationJob = vi.fn().mockResolvedValue({ id: 'validation-job-1' });
    const createAsset = vi.fn().mockResolvedValue({ id: 'asset-1' });
    const updateScene = vi.fn().mockResolvedValue({});
    const processor = new ImageGenerationProcessor(
      {
        generationJob: { update, create: createGenerationJob },
        asset: { create: createAsset },
        scene: { update: updateScene },
        userBookProject: {
          findUnique: vi.fn().mockResolvedValue({ userId: 'user-1' })
        }
      } as unknown as PrismaService,
      {
        generateImage: vi.fn().mockResolvedValue({
          providerId: 'mock-image',
          model: 'mock-model',
          images: [
            {
              b64Json: Buffer.from('image-bytes').toString('base64'),
              mimeType: 'image/png',
              width: 32,
              height: 32
            }
          ]
        })
      } as never,
      {
        putObject: vi.fn().mockResolvedValue({
          key: 'scenes/scene-1/image.png'
        })
      } as never,
      {
        add: vi.fn().mockResolvedValue({ id: 'validation-job-1' })
      } as never
    );
    const job = {
      id: 'bull-job-1',
      data: {
        generationJobId: 'job-1',
        sceneId: 'scene-1',
        projectId: 'project-1',
        prompt: 'A scene prompt',
        providerId: 'mock',
        referenceAssetIds: ['asset-ref-1']
      },
      updateProgress: vi.fn().mockResolvedValue(undefined)
    } as unknown as Job<Record<string, unknown>>;

    await expect(processor.process(job)).resolves.toBeUndefined();
    const createPayload = createAsset.mock.calls[0]?.[0] as
      | { readonly data?: Record<string, unknown> }
      | undefined;

    expect(createPayload?.data).toMatchObject({
      projectId: 'project-1',
      sceneId: 'scene-1',
      jobId: 'job-1',
      localPath: 'scenes/scene-1/image.png',
      provider: 'mock-image',
      entityType: 'SCENE',
      entityId: 'scene-1'
    });
    expect(updateScene).toHaveBeenCalledWith({
      where: { id: 'scene-1' },
      data: { status: 'COMPLETED' }
    });
  });
});
