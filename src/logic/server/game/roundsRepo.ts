import { rounds } from "@schema";
import { asc, eq } from "void/db";
import { executor, type DbExecutor } from "../db/executor";

export type RoundRow = typeof rounds.$inferSelect;
export type NewRound = typeof rounds.$inferInsert;
export type RoundUpdate = Partial<
  Pick<
    RoundRow,
    | "phase"
    | "currentSeatIndex"
    | "resultType"
    | "winKind"
    | "winnerSeatIndex"
    | "discardFromSeatIndex"
    | "status"
    | "updatedAt"
  >
>;

export class RoundsRepo {
  async insert(values: NewRound, tx?: DbExecutor): Promise<RoundRow> {
    const [row] = await executor(tx).insert(rounds).values(values).returning();
    if (row == null) {
      throw new Error("insert round returned no row");
    }
    return row;
  }

  async findById(id: string, tx?: DbExecutor): Promise<RoundRow | undefined> {
    const [row] = await executor(tx).select().from(rounds).where(eq(rounds.id, id));
    return row;
  }

  async findByGameId(gameId: string, tx?: DbExecutor): Promise<RoundRow[]> {
    return executor(tx)
      .select()
      .from(rounds)
      .where(eq(rounds.gameId, gameId))
      .orderBy(asc(rounds.roundIndex));
  }

  async update(id: string, values: RoundUpdate, tx?: DbExecutor): Promise<RoundRow | undefined> {
    const [row] = await executor(tx)
      .update(rounds)
      .set(values)
      .where(eq(rounds.id, id))
      .returning();
    return row;
  }
}
