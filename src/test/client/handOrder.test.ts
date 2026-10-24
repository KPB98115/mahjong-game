import { describe, expect, it } from "vitest";
import { sortedHandTiles } from "../../logic/client/game/handOrder";
import { type HandTileModel } from "../../model/client/handTileModel";

function tile(id: string, tileCode: string, sortIndex: number, isDrawn = false): HandTileModel {
  return { id, tileCode, sortIndex, isDrawn };
}

describe("sortedHandTiles", () => {
  it("groups by suit then honor and ranks each group ascending", () => {
    const tiles = [
      tile("dot", "dot_9", 0),
      tile("man-high", "man_2", 1),
      tile("east", "east", 2),
      tile("man-low", "man_1", 3, true),
      tile("bam", "bam_1", 4),
      tile("red", "red", 5),
      tile("man-high-again", "man_2", 6),
    ];
    expect(sortedHandTiles(tiles).map((entry) => entry.id)).toEqual([
      "man-low",
      "man-high",
      "man-high-again",
      "bam",
      "dot",
      "east",
      "red",
    ]);
  });
});
