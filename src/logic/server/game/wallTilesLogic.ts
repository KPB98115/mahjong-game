import { type DbExecutor } from "../db/executor";
import { type WallTileRow, type WallTilesRepo } from "./wallTilesRepo";

export class WallTilesLogic {
  constructor(private wallTilesRepo: WallTilesRepo) {}

  async build(
    roundId: string,
    tileCodes: string[],
    startSortIndex: number,
    tx: DbExecutor,
  ): Promise<void> {
    await this.wallTilesRepo.insertMany(
      tileCodes.map((tileCode, offset) => ({
        roundId,
        tileCode,
        sortIndex: startSortIndex + offset,
      })),
      tx,
    );
  }

  async takeNext(roundId: string, tx: DbExecutor): Promise<WallTileRow | undefined> {
    const wall = await this.wallTilesRepo.findByRoundId(roundId, tx);
    return this.take(wall[0], tx);
  }

  async takeTail(roundId: string, tx: DbExecutor): Promise<WallTileRow | undefined> {
    const wall = await this.wallTilesRepo.findByRoundId(roundId, tx);
    return this.take(wall[wall.length - 1], tx);
  }

  async remainingCount(roundId: string, tx?: DbExecutor): Promise<number> {
    return (await this.wallTilesRepo.findByRoundId(roundId, tx)).length;
  }

  private async take(
    tile: WallTileRow | undefined,
    tx: DbExecutor,
  ): Promise<WallTileRow | undefined> {
    if (tile == null) {
      return undefined;
    }
    await this.wallTilesRepo.deleteById(tile.id, tx);
    return tile;
  }
}
