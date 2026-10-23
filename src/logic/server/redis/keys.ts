import { RedisKeyPrefix } from "../../../types/server/redis";

export function sessionCacheKey(tokenHash: string): string {
  return `${RedisKeyPrefix.AuthSession}${tokenHash}`;
}

export function socketTicketKey(ticket: string): string {
  return `${RedisKeyPrefix.AuthSocketTicket}${ticket}`;
}

export function gameChannel(gameId: string): string {
  return `${RedisKeyPrefix.Game}${gameId}`;
}

export function gameRoundCacheKey(gameId: string): string {
  return `${RedisKeyPrefix.Game}${gameId}:round`;
}

export function gameHandCacheKey(gameId: string, seatIndex: number): string {
  return `${RedisKeyPrefix.Game}${gameId}:hand:${seatIndex}`;
}

export function gameClaimWindowKey(gameId: string): string {
  return `${RedisKeyPrefix.Game}${gameId}:claimWindow`;
}

export function gameCacheKeys(gameId: string): string[] {
  const keys = [gameRoundCacheKey(gameId), gameClaimWindowKey(gameId)];
  for (let seatIndex = 0; seatIndex < 4; seatIndex += 1) {
    keys.push(gameHandCacheKey(gameId, seatIndex));
  }
  return keys;
}
