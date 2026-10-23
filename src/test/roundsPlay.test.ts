import { describe, expect, it } from "vitest";
import { isBonusTileCode } from "../logic/server/game/wallTileCodes";
import { EmitTarget } from "../types/server/emitTarget";
import { GameStatus } from "../types/server/gameStatus";
import { MeldType } from "../types/server/meldType";
import { UserFigureName } from "../types/server/profile";
import { RoundPhase } from "../types/server/roundPhase";
import { RoundResultType } from "../types/server/roundResultType";
import { RoundStatus } from "../types/server/roundStatus";
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
  userAt,
  type PlayWorld,
  type StackedWall,
} from "./playWorld";

const waitingHand = [
  "man_1",
  "man_2",
  "man_3",
  "man_4",
  "man_5",
  "man_6",
  "bam_2",
  "bam_3",
  "bam_4",
  "dot_3",
  "dot_4",
  "west",
  "west",
];

const claimWall: StackedWall = {
  hands: [["dot_5", "red"], ["dot_4", "dot_6"], ["dot_5", "dot_5", "red", "red", "red"], []],
  draws: ["man_9"],
  tail: ["bam_9"],
};

function figure(world: PlayWorld, seatIndex: number, name: UserFigureName): number | undefined {
  const row = world.auth.figures.find(
    (item) => item.userId === userAt(world, seatIndex) && item.name === name,
  );
  return row == null ? undefined : Number(row.value);
}

describe("starting the hand", () => {
  it("replaces flowers dealt into a hand from the wall tail before the dealer draws", async () => {
    const world = await createPlayWorld({
      wall: { hands: [[], [], ["flower_plum", "season_winter"], []], tail: ["man_9", "bam_9"] },
    });
    const round = await world.round();
    const seatTwo = await world.hand(2);
    expect(seatTwo).toHaveLength(13);
    expect(seatTwo.some((tile) => isBonusTileCode(tile.tileCode))).toBe(false);
    expect(seatTwo.map((tile) => tile.tileCode)).toEqual(
      expect.arrayContaining(["man_9", "bam_9"]),
    );
    expect(seatTwo.some((tile) => tile.isDrawn)).toBe(false);
    expect(
      (await world.tables.flowerTilesRepo.findByRoundIdAndSeatIndex(round.id, 2)).map((tile) => [
        tile.tileCode,
        tile.sortIndex,
      ]),
    ).toEqual([
      ["flower_plum", 0],
      ["season_winter", 1],
    ]);
    expect(await world.tables.wallTilesRepo.findByRoundId(round.id)).toHaveLength(89);
    expect(await world.hand(0)).toHaveLength(14);
  });
});

describe("guards on every play action", () => {
  it("rejects a stale game id, a stranger, and a table that has not started", async () => {
    const world = await createPlayWorld();
    const [tileId] = await world.tileIds(0, [(await world.hand(0))[0]?.tileCode ?? ""]);
    expectPlayError(
      await world.roundsLogic.discard({
        gameId: crypto.randomUUID(),
        userId: userAt(world, 0),
        tileId: tileId ?? "",
        now: playNow,
      }),
      SocketError.StaleGame,
    );
    const stranger = await world.auth.userRepo.insert({});
    expectPlayError(
      await world.roundsLogic.passClaim({
        gameId: world.gameId,
        userId: stranger.uuid,
        now: playNow,
      }),
      SocketError.NotSeated,
    );
    const waiting = await createPlayWorld({
      players: 1,
      body: { ruleset: "hongKong", autoDraw: false },
    });
    expectPlayError(
      await waiting.roundsLogic.draw({
        gameId: waiting.gameId,
        userId: userAt(waiting, 0),
        now: playNow,
      }),
      SocketError.GameNotInProgress,
    );
  });
});

