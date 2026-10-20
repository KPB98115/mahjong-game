import { z } from "zod";

export const sessionCacheSchema = z.object({
  userId: z.string(),
  sessionId: z.string(),
});

export type SessionCacheValue = z.infer<typeof sessionCacheSchema>;

export function parseSessionCacheValue(raw: string): SessionCacheValue | undefined {
  try {
    const parsed = sessionCacheSchema.safeParse(JSON.parse(raw));
    if (!parsed.success) {
      return undefined;
    }
    return parsed.data;
  } catch {
    return undefined;
  }
}
