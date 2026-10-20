import { RedisKeyPrefix } from "../../../types/server/redis";

export function sessionCacheKey(tokenHash: string): string {
  return `${RedisKeyPrefix.AuthSession}${tokenHash}`;
}

export function socketTicketKey(ticket: string): string {
  return `${RedisKeyPrefix.AuthSocketTicket}${ticket}`;
}
