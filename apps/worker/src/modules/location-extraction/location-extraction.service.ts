import { randomUUID } from 'node:crypto';

import { AiProviderRegistry } from '@abi/ai-core';
import { LOCATION_FACT_EXTRACTION_PROMPT_ID, PromptRegistryService } from '@abi/prompts';
import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service.js';
import {
  LOCATION_EXTRACTION_CONFIG,
  type LocationExtractionConfig
} from './location-extraction.config.js';
import {
  LocationExtractionResponseSchema,
  type ExtractedLocationFact,
  type LocationExtractionResponse
} from './location-extraction.schema.js';
import type {
  LocationExtractionJobInput,
  SavedLocationExtractedFact
} from './location-extraction.types.js';

const LOCATION_FACT_TYPES = [
  'LOCATION_MENTION',
  'LOCATION_ALIAS',
  'LOCATION_HIERARCHY',
  'LOCATION_ATMOSPHERE',
  'LOCATION_ARCHITECTURE',
  'LOCATION_ERA',
  'LOCATION_SOCIAL_CONTEXT',
  'LOCATION_LIGHTING',
  'LOCATION_COLOR',
  'LOCATION_RECURRING_OBJECT',
  'LOCATION_CHANGE',
  'LOCATION_CANDIDATE'
] as const;

interface SourceChunk {
  readonly id: string;
  readonly chapterIndex: number;
  readonly text: string;
}

@Injectable()
export class LocationExtractionService {
  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
    @Inject(AiProviderRegistry)
    private readonly aiProviders: AiProviderRegistry,
    @Inject(PromptRegistryService)
    private readonly prompts: PromptRegistryService,
    @Inject(LOCATION_EXTRACTION_CONFIG)
    private readonly config: LocationExtractionConfig
  ) {}

  async processChunk(
    input: LocationExtractionJobInput
  ): Promise<readonly SavedLocationExtractedFact[]> {
    const chunk = await this.getChunk(input);
    const prompt = this.prompts.render(
      LOCATION_FACT_EXTRACTION_PROMPT_ID,
      {
        bookId: input.bookId,
        analysisId: input.analysisId,
        chunkId: input.chunkId,
        chapterIndex: chunk.chapterIndex,
        chunkText: chunk.text
      },
      this.config.promptVersion
    );
    const extracted = await this.aiProviders.extractStructuredData<LocationExtractionResponse>(
      this.config.providerId,
      {
        prompt,
        schema: LocationExtractionResponseSchema,
        metadata: {
          bookId: input.bookId,
          bookAnalysisId: input.analysisId,
          purpose: 'location-fact-extraction',
          tags: ['location-extraction', 'intermediate-facts']
        }
      }
    );
    const facts = extracted.facts.map((fact) =>
      this.toCreateInput(input, chunk, fact)
    );

    await this.prisma.$transaction(async (tx) => {
      await tx.extractedFact.deleteMany({
        where: {
          bookAnalysisId: input.analysisId,
          sourceChunkId: input.chunkId,
          type: {
            in: [...LOCATION_FACT_TYPES]
          }
        }
      });

      if (facts.length > 0) {
        await tx.extractedFact.createMany({ data: facts });
      }
    });

    return facts.map((fact) => {
      const quote = typeof fact.quote === 'string' ? fact.quote : undefined;
      const timelineHint =
        typeof fact.timelineHint === 'string' ? fact.timelineHint : undefined;

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

  private async getChunk(input: LocationExtractionJobInput): Promise<SourceChunk> {
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
      throw new NotFoundException('Book chunk was not found for location extraction.');
    }

    return chunk;
  }

  private toCreateInput(
    input: LocationExtractionJobInput,
    chunk: SourceChunk,
    fact: ExtractedLocationFact
  ): Prisma.ExtractedFactCreateManyInput {
    return {
      id: randomUUID(),
      bookId: input.bookId,
      bookAnalysisId: input.analysisId,
      type: fact.type,
      entityName: fact.entityName,
      value: toInputJsonObject({
        ...fact.value,
        candidateNames: fact.value.candidateNames ?? [],
        colors: fact.value.colors ?? [],
        recurringObjects: fact.value.recurringObjects ?? []
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
  if (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
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
