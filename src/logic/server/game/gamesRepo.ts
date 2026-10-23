import { games } from "@schema";
import { and, eq, isNotNull, lt } from "drizzle-orm";
import { executor, type AppDatabase, type DbExecutor } from "../db/executor";

export type GameRow = typeof games.$inferSelect;
export type NewGame = typeof games.$inferInsert;
export type GameUpdate = Partial<
  Pick<GameRow, "status" | "completedAt" | "updatedAt" | "prevailingWind">
>;

export class GamesRepo {
  constructor(readonly database: AppDatabase) {}

  async insert(values: NewGame, tx?: DbExecutor): Promise<GameRow> {
    const [row] = await executor(tx, this.database).insert(games).values(values).returning();
    if (row == null) {
      throw new Error("insert game returned no row");
    }
    return row;
  }

  async findById(id: string, tx?: DbExecutor): Promise<GameRow | undefined> {
    const [row] = await executor(tx, this.database).select().from(games).where(eq(games.id, id));
    return row;
  }

  async lockById(id: string, tx: DbExecutor): Promise<GameRow | undefined> {
    const [row] = await executor(tx, this.database)
      .select()
      .from(games)
      .where(eq(games.id, id))
      .for("update");
    return row;
  }

  async findByReferenceCode(referenceCode: string, tx?: DbExecutor): Promise<GameRow | undefined> {
    const [row] = await executor(tx, this.database)
      .select()
      .from(games)
      .where(eq(games.referenceCode, referenceCode));
    return row;
  }

  async update(id: string, values: GameUpdate, tx?: DbExecutor): Promise<GameRow | undefined> {
    const [row] = await executor(tx, this.database)
      .update(games)
      .set(values)
      .where(eq(games.id, id))
      .returning();
    return row;
  }

  async delete(id: string, tx?: DbExecutor): Promise<void> {
    await executor(tx, this.database).delete(games).where(eq(games.id, id));
  }

  async listCompletedBefore(before: Date, tx?: DbExecutor): Promise<GameRow[]> {
    return executor(tx, this.database)
      .select()
      .from(games)
      .where(and(isNotNull(games.completedAt), lt(games.completedAt, before)));
  }
}
