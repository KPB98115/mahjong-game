import {
  abortGameResponseSchema,
  type AbortGameResponse,
  type GameActionErr,
} from "../../../model/server/actionResult";
import { parseCreateGameBody, type CreateGameBody } from "../../../model/server/createGameBody";
import { ApiError } from "../../../types/server/api";
import { type JsonValue } from "../../../types/server/jsonValue";
import { ClaimWindowMs } from "../../../types/server/claimWindowMs";
import { DiscardWinPayer } from "../../../types/server/discardWinPayer";
import { GameStatus } from "../../../types/server/gameStatus";
import { PrevailingWind } from "../../../types/server/prevailingWind";
import { Ruleset } from "../../../types/server/ruleset";
import { ScoreUnit } from "../../../types/server/scoreUnit";
import { type DbExecutor } from "../db/executor";
import { uniqueConstraintName } from "../db/uniqueViolation";
import { apiFailure } from "../http/apiFailure";
import { type GameRandom } from "./gameRandom";
import { GameRuleFailure, readGameRuleFailure } from "./gameRuleFailure";
import { type GameRow } from "./gamesRepo";
import { loadGameSnapshot, type SnapshotRepos, type SnapshotResult } from "./loadGameSnapshot";
import { type RoundsLogic } from "./roundsLogic";
import { scoringCatalogVersion } from "./scoringVersion";
import { type SeatRow } from "./seatsRepo";
import { type GameTransaction, type SeatsLogic } from "./seatsLogic";

export type GameRedis = {
  publishAborted(gameId: string): Promise<void>;
  deleteCache(gameId: string): Promise<void>;
};

export type GameRules = {
  ruleset: Ruleset;
  handTileCount: number;
  winMeldCount: number;
  scoreUnit: ScoreUnit;
  bonusTilesEnabled: boolean;
  chowOnlyFromPrevious: boolean;
  minScoreUnits: number;
  discardWinPayer: DiscardWinPayer;
  autoDraw: boolean;
  claimWindowMs: ClaimWindowMs | null;
};

type Preset = Omit<GameRules, "ruleset">;

const wallSize = 144;
const referenceAttempts = 8;

const presets: Record<Ruleset, Preset> = {
  [Ruleset.HongKong]: {
    handTileCount: 13,
    winMeldCount: 4,
    scoreUnit: ScoreUnit.Fan,
    bonusTilesEnabled: true,
    chowOnlyFromPrevious: true,
    minScoreUnits: 0,
    discardWinPayer: DiscardWinPayer.Discarder,
    autoDraw: true,
    claimWindowMs: ClaimWindowMs.FiveSeconds,
  },
  [Ruleset.Taiwan]: {
    handTileCount: 16,
    winMeldCount: 5,
    scoreUnit: ScoreUnit.Tai,
    bonusTilesEnabled: true,
    chowOnlyFromPrevious: true,
    minScoreUnits: 0,
    discardWinPayer: DiscardWinPayer.Discarder,
    autoDraw: true,
    claimWindowMs: ClaimWindowMs.FiveSeconds,
  },
};

const nextWindByWind: Record<PrevailingWind, PrevailingWind | undefined> = {
  [PrevailingWind.East]: PrevailingWind.South,
  [PrevailingWind.South]: PrevailingWind.West,
  [PrevailingWind.West]: PrevailingWind.North,
  [PrevailingWind.North]: undefined,
};

export class GamesLogic {
  constructor(
    private repos: SnapshotRepos,
    private roundsLogic: RoundsLogic,
    private seatsLogic: SeatsLogic,
    private runTransaction: GameTransaction,
    private random: GameRandom,
    private redis: GameRedis,
  ) {}

