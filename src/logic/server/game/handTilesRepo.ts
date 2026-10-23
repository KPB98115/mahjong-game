import { handTiles } from "@schema";
import { asc, eq } from "drizzle-orm";
import { executor, type AppDatabase, type DbExecutor } from "../db/executor";

export type HandTileRow = typeof handTiles.$inferSelect;
export type NewHandTile = typeof handTiles.$inferInsert;
export type HandTileUpdate = Partial<Pick<HandTileRow, "sortIndex" | "isDrawn">>;

export class HandTilesRepo {
  constructor(readonly database: AppDatabase) {}

  async insert(values: NewHandTile, tx?: DbExecutor): Promise<HandTileRow> {
    const [row] = await executor(tx, this.database).insert(handTiles).values(values).returning();
    if (row == null) {
      throw new Error("insert hand tile returned no row");
    }
    return row;
  }

  async insertMany(values: NewHandTile[], tx?: DbExecutor): Promise<HandTileRow[]> {
    if (values.length === 0) {
      return [];
    }
    return executor(tx, this.database).insert(handTiles).values(values).returning();
  }

  async findById(id: string, tx?: DbExecutor): Promise<HandTileRow | undefined> {
    const [row] = await executor(tx, this.database)
      .select()
      .from(handTiles)
      .where(eq(handTiles.id, id));
    return row;
  }

  async findByHandId(handId: string, tx?: DbExecutor): Promise<HandTileRow[]> {
    return executor(tx, this.database)
      .select()
      .from(handTiles)
      .where(eq(handTiles.handId, handId))
      .orderBy(asc(handTiles.sortIndex));
  }

  async update(
    id: string,
    values: HandTileUpdate,
    tx?: DbExecutor,
  ): Promise<HandTileRow | undefined> {
    const [row] = await executor(tx, this.database)
      .update(handTiles)
      .set(values)
      .where(eq(handTiles.id, id))
      .returning();
    return row;
  }

  async deleteById(id: string, tx?: DbExecutor): Promise<void> {
    await executor(tx, this.database).delete(handTiles).where(eq(handTiles.id, id));
  }
}
