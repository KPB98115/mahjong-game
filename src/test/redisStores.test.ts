import { describe, expect, it } from "vitest";
import { createRedisClaimWindowStore } from "../logic/server/game/claimWindowStore";
import { loadPublicState } from "../logic/server/game/loadGameSnapshot";
import { createGameRedis } from "../logic/server/redis/gameChannel";
import { createRedisRoundCache } from "../logic/server/redis/roundCache";
import { type ClaimWindowState } from "../model/server/claimWindow";
import { type PublicStatePayload } from "../model/server/playResult";
import { ClaimAnswerKind } from "../types/server/claimAnswerKind";
import { GameChannelEvent } from "../types/server/gameChannelEvent";
import { MeldType } from "../types/server/meldType";
import { createMemoryRedisCommands } from "./memoryRedisCommands";
import { createPlayWorld } from "./playWorld";

const gameId = "6f0c1a52-8f5e-4a52-9d0e-0d2f8f6b7a11";
const otherGameId = "0b1f7c2e-3c4d-4e5f-8a9b-1c2d3e4f5a6b";

async function publicStateOf(): Promise<PublicStatePayload> {
  const world = await createPlayWorld();
  const state = await loadPublicState(world.repos, world.gameId);
  if (state == null) {
    throw new Error("expected a public state after the deal");
  }
  return state;
}

describe("redis claim window store", () => {
  it("round-trips the window per game under game:{gameId}:claimWindow", async () => {
    const redis = createMemoryRedisCommands();
    const store = createRedisClaimWindowStore(redis);
    const state: ClaimWindowState = {
      roundId: "a3c5e7f9-1b2d-4f6a-8c0e-2a4c6e8f0b1d",
      discardTileId: "b4d6f8a0-2c3e-4a7b-9d1f-3b5d7f9a1c2e",
      answers: [
        { seatIndex: 1, answer: { kind: ClaimAnswerKind.Pass } },
        {
          seatIndex: 2,
          answer: {
            kind: ClaimAnswerKind.Meld,
            meldType: MeldType.Pong,
            tileIds: ["c5e7a9b1-3d4f-4b8c-ae2a-4c6e8a0b2d3f"],
          },
        },
      ],
    };

    await store.save(gameId, state);

    expect(redis.values.has(`game:${gameId}:claimWindow`)).toBe(true);
    expect(redis.ttls.get(`game:${gameId}:claimWindow`)).toBeGreaterThan(0);
    expect(await store.find(gameId)).toEqual(state);
    expect(await store.find(otherGameId)).toBeUndefined();
    await store.clear(gameId);
    expect(await store.find(gameId)).toBeUndefined();
  });

  it("treats a corrupt value as no window", async () => {
    const redis = createMemoryRedisCommands();
    redis.values.set(`game:${gameId}:claimWindow`, '{"roundId":1}');
    expect(await createRedisClaimWindowStore(redis).find(gameId)).toBeUndefined();
  });

  it("fails the action when redis is down, because answers live only there", async () => {
    const redis = createMemoryRedisCommands();
    redis.failing = true;
    await expect(createRedisClaimWindowStore(redis).find(gameId)).rejects.toThrow();
  });
});

describe("redis round cache", () => {
  it("round-trips public state and hands under the documented keys", async () => {
    const state = await publicStateOf();
    const redis = createMemoryRedisCommands();
    const cache = createRedisRoundCache(redis);
    const tiles = [
      {
        tileId: "d6f8b0c2-4e5a-4c9d-bf3b-5d7f9b1c3e4a",
        tileCode: "man_1",
        sortIndex: 0,
        isDrawn: false,
      },
    ];

    await cache.savePublicState(gameId, state);
    await cache.saveHand(gameId, 2, tiles);

    expect(redis.values.has(`game:${gameId}:round`)).toBe(true);
    expect(redis.values.has(`game:${gameId}:hand:2`)).toBe(true);
    expect(await cache.findPublicState(gameId)).toEqual(state);
    expect(await cache.findHand(gameId, 2)).toEqual(tiles);
    expect(await cache.findHand(gameId, 1)).toBeUndefined();
  });

  it("never fails because of redis and ignores corrupt values", async () => {
    const redis = createMemoryRedisCommands();
    const cache = createRedisRoundCache(redis);
    redis.values.set(`game:${gameId}:round`, "not json");
    expect(await cache.findPublicState(gameId)).toBeUndefined();
    redis.failing = true;
    await expect(cache.saveHand(gameId, 0, [])).resolves.toBeUndefined();
    expect(await cache.findHand(gameId, 0)).toBeUndefined();
  });
});

describe("game channel over redis", () => {
  it("publishes abort, change, and next wind messages and drops every cache key", async () => {
    const redis = createMemoryRedisCommands();
    const gameRedis = createGameRedis(redis);
    for (const key of [
      `game:${gameId}:round`,
      `game:${gameId}:hand:0`,
      `game:${gameId}:hand:3`,
      `game:${gameId}:claimWindow`,
    ]) {
      redis.values.set(key, "{}");
    }

    await gameRedis.publishChanged(gameId);
    expect([...redis.values.keys()]).toEqual([]);
    await gameRedis.publishAborted(gameId);
    await gameRedis.publishNextWind(gameId, otherGameId);
    await gameRedis.deleteCache(gameId);

    expect(redis.published.map((item) => item.channel)).toEqual([
      `game:${gameId}`,
      `game:${gameId}`,
      `game:${gameId}`,
    ]);
    expect(redis.published.map((item) => JSON.parse(item.message))).toEqual([
      { event: GameChannelEvent.GameChanged, gameId },
      { event: GameChannelEvent.GameAborted, gameId },
      { event: GameChannelEvent.NextWind, gameId, nextGameId: otherGameId },
    ]);
  });
});
