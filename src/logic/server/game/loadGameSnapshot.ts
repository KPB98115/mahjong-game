import { type GameActionErr } from "../../../model/server/actionResult";
import { gameSnapshotSchema, type GameSnapshot } from "../../../model/server/gameSnapshot";
import {
  publicStatePayloadSchema,
  type PublicStatePayload,
} from "../../../model/server/playResult";
import { ApiError } from "../../../types/server/api";
import { RoundStatus } from "../../../types/server/roundStatus";
import { UserAttributeName } from "../../../types/server/profile";
import { apiFailure } from "../http/apiFailure";
import { type UserRepo } from "../user/userRepo";
import { type DiscardTilesRepo } from "./discardTilesRepo";
import { type FlowerTilesRepo } from "./flowerTilesRepo";
import { type GameRow, type GamesRepo } from "./gamesRepo";
import { type HandsRepo } from "./handsRepo";
import { type HandTilesRepo } from "./handTilesRepo";
import { type MeldTilesRepo } from "./meldTilesRepo";
import { type MeldsRepo } from "./meldsRepo";
import { type RoundScoresRepo } from "./roundScoresRepo";
import { type RoundRow, type RoundsRepo } from "./roundsRepo";
import { type ScorePaymentsRepo } from "./scorePaymentsRepo";
import { type SeatRow, type SeatsRepo } from "./seatsRepo";
import { type WallTilesRepo } from "./wallTilesRepo";

export type SnapshotRepos = {
  gamesRepo: GamesRepo;
  seatsRepo: SeatsRepo;
  roundsRepo: RoundsRepo;
  handsRepo: HandsRepo;
  handTilesRepo: HandTilesRepo;
  wallTilesRepo: WallTilesRepo;
  discardTilesRepo: DiscardTilesRepo;
  flowerTilesRepo: FlowerTilesRepo;
  meldsRepo: MeldsRepo;
  meldTilesRepo: MeldTilesRepo;
  roundScoresRepo: RoundScoresRepo;
  scorePaymentsRepo: ScorePaymentsRepo;
  userRepo: UserRepo;
};

export type SnapshotResult = { snapshot: GameSnapshot } | GameActionErr;

export async function loadGameSnapshot(
  repos: SnapshotRepos,
  gameId: string,
  userId: string,
): Promise<SnapshotResult> {
  const game = await repos.gamesRepo.findById(gameId);
  if (game == null) {
    return apiFailure(ApiError.GameNotFound);
  }
  const seats = await repos.seatsRepo.findByGameId(gameId);
  const selfSeat = seats.find((seat) => seat.userId === userId);
  if (selfSeat == null) {
    return apiFailure(ApiError.NotSeated);
  }
  const round = await latestRound(repos, gameId);
  const publicState = await buildPublicState(repos, game, seats, round);
  const hand =
    round == null
      ? undefined
      : await repos.handsRepo.findByRoundIdAndSeatIndex(round.id, selfSeat.seatIndex);
  const handTiles = hand == null ? [] : await repos.handTilesRepo.findByHandId(hand.id);
  return {
    snapshot: gameSnapshotSchema.parse({
      ...publicState,
      self: {
        seatIndex: selfSeat.seatIndex,
        handTiles: handTiles.map((tile) => ({
          id: tile.id,
          tileCode: tile.tileCode,
          sortIndex: tile.sortIndex,
          isDrawn: tile.isDrawn,
        })),
      },
    }),
  };
}

export async function loadPublicState(
  repos: SnapshotRepos,
  gameId: string,
): Promise<PublicStatePayload | undefined> {
  const game = await repos.gamesRepo.findById(gameId);
  if (game == null) {
    return undefined;
  }
  const seats = await repos.seatsRepo.findByGameId(gameId);
  return buildPublicState(repos, game, seats, await latestRound(repos, gameId));
}

async function latestRound(repos: SnapshotRepos, gameId: string): Promise<RoundRow | undefined> {
  const rounds = await repos.roundsRepo.findByGameId(gameId);
  return rounds.length === 0 ? undefined : rounds[rounds.length - 1];
}

