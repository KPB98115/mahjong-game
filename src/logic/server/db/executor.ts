import { db } from "void/db";

export type AppDatabase = typeof db;
export type AppTransaction = Parameters<Parameters<AppDatabase["transaction"]>[0]>[0];
export type DbExecutor = AppDatabase | AppTransaction;

export function executor(tx: DbExecutor | undefined): DbExecutor {
  return tx ?? db;
}

export async function runTransaction<T>(callback: (tx: AppTransaction) => Promise<T>): Promise<T> {
  return db.transaction(async (tx) => callback(tx));
}
