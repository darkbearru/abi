import { Injectable, NotFoundException } from '@nestjs/common';
import type { ExtractedFactType, Prisma } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service.js';
import type {
  LocationMergePlan,
  MergeableLocationFact,
  PlannedLocation,
  PlannedLocationConflict,
  PlannedLocationVersion
} from './location-merge.types.js';

const LOCATION_FACT_TYPES = new Set<ExtractedFactType>([
  'LOCATION_MENTION',
  'LOCATION_ALIAS',
  'LOCATION_HIERARCHY',
  'LOCATION_ATMOSPHERE',
  'LOCATION_ARCHITECTURE',
  'LOCATION_ERA',
  'LOCATION_SOCIAL_CONTEXT',
  'LOCATION_LIGHTING',
  'LOCATION_COLOR',
  'LOCATION_RECURRING_OBJECT',
  'LOCATION_CHANGE',
  'LOCATION_CANDIDATE'
]);

interface FactValue {
  readonly summary?: string;
  readonly candidateNames: readonly string[];
  readonly parentName?: string;
  readonly locationKind?: string;
  readonly atmosphere?: string;
  readonly architecture?: string;
  readonly era?: string;
  readonly socialContext?: string;
  readonly lighting?: string;
  readonly colors: readonly string[];
  readonly recurringObjects: readonly string[];
}

interface LocationFactGroup {
  readonly names: readonly string[];
  readonly facts: readonly MergeableLocationFact[];
}

interface VersionSegment {
  readonly facts: MergeableLocationFact[];
}

@Injectable()
export class LocationMergeService {
  constructor(private readonly prisma: PrismaService) {}

  createMergePlan(facts: readonly MergeableLocationFact[]): LocationMergePlan {
    const locationFacts = facts.filter((fact) => LOCATION_FACT_TYPES.has(fact.type));
    const groups = this.groupFactsByAliases(locationFacts);
    const locations = groups.map((group) => this.planLocation(group));
    const conflicts = [
      ...locations.flatMap((location) => this.detectAttributeConflicts(location, groups)),
      ...locations.flatMap((location) => this.detectParentConflicts(location, groups)),
      ...this.detectPossibleDuplicates(locations)
    ];

    return { locations, conflicts };
  }

