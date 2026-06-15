import { Injectable, OnModuleDestroy } from '@nestjs/common';
import neo4j, { type Driver } from 'neo4j-driver';

import type {
  GraphRecord,
  GraphStatement,
  KnowledgeGraphAdapter
} from './ports/knowledge-graph.adapter.js';

@Injectable()
export class Neo4jGraphAdapter implements KnowledgeGraphAdapter, OnModuleDestroy {
  private readonly driver: Driver;

  constructor() {
    this.driver = neo4j.driver(
      process.env.NEO4J_URI ?? 'bolt://localhost:7687',
      neo4j.auth.basic(
        process.env.NEO4J_USERNAME ?? 'neo4j',
        process.env.NEO4J_PASSWORD ?? 'please-change-me'
      )
    );
  }

  async executeWrite(statements: readonly GraphStatement[]): Promise<void> {
    if (statements.length === 0) {
      return;
    }

    const session = this.driver.session();

    try {
      await session.executeWrite(async (transaction) => {
        for (const statement of statements) {
          await transaction.run(statement.cypher, statement.params);
        }
      });
    } finally {
      await session.close();
    }
  }

  async executeRead<T>(
    statement: GraphStatement,
    mapRecord: (record: GraphRecord) => T
  ): Promise<readonly T[]> {
    const session = this.driver.session();

    try {
      const result = await session.executeRead((transaction) =>
        transaction.run(statement.cypher, statement.params)
      );

      return result.records.map((record) =>
        mapRecord({ get: (key): unknown => record.get(key) as unknown })
      );
    } finally {
      await session.close();
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.driver.close();
  }
}
