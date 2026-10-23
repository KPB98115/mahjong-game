import { type DbExecutor } from "../db/executor";
import { type MeldTileRow, type MeldTilesRepo } from "./meldTilesRepo";

export type MeldTileInput = {
  tileCode: string;
  isClaimed: boolean;
};

export class MeldTilesLogic {
  constructor(private meldTilesRepo: MeldTilesRepo) {}

  async add(
    meldId: string,
    tiles: MeldTileInput[],
    startSortIndex: number,
    tx: DbExecutor,
  ): Promise<MeldTileRow[]> {
    return this.meldTilesRepo.insertMany(
      tiles.map((tile, offset) => ({
        meldId,
        tileCode: tile.tileCode,
        sortIndex: startSortIndex + offset,
        isClaimed: tile.isClaimed,
      })),
      tx,
    );
  }

  async list(meldId: string, tx?: DbExecutor): Promise<MeldTileRow[]> {
    return this.meldTilesRepo.findByMeldId(meldId, tx);
  }
}
