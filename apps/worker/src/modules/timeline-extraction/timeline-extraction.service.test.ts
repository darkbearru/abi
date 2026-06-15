import { AiProviderRegistry, MockAiProvider } from '@abi/ai-core';
import { PromptRegistryService, TIMELINE_FACT_EXTRACTION_PROMPT } from '@abi/prompts';
import { describe, expect, it, vi } from 'vitest';

import type { PrismaService } from '../../prisma/prisma.service.js';
import { TimelineExtractionService } from './timeline-extraction.service.js';

const BOOK_ID = '11111111-1111-4111-8111-111111111111';
const ANALYSIS_ID = '22222222-2222-4222-8222-222222222222';
const CHUNK_ID = '33333333-3333-4333-8333-333333333333';

interface CreateManyPayload {
  readonly data: readonly {
    readonly entityName: string;
    readonly value: {
      readonly relativeMarker?: string;
      readonly relativeOrderHint?: string;
      readonly characterNames?: readonly string[];
    };
  }[];
}

describe('TimelineExtractionService', () => {
  it('extracts timeline facts with relative markers', async () => {
    const createMany = vi
      .fn<(payload: CreateManyPayload) => Promise<{ count: number }>>()
      .mockResolvedValue({ count: 1 });
    const deleteMany = vi.fn().mockResolvedValue({ count: 0 });
    const prisma = {
      bookChunk: {
        findFirst: vi.fn().mockResolvedValue({
          id: CHUNK_ID,
          chapterIndex: 4,
          text: 'The next day, Mara returned to the square.'
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
              type: 'TIMELINE_EVENT',
              entityName: 'Mara returns to the square',
              value: {
                title: 'Mara returns to the square',
                description: 'Mara returns to the square on the next day.',
                relativeMarker: 'the next day',
                relativeOrderHint: 'next_day',
                characterNames: ['Mara'],
                locationNames: ['square']
              },
              confidence: 0.87,
              quote: 'The next day, Mara returned to the square.',
              timelineHint: 'the next day'
            }
          ]
        }
      ]
    });
    const service = new TimelineExtractionService(
      prisma,
      new AiProviderRegistry([provider], []),
      new PromptRegistryService([TIMELINE_FACT_EXTRACTION_PROMPT]),
      { providerId: 'mock', promptVersion: '1.0.0' }
    );

    const facts = await service.processChunk({
      bookId: BOOK_ID,
      analysisId: ANALYSIS_ID,
      chunkId: CHUNK_ID
    });

    expect(facts).toHaveLength(1);
    const savedFact = createMany.mock.calls[0]?.[0].data[0];

    expect(savedFact?.value.relativeMarker).toBe('the next day');
    expect(savedFact?.value.relativeOrderHint).toBe('next_day');
    expect(savedFact?.value.characterNames).toEqual(['Mara']);
  });
});
