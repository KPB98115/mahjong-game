import { joinGameBodySchema } from "../../../model/server/joinGameBody";
import { currentGameSchema } from "../../../model/server/profileResponse";
import { ApiError } from "../../../types/server/api";
import { type JsonValue } from "../../../types/server/jsonValue";
import { GameStatus } from "../../../types/server/gameStatus";
import { type CurrentGame } from "../../../model/server/profileResponse";
import { type DbExecutor } from "../db/executor";
import { uniqueConstraintName } from "../db/uniqueViolation";
import { apiFailure } from "../http/apiFailure";
import { type CurrentGameSource } from "./currentGameSource";
import { type GameRandom } from "./gameRandom";
import { GameRuleFailure, readGameRuleFailure } from "./gameRuleFailure";
import { type GamesRepo } from "./gamesRepo";
import { loadGameSnapshot, type SnapshotRepos, type SnapshotResult } from "./loadGameSnapshot";
import { isFiveDigitCode } from "./referenceCode";
import { type RoundsLogic } from "./roundsLogic";
import { type SeatRow, type SeatsRepo } from "./seatsRepo";

export type GameTransaction = <T>(callback: (tx: DbExecutor) => Promise<T>) => Promise<T>;

const seatCount = 4;

export class SeatsLogic implements CurrentGameSource {
  constructor(
    private seatsRepo: SeatsRepo,
    private gamesRepo: GamesRepo,
    private roundsLogic: RoundsLogic,
    private repos: SnapshotRepos,
    private runTransaction: GameTransaction,
    private random: GameRandom,
  ) {}

  async currentGameForUser(userId: string): Promise<CurrentGame | null> {
    const seats = await this.seatsRepo.findByUserId(userId);
    const seat = seats[0];
    if (seat == null) {
      return null;
    }
    const game = await this.gamesRepo.findById(seat.gameId);
    if (game == null) {
      return null;
    }
    return currentGameSchema.parse({
      gameId: game.id,
      referenceCode: game.referenceCode,
      status: game.status,
      prevailingWind: game.prevailingWind,
      ruleset: game.ruleset,
      seatIndex: seat.seatIndex,
    });
  }

  async join(userId: string, body: JsonValue, now: Date): Promise<SnapshotResult> {
    const parsed = joinGameBodySchema.safeParse(body);
    if (!parsed.success || !isFiveDigitCode(parsed.data.referenceCode)) {
      return apiFailure(ApiError.InvalidBody);
    }
    const referenceCode = parsed.data.referenceCode;
    try {
      const gameId = await this.runTransaction(async (tx) => {
        const game = await this.gamesRepo.findByReferenceCode(referenceCode, tx);
        if (game == null) {
          throw new GameRuleFailure(apiFailure(ApiError.GameNotFound));
        }
        if (game.status !== GameStatus.Waiting) {
          throw new GameRuleFailure(apiFailure(ApiError.GameNotWaiting));
        }
        const owned = await this.seatsRepo.findByUserId(userId, tx);
        if (owned.length > 0) {
          throw new GameRuleFailure(apiFailure(ApiError.AlreadySeated));
        }
        const seated = await this.seatsRepo.findByGameId(game.id, tx);
        if (seated.length >= seatCount) {
          throw new GameRuleFailure(apiFailure(ApiError.GameFull));
        }
        await this.seatsRepo.insert(
          {
            gameId: game.id,
            seatIndex: seated.length,
            userId,
            runningScore: game.startingScore,
            nextWindAgreed: false,
          },
          tx,
        );
        if (seated.length + 1 === seatCount) {
          await this.roundsLogic.start({
            game,
            dealerSeatIndex: this.random.dealerSeatIndex(),
            now,
            tx,
          });
        }
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
      if (constraint != null && constraint.includes("user_id")) {
        return apiFailure(ApiError.AlreadySeated);
      }
      if (constraint != null && constraint.includes("seat_index")) {
        return apiFailure(ApiError.GameFull);
      }
      throw error;
    }
  }

  async requireSeat(gameId: string, userId: string, tx?: DbExecutor): Promise<SeatRow> {
    const seat = await this.seatsRepo.findByGameIdAndUserId(gameId, userId, tx);
    if (seat == null) {
      throw new GameRuleFailure(apiFailure(ApiError.NotSeated));
    }
    return seat;
  }
}
