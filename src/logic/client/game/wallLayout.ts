import { wallTileCount } from "../../server/game/wallTileCodes";
import { TableSide, tableSide } from "./tableLayout";

export enum WallSlotKind {
  Opening = "opening",
  Standing = "standing",
  Replacement = "replacement",
}

export const wallTilesPerStack = 2;
export const wallStacksPerSide = wallTileCount / wallTilesPerStack / 4;

const sides: TableSide[] = [TableSide.Self, TableSide.Right, TableSide.Across, TableSide.Left];

export type WallSlot = {
  sortIndex: number;
  kind: WallSlotKind;
};

export type WallStack = {
  stackIndex: number;
  side: TableSide;
  order: number;
  standingCount: number;
  upperStanding: boolean;
  lowerStanding: boolean;
  slots: WallSlot[];
};

export type WallSide = {
  side: TableSide;
  stacks: WallStack[];
};

export function wallDealCursor(handTileCount: number): number {
  return handTileCount * 4;
}

export function wallSlotKind(input: {
  sortIndex: number;
  dealCursor: number;
  wallHeadSortIndex: number | null;
  wallTailSortIndex: number | null;
}): WallSlotKind {
  const head = input.wallHeadSortIndex;
  const tail = input.wallTailSortIndex;
  if (head == null || tail == null) {
    return input.sortIndex < input.dealCursor ? WallSlotKind.Opening : WallSlotKind.Replacement;
  }
  if (input.sortIndex < head) {
    return WallSlotKind.Opening;
  }
  if (input.sortIndex <= tail) {
    return WallSlotKind.Standing;
  }
  return WallSlotKind.Replacement;
}

export function placeLiveWall(input: {
  selfSeatIndex: number;
  dealerSeatIndex: number;
  handTileCount: number;
  wallHeadSortIndex: number | null;
  wallTailSortIndex: number | null;
}): WallSide[] {
  const dealerSide = tableSide(input.selfSeatIndex, input.dealerSeatIndex);
  const dealCursor = wallDealCursor(input.handTileCount);
  const placed: WallSide[] = sides.map((side) => ({ side, stacks: [] }));
  const stackCount = wallTileCount / wallTilesPerStack;
  for (let stackIndex = 0; stackIndex < stackCount; stackIndex += 1) {
    const ownerOffset = Math.floor(stackIndex / wallStacksPerSide);
    const side = rotateSide(dealerSide, ownerOffset);
    const slots: WallSlot[] = [];
    for (let offset = 0; offset < wallTilesPerStack; offset += 1) {
      const sortIndex = stackIndex * wallTilesPerStack + offset;
      slots.push({
        sortIndex,
        kind: wallSlotKind({
          sortIndex,
          dealCursor,
          wallHeadSortIndex: input.wallHeadSortIndex,
          wallTailSortIndex: input.wallTailSortIndex,
        }),
      });
    }
    const upper = slots[0];
    const lower = slots[1];
    const bucket = placed.find((item) => item.side === side);
    bucket?.stacks.push({
      stackIndex,
      side,
      order: stackIndex % wallStacksPerSide,
      standingCount: slots.filter((slot) => slot.kind === WallSlotKind.Standing).length,
      upperStanding: upper?.kind === WallSlotKind.Standing,
      lowerStanding: lower?.kind === WallSlotKind.Standing,
      slots,
    });
  }
  return placed;
}

function rotateSide(dealerSide: TableSide, offset: number): TableSide {
  const start = sides.indexOf(dealerSide);
  return sides[(start + offset) % sides.length] ?? TableSide.Self;
}
