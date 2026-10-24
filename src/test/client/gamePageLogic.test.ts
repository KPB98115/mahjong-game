import { describe, expect, it } from "vitest";
import { AuthLogic } from "../../logic/client/auth/authLogic";
import { GamePageLogic } from "../../logic/client/game/gamePageLogic";
import { GamesLogic } from "../../logic/client/game/gamesLogic";
import { ApiClient } from "../../logic/client/http/apiClient";
import { type ProfileResponse } from "../../model/server/profileResponse";
import { BotDifficulty } from "../../types/server/botDifficulty";
import { GamePanel } from "../../types/client/gamePanel";
import { ApiError, HttpStatus } from "../../types/server/api";
import { GameStatus } from "../../types/server/gameStatus";
import { RoundPhase } from "../../types/server/roundPhase";
import { UserAttributeName } from "../../types/server/profile";
import { PrevailingWind } from "../../types/server/prevailingWind";
import { Ruleset } from "../../types/server/ruleset";
import { createFakeFetch, failedBody, successBody } from "./fakeApi";
import { FakeGameSocket } from "./fakeSocket";
import { waitingSnapshot } from "./snapshotFixture";

const gameId = "11111111-1111-4111-8111-111111111111";
const otherGameId = "22222222-2222-4222-8222-222222222222";

const namedProfile: ProfileResponse = {
  userId: "user-1",
  attributes: { [UserAttributeName.DisplayName]: "Host" },
  figures: {},
  currentGame: {
    gameId,
    referenceCode: "04217",
    status: GameStatus.Waiting,
    prevailingWind: PrevailingWind.East,
    ruleset: Ruleset.HongKong,
    seatIndex: 0,
  },
};

function sessionAndMe(profile: typeof namedProfile) {
  return [
    {
      method: "POST",
      path: "/api/session",
      status: HttpStatus.Ok,
      body: successBody({ userId: "user-1" }),
    },
    {
      method: "GET",
      path: "/api/me",
      status: HttpStatus.Ok,
      body: successBody(profile),
    },
  ];
}

function createPage(
  fetchFn: ReturnType<typeof createFakeFetch>,
  uuid = gameId,
  socket = new FakeGameSocket(),
) {
  const visits: string[] = [];
  const api = new ApiClient(fetchFn);
  const logic = new GamePageLogic(
    uuid,
    new AuthLogic(api),
    new GamesLogic(api),
    {
      visit(path) {
        visits.push(path);
      },
    },
    socket,
  );
  return { logic, visits, socket };
}

