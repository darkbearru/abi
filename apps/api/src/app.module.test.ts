import { Test } from '@nestjs/testing';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@nestjs/bullmq', async () => {
  const common = await import('@nestjs/common');

  class MockBullModule {}

  return {
    BullModule: {
      forRoot: () => ({
        module: MockBullModule
      }),
      registerQueue: () => ({
        module: MockBullModule,
        providers: [
          {
            provide: 'MOCK_QUEUE',
            useValue: {
              add: vi.fn()
            }
          }
        ],
        exports: ['MOCK_QUEUE']
      })
    },
    InjectQueue: () => common.Inject('MOCK_QUEUE')
  };
});

import { AppModule } from './app.module.js';

describe('AppModule', () => {
  it('compiles', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule]
    }).compile();

    expect(moduleRef).toBeDefined();
  });
});
