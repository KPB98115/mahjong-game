import { z } from "zod";
import { GameChannelEvent } from "../../types/server/gameChannelEvent";

export const gameChannelMessageSchema = z.discriminatedUnion("event", [
  z.object({ event: z.literal(GameChannelEvent.GameAborted), gameId: z.uuid() }),
  z.object({ event: z.literal(GameChannelEvent.GameChanged), gameId: z.uuid() }),
  z.object({
    event: z.literal(GameChannelEvent.NextWind),
    gameId: z.uuid(),
    nextGameId: z.uuid(),
  }),
]);

export type GameChannelMessage = z.infer<typeof gameChannelMessageSchema>;

export function parseGameChannelMessage(raw: string): GameChannelMessage | undefined {
  try {
    const parsed = gameChannelMessageSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : undefined;
  } catch {
    return undefined;
  }
}
