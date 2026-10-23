import { flowerTiles } from "@schema";
import { and, asc, eq } from "void/db";
import { executor, type DbExecutor } from "../db/executor";

export type FlowerTileRow = typeof flowerTiles.$inferSelect;
export type NewFlowerTile = typeof flowerTiles.$inferInsert;

export class FlowerTilesRepo {
  async insert(values: NewFlowerTile, tx?: DbExecutor): Promise<FlowerTileRow> {
    const [row] = await executor(tx).insert(flowerTiles).values(values).returning();
    if (row == null) {
      throw new Error("insert flower tile returned no row");
    }
    return row;
  }

  async findByRoundId(roundId: string, tx?: DbExecutor): Promise<FlowerTileRow[]> {
    return executor(tx)
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
    return executor(tx)
      .select()
      .from(flowerTiles)
      .where(and(eq(flowerTiles.roundId, roundId), eq(flowerTiles.seatIndex, seatIndex)))
      .orderBy(asc(flowerTiles.sortIndex));
  }
}
