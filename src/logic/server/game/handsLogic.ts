import { type DbExecutor } from "../db/executor";
import { type HandRow, type HandsRepo } from "./handsRepo";

export class HandsLogic {
  constructor(private handsRepo: HandsRepo) {}

  async create(roundId: string, seatIndex: number, tx: DbExecutor): Promise<HandRow> {
    return this.handsRepo.insert({ roundId, seatIndex }, tx);
  }

  async findForSeat(
    roundId: string,
    seatIndex: number,
    tx?: DbExecutor,
  ): Promise<HandRow | undefined> {
    return this.handsRepo.findByRoundIdAndSeatIndex(roundId, seatIndex, tx);
  }

  async requireForSeat(roundId: string, seatIndex: number, tx?: DbExecutor): Promise<HandRow> {
    const hand = await this.findForSeat(roundId, seatIndex, tx);
    if (hand == null) {
      throw new Error(`hand for seat ${seatIndex} is missing`);
    }
    return hand;
  }
}
