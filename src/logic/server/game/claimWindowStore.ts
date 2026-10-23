import { claimWindowStateSchema, type ClaimWindowState } from "../../../model/server/claimWindow";
import { gameClaimWindowKey } from "../redis/keys";
import { type RedisCommands } from "../redis/redisCommands";

export {
  type ClaimAnswer,
  type ClaimWindowState,
  type SeatClaimAnswer,
} from "../../../model/server/claimWindow";

export type ClaimWindowStore = {
  find(gameId: string): Promise<ClaimWindowState | undefined>;
  save(gameId: string, state: ClaimWindowState): Promise<void>;
  clear(gameId: string): Promise<void>;
};

const claimWindowTtlSeconds = 24 * 60 * 60;

export function createMemoryClaimWindowStore(): ClaimWindowStore {
  const windows = new Map<string, ClaimWindowState>();
  return {
    async find(gameId) {
      const state = windows.get(gameId);
      return state == null ? undefined : structuredClone(state);
    },
    async save(gameId, state) {
      windows.set(gameId, structuredClone(state));
    },
    async clear(gameId) {
      windows.delete(gameId);
    },
  };
}

export function createRedisClaimWindowStore(redis: RedisCommands): ClaimWindowStore {
  return {
    async find(gameId) {
      const raw = await redis.get(gameClaimWindowKey(gameId));
      return raw == null ? undefined : parseClaimWindow(raw);
    },
    async save(gameId, state) {
      await redis.setEx(gameClaimWindowKey(gameId), JSON.stringify(state), claimWindowTtlSeconds);
    },
    async clear(gameId) {
      await redis.del(gameClaimWindowKey(gameId));
    },
  };
}

function parseClaimWindow(raw: string): ClaimWindowState | undefined {
  try {
    const parsed = claimWindowStateSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : undefined;
  } catch {
    return undefined;
  }
}