describe("draw and discard", () => {
  it("refuses a manual draw, an out-of-turn discard, and a tile from another hand", async () => {
    const world = await createPlayWorld();
    expectPlayError(
      await world.roundsLogic.draw({
        gameId: world.gameId,
        userId: userAt(world, 0),
        now: playNow,
      }),
      SocketError.AutoDrawEnabled,
    );
    expectPlayError(await discardDrawn(world, 1), SocketError.NotYourTurn);
    const [foreignTile] = await world.tileIds(1, [(await world.hand(1))[0]?.tileCode ?? ""]);
    expectPlayError(
      await world.roundsLogic.discard({
        gameId: world.gameId,
        userId: userAt(world, 0),
        tileId: foreignTile ?? "",
        now: playNow,
      }),
      SocketError.InvalidTile,
    );
  });

  it("opens a claim window and auto-draws for the next seat once everyone passes", async () => {
    const world = await createPlayWorld({ wall: { draws: ["dot_9", "bam_9"] } });
    const discarded = await discardDrawn(world, 0);
    expect(emittedEvents(discarded)).toEqual([
      SocketEvent.Discarded,
      SocketEvent.ClaimWindow,
      SocketEvent.PublicState,
    ]);
    const discardRow = (
      await world.tables.discardTilesRepo.findByRoundId((await world.round()).id)
    )[0];
    expect(emitted(discarded, SocketEvent.Discarded)).toEqual({
      event: SocketEvent.Discarded,
      target: EmitTarget.Room,
      payload: { seatIndex: 0, tileCode: "dot_9", tileId: discardRow?.id },
    });
    expect(emitted(discarded, SocketEvent.ClaimWindow).payload).toEqual({
      discardSeatIndex: 0,
      tileCode: "dot_9",
      timeoutMs: 5000,
    });
    const publicState = emitted(discarded, SocketEvent.PublicState).payload;
    expect("self" in publicState).toBe(false);
    expect(publicState.round).toMatchObject({ phase: RoundPhase.Claim, currentSeatIndex: 0 });
    expect(publicState.publicTiles.discards).toEqual([
      { seatIndex: 0, tileCode: "dot_9", sortIndex: 0 },
    ]);
    const dealerHand = await world.hand(0);
    expect(dealerHand).toHaveLength(13);
    expect(dealerHand.some((tile) => tile.isDrawn)).toBe(false);

    expectPlayError(await pass(world, 0), SocketError.NotYourTurn);
    expect(emittedEvents(await pass(world, 1))).toEqual([]);
    expect(emittedEvents(await pass(world, 2))).toEqual([]);
    expectPlayError(await pass(world, 2), SocketError.InvalidClaim);
    const resolved = await pass(world, 3);
    expect(emittedEvents(resolved)).toEqual([
      SocketEvent.Turn,
      SocketEvent.Drew,
      SocketEvent.PublicState,
    ]);
    expect(emitted(resolved, SocketEvent.Turn).payload).toEqual({
      currentSeatIndex: 1,
      phase: RoundPhase.Discard,
    });
    const drew = emitted(resolved, SocketEvent.Drew);
    expect(drew.target).toBe(EmitTarget.Seat);
    expect(drew.seatIndex).toBe(1);
    expect(drew.payload).toMatchObject({
      tile: { tileCode: "bam_9", isDrawn: true },
      wallCount: 90,
      flowers: [],
    });
    expectPlayError(await pass(world, 2), SocketError.NoClaimWindow);
  });

  it("waits for the seat to draw when autoDraw is off", async () => {
    const world = await createPlayWorld({
      body: { ruleset: "hongKong", autoDraw: false },
      wall: { draws: ["dot_9"] },
    });
    expect(await world.round()).toMatchObject({ phase: RoundPhase.Draw, currentSeatIndex: 0 });
    expectPlayError(await discardDrawn(world, 0), SocketError.NotYourTurn);
    expectPlayError(
      await world.roundsLogic.draw({
        gameId: world.gameId,
        userId: userAt(world, 1),
        now: playNow,
      }),
      SocketError.NotYourTurn,
    );
    const drew = await world.roundsLogic.draw({
      gameId: world.gameId,
      userId: userAt(world, 0),
      now: playNow,
    });
    expect(emittedEvents(drew)).toEqual([
      SocketEvent.Drew,
      SocketEvent.Turn,
      SocketEvent.PublicState,
    ]);
    expect(emitted(drew, SocketEvent.Drew).payload).toMatchObject({
      tile: { tileCode: "dot_9", isDrawn: true },
      wallCount: 91,
      flowers: [],
    });
    expectPlayError(
      await world.roundsLogic.draw({
        gameId: world.gameId,
        userId: userAt(world, 0),
        now: playNow,
      }),
      SocketError.NotYourTurn,
    );
    await discardDrawn(world, 0);
    const resolved = await passOthers(world, 0);
    expect(emittedEvents(resolved)).toEqual([SocketEvent.Turn, SocketEvent.PublicState]);
    expect(emitted(resolved, SocketEvent.Turn).payload).toEqual({
      currentSeatIndex: 1,
      phase: RoundPhase.Draw,
    });
  });

  it("moves a drawn flower aside and replaces it from the tail in the same draw", async () => {
    const world = await createPlayWorld({
      body: { ruleset: "hongKong", autoDraw: false },
      wall: { draws: ["flower_orchid"], tail: ["red"] },
    });
    const drew = await world.roundsLogic.draw({
      gameId: world.gameId,
      userId: userAt(world, 0),
      now: playNow,
    });
    expect(emitted(drew, SocketEvent.Drew).payload).toMatchObject({
      tile: { tileCode: "red", isDrawn: true },
      wallCount: 90,
      flowers: [{ tileCode: "flower_orchid" }],
    });
    expect(emitted(drew, SocketEvent.PublicState).payload.publicTiles.flowerTiles).toEqual([
      { seatIndex: 0, tileCode: "flower_orchid", sortIndex: 0 },
    ]);
  });
});

