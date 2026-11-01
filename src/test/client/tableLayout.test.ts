import { describe, expect, it } from "vitest";
import {
  ExposedEdge,
  TableSide,
  concealedCount,
  discardRows,
  exposedEdge,
  placeSeats,
  seatWind,
  tableSide,
  tilesFromHand,
} from "../../logic/client/game/tableLayout";
import { MeldType } from "../../types/server/meldType";
import { PrevailingWind } from "../../types/server/prevailingWind";
import { RoundPhase } from "../../types/server/roundPhase";

const seats = [0, 1, 2, 3].map((seatIndex) => ({
  seatIndex,
  displayName: `P${seatIndex}`,
  runningScore: seatIndex * 10,
  connected: seatIndex !== 2,
}));

describe("table placement", () => {
  it("keeps the player at the bottom and the next seat on the right", () => {
    expect(tableSide(0, 0)).toBe(TableSide.Self);
    expect(tableSide(0, 1)).toBe(TableSide.Right);
    expect(tableSide(0, 2)).toBe(TableSide.Across);
    expect(tableSide(0, 3)).toBe(TableSide.Left);
    expect(seatWind(0, 0)).toBe(PrevailingWind.East);
    expect(seatWind(0, 1)).toBe(PrevailingWind.South);
    expect(seatWind(0, 3)).toBe(PrevailingWind.North);
  });

  it("puts the east player on the right when this player sits north", () => {
    const placed = placeSeats({
      selfSeatIndex: 3,
      dealerSeatIndex: 0,
      handTileCount: 13,
      phase: RoundPhase.Discard,
      currentSeatIndex: 0,
      seats,
      discards: [],
      melds: [],
      flowers: [],
    });
    const east = placed.find((seat) => seat.wind === PrevailingWind.East);
    expect(east?.side).toBe(TableSide.Right);
    expect(east?.exposedEdge).toBe(ExposedEdge.After);
    expect(placed.find((seat) => seat.isSelf)?.wind).toBe(PrevailingWind.North);
    expect(placed.find((seat) => seat.isSelf)?.exposedEdge).toBe(ExposedEdge.Start);
  });

  it("lays exposed tiles on each player's left", () => {
    expect(exposedEdge(TableSide.Self)).toBe(ExposedEdge.Start);
    expect(exposedEdge(TableSide.Right)).toBe(ExposedEdge.After);
    expect(exposedEdge(TableSide.Across)).toBe(ExposedEdge.End);
    expect(exposedEdge(TableSide.Left)).toBe(ExposedEdge.Before);
  });

  it("counts a face-down hand after an open pong, and one extra tile on the discard turn", () => {
    const pong = {
      isConcealed: false,
      tiles: [{ isClaimed: false }, { isClaimed: false }, { isClaimed: true }],
    };
    expect(tilesFromHand(pong)).toBe(2);
    expect(
      concealedCount({
        handTileCount: 13,
        tilesFromHand: 2,
        isCurrent: false,
        phase: RoundPhase.Discard,
      }),
    ).toBe(11);
    expect(
      concealedCount({
        handTileCount: 13,
        tilesFromHand: 2,
        isCurrent: true,
        phase: RoundPhase.Discard,
      }),
    ).toBe(12);
    expect(
      tilesFromHand({
        isConcealed: true,
        tiles: [
          { isClaimed: false },
          { isClaimed: false },
          { isClaimed: false },
          { isClaimed: false },
        ],
      }),
    ).toBe(4);
  });

  it("groups each seat's discards in rows and marks the newest tile", () => {
    const placed = placeSeats({
      selfSeatIndex: 0,
      dealerSeatIndex: 0,
      handTileCount: 13,
      phase: RoundPhase.Claim,
      currentSeatIndex: 1,
      seats,
      discards: [
        { seatIndex: 0, tileCode: "man_1", sortIndex: 0 },
        { seatIndex: 1, tileCode: "east", sortIndex: 7 },
        { seatIndex: 0, tileCode: "man_2", sortIndex: 1 },
        { seatIndex: 0, tileCode: "man_3", sortIndex: 2 },
        { seatIndex: 0, tileCode: "man_4", sortIndex: 3 },
        { seatIndex: 0, tileCode: "man_5", sortIndex: 4 },
        { seatIndex: 0, tileCode: "man_6", sortIndex: 5 },
        { seatIndex: 0, tileCode: "man_7", sortIndex: 6 },
      ],
      melds: [
        {
          seatIndex: 1,
          meldType: MeldType.Pong,
          isConcealed: false,
          sortIndex: 0,
          tiles: [
            { tileCode: "dot_9", sortIndex: 0, isClaimed: false },
            { tileCode: "dot_9", sortIndex: 1, isClaimed: false },
            { tileCode: "dot_9", sortIndex: 2, isClaimed: true },
          ],
        },
      ],
      flowers: [{ seatIndex: 0, tileCode: "flower_plum", sortIndex: 0 }],
    });
    const self = placed.find((seat) => seat.isSelf);
    expect(discardRows(self?.discards ?? []).map((row) => row.length)).toEqual([6, 1]);
    expect(self?.discards.at(-1)?.isLatest).toBe(false);
    expect(placed.find((seat) => seat.seatIndex === 1)?.discards[0]?.isLatest).toBe(true);
    expect(self?.flowers.map((tile) => tile.tileCode)).toEqual(["flower_plum"]);
    expect(placed.find((seat) => seat.seatIndex === 1)?.melds[0]?.tiles).toHaveLength(3);
    expect(placed.find((seat) => seat.seatIndex === 1)?.concealedCount).toBe(11);
  });
});
