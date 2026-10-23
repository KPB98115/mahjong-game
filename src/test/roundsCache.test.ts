import { describe, expect, it } from "vitest";
import { publicStatePayloadSchema } from "../model/server/playResult";
import { RoundPhase } from "../types/server/roundPhase";
import { SocketEvent } from "../types/server/socketEvent";
import {
  createPlayWorld,
  discardDrawn,
  emitted,
  passOthers,
  playNow,
  userAt,
  type PlayWorld,
} from "./playWorld";

function cachedPublicState(world: PlayWorld) {
  const raw = world.redis.values.get(`game:${world.gameId}:round`);
  return raw == null ? undefined : publicStatePayloadSchema.parse(JSON.parse(raw));
}

describe("round cache write-through", () => {
  it("writes the public state and every seat's hand after a committed action", async () => {
    const world = await createPlayWorld();

    await discardDrawn(world, 0);

    expect(cachedPublicState(world)?.round).toMatchObject({ phase: RoundPhase.Claim });
    for (const seatIndex of [0, 1, 2, 3]) {
      const cachedHand = await world.roundCache.findHand(world.gameId, seatIndex);
      expect(cachedHand).toHaveLength(13);
    }
    expect((await world.roundCache.findHand(world.gameId, 0))?.map((tile) => tile.tileId)).toEqual(
      (await world.hand(0)).map((tile) => tile.id),
    );
  });

  it("serves snapshotForSeat from the cache when it is there", async () => {
    const world = await createPlayWorld();
    await discardDrawn(world, 0);
    const state = cachedPublicState(world);
    if (state?.round == null) {
      throw new Error("expected a cached round");
    }
    await world.roundCache.savePublicState(world.gameId, {
      ...state,
      round: { ...state.round, wallRemainingCount: 7 },
    });

    const snapshot = await world.roundsLogic.snapshotForSeat({
      gameId: world.gameId,
      userId: userAt(world, 2),
    });

    expect(emitted(snapshot, SocketEvent.PublicState).payload.round?.wallRemainingCount).toBe(7);
  });

  it("rebuilds from Postgres on a miss and fills the cache", async () => {
    const world = await createPlayWorld();
    expect(world.redis.values.size).toBe(0);

    const snapshot = await world.roundsLogic.snapshotForSeat({
      gameId: world.gameId,
      userId: userAt(world, 1),
    });

    expect(emitted(snapshot, SocketEvent.SelfHand).payload.tiles).toHaveLength(13);
    expect(cachedPublicState(world)?.round?.wallRemainingCount).toBe(
      emitted(snapshot, SocketEvent.PublicState).payload.round?.wallRemainingCount,
    );
    expect(await world.roundCache.findHand(world.gameId, 1)).toHaveLength(13);
  });

  it("keeps playing when redis is down", async () => {
    const world = await createPlayWorld();
    world.redis.failing = true;

    const discarded = await discardDrawn(world, 0);
    const resolved = await passOthers(world, 0);

    expect(discarded.ok).toBe(true);
    expect(emitted(resolved, SocketEvent.Turn).payload.currentSeatIndex).toBe(1);
  });
});

describe("table changes made over HTTP", () => {
  it("tells the socket room about every seat join, including the one that deals", async () => {
    const world = await createPlayWorld();
    expect(world.tables.changed).toEqual([world.gameId, world.gameId, world.gameId]);
  });

  it("tells the room about a next-wind vote and about the new game once everyone agrees", async () => {
    const world = await createPlayWorld({
      wall: { hands: [["red", "red", "red", "east"]], draws: ["east"] },
      body: { ruleset: "hongKong", handTileCount: 4, winMeldCount: 1 },
    });
    const won = await world.roundsLogic.declareWin({
      gameId: world.gameId,
      userId: userAt(world, 0),
      now: playNow,
    });
    expect(won.ok).toBe(true);
    const before = world.tables.changed.length;

    await world.gamesLogic.agreeNextWind(world.gameId, userAt(world, 0), playNow);
    expect(world.tables.changed.slice(before)).toEqual([world.gameId]);
    for (const seatIndex of [1, 2, 3]) {
      await world.gamesLogic.agreeNextWind(world.gameId, userAt(world, seatIndex), playNow);
    }

    expect(world.tables.nextWinds).toEqual([
      { gameId: world.gameId, nextGameId: expect.any(String) },
    ]);
    expect(world.tables.nextWinds[0]?.nextGameId).not.toBe(world.gameId);
  });
});