describe("GamePageLogic", () => {
  it("loads the snapshot and selects the waiting panel", async () => {
    const snapshot = waitingSnapshot({ gameId });
    const fetchFn = createFakeFetch([
      ...sessionAndMe(namedProfile),
      {
        method: "GET",
        path: `/api/games/${gameId}`,
        status: HttpStatus.Ok,
        body: successBody(snapshot),
      },
      {
        method: "POST",
        path: "/api/socket-ticket",
        status: HttpStatus.Ok,
        body: successBody({ ticket: "ticket-1" }),
      },
    ]);
    const { logic, visits, socket } = createPage(fetchFn);
    await logic.bootstrap();
    expect(visits).toEqual([]);
    expect(logic.panel).toBe(GamePanel.Waiting);
    expect(logic.snapshot?.game.referenceCode).toBe("04217");
    expect(socket.connects).toEqual([{ ticket: "ticket-1", gameId }]);
  });

  it("visits register when the snapshot is notSeated, unauthorized, or missing", async () => {
    const fetchFn = createFakeFetch([
      ...sessionAndMe({
        ...namedProfile,
        currentGame: null,
      }),
      {
        method: "GET",
        path: `/api/games/${gameId}`,
        status: HttpStatus.Forbidden,
        body: failedBody(ApiError.NotSeated),
      },
    ]);
    const { logic, visits } = createPage(fetchFn);
    await logic.bootstrap();
    expect(visits).toEqual(["/register"]);
  });

  it("visits the seated game when the path uuid is a different table", async () => {
    const fetchFn = createFakeFetch(sessionAndMe(namedProfile));
    const { logic, visits } = createPage(fetchFn, otherGameId);
    await logic.bootstrap();
    expect(visits).toEqual([`/game/${gameId}`]);
  });

  it("aborts then visits register", async () => {
    const snapshot = waitingSnapshot({ gameId });
    const fetchFn = createFakeFetch([
      ...sessionAndMe(namedProfile),
      {
        method: "GET",
        path: `/api/games/${gameId}`,
        status: HttpStatus.Ok,
        body: successBody(snapshot),
      },
      {
        method: "POST",
        path: "/api/socket-ticket",
        status: HttpStatus.Ok,
        body: successBody({ ticket: "ticket-1" }),
      },
      {
        method: "POST",
        path: `/api/games/${gameId}/abort`,
        status: HttpStatus.Ok,
        body: successBody({ aborted: true }),
      },
    ]);
    const { logic, visits } = createPage(fetchFn);
    await logic.bootstrap();
    await logic.abort();
    expect(visits).toEqual(["/register"]);
  });

  it("adds a bot and can start the round when the fourth seat fills", async () => {
    const waiting = waitingSnapshot({ gameId });
    const started = waitingSnapshot({ gameId, status: GameStatus.InProgress });
    started.round = {
      phase: RoundPhase.Discard,
      currentSeatIndex: 0,
      resultType: null,
      winKind: null,
      wallRemainingCount: 80,
    };
    const fetchFn = createFakeFetch([
      ...sessionAndMe(namedProfile),
      {
        method: "GET",
        path: `/api/games/${gameId}`,
        status: HttpStatus.Ok,
        body: successBody(waiting),
      },
      {
        method: "POST",
        path: "/api/socket-ticket",
        status: HttpStatus.Ok,
        body: successBody({ ticket: "ticket-1" }),
      },
      {
        method: "POST",
        path: `/api/games/${gameId}/bot`,
        status: HttpStatus.Ok,
        body: successBody(started),
      },
    ]);
    const { logic } = createPage(fetchFn);
    await logic.bootstrap();
    logic.waiting.botDifficulty = BotDifficulty.Smart;
    await logic.addBot();
    expect(fetchFn.calls.at(-1)?.body).toEqual({ difficulty: BotDifficulty.Smart });
    expect(logic.panel).toBe(GamePanel.Play);
  });

  it("keeps the live hand when a public state refresh arrives", () => {
    const snapshot = waitingSnapshot({ gameId, status: GameStatus.InProgress });
    snapshot.game.claimWindowMs = null;
    snapshot.round = {
      phase: RoundPhase.Discard,
      currentSeatIndex: 0,
      resultType: null,
      winKind: null,
      wallRemainingCount: 80,
    };
    snapshot.self = {
      seatIndex: 0,
      handTiles: [
        {
          id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          tileCode: "man_1",
          sortIndex: 0,
          isDrawn: false,
        },
        {
          id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
          tileCode: "man_2",
          sortIndex: 1,
          isDrawn: true,
        },
      ],
    };
    const { logic } = createPage(createFakeFetch([]));
    logic.applySnapshot(snapshot);
    logic.play.toggleTile("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb");
    logic.discard();
    logic.applyDiscarded({ seatIndex: 0, tileCode: "man_2", tileId: "discard-row" });
    const { self: _self, ...publicState } = snapshot;
    logic.applyPublicState({
      ...publicState,
      round: {
        phase: RoundPhase.Claim,
        currentSeatIndex: 0,
        resultType: null,
        winKind: null,
        wallRemainingCount: 80,
      },
      publicTiles: {
        discards: [{ seatIndex: 0, tileCode: "man_2", sortIndex: 0 }],
        melds: [],
        flowerTiles: [],
      },
    });
    expect(logic.play.hand.map((tile) => tile.id)).toEqual([
      "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    ]);
    expect(logic.play.publicTiles.discards).toEqual([
      { seatIndex: 0, tileCode: "man_2", sortIndex: 0 },
    ]);
  });

  it("keeps a bot seat connected when presence says away", () => {
    const snapshot = waitingSnapshot({ gameId });
    snapshot.seats.push({
      seatIndex: 1,
      userId: "bot-1",
      displayName: "Bot (low)",
      runningScore: 0,
      nextWindAgreed: false,
      botDifficulty: BotDifficulty.Low,
    });
    const { logic } = createPage(createFakeFetch([]));
    logic.applySnapshot(snapshot);
    expect(logic.snapshot?.seats[1]?.connected).toBe(true);
    logic.applyPresence(1, false);
    expect(logic.snapshot?.seats[1]?.connected).toBe(true);
    logic.applyPresence(0, true);
    logic.applyPresence(0, false);
    expect(logic.snapshot?.seats[0]?.connected).toBe(false);
  });

  it("marks the invitation code copied on the waiting view model", async () => {
    const { logic } = createPage(createFakeFetch([]));
    logic.markCodeCopied();
    expect(logic.waiting.copied).toBe(true);
  });
});
