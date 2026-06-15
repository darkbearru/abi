import { Test } from '@nestjs/testing';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@nestjs/bullmq', async () => {
  const common = await import('@nestjs/common');

  class MockBullModule {}
  class MockWorkerHost {}

  return {
    BullModule: {
      forRoot: () => ({
        module: MockBullModule
      }),
      registerQueue: () => ({
        module: MockBullModule
      })
    },
    OnWorkerEvent: () => () => undefined,
    Processor: () => common.Injectable(),
    WorkerHost: MockWorkerHost
  };
});

import { WorkerModule } from './worker.module.js';

describe('WorkerModule', () => {
  it('compiles', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [WorkerModule]
    }).compile();

    expect(moduleRef).toBeDefined();
  });
});
