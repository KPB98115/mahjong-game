import { db } from "void/db";
import { type DbExecutor } from "../logic/server/db/executor";
import { ClaimWindowMs } from "../types/server/claimWindowMs";
import {
  type DiscardTileRow,
  type DiscardTilesRepo,
  type NewDiscardTile,
} from "../logic/server/game/discardTilesRepo";
import {
  type FlowerTilesRepo,
  type FlowerTileRow,
  type NewFlowerTile,
} from "../logic/server/game/flowerTilesRepo";
import { type GameRedis } from "../logic/server/game/gamesLogic";
import { type GameRow, type GamesRepo, type NewGame } from "../logic/server/game/gamesRepo";
import { type HandRow, type HandsRepo, type NewHand } from "../logic/server/game/handsRepo";
import {
  type HandTileRow,
  type HandTilesRepo,
  type NewHandTile,
} from "../logic/server/game/handTilesRepo";
import {
  type MeldTileRow,
  type MeldTilesRepo,
  type NewMeldTile,
} from "../logic/server/game/meldTilesRepo";
import { type MeldRow, type MeldsRepo, type NewMeld } from "../logic/server/game/meldsRepo";
import {
  type RoundScoreRow,
  type RoundScoresRepo,
  type NewRoundScore,
} from "../logic/server/game/roundScoresRepo";
import { type RoundRow, type RoundsRepo, type NewRound } from "../logic/server/game/roundsRepo";
import {
  type ScorePaymentRow,
  type ScorePaymentsRepo,
  type NewScorePayment,
} from "../logic/server/game/scorePaymentsRepo";
import { type NewSeat, type SeatRow, type SeatsRepo } from "../logic/server/game/seatsRepo";
import {
  type WallTileRow,
  type WallTilesRepo,
  type NewWallTile,
} from "../logic/server/game/wallTilesRepo";

type MemoryState = {
  games: GameRow[];
  seats: SeatRow[];
  rounds: RoundRow[];
  hands: HandRow[];
  handTiles: HandTileRow[];
  wallTiles: WallTileRow[];
  discardTiles: DiscardTileRow[];
  flowerTiles: FlowerTileRow[];
  melds: MeldRow[];
  meldTiles: MeldTileRow[];
  roundScores: RoundScoreRow[];
  scorePayments: ScorePaymentRow[];
};

export type MemoryGame = {
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
  runTransaction: <T>(callback: (tx: DbExecutor) => Promise<T>) => Promise<T>;
  redis: GameRedis;
  published: string[];
  deletedCaches: string[];
};

