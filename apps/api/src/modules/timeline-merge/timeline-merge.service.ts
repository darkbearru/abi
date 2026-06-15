import { Injectable, NotFoundException } from '@nestjs/common';
import type { ExtractedFactType, Prisma } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service.js';
import type {
  MergeableTimelineFact,
  PlannedTimelineEvent,
  TimelineMergePlan
} from './timeline-merge.types.js';

const TIMELINE_FACT_TYPES = new Set<ExtractedFactType>([
  'TIMELINE_EVENT',
  'TIMELINE_MARKER',
  'TIMELINE_CHARACTER_PERIOD',
  'TIMELINE_CANDIDATE'
]);

interface FactValue {
  readonly title: string | undefined;
  readonly description: string | undefined;
  readonly absoluteDate: string | undefined;
  readonly relativeMarker: string | undefined;
  readonly relativeOrderHint: string | undefined;
  readonly anchorEventTitle: string | undefined;
  readonly characterNames: readonly string[];
  readonly locationNames: readonly string[];
  readonly periodName: string | undefined;
  readonly candidateNames: readonly string[];
}

type CharacterWithVersions = Prisma.CharacterGetPayload<{
  include: {
    aliases: true;
    versions: true;
  };
}>;

type CharacterVersionPayload = CharacterWithVersions['versions'][number];

type LocationWithAliases = Prisma.LocationGetPayload<{
  include: {
    aliases: true;
  };
}>;

@Injectable()
export class TimelineMergeService {
  constructor(private readonly prisma: PrismaService) {}

  createMergePlan(facts: readonly MergeableTimelineFact[]): TimelineMergePlan {
    const timelineFacts = facts
      .filter((fact) => TIMELINE_FACT_TYPES.has(fact.type))
      .sort(compareFacts);
    const mergedEvents = mergeDuplicateEvents(
      timelineFacts.map((fact, index) => this.planEvent(fact, index))
    );
    const orderedEvents = assignRelativeOrder(mergedEvents);

    return {
      events: orderedEvents
    };
  }

  async mergeProjectTimeline(projectId: string): Promise<TimelineMergePlan> {
    const context = await this.getMergeContext(projectId);
    const facts = await this.prisma.extractedFact.findMany({
      where: {
        bookAnalysisId: {
          in: [...context.bookAnalysisIds]
        },
        type: {
          in: [...TIMELINE_FACT_TYPES]
        }
      },
      orderBy: [{ chapterIndex: 'asc' }, { createdAt: 'asc' }]
    });
    const plan = this.createMergePlan(facts);

    await this.persistMergePlan(context.worldBibleId, plan);

    return plan;
  }

  private async getMergeContext(
    projectId: string
  ): Promise<{ readonly bookAnalysisIds: readonly string[]; readonly worldBibleId: string }> {
    const project = await this.prisma.userBookProject.findUnique({
      where: { id: projectId },
      select: {
        id: true,
        seriesId: true,
        bookAnalysisId: true,
        worldBible: { select: { id: true } },
        bookAnalysis: { select: { id: true, worldBible: { select: { id: true } } } },
        books: {
          select: {
            bookAnalysisId: true,
            bookAnalysis: { select: { id: true } }
          },
          orderBy: { orderIndex: 'asc' }
        },
        series: {
          select: {
            worldBible: { select: { id: true } },
            books: {
              select: {
                book: {
                  select: {
                    analyses: {
                      select: { id: true },
                      orderBy: { createdAt: 'desc' },
                      take: 1
                    }
                  }
                }
              },
              orderBy: { orderIndex: 'asc' }
            }
          }
        }
      }
    });

    if (!project) {
      throw new NotFoundException('Project was not found.');
    }

    const bookAnalysisIds = uniqueStrings([
      ...project.books.map((book) => book.bookAnalysisId ?? book.bookAnalysis?.id),
      ...(project.series?.books.map((book) => book.book.analyses[0]?.id) ?? []),
      project.bookAnalysisId,
      project.bookAnalysis?.id
    ]);

    if (bookAnalysisIds.length === 0) {
      throw new NotFoundException('Project analysis was not found.');
    }
    const primaryBookAnalysisId = bookAnalysisIds[0];
    if (!primaryBookAnalysisId) {
      throw new NotFoundException('Project analysis was not found.');
    }

    const existingWorldBibleId =
      project.series?.worldBible?.id ?? project.worldBible?.id ?? project.bookAnalysis?.worldBible?.id;

    if (existingWorldBibleId) {
      return { bookAnalysisIds, worldBibleId: existingWorldBibleId };
    }

    const worldBible = await this.prisma.worldBible.create({
      data: {
        ...(project.seriesId
          ? { seriesId: project.seriesId }
          : { bookAnalysisId: primaryBookAnalysisId, projectId: project.id })
      },
      select: { id: true }
    });

    return { bookAnalysisIds, worldBibleId: worldBible.id };
  }

