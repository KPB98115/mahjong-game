import { type JsonRecord } from "@app/types/server/jsonValue";
import { z } from "zod";

const handshakeAuthSchema = z.object({ ticket: z.string().min(1) });
const ticketUserIdSchema = z.string().min(1);

export type TakeTicket = (ticket: string) => Promise<string | undefined>;

export class SocketAuthHandler {
  constructor(private takeTicket: TakeTicket) {}

  async authenticate(auth: JsonRecord): Promise<string | undefined> {
    const parsed = handshakeAuthSchema.safeParse(auth);
    if (!parsed.success) {
      return undefined;
    }
    const userId = await this.takeTicket(parsed.data.ticket);
    return ticketUserIdSchema.safeParse(userId).success ? userId : undefined;
  }
}
