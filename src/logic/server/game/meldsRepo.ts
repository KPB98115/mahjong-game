import { melds } from "@schema";
import { and, asc, eq } from "drizzle-orm";
import { executor, type AppDatabase, type DbExecutor } from "../db/executor";

export type MeldRow = typeof melds.$inferSelect;
export type NewMeld = typeof melds.$inferInsert;
export type MeldUpdate = Partial<Pick<MeldRow, "meldType">>;

export class MeldsRepo {
  constructor(readonly database: AppDatabase) {}

  async insert(values: NewMeld, tx?: DbExecutor): Promise<MeldRow> {
    const [row] = await executor(tx, this.database).insert(melds).values(values).returning();
    if (row == null) {
      throw new Error("insert meld returned no row");
    }
    return row;
  }

  async findById(id: string, tx?: DbExecutor): Promise<MeldRow | undefined> {
    const [row] = await executor(tx, this.database).select().from(melds).where(eq(melds.id, id));
    return row;
  }

  async findByRoundId(roundId: string, tx?: DbExecutor): Promise<MeldRow[]> {
    return executor(tx, this.database)
      .select()
      .from(melds)
      .where(eq(melds.roundId, roundId))
      .orderBy(asc(melds.seatIndex), asc(melds.sortIndex));
  }

  async findByRoundIdAndSeatIndex(
    roundId: string,
    seatIndex: number,
    tx?: DbExecutor,
  ): Promise<MeldRow[]> {
    return executor(tx, this.database)
      .select()
      .from(melds)
      .where(and(eq(melds.roundId, roundId), eq(melds.seatIndex, seatIndex)))
      .orderBy(asc(melds.sortIndex));
  }

  async update(id: string, values: MeldUpdate, tx?: DbExecutor): Promise<MeldRow | undefined> {
    const [row] = await executor(tx, this.database)
      .update(melds)
      .set(values)
      .where(eq(melds.id, id))
      .returning();
    return row;
  }
}
