import { sessions } from "@schema";
import { eq } from "void/db";
import { executor, type DbExecutor } from "../db/executor";

export type SessionRow = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;
export type SessionUpdate = Partial<
  Pick<SessionRow, "isExpired" | "lastSeenAt" | "updatedAt" | "tokenHash">
>;

export class AuthRepo {
  async insert(values: NewSession, tx?: DbExecutor): Promise<SessionRow> {
    const [row] = await executor(tx).insert(sessions).values(values).returning();
    if (row === undefined) {
      throw new Error("insert session returned no row");
    }
    return row;
  }

  async findById(id: string, tx?: DbExecutor): Promise<SessionRow | undefined> {
    const [row] = await executor(tx).select().from(sessions).where(eq(sessions.id, id));
    return row;
  }

  async findByTokenHash(tokenHash: string, tx?: DbExecutor): Promise<SessionRow | undefined> {
    const [row] = await executor(tx)
      .select()
      .from(sessions)
      .where(eq(sessions.tokenHash, tokenHash));
    return row;
  }

  async update(
    id: string,
    values: SessionUpdate,
    tx?: DbExecutor,
  ): Promise<SessionRow | undefined> {
    const [row] = await executor(tx)
      .update(sessions)
      .set(values)
      .where(eq(sessions.id, id))
      .returning();
    return row;
  }
}