export function createMemoryGame(): MemoryGame {
  let state: MemoryState = emptyState();
  const published: string[] = [];
  const deletedCaches: string[] = [];

  function id(): string {
    return crypto.randomUUID();
  }

  const gamesRepo: GamesRepo = {
    async insert(values: NewGame) {
      assertUnique(
        !state.games.some((row) => row.referenceCode === values.referenceCode),
        "games_reference_code_unique",
      );
      const now = new Date();
      const row: GameRow = {
        id: values.id ?? id(),
        referenceCode: values.referenceCode,
        status: values.status,
        prevailingWind: values.prevailingWind,
        ruleset: values.ruleset,
        startingScore: values.startingScore ?? "0",
        handTileCount: values.handTileCount,
        winMeldCount: values.winMeldCount,
        scoreUnit: values.scoreUnit,
        bonusTilesEnabled: values.bonusTilesEnabled,
        chowOnlyFromPrevious: values.chowOnlyFromPrevious,
        minScoreUnits: values.minScoreUnits ?? "0",
        discardWinPayer: values.discardWinPayer,
        autoDraw: values.autoDraw ?? true,
        claimWindowMs:
          values.claimWindowMs === undefined ? ClaimWindowMs.FiveSeconds : values.claimWindowMs,
        scoringVersion: values.scoringVersion,
        completedAt: values.completedAt ?? null,
        createdAt: values.createdAt ?? now,
        updatedAt: values.updatedAt ?? now,
      };
      state.games.push(row);
      return row;
    },
    async findById(gameId: string) {
      return state.games.find((row) => row.id === gameId);
    },
    async findByReferenceCode(referenceCode: string) {
      return state.games.find((row) => row.referenceCode === referenceCode);
    },
    async update(gameId: string, values: Partial<GameRow>) {
      const row = state.games.find((item) => item.id === gameId);
      if (row == null) {
        return undefined;
      }
      Object.assign(row, values);
      return row;
    },
    async delete(gameId: string) {
      deleteGame(state, gameId);
    },
    async listCompletedBefore() {
      return [];
    },
  };

  const seatsRepo: SeatsRepo = {
    async insert(values: NewSeat) {
      assertUnique(
        !state.seats.some((row) => row.userId === values.userId),
        "seats_user_id_unique",
      );
      assertUnique(
        !state.seats.some(
          (row) => row.gameId === values.gameId && row.seatIndex === values.seatIndex,
        ),
        "seats_game_id_seat_index_key",
      );
      const row: SeatRow = {
        id: values.id ?? id(),
        gameId: values.gameId,
        seatIndex: values.seatIndex,
        userId: values.userId,
        runningScore: values.runningScore,
        nextWindAgreed: values.nextWindAgreed ?? false,
        createdAt: values.createdAt ?? new Date(),
      };
      state.seats.push(row);
      return row;
    },
    async findById(seatId: string) {
      return state.seats.find((row) => row.id === seatId);
    },
    async findByGameId(gameId: string) {
      return state.seats
        .filter((row) => row.gameId === gameId)
        .sort((left, right) => left.seatIndex - right.seatIndex);
    },
    async findByGameIdAndUserId(gameId: string, userId: string) {
      return state.seats.find((row) => row.gameId === gameId && row.userId === userId);
    },
    async findByUserId(userId: string) {
      return state.seats.filter((row) => row.userId === userId);
    },
    async update(seatId: string, values: Partial<SeatRow>) {
      const row = state.seats.find((item) => item.id === seatId);
      if (row == null) {
        return undefined;
      }
      Object.assign(row, values);
      return row;
    },
  };

  const roundsRepo: RoundsRepo = {
    async insert(values: NewRound) {
      const now = new Date();
      const row: RoundRow = {
        id: values.id ?? id(),
        gameId: values.gameId,
        roundIndex: values.roundIndex,
        status: values.status,
        dealerSeatIndex: values.dealerSeatIndex,
        prevailingWind: values.prevailingWind,
        currentSeatIndex: values.currentSeatIndex,
        phase: values.phase,
        resultType: values.resultType ?? null,
        winKind: values.winKind ?? null,
        winnerSeatIndex: values.winnerSeatIndex ?? null,
        discardFromSeatIndex: values.discardFromSeatIndex ?? null,
        createdAt: values.createdAt ?? now,
        updatedAt: values.updatedAt ?? now,
      };
      state.rounds.push(row);
      return row;
    },
    async findById(roundId: string) {
      return state.rounds.find((row) => row.id === roundId);
    },
    async findByGameId(gameId: string) {
      return state.rounds
        .filter((row) => row.gameId === gameId)
        .sort((left, right) => left.roundIndex - right.roundIndex);
    },
    async update(roundId: string, values: Partial<RoundRow>) {
      const row = state.rounds.find((item) => item.id === roundId);
      if (row == null) {
        return undefined;
      }
      Object.assign(row, values);
      return row;
    },
  };

  const handsRepo: HandsRepo = {
    async insert(values: NewHand) {
      const now = new Date();
      const row: HandRow = {
        id: values.id ?? id(),
        roundId: values.roundId,
        seatIndex: values.seatIndex,
        createdAt: values.createdAt ?? now,
        updatedAt: values.updatedAt ?? now,
      };
      state.hands.push(row);
      return row;
    },
    async findById(handId: string) {
      return state.hands.find((row) => row.id === handId);
    },
    async findByRoundId(roundId: string) {
      return state.hands.filter((row) => row.roundId === roundId);
    },
    async findByRoundIdAndSeatIndex(roundId: string, seatIndex: number) {
      return state.hands.find((row) => row.roundId === roundId && row.seatIndex === seatIndex);
    },
  };

  const handTilesRepo: HandTilesRepo = {
    async insert(values: NewHandTile) {
      const row = handTileFrom(values, id());
      state.handTiles.push(row);
      return row;
    },
    async insertMany(values: NewHandTile[]) {
      const rows = values.map((values) => handTileFrom(values, id()));
      state.handTiles.push(...rows);
      return rows;
    },
    async findById(tileId: string) {
      return state.handTiles.find((row) => row.id === tileId);
    },
    async findByHandId(handId: string) {
      return state.handTiles
        .filter((row) => row.handId === handId)
        .sort((left, right) => left.sortIndex - right.sortIndex);
    },
    async update(tileId: string, values: Partial<HandTileRow>) {
      const row = state.handTiles.find((item) => item.id === tileId);
      if (row == null) {
        return undefined;
      }
      Object.assign(row, values);
      return row;
    },
    async deleteById(tileId: string) {
      state.handTiles = state.handTiles.filter((row) => row.id !== tileId);
    },
  };

  const wallTilesRepo: WallTilesRepo = {
    async insertMany(values: NewWallTile[]) {
      const rows = values.map((values) => wallTileFrom(values, id()));
      state.wallTiles.push(...rows);
      return rows;
    },
    async findById(tileId: string) {
      return state.wallTiles.find((row) => row.id === tileId);
    },
    async findByRoundId(roundId: string) {
      return state.wallTiles
        .filter((row) => row.roundId === roundId)
        .sort((left, right) => left.sortIndex - right.sortIndex);
    },
    async deleteById(tileId: string) {
      state.wallTiles = state.wallTiles.filter((row) => row.id !== tileId);
    },
  };

  const flowerTilesRepo: FlowerTilesRepo = {
    async insert(values: NewFlowerTile) {
      const row: FlowerTileRow = {
        id: values.id ?? id(),
        roundId: values.roundId,
        seatIndex: values.seatIndex,
        tileCode: values.tileCode,
        sortIndex: values.sortIndex,
      };
      state.flowerTiles.push(row);
      return row;
    },
    async findByRoundId(roundId: string) {
      return state.flowerTiles
        .filter((row) => row.roundId === roundId)
        .sort(
          (left, right) => left.seatIndex - right.seatIndex || left.sortIndex - right.sortIndex,
        );
    },
    async findByRoundIdAndSeatIndex(roundId: string, seatIndex: number) {
      return state.flowerTiles
        .filter((row) => row.roundId === roundId && row.seatIndex === seatIndex)
        .sort((left, right) => left.sortIndex - right.sortIndex);
    },
  };

  const discardTilesRepo: DiscardTilesRepo = {
    async insert(values: NewDiscardTile) {
      const row: DiscardTileRow = {
        id: values.id ?? id(),
        roundId: values.roundId,
        seatIndex: values.seatIndex,
        tileCode: values.tileCode,
        sortIndex: values.sortIndex,
      };
      state.discardTiles.push(row);
      return row;
    },
    async findById(tileId: string) {
      return state.discardTiles.find((row) => row.id === tileId);
    },
    async findByRoundId(roundId: string) {
      return state.discardTiles
        .filter((row) => row.roundId === roundId)
        .sort((left, right) => left.sortIndex - right.sortIndex);
    },
    async deleteById(tileId: string) {
      state.discardTiles = state.discardTiles.filter((row) => row.id !== tileId);
    },
  };

  const meldsRepo: MeldsRepo = {
    async insert(values: NewMeld) {
      const now = new Date();
      const row: MeldRow = {
        id: values.id ?? id(),
        roundId: values.roundId,
        seatIndex: values.seatIndex,
        meldType: values.meldType,
        isConcealed: values.isConcealed ?? false,
        fromSeatIndex: values.fromSeatIndex ?? null,
        sortIndex: values.sortIndex,
        createdAt: values.createdAt ?? now,
      };
      state.melds.push(row);
      return row;
    },
    async findById(meldId: string) {
      return state.melds.find((row) => row.id === meldId);
    },
    async findByRoundId(roundId: string) {
      return state.melds
        .filter((row) => row.roundId === roundId)
        .sort(
          (left, right) => left.seatIndex - right.seatIndex || left.sortIndex - right.sortIndex,
        );
    },
    async findByRoundIdAndSeatIndex(roundId: string, seatIndex: number) {
      return state.melds
        .filter((row) => row.roundId === roundId && row.seatIndex === seatIndex)
        .sort((left, right) => left.sortIndex - right.sortIndex);
    },
    async update(meldId: string, values: Partial<MeldRow>) {
      const row = state.melds.find((item) => item.id === meldId);
      if (row == null) {
        return undefined;
      }
      Object.assign(row, values);
      return row;
    },
  };

  const meldTilesRepo: MeldTilesRepo = {
    async insert(values: NewMeldTile) {
      const row = meldTileFrom(values, id());
      state.meldTiles.push(row);
      return row;
    },
    async insertMany(values: NewMeldTile[]) {
      const rows = values.map((item) => meldTileFrom(item, id()));
      state.meldTiles.push(...rows);
      return rows;
    },
    async findByMeldId(meldId: string) {
      return state.meldTiles
        .filter((row) => row.meldId === meldId)
        .sort((left, right) => left.sortIndex - right.sortIndex);
    },
  };

  const roundScoresRepo: RoundScoresRepo = {
    async insert(values: NewRoundScore) {
      const row = roundScoreFrom(values, id());
      state.roundScores.push(row);
      return row;
    },
    async insertMany(values: NewRoundScore[]) {
      const rows = values.map((item) => roundScoreFrom(item, id()));
      state.roundScores.push(...rows);
      return rows;
    },
    async findByRoundId(roundId: string) {
      return state.roundScores
        .filter((row) => row.roundId === roundId)
        .sort((left, right) => left.seatIndex - right.seatIndex);
    },
  };

  const scorePaymentsRepo: ScorePaymentsRepo = {
    async insert(values: NewScorePayment) {
      const row = paymentFrom(values, id());
      state.scorePayments.push(row);
      return row;
    },
    async insertMany(values: NewScorePayment[]) {
      const rows = values.map((item) => paymentFrom(item, id()));
      state.scorePayments.push(...rows);
      return rows;
    },
    async findByRoundId(roundId: string) {
      return state.scorePayments.filter((row) => row.roundId === roundId);
    },
  };

  return {
    gamesRepo,
    seatsRepo,
    roundsRepo,
    handsRepo,
    handTilesRepo,
    wallTilesRepo,
    discardTilesRepo,
    flowerTilesRepo,
    meldsRepo,
    meldTilesRepo,
    roundScoresRepo,
    scorePaymentsRepo,
    async runTransaction(callback) {
      const saved = structuredClone(state);
      try {
        return await callback(db);
      } catch (error) {
        state = saved;
        throw error;
      }
    },
    redis: {
      async publishAborted(gameId: string) {
        published.push(gameId);
      },
      async deleteCache(gameId: string) {
        deletedCaches.push(gameId);
      },
    },
    published,
    deletedCaches,
  };
}