describe("claims", () => {
  it("rejects claims outside the window and tiles that do not form the meld", async () => {
    const world = await createPlayWorld({ wall: claimWall });
    expectPlayError(
      await claimCodes(world, 1, MeldType.Chow, ["dot_4", "dot_6"]),
      SocketError.NoClaimWindow,
    );
    await discardCode(world, 0, "dot_5");
    expectPlayError(
      await claimCodes(world, 0, MeldType.Pong, ["red", "man_1"]),
      SocketError.NotYourTurn,
    );
    const seatThree = await world.hand(3);
    expectPlayError(
      await world.roundsLogic.claim({
        gameId: world.gameId,
        userId: userAt(world, 3),
        kind: MeldType.Chow,
        tileIds: [seatThree[0]?.id ?? "", seatThree[1]?.id ?? ""],
        now: playNow,
      }),
      SocketError.InvalidClaim,
    );
    const seatTwo = await world.hand(2);
    expectPlayError(
      await world.roundsLogic.claim({
        gameId: world.gameId,
        userId: userAt(world, 1),
        kind: MeldType.Chow,
        tileIds: [seatTwo[0]?.id ?? "", seatTwo[1]?.id ?? ""],
        now: playNow,
      }),
      SocketError.InvalidTile,
    );
    expectPlayError(
      await claimCodes(world, 1, MeldType.Pong, ["dot_4", "dot_6"]),
      SocketError.InvalidClaim,
    );
    expectPlayError(
      await claimCodes(world, 2, MeldType.Kong, ["dot_5", "dot_5"]),
      SocketError.InvalidClaim,
    );
  });

  it("resolves pong over chow and hands the turn to the claimer", async () => {
    const world = await createPlayWorld({ wall: claimWall });
    await discardCode(world, 0, "dot_5");
    expect(emittedEvents(await claimCodes(world, 1, MeldType.Chow, ["dot_4", "dot_6"]))).toEqual(
      [],
    );
    expect(emittedEvents(await claimCodes(world, 2, MeldType.Pong, ["dot_5", "dot_5"]))).toEqual(
      [],
    );
    const resolved = await pass(world, 3);
    expect(emittedEvents(resolved)).toEqual([
      SocketEvent.Claimed,
      SocketEvent.SelfHand,
      SocketEvent.Turn,
      SocketEvent.PublicState,
    ]);
    expect(emitted(resolved, SocketEvent.Claimed).payload).toEqual({
      seatIndex: 2,
      kind: MeldType.Pong,
      tileCodes: ["dot_5", "dot_5", "dot_5"],
    });
    const selfHand = emitted(resolved, SocketEvent.SelfHand);
    expect(selfHand.seatIndex).toBe(2);
    expect(selfHand.payload.tiles).toHaveLength(11);
    expect(emitted(resolved, SocketEvent.Turn).payload).toEqual({
      currentSeatIndex: 2,
      phase: RoundPhase.Discard,
    });
    const round = await world.round();
    expect(await world.tables.discardTilesRepo.findByRoundId(round.id)).toEqual([]);
    const melds = await world.tables.meldsRepo.findByRoundIdAndSeatIndex(round.id, 2);
    expect(melds).toEqual([
      expect.objectContaining({ meldType: MeldType.Pong, fromSeatIndex: 0, isConcealed: false }),
    ]);
    const meldTiles = await world.tables.meldTilesRepo.findByMeldId(melds[0]?.id ?? "");
    expect(meldTiles.filter((tile) => tile.isClaimed)).toHaveLength(1);
    expect(await world.hand(1)).toHaveLength(13);

    const next = await discardDrawn(world, 2);
    expect(emitted(next, SocketEvent.ClaimWindow).payload.discardSeatIndex).toBe(2);
  });

  it("lets the next seat chow when nobody outranks it", async () => {
    const world = await createPlayWorld({ wall: claimWall });
    await discardCode(world, 0, "dot_5");
    await claimCodes(world, 1, MeldType.Chow, ["dot_6", "dot_4"]);
    await pass(world, 2);
    const resolved = await pass(world, 3);
    expect(emitted(resolved, SocketEvent.Claimed).payload).toEqual({
      seatIndex: 1,
      kind: MeldType.Chow,
      tileCodes: ["dot_4", "dot_5", "dot_6"],
    });
    expect(emitted(resolved, SocketEvent.Turn).payload).toEqual({
      currentSeatIndex: 1,
      phase: RoundPhase.Discard,
    });
  });

  it("claims a kong off a discard and draws the replacement from the tail", async () => {
    const world = await createPlayWorld({ wall: claimWall });
    await discardCode(world, 0, "red");
    await claimCodes(world, 2, MeldType.Kong, ["red", "red", "red"]);
    await pass(world, 1);
    const resolved = await pass(world, 3);
    expect(emittedEvents(resolved)).toEqual([
      SocketEvent.Claimed,
      SocketEvent.SelfHand,
      SocketEvent.Drew,
      SocketEvent.Turn,
      SocketEvent.PublicState,
    ]);
    expect(emitted(resolved, SocketEvent.Claimed).payload.tileCodes).toEqual([
      "red",
      "red",
      "red",
      "red",
    ]);
    expect(emitted(resolved, SocketEvent.Drew).payload).toMatchObject({
      tile: { tileCode: "bam_9", isDrawn: true },
      wallCount: 90,
    });
    expect(await world.hand(2)).toHaveLength(11);
  });

  it("declares a concealed kong on its own turn and draws a replacement", async () => {
    const world = await createPlayWorld({
      wall: { hands: [["east", "east", "east", "east"]], tail: ["dot_9"] },
    });
    expectPlayError(
      await claimCodes(
        world,
        1,
        MeldType.Kong,
        (await world.hand(1)).slice(0, 4).map((t) => t.tileCode),
      ),
      SocketError.NoClaimWindow,
    );
    expectPlayError(
      await claimCodes(world, 0, MeldType.Pong, ["east", "east", "east"]),
      SocketError.InvalidClaim,
    );
    const declared = await claimCodes(world, 0, MeldType.Kong, ["east", "east", "east", "east"]);
    expect(emittedEvents(declared)).toEqual([
      SocketEvent.Claimed,
      SocketEvent.SelfHand,
      SocketEvent.Drew,
      SocketEvent.Turn,
      SocketEvent.PublicState,
    ]);
    expect(emitted(declared, SocketEvent.Drew).payload.tile.tileCode).toBe("dot_9");
    const round = await world.round();
    expect(await world.tables.meldsRepo.findByRoundIdAndSeatIndex(round.id, 0)).toEqual([
      expect.objectContaining({ meldType: MeldType.Kong, isConcealed: true, fromSeatIndex: null }),
    ]);
    expect(round).toMatchObject({ phase: RoundPhase.Discard, currentSeatIndex: 0 });
    const dealerHand = await world.hand(0);
    expect(dealerHand).toHaveLength(11);
    expect(dealerHand.filter((tile) => tile.isDrawn).map((tile) => tile.tileCode)).toEqual([
      "dot_9",
    ]);
  });

  it("upgrades an exposed pong to a kong when the fourth tile is drawn", async () => {
    const world = await createPlayWorld({
      wall: {
        hands: [["red"], [], ["red", "red"], []],
        draws: ["dot_9", "dot_9", "dot_9", "dot_9", "red"],
        tail: ["bam_9"],
      },
    });
    await discardCode(world, 0, "red");
    await claimCodes(world, 2, MeldType.Pong, ["red", "red"]);
    await pass(world, 1);
    await pass(world, 3);
    for (const seatIndex of [2, 3, 0, 1]) {
      await discardDrawn(world, seatIndex);
      await passOthers(world, seatIndex);
    }
    expect(await world.round()).toMatchObject({ currentSeatIndex: 2, phase: RoundPhase.Discard });
    const upgraded = await claimCodes(world, 2, MeldType.Kong, ["red"]);
    expect(emitted(upgraded, SocketEvent.Claimed).payload).toEqual({
      seatIndex: 2,
      kind: MeldType.Kong,
      tileCodes: ["red", "red", "red", "red"],
    });
    expect(emitted(upgraded, SocketEvent.Drew).payload.tile.tileCode).toBe("bam_9");
    const round = await world.round();
    const melds = await world.tables.meldsRepo.findByRoundIdAndSeatIndex(round.id, 2);
    expect(melds).toEqual([
      expect.objectContaining({ meldType: MeldType.Kong, fromSeatIndex: 0, isConcealed: false }),
    ]);
    expect(await world.tables.meldTilesRepo.findByMeldId(melds[0]?.id ?? "")).toHaveLength(4);
  });
});

