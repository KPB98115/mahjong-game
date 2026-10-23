import { type DbExecutor } from "../db/executor";
import { type FlowerTileRow, type FlowerTilesRepo } from "./flowerTilesRepo";
import { isBonusTileCode } from "./wallTileCodes";

export class FlowerTilesLogic {
  constructor(private flowerTilesRepo: FlowerTilesRepo) {}

  setsAside(tileCode: string, bonusTilesEnabled: boolean): boolean {
    return bonusTilesEnabled && isBonusTileCode(tileCode);
  }

  async place(
    roundId: string,
    seatIndex: number,
    tileCode: string,
    tx: DbExecutor,
  ): Promise<FlowerTileRow> {
    const placed = await this.flowerTilesRepo.findByRoundIdAndSeatIndex(roundId, seatIndex, tx);
    const last = placed[placed.length - 1];
    return this.flowerTilesRepo.insert(
      { roundId, seatIndex, tileCode, sortIndex: last == null ? 0 : last.sortIndex + 1 },
      tx,
    );
  }

  async listForSeat(roundId: string, seatIndex: number, tx?: DbExecutor): Promise<string[]> {
    const rows = await this.flowerTilesRepo.findByRoundIdAndSeatIndex(roundId, seatIndex, tx);
    return rows.map((row) => row.tileCode);
  }
}