  private async persistMergePlan(worldBibleId: string, plan: TimelineMergePlan): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.timelineEvent.deleteMany({
        where: { worldBibleId }
      });

      const [characters, locations] = await Promise.all([
        tx.character.findMany({
          where: { worldBibleId },
          include: {
            aliases: true,
            versions: true
          }
        }),
        tx.location.findMany({
          where: { worldBibleId },
          include: {
            aliases: true
          }
        })
      ]);
      const characterByName = buildCharacterNameIndex(characters);
      const locationByName = buildLocationNameIndex(locations);

      for (const [index, event] of plan.events.entries()) {
        const involvedCharacters = uniqueResolved(
          event.involvedCharacterNames.map((name) => characterByName.get(normalizeName(name)))
        );
        const involvedLocations = uniqueResolved(
          event.involvedLocationNames.map((name) => locationByName.get(normalizeName(name)))
        );
        const characterVersions = involvedCharacters.flatMap((character) =>
          chooseCharacterVersions(character, event)
        );
        const created = await tx.timelineEvent.create({
          data: {
            worldBibleId,
            title: event.title,
            ...(event.description === undefined ? {} : { description: event.description }),
            chapterIndex: event.chapterIndex,
            ...(event.absoluteDate === undefined ? {} : { absoluteDate: event.absoluteDate }),
            relativeOrder: event.relativeOrder,
            orderIndex: index,
            ...(event.relativeMarkers === undefined
              ? {}
              : { relativeMarkers: event.relativeMarkers }),
            involvedCharacterIds: involvedCharacters.map((character) => character.id),
            involvedLocationIds: involvedLocations.map((location) => location.id),
            sourceChunkIds: [...event.sourceChunkIds],
            confidence: event.confidence,
            ...(involvedCharacters[0] === undefined
              ? {}
              : { characterId: involvedCharacters[0].id }),
            ...(involvedLocations[0] === undefined ? {} : { locationId: involvedLocations[0].id })
          },
          select: { id: true }
        });

        if (characterVersions.length > 0) {
          await tx.timelineEventCharacterVersion.createMany({
            data: uniqueResolved(characterVersions).map((version) => ({
              timelineEventId: created.id,
              characterVersionId: version.id
            })),
            skipDuplicates: true
          });
        }
      }
    });
  }

  private planEvent(fact: MergeableTimelineFact, sequence: number): PlannedTimelineEvent {
    const value = getFactValue(fact);
    const title = value.title ?? fact.entityName;
    const absoluteDate = parseAbsoluteDate(value.absoluteDate);
    const relativeOrderHint =
      value.relativeOrderHint ?? classifyRelativeMarker(value.relativeMarker ?? fact.timelineHint);
    const relativeMarkers = toInputJsonObject({
      ...(value.relativeMarker === undefined ? {} : { relativeMarker: value.relativeMarker }),
      ...(relativeOrderHint === undefined ? {} : { relativeOrderHint }),
      ...(value.anchorEventTitle === undefined
        ? {}
        : { anchorEventTitle: value.anchorEventTitle }),
      ...(value.periodName === undefined ? {} : { periodName: value.periodName }),
      ...(fact.timelineHint === undefined || fact.timelineHint === null
        ? {}
        : { timelineHint: fact.timelineHint }),
      ...(fact.quote === undefined || fact.quote === null ? {} : { quote: fact.quote })
    });

    return {
      title,
      description: value.description,
      chapterIndex: fact.chapterIndex,
      absoluteDate,
      relativeOrder: fact.chapterIndex * 1000 + sequence,
      involvedCharacterNames: value.characterNames,
      involvedLocationNames: value.locationNames,
      sourceChunkIds: [fact.sourceChunkId],
      sourceFactIds: [fact.id],
      confidence: fact.confidence,
      relativeMarkers: Object.keys(relativeMarkers).length === 0 ? undefined : relativeMarkers
    };
  }
}

