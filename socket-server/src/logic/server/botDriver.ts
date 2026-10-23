import { buildBotContext } from "@app/logic/server/game/bot/botContext.js";
import { chooseClaimAction, chooseTurnAction } from "@app/logic/server/game/bot/botPlayer.js";
import { type SnapshotRepos } from "@app/logic/server/game/loadGameSnapshot.js";
import { type RoundsLogic } from "@app/logic/server/game/roundsLogic.js";
import { type BotDifficulty } from "@app/types/server/botDifficulty.js";
import { RoundPhase } from "@app/types/server/roundPhase.js";
import { RoundStatus } from "@app/types/server/roundStatus.js";
import { type Clock } from "./gameSocket.js";
import { type PlayActions } from "./playActions.js";

export class BotDriver {
  constructor(
    private repos: SnapshotRepos,
    private roundsLogic: RoundsLogic,
    private actions: PlayActions,
    private clock: Clock,
  ) {}

  async advance(gameId: string): Promise<void> {
    const seats = await this.repos.seatsRepo.findByGameId(gameId);
    const botSeats = seats.filter((s) => s.botDifficulty != null);
    if (botSeats.length === 0) {
      return;
    }

    const allRounds = await this.repos.roundsRepo.findByGameId(gameId);
    let activeRound = allRounds[0] as (typeof allRounds)[0] | undefined;
    for (const r of allRounds) {
      if (r.status === RoundStatus.InProgress) {
        activeRound = r;
      }
    }
    if (activeRound == null || activeRound.status !== RoundStatus.InProgress) {
      return;
    }
    const round = activeRound;

    const game = await this.repos.gamesRepo.findById(gameId);
    if (game == null) {
      return;
    }

    const now = this.clock();

    if (round.phase === RoundPhase.Draw) {
      const botSeat = botSeats.find((s) => s.seatIndex === round.currentSeatIndex);
      if (botSeat == null) {
        return;
      }
      await this.actions.perform(undefined, gameId, () =>
        this.roundsLogic.draw({ gameId, userId: botSeat.userId, now }),
      );
    } else if (round.phase === RoundPhase.Discard) {
      const botSeat = botSeats.find((s) => s.seatIndex === round.currentSeatIndex);
      if (botSeat == null) {
        return;
      }
      const ctx = await buildBotContext(
        this.repos,
        game,
        round,
        botSeat.seatIndex,
        null,
        null,
        false,
      );
      const choice = chooseTurnAction(ctx, botSeat.botDifficulty as BotDifficulty);
      if (choice.action === "win") {
        await this.actions.perform(undefined, gameId, () =>
          this.roundsLogic.declareWin({ gameId, userId: botSeat.userId, now }),
        );
      } else {
        await this.actions.perform(undefined, gameId, () =>
          this.roundsLogic.discard({ gameId, userId: botSeat.userId, tileId: choice.tileId, now }),
        );
      }
    } else if (round.phase === RoundPhase.Claim || round.phase === RoundPhase.RobKong) {
      const isRobKong = round.phase === RoundPhase.RobKong;
      const discardSeatIndex = round.discardFromSeatIndex;
      if (discardSeatIndex == null) {
        return;
      }

      // Find the discarded tile code for claim context.
      const discardTiles = await this.repos.discardTilesRepo.findByRoundId(round.id);
      const latestDiscard = discardTiles[discardTiles.length - 1];
      if (latestDiscard == null) {
        return;
      }
      const discardCode = latestDiscard.tileCode;

      // Have each bot seat that is not the discarder make their claim decision.
      const claimingBots = botSeats.filter((s) => s.seatIndex !== discardSeatIndex);
      for (const botSeat of claimingBots) {
        const ctx = await buildBotContext(
          this.repos,
          game,
          round,
          botSeat.seatIndex,
          discardCode,
          discardSeatIndex,
          isRobKong,
        );
        const choice = chooseClaimAction(ctx, botSeat.botDifficulty as BotDifficulty);
        if (choice.action === "win") {
          await this.actions.perform(undefined, gameId, () =>
            this.roundsLogic.declareWin({ gameId, userId: botSeat.userId, now }),
          );
        } else if (choice.action === "claim") {
          await this.actions.perform(undefined, gameId, () =>
            this.roundsLogic.claim({
              gameId,
              userId: botSeat.userId,
              kind: choice.kind,
              tileIds: choice.tileIds,
              now,
            }),
          );
        } else {
          await this.actions.perform(undefined, gameId, () =>
            this.roundsLogic.passClaim({ gameId, userId: botSeat.userId, now }),
          );
        }
        // After any winning claim resolves, the round phase will change.
        // Re-read round to avoid sending stale actions.
        const updated = await this.repos.roundsRepo.findById(round.id);
        if (updated == null || updated.status !== RoundStatus.InProgress) {
          return;
        }
        if (updated.phase !== RoundPhase.Claim && updated.phase !== RoundPhase.RobKong) {
          return;
        }
      }
    }
  }
}
