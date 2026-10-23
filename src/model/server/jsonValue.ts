import { z } from "zod";
import { type JsonValue } from "../../types/server/jsonValue";

export const jsonValueSchema: z.ZodType<JsonValue> = z.lazy(() =>
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.array(jsonValueSchema),
    z.record(z.string(), jsonValueSchema),
  ]),
);

export function parseJsonValue(input: string): JsonValue | undefined {
  try {
    const parsed = jsonValueSchema.safeParse(JSON.parse(input));
    return parsed.success ? parsed.data : undefined;
  } catch {
    return undefined;
  }
}
