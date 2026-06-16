import { randomUUID } from 'node:crypto';

import { AiProviderRegistry } from '@abi/ai-core';
import { CHARACTER_FACT_EXTRACTION_PROMPT_ID, PromptRegistryService } from '@abi/prompts';
import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service.js';
import {
  CHARACTER_EXTRACTION_CONFIG,
  type CharacterExtractionConfig
} from './character-extraction.config.js';
import {
  CharacterExtractionResponseSchema,
  type CharacterExtractionResponse,
  type ExtractedCharacterFact
} from './character-extraction.schema.js';
import type {
  CharacterExtractionJobInput,
  SavedExtractedFact
} from './character-extraction.types.js';

interface SourceChunk {
  readonly id: string;
  readonly bookId: string;
  readonly bookAnalysisId: string | null;
  readonly chapterIndex: number;
  readonly text: string;
}

const CHARACTER_FACT_TYPES = [
  'CHARACTER_MENTION',
  'CHARACTER_ALIAS',
  'CHARACTER_APPEARANCE',
  'CHARACTER_AGE',
  'CHARACTER_PERSONALITY',
  'CHARACTER_SPEECH_MANNER',
  'CHARACTER_RELATIONSHIP',
  'CHARACTER_PLOT_CHANGE',
  'CHARACTER_CANDIDATE'
] as const;

@Injectable()
export class CharacterExtractionService {
  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
    @Inject(AiProviderRegistry)
    private readonly aiProviders: AiProviderRegistry,
    @Inject(PromptRegistryService)
    private readonly prompts: PromptRegistryService,
    @Inject(CHARACTER_EXTRACTION_CONFIG)
    private readonly config: CharacterExtractionConfig
  ) {}

  async processChunk(input: CharacterExtractionJobInput): Promise<readonly SavedExtractedFact[]> {
    const chunk = await this.getChunk(input);
    const prompt = this.prompts.render(
      CHARACTER_FACT_EXTRACTION_PROMPT_ID,
      {
        bookId: input.bookId,
        analysisId: input.analysisId,
        chunkId: input.chunkId,
        chapterIndex: chunk.chapterIndex,
        chunkText: chunk.text
      },
      this.config.promptVersion
    );
    const extracted = await this.aiProviders.extractStructuredData<CharacterExtractionResponse>(
      this.config.providerId,
      {
        prompt,
        schema: CharacterExtractionResponseSchema,
        metadata: {
          bookId: input.bookId,
          bookAnalysisId: input.analysisId,
          purpose: 'character-fact-extraction',
          tags: ['character-extraction', 'intermediate-facts']
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
            in: [...CHARACTER_FACT_TYPES]
          }
        }
      });

      if (facts.length === 0) {
        return;
      }

      await tx.extractedFact.createMany({
        data: facts
      });
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

  private async getChunk(input: CharacterExtractionJobInput): Promise<SourceChunk> {
    const chunk = await this.prisma.bookChunk.findFirst({
      where: {
        id: input.chunkId,
        bookId: input.bookId,
        bookAnalysisId: input.analysisId
      },
      select: {
        id: true,
        bookId: true,
        bookAnalysisId: true,
        chapterIndex: true,
        text: true
      }
    });

    if (!chunk) {
      throw new NotFoundException('Book chunk was not found for character extraction.');
    }

    return chunk;
  }

  private toCreateInput(
    input: CharacterExtractionJobInput,
    chunk: SourceChunk,
    fact: ExtractedCharacterFact
  ): Prisma.ExtractedFactCreateManyInput {
    const value = {
      ...fact.value,
      candidateNames: fact.value.candidateNames ?? []
    };

    return {
      id: randomUUID(),
      bookId: input.bookId,
      bookAnalysisId: input.analysisId,
      type: fact.type,
      entityName: fact.entityName,
      value,
      sourceChunkId: chunk.id,
      confidence: fact.confidence,
      ...(fact.quote === undefined ? {} : { quote: fact.quote }),
      chapterIndex: chunk.chapterIndex,
      ...(fact.timelineHint === undefined ? {} : { timelineHint: fact.timelineHint })
    };
  }
}
