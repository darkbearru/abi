import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';

import { CharacterVisualPassportAssetTypeDto } from './dto/character-visual-passport.dto.js';

export interface CharacterVisualPassportPromptInput {
  readonly characterName: string;
  readonly characterVersion: {
    readonly version: number;
    readonly age?: string | null;
    readonly timelineRange?: Prisma.JsonValue | null;
    readonly appearance: Prisma.JsonValue;
    readonly personality?: Prisma.JsonValue | null;
    readonly speechManner?: string | null;
    readonly clothing?: Prisma.JsonValue | null;
    readonly visualPrompt?: string | null;
    readonly negativePrompt?: string | null;
  };
  readonly visualStyle: {
    readonly name: string;
    readonly prompt: string;
    readonly negativePrompt?: string | null;
    readonly primaryColor?: string | null;
    readonly secondaryColor?: string | null;
    readonly accentColor?: string | null;
    readonly contrastLevel?: number | null;
    readonly saturationLevel?: number | null;
    readonly grainLevel?: number | null;
    readonly lineThickness?: number | null;
  };
  readonly assetType: CharacterVisualPassportAssetTypeDto;
  readonly seed: number;
}

export interface BuiltCharacterVisualPassportPrompt {
  readonly prompt: string;
  readonly negativePrompt: string;
}

const CHARACTER_PROMPT_BEGIN =
  'Create a single high-resolution, the character must be identical across every panel. Editorial animation-reference layout with a white background, thin yellow neon accent light, faint film-grain overlay, and studio reference UI. ';

const ASSET_TYPE_INSTRUCTIONS: Record<CharacterVisualPassportAssetTypeDto, string> = {
  [CharacterVisualPassportAssetTypeDto.FRONT_VIEW]:
    'full body front view, neutral standing pose, symmetrical readable silhouette, plain background',
  [CharacterVisualPassportAssetTypeDto.SIDE_VIEW]:
    'full body side view, neutral standing pose, profile silhouette, plain background',
  [CharacterVisualPassportAssetTypeDto.BACK_VIEW]:
    'full body back view, neutral standing pose, back silhouette and clothing construction visible, plain background',
  [CharacterVisualPassportAssetTypeDto.PORTRAIT]:
    'portrait bust, face and hair clearly visible, neutral expression, consistent costume collar details',
  [CharacterVisualPassportAssetTypeDto.EMOTION_SHEET]:
    'emotion sheet with multiple facial expressions, same character identity, clear labels avoided, consistent face structure',
  [CharacterVisualPassportAssetTypeDto.OUTFIT_SHEET]:
    'outfit sheet with costume variations, same body proportions, clothing layers and accessories clearly separated',
  [CharacterVisualPassportAssetTypeDto.POSE_SHEET]:
    'pose sheet with action and idle poses, same character identity, readable silhouette and anatomy'
};

@Injectable()
export class PromptBuilderService {
  buildCharacterVisualPassportPrompt(
    input: CharacterVisualPassportPromptInput
  ): BuiltCharacterVisualPassportPrompt {
    const character = input.characterVersion;
    const style = input.visualStyle;
    const promptParts = [
      `Character visual passport asset: ${input.assetType}`,
      `Character: ${input.characterName}`,
      `Version: ${String(character.version)}`,
      character.age ? `Age: ${character.age}` : undefined,
      `Asset layout: ${ASSET_TYPE_INSTRUCTIONS[input.assetType]}`,
      `Appearance: ${stringifyJson(character.appearance)}`,
      character.clothing ? `Clothing: ${stringifyJson(character.clothing)}` : undefined,
      character.personality ? `Personality cues: ${stringifyJson(character.personality)}` : undefined,
      character.speechManner ? `Speech manner cue: ${character.speechManner}` : undefined,
      character.timelineRange
        ? `Timeline range: ${stringifyJson(character.timelineRange)}`
        : undefined,
      character.visualPrompt ? `Character art direction: ${character.visualPrompt}` : undefined,
      `Visual style: ${style.name}`,
      `Style language: ${style.prompt}`,
      buildStyleControls(style),
      `Seed: ${String(input.seed)}`,
      CHARACTER_PROMPT_BEGIN,
      'Use a clean reference-sheet composition suitable as future scene generation reference.'
    ].filter((part): part is string => Boolean(part));

    const negativePrompt = [
      style.negativePrompt,
      character.negativePrompt,
      'inconsistent identity, different facial structure, extra limbs, unreadable silhouette, text labels, watermark, logo, cropped reference sheet'
    ]
      .filter((part): part is string => Boolean(part))
      .join(', ');

    return {
      prompt: promptParts.join('\n'),
      negativePrompt
    };
  }
}

function buildStyleControls(
  style: CharacterVisualPassportPromptInput['visualStyle']
): string {
  return [
    style.primaryColor ? `Primary color: ${style.primaryColor}` : undefined,
    style.secondaryColor ? `Secondary color: ${style.secondaryColor}` : undefined,
    style.accentColor ? `Accent color: ${style.accentColor}` : undefined,
    style.contrastLevel === null || style.contrastLevel === undefined
      ? undefined
      : `Contrast level: ${String(style.contrastLevel)}/100`,
    style.saturationLevel === null || style.saturationLevel === undefined
      ? undefined
      : `Saturation level: ${String(style.saturationLevel)}/100`,
    style.grainLevel === null || style.grainLevel === undefined
      ? undefined
      : `Grain level: ${String(style.grainLevel)}/100`,
    style.lineThickness === null || style.lineThickness === undefined
      ? undefined
      : `Line thickness: ${String(style.lineThickness)}/100`
  ]
    .filter((part): part is string => Boolean(part))
    .join('\n');
}

function stringifyJson(value: Prisma.JsonValue): string {
  return typeof value === 'string' ? value : JSON.stringify(value);
}
