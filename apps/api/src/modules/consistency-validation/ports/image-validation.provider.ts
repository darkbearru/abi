import {
  RecommendedActionDto,
  ValidationCheckTypeDto,
  type ValidationCheckDto,
  type ValidationResultDto
} from '../dto/consistency-validation.dto.js';

export interface ImageValidationEntity {
  readonly type: 'character' | 'location' | 'object' | 'style' | 'user_request';
  readonly id?: string | null;
  readonly name: string;
  readonly description?: string | null;
}

export interface ImageValidationReferenceAsset {
  readonly id: string;
  readonly entityType: string;
  readonly entityId: string;
  readonly localPath: string;
  readonly prompt?: string | null;
}

export interface ImageValidationRequest {
  readonly assetId: string;
  readonly localPath: string;
  readonly mimeType: string;
  readonly prompt?: string | null;
  readonly userRequest?: string | null;
  readonly styleName?: string | null;
  readonly stylePrompt?: string | null;
  readonly entities: readonly ImageValidationEntity[];
  readonly referenceAssets: readonly ImageValidationReferenceAsset[];
}

export interface ImageValidationProvider {
  readonly id: string;
  validateImage(input: ImageValidationRequest): Promise<ValidationResultDto>;
}

export const IMAGE_VALIDATION_PROVIDER = 'ABI_IMAGE_VALIDATION_PROVIDER';

export function aggregateValidationChecks(
  checks: readonly ValidationCheckDto[]
): Pick<ValidationResultDto, 'passed' | 'score' | 'recommendedAction'> {
  if (checks.length === 0) {
    return {
      passed: false,
      score: 0,
      recommendedAction: RecommendedActionDto.MANUAL_REVIEW
    };
  }

  const score = roundScore(
    checks.reduce((sum, check) => sum + clampScore(check.score), 0) / checks.length
  );
  const passed = checks.every((check) => check.passed) && score >= 0.72;

  return {
    passed,
    score,
    recommendedAction: chooseRecommendedAction(score, checks)
  };
}

function chooseRecommendedAction(
  score: number,
  checks: readonly ValidationCheckDto[]
): RecommendedActionDto {
  if (score >= 0.82 && checks.every((check) => check.passed)) {
    return RecommendedActionDto.APPROVE;
  }

  if (score < 0.45) {
    return RecommendedActionDto.REGENERATE;
  }

  if (
    checks.some(
      (check) => check.type === ValidationCheckTypeDto.CHARACTER_SIMILARITY && !check.passed
    )
  ) {
    return RecommendedActionDto.INPAINT;
  }

  return RecommendedActionDto.MANUAL_REVIEW;
}

export function clampScore(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.min(1, Math.max(0, value));
}

export function roundScore(value: number): number {
  return Math.round(clampScore(value) * 100) / 100;
}
