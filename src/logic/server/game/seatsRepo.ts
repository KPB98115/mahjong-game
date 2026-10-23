import { seats } from "@schema";
import { and, asc, eq } from "drizzle-orm";
import { executor, type AppDatabase, type DbExecutor } from "../db/executor";

export type SeatRow = typeof seats.$inferSelect;
export type NewSeat = typeof seats.$inferInsert;
export type SeatUpdate = Partial<Pick<SeatRow, "runningScore" | "nextWindAgreed">>;

export class SeatsRepo {
  constructor(readonly database: AppDatabase) {}

  async insert(values: NewSeat, tx?: DbExecutor): Promise<SeatRow> {
    const [row] = await executor(tx, this.database).insert(seats).values(values).returning();
    if (row == null) {
      throw new Error("insert seat returned no row");
    }
    return row;
  }

  async findById(id: string, tx?: DbExecutor): Promise<SeatRow | undefined> {
    const [row] = await executor(tx, this.database).select().from(seats).where(eq(seats.id, id));
    return row;
  }

  async findByGameId(gameId: string, tx?: DbExecutor): Promise<SeatRow[]> {
    return executor(tx, this.database)
      .select()
      .from(seats)
      .where(eq(seats.gameId, gameId))
      .orderBy(asc(seats.seatIndex));
  }

  async findByGameIdAndUserId(
    gameId: string,
    userId: string,
    tx?: DbExecutor,
  ): Promise<SeatRow | undefined> {
    const [row] = await executor(tx, this.database)
      .select()
      .from(seats)
      .where(and(eq(seats.gameId, gameId), eq(seats.userId, userId)));
    return row;
  }

  async findByUserId(userId: string, tx?: DbExecutor): Promise<SeatRow[]> {
    return executor(tx, this.database).select().from(seats).where(eq(seats.userId, userId));
  }

  async update(id: string, values: SeatUpdate, tx?: DbExecutor): Promise<SeatRow | undefined> {
    const [row] = await executor(tx, this.database)
      .update(seats)
      .set(values)
      .where(eq(seats.id, id))
      .returning();
    return row;
  }
}
