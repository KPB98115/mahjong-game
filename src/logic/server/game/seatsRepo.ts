import { seats } from "@schema";
import { eq } from "void/db";
import { executor, type DbExecutor } from "../db/executor";

export type SeatRow = typeof seats.$inferSelect;

export class SeatsRepo {
  async findByUserId(userId: string, tx?: DbExecutor): Promise<SeatRow[]> {
    return executor(tx).select().from(seats).where(eq(seats.userId, userId));
  }
}