describe("winning", () => {
  it("wins on a discard, writes scores and figures, and completes the game", async () => {
    const world = await createPlayWorld({ wall: { hands: [["dot_5"], waitingHand] } });
    await discardCode(world, 0, "dot_5");
    expectPlayError(await declareWin(world, 2), SocketError.InvalidClaim);
    const won = await declareWin(world, 1);
    expect(emittedEvents(won)).toEqual([SocketEvent.RoundEnded, SocketEvent.PublicState]);
    expect(emitted(won, SocketEvent.RoundEnded).payload).toEqual({
      resultType: RoundResultType.Win,
      winKind: WinKind.Discard,
      winnerSeatIndex: 1,
      scores: [
        expect.objectContaining({ seatIndex: 0, scoreDelta: -8, scoreAfter: -8, isWinner: false }),
        expect.objectContaining({
          seatIndex: 1,
          scoreDelta: 8,
          scoreAfter: 8,
          scoreUnits: 3,
          isWinner: true,
        }),
        expect.objectContaining({ seatIndex: 2, scoreDelta: 0, scoreUnits: null }),
        expect.objectContaining({ seatIndex: 3, scoreDelta: 0 }),
      ],
      payments: [{ fromSeatIndex: 0, toSeatIndex: 1, amount: 8 }],
    });
    expect(await world.tables.gamesRepo.findById(world.gameId)).toMatchObject({
      status: GameStatus.Completed,
      completedAt: playNow,
    });
    expect(await world.round()).toMatchObject({
      status: RoundStatus.Completed,
      resultType: RoundResultType.Win,
      winKind: WinKind.Discard,
      winnerSeatIndex: 1,
      discardFromSeatIndex: 0,
    });
    const seats = await world.tables.seatsRepo.findByGameId(world.gameId);
    expect(seats.map((seat) => Number(seat.runningScore))).toEqual([-8, 8, 0, 0]);
    expect(figure(world, 1, UserFigureName.GamesPlayed)).toBe(1);
    expect(figure(world, 1, UserFigureName.Wins)).toBe(1);
    expect(figure(world, 1, UserFigureName.RunningScore)).toBe(8);
    expect(figure(world, 0, UserFigureName.GamesPlayed)).toBe(1);
    expect(figure(world, 0, UserFigureName.Wins)).toBe(0);
    expect(figure(world, 0, UserFigureName.RunningScore)).toBe(-8);
    const winnerHand = await world.hand(1);
    expect(winnerHand).toHaveLength(14);
    expect(winnerHand.filter((tile) => tile.isDrawn).map((tile) => tile.tileCode)).toEqual([
      "dot_5",
    ]);
    const snapshot = await world.gamesLogic.snapshot(world.gameId, userAt(world, 2));
    expect("snapshot" in snapshot && snapshot.snapshot.scores.scorePayments).toEqual([
      { fromSeatIndex: 0, toSeatIndex: 1, amount: 8 },
    ]);
    expectPlayError(await pass(world, 3), SocketError.GameNotInProgress);
  });

  it("gives a contested discard to the first winner after the discarder", async () => {
    const tanki = [
      "man_7",
      "man_8",
      "man_9",
      "bam_6",
      "bam_7",
      "bam_8",
      "dot_6",
      "dot_7",
      "dot_8",
      "north",
      "north",
      "north",
      "dot_5",
    ];
    const world = await createPlayWorld({ wall: { hands: [["dot_5"], waitingHand, [], tanki] } });
    await discardCode(world, 0, "dot_5");
    expect(emittedEvents(await declareWin(world, 3))).toEqual([]);
    expect(emittedEvents(await pass(world, 2))).toEqual([]);
    const won = await declareWin(world, 1);
    expect(emitted(won, SocketEvent.RoundEnded).payload.winnerSeatIndex).toBe(1);

    const chowLoses = await createPlayWorld({
      wall: { hands: [["dot_5"], waitingHand, [], tanki] },
    });
    await discardCode(chowLoses, 0, "dot_5");
    await claimCodes(chowLoses, 1, MeldType.Chow, ["dot_3", "dot_4"]);
    await pass(chowLoses, 2);
    const outranked = await declareWin(chowLoses, 3);
    expect(emitted(outranked, SocketEvent.RoundEnded).payload.winnerSeatIndex).toBe(3);
  });

  it("rejects a win below minScoreUnits and keeps the claim window open", async () => {
    const world = await createPlayWorld({
      body: { ruleset: "hongKong", minScoreUnits: 4 },
      wall: { hands: [["dot_5"], waitingHand] },
    });
    await discardCode(world, 0, "dot_5");
    expectPlayError(await declareWin(world, 1), SocketError.InvalidClaim);
    expect(await world.round()).toMatchObject({ phase: RoundPhase.Claim });
    expect(emittedEvents(await passOthers(world, 0))).toContain(SocketEvent.Turn);
  });

  it("wins on a self-drawn tile and collects from the other three", async () => {
    const world = await createPlayWorld({ wall: { hands: [waitingHand], draws: ["dot_5"] } });
    expectPlayError(await declareWin(world, 1), SocketError.NotYourTurn);
    const won = await declareWin(world, 0);
    expect(emitted(won, SocketEvent.RoundEnded).payload).toMatchObject({
      resultType: RoundResultType.Win,
      winKind: WinKind.SelfDraw,
      winnerSeatIndex: 0,
      payments: [
        { fromSeatIndex: 1, toSeatIndex: 0, amount: 16 },
        { fromSeatIndex: 2, toSeatIndex: 0, amount: 16 },
        { fromSeatIndex: 3, toSeatIndex: 0, amount: 16 },
      ],
    });
    expect(emitted(won, SocketEvent.RoundEnded).payload.scores[0]).toMatchObject({
      scoreDelta: 48,
      scoreUnits: 4,
    });
    expect(await world.round()).toMatchObject({
      winKind: WinKind.SelfDraw,
      discardFromSeatIndex: null,
    });
  });

  it("refuses a self-draw win on a hand that is not complete", async () => {
    const world = await createPlayWorld({
      wall: { hands: [["east", "south", "west", "north", "red", "green", "white"]] },
    });
    expectPlayError(await declareWin(world, 0), SocketError.InvalidClaim);
  });

  it("pays base plus tai on a taiwan self-draw", async () => {
    const world = await createPlayWorld({
      body: { ruleset: "taiwan" },
      wall: {
        hands: [
          [
            "man_1",
            "man_2",
            "man_3",
            "man_4",
            "man_5",
            "man_6",
            "man_7",
            "man_8",
            "man_9",
            "bam_2",
            "bam_3",
            "bam_4",
            "dot_6",
            "dot_7",
            "north",
            "north",
          ],
        ],
        draws: ["dot_8"],
      },
    });
    const won = await declareWin(world, 0);
    const ended = emitted(won, SocketEvent.RoundEnded).payload;
    expect(ended.payments.map((payment) => payment.amount)).toEqual([6, 6, 6]);
    expect(ended.scores[0]).toMatchObject({ scoreDelta: 18, scoreUnits: 5 });
  });
});

