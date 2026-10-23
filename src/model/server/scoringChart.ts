import { z } from "zod";
import { PayoutKind } from "../../types/server/payoutKind";
import { ScoreUnit } from "../../types/server/scoreUnit";
import { ScoringPattern } from "../../types/server/scoringPattern";

const payoutSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal(PayoutKind.Doubling),
    basePoints: z.number(),
    capUnits: z.number(),
  }),
  z.object({
    kind: z.literal(PayoutKind.BasePlusUnit),
    base: z.number(),
    perUnit: z.number(),
  }),
]);

export const scoringChartSchema = z.object({
  version: z.string(),
  scoreUnit: z.enum(ScoreUnit),
  limitUnits: z.number().nullable(),
  payout: payoutSchema,
  patterns: z.partialRecord(z.enum(ScoringPattern), z.number()),
});

export type ScoringChart = z.infer<typeof scoringChartSchema>;
export type ScoringPayout = z.infer<typeof payoutSchema>;
