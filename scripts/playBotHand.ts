/**
 * In-process bot integration script.
 * Run: npm run bot:play
 *
 * Two scenarios:
 *   1. Deterministic Win  – stacked wall forces seat 0 to win by self-draw on the first turn.
 *   2. Random Play        – four Low bots play until the wall is exhausted.
 *
 * All state is in-memory (no Postgres or Redis needed).
 */

import { createPlayWorld, playNow, type PlayWorld } from "../src/test/playWorld";
import {
  chooseTurnAction,
  chooseClaimAction,
  type BotContext,
} from "../src/logic/server/game/bot/botPlayer";
import { BotDifficulty } from "../src/types/server/botDifficulty";
import { GameStatus } from "../src/types/server/gameStatus";
import { RoundPhase } from "../src/types/server/roundPhase";
import { RoundStatus } from "../src/types/server/roundStatus";
import { type ExposedMeld } from "../src/logic/server/game/handScoring";
import { scoringChartFor } from "../src/logic/server/game/scoringChart";

const MAX_TURNS = 300;

async function buildBotContext(
  world: PlayWorld,
  seatIndex: number,
  discardCode: string | null,
  discardSeatIndex: number | null,
  isRobKong: boolean,
): Promise<BotContext> {
  const round = await world.round();
  const game = await world.tables.gamesRepo.findById(world.gameId);
  if (game == null) {
    throw new Error("game not found");
  }

  const hand = await world.hand(seatIndex);

  const meldRows = await world.tables.meldsRepo.findByRoundIdAndSeatIndex(round.id, seatIndex);
  const exposedMelds: ExposedMeld[] = await Promise.all(
    meldRows.map(async (meld) => {
      const tiles = await world.tables.meldTilesRepo.findByMeldId(meld.id);
      return {
        meldType: meld.meldType,
        isConcealed: meld.isConcealed,
        tileCodes: tiles.map((t) => t.tileCode),
      };
    }),
  );

  const flowers = await world.tables.flowerTilesRepo.findByRoundIdAndSeatIndex(round.id, seatIndex);
  const wall = await world.tables.wallTilesRepo.findByRoundId(round.id);

  const chart = scoringChartFor(game.ruleset, game.scoringVersion);
  if (chart == null) {
    throw new Error(`no scoring chart for ruleset=${game.ruleset} version=${game.scoringVersion}`);
  }

  return {
    hand,
    exposedMelds,
    discardCode,
    discardSeatIndex,
    seatIndex,
    dealerSeatIndex: round.dealerSeatIndex,
    winMeldCount: game.winMeldCount,
    chowOnlyFromPrevious: game.chowOnlyFromPrevious,
    bonusTilesEnabled: game.bonusTilesEnabled,
    prevailingWind: round.prevailingWind,
    flowerCodes: flowers.map((f) => f.tileCode),
    chart,
    wallEmpty: wall.length === 0,
    isRobKong,
  };
}

async function isGameOver(world: PlayWorld): Promise<boolean> {
  const game = await world.tables.gamesRepo.findById(world.gameId);
  return game == null || game.status !== GameStatus.InProgress;
}

