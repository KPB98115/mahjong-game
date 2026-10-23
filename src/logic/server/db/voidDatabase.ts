import { db } from "void/db";
import { transactionRunner, type AppDatabase } from "./executor";

export const voidDatabase: AppDatabase = db;
export const runTransaction = transactionRunner(voidDatabase);
