import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma, RelationshipType } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service.js';
import {
  KNOWLEDGE_GRAPH_ADAPTER,
  type GraphParameters,
  type GraphStatement,
  type GraphValue,
  type KnowledgeGraphAdapter
} from './ports/knowledge-graph.adapter.js';

const NODE_LABELS = [
  'Book',
  'Project',
  'Character',
  'CharacterVersion',
  'Location',
  'LocationVersion',
  'WorldObject',
  'TimelineEvent',
  'Scene'
] as const;

const RELATIONSHIP_TYPES = [
  'APPEARS_IN',
  'LOCATED_IN',
  'KNOWS',
  'LOVES',
  'HATES',
  'RELATED_TO',
  'OWNS',
  'VISITS',
  'HAPPENS_AT',
  'BEFORE',
  'AFTER',
  'VERSION_OF'
] as const;

type NodeLabel = (typeof NODE_LABELS)[number];
type RelationshipLabel = (typeof RELATIONSHIP_TYPES)[number];

const WORLD_BIBLE_GRAPH_INCLUDE = {
  objects: true,
  characters: {
    include: {
      aliases: true,
      versions: true,
      outgoing: true,
      incoming: true
    }
  },
  locations: {
    include: {
      aliases: true,
      versions: true
    }
  },
  timelineEvents: {
    include: {
      characterVersions: true
    }
  }
} satisfies Prisma.WorldBibleInclude;

const PROJECT_GRAPH_INCLUDE = {
  book: true,
  books: {
    include: {
      book: true,
      bookAnalysis: true
    },
    orderBy: {
      orderIndex: 'asc'
    }
  },
  series: {
    include: {
      books: {
        include: {
          book: true
        },
        orderBy: {
          orderIndex: 'asc'
        }
      },
      worldBible: {
        include: WORLD_BIBLE_GRAPH_INCLUDE
      }
    }
  },
  scenes: true,
  worldBible: {
    include: WORLD_BIBLE_GRAPH_INCLUDE
  },
  bookAnalysis: {
    include: {
      worldBible: {
        include: WORLD_BIBLE_GRAPH_INCLUDE
      }
    }
  }
} satisfies Prisma.UserBookProjectInclude;

type ProjectGraphSource = Prisma.UserBookProjectGetPayload<{
  include: typeof PROJECT_GRAPH_INCLUDE;
}>;

type WorldBibleGraphSource = NonNullable<ProjectGraphSource['worldBible']>;
type CharacterGraphSource = WorldBibleGraphSource['characters'][number];
type LocationGraphSource = WorldBibleGraphSource['locations'][number];
type TimelineEventGraphSource = WorldBibleGraphSource['timelineEvents'][number];
type WorldObjectGraphSource = WorldBibleGraphSource['objects'][number];
type SceneGraphSource = ProjectGraphSource['scenes'][number];

