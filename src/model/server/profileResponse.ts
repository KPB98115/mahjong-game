import { z } from "zod";
import { GameStatus } from "../../types/server/gameStatus";
import { PrevailingWind } from "../../types/server/prevailingWind";
import { Ruleset } from "../../types/server/ruleset";

export const currentGameSchema = z.object({
  gameId: z.string(),
  referenceCode: z.string(),
  status: z.enum(GameStatus),
  prevailingWind: z.enum(PrevailingWind),
  ruleset: z.enum(Ruleset),
  seatIndex: z.number(),
});

const profileFiguresSchema = z.object({
  gamesPlayed: z.number().optional(),
  wins: z.number().optional(),
  runningScore: z.number().optional(),
});

export const profileResponseSchema = z.object({
  userId: z.string(),
  attributes: z.record(z.string(), z.string()),
  figures: profileFiguresSchema,
  currentGame: currentGameSchema.nullable(),
});

export type CurrentGame = z.infer<typeof currentGameSchema>;
export type ProfileResponse = z.infer<typeof profileResponseSchema>;
