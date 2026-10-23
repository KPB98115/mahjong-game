import { type z } from "zod";
import {
  publicStatePayloadSchema,
  selfHandPayloadSchema,
  type PublicStatePayload,
  type SelfHandTile,
} from "../../../model/server/playResult";
import { gameHandCacheKey, gameRoundCacheKey } from "./keys";
import { type RedisCommands } from "./redisCommands";

export type RoundCache = {
  findPublicState(gameId: string): Promise<PublicStatePayload | undefined>;
  savePublicState(gameId: string, state: PublicStatePayload): Promise<void>;
  findHand(gameId: string, seatIndex: number): Promise<SelfHandTile[] | undefined>;
  saveHand(gameId: string, seatIndex: number, tiles: SelfHandTile[]): Promise<void>;
};

const roundCacheTtlSeconds = 24 * 60 * 60;

export function createRedisRoundCache(redis: RedisCommands): RoundCache {
  async function read(key: string): Promise<string | undefined> {
    try {
      return (await redis.get(key)) ?? undefined;
    } catch {
      return undefined;
    }
  }

  async function write(key: string, value: string): Promise<void> {
    try {
      await redis.setEx(key, value, roundCacheTtlSeconds);
    } catch {
      // Postgres is the source of truth; the next read rebuilds the cache.
    }
  }

  return {
    async findPublicState(gameId) {
      const raw = await read(gameRoundCacheKey(gameId));
      return raw == null ? undefined : parseJson(raw, publicStatePayloadSchema);
    },
    async savePublicState(gameId, state) {
      await write(gameRoundCacheKey(gameId), JSON.stringify(state));
    },
    async findHand(gameId, seatIndex) {
      const raw = await read(gameHandCacheKey(gameId, seatIndex));
      return raw == null ? undefined : parseJson(raw, selfHandPayloadSchema)?.tiles;
    },
    async saveHand(gameId, seatIndex, tiles) {
      await write(gameHandCacheKey(gameId, seatIndex), JSON.stringify({ tiles }));
    },
  };
}

function parseJson<Schema extends z.ZodType>(
  raw: string,
  schema: Schema,
): z.infer<Schema> | undefined {
  try {
    const parsed = schema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : undefined;
  } catch {
    return undefined;
  }
}
