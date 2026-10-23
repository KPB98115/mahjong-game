import { wallTiles } from "@schema";
import { asc, eq } from "drizzle-orm";
import { executor, type AppDatabase, type DbExecutor } from "../db/executor";

export type WallTileRow = typeof wallTiles.$inferSelect;
export type NewWallTile = typeof wallTiles.$inferInsert;

export class WallTilesRepo {
  constructor(readonly database: AppDatabase) {}

  async insertMany(values: NewWallTile[], tx?: DbExecutor): Promise<WallTileRow[]> {
    if (values.length === 0) {
      return [];
    }
    return executor(tx, this.database).insert(wallTiles).values(values).returning();
  }

  async findById(id: string, tx?: DbExecutor): Promise<WallTileRow | undefined> {
    const [row] = await executor(tx, this.database)
      .select()
      .from(wallTiles)
      .where(eq(wallTiles.id, id));
    return row;
  }

  async findByRoundId(roundId: string, tx?: DbExecutor): Promise<WallTileRow[]> {
    return executor(tx, this.database)
      .select()
      .from(wallTiles)
      .where(eq(wallTiles.roundId, roundId))
      .orderBy(asc(wallTiles.sortIndex));
  }

  async deleteById(id: string, tx?: DbExecutor): Promise<void> {
    await executor(tx, this.database).delete(wallTiles).where(eq(wallTiles.id, id));
  }
}
