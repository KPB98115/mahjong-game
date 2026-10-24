import { z } from "zod";
import { ApiStatus, type ApiError } from "../../types/server/api";
import { type JsonValue } from "../../types/server/jsonValue";
import { apiFailureSchema } from "./actionResult";
import { jsonValueSchema } from "./jsonValue";

const apiSuccessEnvelopeSchema = z.object({
  status: z.literal(ApiStatus.Success),
  data: jsonValueSchema,
});

const apiEnvelopeSchema = z.discriminatedUnion("status", [
  apiSuccessEnvelopeSchema,
  apiFailureSchema,
]);

export type ParsedApiEnvelope = { ok: true; data: JsonValue } | { ok: false; error: ApiError };

export function parseApiEnvelope(input: JsonValue): ParsedApiEnvelope | undefined {
  const parsed = apiEnvelopeSchema.safeParse(input);
  if (!parsed.success) {
    return undefined;
  }
  if (parsed.data.status === ApiStatus.Failed) {
    return { ok: false, error: parsed.data.error };
  }
  return { ok: true, data: parsed.data.data };
}