  async create(userId: string, body: JsonValue): Promise<SnapshotResult> {
    const parsed = parseCreateGameBody(body);
    if (!parsed.ok) {
      return apiFailure(parsed.error);
    }
    const rules = rulesFromBody(parsed.body);
    if (rules == null) {
      return apiFailure(ApiError.InvalidBody);
    }
    for (let attempt = 0; attempt < referenceAttempts; attempt += 1) {
      const referenceCode = this.random.referenceCode();
      try {
        const gameId = await this.runTransaction(async (tx) => {
          const owned = await this.repos.seatsRepo.findByUserId(userId, tx);
          if (owned.length > 0) {
            throw new GameRuleFailure(apiFailure(ApiError.AlreadySeated));
          }
          const game = await this.repos.gamesRepo.insert(
            {
              referenceCode,
              status: GameStatus.Waiting,
              prevailingWind: PrevailingWind.East,
              ruleset: rules.ruleset,
              startingScore: "0",
              handTileCount: rules.handTileCount,
              winMeldCount: rules.winMeldCount,
              scoreUnit: rules.scoreUnit,
              bonusTilesEnabled: rules.bonusTilesEnabled,
              chowOnlyFromPrevious: rules.chowOnlyFromPrevious,
              minScoreUnits: String(rules.minScoreUnits),
              discardWinPayer: rules.discardWinPayer,
              autoDraw: rules.autoDraw,
              claimWindowMs: rules.claimWindowMs,
              scoringVersion: scoringCatalogVersion,
            },
            tx,
          );
          await this.repos.seatsRepo.insert(
            {
              gameId: game.id,
              seatIndex: 0,
              userId,
              runningScore: "0",
              nextWindAgreed: false,
            },
            tx,
          );
          return game.id;
        });
        return loadGameSnapshot(this.repos, gameId, userId);
      } catch (error) {
        if (typeof error !== "object" || error == null) {
          throw error;
        }
        const failure = readGameRuleFailure(error);
        if (failure != null) {
          return failure;
        }
        const constraint = uniqueConstraintName(error);
        if (constraint != null && constraint.includes("reference_code")) {
          continue;
        }
        if (constraint != null && constraint.includes("user_id")) {
          return apiFailure(ApiError.AlreadySeated);
        }
        throw error;
      }
    }
    throw new Error("reference code exhausted");
  }

  async snapshot(gameId: string, userId: string): Promise<SnapshotResult> {
    return loadGameSnapshot(this.repos, gameId, userId);
  }

  async abort(
    gameId: string,
    userId: string,
    now: Date,
  ): Promise<AbortGameResponse | GameActionErr> {
    let deletedId: string | undefined;
    try {
      deletedId = await this.runTransaction(async (tx) => {
        const game = await this.repos.gamesRepo.findById(gameId, tx);
        if (game == null) {
          throw new GameRuleFailure(apiFailure(ApiError.GameNotAbortable));
        }
        await this.seatsLogic.requireSeat(gameId, userId, tx);
        if (game.status !== GameStatus.Waiting && game.status !== GameStatus.InProgress) {
          throw new GameRuleFailure(apiFailure(ApiError.GameNotAbortable));
        }
        if (game.status === GameStatus.InProgress) {
          await this.roundsLogic.markAborted(gameId, now, tx);
        }
        await this.repos.gamesRepo.update(
          gameId,
          { status: GameStatus.Aborted, updatedAt: now },
          tx,
        );
        await this.repos.gamesRepo.delete(gameId, tx);
        return gameId;
      });
    } catch (error) {
      if (typeof error !== "object" || error == null) {
        throw error;
      }
      const failure = readGameRuleFailure(error);
      if (failure != null) {
        return failure;
      }
      throw error;
    }
    await this.publishAbort(deletedId);
    await this.dropCache(deletedId);
    return abortGameResponseSchema.parse({ aborted: true });
  }

  async agreeNextWind(gameId: string, userId: string, now: Date): Promise<SnapshotResult> {
    const current = await this.repos.gamesRepo.findById(gameId);
    if (current == null) {
      return apiFailure(ApiError.GameNotFound);
    }
    const referenceCode = current.referenceCode;
    try {
      const outcome = await this.runTransaction(async (tx) => {
        const game = await this.repos.gamesRepo.findById(gameId, tx);
        if (game == null) {
          throw new GameRuleFailure(apiFailure(ApiError.GameNotFound));
        }
        const seat = await this.seatsLogic.requireSeat(gameId, userId, tx);
        if (game.status !== GameStatus.Completed) {
          throw new GameRuleFailure(apiFailure(ApiError.GameNotCompleted));
        }
        if (game.prevailingWind === PrevailingWind.North) {
          throw new GameRuleFailure(apiFailure(ApiError.NorthComplete));
        }
        await this.repos.seatsRepo.update(seat.id, { nextWindAgreed: true }, tx);
        const seats = await this.repos.seatsRepo.findByGameId(gameId, tx);
        const allAgreed = seats.length === 4 && seats.every((item) => item.nextWindAgreed);
        if (!allAgreed) {
          return { gameId, droppedId: undefined };
        }
        const created = await this.advance(game, seats, now, tx);
        return { gameId: created.id, droppedId: game.id };
      });
      if (outcome.droppedId != null) {
        await this.dropCache(outcome.droppedId);
      }
      return loadGameSnapshot(this.repos, outcome.gameId, userId);
    } catch (error) {
      if (typeof error !== "object" || error == null) {
        throw error;
      }
      const failure = readGameRuleFailure(error);
      if (failure != null) {
        return failure;
      }
      const constraint = uniqueConstraintName(error);
      if (constraint != null && constraint.includes("reference_code")) {
        const created = await this.repos.gamesRepo.findByReferenceCode(referenceCode);
        if (created != null) {
          return loadGameSnapshot(this.repos, created.id, userId);
        }
      }
      throw error;
    }
  }