  async mergeProjectLocations(projectId: string): Promise<LocationMergePlan> {
    const context = await this.getMergeContext(projectId);
    const facts = await this.prisma.extractedFact.findMany({
      where: {
        bookAnalysisId: {
          in: [...context.bookAnalysisIds]
        },
        type: {
          in: [...LOCATION_FACT_TYPES]
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

  private async persistMergePlan(worldBibleId: string, plan: LocationMergePlan): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.entityConflict.deleteMany({
        where: {
          worldBibleId,
          type: {
            in: [
              'LOCATION_POSSIBLE_DUPLICATE',
              'LOCATION_ATTRIBUTE_CONFLICT',
              'LOCATION_PARENT_CONFLICT'
            ]
          }
        }
      });
      await tx.location.deleteMany({
        where: { worldBibleId }
      });

      const locationIdByName = new Map<string, string>();

      for (const location of plan.locations) {
        const created = await tx.location.create({
          data: {
            worldBibleId,
            name: location.name,
            aliases: {
              createMany: {
                data: location.aliases.map((alias) => ({ alias }))
              }
            },
            versions: {
              createMany: {
                data: location.versions.map((version) => ({
                  version: version.version,
                  description: version.description,
                  ...(version.atmosphere === undefined
                    ? {}
                    : { atmosphere: version.atmosphere }),
                  ...(version.palette === undefined ? {} : { palette: version.palette }),
                  ...(version.era === undefined ? {} : { era: version.era }),
                  ...(version.socialContext === undefined
                    ? {}
                    : { socialContext: version.socialContext }),
                  ...(version.lightingRules === undefined
                    ? {}
                    : { lightingRules: version.lightingRules }),
                  ...(version.architectureRules === undefined
                    ? {}
                    : { architectureRules: version.architectureRules }),
                  ...(version.recurringObjects === undefined
                    ? {}
                    : { recurringObjects: version.recurringObjects }),
                  referenceAssetIds: [...version.referenceAssetIds],
                  confidenceScore: version.confidenceScore,
                  sourceFactIds: [...version.sourceFactIds]
                }))
              }
            }
          },
          select: { id: true, name: true }
        });

        locationIdByName.set(normalizeName(created.name), created.id);
        for (const alias of location.aliases) {
          locationIdByName.set(normalizeName(alias), created.id);
        }
      }

      for (const location of plan.locations) {
        if (!location.parentName) {
          continue;
        }

        const locationId = locationIdByName.get(normalizeName(location.name));
        const parentId = locationIdByName.get(normalizeName(location.parentName));

        if (locationId && parentId && locationId !== parentId) {
          await tx.location.update({
            where: { id: locationId },
            data: { parentId }
          });
        }
      }

      for (const conflict of plan.conflicts) {
        await tx.entityConflict.create({
          data: {
            worldBibleId,
            type: conflict.type,
            summary: conflict.summary,
            options: conflict.options,
            sourceFactIds: [...conflict.sourceFactIds]
          }
        });
      }
    });
  }

  private groupFactsByAliases(
    facts: readonly MergeableLocationFact[]
  ): readonly LocationFactGroup[] {
    const union = new UnionFind();

    for (const fact of facts) {
      union.add(fact.entityName);
      for (const candidateName of getFactValue(fact).candidateNames) {
        union.union(fact.entityName, candidateName);
      }
    }

    const factsByRoot = new Map<string, MergeableLocationFact[]>();
    const namesByRoot = new Map<string, Set<string>>();

    for (const fact of facts) {
      const root = union.find(fact.entityName);
      const groupedFacts = factsByRoot.get(root) ?? [];
      const groupedNames = namesByRoot.get(root) ?? new Set<string>();

      groupedFacts.push(fact);
      groupedNames.add(fact.entityName);
      for (const candidateName of getFactValue(fact).candidateNames) {
        groupedNames.add(candidateName);
      }

      factsByRoot.set(root, groupedFacts);
      namesByRoot.set(root, groupedNames);
    }

    return [...factsByRoot.entries()].map(([root, groupedFacts]) => ({
      names: [...(namesByRoot.get(root) ?? new Set<string>())].sort(compareNames),
      facts: groupedFacts.sort(compareFacts)
    }));
  }

  private planLocation(group: LocationFactGroup): PlannedLocation {
    const name = chooseCanonicalName(group.names, group.facts);
    const parentName = chooseParentName(group.facts);
    const aliases = group.names
      .filter((candidate) => normalizeName(candidate) !== normalizeName(name))
      .sort(compareNames);
    const versions = this.splitVersions(group.facts).map((segment, index) =>
      this.buildVersion(index + 1, segment)
    );

    return {
      name,
      ...(parentName === undefined ? {} : { parentName }),
      aliases,
      versions: versions.length > 0 ? versions : [createEmptyVersion()],
      sourceFactIds: group.facts.map((fact) => fact.id)
    };
  }

  private splitVersions(facts: readonly MergeableLocationFact[]): readonly VersionSegment[] {
    const sortedFacts = [...facts].sort(compareFacts);
    const segments: VersionSegment[] = [];
    let current: VersionSegment = { facts: [] };

    for (const fact of sortedFacts) {
      if (current.facts.length > 0 && startsNewVersion(current, fact)) {
        segments.push(current);
        current = { facts: [] };
      }

      current.facts.push(fact);
    }

    if (current.facts.length > 0) {
      segments.push(current);
    }

    return segments;
  }

  private buildVersion(version: number, segment: VersionSegment): PlannedLocationVersion {
    const summaries = uniqueStrings(segment.facts.flatMap((fact) => summaryList(fact)));
    const atmosphere = latestValue(segment.facts, 'atmosphere');
    const architecture = latestValue(segment.facts, 'architecture');
    const era = latestValue(segment.facts, 'era');
    const socialContext = latestValue(segment.facts, 'socialContext');
    const lighting = latestValue(segment.facts, 'lighting');
    const colors = uniqueStrings(segment.facts.flatMap((fact) => getFactValue(fact).colors));
    const recurringObjects = uniqueStrings(
      segment.facts.flatMap((fact) => getFactValue(fact).recurringObjects)
    );

    return {
      version,
      description: summaries.join(' ') || 'No reliable location description extracted yet.',
      ...(atmosphere === undefined ? {} : { atmosphere: { summary: atmosphere } }),
      ...(colors.length === 0 ? {} : { palette: { colors: [...colors] } }),
      ...(era === undefined ? {} : { era }),
      ...(socialContext === undefined ? {} : { socialContext: { summary: socialContext } }),
      ...(lighting === undefined ? {} : { lightingRules: { summary: lighting } }),
      ...(architecture === undefined
        ? {}
        : { architectureRules: { summary: architecture } }),
      ...(recurringObjects.length === 0
        ? {}
        : { recurringObjects: { items: [...recurringObjects] } }),
      referenceAssetIds: [],
      confidenceScore: average(segment.facts.map((fact) => fact.confidence)),
      sourceFactIds: segment.facts.map((fact) => fact.id)
    };
  }

  private detectAttributeConflicts(
    location: PlannedLocation,
    groups: readonly LocationFactGroup[]
  ): readonly PlannedLocationConflict[] {
    const group = groups.find((candidate) =>
      candidate.names.some((name) => normalizeName(name) === normalizeName(location.name))
    );

    if (!group) {
      return [];
    }

    return [
      ...detectValueConflicts(location.name, group.facts, 'architecture'),
      ...detectValueConflicts(location.name, group.facts, 'era'),
      ...detectValueConflicts(location.name, group.facts, 'lighting'),
      ...detectValueConflicts(location.name, group.facts, 'atmosphere')
    ];
  }

  private detectParentConflicts(
    location: PlannedLocation,
    groups: readonly LocationFactGroup[]
  ): readonly PlannedLocationConflict[] {
    const group = groups.find((candidate) =>
      candidate.names.some((name) => normalizeName(name) === normalizeName(location.name))
    );
    const parents = uniqueStrings(
      group?.facts.flatMap((fact) => {
        const parentName = getFactValue(fact).parentName;

        return parentName ? [parentName] : [];
      }) ?? []
    );

    if (parents.length <= 1) {
      return [];
    }

    return [
      {
        type: 'LOCATION_PARENT_CONFLICT',
        locationName: location.name,
        summary: `Conflicting parent locations for ${location.name}.`,
        options: { parents: [...parents] },
        sourceFactIds: group?.facts.map((fact) => fact.id) ?? []
      }
    ];
  }

  private detectPossibleDuplicates(
    locations: readonly PlannedLocation[]
  ): readonly PlannedLocationConflict[] {
    const conflicts: PlannedLocationConflict[] = [];

    for (let leftIndex = 0; leftIndex < locations.length; leftIndex += 1) {
      for (let rightIndex = leftIndex + 1; rightIndex < locations.length; rightIndex += 1) {
        const left = locations[leftIndex];
        const right = locations[rightIndex];

        if (!left || !right || !looksLikeDuplicate(left, right)) {
          continue;
        }

        conflicts.push({
          type: 'LOCATION_POSSIBLE_DUPLICATE',
          summary: `Possible duplicate locations: ${left.name} and ${right.name}.`,
          options: {
            candidates: [
              { name: left.name, aliases: [...left.aliases], parentName: left.parentName ?? null },
              { name: right.name, aliases: [...right.aliases], parentName: right.parentName ?? null }
            ]
          },
          sourceFactIds: [...left.sourceFactIds, ...right.sourceFactIds]
        });
      }
    }

    return conflicts;
  }
}

class UnionFind {
  private readonly parent = new Map<string, string>();

  add(name: string): void {
    const normalized = normalizeName(name);

    if (!this.parent.has(normalized)) {
      this.parent.set(normalized, normalized);
    }
  }

  find(name: string): string {
    const normalized = normalizeName(name);
    const parent = this.parent.get(normalized);

    if (!parent) {
      this.parent.set(normalized, normalized);
      return normalized;
    }

    if (parent === normalized) {
      return parent;
    }

    const root = this.find(parent);
    this.parent.set(normalized, root);
    return root;
  }

  union(left: string, right: string): void {
    const leftRoot = this.find(left);
    const rightRoot = this.find(right);

    if (leftRoot !== rightRoot) {
      this.parent.set(rightRoot, leftRoot);
    }
  }
}

function startsNewVersion(segment: VersionSegment, fact: MergeableLocationFact): boolean {
  if (fact.type === 'LOCATION_CHANGE') {
    return true;
  }

  if (
    fact.timelineHint &&
    latestTimelineHint(segment.facts) &&
    fact.timelineHint !== latestTimelineHint(segment.facts)
  ) {
    return true;
  }

  const currentEra = latestValue(segment.facts, 'era');
  const nextEra = getFactValue(fact).era;

  return Boolean(currentEra && nextEra && normalizeText(currentEra) !== normalizeText(nextEra));
}

function detectValueConflicts(
  locationName: string,
  facts: readonly MergeableLocationFact[],
  key: keyof Pick<FactValue, 'architecture' | 'era' | 'lighting' | 'atmosphere'>
): readonly PlannedLocationConflict[] {
  const values = facts
    .map((fact) => ({ fact, value: getFactValue(fact)[key] }))
    .filter((item): item is { readonly fact: MergeableLocationFact; readonly value: string } =>
      Boolean(item.value)
    );
  const distinct = uniqueStrings(values.map((item) => normalizeText(item.value)));

  if (distinct.length <= 1) {
    return [];
  }

  return [
    {
      type: 'LOCATION_ATTRIBUTE_CONFLICT',
      locationName,
      summary: `Conflicting ${key} facts for ${locationName}.`,
      options: {
        attributeType: key,
        values: values.map((item) => ({
          factId: item.fact.id,
          value: item.value,
          confidence: item.fact.confidence
        }))
      },
      sourceFactIds: values.map((item) => item.fact.id)
    }
  ];
}

function getFactValue(fact: MergeableLocationFact): FactValue {
  if (!isRecord(fact.value)) {
    return { candidateNames: [], colors: [], recurringObjects: [] };
  }

  const summary = readString(fact.value.summary);
  const parentName = readString(fact.value.parentName);
  const locationKind = readString(fact.value.locationKind);
  const atmosphere = readString(fact.value.atmosphere);
  const architecture = readString(fact.value.architecture);
  const era = readString(fact.value.era);
  const socialContext = readString(fact.value.socialContext);
  const lighting = readString(fact.value.lighting);

  return {
    ...(summary === undefined ? {} : { summary }),
    candidateNames: readStringArray(fact.value.candidateNames),
    ...(parentName === undefined ? {} : { parentName }),
    ...(locationKind === undefined ? {} : { locationKind }),
    ...(atmosphere === undefined ? {} : { atmosphere }),
    ...(architecture === undefined ? {} : { architecture }),
    ...(era === undefined ? {} : { era }),
    ...(socialContext === undefined ? {} : { socialContext }),
    ...(lighting === undefined ? {} : { lighting }),
    colors: readStringArray(fact.value.colors),
    recurringObjects: readStringArray(fact.value.recurringObjects)
  };
}

function summaryList(fact: MergeableLocationFact): readonly string[] {
  const value = getFactValue(fact);

  return [
    value.summary,
    value.atmosphere,
    value.architecture,
    value.era,
    value.socialContext,
    value.lighting
  ].filter((item): item is string => Boolean(item));
}

function chooseCanonicalName(
  names: readonly string[],
  facts: readonly MergeableLocationFact[]
): string {
  const counts = new Map<string, number>();

  for (const name of names) {
    counts.set(name, 0);
  }

  for (const fact of facts) {
    counts.set(fact.entityName, (counts.get(fact.entityName) ?? 0) + 1);
  }

  return [...counts.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].length - right[0].length)
    .at(0)?.[0] ?? names.at(0) ?? 'Unknown Location';
}

function chooseParentName(facts: readonly MergeableLocationFact[]): string | undefined {
  const counts = new Map<string, number>();

  for (const fact of facts) {
    const parentName = getFactValue(fact).parentName;

    if (parentName) {
      counts.set(parentName, (counts.get(parentName) ?? 0) + 1);
    }
  }

  return [...counts.entries()].sort((left, right) => right[1] - left[1]).at(0)?.[0];
}

function latestValue(
  facts: readonly MergeableLocationFact[],
  key: keyof Pick<FactValue, 'atmosphere' | 'architecture' | 'era' | 'socialContext' | 'lighting'>
): string | undefined {
  const fact = [...facts].reverse().find((candidate) => getFactValue(candidate)[key]);

  return fact ? getFactValue(fact)[key] : undefined;
}

function latestTimelineHint(facts: readonly MergeableLocationFact[]): string | undefined {
  return [...facts].reverse().find((fact) => fact.timelineHint)?.timelineHint ?? undefined;
}

function looksLikeDuplicate(left: PlannedLocation, right: PlannedLocation): boolean {
  const leftKeys = [left.name, ...left.aliases].map(looseDuplicateKey);
  const rightKeys = [right.name, ...right.aliases].map(looseDuplicateKey);

  return leftKeys.some((leftKey) =>
    rightKeys.some((rightKey) => leftKey === rightKey && leftKey.length > 2)
  );
}

function createEmptyVersion(): PlannedLocationVersion {
  return {
    version: 1,
    description: 'No reliable location description extracted yet.',
    referenceAssetIds: [],
    confidenceScore: 0,
    sourceFactIds: []
  };
}

function compareFacts(left: MergeableLocationFact, right: MergeableLocationFact): number {
  return left.chapterIndex - right.chapterIndex || left.id.localeCompare(right.id);
}

function compareNames(left: string, right: string): number {
  return normalizeName(left).localeCompare(normalizeName(right));
}

function normalizeName(name: string): string {
  return name.normalize('NFC').trim().toLowerCase().replace(/\s+/g, ' ');
}

function looseDuplicateKey(name: string): string {
  return normalizeName(name)
    .replace(/^the\s+/, '')
    .replace(/\b(city|park|square|street|district|building|room|apartment)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeText(value: string): string {
  return value.normalize('NFC').trim().toLowerCase().replace(/\s+/g, ' ');
}

function average(values: readonly number[]): number {
  if (values.length === 0) {
    return 0;
  }

  return Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(4));
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

function readString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value : undefined;
}

function readStringArray(value: unknown): readonly string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    : [];
}

function isRecord(value: Prisma.JsonValue): value is Prisma.JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
