import { melds } from "@schema";
import { and, asc, eq } from "void/db";
import { executor, type DbExecutor } from "../db/executor";

export type MeldRow = typeof melds.$inferSelect;
export type NewMeld = typeof melds.$inferInsert;

export class MeldsRepo {
  async insert(values: NewMeld, tx?: DbExecutor): Promise<MeldRow> {
    const [row] = await executor(tx).insert(melds).values(values).returning();
    if (row == null) {
      throw new Error("insert meld returned no row");
    }
    return row;
  }

  async findById(id: string, tx?: DbExecutor): Promise<MeldRow | undefined> {
    const [row] = await executor(tx).select().from(melds).where(eq(melds.id, id));
    return row;
  }

  async findByRoundId(roundId: string, tx?: DbExecutor): Promise<MeldRow[]> {
    return executor(tx)
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
    return executor(tx)
      .select()
      .from(melds)
      .where(and(eq(melds.roundId, roundId), eq(melds.seatIndex, seatIndex)))
      .orderBy(asc(melds.sortIndex));
  }
}
