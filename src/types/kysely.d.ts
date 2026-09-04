declare module "kysely" {
  export interface CompiledQuery {
    sql: string;
    parameters: unknown[];
  }

  export interface QueryResult<O> {
    rows: O[];
    numAffectedRows?: bigint;
  }

  export interface DatabaseConnection {
    executeQuery<O>(compiledQuery: CompiledQuery): Promise<QueryResult<O>>;
    streamQuery<O>(
      compiledQuery: CompiledQuery,
      chunkSize: number,
    ): AsyncIterableIterator<QueryResult<O>>;
  }

  export interface DatabaseIntrospector {}

  export interface Dialect {
    createAdapter(): any;
    createDriver(): Driver;
    createQueryCompiler(): QueryCompiler;
    createIntrospector(db: Kysely<unknown>): DatabaseIntrospector;
  }

  export interface Driver {
    init(): Promise<void>;
    acquireConnection(): Promise<DatabaseConnection>;
    releaseConnection(connection: DatabaseConnection): Promise<void>;
    beginTransaction(
      connection: DatabaseConnection,
      settings: TransactionSettings,
    ): Promise<void>;
    commitTransaction(connection: DatabaseConnection): Promise<void>;
    rollbackTransaction(connection: DatabaseConnection): Promise<void>;
    destroy(): Promise<void>;
  }

  export interface QueryCompiler {}

  export interface TransactionSettings {
    isolationLevel?: string;
  }

  export class CompiledQuery {
    static raw(sql: string, parameters?: unknown[]): CompiledQuery;
  }

  export class PostgresAdapter {}
  export class PostgresIntrospector implements DatabaseIntrospector {
    constructor(db: Kysely<unknown>);
  }
  export class PostgresQueryCompiler implements QueryCompiler {}

  export class Kysely<unknown> {}
}
