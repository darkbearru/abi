import { Injectable, NotFoundException } from '@nestjs/common';
import type { ExtractedFactType, Prisma } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service.js';
import type {
  CharacterMergePlan,
  MergeableExtractedFact,
  PlannedCharacter,
  PlannedCharacterVersion,
  PlannedEntityConflict
} from './character-merge.types.js';

const CHARACTER_FACT_TYPES = new Set<ExtractedFactType>([
  'CHARACTER_MENTION',
  'CHARACTER_ALIAS',
  'CHARACTER_APPEARANCE',
  'CHARACTER_AGE',
  'CHARACTER_PERSONALITY',
  'CHARACTER_SPEECH_MANNER',
  'CHARACTER_RELATIONSHIP',
  'CHARACTER_PLOT_CHANGE',
  'CHARACTER_CANDIDATE'
]);

interface FactValue {
  readonly summary?: string;
  readonly candidateNames: readonly string[];
  readonly targetEntityName?: string;
  readonly relationshipType?: string;
  readonly change?: string;
}

interface CharacterFactGroup {
  readonly names: readonly string[];
  readonly facts: readonly MergeableExtractedFact[];
}

interface VersionSegment {
  readonly facts: MergeableExtractedFact[];
}

@Injectable()
export class CharacterMergeService {
  constructor(private readonly prisma: PrismaService) {}

  createMergePlan(facts: readonly MergeableExtractedFact[]): CharacterMergePlan {
    const characterFacts = facts.filter((fact) => CHARACTER_FACT_TYPES.has(fact.type));
    const groups = this.groupFactsByAliases(characterFacts);
    const characters = groups.map((group) => this.planCharacter(group));
    const conflicts = [
      ...characters.flatMap((character) => this.detectAttributeConflicts(character, groups)),
      ...this.detectPossibleDuplicates(characters)
    ];

    return {
      characters,
      conflicts
    };
  }

