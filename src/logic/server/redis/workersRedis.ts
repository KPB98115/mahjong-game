import { redisDel, redisGet, redisPublish, redisSetEx } from "./client";
import { type RedisCommands } from "./redisCommands";

export const workersRedis: RedisCommands = {
  get: redisGet,
  setEx: redisSetEx,
  del: redisDel,
  publish: redisPublish,
};
