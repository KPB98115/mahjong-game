import { discardTiles } from "@schema";
import { asc, eq } from "drizzle-orm";
import { executor, type AppDatabase, type DbExecutor } from "../db/executor";

export type DiscardTileRow = typeof discardTiles.$inferSelect;
export type NewDiscardTile = typeof discardTiles.$inferInsert;

export class DiscardTilesRepo {
  constructor(readonly database: AppDatabase) {}

  async insert(values: NewDiscardTile, tx?: DbExecutor): Promise<DiscardTileRow> {
    const [row] = await executor(tx, this.database).insert(discardTiles).values(values).returning();
    if (row == null) {
      throw new Error("insert discard tile returned no row");
    }
    return row;
  }

  async findById(id: string, tx?: DbExecutor): Promise<DiscardTileRow | undefined> {
    const [row] = await executor(tx, this.database)
      .select()
      .from(discardTiles)
      .where(eq(discardTiles.id, id));
    return row;
  }

  async findByRoundId(roundId: string, tx?: DbExecutor): Promise<DiscardTileRow[]> {
    return executor(tx, this.database)
      .select()
      .from(discardTiles)
      .where(eq(discardTiles.roundId, roundId))
      .orderBy(asc(discardTiles.sortIndex));
  }

  async deleteById(id: string, tx?: DbExecutor): Promise<void> {
    await executor(tx, this.database).delete(discardTiles).where(eq(discardTiles.id, id));
  }
}
