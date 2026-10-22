import { type Context } from "hono";
import { type JsonValue } from "../../../types/server/jsonValue";

export type ReadJsonBodyResult = { ok: true; value: JsonValue } | { ok: false };

export async function readJsonBody(c: Context): Promise<ReadJsonBodyResult> {
  try {
    const text = await c.req.text();
    const value: JsonValue = JSON.parse(text);
    return { ok: true, value };
  } catch {
    return { ok: false };
  }
}
