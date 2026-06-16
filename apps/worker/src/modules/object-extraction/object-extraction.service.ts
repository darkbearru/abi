import { randomUUID } from 'node:crypto';

import { AiProviderRegistry } from '@abi/ai-core';
import { OBJECT_FACT_EXTRACTION_PROMPT_ID, PromptRegistryService } from '@abi/prompts';
import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service.js';
import {
  OBJECT_EXTRACTION_CONFIG,
  type ObjectExtractionConfig
} from './object-extraction.config.js';
import {
  ObjectExtractionResponseSchema,
  type ExtractedObjectFact,
  type ObjectExtractionResponse
} from './object-extraction.schema.js';
import type {
  ObjectExtractionJobInput,
  SavedObjectExtractedFact
} from './object-extraction.types.js';

const OBJECT_FACT_TYPES = [
  'OBJECT_MENTION',
  'OBJECT_ALIAS',
  'OBJECT_APPEARANCE',
  'OBJECT_FUNCTION',
  'OBJECT_OWNER',
  'OBJECT_LOCATION',
  'OBJECT_SYMBOLISM',
  'OBJECT_CHANGE',
  'OBJECT_CANDIDATE'
] as const;

interface SourceChunk {
  readonly id: string;
  readonly chapterIndex: number;
  readonly text: string;
}

@Injectable()
export class ObjectExtractionService {
  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
    @Inject(AiProviderRegistry)
    private readonly aiProviders: AiProviderRegistry,
    @Inject(PromptRegistryService)
    private readonly prompts: PromptRegistryService,
    @Inject(OBJECT_EXTRACTION_CONFIG)
    private readonly config: ObjectExtractionConfig
  ) {}

  async processChunk(
    input: ObjectExtractionJobInput
  ): Promise<readonly SavedObjectExtractedFact[]> {
    const chunk = await this.getChunk(input);
    const prompt = this.prompts.render(
      OBJECT_FACT_EXTRACTION_PROMPT_ID,
      {
        bookId: input.bookId,
        analysisId: input.analysisId,
        chunkId: input.chunkId,
        chapterIndex: chunk.chapterIndex,
        chunkText: chunk.text
      },
      this.config.promptVersion
    );
    const extracted = await this.aiProviders.extractStructuredData<ObjectExtractionResponse>(
      this.config.providerId,
      {
        prompt,
        schema: ObjectExtractionResponseSchema,
        metadata: {
          bookId: input.bookId,
          bookAnalysisId: input.analysisId,
          purpose: 'object-fact-extraction',
          tags: ['object-extraction', 'intermediate-facts']
        }
      }
    );
    const facts = extracted.facts.map((fact) => this.toCreateInput(input, chunk, fact));

    await this.prisma.$transaction(async (tx) => {
      await tx.extractedFact.deleteMany({
        where: {
          bookAnalysisId: input.analysisId,
          sourceChunkId: input.chunkId,
          type: {
            in: [...OBJECT_FACT_TYPES]
          }
        }
      });

      if (facts.length > 0) {
        await tx.extractedFact.createMany({ data: facts });
      }
    });

    return facts.map((fact) => {
      const quote = typeof fact.quote === 'string' ? fact.quote : undefined;
      const timelineHint = typeof fact.timelineHint === 'string' ? fact.timelineHint : undefined;

      return {
        type: fact.type,
        entityName: fact.entityName,
        sourceChunkId: fact.sourceChunkId,
        confidence: fact.confidence,
        ...(quote === undefined ? {} : { quote }),
        chapterIndex: fact.chapterIndex,
        ...(timelineHint === undefined ? {} : { timelineHint })
      };
    });
  }

  private async getChunk(input: ObjectExtractionJobInput): Promise<SourceChunk> {
    const chunk = await this.prisma.bookChunk.findFirst({
      where: {
        id: input.chunkId,
        bookId: input.bookId,
        bookAnalysisId: input.analysisId
      },
      select: {
        id: true,
        chapterIndex: true,
        text: true
      }
    });

    if (!chunk) {
      throw new NotFoundException('Book chunk was not found for object extraction.');
    }

    return chunk;
  }

  private toCreateInput(
    input: ObjectExtractionJobInput,
    chunk: SourceChunk,
    fact: ExtractedObjectFact
  ): Prisma.ExtractedFactCreateManyInput {
    return {
      id: randomUUID(),
      bookId: input.bookId,
      bookAnalysisId: input.analysisId,
      type: fact.type,
      entityName: fact.entityName,
      value: toInputJsonObject({
        ...fact.value,
        candidateNames: fact.value.candidateNames ?? []
      }),
      sourceChunkId: chunk.id,
      confidence: fact.confidence,
      ...(fact.quote === undefined ? {} : { quote: fact.quote }),
      chapterIndex: chunk.chapterIndex,
      ...(fact.timelineHint === undefined ? {} : { timelineHint: fact.timelineHint })
    };
  }
}

function toInputJsonObject(value: Record<string, unknown>): Prisma.InputJsonObject {
  return Object.fromEntries(
    Object.entries(value).filter((entry): entry is [string, Prisma.InputJsonValue] =>
      isInputJsonValue(entry[1])
    )
  );
}

function isInputJsonValue(value: unknown): value is Prisma.InputJsonValue {
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return true;
  }

  if (Array.isArray(value)) {
    return value.every(isInputJsonValue);
  }

  if (value && typeof value === 'object') {
    return Object.values(value).every(isInputJsonValue);
  }

  return false;
}
