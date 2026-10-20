import { type Context } from "hono";

export type ReadJsonBodyResult = { ok: true; value: unknown } | { ok: false };

export async function readJsonBody(c: Context): Promise<ReadJsonBodyResult> {
  try {
    const value: unknown = await c.req.json();
    return { ok: true, value };
  } catch {
    return { ok: false };
  }
}
