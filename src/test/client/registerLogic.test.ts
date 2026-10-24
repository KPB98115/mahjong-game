import { describe, expect, it } from "vitest";
import { AuthLogic } from "../../logic/client/auth/authLogic";
import { GamesLogic } from "../../logic/client/game/gamesLogic";
import { ApiClient } from "../../logic/client/http/apiClient";
import { RegisterLogic } from "../../logic/client/register/registerLogic";
import { ClaimWindowMs } from "../../types/server/claimWindowMs";
import { ApiError, HttpStatus } from "../../types/server/api";
import { GameStatus } from "../../types/server/gameStatus";
import { PrevailingWind } from "../../types/server/prevailingWind";
import { Ruleset } from "../../types/server/ruleset";
import { UserAttributeName } from "../../types/server/profile";
import { createFakeFetch, failedBody, successBody } from "./fakeApi";
import { waitingSnapshot } from "./snapshotFixture";

const defaults = { autoDraw: true, claimWindowMs: ClaimWindowMs.FiveSeconds };

const namedProfile = {
  userId: "user-1",
  attributes: { [UserAttributeName.DisplayName]: "Host" },
  figures: {},
  currentGame: null,
};

function createRegister(fetchFn: ReturnType<typeof createFakeFetch>) {
  const visits: string[] = [];
  const api = new ApiClient(fetchFn);
  const logic = new RegisterLogic(
    new AuthLogic(api),
    new GamesLogic(api),
    {
      visit(path) {
        visits.push(path);
      },
    },
    defaults,
  );
  return { logic, visits, fetchFn };
}

describe("RegisterLogic", () => {
  it("visits the seated game when bootstrap loads currentGame", async () => {
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
            gameId: "game-9",
            referenceCode: "04217",
            status: GameStatus.Waiting,
            prevailingWind: PrevailingWind.East,
            ruleset: Ruleset.HongKong,
            seatIndex: 0,
          },
        }),
      },
    ]);
    const { logic, visits } = createRegister(fetchFn);
    await logic.bootstrap();
    expect(visits).toEqual(["/game/game-9"]);
    expect(logic.hasDisplayName).toBe(true);
  });

  it("does not create or join until displayName is saved", async () => {
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
          userId: "user-1",
          attributes: {},
          figures: {},
          currentGame: null,
        }),
      },
    ]);
    const { logic, visits } = createRegister(fetchFn);
    await logic.bootstrap();
    await logic.create();
    logic.joinGame.referenceCode = "04217";
    await logic.join();
    expect(logic.register.error).toBe(ApiError.InvalidBody);
    expect(visits).toEqual([]);
    expect(fetchFn.calls.map((call) => `${call.method} ${call.path}`)).toEqual([
      "POST /api/session",
      "GET /api/me",
    ]);
  });

  it("keeps a join format error local until the code is five digits 0-9", async () => {
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
    ]);
    const { logic } = createRegister(fetchFn);
    await logic.bootstrap();
    logic.joinGame.referenceCode = "42";
    await logic.join();
    expect(logic.joinGame.error).toBe(ApiError.InvalidBody);
    logic.joinGame.referenceCode = "04a17";
    await logic.join();
    expect(logic.joinGame.error).toBe(ApiError.InvalidBody);
    expect(fetchFn.calls.some((call) => call.path === "/api/games/join")).toBe(false);
  });

  it("omits unchanged optional create fields and visits the new game", async () => {
    const snapshot = waitingSnapshot({ gameId: "game-created" });
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
        method: "POST",
        path: "/api/games",
        status: HttpStatus.Ok,
        body: successBody(snapshot),
      },
    ]);
    const { logic, visits } = createRegister(fetchFn);
    await logic.bootstrap();
    logic.createGame.handTileCount = 16;
    await logic.create();
    expect(fetchFn.calls.at(-1)?.body).toEqual({
      ruleset: Ruleset.HongKong,
      handTileCount: 16,
    });
    expect(visits).toEqual(["/game/game-created"]);
  });

  it("lands alreadySeated and gameNotFound on the view model", async () => {
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
        method: "POST",
        path: "/api/games",
        status: HttpStatus.Conflict,
        body: failedBody(ApiError.AlreadySeated),
      },
      {
        method: "POST",
        path: "/api/games/join",
        status: HttpStatus.NotFound,
        body: failedBody(ApiError.GameNotFound),
      },
    ]);
    const { logic, visits } = createRegister(fetchFn);
    await logic.bootstrap();
    await logic.create();
    expect(logic.register.error).toBe(ApiError.AlreadySeated);
    logic.joinGame.referenceCode = "04217";
    await logic.join();
    expect(logic.joinGame.error).toBe(ApiError.GameNotFound);
    expect(visits).toEqual([]);
  });
});
