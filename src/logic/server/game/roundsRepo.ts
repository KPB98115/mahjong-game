import { rounds } from "@schema";
import { asc, eq } from "drizzle-orm";
import { executor, type AppDatabase, type DbExecutor } from "../db/executor";

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
  constructor(readonly database: AppDatabase) {}

  async insert(values: NewRound, tx?: DbExecutor): Promise<RoundRow> {
    const [row] = await executor(tx, this.database).insert(rounds).values(values).returning();
    if (row == null) {
      throw new Error("insert round returned no row");
    }
    return row;
  }

  async findById(id: string, tx?: DbExecutor): Promise<RoundRow | undefined> {
    const [row] = await executor(tx, this.database).select().from(rounds).where(eq(rounds.id, id));
    return row;
  }

  async findByGameId(gameId: string, tx?: DbExecutor): Promise<RoundRow[]> {
    return executor(tx, this.database)
      .select()
      .from(rounds)
      .where(eq(rounds.gameId, gameId))
      .orderBy(asc(rounds.roundIndex));
  }

  async update(id: string, values: RoundUpdate, tx?: DbExecutor): Promise<RoundRow | undefined> {
    const [row] = await executor(tx, this.database)
      .update(rounds)
      .set(values)
      .where(eq(rounds.id, id))
      .returning();
    return row;
  }
}
