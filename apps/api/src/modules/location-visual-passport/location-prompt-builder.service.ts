import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';

import { LocationVisualPassportAssetTypeDto } from './dto/location-visual-passport.dto.js';

export interface LocationParentContext {
  readonly id: string;
  readonly name: string;
  readonly description?: string | null;
  readonly atmosphere?: Prisma.JsonValue | null;
  readonly palette?: Prisma.JsonValue | null;
  readonly era?: string | null;
  readonly architectureRules?: Prisma.JsonValue | null;
}

export interface LocationVisualPassportPromptInput {
  readonly locationName: string;
  readonly parentLocations: readonly LocationParentContext[];
  readonly locationVersion: {
    readonly version: number;
    readonly description: string;
    readonly atmosphere?: Prisma.JsonValue | null;
    readonly palette?: Prisma.JsonValue | null;
    readonly era?: string | null;
    readonly socialContext?: Prisma.JsonValue | null;
    readonly lightingRules?: Prisma.JsonValue | null;
    readonly architectureRules?: Prisma.JsonValue | null;
    readonly recurringObjects?: Prisma.JsonValue | null;
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
  readonly assetType: LocationVisualPassportAssetTypeDto;
  readonly seed: number;
}

export interface BuiltLocationVisualPassportPrompt {
  readonly prompt: string;
  readonly negativePrompt: string;
}

const ASSET_TYPE_INSTRUCTIONS: Record<LocationVisualPassportAssetTypeDto, string> = {
  [LocationVisualPassportAssetTypeDto.OVERVIEW]:
    'wide establishing overview, readable spatial hierarchy, key landmarks visible, no characters',
  [LocationVisualPassportAssetTypeDto.MAP]:
    'clean illustrated map board, top-down spatial layout, parent-child placement legible, no labels or text',
  [LocationVisualPassportAssetTypeDto.MAIN_ANGLE]:
    'primary cinematic angle from the most recognizable approach, strong composition, key entrance or focal point visible',
  [LocationVisualPassportAssetTypeDto.SECONDARY_ANGLE]:
    'secondary angle showing a different side, alternate lighting direction, supporting architecture and scale cues',
  [LocationVisualPassportAssetTypeDto.OBJECT_DETAIL]:
    'detail sheet for important recurring objects and materials inside the location, close-up studies, consistent style',
  [LocationVisualPassportAssetTypeDto.PALETTE_BOARD]:
    'palette and material board, color swatches, lighting samples, surface texture studies, no text labels'
};

@Injectable()
export class LocationPromptBuilderService {
  buildLocationVisualPassportPrompt(
    input: LocationVisualPassportPromptInput
  ): BuiltLocationVisualPassportPrompt {
    const version = input.locationVersion;
    const style = input.visualStyle;
    const ancestryPath = [...input.parentLocations.map((location) => location.name), input.locationName];
    const promptParts = [
      `Location visual passport asset: ${input.assetType}`,
      `Location: ${input.locationName}`,
      `Version: ${String(version.version)}`,
      ancestryPath.length > 1 ? `Parent location chain: ${ancestryPath.join(' > ')}` : undefined,
      buildParentContext(input.parentLocations),
      `Asset layout: ${ASSET_TYPE_INSTRUCTIONS[input.assetType]}`,
      `Location description: ${version.description}`,
      version.atmosphere ? `Atmosphere: ${stringifyJson(version.atmosphere)}` : undefined,
      version.palette ? `Palette: ${stringifyJson(version.palette)}` : undefined,
      version.era ? `Era: ${version.era}` : undefined,
      version.socialContext ? `Social context: ${stringifyJson(version.socialContext)}` : undefined,
      version.lightingRules ? `Lighting rules: ${stringifyJson(version.lightingRules)}` : undefined,
      version.architectureRules
        ? `Architecture rules: ${stringifyJson(version.architectureRules)}`
        : undefined,
      version.recurringObjects
        ? `Recurring objects: ${stringifyJson(version.recurringObjects)}`
        : undefined,
      `Visual style: ${style.name}`,
      `Style language: ${style.prompt}`,
      buildStyleControls(style),
      `Seed: ${String(input.seed)}`,
      'Keep this as a reusable location reference asset for future scene generation.',
      'Maintain consistency with the parent locations, scale, architecture, palette, era, and recurring objects.'
    ].filter((part): part is string => Boolean(part));

    return {
      prompt: promptParts.join('\n'),
      negativePrompt: [
        style.negativePrompt,
        'inconsistent geography, impossible scale, text labels, watermark, logo, unrelated architecture, mismatched era, random characters'
      ]
        .filter((part): part is string => Boolean(part))
        .join(', ')
    };
  }
}

function buildParentContext(parentLocations: readonly LocationParentContext[]): string | undefined {
  if (parentLocations.length === 0) {
    return undefined;
  }

  return parentLocations
    .map((location, index) =>
      [
        `Parent ${String(index + 1)}: ${location.name}`,
        location.description ? `description=${location.description}` : undefined,
        location.atmosphere ? `atmosphere=${stringifyJson(location.atmosphere)}` : undefined,
        location.palette ? `palette=${stringifyJson(location.palette)}` : undefined,
        location.era ? `era=${location.era}` : undefined,
        location.architectureRules
          ? `architecture=${stringifyJson(location.architectureRules)}`
          : undefined
      ]
        .filter((part): part is string => Boolean(part))
        .join('; ')
    )
    .join('\n');
}

function buildStyleControls(
  style: LocationVisualPassportPromptInput['visualStyle']
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
