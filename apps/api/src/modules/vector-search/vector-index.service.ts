import { createHash } from 'node:crypto';

import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service.js';
import { HashEmbeddingService } from './embedding.service.js';
import {
  VECTOR_PROVIDER,
  type VectorEntityType,
  type VectorPayload,
  type VectorPoint,
  type VectorProvider
} from './ports/vector-provider.js';

const PROJECT_VECTOR_INCLUDE = {
  book: true,
  bookAnalysis: {
    include: {
      chunks: true,
      worldBible: {
        include: {
          characters: {
            include: {
              versions: true
            }
          },
          locations: {
            include: {
              versions: true
            }
          },
          timelineEvents: true
        }
      }
    }
  },
  worldBible: {
    include: {
      characters: {
        include: {
          versions: true
        }
      },
      locations: {
        include: {
          versions: true
        }
      },
      timelineEvents: true
    }
  }
} satisfies Prisma.UserBookProjectInclude;

type ProjectVectorSource = Prisma.UserBookProjectGetPayload<{
  include: typeof PROJECT_VECTOR_INCLUDE;
}>;

type BookChunkVectorSource = NonNullable<ProjectVectorSource['bookAnalysis']>['chunks'][number];
type CharacterVectorSource = NonNullable<
  NonNullable<ProjectVectorSource['bookAnalysis']>['worldBible']
>['characters'][number];
type LocationVectorSource = NonNullable<
  NonNullable<ProjectVectorSource['bookAnalysis']>['worldBible']
>['locations'][number];
type TimelineEventVectorSource = NonNullable<
  NonNullable<ProjectVectorSource['bookAnalysis']>['worldBible']
>['timelineEvents'][number];

