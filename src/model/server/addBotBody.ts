import { z } from "zod";
import { BotDifficulty } from "../../types/server/botDifficulty";

export const addBotBodySchema = z.object({
  difficulty: z.enum(BotDifficulty),
});

export type AddBotBody = z.infer<typeof addBotBodySchema>;
