import { Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service.js';
import type {
  SceneEntityAmbiguityDto,
  SceneEntityCandidateDto,
  SceneEntityCreateSuggestionDto
} from './dto/scene-generation.dto.js';

const WORLD_BIBLE_SELECT = {
  worldBible: { select: { id: true } },
  series: { select: { worldBible: { select: { id: true } } } },
  bookAnalysis: { select: { worldBible: { select: { id: true } } } }
} satisfies Prisma.UserBookProjectSelect;

const CHARACTER_INCLUDE = {
  aliases: true,
  versions: { orderBy: { version: 'asc' } }
} satisfies Prisma.CharacterInclude;

const LOCATION_INCLUDE = {
  aliases: true,
  versions: { orderBy: { version: 'asc' } }
} satisfies Prisma.LocationInclude;

export interface ResolvedSceneCharacter {
  readonly id: string;
  readonly name: string;
  readonly version: CharacterWithVersions['versions'][number];
  readonly aliases: readonly string[];
}

export interface ResolvedSceneLocation {
  readonly id: string;
  readonly name: string;
  readonly version: LocationWithVersions['versions'][number];
  readonly aliases: readonly string[];
}

export interface ResolvedSceneObject {
  readonly id: string;
  readonly name: string;
  readonly description: string | null;
  readonly visualPrompt: string | null;
  readonly metadata: Prisma.JsonValue | null;
}

export interface SceneEntityResolutionResult {
  readonly worldBibleId: string;
  readonly characters: readonly ResolvedSceneCharacter[];
  readonly locations: readonly ResolvedSceneLocation[];
  readonly objects: readonly ResolvedSceneObject[];
  readonly candidates: readonly SceneEntityAmbiguityDto[];
  readonly createSuggestions: readonly SceneEntityCreateSuggestionDto[];
}

type CharacterWithVersions = Prisma.CharacterGetPayload<{
  include: typeof CHARACTER_INCLUDE;
}>;

type LocationWithVersions = Prisma.LocationGetPayload<{
  include: typeof LOCATION_INCLUDE;
}>;

interface MatchCandidate<T> {
  readonly entity: T;
  readonly score: number;
  readonly matchedText: string;
  readonly displayName: string;
}

@Injectable()
export class SceneEntityResolutionService {
  constructor(private readonly prisma: PrismaService) {}

  async resolve(
    projectId: string,
    text: string,
    timelineHint?: string
  ): Promise<SceneEntityResolutionResult> {
    const worldBibleId = await this.getWorldBibleId(projectId);
    const [characters, locations, objects] = await Promise.all([
      this.prisma.character.findMany({
        where: { worldBibleId },
        include: CHARACTER_INCLUDE,
        orderBy: { canonicalName: 'asc' }
      }),
      this.prisma.location.findMany({
        where: { worldBibleId },
        include: LOCATION_INCLUDE,
        orderBy: { name: 'asc' }
      }),
      this.prisma.worldObject.findMany({
        where: { worldBibleId },
        orderBy: { name: 'asc' }
      })
    ]);
    const characterResolution = resolveEntityGroup(
      text,
      characters,
      'character',
      (character) => character.canonicalName,
      (character) => character.aliases.map((alias) => alias.alias)
    );
    const locationResolution = resolveEntityGroup(
      text,
      locations,
      'location',
      (location) => location.name,
      (location) => location.aliases.map((alias) => alias.alias)
    );
    const objectResolution = resolveEntityGroup(
      text,
      objects,
      'world_object',
      (object) => object.name,
      () => []
    );

    const resolvedMentions = [
      ...characterResolution.resolved.map((character) => character.canonicalName),
      ...characterResolution.resolved.flatMap((character) => character.aliases.map((alias) => alias.alias)),
      ...locationResolution.resolved.map((location) => location.name),
      ...locationResolution.resolved.flatMap((location) => location.aliases.map((alias) => alias.alias)),
      ...objectResolution.resolved.map((object) => object.name)
    ];

    return {
      worldBibleId,
      characters: characterResolution.resolved.map((character) => ({
        id: character.id,
        name: character.canonicalName,
        aliases: character.aliases.map((alias) => alias.alias),
        version: selectCharacterVersion(character, timelineHint)
      })),
      locations: locationResolution.resolved.map((location) => ({
        id: location.id,
        name: location.name,
        aliases: location.aliases.map((alias) => alias.alias),
        version: selectLocationVersion(location)
      })),
      objects: objectResolution.resolved.map((object) => ({
        id: object.id,
        name: object.name,
        description: object.description,
        visualPrompt: object.visualPrompt,
        metadata: object.metadata
      })),
      candidates: [
        ...characterResolution.ambiguities,
        ...locationResolution.ambiguities,
        ...objectResolution.ambiguities
      ],
      createSuggestions: [
        ...characterResolution.createSuggestions,
        ...locationResolution.createSuggestions,
        ...objectResolution.createSuggestions,
        ...extractCreateSuggestions(text, resolvedMentions)
      ]
    };
  }

  private async getWorldBibleId(projectId: string): Promise<string> {
    const project = await this.prisma.userBookProject.findUnique({
      where: { id: projectId },
      select: WORLD_BIBLE_SELECT
    });

    if (!project) {
      throw new NotFoundException('Project was not found.');
    }

    const worldBibleId =
      project.series?.worldBible?.id ?? project.worldBible?.id ?? project.bookAnalysis?.worldBible?.id;

    if (!worldBibleId) {
      throw new NotFoundException('Project world bible was not found.');
    }

    return worldBibleId;
  }
}

function resolveEntityGroup<T>(
  text: string,
  entities: readonly T[],
  entityType: string,
  getName: (entity: T) => string,
  getAliases: (entity: T) => readonly string[]
): {
  readonly resolved: readonly T[];
  readonly ambiguities: readonly SceneEntityAmbiguityDto[];
  readonly createSuggestions: readonly SceneEntityCreateSuggestionDto[];
} {
  const matches = entities
    .map((entity) => findBestMatch(text, entity, getName(entity), getAliases(entity)))
    .filter((match): match is MatchCandidate<T> => match !== undefined);
  const groupedByMention = groupBy(matches, (match) => normalizeText(match.matchedText));
  const resolved: T[] = [];
  const ambiguities: SceneEntityAmbiguityDto[] = [];

  for (const [mentionKey, group] of groupedByMention.entries()) {
    const sorted = [...group].sort((left, right) => right.score - left.score);
    const bestScore = sorted[0]?.score ?? 0;
    const closeMatches = sorted.filter((candidate) => candidate.score >= bestScore - 0.08);

    if (closeMatches.length > 1) {
      ambiguities.push({
        mention: group[0]?.matchedText ?? mentionKey,
        entityType,
        candidates: closeMatches.map((candidate) => toCandidateDto(candidate, entityType))
      });
    } else if (sorted[0]) {
      resolved.push(sorted[0].entity);
    }
  }

  return {
    resolved: uniqueBy(resolved, (entity) => getName(entity)),
    ambiguities,
    createSuggestions: []
  };
}

function findBestMatch<T>(
  text: string,
  entity: T,
  name: string,
  aliases: readonly string[]
): MatchCandidate<T> | undefined {
  const normalizedText = normalizeText(text);
  const textStems = new Set(tokenize(normalizedText).map(stemToken));
  const labels = [name, ...aliases].map((label) => label.trim()).filter(Boolean);
  const matches = labels
    .map((label) => {
      const normalizedLabel = normalizeText(label);

      if (normalizedLabel.length === 0) {
        return undefined;
      }

      if (containsPhrase(normalizedText, normalizedLabel)) {
        return {
          entity,
          score: label === name ? 1 : 1.05,
          matchedText: label,
          displayName: name
        };
      }

      const labelTokens = tokenize(normalizedLabel);

      if (labelTokens.length === 1 && textStems.has(stemToken(labelTokens[0] ?? ''))) {
        return {
          entity,
          score: label === name ? 0.92 : 0.97,
          matchedText: label,
          displayName: name
        };
      }

      return undefined;
    })
    .filter((match): match is MatchCandidate<T> => match !== undefined);

  return matches.sort((left, right) => right.score - left.score)[0];
}

function toCandidateDto<T>(
  candidate: MatchCandidate<T>,
  entityType: string
): SceneEntityCandidateDto {
  return {
    id: getEntityId(candidate.entity),
    type: entityType,
    name: candidate.displayName,
    confidence: Number(candidate.score.toFixed(2)),
    matchedText: candidate.matchedText
  };
}

function selectCharacterVersion(
  character: CharacterWithVersions,
  timelineHint: string | undefined
): CharacterWithVersions['versions'][number] {
  const byTimelineHint = selectVersionByTimelineHint(character.versions, timelineHint);

  return byTimelineHint ?? character.versions.at(-1) ?? missingCharacterVersion(character);
}

function selectLocationVersion(location: LocationWithVersions): LocationWithVersions['versions'][number] {
  return location.versions.at(-1) ?? missingLocationVersion(location);
}

function selectVersionByTimelineHint<T extends { readonly timelineRange?: Prisma.JsonValue | null }>(
  versions: readonly T[],
  timelineHint: string | undefined
): T | undefined {
  if (!timelineHint) {
    return undefined;
  }

  const normalizedHint = normalizeText(timelineHint);

  return versions.find((version) =>
    normalizeText(JSON.stringify(version.timelineRange ?? '')).includes(normalizedHint)
  );
}

function missingCharacterVersion(character: CharacterWithVersions): CharacterWithVersions['versions'][number] {
  throw new NotFoundException(`Character "${character.canonicalName}" has no versions.`);
}

function missingLocationVersion(location: LocationWithVersions): LocationWithVersions['versions'][number] {
  throw new NotFoundException(`Location "${location.name}" has no versions.`);
}

function normalizeText(value: string): string {
  return value
    .toLocaleLowerCase('ru-RU')
    .replace(/[^\p{L}\p{N}\s-]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenize(value: string): readonly string[] {
  return normalizeText(value).split(' ').filter(Boolean);
}

function containsPhrase(normalizedText: string, normalizedLabel: string): boolean {
  return ` ${normalizedText} `.includes(` ${normalizedLabel} `);
}

function stemToken(value: string): string {
  const normalized = normalizeText(value);
  const suffixes = ['ами', 'ями', 'ого', 'ему', 'ыми', 'ими', 'ах', 'ях', 'ом', 'ем', 'ой', 'ый', 'ий', 'ая', 'ое', 'ые', 'ов', 'ев', 'а', 'у', 'е', 'ы', 'и'];
  const suffix = suffixes.find(
    (candidate) => normalized.length > candidate.length + 3 && normalized.endsWith(candidate)
  );

  return suffix ? normalized.slice(0, -suffix.length) : normalized;
}

function groupBy<T>(
  values: readonly T[],
  getKey: (value: T) => string
): Map<string, readonly T[]> {
  const map = new Map<string, T[]>();

  for (const value of values) {
    const key = getKey(value);
    const existing = map.get(key) ?? [];

    existing.push(value);
    map.set(key, existing);
  }

  return map;
}

function uniqueBy<T>(values: readonly T[], getKey: (value: T) => string): readonly T[] {
  const seen = new Set<string>();
  const result: T[] = [];

  for (const value of values) {
    const key = getKey(value);

    if (!seen.has(key)) {
      seen.add(key);
      result.push(value);
    }
  }

  return result;
}

function getEntityId(value: unknown): string {
  return value && typeof value === 'object' && 'id' in value
    ? String((value as { readonly id: unknown }).id)
    : '';
}

function extractCreateSuggestions(
  text: string,
  resolvedMentions: readonly string[]
): readonly SceneEntityCreateSuggestionDto[] {
  const resolvedStems = new Set(
    resolvedMentions.flatMap((mention) => tokenize(mention).map(stemToken))
  );
  const mentions = Array.from(
    text.matchAll(/(?:^|[^\p{L}\p{N}_])(\p{Lu}[\p{L}\p{N}-]{1,}(?:\s+\p{Lu}[\p{L}\p{N}-]{1,})*)/gu)
  )
    .map((match) => match[1]?.trim() ?? '')
    .filter(Boolean)
    .filter((mention) => {
      const mentionStems = tokenize(mention).map(stemToken);

      return mentionStems.length > 0 && mentionStems.some((stem) => !resolvedStems.has(stem));
    });

  return [...new Set(mentions)].map((mention) => ({
    mention,
    entityType: 'unknown'
  }));
}