async function playScenario(
  label: string,
  world: PlayWorld,
  difficulties: BotDifficulty[],
): Promise<void> {
  console.log(`\n=== ${label} ===`);

  for (let turn = 1; turn <= MAX_TURNS; turn++) {
    if (await isGameOver(world)) break;

    const round = await world.round();
    if (round.status !== RoundStatus.InProgress) break;

    const { phase, currentSeatIndex } = round;
    const userId = world.userIds[currentSeatIndex];
    if (userId == null) {
      throw new Error(`no user at seat ${currentSeatIndex}`);
    }

    if (phase === RoundPhase.Draw) {
      await world.roundsLogic.draw({ gameId: world.gameId, userId, now: playNow });
      console.log(`  [${turn}] seat ${currentSeatIndex} draws`);
    } else if (phase === RoundPhase.Discard) {
      const context = await buildBotContext(world, currentSeatIndex, null, null, false);
      const difficulty = difficulties[currentSeatIndex] ?? BotDifficulty.Low;
      const action = chooseTurnAction(context, difficulty);

      if (action.action === "win") {
        const outcome = await world.roundsLogic.declareWin({
          gameId: world.gameId,
          userId,
          now: playNow,
        });
        if (outcome.ok) {
          console.log(`  [${turn}] seat ${currentSeatIndex} wins by self-draw!`);
          break;
        }
        // Win check passed locally but server rejected — fall back to discarding.
        const fallback = await buildBotContext(world, currentSeatIndex, null, null, false);
        const fallbackHand = fallback.hand;
        const drawn = fallbackHand.find((t) => t.isDrawn) ?? fallbackHand.at(-1);
        if (drawn == null) throw new Error("no tile to discard");
        await world.roundsLogic.discard({
          gameId: world.gameId,
          userId,
          tileId: drawn.id,
          now: playNow,
        });
        console.log(`  [${turn}] seat ${currentSeatIndex} discards (fallback)`);
      } else {
        await world.roundsLogic.discard({
          gameId: world.gameId,
          userId,
          tileId: action.tileId,
          now: playNow,
        });
        console.log(`  [${turn}] seat ${currentSeatIndex} discards`);
      }
    } else if (phase === RoundPhase.Claim || phase === RoundPhase.RobKong) {
      const isRobKong = phase === RoundPhase.RobKong;
      const discards = await world.tables.discardTilesRepo.findByRoundId(round.id);
      const lastDiscard = discards.at(-1);
      if (lastDiscard == null) throw new Error("claim/robKong phase without a discard");

      const discarderSeat = lastDiscard.seatIndex;

      for (let seat = 0; seat < 4; seat++) {
        if (await isGameOver(world)) break;
        if (seat === discarderSeat) continue;

        const seatUserId = world.userIds[seat];
        if (seatUserId == null) throw new Error(`no user at seat ${seat}`);

        const context = await buildBotContext(
          world,
          seat,
          lastDiscard.tileCode,
          discarderSeat,
          isRobKong,
        );
        const difficulty = difficulties[seat] ?? BotDifficulty.Low;
        const action = chooseClaimAction(context, difficulty);

        if (action.action === "win") {
          const outcome = await world.roundsLogic.declareWin({
            gameId: world.gameId,
            userId: seatUserId,
            now: playNow,
          });
          if (outcome.ok) {
            console.log(`  [${turn}] seat ${seat} wins on ${lastDiscard.tileCode}!`);
            break;
          }
          // Declare win rejected — pass instead.
          await world.roundsLogic.passClaim({
            gameId: world.gameId,
            userId: seatUserId,
            now: playNow,
          });
        } else if (action.action === "claim") {
          const outcome = await world.roundsLogic.claim({
            gameId: world.gameId,
            userId: seatUserId,
            kind: action.kind,
            tileIds: action.tileIds,
            now: playNow,
          });
          if (outcome.ok) {
            console.log(`  [${turn}] seat ${seat} claims ${action.kind}`);
          } else {
            // Invalid meld locally computed — pass to keep the game moving.
            await world.roundsLogic.passClaim({
              gameId: world.gameId,
              userId: seatUserId,
              now: playNow,
            });
          }
        } else {
          // Pass. NoClaimWindow means window resolved early; ignore the error.
          await world.roundsLogic.passClaim({
            gameId: world.gameId,
            userId: seatUserId,
            now: playNow,
          });
        }
      }
    }
  }

  const finalGame = await world.tables.gamesRepo.findById(world.gameId);
  const finalRound = await world.round();
  console.log(
    `  => status: ${finalGame?.status ?? "unknown"} | result: ${finalRound.resultType ?? "none"} | winner seat: ${finalRound.winnerSeatIndex ?? "–"}`,
  );
}

async function scenarioDeterministicWin(): Promise<void> {
  /**
   * Seat 0 (dealer) is dealt man_1–6 + east (7 tiles).
   * autoDraw=true immediately draws the first wall tile (east) → winning hand.
   * Hand shape: man_1,2,3 | man_4,5,6 | east,east → two chows + east pair.
   * Smart bot detects the win and calls declareWin before discarding.
   */
  const world = await createPlayWorld({
    body: { ruleset: "hongKong", handTileCount: 7, winMeldCount: 2 },
    wall: {
      hands: [["man_1", "man_2", "man_3", "man_4", "man_5", "man_6", "east"]],
      draws: ["east"],
    },
    dealerSeatIndex: 0,
  });

  await playScenario("Deterministic Win – seat 0 Smart self-draw", world, [
    BotDifficulty.Smart,
    BotDifficulty.Low,
    BotDifficulty.Low,
    BotDifficulty.Low,
  ]);

  const finalRound = await world.round();
  if (finalRound.winnerSeatIndex !== 0) {
    console.error(`  FAIL: expected seat 0 to win, got winner=${finalRound.winnerSeatIndex}`);
    process.exit(1);
  }
  console.log("  PASS: seat 0 won as expected.\n");
}

async function scenarioRandomPlay(): Promise<void> {
  /**
   * Four Low bots on a standard Hong Kong table with a shuffled wall.
   * Low bots always discard the drawn tile and pass every claim window,
   * so no one ever wins off a discard. The hand ends when the wall empties.
   */
  const world = await createPlayWorld({ body: { ruleset: "hongKong" } });

  await playScenario("Random Play – four Low bots (wall exhaustion)", world, [
    BotDifficulty.Low,
    BotDifficulty.Low,
    BotDifficulty.Low,
    BotDifficulty.Low,
  ]);

  const finalGame = await world.tables.gamesRepo.findById(world.gameId);
  if (finalGame?.status !== GameStatus.Completed) {
    console.error(`  FAIL: expected game to be completed, got status=${finalGame?.status}`);
    process.exit(1);
  }
  console.log("  PASS: game reached a terminal state.\n");
}

await scenarioDeterministicWin();
await scenarioRandomPlay();

console.log("All scenarios passed.");