  async mergeProjectCharacters(projectId: string): Promise<CharacterMergePlan> {
    const context = await this.getMergeContext(projectId);
    const facts = await this.prisma.extractedFact.findMany({
      where: {
        bookAnalysisId: {
          in: [...context.bookAnalysisIds]
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
      where: {
        id: projectId
      },
      select: {
        id: true,
        seriesId: true,
        bookAnalysisId: true,
        worldBible: {
          select: {
            id: true
          }
        },
        bookAnalysis: {
          select: {
            id: true,
            worldBible: {
              select: {
                id: true
              }
            }
          }
        },
        books: {
          select: {
            bookAnalysisId: true,
            bookAnalysis: {
              select: {
                id: true
              }
            }
          },
          orderBy: {
            orderIndex: 'asc'
          }
        },
        series: {
          select: {
            worldBible: {
              select: {
                id: true
              }
            },
            books: {
              select: {
                book: {
                  select: {
                    analyses: {
                      select: {
                        id: true
                      },
                      orderBy: {
                        createdAt: 'desc'
                      },
                      take: 1
                    }
                  }
                }
              },
              orderBy: {
                orderIndex: 'asc'
              }
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
      return {
        bookAnalysisIds,
        worldBibleId: existingWorldBibleId
      };
    }

    const worldBible = await this.prisma.worldBible.create({
      data: {
        ...(project.seriesId
          ? { seriesId: project.seriesId }
          : { bookAnalysisId: primaryBookAnalysisId, projectId: project.id })
      },
      select: {
        id: true
      }
    });

    return {
      bookAnalysisIds,
      worldBibleId: worldBible.id
    };
  }

  private async persistMergePlan(
    worldBibleId: string,
    plan: CharacterMergePlan
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.entityConflict.deleteMany({
        where: {
          worldBibleId
        }
      });
      await tx.character.deleteMany({
        where: {
          worldBibleId
        }
      });

      const characterIdByName = new Map<string, string>();

      for (const character of plan.characters) {
        const created = await tx.character.create({
          data: {
            worldBibleId,
            canonicalName: character.canonicalName,
            aliases: {
              createMany: {
                data: character.aliases.map((alias) => ({ alias }))
              }
            },
            versions: {
              createMany: {
                data: character.versions.map((version) => ({
                  version: version.version,
                  ...(version.age === undefined ? {} : { age: version.age }),
                  appearance: version.appearance,
                  ...(version.personality === undefined
                    ? {}
                    : { personality: version.personality }),
                  ...(version.speechManner === undefined
                    ? {}
                    : { speechManner: version.speechManner }),
                  ...(version.clothing === undefined ? {} : { clothing: version.clothing }),
                  ...(version.timelineRange === undefined
                    ? {}
                    : { timelineRange: version.timelineRange }),
                  confidenceScore: version.confidenceScore,
                  sourceFactIds: [...version.sourceFactIds]
                }))
              }
            }
          },
          select: {
            id: true,
            canonicalName: true
          }
        });

        characterIdByName.set(created.canonicalName, created.id);
      }

      for (const conflict of plan.conflicts) {
        const characterId = conflict.characterCanonicalName
          ? characterIdByName.get(conflict.characterCanonicalName)
          : undefined;

        await tx.entityConflict.create({
          data: {
            worldBibleId,
            ...(characterId === undefined ? {} : { characterId }),
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
    facts: readonly MergeableExtractedFact[]
  ): readonly CharacterFactGroup[] {
    const union = new UnionFind();

    for (const fact of facts) {
      union.add(fact.entityName);
      const candidateNames = getFactValue(fact).candidateNames;

      for (const candidateName of candidateNames) {
        union.union(fact.entityName, candidateName);
      }
    }

    const factsByRoot = new Map<string, MergeableExtractedFact[]>();
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

  private planCharacter(group: CharacterFactGroup): PlannedCharacter {
    const canonicalName = chooseCanonicalName(group.names, group.facts);
    const aliases = group.names
      .filter((name) => normalizeName(name) !== normalizeName(canonicalName))
      .sort(compareNames);
    const versions = this.splitVersions(group.facts).map((segment, index) =>
      this.buildVersion(index + 1, segment)
    );

    return {
      canonicalName,
      aliases,
      versions: versions.length > 0 ? versions : [createEmptyVersion()],
      sourceFactIds: group.facts.map((fact) => fact.id)
    };
  }

  private splitVersions(facts: readonly MergeableExtractedFact[]): readonly VersionSegment[] {
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

  private buildVersion(version: number, segment: VersionSegment): PlannedCharacterVersion {
    const age = latestSummary(segment.facts, 'CHARACTER_AGE');
    const appearanceSummaries = summariesFor(segment.facts, 'CHARACTER_APPEARANCE');
    const personalitySummaries = summariesFor(segment.facts, 'CHARACTER_PERSONALITY');
    const speechManner = latestSummary(segment.facts, 'CHARACTER_SPEECH_MANNER');
    const clothingSummaries = summariesForTypeAndKeyword(
      segment.facts,
      'CHARACTER_APPEARANCE',
      ['clothing', 'clothes', 'dress', 'wears', 'одеж']
    );
    const firstChapter = Math.min(...segment.facts.map((fact) => fact.chapterIndex));
    const lastChapter = Math.max(...segment.facts.map((fact) => fact.chapterIndex));
    const timelineHints = uniqueStrings(
      segment.facts.flatMap((fact) => (fact.timelineHint ? [fact.timelineHint] : []))
    );

    return {
      version,
      ...(age === undefined ? {} : { age }),
      appearance: {
        summary:
          appearanceSummaries.length > 0
            ? appearanceSummaries.join(' ')
            : 'No reliable appearance facts extracted yet.'
      },
      ...(personalitySummaries.length === 0
        ? {}
        : { personality: { summary: personalitySummaries.join(' ') } }),
      ...(speechManner === undefined ? {} : { speechManner }),
      ...(clothingSummaries.length === 0
        ? {}
        : { clothing: { summary: clothingSummaries.join(' ') } }),
      timelineRange: {
        startChapterIndex: firstChapter,
        endChapterIndex: lastChapter,
        hints: [...timelineHints]
      },
      confidenceScore: average(segment.facts.map((fact) => fact.confidence)),
      sourceFactIds: segment.facts.map((fact) => fact.id)
    };
  }

  private detectAttributeConflicts(
    character: PlannedCharacter,
    groups: readonly CharacterFactGroup[]
  ): readonly PlannedEntityConflict[] {
    const group = groups.find((candidate) =>
      candidate.names.some((name) => normalizeName(name) === normalizeName(character.canonicalName))
    );

    if (!group) {
      return [];
    }

    return [
      ...detectTypeConflicts(character.canonicalName, group.facts, 'CHARACTER_AGE'),
      ...detectTypeConflicts(character.canonicalName, group.facts, 'CHARACTER_APPEARANCE'),
      ...detectTypeConflicts(character.canonicalName, group.facts, 'CHARACTER_PERSONALITY')
    ];
  }

  private detectPossibleDuplicates(
    characters: readonly PlannedCharacter[]
  ): readonly PlannedEntityConflict[] {
    const conflicts: PlannedEntityConflict[] = [];

    for (let leftIndex = 0; leftIndex < characters.length; leftIndex += 1) {
      for (let rightIndex = leftIndex + 1; rightIndex < characters.length; rightIndex += 1) {
        const left = characters[leftIndex];
        const right = characters[rightIndex];

        if (!left || !right || !looksLikePossibleDuplicate(left, right)) {
          continue;
        }

        conflicts.push({
          type: 'CHARACTER_POSSIBLE_DUPLICATE',
          summary: `Possible duplicate characters: ${left.canonicalName} and ${right.canonicalName}.`,
          options: {
            candidates: [
              {
                canonicalName: left.canonicalName,
                aliases: [...left.aliases]
              },
              {
                canonicalName: right.canonicalName,
                aliases: [...right.aliases]
              }
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

function startsNewVersion(segment: VersionSegment, fact: MergeableExtractedFact): boolean {
  if (fact.type === 'CHARACTER_PLOT_CHANGE') {
    return true;
  }

  if (fact.timelineHint && latestTimelineHint(segment.facts) && fact.timelineHint !== latestTimelineHint(segment.facts)) {
    return true;
  }

  if (fact.type === 'CHARACTER_AGE') {
    const currentAge = latestSummary(segment.facts, 'CHARACTER_AGE');
    const nextAge = getFactValue(fact).summary;

    return Boolean(currentAge && nextAge && normalizeText(currentAge) !== normalizeText(nextAge));
  }

  if (fact.type === 'CHARACTER_APPEARANCE' || fact.type === 'CHARACTER_PERSONALITY') {
    const currentSummary = latestSummary(segment.facts, fact.type);
    const nextSummary = getFactValue(fact).summary;

    return Boolean(
      currentSummary &&
        nextSummary &&
        fact.confidence >= 0.5 &&
        normalizeText(currentSummary) !== normalizeText(nextSummary)
    );
  }

  return false;
}

function detectTypeConflicts(
  characterCanonicalName: string,
  facts: readonly MergeableExtractedFact[],
  type: ExtractedFactType
): readonly PlannedEntityConflict[] {
  const factsWithSummaries = facts
    .filter((fact) => fact.type === type)
    .map((fact) => ({ fact, summary: getFactValue(fact).summary }))
    .filter((item): item is { readonly fact: MergeableExtractedFact; readonly summary: string } =>
      Boolean(item.summary)
    );
  const normalizedSummaries = uniqueStrings(
    factsWithSummaries.map((item) => normalizeText(item.summary))
  );

  if (normalizedSummaries.length <= 1) {
    return [];
  }

  return [
    {
      type: 'CHARACTER_ATTRIBUTE_CONFLICT',
      characterCanonicalName,
      summary: `Conflicting ${type.toLowerCase()} facts for ${characterCanonicalName}.`,
      options: {
        attributeType: type,
        values: factsWithSummaries.map((item) => ({
          factId: item.fact.id,
          value: item.summary,
          confidence: item.fact.confidence
        }))
      },
      sourceFactIds: factsWithSummaries.map((item) => item.fact.id)
    }
  ];
}

function getFactValue(fact: MergeableExtractedFact): FactValue {
  if (!isRecord(fact.value)) {
    return { candidateNames: [] };
  }

  const summary = typeof fact.value.summary === 'string' ? fact.value.summary : undefined;
  const targetEntityName =
    typeof fact.value.targetEntityName === 'string' ? fact.value.targetEntityName : undefined;
  const relationshipType =
    typeof fact.value.relationshipType === 'string' ? fact.value.relationshipType : undefined;
  const change = typeof fact.value.change === 'string' ? fact.value.change : undefined;
  const candidateNames = Array.isArray(fact.value.candidateNames)
    ? fact.value.candidateNames.filter((name): name is string => typeof name === 'string')
    : [];

  return {
    ...(summary === undefined ? {} : { summary }),
    candidateNames,
    ...(targetEntityName === undefined ? {} : { targetEntityName }),
    ...(relationshipType === undefined ? {} : { relationshipType }),
    ...(change === undefined ? {} : { change })
  };
}

function chooseCanonicalName(
  names: readonly string[],
  facts: readonly MergeableExtractedFact[]
): string {
  const counts = new Map<string, number>();

  for (const name of names) {
    counts.set(name, 0);
  }

  for (const fact of facts) {
    counts.set(fact.entityName, (counts.get(fact.entityName) ?? 0) + 1);
  }

  return [...counts.entries()]
    .sort((left, right) => {
      const countDelta = right[1] - left[1];

      if (countDelta !== 0) {
        return countDelta;
      }

      const titleDelta = Number(hasHonorific(left[0])) - Number(hasHonorific(right[0]));

      if (titleDelta !== 0) {
        return titleDelta;
      }

      const wordCountDelta = right[0].split(/\s+/).length - left[0].split(/\s+/).length;

      if (wordCountDelta !== 0) {
        return wordCountDelta;
      }

      return left[0].length - right[0].length;
    })[0]?.[0] ?? names[0] ?? 'Unknown Character';
}

function looksLikePossibleDuplicate(
  left: PlannedCharacter,
  right: PlannedCharacter
): boolean {
  const leftNames = [left.canonicalName, ...left.aliases].map(normalizeName);
  const rightNames = [right.canonicalName, ...right.aliases].map(normalizeName);

  return leftNames.some((leftName) =>
    rightNames.some((rightName) => {
      if (leftName === rightName) {
        return true;
      }

      const leftParts = leftName.split(' ');
      const rightParts = rightName.split(' ');
      const leftLast = leftParts.at(-1);
      const rightLast = rightParts.at(-1);

      return Boolean(leftLast && rightLast && leftLast === rightLast && leftLast.length > 2);
    })
  );
}

function latestSummary(
  facts: readonly MergeableExtractedFact[],
  type: ExtractedFactType
): string | undefined {
  const fact = [...facts]
    .reverse()
    .find((candidate) => candidate.type === type && getFactValue(candidate).summary);

  return fact ? getFactValue(fact).summary : undefined;
}

function summariesFor(
  facts: readonly MergeableExtractedFact[],
  type: ExtractedFactType
): readonly string[] {
  return uniqueStrings(
    facts
      .filter((fact) => fact.type === type)
      .flatMap((fact) => {
        const summary = getFactValue(fact).summary;

        return summary ? [summary] : [];
      })
  );
}

function summariesForTypeAndKeyword(
  facts: readonly MergeableExtractedFact[],
  type: ExtractedFactType,
  keywords: readonly string[]
): readonly string[] {
  return summariesFor(facts, type).filter((summary) => {
    const normalized = normalizeText(summary);

    return keywords.some((keyword) => normalized.includes(keyword));
  });
}

function latestTimelineHint(facts: readonly MergeableExtractedFact[]): string | undefined {
  return [...facts].reverse().find((fact) => fact.timelineHint)?.timelineHint ?? undefined;
}

function createEmptyVersion(): PlannedCharacterVersion {
  return {
    version: 1,
    appearance: {
      summary: 'No reliable appearance facts extracted yet.'
    },
    confidenceScore: 0,
    sourceFactIds: []
  };
}

function compareFacts(left: MergeableExtractedFact, right: MergeableExtractedFact): number {
  return left.chapterIndex - right.chapterIndex || left.id.localeCompare(right.id);
}

function compareNames(left: string, right: string): number {
  return normalizeName(left).localeCompare(normalizeName(right));
}

function normalizeName(name: string): string {
  return name
    .normalize('NFC')
    .trim()
    .toLowerCase()
    .replace(/^(mr|mrs|ms|miss|dr|sir|lady|lord)\.?\s+/i, '')
    .replace(/\s+/g, ' ');
}

function normalizeText(value: string): string {
  return value.normalize('NFC').trim().toLowerCase().replace(/\s+/g, ' ');
}

function hasHonorific(name: string): boolean {
  return /^(mr|mrs|ms|miss|dr|sir|lady|lord)\.?\s+/i.test(name.trim());
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

function isRecord(value: Prisma.JsonValue): value is Prisma.JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
