import { z } from "zod";
import { ClaimAnswerKind } from "../../types/server/claimAnswerKind";
import { MeldType } from "../../types/server/meldType";

export const claimAnswerSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal(ClaimAnswerKind.Pass) }),
  z.object({ kind: z.literal(ClaimAnswerKind.Win) }),
  z.object({
    kind: z.literal(ClaimAnswerKind.Meld),
    meldType: z.enum(MeldType),
    tileIds: z.array(z.uuid()),
  }),
]);

export const claimWindowStateSchema = z.object({
  roundId: z.uuid(),
  discardTileId: z.uuid(),
  answers: z.array(
    z.object({
      seatIndex: z.number().int(),
      answer: claimAnswerSchema,
    }),
  ),
});

export type ClaimAnswer = z.infer<typeof claimAnswerSchema>;
export type ClaimWindowState = z.infer<typeof claimWindowStateSchema>;
export type SeatClaimAnswer = ClaimWindowState["answers"][number];
