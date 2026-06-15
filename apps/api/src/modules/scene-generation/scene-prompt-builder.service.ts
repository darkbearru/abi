import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';

import type { ProjectGraphResponseDto } from '../knowledge-graph/dto/project-graph.response.dto.js';
import type {
  ResolvedSceneCharacter,
  ResolvedSceneLocation,
  ResolvedSceneObject
} from './scene-entity-resolution.service.js';

export interface ScenePromptReferenceAsset {
  readonly id: string;
  readonly entityType: string;
  readonly entityId: string;
  readonly localPath: string;
  readonly mimeType: string;
  readonly prompt?: string | null;
}

export interface ScenePromptBuilderInput {
  readonly userText: string;
  readonly timelineHint?: string;
  readonly aspectRatio: string;
  readonly characters: readonly ResolvedSceneCharacter[];
  readonly locations: readonly ResolvedSceneLocation[];
  readonly objects: readonly ResolvedSceneObject[];
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
  readonly graphContext: ProjectGraphResponseDto;
  readonly referenceAssets: readonly ScenePromptReferenceAsset[];
}

export interface BuiltScenePrompt {
  readonly prompt: string;
  readonly negativePrompt: string;
}

@Injectable()
export class ScenePromptBuilderService {
  buildScenePrompt(input: ScenePromptBuilderInput): BuiltScenePrompt {
    const promptParts = [
      'Generate one production illustration from the resolved world bible context.',
      `User scene request: ${input.userText}`,
      input.timelineHint ? `Timeline hint: ${input.timelineHint}` : undefined,
      `Aspect ratio: ${input.aspectRatio}`,
      buildCharacterContext(input.characters),
      buildLocationContext(input.locations),
      buildObjectContext(input.objects),
      buildGraphContext(input.graphContext),
      buildReferenceAssetContext(input.referenceAssets),
      `Visual style: ${input.visualStyle.name}`,
      `Style language: ${input.visualStyle.prompt}`,
      buildStyleControls(input.visualStyle),
      'Preserve identity, age, clothing, architecture, spatial hierarchy, and era from the references.',
      'Do not invent new named characters or locations unless the user request explicitly asks for them.'
    ].filter((part): part is string => Boolean(part));

    return {
      prompt: promptParts.join('\n'),
      negativePrompt: [
        input.visualStyle.negativePrompt,
        'wrong character identity, inconsistent costume, inconsistent location layout, mismatched era, extra named characters, text, watermark, logo'
      ]
        .filter((part): part is string => Boolean(part))
        .join(', ')
    };
  }
}

function buildCharacterContext(characters: readonly ResolvedSceneCharacter[]): string | undefined {
  if (characters.length === 0) {
    return undefined;
  }

  return [
    'Resolved characters:',
    ...characters.map((character) =>
      [
        `- ${character.name}`,
        character.aliases.length > 0 ? `aliases=${character.aliases.join(', ')}` : undefined,
        character.version.age ? `age=${character.version.age}` : undefined,
        `appearance=${stringifyJson(character.version.appearance)}`,
        character.version.personality
          ? `personality=${stringifyJson(character.version.personality)}`
          : undefined,
        character.version.speechManner
          ? `speech=${character.version.speechManner}`
          : undefined,
        character.version.clothing
          ? `clothing=${stringifyJson(character.version.clothing)}`
          : undefined,
        character.version.visualPrompt ? `visual=${character.version.visualPrompt}` : undefined
      ]
        .filter((part): part is string => Boolean(part))
        .join('; ')
    )
  ].join('\n');
}

function buildLocationContext(locations: readonly ResolvedSceneLocation[]): string | undefined {
  if (locations.length === 0) {
    return undefined;
  }

  return [
    'Resolved locations:',
    ...locations.map((location) =>
      [
        `- ${location.name}`,
        location.aliases.length > 0 ? `aliases=${location.aliases.join(', ')}` : undefined,
        `description=${location.version.description}`,
        location.version.atmosphere
          ? `atmosphere=${stringifyJson(location.version.atmosphere)}`
          : undefined,
        location.version.palette ? `palette=${stringifyJson(location.version.palette)}` : undefined,
        location.version.era ? `era=${location.version.era}` : undefined,
        location.version.lightingRules
          ? `lighting=${stringifyJson(location.version.lightingRules)}`
          : undefined,
        location.version.architectureRules
          ? `architecture=${stringifyJson(location.version.architectureRules)}`
          : undefined,
        location.version.recurringObjects
          ? `recurringObjects=${stringifyJson(location.version.recurringObjects)}`
          : undefined
      ]
        .filter((part): part is string => Boolean(part))
        .join('; ')
    )
  ].join('\n');
}

function buildObjectContext(objects: readonly ResolvedSceneObject[]): string | undefined {
  if (objects.length === 0) {
    return undefined;
  }

  return [
    'Resolved objects:',
    ...objects.map((object) =>
      [
        `- ${object.name}`,
        object.description ? `description=${object.description}` : undefined,
        object.visualPrompt ? `visual=${object.visualPrompt}` : undefined,
        object.metadata ? `metadata=${stringifyJson(object.metadata)}` : undefined
      ]
        .filter((part): part is string => Boolean(part))
        .join('; ')
    )
  ].join('\n');
}

function buildGraphContext(graphContext: ProjectGraphResponseDto): string | undefined {
  if (graphContext.nodes.length === 0 && graphContext.relationships.length === 0) {
    return undefined;
  }

  const nodeLines = graphContext.nodes.slice(0, 20).map((node) =>
    `node ${node.labels.join('+')}: ${JSON.stringify(node.properties)}`
  );
  const relationshipLines = graphContext.relationships.slice(0, 30).map((relationship) =>
    `relationship ${relationship.type}: ${relationship.source} -> ${relationship.target}`
  );

  return ['Knowledge graph context:', ...nodeLines, ...relationshipLines].join('\n');
}

function buildReferenceAssetContext(
  referenceAssets: readonly ScenePromptReferenceAsset[]
): string | undefined {
  if (referenceAssets.length === 0) {
    return undefined;
  }

  return [
    'Approved reference assets:',
    ...referenceAssets.map((asset) =>
      [
        `- ${asset.entityType}:${asset.entityId}`,
        `assetId=${asset.id}`,
        `path=${asset.localPath}`,
        `mime=${asset.mimeType}`,
        asset.prompt ? `referencePrompt=${asset.prompt}` : undefined
      ]
        .filter((part): part is string => Boolean(part))
        .join('; ')
    )
  ].join('\n');
}

function buildStyleControls(style: ScenePromptBuilderInput['visualStyle']): string {
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