@Injectable()
export class GraphSyncService {
  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
    @Inject(KNOWLEDGE_GRAPH_ADAPTER)
    private readonly graph: KnowledgeGraphAdapter
  ) {}

  async syncProject(projectId: string): Promise<void> {
    const project = await this.prisma.userBookProject.findUnique({
      where: { id: projectId },
      include: PROJECT_GRAPH_INCLUDE
    });

    if (!project) {
      throw new NotFoundException('Project was not found.');
    }

    const worldBible = project.series?.worldBible ?? project.worldBible ?? project.bookAnalysis?.worldBible;
    const statements = [
      ...createConstraintStatements(),
      deleteProjectGraph(projectId),
      ...this.buildProjectGraphStatements(project, worldBible)
    ];

    await this.graph.executeWrite(statements);
  }

  private buildProjectGraphStatements(
    project: ProjectGraphSource,
    worldBible: WorldBibleGraphSource | null | undefined
  ): readonly GraphStatement[] {
    const builder = new GraphStatementBuilder(project.id);

    builder.node('Project', project.id, {
      id: project.id,
      name: project.name,
      bookId: project.bookId,
      bookAnalysisId: project.bookAnalysisId,
      seriesId: project.seriesId,
      bookIds: getProjectBooks(project).map((book) => book.id),
      createdAt: project.createdAt,
      updatedAt: project.updatedAt
    });

    for (const book of getProjectBooks(project)) {
      builder.node('Book', book.id, {
        id: book.id,
        title: book.title,
        author: book.author,
        language: book.language,
        contentHash: book.contentHash,
        fileHash: book.fileHash
      });
      builder.relate(
        'Project',
        project.id,
        'RELATED_TO',
        'Book',
        book.id,
        { role: book.id === project.bookId ? 'primary-book' : 'series-book' }
      );
    }

    if (!worldBible) {
      return builder.statements;
    }

    for (const character of worldBible.characters) {
      this.addCharacter(builder, character);
    }

    for (const location of worldBible.locations) {
      this.addLocation(builder, location);
    }

    for (const object of worldBible.objects) {
      this.addWorldObject(builder, object);
    }

    for (const event of [...worldBible.timelineEvents].sort(compareTimelineEvents)) {
      this.addTimelineEvent(builder, event);
    }

    for (const scene of project.scenes) {
      this.addScene(builder, scene);
    }

    this.addCharacterRelationships(builder, worldBible.characters);
    this.addLocationHierarchy(builder, worldBible.locations);
    this.addWorldObjectRelationships(builder, worldBible.objects);
    this.addTimelineRelationships(builder, [...worldBible.timelineEvents].sort(compareTimelineEvents));
    this.addSceneRelationships(builder, project.scenes);

    return builder.statements;
  }

  private addCharacter(builder: GraphStatementBuilder, character: CharacterGraphSource): void {
    builder.node('Character', character.id, {
      id: character.id,
      canonicalName: character.canonicalName,
      aliases: character.aliases.map((alias) => alias.alias),
      createdAt: character.createdAt,
      updatedAt: character.updatedAt
    });
    builder.relate(
      'Project',
      builder.projectId,
      'RELATED_TO',
      'Character',
      character.id,
      { role: 'character' }
    );

    for (const version of character.versions) {
      builder.node('CharacterVersion', version.id, {
        id: version.id,
        characterId: version.characterId,
        version: version.version,
        age: version.age,
        timelineRange: version.timelineRange,
        appearance: version.appearance,
        personality: version.personality,
        speechManner: version.speechManner,
        clothing: version.clothing,
        confidenceScore: version.confidenceScore,
        sourceFactIds: version.sourceFactIds,
        createdAt: version.createdAt
      });
      builder.relate(
        'CharacterVersion',
        version.id,
        'VERSION_OF',
        'Character',
        character.id
      );
    }
  }

  private addLocation(builder: GraphStatementBuilder, location: LocationGraphSource): void {
    builder.node('Location', location.id, {
      id: location.id,
      name: location.name,
      parentId: location.parentId,
      aliases: location.aliases.map((alias) => alias.alias),
      createdAt: location.createdAt,
      updatedAt: location.updatedAt
    });
    builder.relate(
      'Project',
      builder.projectId,
      'RELATED_TO',
      'Location',
      location.id,
      { role: 'location' }
    );

    for (const version of location.versions) {
      builder.node('LocationVersion', version.id, {
        id: version.id,
        locationId: version.locationId,
        version: version.version,
        description: version.description,
        atmosphere: version.atmosphere,
        palette: version.palette,
        era: version.era,
        socialContext: version.socialContext,
        lightingRules: version.lightingRules,
        architectureRules: version.architectureRules,
        recurringObjects: version.recurringObjects,
        referenceAssetIds: version.referenceAssetIds,
        confidenceScore: version.confidenceScore,
        sourceFactIds: version.sourceFactIds,
        createdAt: version.createdAt
      });
      builder.relate('LocationVersion', version.id, 'VERSION_OF', 'Location', location.id);
    }
  }

  private addWorldObject(builder: GraphStatementBuilder, object: WorldObjectGraphSource): void {
    builder.node('WorldObject', object.id, {
      id: object.id,
      name: object.name,
      description: object.description,
      visualPrompt: object.visualPrompt,
      metadata: object.metadata,
      createdAt: object.createdAt,
      updatedAt: object.updatedAt
    });
    builder.relate(
      'Project',
      builder.projectId,
      'RELATED_TO',
      'WorldObject',
      object.id,
      { role: 'world-object' }
    );
  }

  private addTimelineEvent(
    builder: GraphStatementBuilder,
    event: TimelineEventGraphSource
  ): void {
    builder.node('TimelineEvent', event.id, {
      id: event.id,
      title: event.title,
      description: event.description,
      chapterIndex: event.chapterIndex,
      absoluteDate: event.absoluteDate,
      relativeOrder: event.relativeOrder,
      orderIndex: event.orderIndex,
      relativeMarkers: event.relativeMarkers,
      involvedCharacterIds: event.involvedCharacterIds,
      involvedLocationIds: event.involvedLocationIds,
      sourceChunkIds: event.sourceChunkIds,
      confidence: event.confidence,
      createdAt: event.createdAt,
      updatedAt: event.updatedAt
    });
    builder.relate(
      'Project',
      builder.projectId,
      'RELATED_TO',
      'TimelineEvent',
      event.id,
      { role: 'timeline-event' }
    );

    for (const characterId of event.involvedCharacterIds) {
      builder.relate('Character', characterId, 'APPEARS_IN', 'TimelineEvent', event.id);
    }

    for (const locationId of event.involvedLocationIds) {
      builder.relate('TimelineEvent', event.id, 'HAPPENS_AT', 'Location', locationId);
    }

    for (const link of event.characterVersions) {
      builder.relate(
        'CharacterVersion',
        link.characterVersionId,
        'APPEARS_IN',
        'TimelineEvent',
        event.id
      );
    }
  }

  private addScene(builder: GraphStatementBuilder, scene: SceneGraphSource): void {
    builder.node('Scene', scene.id, {
      id: scene.id,
      projectId: scene.projectId,
      title: scene.title,
      description: scene.description,
      status: scene.status,
      orderIndex: scene.orderIndex,
      prompt: scene.prompt,
      characterId: scene.characterId,
      locationId: scene.locationId,
      createdAt: scene.createdAt,
      updatedAt: scene.updatedAt
    });
    builder.relate('Project', builder.projectId, 'RELATED_TO', 'Scene', scene.id, {
      role: 'scene'
    });
  }

  private addCharacterRelationships(
    builder: GraphStatementBuilder,
    characters: readonly CharacterGraphSource[]
  ): void {
    for (const relationship of characters.flatMap((character) => character.outgoing)) {
      builder.relate(
        'Character',
        relationship.sourceCharacterId,
        mapCharacterRelationship(relationship.type),
        'Character',
        relationship.targetCharacterId,
        {
          id: relationship.id,
          description: relationship.description,
          timelineRange: relationship.timelineRange
        }
      );
    }
  }

  private addLocationHierarchy(
    builder: GraphStatementBuilder,
    locations: readonly LocationGraphSource[]
  ): void {
    for (const location of locations) {
      if (location.parentId) {
        builder.relate('Location', location.id, 'LOCATED_IN', 'Location', location.parentId);
      }
    }
  }

  private addWorldObjectRelationships(
    builder: GraphStatementBuilder,
    objects: readonly WorldObjectGraphSource[]
  ): void {
    for (const object of objects) {
      const metadata = asPlainObject(object.metadata);
      const ownerCharacterId = getString(metadata.ownerCharacterId);
      const locationId = getString(metadata.locationId);

      if (ownerCharacterId) {
        builder.relate('Character', ownerCharacterId, 'OWNS', 'WorldObject', object.id);
      }

      if (locationId) {
        builder.relate('WorldObject', object.id, 'LOCATED_IN', 'Location', locationId);
      }
    }
  }

  private addTimelineRelationships(
    builder: GraphStatementBuilder,
    events: readonly TimelineEventGraphSource[]
  ): void {
    for (let index = 0; index < events.length - 1; index += 1) {
      const current = events[index];
      const next = events[index + 1];

      if (!current || !next) {
        continue;
      }

      builder.relate('TimelineEvent', current.id, 'BEFORE', 'TimelineEvent', next.id);
      builder.relate('TimelineEvent', next.id, 'AFTER', 'TimelineEvent', current.id);
    }
  }

  private addSceneRelationships(
    builder: GraphStatementBuilder,
    scenes: readonly SceneGraphSource[]
  ): void {
    for (const scene of scenes) {
      if (scene.characterId) {
        builder.relate('Character', scene.characterId, 'APPEARS_IN', 'Scene', scene.id);
        builder.relate('Character', scene.characterId, 'VISITS', 'Scene', scene.id);
      }

      if (scene.locationId) {
        builder.relate('Scene', scene.id, 'HAPPENS_AT', 'Location', scene.locationId);
      }
    }
  }
}