@Injectable()
export class VectorIndexService {
  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
    @Inject(HashEmbeddingService)
    private readonly embeddings: HashEmbeddingService,
    @Inject(VECTOR_PROVIDER)
    private readonly vectors: VectorProvider
  ) {}

  async indexProject(projectId: string): Promise<void> {
    const project = await this.prisma.userBookProject.findUnique({
      where: { id: projectId },
      include: PROJECT_VECTOR_INCLUDE
    });

    if (!project) {
      throw new NotFoundException('Project was not found.');
    }

    const points = this.createProjectPoints(project);

    await this.vectors.ensureCollection(this.embeddings.vectorSize);
    await this.vectors.deleteByFilter({ projectId });
    await this.vectors.upsert(points);
  }

  async indexBookChunks(
    chunks: readonly {
      readonly id: string;
      readonly bookId: string;
      readonly bookAnalysisId?: string;
      readonly chapterIndex: number;
      readonly orderIndex: number;
      readonly text: string;
    }[]
  ): Promise<void> {
    const points = chunks.map((chunk) =>
      this.createPoint(
        chunk.bookAnalysisId ?? chunk.bookId,
        'BookChunk',
        chunk.id,
        {
          bookId: chunk.bookId,
          ...(chunk.bookAnalysisId === undefined ? {} : { bookAnalysisId: chunk.bookAnalysisId }),
          entityType: 'BookChunk',
          entityId: chunk.id,
          sourceEntity: 'BookChunk',
          title: ['Chapter', String(chunk.chapterIndex), 'chunk', String(chunk.orderIndex)].join(
            ' '
          ),
          text: chunk.text,
          metadata: {
            chapterIndex: chunk.chapterIndex,
            orderIndex: chunk.orderIndex
          }
        }
      )
    );

    await this.vectors.ensureCollection(this.embeddings.vectorSize);
    await this.vectors.upsert(points);
  }

  private createProjectPoints(project: ProjectVectorSource): readonly VectorPoint[] {
    const worldBible = project.worldBible ?? project.bookAnalysis?.worldBible;
    const chunks = project.bookAnalysis?.chunks ?? [];

    return [
      ...chunks.map((chunk) => this.createChunkPoint(project, chunk)),
      ...(worldBible?.characters ?? []).flatMap((character) =>
        this.createCharacterVersionPoints(project, character)
      ),
      ...(worldBible?.locations ?? []).flatMap((location) =>
        this.createLocationVersionPoints(project, location)
      ),
      ...(worldBible?.timelineEvents ?? []).map((event) =>
        this.createTimelineEventPoint(project, event)
      )
    ];
  }

  private createChunkPoint(
    project: ProjectVectorSource,
    chunk: BookChunkVectorSource
  ): VectorPoint {
    return this.createPoint(project.id, 'BookChunk', chunk.id, {
      projectId: project.id,
      bookId: project.bookId,
      ...(project.bookAnalysisId === null ? {} : { bookAnalysisId: project.bookAnalysisId }),
      entityType: 'BookChunk',
      entityId: chunk.id,
      sourceEntity: 'BookChunk',
      title: [
        project.book.title,
        'chapter',
        String(chunk.chapterIndex),
        'chunk',
        String(chunk.orderIndex)
      ].join(' '),
      text: chunk.text,
      metadata: {
        chapterIndex: chunk.chapterIndex,
        orderIndex: chunk.orderIndex,
        startOffset: chunk.startOffset,
        endOffset: chunk.endOffset
      }
    });
  }

  private createCharacterVersionPoints(
    project: ProjectVectorSource,
    character: CharacterVectorSource
  ): readonly VectorPoint[] {
    return character.versions.map((version) => {
      const summary = [
        character.canonicalName,
        version.age,
        stringifyJson(version.timelineRange),
        stringifyJson(version.appearance),
        stringifyJson(version.personality),
        version.speechManner,
        stringifyJson(version.clothing),
        version.visualPrompt
      ]
        .filter(Boolean)
        .join('\n');

      return this.createPoint(project.id, 'CharacterVersion', version.id, {
        projectId: project.id,
        bookId: project.bookId,
        ...(project.bookAnalysisId === null ? {} : { bookAnalysisId: project.bookAnalysisId }),
        entityType: 'CharacterVersion',
        entityId: version.id,
        sourceEntity: 'CharacterVersion',
        title: [character.canonicalName, `v${String(version.version)}`].join(' '),
        text: summary,
        metadata: {
          characterId: version.characterId,
          version: version.version,
          confidenceScore: version.confidenceScore
        }
      });
    });
  }

  private createLocationVersionPoints(
    project: ProjectVectorSource,
    location: LocationVectorSource
  ): readonly VectorPoint[] {
    return location.versions.map((version) => {
      const summary = [
        location.name,
        version.description,
        stringifyJson(version.atmosphere),
        stringifyJson(version.palette),
        version.era,
        stringifyJson(version.socialContext),
        stringifyJson(version.lightingRules),
        stringifyJson(version.architectureRules),
        stringifyJson(version.recurringObjects)
      ]
        .filter(Boolean)
        .join('\n');

      return this.createPoint(project.id, 'LocationVersion', version.id, {
        projectId: project.id,
        bookId: project.bookId,
        ...(project.bookAnalysisId === null ? {} : { bookAnalysisId: project.bookAnalysisId }),
        entityType: 'LocationVersion',
        entityId: version.id,
        sourceEntity: 'LocationVersion',
        title: [location.name, `v${String(version.version)}`].join(' '),
        text: summary,
        metadata: {
          locationId: version.locationId,
          version: version.version,
          confidenceScore: version.confidenceScore
        }
      });
    });
  }

  private createTimelineEventPoint(
    project: ProjectVectorSource,
    event: TimelineEventVectorSource
  ): VectorPoint {
    const summary = [
      event.title,
      event.description,
      stringifyJson(event.relativeMarkers),
      `chapter:${String(event.chapterIndex)}`,
      `relativeOrder:${String(event.relativeOrder)}`
    ]
      .filter(Boolean)
      .join('\n');

    return this.createPoint(project.id, 'TimelineEvent', event.id, {
      projectId: project.id,
      bookId: project.bookId,
      ...(project.bookAnalysisId === null ? {} : { bookAnalysisId: project.bookAnalysisId }),
      entityType: 'TimelineEvent',
      entityId: event.id,
      sourceEntity: 'TimelineEvent',
      title: event.title,
      text: summary,
      metadata: {
        chapterIndex: event.chapterIndex,
        relativeOrder: event.relativeOrder,
        confidence: event.confidence
      }
    });
  }

  private createPoint(
    scopeId: string,
    entityType: VectorEntityType,
    entityId: string,
    payload: VectorPayload
  ): VectorPoint {
    return {
      id: createPointId(scopeId, entityType, entityId),
      vector: this.embeddings.embed(payload.text),
      payload
    };
  }
}

function createPointId(scopeId: string, entityType: VectorEntityType, entityId: string): string {
  const hash = createHash('sha256').update([scopeId, entityType, entityId].join(':')).digest('hex');

  return [
    hash.slice(0, 8),
    hash.slice(8, 12),
    `4${hash.slice(13, 16)}`,
    `${((Number.parseInt(hash.slice(16, 18), 16) & 0x3f) | 0x80).toString(16)}${hash.slice(18, 20)}`,
    hash.slice(20, 32)
  ].join('-');
}

function stringifyJson(value: Prisma.JsonValue | null | undefined): string | undefined {
  if (value === null || value === undefined) {
    return undefined;
  }

  if (typeof value === 'string') {
    return value;
  }

  return JSON.stringify(value);
}
