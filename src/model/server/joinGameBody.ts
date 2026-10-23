import { z } from "zod";

export const joinGameBodySchema = z.strictObject({
  referenceCode: z.string(),
});

export type JoinGameBody = z.infer<typeof joinGameBodySchema>;
