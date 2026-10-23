import { games } from "@schema";
import { and, eq, isNotNull, lt } from "void/db";
import { executor, type DbExecutor } from "../db/executor";

export type GameRow = typeof games.$inferSelect;
export type NewGame = typeof games.$inferInsert;
export type GameUpdate = Partial<
  Pick<GameRow, "status" | "completedAt" | "updatedAt" | "prevailingWind">
>;

export class GamesRepo {
  async insert(values: NewGame, tx?: DbExecutor): Promise<GameRow> {
    const [row] = await executor(tx).insert(games).values(values).returning();
    if (row == null) {
      throw new Error("insert game returned no row");
    }
    return row;
  }

  async findById(id: string, tx?: DbExecutor): Promise<GameRow | undefined> {
    const [row] = await executor(tx).select().from(games).where(eq(games.id, id));
    return row;
  }

  async findByReferenceCode(referenceCode: string, tx?: DbExecutor): Promise<GameRow | undefined> {
    const [row] = await executor(tx)
      .select()
      .from(games)
      .where(eq(games.referenceCode, referenceCode));
    return row;
  }

  async update(id: string, values: GameUpdate, tx?: DbExecutor): Promise<GameRow | undefined> {
    const [row] = await executor(tx).update(games).set(values).where(eq(games.id, id)).returning();
    return row;
  }

  async delete(id: string, tx?: DbExecutor): Promise<void> {
    await executor(tx).delete(games).where(eq(games.id, id));
  }

  async listCompletedBefore(before: Date, tx?: DbExecutor): Promise<GameRow[]> {
    return executor(tx)
      .select()
      .from(games)
      .where(and(isNotNull(games.completedAt), lt(games.completedAt, before)));
  }
}
