import { expect } from "vitest";
import { createMemoryClaimWindowStore } from "../logic/server/game/claimWindowStore";
import { createGameLogics } from "../logic/server/game/gameLogics";
import { type GameRandom } from "../logic/server/game/gameRandom";
import { type GamesLogic } from "../logic/server/game/gamesLogic";
import { type HandTileRow } from "../logic/server/game/handTilesRepo";
import { type SnapshotRepos } from "../logic/server/game/loadGameSnapshot";
import { type RoundRow } from "../logic/server/game/roundsRepo";
import { type RoundsLogic } from "../logic/server/game/roundsLogic";
import { type SeatsLogic } from "../logic/server/game/seatsLogic";
import { isBonusTileCode } from "../logic/server/game/wallTileCodes";
import { type PlayEmit, type PlayOutcome } from "../model/server/playResult";
import { type JsonValue } from "../types/server/jsonValue";
import { type SocketError } from "../types/server/socketError";
import { type SocketEvent } from "../types/server/socketEvent";
import { createMemoryAuth, type MemoryAuth } from "./fakeAuth";
import { createMemoryGame, type MemoryGame } from "./memoryGame";

export const playNow = new Date("2026-06-01T00:00:00.000Z");

export type StackedWall = {
  hands?: string[][];
  draws?: string[];
  tail?: string[];
};

export type PlayWorldOptions = {
  body?: JsonValue;
  dealerSeatIndex?: number;
  wall?: StackedWall;
  players?: number;
};

export type PlayWorld = {
  tables: MemoryGame;
  auth: MemoryAuth;
  repos: SnapshotRepos;
  gamesLogic: GamesLogic;
  seatsLogic: SeatsLogic;
  roundsLogic: RoundsLogic;
  userIds: string[];
  gameId: string;
  hand(seatIndex: number): Promise<HandTileRow[]>;
  round(): Promise<RoundRow>;
  tileIds(seatIndex: number, codes: string[]): Promise<string[]>;
  restartRoundsLogic(): RoundsLogic;
};

