import { z } from "zod";
import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import { AuthLogic } from "../logic/server/auth/authLogic";
import { type GameRandom } from "../logic/server/game/gameRandom";
import { GamesLogic } from "../logic/server/game/gamesLogic";
import { RoundsLogic } from "../logic/server/game/roundsLogic";
import { scoringCatalogVersion } from "../logic/server/game/scoringVersion";
import { SeatsLogic } from "../logic/server/game/seatsLogic";
import { standardWallTileCodes } from "../logic/server/game/wallTileCodes";
import {
  getGame,
  getMe,
  patchMe,
  postAbortGame,
  postGame,
  postJoinGame,
  postNextWind,
  postSession,
  postSocketTicket,
} from "../logic/server/http/sessionHandlers";
import { UserLogic } from "../logic/server/user/userLogic";
import { ApiError, ApiStatus, HttpStatus } from "../types/server/api";
import { type JsonValue } from "../types/server/jsonValue";
import { DiscardWinPayer } from "../types/server/discardWinPayer";
import { GameStatus } from "../types/server/gameStatus";
import {
  abortGameResponseSchema,
  sessionResponseSchema,
  socketTicketSchema,
} from "../model/server/actionResult";
import { gameSnapshotSchema, type GameSnapshot } from "../model/server/gameSnapshot";
import { profileResponseSchema } from "../model/server/profileResponse";
import { PrevailingWind } from "../types/server/prevailingWind";
import { RoundPhase } from "../types/server/roundPhase";
import { RoundStatus } from "../types/server/roundStatus";
import { Ruleset } from "../types/server/ruleset";
import { ScoreUnit } from "../types/server/scoreUnit";
import { createMemoryAuth, createMemoryRedis } from "./fakeAuth";
import { createMemoryGame } from "./memoryGame";

const now = new Date("2026-06-01T00:00:00.000Z");
const missingGameId = "00000000-0000-0000-0000-000000000000";

type CallResult = {
  status: number;
  payload: { status: string; data?: JsonValue; error?: string };
  setCookie: string | null;
};

function fixedRandom(overrides: Partial<GameRandom> = {}): GameRandom {
  return {
    referenceCode() {
      return "04217";
    },
    dealerSeatIndex() {
      return 1;
    },
    shuffle(items) {
      return items.slice();
    },
    ...overrides,
  };
}

function createWorld(random: GameRandom = fixedRandom()) {
  const auth = createMemoryAuth();
  const redis = createMemoryRedis();
  const tables = createMemoryGame();
  const repos = {
    gamesRepo: tables.gamesRepo,
    seatsRepo: tables.seatsRepo,
    roundsRepo: tables.roundsRepo,
    handsRepo: tables.handsRepo,
    handTilesRepo: tables.handTilesRepo,
    wallTilesRepo: tables.wallTilesRepo,
    discardTilesRepo: tables.discardTilesRepo,
    flowerTilesRepo: tables.flowerTilesRepo,
    meldsRepo: tables.meldsRepo,
    meldTilesRepo: tables.meldTilesRepo,
    roundScoresRepo: tables.roundScoresRepo,
    scorePaymentsRepo: tables.scorePaymentsRepo,
    userRepo: auth.userRepo,
  };
  const roundsLogic = new RoundsLogic(
    repos.gamesRepo,
    repos.roundsRepo,
    repos.handsRepo,
    repos.handTilesRepo,
    repos.wallTilesRepo,
    repos.flowerTilesRepo,
    repos.seatsRepo,
    random,
  );
  const seatsLogic = new SeatsLogic(
    repos.seatsRepo,
    repos.gamesRepo,
    roundsLogic,
    repos,
    tables.runTransaction,
    random,
  );
  const gamesLogic = new GamesLogic(
    repos,
    roundsLogic,
    seatsLogic,
    tables.runTransaction,
    random,
    tables.redis,
  );
  const authLogic = new AuthLogic(
    auth.authRepo,
    auth.userRepo,
    tables.seatsRepo,
    redis.redis,
    auth.runTransaction,
  );
  const userLogic = new UserLogic(auth.userRepo, seatsLogic);
  const app = new Hono();
  app.post("/api/session", (c) => postSession(c, authLogic, now));
  app.get("/api/me", (c) => getMe(c, authLogic, userLogic, now));
  app.patch("/api/me", (c) => patchMe(c, authLogic, userLogic, now));
  app.post("/api/socket-ticket", (c) => postSocketTicket(c, authLogic, now));
  app.post("/api/games", (c) => postGame(c, authLogic, gamesLogic, now));
  app.post("/api/games/join", (c) => postJoinGame(c, authLogic, seatsLogic, now));
  app.get("/api/games/:gameId", (c) =>
    getGame(c, c.req.param("gameId") ?? "", authLogic, gamesLogic, now),
  );
  app.post("/api/games/:gameId/next-wind", (c) =>
    postNextWind(c, c.req.param("gameId") ?? "", authLogic, gamesLogic, now),
  );
  app.post("/api/games/:gameId/abort", (c) =>
    postAbortGame(c, c.req.param("gameId") ?? "", authLogic, gamesLogic, now),
  );
  return { app, auth, redis, tables, repos };
}

