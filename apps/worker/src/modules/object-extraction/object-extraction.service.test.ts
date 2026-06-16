import { AiProviderRegistry, MockAiProvider } from '@abi/ai-core';
import { OBJECT_FACT_EXTRACTION_PROMPT, PromptRegistryService } from '@abi/prompts';
import { describe, expect, it, vi } from 'vitest';

import type { PrismaService } from '../../prisma/prisma.service.js';
import { ObjectExtractionService } from './object-extraction.service.js';

const BOOK_ID = '11111111-1111-4111-8111-111111111111';
const ANALYSIS_ID = '22222222-2222-4222-8222-222222222222';
const CHUNK_ID = '33333333-3333-4333-8333-333333333333';

interface CreateManyPayload {
  readonly data: readonly {
    readonly entityName: string;
    readonly value: {
      readonly candidateNames?: readonly string[];
      readonly objectKind?: string;
      readonly ownerName?: string;
      readonly locationName?: string;
    };
  }[];
}

describe('ObjectExtractionService', () => {
  it('extracts object facts without treating locations as objects', async () => {
    const createMany = vi
      .fn<(payload: CreateManyPayload) => Promise<{ count: number }>>()
      .mockResolvedValue({ count: 1 });
    const deleteMany = vi.fn().mockResolvedValue({ count: 0 });
    const prisma = {
      bookChunk: {
        findFirst: vi.fn().mockResolvedValue({
          id: CHUNK_ID,
          chapterIndex: 3,
          text: 'Mira hid the brass key inside the tower room.'
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
              type: 'OBJECT_MENTION',
              entityName: 'brass key',
              value: {
                summary: 'Mira hides the brass key.',
                objectKind: 'key',
                ownerName: 'Mira',
                locationName: 'tower room'
              },
              confidence: 0.88,
              quote: 'the brass key'
            }
          ]
        }
      ]
    });
    const service = new ObjectExtractionService(
      prisma,
      new AiProviderRegistry([provider], []),
      new PromptRegistryService([OBJECT_FACT_EXTRACTION_PROMPT]),
      { providerId: 'mock', promptVersion: '1.0.0' }
    );

    const facts = await service.processChunk({
      bookId: BOOK_ID,
      analysisId: ANALYSIS_ID,
      chunkId: CHUNK_ID
    });

    expect(facts).toHaveLength(1);
    const createManyPayload = createMany.mock.calls[0]?.[0];
    const keyFact = createManyPayload?.data.find((fact) => fact.entityName === 'brass key');

    expect(keyFact?.value).toMatchObject({
      objectKind: 'key',
      ownerName: 'Mira',
      locationName: 'tower room',
      candidateNames: []
    });
  });
});
