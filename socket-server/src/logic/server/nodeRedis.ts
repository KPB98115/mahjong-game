import { type RedisCommands } from "@app/logic/server/redis/redisCommands";
import { socketTicketKey } from "@app/logic/server/redis/keys";
import { type createClient } from "redis";
import { type TakeTicket } from "./handler/socketAuthHandler.js";

export type NodeRedisClient = ReturnType<typeof createClient>;

export function nodeRedisCommands(client: NodeRedisClient): RedisCommands {
  return {
    async get(key) {
      return client.get(key);
    },
    async setEx(key, value, ttlSeconds) {
      await client.setEx(key, ttlSeconds, value);
    },
    async del(...keys) {
      if (keys.length > 0) {
        await client.del(keys);
      }
    },
    async publish(channel, message) {
      await client.publish(channel, message);
    },
  };
}

export function nodeTicketTaker(client: NodeRedisClient): TakeTicket {
  return async function takeTicket(ticket) {
    return (await client.getDel(socketTicketKey(ticket))) ?? undefined;
  };
}
