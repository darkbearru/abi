export type GraphPrimitive = string | number | boolean | null;
export type GraphValue = GraphPrimitive | readonly GraphValue[] | { readonly [key: string]: GraphValue };
export type GraphParameters = Readonly<Record<string, GraphValue>>;

export interface GraphStatement {
  readonly cypher: string;
  readonly params: GraphParameters;
}

export interface GraphRecord {
  get(key: string): unknown;
}

export interface KnowledgeGraphAdapter {
  executeWrite(statements: readonly GraphStatement[]): Promise<void>;
  executeRead<T>(
    statement: GraphStatement,
    mapRecord: (record: GraphRecord) => T
  ): Promise<readonly T[]>;
}

export const KNOWLEDGE_GRAPH_ADAPTER = 'ABI_KNOWLEDGE_GRAPH_ADAPTER';
