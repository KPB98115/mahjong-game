import { messages } from "@schema";
import { z } from "zod";
import { defineHandler, type InferProps } from "void";
import { db, desc } from "void/db";

export type Props = InferProps<typeof loader>;

export const loader = defineHandler(async () => {
  const rows = await db.select().from(messages).orderBy(desc(messages.id));
  return { messages: rows };
});

export const action = defineHandler.withValidator({
  body: z.object({
    text: z.string().trim().min(1).max(1000),
  }),
})(async (_c, { body }) => {
  await db.insert(messages).values(body);
});
