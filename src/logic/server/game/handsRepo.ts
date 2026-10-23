import { hands } from "@schema";
import { and, eq } from "void/db";
import { executor, type DbExecutor } from "../db/executor";

export type HandRow = typeof hands.$inferSelect;
export type NewHand = typeof hands.$inferInsert;

export class HandsRepo {
  async insert(values: NewHand, tx?: DbExecutor): Promise<HandRow> {
    const [row] = await executor(tx).insert(hands).values(values).returning();
    if (row == null) {
      throw new Error("insert hand returned no row");
    }
    return row;
  }

  async findById(id: string, tx?: DbExecutor): Promise<HandRow | undefined> {
    const [row] = await executor(tx).select().from(hands).where(eq(hands.id, id));
    return row;
  }

  async findByRoundId(roundId: string, tx?: DbExecutor): Promise<HandRow[]> {
    return executor(tx).select().from(hands).where(eq(hands.roundId, roundId));
  }

  async findByRoundIdAndSeatIndex(
    roundId: string,
    seatIndex: number,
    tx?: DbExecutor,
  ): Promise<HandRow | undefined> {
    const [row] = await executor(tx)
      .select()
      .from(hands)
      .where(and(eq(hands.roundId, roundId), eq(hands.seatIndex, seatIndex)));
    return row;
  }
}