function emptyState(): MemoryState {
  return {
    games: [],
    seats: [],
    rounds: [],
    hands: [],
    handTiles: [],
    wallTiles: [],
    discardTiles: [],
    flowerTiles: [],
    melds: [],
    meldTiles: [],
    roundScores: [],
    scorePayments: [],
  };
}

function assertUnique(ok: boolean, constraint: string): void {
  if (ok) {
    return;
  }
  const error: UniqueViolationError = Object.assign(new Error(`duplicate key ${constraint}`), {
    code: "23505",
    constraint,
  });
  throw error;
}

type UniqueViolationError = Error & {
  code: string;
  constraint: string;
};

function deleteGame(state: MemoryState, gameId: string): void {
  const roundIds = state.rounds.filter((row) => row.gameId === gameId).map((row) => row.id);
  const handIds = state.hands.filter((row) => roundIds.includes(row.roundId)).map((row) => row.id);
  const meldIds = state.melds.filter((row) => roundIds.includes(row.roundId)).map((row) => row.id);
  state.handTiles = state.handTiles.filter((row) => !handIds.includes(row.handId));
  state.hands = state.hands.filter((row) => !roundIds.includes(row.roundId));
  state.wallTiles = state.wallTiles.filter((row) => !roundIds.includes(row.roundId));
  state.discardTiles = state.discardTiles.filter((row) => !roundIds.includes(row.roundId));
  state.flowerTiles = state.flowerTiles.filter((row) => !roundIds.includes(row.roundId));
  state.meldTiles = state.meldTiles.filter((row) => !meldIds.includes(row.meldId));
  state.melds = state.melds.filter((row) => !roundIds.includes(row.roundId));
  state.roundScores = state.roundScores.filter((row) => !roundIds.includes(row.roundId));
  state.scorePayments = state.scorePayments.filter((row) => !roundIds.includes(row.roundId));
  state.rounds = state.rounds.filter((row) => row.gameId !== gameId);
  state.seats = state.seats.filter((row) => row.gameId !== gameId);
  state.games = state.games.filter((row) => row.id !== gameId);
}

