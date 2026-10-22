import { scorePayments } from "@schema";
import { eq } from "void/db";
import { executor, type DbExecutor } from "../db/executor";

export type ScorePaymentRow = typeof scorePayments.$inferSelect;
export type NewScorePayment = typeof scorePayments.$inferInsert;

export class ScorePaymentsRepo {
  async insert(values: NewScorePayment, tx?: DbExecutor): Promise<ScorePaymentRow> {
    const [row] = await executor(tx).insert(scorePayments).values(values).returning();
    if (row == null) {
      throw new Error("insert score payment returned no row");
    }
    return row;
  }

  async insertMany(values: NewScorePayment[], tx?: DbExecutor): Promise<ScorePaymentRow[]> {
    if (values.length === 0) {
      return [];
    }
    return executor(tx).insert(scorePayments).values(values).returning();
  }

  async findByRoundId(roundId: string, tx?: DbExecutor): Promise<ScorePaymentRow[]> {
    return executor(tx).select().from(scorePayments).where(eq(scorePayments.roundId, roundId));
  }
}
