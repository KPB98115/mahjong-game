import { WinKind } from "../../../types/server/winKind";
import { type DbExecutor } from "../db/executor";
import { type ScorePaymentRow, type ScorePaymentsRepo } from "./scorePaymentsRepo";

export type PlannedPayment = {
  fromSeatIndex: number;
  toSeatIndex: number;
  amount: number;
};

export type PaymentPlanInput = {
  winKind: WinKind;
  winnerSeatIndex: number;
  discardFromSeatIndex: number | null;
  amount: number;
  seatIndexes: number[];
};

export class ScorePaymentsLogic {
  constructor(private scorePaymentsRepo: ScorePaymentsRepo) {}

  plan(input: PaymentPlanInput): PlannedPayment[] {
    const payers =
      input.winKind === WinKind.Discard && input.discardFromSeatIndex != null
        ? [input.discardFromSeatIndex]
        : input.seatIndexes.filter((seatIndex) => seatIndex !== input.winnerSeatIndex);
    return payers
      .filter((seatIndex) => seatIndex !== input.winnerSeatIndex)
      .map((fromSeatIndex) => ({
        fromSeatIndex,
        toSeatIndex: input.winnerSeatIndex,
        amount: input.amount,
      }));
  }

  async record(
    roundId: string,
    payments: PlannedPayment[],
    tx: DbExecutor,
  ): Promise<ScorePaymentRow[]> {
    return this.scorePaymentsRepo.insertMany(
      payments.map((payment) => ({
        roundId,
        fromSeatIndex: payment.fromSeatIndex,
        toSeatIndex: payment.toSeatIndex,
        amount: String(payment.amount),
      })),
      tx,
    );
  }
}
