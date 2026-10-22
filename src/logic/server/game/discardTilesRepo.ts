import { discardTiles } from "@schema";
import { asc, eq } from "void/db";
import { executor, type DbExecutor } from "../db/executor";

export type DiscardTileRow = typeof discardTiles.$inferSelect;
export type NewDiscardTile = typeof discardTiles.$inferInsert;

export class DiscardTilesRepo {
  async insert(values: NewDiscardTile, tx?: DbExecutor): Promise<DiscardTileRow> {
    const [row] = await executor(tx).insert(discardTiles).values(values).returning();
    if (row == null) {
      throw new Error("insert discard tile returned no row");
    }
    return row;
  }

  async findById(id: string, tx?: DbExecutor): Promise<DiscardTileRow | undefined> {
    const [row] = await executor(tx).select().from(discardTiles).where(eq(discardTiles.id, id));
    return row;
  }

  async findByRoundId(roundId: string, tx?: DbExecutor): Promise<DiscardTileRow[]> {
    return executor(tx)
      .select()
      .from(discardTiles)
      .where(eq(discardTiles.roundId, roundId))
      .orderBy(asc(discardTiles.sortIndex));
  }

  async deleteById(id: string, tx?: DbExecutor): Promise<void> {
    await executor(tx).delete(discardTiles).where(eq(discardTiles.id, id));
  }
}
