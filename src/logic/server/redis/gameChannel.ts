import { type GameChannelMessage } from "../../../model/server/gameChannelMessage";
import { GameChannelEvent } from "../../../types/server/gameChannelEvent";
import { type GameRedis } from "../game/gamesLogic";
import { gameCacheKeys, gameChannel } from "./keys";
import { type RedisCommands } from "./redisCommands";

export function createGameRedis(redis: RedisCommands): GameRedis {
  async function publish(message: GameChannelMessage): Promise<void> {
    await redis.publish(gameChannel(message.gameId), JSON.stringify(message));
  }

  async function deleteCache(gameId: string): Promise<void> {
    await redis.del(...gameCacheKeys(gameId));
  }

  return {
    async publishAborted(gameId) {
      await publish({ event: GameChannelEvent.GameAborted, gameId });
    },
    async publishChanged(gameId) {
      await deleteCache(gameId);
      await publish({ event: GameChannelEvent.GameChanged, gameId });
    },
    async publishNextWind(gameId, nextGameId) {
      await publish({ event: GameChannelEvent.NextWind, gameId, nextGameId });
    },
    deleteCache,
  };
}
