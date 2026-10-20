import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  numeric,
  pgSchema,
  text,
  timestamp,
  unique,
  uuid,
} from "void/schema-pg";
import { ClaimWindowMs } from "../../src/types/server/claimWindowMs";
import { DiscardWinPayer } from "../../src/types/server/discardWinPayer";
import { GameStatus } from "../../src/types/server/gameStatus";
import { MeldType } from "../../src/types/server/meldType";
import { PrevailingWind } from "../../src/types/server/prevailingWind";
import { RoundPhase } from "../../src/types/server/roundPhase";
import { RoundResultType } from "../../src/types/server/roundResultType";
import { RoundStatus } from "../../src/types/server/roundStatus";
import { Ruleset } from "../../src/types/server/ruleset";
import { ScoreUnit } from "../../src/types/server/scoreUnit";
import { WinKind } from "../../src/types/server/winKind";
import { sqlTextEnum } from "../sqlEnum";
import { timestamptz, uuidPrimaryKey } from "./columns";
import { users } from "./profile";

const ruleset = sqlTextEnum(Ruleset);
const gameStatus = sqlTextEnum(GameStatus);
const prevailingWind = sqlTextEnum(PrevailingWind);
const scoreUnit = sqlTextEnum(ScoreUnit);
const discardWinPayer = sqlTextEnum(DiscardWinPayer);
const roundStatus = sqlTextEnum(RoundStatus);
const roundPhase = sqlTextEnum(RoundPhase);
const roundResultType = sqlTextEnum(RoundResultType);
const winKind = sqlTextEnum(WinKind);
const meldType = sqlTextEnum(MeldType);

export const gameSchema = pgSchema("game");

export const games = gameSchema.table(
  "games",
  {
    id: uuidPrimaryKey("id"),
    referenceCode: text("reference_code").notNull().unique(),
    status: gameStatus("status").notNull(),
    prevailingWind: prevailingWind("prevailing_wind").notNull(),
    ruleset: ruleset("ruleset").notNull(),
    startingScore: numeric("starting_score").notNull().default("0"),
    handTileCount: integer("hand_tile_count").notNull(),
    winMeldCount: integer("win_meld_count").notNull(),
    scoreUnit: scoreUnit("score_unit").notNull(),
    bonusTilesEnabled: boolean("bonus_tiles_enabled").notNull(),
    chowOnlyFromPrevious: boolean("chow_only_from_previous").notNull(),
    minScoreUnits: numeric("min_score_units").notNull().default("0"),
    discardWinPayer: discardWinPayer("discard_win_payer").notNull(),
    autoDraw: boolean("auto_draw").notNull().default(true),
    claimWindowMs: integer("claim_window_ms").$type<ClaimWindowMs>().default(ClaimWindowMs.FiveSeconds),
    scoringVersion: text("scoring_version").notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamptz("created_at"),
    updatedAt: timestamptz("updated_at"),
  },
  (table) => [
    index("games_completed_at_idx").on(table.completedAt),
    check(
      "games_claim_window_ms_check",
      sql`${table.claimWindowMs} IS NULL OR ${table.claimWindowMs} IN (5000, 10000)`,
    ),
  ],
);

export const seats = gameSchema.table(
  "seats",
  {
    id: uuidPrimaryKey("id"),
    gameId: uuid("game_id")
      .notNull()
      .references(() => games.id, { onDelete: "cascade" }),
    seatIndex: integer("seat_index").notNull(),
    userId: uuid("user_id")
      .notNull()
      .unique()
      .references(() => users.uuid, { onDelete: "restrict" }),
    runningScore: numeric("running_score").notNull(),
    nextWindAgreed: boolean("next_wind_agreed").notNull().default(false),
    createdAt: timestamptz("created_at"),
  },
  (table) => [unique("seats_game_id_seat_index_key").on(table.gameId, table.seatIndex)],
);

export const rounds = gameSchema.table(
  "rounds",
  {
    id: uuidPrimaryKey("id"),
    gameId: uuid("game_id")
      .notNull()
      .references(() => games.id, { onDelete: "cascade" }),
    roundIndex: integer("round_index").notNull(),
    status: roundStatus("status").notNull(),
    dealerSeatIndex: integer("dealer_seat_index").notNull(),
    prevailingWind: prevailingWind("prevailing_wind").notNull(),
    currentSeatIndex: integer("current_seat_index").notNull(),
    phase: roundPhase("phase").notNull(),
    resultType: roundResultType("result_type"),
    winKind: winKind("win_kind"),
    winnerSeatIndex: integer("winner_seat_index"),
    discardFromSeatIndex: integer("discard_from_seat_index"),
    createdAt: timestamptz("created_at"),
    updatedAt: timestamptz("updated_at"),
  },
  (table) => [unique("rounds_game_id_round_index_key").on(table.gameId, table.roundIndex)],
);

export const hands = gameSchema.table(
  "hands",
  {
    id: uuidPrimaryKey("id"),
    roundId: uuid("round_id")
      .notNull()
      .references(() => rounds.id, { onDelete: "cascade" }),
    seatIndex: integer("seat_index").notNull(),
    createdAt: timestamptz("created_at"),
    updatedAt: timestamptz("updated_at"),
  },
  (table) => [unique("hands_round_id_seat_index_key").on(table.roundId, table.seatIndex)],
);

