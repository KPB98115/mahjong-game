import { flowerTiles } from "@schema";
import { and, asc, eq } from "drizzle-orm";
import { executor, type AppDatabase, type DbExecutor } from "../db/executor";

export type FlowerTileRow = typeof flowerTiles.$inferSelect;
export type NewFlowerTile = typeof flowerTiles.$inferInsert;

export class FlowerTilesRepo {
  constructor(readonly database: AppDatabase) {}

  async insert(values: NewFlowerTile, tx?: DbExecutor): Promise<FlowerTileRow> {
    const [row] = await executor(tx, this.database).insert(flowerTiles).values(values).returning();
    if (row == null) {
      throw new Error("insert flower tile returned no row");
    }
    return row;
  }

  async findByRoundId(roundId: string, tx?: DbExecutor): Promise<FlowerTileRow[]> {
    return executor(tx, this.database)
      .select()
      .from(flowerTiles)
      .where(eq(flowerTiles.roundId, roundId))
      .orderBy(asc(flowerTiles.seatIndex), asc(flowerTiles.sortIndex));
  }

  async findByRoundIdAndSeatIndex(
    roundId: string,
    seatIndex: number,
    tx?: DbExecutor,
  ): Promise<FlowerTileRow[]> {
    return executor(tx, this.database)
      .select()
      .from(flowerTiles)
      .where(and(eq(flowerTiles.roundId, roundId), eq(flowerTiles.seatIndex, seatIndex)))
      .orderBy(asc(flowerTiles.sortIndex));
  }
}
