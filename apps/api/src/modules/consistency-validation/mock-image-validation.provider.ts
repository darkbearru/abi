import { Injectable } from '@nestjs/common';

import {
  RecommendedActionDto,
  type ValidationCheckDto,
  ValidationCheckTypeDto,
  type ValidationResultDto
} from './dto/consistency-validation.dto.js';
import {
  aggregateValidationChecks,
  type ImageValidationProvider,
  type ImageValidationRequest,
  roundScore
} from './ports/image-validation.provider.js';

@Injectable()
export class MockImageValidationProvider implements ImageValidationProvider {
  readonly id = 'mock';

  validateImage(input: ImageValidationRequest): Promise<ValidationResultDto> {
    const checks = [
      ...input.entities
        .filter((entity) => entity.type === 'character')
        .map((entity) =>
          createCheck(
            ValidationCheckTypeDto.CHARACTER_SIMILARITY,
            entity.id,
            0.86,
            `Character reference for "${entity.name}" is present in the validation context.`
          )
        ),
      ...input.entities
        .filter((entity) => entity.type === 'location')
        .map((entity) =>
          createCheck(
            ValidationCheckTypeDto.LOCATION_MATCH,
            entity.id,
            0.84,
            `Location reference for "${entity.name}" is present in the validation context.`
          )
        ),
      ...input.entities
        .filter((entity) => entity.type === 'object')
        .map((entity) =>
          createCheck(
            ValidationCheckTypeDto.OBJECT_MATCH,
            entity.id,
            0.78,
            `Object "${entity.name}" is included in the validation context.`
          )
        ),
      createCheck(
        ValidationCheckTypeDto.STYLE_MATCH,
        null,
        input.stylePrompt ? 0.82 : 0.58,
        input.stylePrompt
          ? 'Style prompt is available for consistency validation.'
          : 'Style prompt is missing from validation context.'
      ),
      createCheck(
        ValidationCheckTypeDto.USER_REQUEST_MATCH,
        null,
        input.userRequest ? 0.8 : 0.5,
        input.userRequest
          ? 'User request is available for consistency validation.'
          : 'User request is missing from validation context.'
      )
    ];
    const aggregate = aggregateValidationChecks(checks);

    return Promise.resolve({
      ...aggregate,
      checks
    });
  }
}

function createCheck(
  type: ValidationCheckTypeDto,
  entityId: string | null | undefined,
  score: number,
  message: string
): ValidationCheckDto {
  const roundedScore = roundScore(score);

  return {
    type,
    entityId: entityId ?? null,
    passed: roundedScore >= 0.72,
    score: roundedScore,
    message
  };
}

export function createMockValidationResult(
  checks: readonly ValidationCheckDto[]
): ValidationResultDto {
  return {
    ...aggregateValidationChecks(checks),
    checks
  };
}

export const MOCK_APPROVE_ACTION: RecommendedActionDto = RecommendedActionDto.APPROVE;
