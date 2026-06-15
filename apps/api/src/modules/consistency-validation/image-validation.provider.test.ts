import { describe, expect, it } from 'vitest';

import {
  RecommendedActionDto,
  ValidationCheckTypeDto
} from './dto/consistency-validation.dto.js';
import { aggregateValidationChecks } from './ports/image-validation.provider.js';

describe('aggregateValidationChecks', () => {
  it('approves high scoring passed checks', () => {
    const result = aggregateValidationChecks([
      {
        type: ValidationCheckTypeDto.CHARACTER_SIMILARITY,
        entityId: 'character-1',
        passed: true,
        score: 0.9,
        message: 'Character matches.'
      },
      {
        type: ValidationCheckTypeDto.LOCATION_MATCH,
        entityId: 'location-1',
        passed: true,
        score: 0.86,
        message: 'Location matches.'
      },
      {
        type: ValidationCheckTypeDto.STYLE_MATCH,
        entityId: null,
        passed: true,
        score: 0.84,
        message: 'Style matches.'
      }
    ]);

    expect(result).toEqual({
      passed: true,
      score: 0.87,
      recommendedAction: RecommendedActionDto.APPROVE
    });
  });

  it('recommends inpaint for failed character similarity with salvageable score', () => {
    const result = aggregateValidationChecks([
      {
        type: ValidationCheckTypeDto.CHARACTER_SIMILARITY,
        entityId: 'character-1',
        passed: false,
        score: 0.55,
        message: 'Face identity drifted.'
      },
      {
        type: ValidationCheckTypeDto.LOCATION_MATCH,
        entityId: 'location-1',
        passed: true,
        score: 0.8,
        message: 'Location matches.'
      }
    ]);

    expect(result.passed).toBe(false);
    expect(result.score).toBe(0.68);
    expect(result.recommendedAction).toBe(RecommendedActionDto.INPAINT);
  });

  it('recommends regeneration for very low scores', () => {
    const result = aggregateValidationChecks([
      {
        type: ValidationCheckTypeDto.USER_REQUEST_MATCH,
        entityId: null,
        passed: false,
        score: 0.2,
        message: 'Image does not match request.'
      }
    ]);

    expect(result).toEqual({
      passed: false,
      score: 0.2,
      recommendedAction: RecommendedActionDto.REGENERATE
    });
  });
});
