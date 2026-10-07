declare module 'node-firebird' {
  export interface Options {
    host?: string;
    port?: number;
    database: string;
    user?: string;
    password?: string;
    lowercase_keys?: boolean;
    role?: string;
    pageSize?: number;
    retryConnectionInterval?: number;
    blobAsText?: boolean;
  }

  export interface Database {
    query(
      query: string,
      params: any[],
      callback: (err: any, result: any[]) => void
    ): void;
    query(
      query: string,
      callback: (err: any, result: any[]) => void
    ): void;
    execute(
      query: string,
      params: any[],
      callback: (err: any, result: any) => void
    ): void;
    transaction(
      isolation: any,
      callback: (err: any, transaction: Transaction) => void
    ): void;
    detach(callback?: (err: any) => void): void;
  }

  export interface Transaction {
    query(
      query: string,
      params: any[],
      callback: (err: any, result: any[]) => void
    ): void;
    query(
      query: string,
      callback: (err: any, result: any[]) => void
    ): void;
    commit(callback?: (err: any) => void): void;
    rollback(callback?: (err: any) => void): void;
  }

  export const ISOLATION_READ_COMMITTED_READ_ONLY: any;
  export const ISOLATION_READ_COMMITTED: any;
  export const ISOLATION_REPEATABLE_READ: any;
  export const ISOLATION_SERIALIZABLE: any;

  export function attach(
    options: Options,
    callback: (err: any, db: Database) => void
  ): void;

  export function pool(
    max: number,
    options: Options
  ): {
    get(callback: (err: any, db: Database) => void): void;
    destroy(callback?: () => void): void;
  };
}