class GraphStatementBuilder {
  private readonly collectedStatements: GraphStatement[] = [];

  constructor(public readonly projectId: string) {}

  get statements(): readonly GraphStatement[] {
    return this.collectedStatements;
  }

  node(label: NodeLabel, entityId: string, props: Record<string, unknown>): void {
    assertNodeLabel(label);
    this.collectedStatements.push({
      cypher: `MERGE (n:${label} {graphKey: $graphKey}) SET n = $props`,
      params: {
        graphKey: graphKey(this.projectId, label, entityId),
        props: toGraphMap({
          ...props,
          graphKey: graphKey(this.projectId, label, entityId),
          projectId: this.projectId,
          label
        })
      }
    });
  }

  relate(
    fromLabel: NodeLabel,
    fromId: string,
    type: RelationshipLabel,
    toLabel: NodeLabel,
    toId: string,
    props: Record<string, unknown> = {}
  ): void {
    assertNodeLabel(fromLabel);
    assertNodeLabel(toLabel);
    assertRelationshipLabel(type);
    this.collectedStatements.push({
      cypher: [
        `MATCH (from:${fromLabel} {graphKey: $fromGraphKey})`,
        `MATCH (to:${toLabel} {graphKey: $toGraphKey})`,
        `MERGE (from)-[relationship:${type}]->(to)`,
        'SET relationship += $props'
      ].join('\n'),
      params: {
        fromGraphKey: graphKey(this.projectId, fromLabel, fromId),
        toGraphKey: graphKey(this.projectId, toLabel, toId),
        props: toGraphMap({
          ...props,
          projectId: this.projectId,
          type
        })
      }
    });
  }
}