async function buildPublicState(
  repos: SnapshotRepos,
  game: GameRow,
  seats: SeatRow[],
  round: RoundRow | undefined,
): Promise<PublicStatePayload> {
  const snapshotSeats = [];
  for (const seat of seats) {
    snapshotSeats.push({
      seatIndex: seat.seatIndex,
      userId: seat.userId,
      displayName: await displayName(repos.userRepo, seat.userId),
      runningScore: asNumber(seat.runningScore),
      nextWindAgreed: seat.nextWindAgreed,
    });
  }
  if (round == null) {
    return publicStatePayloadSchema.parse({
      game: gameJson(game, null),
      seats: snapshotSeats,
      round: null,
      publicTiles: { discards: [], melds: [], flowerTiles: [] },
      scores: { roundScores: [], scorePayments: [] },
    });
  }
  const wall = await repos.wallTilesRepo.findByRoundId(round.id);
  const discards = await repos.discardTilesRepo.findByRoundId(round.id);
  const flowers = await repos.flowerTilesRepo.findByRoundId(round.id);
  const melds = await repos.meldsRepo.findByRoundId(round.id);
  const meldJson = [];
  for (const meld of melds) {
    const tiles = await repos.meldTilesRepo.findByMeldId(meld.id);
    meldJson.push({
      seatIndex: meld.seatIndex,
      meldType: meld.meldType,
      isConcealed: meld.isConcealed,
      fromSeatIndex: meld.fromSeatIndex,
      sortIndex: meld.sortIndex,
      tiles: tiles.map((tile) => ({
        tileCode: tile.tileCode,
        sortIndex: tile.sortIndex,
        isClaimed: tile.isClaimed,
      })),
    });
  }
  const finished = round.status === RoundStatus.Completed;
  const roundScores = finished ? await repos.roundScoresRepo.findByRoundId(round.id) : [];
  const scorePayments = finished ? await repos.scorePaymentsRepo.findByRoundId(round.id) : [];
  return publicStatePayloadSchema.parse({
    game: gameJson(game, round.dealerSeatIndex),
    seats: snapshotSeats,
    round: {
      phase: round.phase,
      currentSeatIndex: round.currentSeatIndex,
      resultType: round.resultType,
      winKind: round.winKind,
      wallRemainingCount: wall.length,
    },
    publicTiles: {
      discards: discards.map((tile) => ({
        seatIndex: tile.seatIndex,
        tileCode: tile.tileCode,
        sortIndex: tile.sortIndex,
      })),
      melds: meldJson,
      flowerTiles: flowers.map((tile) => ({
        seatIndex: tile.seatIndex,
        tileCode: tile.tileCode,
        sortIndex: tile.sortIndex,
      })),
    },
    scores: {
      roundScores: roundScores.map((score) => ({
        seatIndex: score.seatIndex,
        userId: score.userId,
        scoreDelta: asNumber(score.scoreDelta),
        scoreAfter: asNumber(score.scoreAfter),
        scoreUnits: score.scoreUnits == null ? null : asNumber(score.scoreUnits),
        isWinner: score.isWinner,
      })),
      scorePayments: scorePayments.map((payment) => ({
        fromSeatIndex: payment.fromSeatIndex,
        toSeatIndex: payment.toSeatIndex,
        amount: asNumber(payment.amount),
      })),
    },
  });
}

function gameJson(game: GameRow, dealerSeatIndex: number | null): GameSnapshot["game"] {
  return {
    id: game.id,
    referenceCode: game.referenceCode,
    status: game.status,
    prevailingWind: game.prevailingWind,
    ruleset: game.ruleset,
    startingScore: asNumber(game.startingScore),
    handTileCount: game.handTileCount,
    winMeldCount: game.winMeldCount,
    scoreUnit: game.scoreUnit,
    bonusTilesEnabled: game.bonusTilesEnabled,
    chowOnlyFromPrevious: game.chowOnlyFromPrevious,
    minScoreUnits: asNumber(game.minScoreUnits),
    discardWinPayer: game.discardWinPayer,
    autoDraw: game.autoDraw,
    claimWindowMs: game.claimWindowMs,
    scoringVersion: game.scoringVersion,
    completedAt: game.completedAt == null ? null : game.completedAt.toISOString(),
    dealerSeatIndex,
  };
}

async function displayName(userRepo: UserRepo, userId: string): Promise<string | null> {
  const attributes = await userRepo.listAttributes(userId);
  const display = attributes.find((row) => row.name === UserAttributeName.DisplayName);
  return display == null ? null : display.value;
}

function asNumber(value: string): number {
  const numeric = Number(value);
  if (Number.isNaN(numeric)) {
    throw new Error(`invalid numeric value ${value}`);
  }
  return numeric;
}
