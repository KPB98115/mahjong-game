import { meldTiles } from "@schema";
import { asc, eq } from "drizzle-orm";
import { executor, type AppDatabase, type DbExecutor } from "../db/executor";

export type MeldTileRow = typeof meldTiles.$inferSelect;
export type NewMeldTile = typeof meldTiles.$inferInsert;

export class MeldTilesRepo {
  constructor(readonly database: AppDatabase) {}

  async insert(values: NewMeldTile, tx?: DbExecutor): Promise<MeldTileRow> {
    const [row] = await executor(tx, this.database).insert(meldTiles).values(values).returning();
    if (row == null) {
      throw new Error("insert meld tile returned no row");
    }
    return row;
  }

  async insertMany(values: NewMeldTile[], tx?: DbExecutor): Promise<MeldTileRow[]> {
    if (values.length === 0) {
      return [];
    }
    return executor(tx, this.database).insert(meldTiles).values(values).returning();
  }

  async findByMeldId(meldId: string, tx?: DbExecutor): Promise<MeldTileRow[]> {
    return executor(tx, this.database)
      .select()
      .from(meldTiles)
      .where(eq(meldTiles.meldId, meldId))
      .orderBy(asc(meldTiles.sortIndex));
  }
}
