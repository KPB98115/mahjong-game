/**
 * In-process script shim for `void/db`.
 *
 * The memory fakes (memoryGame.ts, fakeAuth.ts) assign `database: db` to satisfy
 * the TypeScript `AppDatabase` type on each repo, but they never issue SQL through it.
 * This shim supplies a placeholder so tsx can resolve the import without a live Void runtime.
 */
import type * as schema from "../../db/schema";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

// Cast so TypeScript accepts it as AppDatabase without executing any SQL.
export const db = {} as NodePgDatabase<typeof schema>;
