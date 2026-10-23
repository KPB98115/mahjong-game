import { type RedisCommands } from "../logic/server/redis/redisCommands";

export type PublishedMessage = {
  channel: string;
  message: string;
};

export type MemoryRedisCommands = RedisCommands & {
  values: Map<string, string>;
  ttls: Map<string, number>;
  published: PublishedMessage[];
  failing: boolean;
};

export function createMemoryRedisCommands(): MemoryRedisCommands {
  const redis: MemoryRedisCommands = {
    values: new Map(),
    ttls: new Map(),
    published: [],
    failing: false,
    async get(key) {
      failIfDown(redis);
      return redis.values.get(key) ?? null;
    },
    async setEx(key, value, ttlSeconds) {
      failIfDown(redis);
      redis.values.set(key, value);
      redis.ttls.set(key, ttlSeconds);
    },
    async del(...keys) {
      failIfDown(redis);
      for (const key of keys) {
        redis.values.delete(key);
        redis.ttls.delete(key);
      }
    },
    async publish(channel, message) {
      failIfDown(redis);
      redis.published.push({ channel, message });
    },
  };
  return redis;
}

function failIfDown(redis: MemoryRedisCommands): void {
  if (redis.failing) {
    throw new Error("redis is down");
  }
}
