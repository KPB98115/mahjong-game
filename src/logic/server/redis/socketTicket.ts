import { redisSetEx } from "./client";
import { socketTicketKey } from "./keys";

const socketTicketTtlSeconds = 60;

export async function setSocketTicket(ticket: string, userId: string): Promise<boolean> {
  try {
    await redisSetEx(socketTicketKey(ticket), userId, socketTicketTtlSeconds);
    return true;
  } catch {
    return false;
  }
}
