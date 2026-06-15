import { AiProviderRegistry, MockAiProvider } from '@abi/ai-core';
import { LOCATION_FACT_EXTRACTION_PROMPT, PromptRegistryService } from '@abi/prompts';
import { describe, expect, it, vi } from 'vitest';

import type { PrismaService } from '../../prisma/prisma.service.js';
import { LocationExtractionService } from './location-extraction.service.js';

const BOOK_ID = '11111111-1111-4111-8111-111111111111';
const ANALYSIS_ID = '22222222-2222-4222-8222-222222222222';
const CHUNK_ID = '33333333-3333-4333-8333-333333333333';

interface CreateManyPayload {
  readonly data: readonly {
    readonly entityName: string;
    readonly value: {
      readonly parentName?: string;
      readonly recurringObjects?: readonly string[];
    };
  }[];
}

describe('LocationExtractionService', () => {
  it('extracts location facts and preserves hierarchy candidates', async () => {
    const createMany = vi
      .fn<(payload: CreateManyPayload) => Promise<{ count: number }>>()
      .mockResolvedValue({ count: 2 });
    const deleteMany = vi.fn().mockResolvedValue({ count: 0 });
    const prisma = {
      bookChunk: {
        findFirst: vi.fn().mockResolvedValue({
          id: CHUNK_ID,
          chapterIndex: 2,
          text: 'In Old City, the park fountain glowed under green lamps.'
        })
      },
      extractedFact: { createMany, deleteMany },
      $transaction: vi.fn(async (callback: (tx: unknown) => Promise<void>) =>
        callback({ extractedFact: { createMany, deleteMany } })
      )
    } as unknown as PrismaService;
    const provider = new MockAiProvider({
      id: 'mock',
      structuredResponses: [
        {
          facts: [
            {
              type: 'LOCATION_MENTION',
              entityName: 'Old City',
              value: {
                summary: 'Old City contains the park.',
                locationKind: 'city'
              },
              confidence: 0.9,
              quote: 'In Old City'
            },
            {
              type: 'LOCATION_HIERARCHY',
              entityName: 'Fountain',
              value: {
                summary: 'The fountain is inside the park.',
                parentName: 'Park',
                recurringObjects: ['green lamps']
              },
              confidence: 0.8,
              quote: 'the park fountain glowed'
            }
          ]
        }
      ]
    });
    const service = new LocationExtractionService(
      prisma,
      new AiProviderRegistry([provider], []),
      new PromptRegistryService([LOCATION_FACT_EXTRACTION_PROMPT]),
      { providerId: 'mock', promptVersion: '1.0.0' }
    );

    const facts = await service.processChunk({
      bookId: BOOK_ID,
      analysisId: ANALYSIS_ID,
      chunkId: CHUNK_ID
    });

    expect(facts).toHaveLength(2);
    const createManyPayload = createMany.mock.calls[0]?.[0];
    const fountainFact = createManyPayload?.data.find(
      (fact) => fact.entityName === 'Fountain'
    );

    expect(fountainFact?.value.parentName).toBe('Park');
    expect(fountainFact?.value.recurringObjects).toEqual(['green lamps']);
  });
});