export const handTiles = gameSchema.table(
  "hand_tiles",
  {
    id: uuidPrimaryKey("id"),
    handId: uuid("hand_id")
      .notNull()
      .references(() => hands.id, { onDelete: "cascade" }),
    tileCode: text("tile_code").notNull(),
    sortIndex: integer("sort_index").notNull(),
    isDrawn: boolean("is_drawn").notNull().default(false),
  },
  (table) => [
    unique("hand_tiles_hand_id_sort_index_key").on(table.handId, table.sortIndex),
    index("hand_tiles_hand_id_idx").on(table.handId),
  ],
);

export const wallTiles = gameSchema.table(
  "wall_tiles",
  {
    id: uuidPrimaryKey("id"),
    roundId: uuid("round_id")
      .notNull()
      .references(() => rounds.id, { onDelete: "cascade" }),
    tileCode: text("tile_code").notNull(),
    sortIndex: integer("sort_index").notNull(),
  },
  (table) => [
    unique("wall_tiles_round_id_sort_index_key").on(table.roundId, table.sortIndex),
    index("wall_tiles_round_id_idx").on(table.roundId),
  ],
);

export const discardTiles = gameSchema.table(
  "discard_tiles",
  {
    id: uuidPrimaryKey("id"),
    roundId: uuid("round_id")
      .notNull()
      .references(() => rounds.id, { onDelete: "cascade" }),
    seatIndex: integer("seat_index").notNull(),
    tileCode: text("tile_code").notNull(),
    sortIndex: integer("sort_index").notNull(),
  },
  (table) => [
    unique("discard_tiles_round_id_sort_index_key").on(table.roundId, table.sortIndex),
    index("discard_tiles_round_id_seat_index_idx").on(table.roundId, table.seatIndex),
  ],
);

export const flowerTiles = gameSchema.table(
  "flower_tiles",
  {
    id: uuidPrimaryKey("id"),
    roundId: uuid("round_id")
      .notNull()
      .references(() => rounds.id, { onDelete: "cascade" }),
    seatIndex: integer("seat_index").notNull(),
    tileCode: text("tile_code").notNull(),
    sortIndex: integer("sort_index").notNull(),
  },
  (table) => [
    unique("flower_tiles_round_id_seat_index_sort_index_key").on(
      table.roundId,
      table.seatIndex,
      table.sortIndex,
    ),
    index("flower_tiles_round_id_seat_index_idx").on(table.roundId, table.seatIndex),
  ],
);

export const melds = gameSchema.table(
  "melds",
  {
    id: uuidPrimaryKey("id"),
    roundId: uuid("round_id")
      .notNull()
      .references(() => rounds.id, { onDelete: "cascade" }),
    seatIndex: integer("seat_index").notNull(),
    meldType: meldType("meld_type").notNull(),
    isConcealed: boolean("is_concealed").notNull().default(false),
    fromSeatIndex: integer("from_seat_index"),
    sortIndex: integer("sort_index").notNull(),
    createdAt: timestamptz("created_at"),
  },
  (table) => [
    unique("melds_round_id_seat_index_sort_index_key").on(
      table.roundId,
      table.seatIndex,
      table.sortIndex,
    ),
    index("melds_round_id_seat_index_idx").on(table.roundId, table.seatIndex),
  ],
);

export const meldTiles = gameSchema.table(
  "meld_tiles",
  {
    id: uuidPrimaryKey("id"),
    meldId: uuid("meld_id")
      .notNull()
      .references(() => melds.id, { onDelete: "cascade" }),
    tileCode: text("tile_code").notNull(),
    sortIndex: integer("sort_index").notNull(),
    isClaimed: boolean("is_claimed").notNull().default(false),
  },
  (table) => [
    unique("meld_tiles_meld_id_sort_index_key").on(table.meldId, table.sortIndex),
    index("meld_tiles_meld_id_idx").on(table.meldId),
  ],
);

export const roundScores = gameSchema.table(
  "round_scores",
  {
    id: uuidPrimaryKey("id"),
    roundId: uuid("round_id")
      .notNull()
      .references(() => rounds.id, { onDelete: "cascade" }),
    seatIndex: integer("seat_index").notNull(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.uuid, { onDelete: "restrict" }),
    scoreDelta: numeric("score_delta").notNull(),
    scoreAfter: numeric("score_after").notNull(),
    scoreUnits: numeric("score_units"),
    isWinner: boolean("is_winner").notNull().default(false),
  },
  (table) => [unique("round_scores_round_id_seat_index_key").on(table.roundId, table.seatIndex)],
);

export const scorePayments = gameSchema.table(
  "score_payments",
  {
    id: uuidPrimaryKey("id"),
    roundId: uuid("round_id")
      .notNull()
      .references(() => rounds.id, { onDelete: "cascade" }),
    fromSeatIndex: integer("from_seat_index").notNull(),
    toSeatIndex: integer("to_seat_index").notNull(),
    amount: numeric("amount").notNull(),
  },
  (table) => [index("score_payments_round_id_idx").on(table.roundId)],
);