function createConstraintStatements(): readonly GraphStatement[] {
  return NODE_LABELS.map((label) => ({
    cypher: `CREATE CONSTRAINT abi_${label.toLowerCase()}_graph_key IF NOT EXISTS FOR (n:${label}) REQUIRE n.graphKey IS UNIQUE`,
    params: {}
  }));
}

function deleteProjectGraph(projectId: string): GraphStatement {
  return {
    cypher: 'MATCH (n {projectId: $projectId}) DETACH DELETE n',
    params: { projectId }
  };
}

function graphKey(projectId: string, label: NodeLabel, entityId: string): string {
  return [projectId, label, entityId].join(':');
}

function compareTimelineEvents(
  left: TimelineEventGraphSource,
  right: TimelineEventGraphSource
): number {
  return (
    left.relativeOrder - right.relativeOrder ||
    left.chapterIndex - right.chapterIndex ||
    left.orderIndex - right.orderIndex
  );
}

function getProjectBooks(project: ProjectGraphSource): readonly ProjectGraphSource['book'][] {
  const books = [
    project.book,
    ...project.books.map((link) => link.book),
    ...(project.series?.books.map((link) => link.book) ?? [])
  ];
  const seen = new Set<string>();
  const result: ProjectGraphSource['book'][] = [];

  for (const book of books) {
    if (!seen.has(book.id)) {
      seen.add(book.id);
      result.push(book);
    }
  }

  return result;
}

function mapCharacterRelationship(type: RelationshipType): RelationshipLabel {
  switch (type) {
    case 'KNOWS':
    case 'ALLY':
    case 'MENTOR':
      return 'KNOWS';
    case 'ROMANTIC':
      return 'LOVES';
    case 'ENEMY':
    case 'RIVAL':
      return 'HATES';
    case 'FAMILY':
    case 'SERVES':
    case 'OTHER':
      return 'RELATED_TO';
  }
}

function assertNodeLabel(label: string): asserts label is NodeLabel {
  if (!NODE_LABELS.includes(label as NodeLabel)) {
    throw new Error(`Unsupported graph node label: ${label}`);
  }
}

function assertRelationshipLabel(label: string): asserts label is RelationshipLabel {
  if (!RELATIONSHIP_TYPES.includes(label as RelationshipLabel)) {
    throw new Error(`Unsupported graph relationship label: ${label}`);
  }
}

function toGraphMap(value: Record<string, unknown>): GraphParameters {
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [key, toGraphValue(item)])
  );
}

function toGraphValue(value: unknown): GraphValue {
  if (value instanceof Date) {
    return value.toISOString();
  }

  if (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean' ||
    value === null ||
    value === undefined
  ) {
    return value ?? null;
  }

  if (Array.isArray(value)) {
    return value.map(toGraphValue);
  }

  if (typeof value === 'object') {
    return toGraphMap(value as Record<string, unknown>);
  }

  return JSON.stringify(value);
}

function asPlainObject(value: Prisma.JsonValue): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function getString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}
