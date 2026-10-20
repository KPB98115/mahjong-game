import { z } from "zod";

export type PlayerAttributeRow = {
  name: string;
  value: string;
};

export type PlayerFigureRow = {
  name: string;
  value: string;
};

export type PlayerProfile = {
  userId: string;
  createdAt: Date;
  attributes: PlayerAttributeRow[];
  figures: PlayerFigureRow[];
};

export const patchMeBodySchema = z.object({
  attributes: z.record(z.string(), z.string()),
});

export type PatchMeBody = z.infer<typeof patchMeBodySchema>;
