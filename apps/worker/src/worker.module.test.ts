import { Test } from '@nestjs/testing';
import { describe, expect, it } from 'vitest';

import { WorkerModule } from './worker.module.js';

describe('WorkerModule', () => {
  it('compiles', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [WorkerModule]
    }).compile();

    expect(moduleRef).toBeDefined();
  });
});
