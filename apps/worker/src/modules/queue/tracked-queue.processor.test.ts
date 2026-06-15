import type { Job } from 'bullmq';
import { describe, expect, it, vi } from 'vitest';

import type { PrismaService } from '../../prisma/prisma.service.js';
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
});
