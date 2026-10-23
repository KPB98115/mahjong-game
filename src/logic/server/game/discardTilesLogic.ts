import { type DbExecutor } from "../db/executor";
import { type DiscardTileRow, type DiscardTilesRepo } from "./discardTilesRepo";

export class DiscardTilesLogic {
  constructor(private discardTilesRepo: DiscardTilesRepo) {}

  async discard(
    roundId: string,
    seatIndex: number,
    tileCode: string,
    tx: DbExecutor,
  ): Promise<DiscardTileRow> {
    const last = await this.last(roundId, tx);
    return this.discardTilesRepo.insert(
      { roundId, seatIndex, tileCode, sortIndex: last == null ? 0 : last.sortIndex + 1 },
      tx,
    );
  }

  async last(roundId: string, tx?: DbExecutor): Promise<DiscardTileRow | undefined> {
    const discards = await this.discardTilesRepo.findByRoundId(roundId, tx);
    return discards[discards.length - 1];
  }

  async take(discard: DiscardTileRow, tx: DbExecutor): Promise<void> {
    await this.discardTilesRepo.deleteById(discard.id, tx);
  }
}