function mergeDuplicateEvents(
  events: readonly PlannedTimelineEvent[]
): readonly PlannedTimelineEvent[] {
  const byKey = new Map<string, PlannedTimelineEvent>();

  for (const event of events) {
    const key = [String(event.chapterIndex), normalizeName(event.title)].join(':');
    const existing = byKey.get(key);

    if (!existing) {
      byKey.set(key, event);
      continue;
    }

    byKey.set(key, {
      ...existing,
      description: existing.description ?? event.description,
      involvedCharacterNames: uniqueStrings([
        ...existing.involvedCharacterNames,
        ...event.involvedCharacterNames
      ]),
      involvedLocationNames: uniqueStrings([
        ...existing.involvedLocationNames,
        ...event.involvedLocationNames
      ]),
      sourceChunkIds: uniqueStrings([...existing.sourceChunkIds, ...event.sourceChunkIds]),
      sourceFactIds: uniqueStrings([...existing.sourceFactIds, ...event.sourceFactIds]),
      confidence: average([existing.confidence, event.confidence]),
      relativeMarkers: mergeJsonObjects(existing.relativeMarkers, event.relativeMarkers)
    });
  }

  return [...byKey.values()];
}

function assignRelativeOrder(
  events: readonly PlannedTimelineEvent[]
): readonly PlannedTimelineEvent[] {
  const ordered = [...events].sort(comparePlannedEvents);
  const orderByTitle = new Map<string, number>();
  const result: PlannedTimelineEvent[] = [];

  for (const [index, event] of ordered.entries()) {
    const marker = getRelativeMarkers(event);
    const hint = getString(marker.relativeOrderHint);
    const anchorTitle = getString(marker.anchorEventTitle);
    const anchorOrder =
      anchorTitle === undefined ? undefined : orderByTitle.get(normalizeName(anchorTitle));
    const relativeOrder =
      anchorOrder === undefined
        ? event.relativeOrder + relativeMarkerWeight(hint)
        : anchorOrder + relativeMarkerWeight(hint);
    const normalizedOrder = relativeOrder + index;
    const orderedEvent = {
      ...event,
      relativeOrder: normalizedOrder
    };

    result.push(orderedEvent);
    orderByTitle.set(normalizeName(orderedEvent.title), normalizedOrder);
  }

  return result.sort((left, right) => left.relativeOrder - right.relativeOrder);
}

function comparePlannedEvents(
  left: PlannedTimelineEvent,
  right: PlannedTimelineEvent
): number {
  const dateComparison =
    (left.absoluteDate?.getTime() ?? Number.POSITIVE_INFINITY) -
    (right.absoluteDate?.getTime() ?? Number.POSITIVE_INFINITY);

  if (dateComparison !== 0) {
    return dateComparison;
  }

  return left.relativeOrder - right.relativeOrder;
}

function compareFacts(left: MergeableTimelineFact, right: MergeableTimelineFact): number {
  if (left.chapterIndex !== right.chapterIndex) {
    return left.chapterIndex - right.chapterIndex;
  }

  if (left.createdAt && right.createdAt && left.createdAt.getTime() !== right.createdAt.getTime()) {
    return left.createdAt.getTime() - right.createdAt.getTime();
  }

  return left.id.localeCompare(right.id);
}

function relativeMarkerWeight(hint: string | undefined): number {
  switch (hint) {
    case 'childhood':
      return -1_000_000;
    case 'before':
      return -100;
    case 'same_time':
      return 0;
    case 'next_day':
      return 10;
    case 'after':
      return 50;
    case 'year_later':
      return 365;
    default:
      return 0;
  }
}

function classifyRelativeMarker(marker: string | null | undefined): string | undefined {
  if (!marker) {
    return undefined;
  }

  const normalized = marker.toLowerCase();

  if (normalized.includes('childhood') || normalized.includes('детств')) {
    return 'childhood';
  }

  if (normalized.includes('next day') || normalized.includes('следующ')) {
    return 'next_day';
  }

  if (normalized.includes('year later') || normalized.includes('через год')) {
    return 'year_later';
  }

  if (normalized.includes('before') || normalized.includes('до ')) {
    return 'before';
  }

  if (normalized.includes('after') || normalized.includes('после')) {
    return 'after';
  }

  return 'unknown';
}

