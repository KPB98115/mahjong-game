import { type DbExecutor } from "../db/executor";
import { type HandTileRow, type HandTilesRepo } from "./handTilesRepo";

export class HandTilesLogic {
  constructor(private handTilesRepo: HandTilesRepo) {}

  async list(handId: string, tx?: DbExecutor): Promise<HandTileRow[]> {
    return this.handTilesRepo.findByHandId(handId, tx);
  }

  async deal(handId: string, tileCodes: string[], tx: DbExecutor): Promise<HandTileRow[]> {
    return this.handTilesRepo.insertMany(
      tileCodes.map((tileCode, sortIndex) => ({ handId, tileCode, sortIndex, isDrawn: false })),
      tx,
    );
  }

  async add(
    handId: string,
    tileCode: string,
    isDrawn: boolean,
    tx: DbExecutor,
  ): Promise<HandTileRow> {
    const tiles = await this.handTilesRepo.findByHandId(handId, tx);
    if (isDrawn) {
      await this.clearDrawn(tiles, tx);
    }
    const last = tiles[tiles.length - 1];
    return this.handTilesRepo.insert(
      { handId, tileCode, sortIndex: last == null ? 0 : last.sortIndex + 1, isDrawn },
      tx,
    );
  }

  pick(tiles: HandTileRow[], tileIds: string[]): HandTileRow[] | undefined {
    if (new Set(tileIds).size !== tileIds.length) {
      return undefined;
    }
    const picked: HandTileRow[] = [];
    for (const tileId of tileIds) {
      const tile = tiles.find((row) => row.id === tileId);
      if (tile == null) {
        return undefined;
      }
      picked.push(tile);
    }
    return picked;
  }

  async remove(tiles: HandTileRow[], tx: DbExecutor): Promise<void> {
    for (const tile of tiles) {
      await this.handTilesRepo.deleteById(tile.id, tx);
    }
  }

  async clearDrawn(tiles: HandTileRow[], tx: DbExecutor): Promise<void> {
    for (const tile of tiles) {
      if (tile.isDrawn) {
        await this.handTilesRepo.update(tile.id, { isDrawn: false }, tx);
      }
    }
  }
}