async function call(
  app: Hono,
  method: string,
  path: string,
  cookie?: string,
  body?: JsonValue,
): Promise<CallResult> {
  const headers = new Headers();
  if (cookie != null) {
    headers.set("cookie", cookie);
  }
  if (body !== undefined) {
    headers.set("content-type", "application/json");
  }
  const response = await app.request(`http://localhost${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const payload: CallResult["payload"] = await response.json();
  return {
    status: response.status,
    payload,
    setCookie: response.headers.get("set-cookie"),
  };
}

function cookieHeader(setCookie: string | null): string {
  const pair = setCookie?.split(";")[0];
  if (pair == null || pair === "") {
    throw new Error("missing session cookie");
  }
  return pair;
}

function successData<Schema extends z.ZodType>(
  schema: Schema,
  result: CallResult,
): z.output<Schema> {
  expect(result.payload.status).toBe(ApiStatus.Success);
  return schema.parse(result.payload.data);
}

function expectFailed(result: CallResult, status: HttpStatus, error: ApiError): void {
  expect(result.status).toBe(status);
  expect(result.payload).toEqual({ status: ApiStatus.Failed, error });
}

async function register(app: Hono): Promise<{ cookie: string; userId: string }> {
  const result = await call(app, "POST", "/api/session");
  expect(result.status).toBe(HttpStatus.Ok);
  const data = successData(sessionResponseSchema, result);
  return { cookie: cookieHeader(result.setCookie), userId: data.userId };
}

async function namePlayer(app: Hono, cookie: string, displayName: string): Promise<void> {
  const result = await call(app, "PATCH", "/api/me", cookie, {
    attributes: { displayName },
  });
  expect(result.status).toBe(HttpStatus.Ok);
}

describe("session and profile endpoints", () => {
  it("requires a live session on every route except POST /api/session", async () => {
    const { app } = createWorld();
    const routes: Array<[string, string, JsonValue | undefined]> = [
      ["GET", "/api/me", undefined],
      ["PATCH", "/api/me", { attributes: { displayName: "A" } }],
      ["POST", "/api/socket-ticket", undefined],
      ["POST", "/api/games", { ruleset: "hongKong" }],
      ["POST", "/api/games/join", { referenceCode: "04217" }],
      ["GET", `/api/games/${missingGameId}`, undefined],
      ["POST", `/api/games/${missingGameId}/next-wind`, undefined],
      ["POST", `/api/games/${missingGameId}/abort`, undefined],
    ];
    for (const [method, path, body] of routes) {
      expectFailed(
        await call(app, method, path, undefined, body),
        HttpStatus.Unauthorized,
        ApiError.Unauthorized,
      );
    }
  });

  it("mints a session cookie and reuses that user on the next POST /api/session", async () => {
    const { app, auth } = createWorld();
    const first = await register(app);
    const second = await call(app, "POST", "/api/session", first.cookie);
    expect(second.status).toBe(HttpStatus.Ok);
    expect(successData(sessionResponseSchema, second).userId).toBe(first.userId);
    expect(cookieHeader(second.setCookie).startsWith("session=")).toBe(true);
    expect(auth.users.size).toBe(1);
    expect(second.setCookie?.includes("HttpOnly")).toBe(true);
  });

  it("patches displayName and returns it from GET /api/me", async () => {
    const { app } = createWorld();
    const player = await register(app);
    const patched = await call(app, "PATCH", "/api/me", player.cookie, {
      attributes: { displayName: "  Host  " },
    });
    expect(patched.status).toBe(HttpStatus.Ok);
    expect(successData(profileResponseSchema, patched)).toMatchObject({
      attributes: { displayName: "Host" },
      currentGame: null,
    });
    const profile = await call(app, "GET", "/api/me", player.cookie);
    expect(successData(profileResponseSchema, profile).attributes.displayName).toBe("Host");
  });

  it("returns invalidBody when the profile body is not json or the name is blank", async () => {
    const { app } = createWorld();
    const player = await register(app);
    const notJson = await app.request("http://localhost/api/me", {
      method: "PATCH",
      headers: { cookie: player.cookie, "content-type": "application/json" },
      body: "{",
    });
    expect(notJson.status).toBe(HttpStatus.UnprocessableEntity);
    expect(await notJson.json()).toEqual({
      status: ApiStatus.Failed,
      error: ApiError.InvalidBody,
    });
    expectFailed(
      await call(app, "PATCH", "/api/me", player.cookie, { attributes: { displayName: " " } }),
      HttpStatus.UnprocessableEntity,
      ApiError.InvalidBody,
    );
  });

  it("mints a socket ticket and returns redisUnavailable when redis cannot store it", async () => {
    const world = createWorld();
    const player = await register(world.app);
    const minted = await call(world.app, "POST", "/api/socket-ticket", player.cookie);
    expect(minted.status).toBe(HttpStatus.Ok);
    const ticket = successData(socketTicketSchema, minted).ticket;
    expect(ticket.length).toBeGreaterThan(0);
    expect([...world.redis.tickets.values()].some((row) => row.userId === player.userId)).toBe(
      true,
    );
    world.redis.failTicket = true;
    expectFailed(
      await call(world.app, "POST", "/api/socket-ticket", player.cookie),
      HttpStatus.ServiceUnavailable,
      ApiError.RedisUnavailable,
    );
  });
});

describe("POST /api/games", () => {
  it("rejects an unknown ruleset, a bad claim window, and other invalid bodies", async () => {
    const { app } = createWorld();
    const player = await register(app);
    expectFailed(
      await call(app, "POST", "/api/games", player.cookie, { ruleset: "japanese" }),
      HttpStatus.UnprocessableEntity,
      ApiError.RulesetUnknown,
    );
    expectFailed(
      await call(app, "POST", "/api/games", player.cookie, {}),
      HttpStatus.UnprocessableEntity,
      ApiError.RulesetUnknown,
    );
    expectFailed(
      await call(app, "POST", "/api/games", player.cookie, {
        ruleset: "hongKong",
        claimWindowMs: 1000,
      }),
      HttpStatus.UnprocessableEntity,
      ApiError.InvalidClaimWindow,
    );
    expectFailed(
      await call(app, "POST", "/api/games", player.cookie, { ruleset: "hongKong", extra: true }),
      HttpStatus.UnprocessableEntity,
      ApiError.InvalidBody,
    );
    expectFailed(
      await call(app, "POST", "/api/games", player.cookie, {
        ruleset: "hongKong",
        handTileCount: 0,
      }),
      HttpStatus.UnprocessableEntity,
      ApiError.InvalidBody,
    );
  });

  it("opens an east waiting table with preset rules and seats the host at index 0", async () => {
    const { app } = createWorld();
    const host = await register(app);
    await namePlayer(app, host.cookie, "Host");
    const created = await call(app, "POST", "/api/games", host.cookie, { ruleset: "hongKong" });
    expect(created.status).toBe(HttpStatus.Ok);
    const snapshot = successData(gameSnapshotSchema, created);
    expect(snapshot.game).toMatchObject({
      referenceCode: "04217",
      status: GameStatus.Waiting,
      prevailingWind: PrevailingWind.East,
      ruleset: Ruleset.HongKong,
      handTileCount: 13,
      winMeldCount: 4,
      scoreUnit: ScoreUnit.Fan,
      autoDraw: true,
      claimWindowMs: 5000,
      scoringVersion: scoringCatalogVersion,
      dealerSeatIndex: null,
      completedAt: null,
    });
    expect(snapshot.seats).toEqual([
      {
        seatIndex: 0,
        userId: host.userId,
        displayName: "Host",
        runningScore: 0,
        nextWindAgreed: false,
      },
    ]);
    expect(snapshot.round).toBeNull();
    expect(snapshot.self).toEqual({ seatIndex: 0, handTiles: [] });
    const profile = successData(
      profileResponseSchema,
      await call(app, "GET", "/api/me", host.cookie),
    );
    expect(profile.currentGame).toEqual({
      gameId: snapshot.game.id,
      referenceCode: "04217",
      status: GameStatus.Waiting,
      prevailingWind: PrevailingWind.East,
      ruleset: Ruleset.HongKong,
      seatIndex: 0,
    });
  });

  it("stores explicit rule overrides and retries a colliding reference code", async () => {
    const codes = ["04217", "04218"];
    const world = createWorld(
      fixedRandom({
        referenceCode() {
          return codes.shift() ?? "09999";
        },
      }),
    );
    await world.tables.gamesRepo.insert({
      referenceCode: "04217",
      status: GameStatus.Waiting,
      prevailingWind: PrevailingWind.East,
      ruleset: Ruleset.HongKong,
      handTileCount: 13,
      winMeldCount: 4,
      scoreUnit: ScoreUnit.Fan,
      bonusTilesEnabled: true,
      chowOnlyFromPrevious: true,
      minScoreUnits: "0",
      discardWinPayer: DiscardWinPayer.Discarder,
      scoringVersion: scoringCatalogVersion,
      autoDraw: false,
      claimWindowMs: null,
    });
    const host = await register(world.app);
    const created = await call(world.app, "POST", "/api/games", host.cookie, {
      ruleset: "taiwan",
      handTileCount: 16,
      autoDraw: false,
      claimWindowMs: null,
      scoreUnit: "tai",
    });
    const snapshot = successData(gameSnapshotSchema, created);
    expect(snapshot.game.referenceCode).toBe("04218");
    expect(snapshot.game).toMatchObject({
      ruleset: Ruleset.Taiwan,
      handTileCount: 16,
      winMeldCount: 5,
      scoreUnit: ScoreUnit.Tai,
      autoDraw: false,
      claimWindowMs: null,
    });
  });

  it("returns alreadySeated when the user opens a second table", async () => {
    const { app } = createWorld();
    const host = await register(app);
    expect(
      (await call(app, "POST", "/api/games", host.cookie, { ruleset: "hongKong" })).status,
    ).toBe(HttpStatus.Ok);
    expectFailed(
      await call(app, "POST", "/api/games", host.cookie, { ruleset: "taiwan" }),
      HttpStatus.Conflict,
      ApiError.AlreadySeated,
    );
  });
});

describe("POST /api/games/join and GET /api/games/:gameId", () => {
  it("rejects a bad reference code, an unknown code, a full table, and a started table", async () => {
    const { app, tables } = createWorld();
    const host = await register(app);
    const guest = await register(app);
    const created = successData(
      gameSnapshotSchema,
      await call(app, "POST", "/api/games", host.cookie, { ruleset: "hongKong" }),
    );
    expectFailed(
      await call(app, "POST", "/api/games/join", guest.cookie, { referenceCode: "4217" }),
      HttpStatus.UnprocessableEntity,
      ApiError.InvalidBody,
    );
    expectFailed(
      await call(app, "POST", "/api/games/join", guest.cookie, { referenceCode: "00000" }),
      HttpStatus.NotFound,
      ApiError.GameNotFound,
    );
    expectFailed(
      await call(app, "GET", `/api/games/${created.game.id}`, guest.cookie),
      HttpStatus.Forbidden,
      ApiError.NotSeated,
    );
    expectFailed(
      await call(app, "GET", "/api/games/not-a-uuid", host.cookie),
      HttpStatus.NotFound,
      ApiError.GameNotFound,
    );
    for (const seatIndex of [1, 2, 3]) {
      await tables.seatsRepo.insert({
        gameId: created.game.id,
        seatIndex,
        userId: `filler-${seatIndex}`,
        runningScore: "0",
        nextWindAgreed: false,
      });
    }
    expectFailed(
      await call(app, "POST", "/api/games/join", guest.cookie, { referenceCode: "04217" }),
      HttpStatus.Conflict,
      ApiError.GameFull,
    );
    await tables.gamesRepo.update(created.game.id, { status: GameStatus.InProgress });
    const late = await register(app);
    expectFailed(
      await call(app, "POST", "/api/games/join", late.cookie, { referenceCode: "04217" }),
      HttpStatus.Conflict,
      ApiError.GameNotWaiting,
    );
  });

  it("deals east when the fourth player joins and hides every other hand", async () => {
    const { app } = createWorld();
    const players = [];
    for (const name of ["Host", "South", "West", "North"]) {
      const player = await register(app);
      await namePlayer(app, player.cookie, name);
      players.push(player);
    }
    const host = players[0];
    const dealer = players[1];
    const last = players[3];
    if (host == null || dealer == null || last == null) {
      throw new Error("expected four players");
    }
    const created = successData(
      gameSnapshotSchema,
      await call(app, "POST", "/api/games", host.cookie, { ruleset: "hongKong" }),
    );
    await call(app, "POST", "/api/games/join", players[1]?.cookie, { referenceCode: "04217" });
    await call(app, "POST", "/api/games/join", players[2]?.cookie, { referenceCode: "04217" });
    const started = await call(app, "POST", "/api/games/join", last.cookie, {
      referenceCode: "04217",
    });
    expect(started.status).toBe(HttpStatus.Ok);
    const snapshot = successData(gameSnapshotSchema, started);
    expect(snapshot.game.status).toBe(GameStatus.InProgress);
    expect(snapshot.game.dealerSeatIndex).toBe(1);
    expect(snapshot.round).toMatchObject({
      phase: RoundPhase.Discard,
      currentSeatIndex: 1,
      wallRemainingCount: 91,
      resultType: null,
      winKind: null,
    });
    expect(snapshot.self?.seatIndex).toBe(3);
    expect(snapshot.self?.handTiles).toHaveLength(13);
    expect(snapshot.seats.map((seat) => seat.displayName)).toEqual([
      "Host",
      "South",
      "West",
      "North",
    ]);
    expect(countTileCodes(snapshot)).toBe(13);
    const dealerView = successData(
      gameSnapshotSchema,
      await call(app, "GET", `/api/games/${created.game.id}`, dealer.cookie),
    );
    expect(dealerView.self?.handTiles).toHaveLength(14);
    expect(dealerView.self?.handTiles.filter((tile) => tile.isDrawn)).toEqual([
      expect.objectContaining({ tileCode: "bam_5", isDrawn: true }),
    ]);
    expect(dealerView.round?.wallRemainingCount).toBe(91);
    expect(countTileCodes(dealerView)).toBe(14);
    expect(standardWallTileCodes()).toHaveLength(144);
    const hostView = successData(
      gameSnapshotSchema,
      await call(app, "GET", `/api/games/${created.game.id}`, host.cookie),
    );
    expect(hostView.self?.handTiles.every((tile) => !tile.isDrawn)).toBe(true);
    expect(hostView.self?.handTiles[0]?.tileCode).toBe("man_1");
  });

  it("replaces a flower drawn for the dealer and can leave the opening draw to the client", async () => {
    const flowerWorld = createWorld(
      fixedRandom({
        shuffle<T>(items: T[]): T[] {
          const copy = items.slice();
          if (!isStringList(copy)) {
            return copy;
          }
          swap(copy, copy.indexOf("flower_plum"), 52);
          swap(copy, copy.indexOf("man_9"), copy.length - 1);
          return copy;
        },
      }),
    );
    const dealt = await seatFour(flowerWorld.app, { ruleset: "hongKong" });
    const dealerView = successData(
      gameSnapshotSchema,
      await call(flowerWorld.app, "GET", `/api/games/${dealt.gameId}`, dealt.dealer.cookie),
    );
    expect(dealerView.publicTiles.flowerTiles).toEqual([
      { seatIndex: 1, tileCode: "flower_plum", sortIndex: 0 },
    ]);
    expect(dealerView.self?.handTiles.filter((tile) => tile.isDrawn)).toEqual([
      expect.objectContaining({ tileCode: "man_9" }),
    ]);
    expect(dealerView.round?.wallRemainingCount).toBe(90);
    expect(countTileCodes(dealerView)).toBe(15);

    const manual = createWorld();
    const seated = await seatFour(manual.app, {
      ruleset: "hongKong",
      autoDraw: false,
      handTileCount: 16,
    });
    const view = successData(
      gameSnapshotSchema,
      await call(manual.app, "GET", `/api/games/${seated.gameId}`, seated.dealer.cookie),
    );
    expect(view.game.handTileCount).toBe(16);
    expect(view.round).toMatchObject({ phase: RoundPhase.Draw, wallRemainingCount: 80 });
    expect(view.self?.handTiles).toHaveLength(16);
    expect(view.self?.handTiles.some((tile) => tile.isDrawn)).toBe(false);
  });
});

describe("abort and next wind", () => {
  it("lets any seated player dissolve a waiting or live table", async () => {
    const world = createWorld();
    const host = await register(world.app);
    const guest = await register(world.app);
    const created = successData(
      gameSnapshotSchema,
      await call(world.app, "POST", "/api/games", host.cookie, { ruleset: "hongKong" }),
    );
    expectFailed(
      await call(world.app, "POST", `/api/games/${created.game.id}/abort`, guest.cookie),
      HttpStatus.Forbidden,
      ApiError.NotSeated,
    );
    const aborted = await call(
      world.app,
      "POST",
      `/api/games/${created.game.id}/abort`,
      host.cookie,
    );
    expect(aborted.status).toBe(HttpStatus.Ok);
    expect(successData(abortGameResponseSchema, aborted)).toEqual({ aborted: true });
    expect(world.tables.published).toEqual([created.game.id]);
    expect(world.tables.deletedCaches).toEqual([created.game.id]);
    expectFailed(
      await call(world.app, "GET", `/api/games/${created.game.id}`, host.cookie),
      HttpStatus.NotFound,
      ApiError.GameNotFound,
    );
    expectFailed(
      await call(world.app, "POST", `/api/games/${created.game.id}/abort`, host.cookie),
      HttpStatus.Conflict,
      ApiError.GameNotAbortable,
    );
    expectFailed(
      await call(world.app, "POST", "/api/games/not-a-uuid/abort", host.cookie),
      HttpStatus.Conflict,
      ApiError.GameNotAbortable,
    );
    const profile = successData(
      profileResponseSchema,
      await call(world.app, "GET", "/api/me", host.cookie),
    );
    expect(profile.currentGame).toBeNull();
  });

  it("refuses abort and next-wind until the hand is finished, then rotates off east", async () => {
    const world = createWorld();
    const seated = await seatFour(world.app, { ruleset: "hongKong" });
    expectFailed(
      await call(world.app, "POST", `/api/games/${seated.gameId}/next-wind`, seated.host.cookie),
      HttpStatus.Conflict,
      ApiError.GameNotCompleted,
    );
    await world.tables.gamesRepo.update(seated.gameId, {
      status: GameStatus.Completed,
      completedAt: now,
    });
    expectFailed(
      await call(world.app, "POST", `/api/games/${seated.gameId}/abort`, seated.host.cookie),
      HttpStatus.Conflict,
      ApiError.GameNotAbortable,
    );
    const rounds = await world.tables.roundsRepo.findByGameId(seated.gameId);
    const round = rounds[0];
    if (round == null) {
      throw new Error("expected a round");
    }
    await world.tables.roundsRepo.update(round.id, { status: RoundStatus.Completed });
    await world.tables.roundScoresRepo.insert({
      roundId: round.id,
      seatIndex: 0,
      userId: seated.host.userId,
      scoreDelta: "4",
      scoreAfter: "4",
      scoreUnits: "2",
      isWinner: true,
    });
    await world.tables.scorePaymentsRepo.insert({
      roundId: round.id,
      fromSeatIndex: 2,
      toSeatIndex: 0,
      amount: "4",
    });
    const hostSeat = (await world.tables.seatsRepo.findByGameId(seated.gameId)).find(
      (seat) => seat.userId === seated.host.userId,
    );
    if (hostSeat == null) {
      throw new Error("expected the host seat");
    }
    await world.tables.seatsRepo.update(hostSeat.id, { runningScore: "12" });
    const scored = successData(
      gameSnapshotSchema,
      await call(world.app, "GET", `/api/games/${seated.gameId}`, seated.host.cookie),
    );
    expect(scored.scores.roundScores).toEqual([
      {
        seatIndex: 0,
        userId: seated.host.userId,
        scoreDelta: 4,
        scoreAfter: 4,
        scoreUnits: 2,
        isWinner: true,
      },
    ]);
    expect(scored.scores.scorePayments).toEqual([{ fromSeatIndex: 2, toSeatIndex: 0, amount: 4 }]);
    for (const player of seated.players.slice(0, 3)) {
      const agreed = successData(
        gameSnapshotSchema,
        await call(world.app, "POST", `/api/games/${seated.gameId}/next-wind`, player.cookie),
      );
      expect(agreed.game.id).toBe(seated.gameId);
    }
    const advanced = successData(
      gameSnapshotSchema,
      await call(
        world.app,
        "POST",
        `/api/games/${seated.gameId}/next-wind`,
        seated.players[3]?.cookie,
      ),
    );
    expect(advanced.game.id).not.toBe(seated.gameId);
    expect(advanced.game).toMatchObject({
      referenceCode: "04217",
      prevailingWind: PrevailingWind.South,
      status: GameStatus.InProgress,
      dealerSeatIndex: 2,
    });
    expect(advanced.seats.every((seat) => !seat.nextWindAgreed)).toBe(true);
    expect(advanced.seats.find((seat) => seat.userId === seated.host.userId)?.runningScore).toBe(
      12,
    );
    expect(world.tables.deletedCaches).toEqual([seated.gameId]);
    expectFailed(
      await call(world.app, "GET", `/api/games/${seated.gameId}`, seated.host.cookie),
      HttpStatus.NotFound,
      ApiError.GameNotFound,
    );
    await world.tables.gamesRepo.update(advanced.game.id, {
      status: GameStatus.Completed,
      prevailingWind: PrevailingWind.North,
      completedAt: now,
    });
    expectFailed(
      await call(world.app, "POST", `/api/games/${advanced.game.id}/next-wind`, seated.host.cookie),
      HttpStatus.Conflict,
      ApiError.NorthComplete,
    );
  });
});

async function seatFour(
  app: Hono,
  body: JsonValue,
): Promise<{
  gameId: string;
  host: { cookie: string; userId: string };
  dealer: { cookie: string; userId: string };
  players: Array<{ cookie: string; userId: string }>;
}> {
  const players = [];
  for (let index = 0; index < 4; index += 1) {
    players.push(await register(app));
  }
  const host = players[0];
  const dealer = players[1];
  const last = players[3];
  if (host == null || dealer == null || last == null) {
    throw new Error("expected four players");
  }
  const created = successData(
    gameSnapshotSchema,
    await call(app, "POST", "/api/games", host.cookie, body),
  );
  await call(app, "POST", "/api/games/join", dealer.cookie, {
    referenceCode: created.game.referenceCode,
  });
  await call(app, "POST", "/api/games/join", players[2]?.cookie, {
    referenceCode: created.game.referenceCode,
  });
  const started = await call(app, "POST", "/api/games/join", last.cookie, {
    referenceCode: created.game.referenceCode,
  });
  expect(started.status).toBe(HttpStatus.Ok);
  return { gameId: created.game.id, host, dealer, players };
}

function isStringList<T>(items: T[]): items is T[] & string[] {
  return items.every((item) => typeof item === "string");
}

function swap(items: string[], from: number, to: number): void {
  const current = items[to];
  items[to] = items[from] ?? "";
  items[from] = current ?? "";
}

function countTileCodes(snapshot: GameSnapshot): number {
  const value: JsonValue = JSON.parse(JSON.stringify(snapshot));
  return countJson(value);
}

function countJson(value: JsonValue): number {
  if (Array.isArray(value)) {
    let count = 0;
    for (const item of value) {
      count += countJson(item);
    }
    return count;
  }
  if (typeof value === "object" && value != null) {
    let count = 0;
    for (const key of Object.keys(value)) {
      if (key === "tileCode") {
        count += 1;
      }
      const child = value[key];
      if (child != null) {
        count += countJson(child);
      }
    }
    return count;
  }
  return 0;
}
