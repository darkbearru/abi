import { AiProviderRegistry } from '@abi/ai-core';
import { Injectable } from '@nestjs/common';
import { z } from 'zod';

import {
  RecommendedActionDto,
  ValidationCheckTypeDto,
  type ValidationResultDto
} from './dto/consistency-validation.dto.js';
import {
  aggregateValidationChecks,
  type ImageValidationProvider,
  type ImageValidationRequest,
  roundScore
} from './ports/image-validation.provider.js';

const validationCheckSchema = z.object({
  type: z.nativeEnum(ValidationCheckTypeDto),
  entityId: z.string().nullable().optional(),
  passed: z.boolean(),
  score: z.number().min(0).max(1),
  message: z.string().min(1)
});

const validationResultSchema = z.object({
  passed: z.boolean().optional(),
  score: z.number().min(0).max(1).optional(),
  checks: z.array(validationCheckSchema).min(1),
  recommendedAction: z.nativeEnum(RecommendedActionDto).optional()
});

@Injectable()
export class LlmVisionValidationProvider implements ImageValidationProvider {
  readonly id = 'llm-vision';

  constructor(private readonly aiProviders: AiProviderRegistry) {}

  async validateImage(input: ImageValidationRequest): Promise<ValidationResultDto> {
    const providerId = process.env.CONSISTENCY_VALIDATION_AI_PROVIDER ?? 'openai';
    const model = process.env.CONSISTENCY_VALIDATION_AI_MODEL;
    const result = await this.aiProviders.extractStructuredData(providerId, {
      prompt: buildPrompt(input),
      schema: validationResultSchema,
      ...(model === undefined ? {} : { model }),
      temperature: 0,
      metadata: {
        purpose: 'consistency-validation',
        tags: ['asset', input.assetId]
      }
    });
    const checks = result.checks.map((check) => ({
      type: check.type,
      entityId: check.entityId ?? null,
      passed: check.passed,
      score: roundScore(check.score),
      message: check.message
    }));
    const aggregate = aggregateValidationChecks(checks);

    return {
      passed: result.passed ?? aggregate.passed,
      score: roundScore(result.score ?? aggregate.score),
      checks,
      recommendedAction: result.recommendedAction ?? aggregate.recommendedAction
    };
  }
}

function buildPrompt(input: ImageValidationRequest): string {
  return [
    'Validate the generated image for consistency with the world bible context.',
    'Return strict JSON only, matching the requested schema.',
    `Generated asset id: ${input.assetId}`,
    `Generated asset path: ${input.localPath}`,
    `Generated asset mime type: ${input.mimeType}`,
    input.prompt ? `Image generation prompt: ${input.prompt}` : undefined,
    input.userRequest ? `Original user request: ${input.userRequest}` : undefined,
    input.styleName ? `Visual style: ${input.styleName}` : undefined,
    input.stylePrompt ? `Style prompt: ${input.stylePrompt}` : undefined,
    `Expected entities: ${JSON.stringify(input.entities)}`,
    `Approved reference assets: ${JSON.stringify(input.referenceAssets)}`,
    'Checks must cover characters, locations, objects, style, and the user request when present.'
  ]
    .filter((part): part is string => Boolean(part))
    .join('\n');
}
