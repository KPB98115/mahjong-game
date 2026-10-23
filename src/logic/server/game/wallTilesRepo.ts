import { wallTiles } from "@schema";
import { asc, eq } from "void/db";
import { executor, type DbExecutor } from "../db/executor";

export type WallTileRow = typeof wallTiles.$inferSelect;
export type NewWallTile = typeof wallTiles.$inferInsert;

export class WallTilesRepo {
  async insertMany(values: NewWallTile[], tx?: DbExecutor): Promise<WallTileRow[]> {
    if (values.length === 0) {
      return [];
    }
    return executor(tx).insert(wallTiles).values(values).returning();
  }

  async findById(id: string, tx?: DbExecutor): Promise<WallTileRow | undefined> {
    const [row] = await executor(tx).select().from(wallTiles).where(eq(wallTiles.id, id));
    return row;
  }

  async findByRoundId(roundId: string, tx?: DbExecutor): Promise<WallTileRow[]> {
    return executor(tx)
      .select()
      .from(wallTiles)
      .where(eq(wallTiles.roundId, roundId))
      .orderBy(asc(wallTiles.sortIndex));
  }

  async deleteById(id: string, tx?: DbExecutor): Promise<void> {
    await executor(tx).delete(wallTiles).where(eq(wallTiles.id, id));
  }
}
