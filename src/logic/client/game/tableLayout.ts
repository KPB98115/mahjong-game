import { type MeldType } from "../../../types/server/meldType";
import { PrevailingWind } from "../../../types/server/prevailingWind";
import { RoundPhase } from "../../../types/server/roundPhase";

export enum TableSide {
  Self = "self",
  Right = "right",
  Across = "across",
  Left = "left",
}

export enum ExposedEdge {
  Start = "start",
  End = "end",
  After = "after",
  Before = "before",
}

const seatCount = 4;
const winds: PrevailingWind[] = [
  PrevailingWind.East,
  PrevailingWind.South,
  PrevailingWind.West,
  PrevailingWind.North,
];
const sides: TableSide[] = [TableSide.Self, TableSide.Right, TableSide.Across, TableSide.Left];

export const discardRowLength = 6;

export type LayoutSeat = {
  seatIndex: number;
  displayName: string | null;
  runningScore: number;
  connected: boolean;
};

export type LayoutDiscard = {
  seatIndex: number;
  tileCode: string;
  sortIndex: number;
};

export type LayoutFlower = {
  seatIndex: number;
  tileCode: string;
  sortIndex: number;
};

export type LayoutMeldTile = {
  tileCode: string;
  sortIndex: number;
  isClaimed: boolean;
};

export type LayoutMeld = {
  seatIndex: number;
  meldType: MeldType;
  isConcealed: boolean;
  sortIndex: number;
  tiles: LayoutMeldTile[];
};

export type PlacedTile = {
  tileCode: string;
  sortIndex: number;
  isLatest: boolean;
};

export type PlacedMeld = {
  meldType: MeldType;
  sortIndex: number;
  tiles: PlacedTile[];
};

export type SeatPlace = {
  seatIndex: number;
  side: TableSide;
  exposedEdge: ExposedEdge;
  wind: PrevailingWind;
  displayName: string | null;
  score: number;
  connected: boolean;
  isSelf: boolean;
  isCurrent: boolean;
  concealedCount: number;
  discards: PlacedTile[];
  melds: PlacedMeld[];
  flowers: PlacedTile[];
};

export function seatDistance(fromSeatIndex: number, toSeatIndex: number): number {
  return (toSeatIndex - fromSeatIndex + seatCount) % seatCount;
}

export function tableSide(selfSeatIndex: number, seatIndex: number): TableSide {
  return sides[seatDistance(selfSeatIndex, seatIndex)] ?? TableSide.Self;
}

export function seatWind(dealerSeatIndex: number, seatIndex: number): PrevailingWind {
  return winds[seatDistance(dealerSeatIndex, seatIndex)] ?? PrevailingWind.East;
}

export function exposedEdge(side: TableSide): ExposedEdge {
  if (side === TableSide.Self) {
    return ExposedEdge.Start;
  }
  if (side === TableSide.Across) {
    return ExposedEdge.End;
  }
  if (side === TableSide.Right) {
    return ExposedEdge.After;
  }
  return ExposedEdge.Before;
}

export function tilesFromHand(meld: {
  isConcealed: boolean;
  tiles: { isClaimed: boolean }[];
}): number {
  if (meld.isConcealed) {
    return meld.tiles.length;
  }
  const claimed = meld.tiles.filter((tile) => tile.isClaimed).length;
  return meld.tiles.length - (claimed > 0 ? claimed : 1);
}

export function concealedCount(input: {
  handTileCount: number;
  tilesFromHand: number;
  isCurrent: boolean;
  phase: RoundPhase | null;
}): number {
  const base = Math.max(0, input.handTileCount - input.tilesFromHand);
  if (input.isCurrent && input.phase === RoundPhase.Discard) {
    return base + 1;
  }
  return base;
}

export function discardRows<T>(tiles: T[]): T[][] {
  const rows: T[][] = [];
  for (let index = 0; index < tiles.length; index += discardRowLength) {
    rows.push(tiles.slice(index, index + discardRowLength));
  }
  return rows;
}

export function placeSeats(input: {
  selfSeatIndex: number;
  dealerSeatIndex: number | null;
  handTileCount: number;
  phase: RoundPhase | null;
  currentSeatIndex: number | null;
  seats: LayoutSeat[];
  discards: LayoutDiscard[];
  melds: LayoutMeld[];
  flowers: LayoutFlower[];
}): SeatPlace[] {
  const dealer = input.dealerSeatIndex ?? 0;
  const latest = input.discards.reduce<LayoutDiscard | undefined>((best, tile) => {
    if (best == null || tile.sortIndex >= best.sortIndex) {
      return tile;
    }
    return best;
  }, undefined);
  return input.seats
    .map((seat) => {
      const side = tableSide(input.selfSeatIndex, seat.seatIndex);
      const held = input.melds
        .filter((meld) => meld.seatIndex === seat.seatIndex)
        .reduce((sum, meld) => sum + tilesFromHand(meld), 0);
      const isCurrent = input.currentSeatIndex === seat.seatIndex;
      return {
        seatIndex: seat.seatIndex,
        side,
        exposedEdge: exposedEdge(side),
        wind: seatWind(dealer, seat.seatIndex),
        displayName: seat.displayName,
        score: seat.runningScore,
        connected: seat.connected,
        isSelf: seat.seatIndex === input.selfSeatIndex,
        isCurrent,
        concealedCount: concealedCount({
          handTileCount: input.handTileCount,
          tilesFromHand: held,
          isCurrent,
          phase: input.phase,
        }),
        discards: input.discards
          .filter((tile) => tile.seatIndex === seat.seatIndex)
          .sort((left, right) => left.sortIndex - right.sortIndex)
          .map((tile) => ({
            tileCode: tile.tileCode,
            sortIndex: tile.sortIndex,
            isLatest:
              latest != null &&
              tile.sortIndex === latest.sortIndex &&
              tile.seatIndex === latest.seatIndex,
          })),
        melds: input.melds
          .filter((meld) => meld.seatIndex === seat.seatIndex)
          .sort((left, right) => left.sortIndex - right.sortIndex)
          .map((meld) => ({
            meldType: meld.meldType,
            sortIndex: meld.sortIndex,
            tiles: meld.tiles
              .slice()
              .sort((left, right) => left.sortIndex - right.sortIndex)
              .map((tile) => ({
                tileCode: tile.tileCode,
                sortIndex: tile.sortIndex,
                isLatest: false,
              })),
          })),
        flowers: input.flowers
          .filter((tile) => tile.seatIndex === seat.seatIndex)
          .sort((left, right) => left.sortIndex - right.sortIndex)
          .map((tile) => ({
            tileCode: tile.tileCode,
            sortIndex: tile.sortIndex,
            isLatest: false,
          })),
      };
    })
    .sort((left, right) => sides.indexOf(left.side) - sides.indexOf(right.side));
}
