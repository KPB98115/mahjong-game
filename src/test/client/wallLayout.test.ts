import { describe, expect, it } from "vitest";
import { TableSide } from "../../logic/client/game/tableLayout";
import {
  placeLiveWall,
  wallDealCursor,
  WallSlotKind,
  wallStacksPerSide,
} from "../../logic/client/game/wallLayout";
import { wallTileCount } from "../../logic/server/game/wallTileCodes";

function wallOf(input: {
  selfSeatIndex: number;
  dealerSeatIndex: number;
  handTileCount: number;
  wallHeadSortIndex: number | null;
  wallTailSortIndex: number | null;
}) {
  return placeLiveWall(input);
}

function slotOf(
  sides: ReturnType<typeof placeLiveWall>,
  sortIndex: number,
): { side: TableSide; kind: WallSlotKind; standingCount: number } {
  for (const side of sides) {
    for (const stack of side.stacks) {
      const slot = stack.slots.find((item) => item.sortIndex === sortIndex);
      if (slot != null) {
        return { side: stack.side, kind: slot.kind, standingCount: stack.standingCount };
      }
    }
  }
  throw new Error(`missing slot ${sortIndex}`);
}

function stackOf(sides: ReturnType<typeof placeLiveWall>, sortIndex: number) {
  for (const side of sides) {
    for (const stack of side.stacks) {
      if (stack.slots.some((slot) => slot.sortIndex === sortIndex)) {
        return stack;
      }
    }
  }
  throw new Error(`missing stack for ${sortIndex}`);
}

function openingCount(sides: ReturnType<typeof placeLiveWall>): number {
  return sides
    .flatMap((side) => side.stacks)
    .flatMap((stack) => stack.slots)
    .filter((slot) => slot.kind === WallSlotKind.Opening).length;
}

describe("live wall layout", () => {
  it("opens more of the wall for Taiwan than for Hong Kong", () => {
    const hongKong = wallOf({
      selfSeatIndex: 0,
      dealerSeatIndex: 0,
      handTileCount: 13,
      wallHeadSortIndex: 52,
      wallTailSortIndex: 143,
    });
    const taiwan = wallOf({
      selfSeatIndex: 0,
      dealerSeatIndex: 0,
      handTileCount: 16,
      wallHeadSortIndex: 64,
      wallTailSortIndex: 143,
    });
    expect(wallDealCursor(13)).toBe(52);
    expect(wallDealCursor(16)).toBe(64);
    expect(openingCount(taiwan)).toBeGreaterThan(openingCount(hongKong));
    expect(openingCount(hongKong)).toBe(52);
    expect(openingCount(taiwan)).toBe(64);
  });

  it("opens opposite ends for a head draw and a tail take", () => {
    const afterDeal = wallOf({
      selfSeatIndex: 0,
      dealerSeatIndex: 0,
      handTileCount: 13,
      wallHeadSortIndex: 52,
      wallTailSortIndex: 143,
    });
    const afterHead = wallOf({
      selfSeatIndex: 0,
      dealerSeatIndex: 0,
      handTileCount: 13,
      wallHeadSortIndex: 53,
      wallTailSortIndex: 143,
    });
    const afterTail = wallOf({
      selfSeatIndex: 0,
      dealerSeatIndex: 0,
      handTileCount: 13,
      wallHeadSortIndex: 52,
      wallTailSortIndex: 142,
    });
    expect(slotOf(afterDeal, 52).kind).toBe(WallSlotKind.Standing);
    expect(slotOf(afterHead, 52).kind).toBe(WallSlotKind.Opening);
    expect(slotOf(afterDeal, 143).kind).toBe(WallSlotKind.Standing);
    expect(slotOf(afterTail, 143).kind).toBe(WallSlotKind.Replacement);
    expect(slotOf(afterHead, 143).kind).toBe(WallSlotKind.Standing);
    expect(slotOf(afterTail, 52).kind).toBe(WallSlotKind.Standing);
    expect(stackOf(afterHead, 52)).toMatchObject({ upperStanding: false, lowerStanding: true });
    expect(stackOf(afterTail, 142)).toMatchObject({ upperStanding: true, lowerStanding: false });
    expect(slotOf(afterHead, 52).side).not.toBe(slotOf(afterTail, 143).side);
  });

  it("puts the dealer segment on the bottom for the dealer and on another side otherwise", () => {
    const asDealer = wallOf({
      selfSeatIndex: 0,
      dealerSeatIndex: 0,
      handTileCount: 13,
      wallHeadSortIndex: 52,
      wallTailSortIndex: 143,
    });
    const asNext = wallOf({
      selfSeatIndex: 1,
      dealerSeatIndex: 0,
      handTileCount: 13,
      wallHeadSortIndex: 52,
      wallTailSortIndex: 143,
    });
    expect(slotOf(asDealer, 0).side).toBe(TableSide.Self);
    expect(slotOf(asDealer, wallStacksPerSide * 2 - 1).side).toBe(TableSide.Self);
    expect(slotOf(asNext, 0).side).toBe(TableSide.Left);
    expect(slotOf(asNext, 0).side).not.toBe(TableSide.Self);
    expect(asDealer.flatMap((side) => side.stacks)).toHaveLength(wallTileCount / 2);
  });

  it("clears every stack when the wall is empty", () => {
    const empty = wallOf({
      selfSeatIndex: 0,
      dealerSeatIndex: 0,
      handTileCount: 13,
      wallHeadSortIndex: null,
      wallTailSortIndex: null,
    });
    expect(empty.every((side) => side.stacks.every((stack) => stack.standingCount === 0))).toBe(
      true,
    );
    expect(slotOf(empty, 0).kind).toBe(WallSlotKind.Opening);
    expect(slotOf(empty, 52).kind).toBe(WallSlotKind.Replacement);
  });
});