export async function createPlayWorld(options: PlayWorldOptions = {}): Promise<PlayWorld> {
  const body = options.body ?? { ruleset: "hongKong" };
  const handTileCount = handTileCountFor(body);
  const random: GameRandom = {
    referenceCode() {
      return "04217";
    },
    dealerSeatIndex() {
      return options.dealerSeatIndex ?? 0;
    },
    shuffle<T>(items: T[]): T[] {
      const copy = items.slice();
      if (!isStringList(copy)) {
        return copy;
      }
      overwrite(copy, stackWall(copy, handTileCount, options.wall ?? {}));
      return copy;
    },
  };
  const tables = createMemoryGame();
  const auth = createMemoryAuth();
  const repos: SnapshotRepos = {
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
  function build(): ReturnType<typeof createGameLogics> {
    return createGameLogics({
      repos,
      runTransaction: tables.runTransaction,
      random,
      redis: tables.redis,
      claimWindowStore: createMemoryClaimWindowStore(),
    });
  }
  const logics = build();
  const userIds: string[] = [];
  const players = options.players ?? 4;
  for (let index = 0; index < players; index += 1) {
    const user = await auth.userRepo.insert({});
    await auth.userRepo.upsertAttribute(user.uuid, "displayName", `P${index}`);
    userIds.push(user.uuid);
  }
  const host = userIds[0];
  if (host == null) {
    throw new Error("expected a host");
  }
  const created = await logics.gamesLogic.create(host, body);
  if (!("snapshot" in created)) {
    throw new Error(`create failed: ${created.error}`);
  }
  for (const userId of userIds.slice(1)) {
    const joined = await logics.seatsLogic.join(userId, { referenceCode: "04217" }, playNow);
    if (!("snapshot" in joined)) {
      throw new Error(`join failed: ${joined.error}`);
    }
  }
  const gameId = created.snapshot.game.id;

  async function round(): Promise<RoundRow> {
    const rounds = await tables.roundsRepo.findByGameId(gameId);
    const found = rounds[rounds.length - 1];
    if (found == null) {
      throw new Error("expected a round");
    }
    return found;
  }

  async function hand(seatIndex: number): Promise<HandTileRow[]> {
    const current = await round();
    const row = await tables.handsRepo.findByRoundIdAndSeatIndex(current.id, seatIndex);
    if (row == null) {
      throw new Error(`expected a hand for seat ${seatIndex}`);
    }
    return tables.handTilesRepo.findByHandId(row.id);
  }

  async function tileIds(seatIndex: number, codes: string[]): Promise<string[]> {
    const rows = await hand(seatIndex);
    const used = new Set<string>();
    return codes.map((code) => {
      const found = rows.find((row) => row.tileCode === code && !used.has(row.id));
      if (found == null) {
        throw new Error(`seat ${seatIndex} has no spare ${code}`);
      }
      used.add(found.id);
      return found.id;
    });
  }

  return {
    tables,
    auth,
    repos,
    gamesLogic: logics.gamesLogic,
    seatsLogic: logics.seatsLogic,
    roundsLogic: logics.roundsLogic,
    userIds,
    gameId,
    hand,
    round,
    tileIds,
    restartRoundsLogic() {
      return build().roundsLogic;
    },
  };
}

export function userAt(world: PlayWorld, seatIndex: number): string {
  const userId = world.userIds[seatIndex];
  if (userId == null) {
    throw new Error(`no user at seat ${seatIndex}`);
  }
  return userId;
}

export function expectPlayError(outcome: PlayOutcome, error: SocketError): void {
  expect(outcome).toEqual({ ok: false, error });
}

export function emittedEvents(outcome: PlayOutcome): SocketEvent[] {
  if (!outcome.ok) {
    throw new Error(`expected ok, got ${outcome.error}`);
  }
  return outcome.result.emits.map((emit) => emit.event);
}

export function emitted<Event extends SocketEvent>(
  outcome: PlayOutcome,
  event: Event,
): Extract<PlayEmit, { event: Event }> {
  if (!outcome.ok) {
    throw new Error(`expected ok, got ${outcome.error}`);
  }
  const found = outcome.result.emits.find(
    (emit): emit is Extract<PlayEmit, { event: Event }> => emit.event === event,
  );
  if (found == null) {
    throw new Error(`expected ${event} in ${emittedEvents(outcome).join(", ")}`);
  }
  return found;
}

export async function discardDrawn(world: PlayWorld, seatIndex: number): Promise<PlayOutcome> {
  const rows = await world.hand(seatIndex);
  const tile = rows.find((row) => row.isDrawn) ?? rows[rows.length - 1];
  if (tile == null) {
    throw new Error(`seat ${seatIndex} has no tile to discard`);
  }
  return world.roundsLogic.discard({
    gameId: world.gameId,
    userId: userAt(world, seatIndex),
    tileId: tile.id,
    now: playNow,
  });
}

export async function passOthers(
  world: PlayWorld,
  discarderSeatIndex: number,
): Promise<PlayOutcome> {
  let last: PlayOutcome | undefined;
  for (let offset = 1; offset < 4; offset += 1) {
    last = await world.roundsLogic.passClaim({
      gameId: world.gameId,
      userId: userAt(world, (discarderSeatIndex + offset) % 4),
      now: playNow,
    });
  }
  if (last == null) {
    throw new Error("expected a pass");
  }
  return last;
}

function handTileCountFor(body: JsonValue): number {
  if (typeof body !== "object" || body == null || Array.isArray(body)) {
    return 13;
  }
  const explicit = body.handTileCount;
  if (typeof explicit === "number") {
    return explicit;
  }
  return body.ruleset === "taiwan" ? 16 : 13;
}

function stackWall(all: string[], handTileCount: number, wall: StackedWall): string[] {
  const pool = all.slice();
  function take(code: string): string {
    const index = pool.indexOf(code);
    if (index < 0) {
      throw new Error(`no spare ${code} for the stacked wall`);
    }
    pool.splice(index, 1);
    return code;
  }
  const hands = [0, 1, 2, 3].map((seatIndex) => (wall.hands?.[seatIndex] ?? []).map(take));
  const draws = (wall.draws ?? []).map(take);
  const tail = (wall.tail ?? []).map(take);
  for (const hand of hands) {
    while (hand.length < handTileCount) {
      const filler = pool.find((code) => !isBonusTileCode(code));
      if (filler == null) {
        throw new Error("ran out of filler tiles");
      }
      hand.push(take(filler));
    }
  }
  return [...hands.flat(), ...draws, ...pool, ...tail.slice().reverse()];
}

function overwrite(target: string[], values: string[]): void {
  values.forEach((value, index) => {
    target[index] = value;
  });
}

function isStringList<T>(items: T[]): items is T[] & string[] {
  return items.every((item) => typeof item === "string");
}