function chooseCharacterVersions(
  character: CharacterWithVersions,
  event: PlannedTimelineEvent
): readonly CharacterVersionPayload[] {
  if (character.versions.length === 0) {
    return [];
  }

  const ranked = character.versions
    .map((version) => ({
      version,
      score: scoreCharacterVersion(version, event)
    }))
    .sort((left, right) => right.score - left.score || left.version.version - right.version.version);

  const bestMatch = ranked[0];

  return bestMatch ? [bestMatch.version] : [];
}

function scoreCharacterVersion(
  version: CharacterVersionPayload,
  event: PlannedTimelineEvent
): number {
  const marker = getRelativeMarkers(event);
  const periodName = getString(marker.periodName);
  const hint = getString(marker.relativeOrderHint);
  const sourceMatch = version.sourceFactIds.some((factId) =>
    event.sourceFactIds.includes(factId)
  );
  const serializedRange = JSON.stringify(version.timelineRange ?? {}).toLowerCase();
  const normalizedAge = (version.age ?? '').toLowerCase();

  let score = sourceMatch ? 100 : 0;

  if (periodName && serializedRange.includes(periodName.toLowerCase())) {
    score += 30;
  }

  if (periodName && normalizedAge.includes(periodName.toLowerCase())) {
    score += 20;
  }

  if (hint === 'childhood' && (normalizedAge.includes('child') || normalizedAge.includes('дет'))) {
    score += 20;
  }

  return score;
}

function buildCharacterNameIndex(
  characters: readonly CharacterWithVersions[]
): Map<string, CharacterWithVersions> {
  const index = new Map<string, CharacterWithVersions>();

  for (const character of characters) {
    index.set(normalizeName(character.canonicalName), character);
    for (const alias of character.aliases) {
      index.set(normalizeName(alias.alias), character);
    }
  }

  return index;
}

function buildLocationNameIndex(
  locations: readonly LocationWithAliases[]
): Map<string, LocationWithAliases> {
  const index = new Map<string, LocationWithAliases>();

  for (const location of locations) {
    index.set(normalizeName(location.name), location);
    for (const alias of location.aliases) {
      index.set(normalizeName(alias.alias), location);
    }
  }

  return index;
}

function getFactValue(fact: MergeableTimelineFact): FactValue {
  const value =
    fact.value && typeof fact.value === 'object' && !Array.isArray(fact.value)
      ? fact.value
      : {};

  return {
    title: getString(value.title),
    description: getString(value.description),
    absoluteDate: getString(value.absoluteDate),
    relativeMarker: getString(value.relativeMarker),
    relativeOrderHint: getString(value.relativeOrderHint),
    anchorEventTitle: getString(value.anchorEventTitle),
    characterNames: getStringArray(value.characterNames),
    locationNames: getStringArray(value.locationNames),
    periodName: getString(value.periodName),
    candidateNames: getStringArray(value.candidateNames)
  };
}

function getRelativeMarkers(event: PlannedTimelineEvent): Prisma.JsonObject {
  return (event.relativeMarkers ?? {}) as Prisma.JsonObject;
}

function getString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

function getStringArray(value: unknown): readonly string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === 'string').map((item) => item.trim());
}

function parseAbsoluteDate(value: string | undefined): Date | undefined {
  if (!value) {
    return undefined;
  }

  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? undefined : date;
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

function mergeJsonObjects(
  left: Prisma.InputJsonObject | undefined,
  right: Prisma.InputJsonObject | undefined
): Prisma.InputJsonObject | undefined {
  if (!left) {
    return right;
  }

  if (!right) {
    return left;
  }

  return { ...left, ...right };
}

function uniqueResolved<T>(values: readonly (T | undefined)[]): readonly T[] {
  return values.filter((value, index): value is T => {
    if (value === undefined) {
      return false;
    }

    return values.indexOf(value) === index;
  });
}

function uniqueStrings(values: readonly (string | null | undefined)[]): readonly string[] {
  return [
    ...new Set(
      values
        .filter((value): value is string => typeof value === 'string')
        .map((value) => value.trim())
        .filter(Boolean)
    )
  ];
}

function normalizeName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ');
}

function average(values: readonly number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}
