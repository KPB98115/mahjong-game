import { type GameSnapshot } from "../../model/server/gameSnapshot";
import { DiscardWinPayer } from "../../types/server/discardWinPayer";
import { GameStatus } from "../../types/server/gameStatus";
import { PrevailingWind } from "../../types/server/prevailingWind";
import { Ruleset } from "../../types/server/ruleset";
import { ScoreUnit } from "../../types/server/scoreUnit";

export function waitingSnapshot(
  overrides: {
    gameId?: string;
    userId?: string;
    displayName?: string;
    status?: GameStatus;
  } = {},
): GameSnapshot {
  const gameId = overrides.gameId ?? "11111111-1111-4111-8111-111111111111";
  const userId = overrides.userId ?? "user-1";
  return {
    game: {
      id: gameId,
      referenceCode: "04217",
      status: overrides.status ?? GameStatus.Waiting,
      prevailingWind: PrevailingWind.East,
      ruleset: Ruleset.HongKong,
      startingScore: 0,
      handTileCount: 13,
      winMeldCount: 4,
      scoreUnit: ScoreUnit.Fan,
      bonusTilesEnabled: true,
      chowOnlyFromPrevious: true,
      minScoreUnits: 0,
      discardWinPayer: DiscardWinPayer.Discarder,
      autoDraw: true,
      claimWindowMs: 5000,
      scoringVersion: "1",
      completedAt: null,
      dealerSeatIndex: null,
    },
    seats: [
      {
        seatIndex: 0,
        userId,
        displayName: overrides.displayName ?? "Host",
        runningScore: 0,
        nextWindAgreed: false,
        botDifficulty: null,
      },
    ],
    round: null,
    self: { seatIndex: 0, handTiles: [] },
    publicTiles: { discards: [], melds: [], flowerTiles: [] },
    scores: { roundScores: [], scorePayments: [] },
  };
}
