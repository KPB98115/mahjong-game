import type * as schema from "@schema";
import { type NodePgDatabase } from "drizzle-orm/node-postgres";

export type AppDatabase = NodePgDatabase<typeof schema>;
export type AppTransaction = Parameters<Parameters<AppDatabase["transaction"]>[0]>[0];
export type DbExecutor = AppDatabase | AppTransaction;
export type TransactionRunner = <T>(callback: (tx: AppTransaction) => Promise<T>) => Promise<T>;

export function executor(tx: DbExecutor | undefined, database: AppDatabase): DbExecutor {
  return tx ?? database;
}

export function transactionRunner(database: AppDatabase): TransactionRunner {
  return async function runTransaction<T>(
    callback: (tx: AppTransaction) => Promise<T>,
  ): Promise<T> {
    return database.transaction(async (tx) => callback(tx));
  };
}
