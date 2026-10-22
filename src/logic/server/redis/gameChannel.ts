import { redisDel, redisPublish } from "./client";
import { gameChannel, gameHandCacheKey, gameRoundCacheKey } from "./keys";

export async function publishGameAborted(gameId: string): Promise<void> {
  await redisPublish(gameChannel(gameId), JSON.stringify({ event: "gameAborted", gameId }));
}

export async function deleteGameCache(gameId: string): Promise<void> {
  const keys = [gameRoundCacheKey(gameId)];
  for (let seatIndex = 0; seatIndex < 4; seatIndex += 1) {
    keys.push(gameHandCacheKey(gameId, seatIndex));
  }
  await redisDel(...keys);
}
