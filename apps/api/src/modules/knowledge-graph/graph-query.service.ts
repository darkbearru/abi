import { Inject, Injectable } from '@nestjs/common';

import type {
  ProjectGraphResponseDto,
  SceneEntitiesResponseDto
} from './dto/project-graph.response.dto.js';
import {
  KNOWLEDGE_GRAPH_ADAPTER,
  type GraphRecord,
  type KnowledgeGraphAdapter
} from './ports/knowledge-graph.adapter.js';

@Injectable()
export class GraphQueryService {
  constructor(
    @Inject(KNOWLEDGE_GRAPH_ADAPTER)
    private readonly graph: KnowledgeGraphAdapter
  ) {}

  async getProjectGraph(projectId: string): Promise<ProjectGraphResponseDto> {
    return this.readGraph(
      {
        nodesCypher:
          'MATCH (n {projectId: $projectId}) RETURN n.graphKey AS id, labels(n) AS labels, properties(n) AS properties ORDER BY n.label, n.id',
        relationshipsCypher:
          'MATCH (source {projectId: $projectId})-[relationship]->(target {projectId: $projectId}) RETURN elementId(relationship) AS id, type(relationship) AS type, source.graphKey AS source, target.graphKey AS target, properties(relationship) AS properties ORDER BY type, source, target'
      },
      { projectId }
    );
  }

  async findCharacterContext(
    projectId: string,
    characterIdOrName: string
  ): Promise<ProjectGraphResponseDto> {
    return this.readGraph(
      {
        nodesCypher:
          'MATCH (character:Character {projectId: $projectId}) WHERE character.id = $characterIdOrName OR toLower(character.canonicalName) = toLower($characterIdOrName) MATCH path = (character)-[*0..2]-(node {projectId: $projectId}) WITH DISTINCT node RETURN node.graphKey AS id, labels(node) AS labels, properties(node) AS properties ORDER BY node.label, node.id',
        relationshipsCypher:
          'MATCH (character:Character {projectId: $projectId}) WHERE character.id = $characterIdOrName OR toLower(character.canonicalName) = toLower($characterIdOrName) MATCH (character)-[*0..2]-(node {projectId: $projectId}) WITH collect(DISTINCT node.graphKey) AS graphKeys MATCH (source {projectId: $projectId})-[relationship]-(target {projectId: $projectId}) WHERE source.graphKey IN graphKeys AND target.graphKey IN graphKeys RETURN elementId(relationship) AS id, type(relationship) AS type, source.graphKey AS source, target.graphKey AS target, properties(relationship) AS properties ORDER BY type, source, target'
      },
      { projectId, characterIdOrName }
    );
  }

  async findLocationContext(
    projectId: string,
    locationIdOrName: string
  ): Promise<ProjectGraphResponseDto> {
    return this.readGraph(
      {
        nodesCypher:
          'MATCH (location:Location {projectId: $projectId}) WHERE location.id = $locationIdOrName OR toLower(location.name) = toLower($locationIdOrName) MATCH path = (location)-[*0..2]-(node {projectId: $projectId}) WITH DISTINCT node RETURN node.graphKey AS id, labels(node) AS labels, properties(node) AS properties ORDER BY node.label, node.id',
        relationshipsCypher:
          'MATCH (location:Location {projectId: $projectId}) WHERE location.id = $locationIdOrName OR toLower(location.name) = toLower($locationIdOrName) MATCH (location)-[*0..2]-(node {projectId: $projectId}) WITH collect(DISTINCT node.graphKey) AS graphKeys MATCH (source {projectId: $projectId})-[relationship]-(target {projectId: $projectId}) WHERE source.graphKey IN graphKeys AND target.graphKey IN graphKeys RETURN elementId(relationship) AS id, type(relationship) AS type, source.graphKey AS source, target.graphKey AS target, properties(relationship) AS properties ORDER BY type, source, target'
      },
      { projectId, locationIdOrName }
    );
  }

  async resolveSceneEntities(
    projectId: string,
    sceneId: string
  ): Promise<SceneEntitiesResponseDto> {
    const [entities] = await this.graph.executeRead(
      {
        cypher:
          'MATCH (scene:Scene {projectId: $projectId, id: $sceneId}) OPTIONAL MATCH (character:Character {projectId: $projectId})-[:APPEARS_IN]->(scene) OPTIONAL MATCH (scene)-[:HAPPENS_AT]->(location:Location {projectId: $projectId}) OPTIONAL MATCH (object:WorldObject {projectId: $projectId})-[:LOCATED_IN]->(location) RETURN collect(DISTINCT character.id) AS characterIds, collect(DISTINCT location.id) AS locationIds, collect(DISTINCT object.id) AS worldObjectIds',
        params: { projectId, sceneId }
      },
      (record) => ({
        characterIds: getStringArray(record.get('characterIds')),
        locationIds: getStringArray(record.get('locationIds')),
        worldObjectIds: getStringArray(record.get('worldObjectIds'))
      })
    );

    return entities ?? { characterIds: [], locationIds: [], worldObjectIds: [] };
  }

  private async readGraph(
    query: {
      readonly nodesCypher: string;
      readonly relationshipsCypher: string;
    },
    params: Record<string, string>
  ): Promise<ProjectGraphResponseDto> {
    const [nodes, relationships] = await Promise.all([
      this.graph.executeRead(
        {
          cypher: query.nodesCypher,
          params
        },
        mapNodeRecord
      ),
      this.graph.executeRead(
        {
          cypher: query.relationshipsCypher,
          params
        },
        mapRelationshipRecord
      )
    ]);

    return {
      nodes,
      relationships
    };
  }
}

function mapNodeRecord(record: GraphRecord): ProjectGraphResponseDto['nodes'][number] {
  return {
    id: getString(record.get('id')) ?? '',
    labels: getStringArray(record.get('labels')),
    properties: getProperties(record.get('properties'))
  };
}

function mapRelationshipRecord(
  record: GraphRecord
): ProjectGraphResponseDto['relationships'][number] {
  return {
    id: getString(record.get('id')) ?? '',
    type: getString(record.get('type')) ?? '',
    source: getString(record.get('source')) ?? '',
    target: getString(record.get('target')) ?? '',
    properties: getProperties(record.get('properties'))
  };
}

function getString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

function getStringArray(value: unknown): readonly string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === 'string');
}

function getProperties(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? normalizeNeo4jRecord(value as Record<string, unknown>)
    : {};
}

function normalizeNeo4jRecord(value: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [key, normalizeNeo4jValue(item)])
  );
}

function normalizeNeo4jValue(value: unknown): unknown {
  if (isNeo4jInteger(value)) {
    return value.toNumber();
  }

  if (Array.isArray(value)) {
    return value.map(normalizeNeo4jValue);
  }

  if (value && typeof value === 'object') {
    return normalizeNeo4jRecord(value as Record<string, unknown>);
  }

  return value;
}

function isNeo4jInteger(value: unknown): value is { toNumber: () => number } {
  return (
    value !== null &&
    typeof value === 'object' &&
    'toNumber' in value &&
    typeof (value as { readonly toNumber?: unknown }).toNumber === 'function'
  );
}
