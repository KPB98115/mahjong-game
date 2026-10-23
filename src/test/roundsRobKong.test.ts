import { describe, expect, it } from "vitest";
import { ClaimWindowMs } from "../types/server/claimWindowMs";
import { MeldType } from "../types/server/meldType";
import { RoundPhase } from "../types/server/roundPhase";
import { RoundResultType } from "../types/server/roundResultType";
import { SocketError } from "../types/server/socketError";
import { SocketEvent } from "../types/server/socketEvent";
import { WinKind } from "../types/server/winKind";
import {
  claimCodes,
  createPlayWorld,
  declareWin,
  discardCode,
  discardDrawn,
  emitted,
  emittedEvents,
  expectPlayError,
  pass,
  passOthers,
  playNow,
  type PlayWorld,
  type StackedWall,
} from "./playWorld";

const waitingOnDotFive = [
  "man_1",
  "man_2",
  "man_3",
  "man_4",
  "man_5",
  "man_6",
  "bam_2",
  "bam_3",
  "bam_4",
  "dot_4",
  "dot_6",
  "west",
  "west",
];

const robWall: StackedWall = {
  hands: [["dot_5"], waitingOnDotFive, ["dot_5", "dot_5"], []],
  draws: ["dot_9", "dot_9", "dot_9", "dot_9", "dot_5"],
  tail: ["bam_9"],
};

async function openRobWindow(world: PlayWorld) {
  await discardCode(world, 0, "dot_5");
  await claimCodes(world, 2, MeldType.Pong, ["dot_5", "dot_5"]);
  await pass(world, 1);
  await pass(world, 3);
  for (const seatIndex of [2, 3, 0, 1]) {
    await discardDrawn(world, seatIndex);
    await passOthers(world, seatIndex);
  }
  expect(await world.round()).toMatchObject({ currentSeatIndex: 2, phase: RoundPhase.Discard });
  return claimCodes(world, 2, MeldType.Kong, ["dot_5"]);
}

async function seatMelds(world: PlayWorld, seatIndex: number) {
  const round = await world.round();
  return world.tables.meldsRepo.findByRoundIdAndSeatIndex(round.id, seatIndex);
}

describe("robbing the kong", () => {
  it("pauses an added kong in a win-only window when another seat can win on that tile", async () => {
    const world = await createPlayWorld({ wall: robWall });

    const added = await openRobWindow(world);

    expect(emittedEvents(added)).toEqual([SocketEvent.ClaimWindow, SocketEvent.PublicState]);
    expect(emitted(added, SocketEvent.ClaimWindow).payload).toEqual({
      discardSeatIndex: 2,
      tileCode: "dot_5",
      timeoutMs: ClaimWindowMs.FiveSeconds,
    });
    expect(emitted(added, SocketEvent.PublicState).payload.round).toMatchObject({
      phase: RoundPhase.RobKong,
      currentSeatIndex: 2,
    });
    expect((await world.hand(2)).some((tile) => tile.tileCode === "dot_5")).toBe(false);
    expect(await seatMelds(world, 2)).toEqual([
      expect.objectContaining({ meldType: MeldType.Pong }),
    ]);
  });

  it("lets the waiting seat rob the kong once closer seats pass, and the kong player pays", async () => {
    const world = await createPlayWorld({ wall: robWall });
    await openRobWindow(world);

    expect(emittedEvents(await declareWin(world, 1))).toEqual([]);
    expect(emittedEvents(await pass(world, 3))).toEqual([]);
    const robbed = await pass(world, 0);

    expect(emittedEvents(robbed)).toEqual([SocketEvent.RoundEnded, SocketEvent.PublicState]);
    expect(emitted(robbed, SocketEvent.RoundEnded).payload).toMatchObject({
      resultType: RoundResultType.Win,
      winKind: WinKind.Discard,
      winnerSeatIndex: 1,
      payments: [{ fromSeatIndex: 2, toSeatIndex: 1, amount: 16 }],
    });
    expect(await world.round()).toMatchObject({ discardFromSeatIndex: 2, winnerSeatIndex: 1 });
    const winnerHand = await world.hand(1);
    expect(winnerHand).toHaveLength(14);
    expect(winnerHand.filter((tile) => tile.isDrawn).map((tile) => tile.tileCode)).toEqual([
      "dot_5",
    ]);
    expect(await seatMelds(world, 2)).toEqual([
      expect.objectContaining({ meldType: MeldType.Pong }),
    ]);
  });

  it("commits the kong and draws the replacement when every seat passes", async () => {
    const world = await createPlayWorld({ wall: robWall });
    await openRobWindow(world);

    await pass(world, 3);
    await pass(world, 0);
    const committed = await pass(world, 1);

    expect(emittedEvents(committed)).toEqual([
      SocketEvent.Claimed,
      SocketEvent.SelfHand,
      SocketEvent.Drew,
      SocketEvent.Turn,
      SocketEvent.PublicState,
    ]);
    expect(emitted(committed, SocketEvent.Claimed).payload).toEqual({
      seatIndex: 2,
      kind: MeldType.Kong,
      tileCodes: ["dot_5", "dot_5", "dot_5", "dot_5"],
    });
    expect(emitted(committed, SocketEvent.Drew).payload.tile.tileCode).toBe("bam_9");
    expect(await world.round()).toMatchObject({ currentSeatIndex: 2, phase: RoundPhase.Discard });
    expect(await seatMelds(world, 2)).toEqual([
      expect.objectContaining({ meldType: MeldType.Kong, isConcealed: false }),
    ]);
    const round = await world.round();
    const discards = await world.tables.discardTilesRepo.findByRoundId(round.id);
    expect(discards.some((tile) => tile.tileCode === "dot_5")).toBe(false);
  });

  it("only takes wins and passes while the kong can be robbed", async () => {
    const world = await createPlayWorld({ wall: robWall });
    await openRobWindow(world);
    const seatThree = (await world.hand(3)).map((tile) => tile.tileCode);
    const pair = seatThree.find(
      (code, index) => seatThree.indexOf(code) !== index && code !== "dot_5",
    );
    if (pair == null) {
      throw new Error("seat 3 should hold a pair");
    }

    expectPlayError(
      await claimCodes(world, 3, MeldType.Pong, [pair, pair]),
      SocketError.InvalidClaim,
    );
    expectPlayError(await declareWin(world, 3), SocketError.InvalidClaim);
    expectPlayError(await discardDrawn(world, 2), SocketError.NotYourTurn);
    expectPlayError(await pass(world, 2), SocketError.NotYourTurn);

    const timedOut = await world.roundsLogic.passUnanswered({ gameId: world.gameId, now: playNow });
    expect(emitted(timedOut, SocketEvent.Claimed).payload.kind).toBe(MeldType.Kong);
  });

  it("does not open a window for a concealed kong", async () => {
    const world = await createPlayWorld({
      wall: { hands: [["dot_5", "dot_5", "dot_5", "dot_5"], waitingOnDotFive], tail: ["bam_9"] },
    });

    const declared = await claimCodes(world, 0, MeldType.Kong, [
      "dot_5",
      "dot_5",
      "dot_5",
      "dot_5",
    ]);

    expect(emittedEvents(declared)[0]).toBe(SocketEvent.Claimed);
    expect(await world.round()).toMatchObject({ phase: RoundPhase.Discard });
  });
});
