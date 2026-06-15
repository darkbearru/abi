import { Module } from '@nestjs/common';

import { PrismaModule } from '../../prisma/prisma.module.js';
import { GraphQueryService } from './graph-query.service.js';
import { GraphSyncService } from './graph-sync.service.js';
import { KnowledgeGraphController } from './knowledge-graph.controller.js';
import { Neo4jGraphAdapter } from './neo4j-graph.adapter.js';
import { KNOWLEDGE_GRAPH_ADAPTER } from './ports/knowledge-graph.adapter.js';

@Module({
  imports: [PrismaModule],
  controllers: [KnowledgeGraphController],
  providers: [
    Neo4jGraphAdapter,
    {
      provide: KNOWLEDGE_GRAPH_ADAPTER,
      useExisting: Neo4jGraphAdapter
    },
    GraphSyncService,
    GraphQueryService
  ],
  exports: [GraphSyncService, GraphQueryService, KNOWLEDGE_GRAPH_ADAPTER]
})
export class KnowledgeGraphModule {}