describe("ending without a winner", () => {
  it("ends in a draw with no payments when the wall runs out", async () => {
    const world = await createPlayWorld();
    const round = await world.round();
    for (const tile of await world.tables.wallTilesRepo.findByRoundId(round.id)) {
      await world.tables.wallTilesRepo.deleteById(tile.id);
    }
    await discardDrawn(world, 0);
    const ended = await passOthers(world, 0);
    expect(emittedEvents(ended)).toEqual([SocketEvent.RoundEnded, SocketEvent.PublicState]);
    const payload = emitted(ended, SocketEvent.RoundEnded).payload;
    expect(payload).toMatchObject({
      resultType: RoundResultType.Draw,
      winKind: null,
      winnerSeatIndex: null,
      payments: [],
    });
    expect(payload.scores.map((score) => score.scoreDelta)).toEqual([0, 0, 0, 0]);
    expect(await world.tables.gamesRepo.findById(world.gameId)).toMatchObject({
      status: GameStatus.Completed,
    });
    expect(figure(world, 2, UserFigureName.GamesPlayed)).toBe(1);
    expect(figure(world, 2, UserFigureName.Wins)).toBe(0);
  });
});

describe("claim window timeout", () => {
  it("passes unanswered seats and resolves the best answer", async () => {
    const world = await createPlayWorld({ wall: claimWall });
    expectPlayError(
      await world.roundsLogic.passUnanswered({ gameId: world.gameId, now: playNow }),
      SocketError.NoClaimWindow,
    );
    await discardCode(world, 0, "dot_5");
    await claimCodes(world, 2, MeldType.Pong, ["dot_5", "dot_5"]);
    const resolved = await world.roundsLogic.passUnanswered({ gameId: world.gameId, now: playNow });
    expect(emitted(resolved, SocketEvent.Claimed).payload.seatIndex).toBe(2);
  });

  it("rebuilds the claim window after the in-memory store is lost", async () => {
    const world = await createPlayWorld({ wall: claimWall });
    await discardDrawn(world, 0);
    const restarted = world.restartRoundsLogic();
    for (const seatIndex of [1, 2]) {
      expect(
        emittedEvents(
          await restarted.passClaim({
            gameId: world.gameId,
            userId: userAt(world, seatIndex),
            now: playNow,
          }),
        ),
      ).toEqual([]);
    }
    const resolved = await restarted.passClaim({
      gameId: world.gameId,
      userId: userAt(world, 3),
      now: playNow,
    });
    expect(emitted(resolved, SocketEvent.Turn).payload.currentSeatIndex).toBe(1);
  });
});

