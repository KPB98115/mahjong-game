import { z } from "zod";

export const healthResponseSchema = z.object({
  status: z.literal("ok"),
  service: z.literal("mahjong-socket-server"),
});

export type HealthResponse = z.infer<typeof healthResponseSchema>;

export function buildHealthResponse(): HealthResponse {
  return healthResponseSchema.parse({
    status: "ok",
    service: "mahjong-socket-server",
  });
}
