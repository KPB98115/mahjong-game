import { z } from "zod";
import { DiscardWinPayer } from "../../types/server/discardWinPayer";
import { GameStatus } from "../../types/server/gameStatus";
import { MeldType } from "../../types/server/meldType";
import { PrevailingWind } from "../../types/server/prevailingWind";
import { RoundPhase } from "../../types/server/roundPhase";
import { RoundResultType } from "../../types/server/roundResultType";
import { Ruleset } from "../../types/server/ruleset";
import { ScoreUnit } from "../../types/server/scoreUnit";
import { WinKind } from "../../types/server/winKind";

const handTileSchema = z.object({
  id: z.string(),
  tileCode: z.string(),
  sortIndex: z.number(),
  isDrawn: z.boolean(),
});

const seatSchema = z.object({
  seatIndex: z.number(),
  userId: z.string(),
  displayName: z.string().nullable(),
  runningScore: z.number(),
  nextWindAgreed: z.boolean(),
});

const meldTileSchema = z.object({
  tileCode: z.string(),
  sortIndex: z.number(),
  isClaimed: z.boolean(),
});

const meldSchema = z.object({
  seatIndex: z.number(),
  meldType: z.enum(MeldType),
  isConcealed: z.boolean(),
  fromSeatIndex: z.number().nullable(),
  sortIndex: z.number(),
  tiles: z.array(meldTileSchema),
});

const roundSchema = z.object({
  phase: z.enum(RoundPhase),
  currentSeatIndex: z.number(),
  resultType: z.enum(RoundResultType).nullable(),
  winKind: z.enum(WinKind).nullable(),
  wallRemainingCount: z.number(),
});

const roundScoreSchema = z.object({
  seatIndex: z.number(),
  userId: z.string(),
  scoreDelta: z.number(),
  scoreAfter: z.number(),
  scoreUnits: z.number().nullable(),
  isWinner: z.boolean(),
});

const scorePaymentSchema = z.object({
  fromSeatIndex: z.number(),
  toSeatIndex: z.number(),
  amount: z.number(),
});

export const gameSnapshotSchema = z.object({
  game: z.object({
    id: z.string(),
    referenceCode: z.string(),
    status: z.enum(GameStatus),
    prevailingWind: z.enum(PrevailingWind),
    ruleset: z.enum(Ruleset),
    startingScore: z.number(),
    handTileCount: z.number(),
    winMeldCount: z.number(),
    scoreUnit: z.enum(ScoreUnit),
    bonusTilesEnabled: z.boolean(),
    chowOnlyFromPrevious: z.boolean(),
    minScoreUnits: z.number(),
    discardWinPayer: z.enum(DiscardWinPayer),
    autoDraw: z.boolean(),
    claimWindowMs: z.number().nullable(),
    scoringVersion: z.string(),
    completedAt: z.string().nullable(),
    dealerSeatIndex: z.number().nullable(),
  }),
  seats: z.array(seatSchema),
  round: roundSchema.nullable(),
  self: z
    .object({
      seatIndex: z.number(),
      handTiles: z.array(handTileSchema),
    })
    .nullable(),
  publicTiles: z.object({
    discards: z.array(
      z.object({
        seatIndex: z.number(),
        tileCode: z.string(),
        sortIndex: z.number(),
      }),
    ),
    melds: z.array(meldSchema),
    flowerTiles: z.array(
      z.object({
        seatIndex: z.number(),
        tileCode: z.string(),
        sortIndex: z.number(),
      }),
    ),
  }),
  scores: z.object({
    roundScores: z.array(roundScoreSchema),
    scorePayments: z.array(scorePaymentSchema),
  }),
});

export type GameSnapshot = z.infer<typeof gameSnapshotSchema>;