describe("snapshotForSeat", () => {
  it("returns the private hand and the public table for a seated player", async () => {
    const world = await createPlayWorld();
    const joined = await world.roundsLogic.snapshotForSeat({
      gameId: world.gameId,
      userId: userAt(world, 2),
    });
    expect(emittedEvents(joined)).toEqual([
      SocketEvent.Joined,
      SocketEvent.SelfHand,
      SocketEvent.PublicState,
      SocketEvent.Presence,
    ]);
    expect(emitted(joined, SocketEvent.Joined)).toEqual({
      event: SocketEvent.Joined,
      target: EmitTarget.Seat,
      seatIndex: 2,
      payload: { gameId: world.gameId, seatIndex: 2 },
    });
    expect(emitted(joined, SocketEvent.SelfHand).payload.tiles).toHaveLength(13);
    expect("self" in emitted(joined, SocketEvent.PublicState).payload).toBe(false);
    expect(emitted(joined, SocketEvent.Presence).payload).toEqual({
      seatIndex: 2,
      connected: true,
    });
    const stranger = await world.auth.userRepo.insert({});
    expectPlayError(
      await world.roundsLogic.snapshotForSeat({ gameId: world.gameId, userId: stranger.uuid }),
      SocketError.NotSeated,
    );
    expectPlayError(
      await world.roundsLogic.snapshotForSeat({
        gameId: crypto.randomUUID(),
        userId: userAt(world, 0),
      }),
      SocketError.StaleGame,
    );
    const waiting = await createPlayWorld({ players: 1 });
    const spectate = await waiting.roundsLogic.snapshotForSeat({
      gameId: waiting.gameId,
      userId: userAt(waiting, 0),
    });
    expect(emitted(spectate, SocketEvent.SelfHand).payload.tiles).toEqual([]);
  });
});
