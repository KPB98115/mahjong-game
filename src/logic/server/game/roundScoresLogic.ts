import { UserFigureName } from "../../../types/server/profile";
import { type DbExecutor } from "../db/executor";
import { type UserRepo } from "../user/userRepo";
import { type RoundScoreRow, type RoundScoresRepo } from "./roundScoresRepo";
import { type PlannedPayment } from "./scorePaymentsLogic";
import { type SeatRow, type SeatsRepo } from "./seatsRepo";

export type RecordScoresInput = {
  roundId: string;
  seats: SeatRow[];
  payments: PlannedPayment[];
  winnerSeatIndex: number | null;
  scoreUnits: number | null;
};

export class RoundScoresLogic {
  constructor(
    private roundScoresRepo: RoundScoresRepo,
    private seatsRepo: SeatsRepo,
    private userRepo: UserRepo,
  ) {}

  async record(input: RecordScoresInput, tx: DbExecutor): Promise<RoundScoreRow[]> {
    const rows = [];
    for (const seat of input.seats) {
      const isWinner = seat.seatIndex === input.winnerSeatIndex;
      const scoreDelta = deltaFor(seat.seatIndex, input.payments);
      const scoreAfter = Number(seat.runningScore) + scoreDelta;
      rows.push({
        roundId: input.roundId,
        seatIndex: seat.seatIndex,
        userId: seat.userId,
        scoreDelta: String(scoreDelta),
        scoreAfter: String(scoreAfter),
        scoreUnits: isWinner && input.scoreUnits != null ? String(input.scoreUnits) : null,
        isWinner,
      });
      await this.seatsRepo.update(seat.id, { runningScore: String(scoreAfter) }, tx);
      await this.recordFigures(seat.userId, isWinner, scoreAfter, tx);
    }
    return this.roundScoresRepo.insertMany(rows, tx);
  }

  private async recordFigures(
    userId: string,
    isWinner: boolean,
    runningScore: number,
    tx: DbExecutor,
  ): Promise<void> {
    const figures = await this.userRepo.listFigures(userId, tx);
    function current(name: UserFigureName): number {
      const row = figures.find((figure) => figure.name === name);
      const value = row == null ? 0 : Number(row.value);
      return Number.isNaN(value) ? 0 : value;
    }
    const gamesPlayed = current(UserFigureName.GamesPlayed) + 1;
    const wins = current(UserFigureName.Wins) + (isWinner ? 1 : 0);
    await this.userRepo.upsertFigure(userId, UserFigureName.GamesPlayed, String(gamesPlayed), tx);
    await this.userRepo.upsertFigure(userId, UserFigureName.Wins, String(wins), tx);
    await this.userRepo.upsertFigure(userId, UserFigureName.RunningScore, String(runningScore), tx);
  }
}

function deltaFor(seatIndex: number, payments: PlannedPayment[]): number {
  let delta = 0;
  for (const payment of payments) {
    if (payment.toSeatIndex === seatIndex) {
      delta += payment.amount;
    }
    if (payment.fromSeatIndex === seatIndex) {
      delta -= payment.amount;
    }
  }
  return delta;
}
