import { AiProviderRegistry, MockAiProvider } from '@abi/ai-core';
import {
  CHARACTER_FACT_EXTRACTION_PROMPT,
  PromptRegistryService
} from '@abi/prompts';
import { describe, expect, it, vi } from 'vitest';

import type { PrismaService } from '../../prisma/prisma.service.js';
import { CharacterExtractionService } from './character-extraction.service.js';

const BOOK_ID = '11111111-1111-4111-8111-111111111111';
const ANALYSIS_ID = '22222222-2222-4222-8222-222222222222';
const CHUNK_ID = '33333333-3333-4333-8333-333333333333';

interface CreateManyPayload {
  readonly data: readonly {
    readonly bookId: string;
    readonly bookAnalysisId: string;
    readonly sourceChunkId: string;
    readonly entityName: string;
    readonly value: {
      readonly candidateNames?: readonly string[];
    };
  }[];
}

describe('CharacterExtractionService', () => {
  it('extracts character facts with a mock provider and saves intermediate candidates', async () => {
    const createMany = vi
      .fn<(payload: CreateManyPayload) => Promise<{ count: number }>>()
      .mockResolvedValue({ count: 2 });
    const deleteMany = vi.fn().mockResolvedValue({ count: 0 });
    const characterCreate = vi.fn();
    const prisma = {
      bookChunk: {
        findFirst: vi.fn().mockResolvedValue({
          id: CHUNK_ID,
          bookId: BOOK_ID,
          bookAnalysisId: ANALYSIS_ID,
          chapterIndex: 4,
          text: 'John looked at Johnny. Mr. Smith lowered his voice.'
        })
      },
      character: {
        create: characterCreate
      },
      extractedFact: {
        createMany,
        deleteMany
      },
      $transaction: vi.fn(async (callback: (tx: unknown) => Promise<void>) =>
        callback({
          extractedFact: {
            createMany,
            deleteMany
          }
        })
      )
    } as unknown as PrismaService;
    const provider = new MockAiProvider({
      id: 'mock',
      structuredResponses: [
        {
          facts: [
            {
              type: 'CHARACTER_MENTION',
              entityName: 'John',
              value: {
                summary: 'John appears in the scene.',
                candidateNames: ['John', 'Johnny', 'Mr. Smith']
              },
              confidence: 0.82,
              quote: 'John looked at Johnny.',
              timelineHint: 'chapter 4'
            },
            {
              type: 'CHARACTER_CANDIDATE',
              entityName: 'Mr. Smith',
              value: {
                summary: 'Mr. Smith may refer to the same person as John.',
                candidateNames: ['John', 'Johnny', 'Mr. Smith']
              },
              confidence: 0.64,
              quote: 'Mr. Smith lowered his voice.'
            }
          ]
        }
      ]
    });
    const service = new CharacterExtractionService(
      prisma,
      new AiProviderRegistry([provider], []),
      new PromptRegistryService([CHARACTER_FACT_EXTRACTION_PROMPT]),
      {
        providerId: 'mock',
        promptVersion: '1.0.0'
      }
    );

    const facts = await service.processChunk({
      bookId: BOOK_ID,
      analysisId: ANALYSIS_ID,
      chunkId: CHUNK_ID
    });

    expect(facts).toHaveLength(2);
    expect(facts[0]).toMatchObject({
      type: 'CHARACTER_MENTION',
      entityName: 'John',
      sourceChunkId: CHUNK_ID,
      chapterIndex: 4
    });
    const createManyPayload = createMany.mock.calls[0]?.[0];
    const johnFact = createManyPayload?.data.find((fact) => fact.entityName === 'John');

    expect(johnFact).toMatchObject({
      bookId: BOOK_ID,
      bookAnalysisId: ANALYSIS_ID,
      sourceChunkId: CHUNK_ID,
      entityName: 'John',
      value: {
        candidateNames: ['John', 'Johnny', 'Mr. Smith']
      }
    });
    expect(characterCreate).not.toHaveBeenCalled();
  });

  it('replaces previous facts for the same source chunk', async () => {
    const createMany = vi.fn().mockResolvedValue({ count: 0 });
    const deleteMany = vi.fn().mockResolvedValue({ count: 1 });
    const prisma = {
      bookChunk: {
        findFirst: vi.fn().mockResolvedValue({
          id: CHUNK_ID,
          bookId: BOOK_ID,
          bookAnalysisId: ANALYSIS_ID,
          chapterIndex: 1,
          text: 'No characters here.'
        })
      },
      extractedFact: {
        createMany,
        deleteMany
      },
      $transaction: vi.fn(async (callback: (tx: unknown) => Promise<void>) =>
        callback({
          extractedFact: {
            createMany,
            deleteMany
          }
        })
      )
    } as unknown as PrismaService;
    const service = new CharacterExtractionService(
      prisma,
      new AiProviderRegistry([
        new MockAiProvider({
          id: 'mock',
          structuredResponses: [{ facts: [] }]
        })
      ]),
      new PromptRegistryService([CHARACTER_FACT_EXTRACTION_PROMPT]),
      {
        providerId: 'mock',
        promptVersion: '1.0.0'
      }
    );

    await expect(
      service.processChunk({
        bookId: BOOK_ID,
        analysisId: ANALYSIS_ID,
        chunkId: CHUNK_ID
      })
    ).resolves.toEqual([]);
    expect(deleteMany).toHaveBeenCalledWith({
      where: {
        bookAnalysisId: ANALYSIS_ID,
        sourceChunkId: CHUNK_ID,
        type: {
          in: [
            'CHARACTER_MENTION',
            'CHARACTER_ALIAS',
            'CHARACTER_APPEARANCE',
            'CHARACTER_AGE',
            'CHARACTER_PERSONALITY',
            'CHARACTER_SPEECH_MANNER',
            'CHARACTER_RELATIONSHIP',
            'CHARACTER_PLOT_CHANGE',
            'CHARACTER_CANDIDATE'
          ]
        }
      }
    });
    expect(createMany).not.toHaveBeenCalled();
  });
});
