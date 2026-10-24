import { describe, expect, it } from "vitest";
import { AuthLogic } from "../../logic/client/auth/authLogic";
import { GamePageLogic } from "../../logic/client/game/gamePageLogic";
import { GamesLogic } from "../../logic/client/game/gamesLogic";
import { ApiClient } from "../../logic/client/http/apiClient";
import { type ProfileResponse } from "../../model/server/profileResponse";
import { GamePanel } from "../../types/client/gamePanel";
import { ApiError, HttpStatus } from "../../types/server/api";
import { GameStatus } from "../../types/server/gameStatus";
import { PrevailingWind } from "../../types/server/prevailingWind";
import { UserAttributeName } from "../../types/server/profile";
import { RoundPhase } from "../../types/server/roundPhase";
import { RoundResultType } from "../../types/server/roundResultType";
import { WinKind } from "../../types/server/winKind";
import { Ruleset } from "../../types/server/ruleset";
import { createFakeFetch, failedBody, successBody } from "./fakeApi";
import { FakeGameSocket } from "./fakeSocket";
import { waitingSnapshot } from "./snapshotFixture";

const gameId = "11111111-1111-4111-8111-111111111111";
const nextGameId = "33333333-3333-4333-8333-333333333333";

const namedProfile: ProfileResponse = {
  userId: "user-1",
  attributes: { [UserAttributeName.DisplayName]: "Host" },
  figures: {},
  currentGame: {
    gameId,
    referenceCode: "04217",
    status: GameStatus.Completed,
    prevailingWind: PrevailingWind.East,
    ruleset: Ruleset.HongKong,
    seatIndex: 0,
  },
};

function completedSnapshot() {
  const snapshot = waitingSnapshot({ gameId, status: GameStatus.Completed });
  snapshot.round = {
    phase: RoundPhase.Discard,
    currentSeatIndex: 0,
    resultType: RoundResultType.Win,
    winKind: WinKind.SelfDraw,
    wallRemainingCount: 10,
  };
  snapshot.scores.roundScores = [
    {
      seatIndex: 0,
      userId: "user-1",
      scoreDelta: 8,
      scoreAfter: 8,
      scoreUnits: 3,
      isWinner: true,
    },
  ];
  snapshot.game.completedAt = "2026-01-01T00:00:00.000Z";
  return snapshot;
}

function createPage(fetchFn: ReturnType<typeof createFakeFetch>) {
  const visits: string[] = [];
  const socket = new FakeGameSocket();
  const api = new ApiClient(fetchFn);
  const logic = new GamePageLogic(
    gameId,
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

describe("round result", () => {
  it("selects the result panel and skips the socket for a completed game", async () => {
    const snapshot = completedSnapshot();
    const fetchFn = createFakeFetch([
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
        body: successBody(namedProfile),
      },
      {
        method: "GET",
        path: `/api/games/${gameId}`,
        status: HttpStatus.Ok,
        body: successBody(snapshot),
      },
    ]);
    const { logic, socket } = createPage(fetchFn);
    await logic.bootstrap();
    expect(logic.panel).toBe(GamePanel.Result);
    expect(logic.result.nextWindEnabled).toBe(true);
    expect(socket.connects).toEqual([]);
  });

  it("visits the new game after next-wind agreement", async () => {
    const current = completedSnapshot();
    const next = waitingSnapshot({ gameId: nextGameId, status: GameStatus.InProgress });
    const fetchFn = createFakeFetch([
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
        body: successBody(namedProfile),
      },
      {
        method: "GET",
        path: `/api/games/${gameId}`,
        status: HttpStatus.Ok,
        body: successBody(current),
      },
      {
        method: "POST",
        path: `/api/games/${gameId}/next-wind`,
        status: HttpStatus.Ok,
        body: successBody(next),
      },
    ]);
    const { logic, visits } = createPage(fetchFn);
    await logic.bootstrap();
    await logic.agreeNextWind();
    expect(visits).toEqual([`/game/${nextGameId}`]);
  });

  it("disables next wind on northComplete", async () => {
    const snapshot = completedSnapshot();
    snapshot.game.prevailingWind = PrevailingWind.North;
    const fetchFn = createFakeFetch([
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
        body: successBody({
          ...namedProfile,
          currentGame: {
            gameId,
            referenceCode: "04217",
            status: GameStatus.Completed,
            prevailingWind: PrevailingWind.North,
            ruleset: Ruleset.HongKong,
            seatIndex: 0,
          },
        }),
      },
      {
        method: "GET",
        path: `/api/games/${gameId}`,
        status: HttpStatus.Ok,
        body: successBody(snapshot),
      },
      {
        method: "POST",
        path: `/api/games/${gameId}/next-wind`,
        status: HttpStatus.Conflict,
        body: failedBody(ApiError.NorthComplete),
      },
    ]);
    const { logic, visits } = createPage(fetchFn);
    await logic.bootstrap();
    expect(logic.result.nextWindEnabled).toBe(false);
    await logic.agreeNextWind();
    expect(logic.result.error).toBe(ApiError.NorthComplete);
    expect(logic.result.nextWindEnabled).toBe(false);
    expect(visits).toEqual([]);
  });
});
