import { roundScores } from "@schema";
import { asc, eq } from "drizzle-orm";
import { executor, type AppDatabase, type DbExecutor } from "../db/executor";

export type RoundScoreRow = typeof roundScores.$inferSelect;
export type NewRoundScore = typeof roundScores.$inferInsert;

export class RoundScoresRepo {
  constructor(readonly database: AppDatabase) {}

  async insert(values: NewRoundScore, tx?: DbExecutor): Promise<RoundScoreRow> {
    const [row] = await executor(tx, this.database).insert(roundScores).values(values).returning();
    if (row == null) {
      throw new Error("insert round score returned no row");
    }
    return row;
  }

  async insertMany(values: NewRoundScore[], tx?: DbExecutor): Promise<RoundScoreRow[]> {
    if (values.length === 0) {
      return [];
    }
    return executor(tx, this.database).insert(roundScores).values(values).returning();
  }

  async findByRoundId(roundId: string, tx?: DbExecutor): Promise<RoundScoreRow[]> {
    return executor(tx, this.database)
      .select()
      .from(roundScores)
      .where(eq(roundScores.roundId, roundId))
      .orderBy(asc(roundScores.seatIndex));
  }
}
