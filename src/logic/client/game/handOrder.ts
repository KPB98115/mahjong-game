import { type HandTileModel } from "../../../model/client/handTileModel";
import { compareTileCodes } from "../../server/game/tileCode";

export function sortedHandTiles(tiles: HandTileModel[]): HandTileModel[] {
  return tiles
    .map((tile, index) => ({ tile, index }))
    .sort((left, right) => {
      const byCode = compareTileCodes(left.tile.tileCode, right.tile.tileCode);
      if (byCode !== 0) {
        return byCode;
      }
      return left.index - right.index;
    })
    .map((entry) => entry.tile);
}