  private async advance(
    game: GameRow,
    seats: SeatRow[],
    now: Date,
    tx: DbExecutor,
  ): Promise<GameRow> {
    const rounds = await this.repos.roundsRepo.findByGameId(game.id, tx);
    const latest = rounds.length === 0 ? undefined : rounds[rounds.length - 1];
    const previousDealer = latest == null ? 0 : latest.dealerSeatIndex;
    const nextWind = nextWindByWind[game.prevailingWind];
    if (nextWind == null) {
      throw new GameRuleFailure(apiFailure(ApiError.NorthComplete));
    }
    await this.repos.gamesRepo.delete(game.id, tx);
    const created = await this.repos.gamesRepo.insert(
      {
        referenceCode: game.referenceCode,
        status: GameStatus.Waiting,
        prevailingWind: nextWind,
        ruleset: game.ruleset,
        startingScore: game.startingScore,
        handTileCount: game.handTileCount,
        winMeldCount: game.winMeldCount,
        scoreUnit: game.scoreUnit,
        bonusTilesEnabled: game.bonusTilesEnabled,
        chowOnlyFromPrevious: game.chowOnlyFromPrevious,
        minScoreUnits: game.minScoreUnits,
        discardWinPayer: game.discardWinPayer,
        autoDraw: game.autoDraw,
        claimWindowMs: game.claimWindowMs,
        scoringVersion: game.scoringVersion,
      },
      tx,
    );
    for (const seat of seats) {
      await this.repos.seatsRepo.insert(
        {
          gameId: created.id,
          seatIndex: seat.seatIndex,
          userId: seat.userId,
          runningScore: seat.runningScore,
          nextWindAgreed: false,
        },
        tx,
      );
    }
    await this.roundsLogic.start({
      game: created,
      dealerSeatIndex: (previousDealer + 1) % 4,
      now,
      tx,
    });
    return created;
  }

  private async publishAbort(gameId: string): Promise<void> {
    try {
      await this.redis.publishAborted(gameId);
    } catch {
      // The table is already gone. Clients reconcile from the profile.
    }
  }

  private async dropCache(gameId: string): Promise<void> {
    try {
      await this.redis.deleteCache(gameId);
    } catch {
      // Postgres is the source of truth.
    }
  }
}

function rulesFromBody(body: CreateGameBody): GameRules | undefined {
  const preset = presets[body.ruleset];
  const handTileCount = body.handTileCount ?? preset.handTileCount;
  const winMeldCount = body.winMeldCount ?? preset.winMeldCount;
  const minScoreUnits = body.minScoreUnits ?? preset.minScoreUnits;
  if (!Number.isInteger(handTileCount) || handTileCount < 1 || handTileCount * 4 + 1 > wallSize) {
    return undefined;
  }
  if (!Number.isInteger(winMeldCount) || winMeldCount < 1) {
    return undefined;
  }
  if (!Number.isFinite(minScoreUnits) || minScoreUnits < 0) {
    return undefined;
  }
  return {
    ruleset: body.ruleset,
    handTileCount,
    winMeldCount,
    scoreUnit: body.scoreUnit ?? preset.scoreUnit,
    bonusTilesEnabled: body.bonusTilesEnabled ?? preset.bonusTilesEnabled,
    chowOnlyFromPrevious: body.chowOnlyFromPrevious ?? preset.chowOnlyFromPrevious,
    minScoreUnits,
    discardWinPayer: body.discardWinPayer ?? preset.discardWinPayer,
    autoDraw: body.autoDraw ?? preset.autoDraw,
    claimWindowMs: body.claimWindowMs === undefined ? preset.claimWindowMs : body.claimWindowMs,
  };
}