function handTileFrom(values: NewHandTile, generatedId: string): HandTileRow {
  return {
    id: values.id ?? generatedId,
    handId: values.handId,
    tileCode: values.tileCode,
    sortIndex: values.sortIndex,
    isDrawn: values.isDrawn ?? false,
  };
}

function wallTileFrom(values: NewWallTile, generatedId: string): WallTileRow {
  return {
    id: values.id ?? generatedId,
    roundId: values.roundId,
    tileCode: values.tileCode,
    sortIndex: values.sortIndex,
  };
}

function roundScoreFrom(values: NewRoundScore, generatedId: string): RoundScoreRow {
  return {
    id: values.id ?? generatedId,
    roundId: values.roundId,
    seatIndex: values.seatIndex,
    userId: values.userId,
    scoreDelta: values.scoreDelta,
    scoreAfter: values.scoreAfter,
    scoreUnits: values.scoreUnits ?? null,
    isWinner: values.isWinner ?? false,
  };
}

function meldTileFrom(values: NewMeldTile, generatedId: string): MeldTileRow {
  return {
    id: values.id ?? generatedId,
    meldId: values.meldId,
    tileCode: values.tileCode,
    sortIndex: values.sortIndex,
    isClaimed: values.isClaimed ?? false,
  };
}

function paymentFrom(values: NewScorePayment, generatedId: string): ScorePaymentRow {
  return {
    id: values.id ?? generatedId,
    roundId: values.roundId,
    fromSeatIndex: values.fromSeatIndex,
    toSeatIndex: values.toSeatIndex,
    amount: values.amount,
  };
}
