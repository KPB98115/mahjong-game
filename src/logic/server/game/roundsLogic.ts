import { type PlayEmit, type PlayOutcome } from "../../../model/server/playResult";
import { ClaimAnswerKind } from "../../../types/server/claimAnswerKind";
import { GameStatus } from "../../../types/server/gameStatus";
import { MeldType } from "../../../types/server/meldType";
import { RoundPhase } from "../../../types/server/roundPhase";
import { RoundResultType } from "../../../types/server/roundResultType";
import { RoundStatus } from "../../../types/server/roundStatus";
import { SocketError } from "../../../types/server/socketError";
import { WinKind } from "../../../types/server/winKind";
import { type DbExecutor } from "../db/executor";
import { type ClaimAnswer, type ClaimWindowState, type ClaimWindowStore } from "./claimWindowStore";
import { type DiscardTileRow } from "./discardTilesRepo";
import { type DiscardTilesLogic } from "./discardTilesLogic";
import { type FlowerTilesLogic } from "./flowerTilesLogic";
import { type GameRandom } from "./gameRandom";
import { type GameRow } from "./gamesRepo";
import { evaluateWin, payoutAmount, type WinScore } from "./handScoring";
import { type HandsLogic } from "./handsLogic";
import { type HandTileRow } from "./handTilesRepo";
import { type HandTilesLogic } from "./handTilesLogic";
import { loadPublicState, type SnapshotRepos } from "./loadGameSnapshot";
import { formsMeld, seatDistance, type MeldsLogic, type SeatMeld } from "./meldsLogic";
import {
  claimedEmit,
  claimWindowEmit,
  discardedEmit,
  drewEmit,
  joinedEmit,
  presenceEmit,
  publicStateEmit,
  roundEndedEmit,
  selfHandEmit,
  turnEmit,
} from "./playEmits";
import { failPlay, readPlayRuleFailure } from "./playRuleFailure";
import { type RoundScoreRow } from "./roundScoresRepo";
import { type RoundScoresLogic } from "./roundScoresLogic";
import { type RoundRow, type RoundUpdate } from "./roundsRepo";
import { type PlannedPayment, type ScorePaymentsLogic } from "./scorePaymentsLogic";
import { scoringChartFor } from "./scoringChart";
import { type SeatRow } from "./seatsRepo";
import { type GameTransaction } from "./seatsLogic";
import { standardWallTileCodes } from "./wallTileCodes";
import { type WallTilesLogic } from "./wallTilesLogic";

export type RoundsLogicDeps = {
  repos: SnapshotRepos;
  wallTilesLogic: WallTilesLogic;
  handsLogic: HandsLogic;
  handTilesLogic: HandTilesLogic;
  flowerTilesLogic: FlowerTilesLogic;
  discardTilesLogic: DiscardTilesLogic;
  meldsLogic: MeldsLogic;
  roundScoresLogic: RoundScoresLogic;
  scorePaymentsLogic: ScorePaymentsLogic;
  claimWindowStore: ClaimWindowStore;
  runTransaction: GameTransaction;
  random: GameRandom;
};

export type PlayInput = {
  gameId: string;
  userId: string;
  now: Date;
};

export type DiscardInput = PlayInput & { tileId: string };

export type ClaimInput = PlayInput & { kind: MeldType; tileIds: string[] };

export type SnapshotForSeatInput = {
  gameId: string;
  userId: string;
};

type TableContext = {
  game: GameRow;
  round: RoundRow;
  seats: SeatRow[];
};

type SeatContext = TableContext & { seat: SeatRow };

type Draft = {
  emits: PlayEmit[];
  publicState: boolean;
  saveWindow?: ClaimWindowState;
  clearWindow?: boolean;
};

type DrawnTile = {
  tile: HandTileRow;
  flowerCodes: string[];
};

const wallSize = 144;
const seatCount = 4;

export class RoundsLogic {
  constructor(private deps: RoundsLogicDeps) {}

  async start(input: {
    game: GameRow;
    dealerSeatIndex: number;
    now: Date;
    tx: DbExecutor;
  }): Promise<void> {
    const { game, dealerSeatIndex, now, tx } = input;
    if (game.handTileCount * seatCount + 1 > wallSize) {
      throw new Error("hand does not fit in the wall");
    }
    const { repos, handsLogic, handTilesLogic, wallTilesLogic } = this.deps;
    await repos.gamesRepo.update(game.id, { status: GameStatus.InProgress, updatedAt: now }, tx);
    const round = await repos.roundsRepo.insert(
      {
        gameId: game.id,
        roundIndex: 0,
        status: RoundStatus.InProgress,
        dealerSeatIndex,
        prevailingWind: game.prevailingWind,
        currentSeatIndex: dealerSeatIndex,
        phase: RoundPhase.Draw,
        resultType: null,
        winKind: null,
        winnerSeatIndex: null,
        discardFromSeatIndex: null,
      },
      tx,
    );
    const ordered = this.deps.random.shuffle(standardWallTileCodes());
    const seats = await repos.seatsRepo.findByGameId(game.id, tx);
    let cursor = 0;
    for (const seat of seats) {
      const hand = await handsLogic.create(round.id, seat.seatIndex, tx);
      await handTilesLogic.deal(hand.id, ordered.slice(cursor, cursor + game.handTileCount), tx);
      cursor += game.handTileCount;
    }
    await wallTilesLogic.build(round.id, ordered.slice(cursor), cursor, tx);
    if (game.bonusTilesEnabled) {
      for (let offset = 0; offset < seatCount; offset += 1) {
        await this.replaceDealtBonusTiles(round.id, (dealerSeatIndex + offset) % seatCount, tx);
      }
    }
    if (!game.autoDraw) {
      return;
    }
    await this.drawFor({ game, round, seats }, dealerSeatIndex, now, tx);
  }

  async markAborted(gameId: string, now: Date, tx: DbExecutor): Promise<void> {
    const rounds = await this.deps.repos.roundsRepo.findByGameId(gameId, tx);
    const round = rounds.length === 0 ? undefined : rounds[rounds.length - 1];
    if (round == null) {
      return;
    }
    await this.deps.repos.roundsRepo.update(
      round.id,
      {
        status: RoundStatus.Aborted,
        resultType: RoundResultType.Abort,
        updatedAt: now,
      },
      tx,
    );
  }

  async snapshotForSeat(input: SnapshotForSeatInput): Promise<PlayOutcome> {
    const { repos } = this.deps;
    const game = await repos.gamesRepo.findById(input.gameId);
    if (game == null) {
      return { ok: false, error: SocketError.StaleGame };
    }
    const seat = await repos.seatsRepo.findByGameIdAndUserId(game.id, input.userId);
    if (seat == null) {
      return { ok: false, error: SocketError.NotSeated };
    }
    const rounds = await repos.roundsRepo.findByGameId(game.id);
    const round = rounds[rounds.length - 1];
    const hand =
      round == null ? undefined : await this.deps.handsLogic.findForSeat(round.id, seat.seatIndex);
    const tiles = hand == null ? [] : await this.deps.handTilesLogic.list(hand.id);
    const emits = [joinedEmit(game.id, seat.seatIndex), selfHandEmit(seat.seatIndex, tiles)];
    const publicState = await loadPublicState(repos, game.id);
    if (publicState != null) {
      emits.push(publicStateEmit(publicState));
    }
    emits.push(presenceEmit(seat.seatIndex, true));
    return { ok: true, result: { gameId: game.id, emits } };
  }

  async draw(input: PlayInput): Promise<PlayOutcome> {
    return this.act(input.gameId, async (tx) => {
      const context = await this.seatContext(input.gameId, input.userId, tx);
      if (context.game.autoDraw) {
        failPlay(SocketError.AutoDrawEnabled);
      }
      if (!this.isTurn(context, RoundPhase.Draw)) {
        failPlay(SocketError.NotYourTurn);
      }
      const drawn = await this.drawFor(context, context.seat.seatIndex, input.now, tx);
      if (drawn == null) {
        return this.finishEmptyWall(context, input.now, tx);
      }
      return {
        emits: [
          drewEmit(context.seat.seatIndex, drawn.tile, drawn.wallCount, drawn.flowerCodes),
          turnEmit(context.seat.seatIndex, RoundPhase.Discard),
        ],
        publicState: true,
      };
    });
  }

  async discard(input: DiscardInput): Promise<PlayOutcome> {
    return this.act(input.gameId, async (tx) => {
      const context = await this.seatContext(input.gameId, input.userId, tx);
      if (!this.isTurn(context, RoundPhase.Discard)) {
        failPlay(SocketError.NotYourTurn);
      }
      const { round, seat, game } = context;
      const hand = await this.deps.handsLogic.requireForSeat(round.id, seat.seatIndex, tx);
      const tiles = await this.deps.handTilesLogic.list(hand.id, tx);
      const picked = this.deps.handTilesLogic.pick(tiles, [input.tileId]);
      const tile = picked?.[0];
      if (tile == null) {
        failPlay(SocketError.InvalidTile);
      }
      await this.deps.handTilesLogic.remove([tile], tx);
      await this.deps.handTilesLogic.clearDrawn(
        tiles.filter((row) => row.id !== tile.id),
        tx,
      );
      const discard = await this.deps.discardTilesLogic.discard(
        round.id,
        seat.seatIndex,
        tile.tileCode,
        tx,
      );
      await this.deps.repos.roundsRepo.update(
        round.id,
        { phase: RoundPhase.Claim, updatedAt: input.now },
        tx,
      );
      return {
        emits: [
          discardedEmit(seat.seatIndex, discard.tileCode, discard.id),
          claimWindowEmit(seat.seatIndex, discard.tileCode, game.claimWindowMs),
        ],
        publicState: true,
        saveWindow: { roundId: round.id, discardTileId: discard.id, answers: [] },
      };
    });
  }

  async claim(input: ClaimInput): Promise<PlayOutcome> {
    return this.act(input.gameId, async (tx) => {
      const context = await this.seatContext(input.gameId, input.userId, tx);
      if (context.round.phase === RoundPhase.Claim) {
        return this.claimDiscard(context, input, tx);
      }
      if (this.isTurn(context, RoundPhase.Discard)) {
        return this.ownTurnKong(context, input, tx);
      }
      return failPlay(SocketError.NoClaimWindow);
    });
  }

  async passClaim(input: PlayInput): Promise<PlayOutcome> {
    return this.act(input.gameId, async (tx) => {
      const context = await this.seatContext(input.gameId, input.userId, tx);
      if (context.round.phase !== RoundPhase.Claim) {
        failPlay(SocketError.NoClaimWindow);
      }
      const discard = await this.lastDiscard(context.round, tx);
      if (discard.seatIndex === context.seat.seatIndex) {
        failPlay(SocketError.NotYourTurn);
      }
      return this.answer(context, discard, { kind: ClaimAnswerKind.Pass }, input.now, tx);
    });
  }

  async passUnanswered(input: { gameId: string; now: Date }): Promise<PlayOutcome> {
    return this.act(input.gameId, async (tx) => {
      const context = await this.tableContext(input.gameId, tx);
      if (context.round.phase !== RoundPhase.Claim) {
        failPlay(SocketError.NoClaimWindow);
      }
      const discard = await this.lastDiscard(context.round, tx);
      const window = await this.claimWindow(context, discard);
      for (const seatIndex of otherSeats(discard.seatIndex)) {
        if (!window.answers.some((item) => item.seatIndex === seatIndex)) {
          window.answers.push({ seatIndex, answer: { kind: ClaimAnswerKind.Pass } });
        }
      }
      return this.resolveWindow(context, window, discard, input.now, tx);
    });
  }

  async declareWin(input: PlayInput): Promise<PlayOutcome> {
    return this.act(input.gameId, async (tx) => {
      const context = await this.seatContext(input.gameId, input.userId, tx);
      const seatIndex = context.seat.seatIndex;
      if (context.round.phase === RoundPhase.Claim) {
        const discard = await this.lastDiscard(context.round, tx);
        if (discard.seatIndex === seatIndex) {
          failPlay(SocketError.NotYourTurn);
        }
        const score = await this.scoreWin(context, seatIndex, WinKind.Discard, discard, tx);
        if (score == null) {
          failPlay(SocketError.InvalidClaim);
        }
        return this.answer(context, discard, { kind: ClaimAnswerKind.Win }, input.now, tx);
      }
      if (!this.isTurn(context, RoundPhase.Discard)) {
        failPlay(SocketError.NotYourTurn);
      }
      const hand = await this.deps.handsLogic.requireForSeat(context.round.id, seatIndex, tx);
      const tiles = await this.deps.handTilesLogic.list(hand.id, tx);
      const score = tiles.some((tile) => tile.isDrawn)
        ? await this.scoreWin(context, seatIndex, WinKind.SelfDraw, undefined, tx)
        : undefined;
      if (score == null) {
        failPlay(SocketError.InvalidClaim);
      }
      return this.finishWin(context, seatIndex, WinKind.SelfDraw, undefined, score, input.now, tx);
    });
  }

  private async act(
    gameId: string,
    work: (tx: DbExecutor) => Promise<Draft>,
  ): Promise<PlayOutcome> {
    let draft: Draft;
    try {
      draft = await this.deps.runTransaction(work);
    } catch (error) {
      if (typeof error !== "object" || error == null) {
        throw error;
      }
      const failure = readPlayRuleFailure(error);
      if (failure != null) {
        return { ok: false, error: failure };
      }
      throw error;
    }
    if (draft.clearWindow) {
      await this.deps.claimWindowStore.clear(gameId);
    }
    if (draft.saveWindow != null) {
      await this.deps.claimWindowStore.save(gameId, draft.saveWindow);
    }
    const emits = draft.emits.slice();
    if (draft.publicState) {
      const publicState = await loadPublicState(this.deps.repos, gameId);
      if (publicState != null) {
        emits.push(publicStateEmit(publicState));
      }
    }
    return { ok: true, result: { gameId, emits } };
  }

  private async tableContext(gameId: string, tx: DbExecutor): Promise<TableContext> {
    const { repos } = this.deps;
    const game = await repos.gamesRepo.findById(gameId, tx);
    if (game == null) {
      return failPlay(SocketError.StaleGame);
    }
    const seats = await repos.seatsRepo.findByGameId(gameId, tx);
    return { game, seats, round: await this.liveRound(game, tx) };
  }

  private async seatContext(gameId: string, userId: string, tx: DbExecutor): Promise<SeatContext> {
    const { repos } = this.deps;
    const game = await repos.gamesRepo.findById(gameId, tx);
    if (game == null) {
      return failPlay(SocketError.StaleGame);
    }
    const seats = await repos.seatsRepo.findByGameId(gameId, tx);
    const seat = seats.find((item) => item.userId === userId);
    if (seat == null) {
      return failPlay(SocketError.NotSeated);
    }
    return { game, seats, seat, round: await this.liveRound(game, tx) };
  }

  private async liveRound(game: GameRow, tx: DbExecutor): Promise<RoundRow> {
    if (game.status !== GameStatus.InProgress) {
      return failPlay(SocketError.GameNotInProgress);
    }
    const rounds = await this.deps.repos.roundsRepo.findByGameId(game.id, tx);
    const round = rounds[rounds.length - 1];
    if (round == null || round.status !== RoundStatus.InProgress) {
      return failPlay(SocketError.GameNotInProgress);
    }
    return round;
  }

  private isTurn(context: SeatContext, phase: RoundPhase): boolean {
    return (
      context.round.currentSeatIndex === context.seat.seatIndex && context.round.phase === phase
    );
  }

  private async lastDiscard(round: RoundRow, tx: DbExecutor): Promise<DiscardTileRow> {
    const discard = await this.deps.discardTilesLogic.last(round.id, tx);
    if (discard == null) {
      throw new Error("claim phase without a discard");
    }
    return discard;
  }

  private async claimWindow(
    context: TableContext,
    discard: DiscardTileRow,
  ): Promise<ClaimWindowState> {
    const stored = await this.deps.claimWindowStore.find(context.game.id);
    if (
      stored != null &&
      stored.roundId === context.round.id &&
      stored.discardTileId === discard.id
    ) {
      return stored;
    }
    return { roundId: context.round.id, discardTileId: discard.id, answers: [] };
  }

  private async claimDiscard(
    context: SeatContext,
    input: ClaimInput,
    tx: DbExecutor,
  ): Promise<Draft> {
    const seatIndex = context.seat.seatIndex;
    const discard = await this.lastDiscard(context.round, tx);
    if (discard.seatIndex === seatIndex) {
      failPlay(SocketError.NotYourTurn);
    }
    const hand = await this.deps.handsLogic.requireForSeat(context.round.id, seatIndex, tx);
    const picked = this.deps.handTilesLogic.pick(
      await this.deps.handTilesLogic.list(hand.id, tx),
      input.tileIds,
    );
    if (picked == null) {
      return failPlay(SocketError.InvalidTile);
    }
    if (
      input.kind === MeldType.Chow &&
      !this.deps.meldsLogic.canChow(seatIndex, discard.seatIndex, context.game.chowOnlyFromPrevious)
    ) {
      failPlay(SocketError.InvalidClaim);
    }
    if (!formsMeld(input.kind, [...picked.map((tile) => tile.tileCode), discard.tileCode])) {
      failPlay(SocketError.InvalidClaim);
    }
    return this.answer(
      context,
      discard,
      { kind: ClaimAnswerKind.Meld, meldType: input.kind, tileIds: input.tileIds },
      input.now,
      tx,
    );
  }

  private async answer(
    context: SeatContext,
    discard: DiscardTileRow,
    answer: ClaimAnswer,
    now: Date,
    tx: DbExecutor,
  ): Promise<Draft> {
    const window = await this.claimWindow(context, discard);
    if (window.answers.some((item) => item.seatIndex === context.seat.seatIndex)) {
      failPlay(SocketError.InvalidClaim);
    }
    window.answers.push({ seatIndex: context.seat.seatIndex, answer });
    if (!this.canResolve(window, discard.seatIndex)) {
      return { emits: [], publicState: false, saveWindow: window };
    }
    return this.resolveWindow(context, window, discard, now, tx);
  }

  private canResolve(window: ClaimWindowState, discarderSeatIndex: number): boolean {
    const unanswered = otherSeats(discarderSeatIndex).filter(
      (seatIndex) => !window.answers.some((item) => item.seatIndex === seatIndex),
    );
    if (unanswered.length === 0) {
      return true;
    }
    const best = this.deps.meldsLogic.pickClaim(window.answers, discarderSeatIndex);
    if (best == null || best.answer.kind !== ClaimAnswerKind.Win) {
      return false;
    }
    const bestDistance = seatDistance(discarderSeatIndex, best.seatIndex);
    return unanswered.every(
      (seatIndex) => seatDistance(discarderSeatIndex, seatIndex) > bestDistance,
    );
  }

  private async resolveWindow(
    context: TableContext,
    window: ClaimWindowState,
    discard: DiscardTileRow,
    now: Date,
    tx: DbExecutor,
  ): Promise<Draft> {
    const best = this.deps.meldsLogic.pickClaim(window.answers, discard.seatIndex);
    let draft: Draft;
    if (best == null) {
      draft = await this.advanceTurn(context, discard.seatIndex, now, tx);
    } else if (best.answer.kind === ClaimAnswerKind.Win) {
      const score = await this.scoreWin(context, best.seatIndex, WinKind.Discard, discard, tx);
      if (score == null) {
        throw new Error("recorded win no longer scores");
      }
      draft = await this.finishWin(
        context,
        best.seatIndex,
        WinKind.Discard,
        discard,
        score,
        now,
        tx,
      );
    } else if (best.answer.kind === ClaimAnswerKind.Meld) {
      draft = await this.commitDiscardMeld(
        context,
        best.seatIndex,
        best.answer.meldType,
        best.answer.tileIds,
        discard,
        now,
        tx,
      );
    } else {
      throw new Error("pass cannot win a claim window");
    }
    return { ...draft, clearWindow: true };
  }

  private async advanceTurn(
    context: TableContext,
    fromSeatIndex: number,
    now: Date,
    tx: DbExecutor,
  ): Promise<Draft> {
    const next = (fromSeatIndex + 1) % seatCount;
    await this.deps.repos.roundsRepo.update(
      context.round.id,
      { currentSeatIndex: next, phase: RoundPhase.Draw, updatedAt: now },
      tx,
    );
    if (!context.game.autoDraw) {
      return { emits: [turnEmit(next, RoundPhase.Draw)], publicState: true };
    }
    const drawn = await this.drawFor(context, next, now, tx);
    if (drawn == null) {
      return this.finishEmptyWall(context, now, tx);
    }
    return {
      emits: [
        turnEmit(next, RoundPhase.Discard),
        drewEmit(next, drawn.tile, drawn.wallCount, drawn.flowerCodes),
      ],
      publicState: true,
    };
  }

  private async commitDiscardMeld(
    context: TableContext,
    seatIndex: number,
    meldType: MeldType,
    tileIds: string[],
    discard: DiscardTileRow,
    now: Date,
    tx: DbExecutor,
  ): Promise<Draft> {
    const { handsLogic, handTilesLogic, discardTilesLogic, meldsLogic, repos } = this.deps;
    const hand = await handsLogic.requireForSeat(context.round.id, seatIndex, tx);
    const picked = handTilesLogic.pick(await handTilesLogic.list(hand.id, tx), tileIds);
    if (picked == null) {
      throw new Error("claimed tiles left the hand");
    }
    await handTilesLogic.remove(picked, tx);
    await discardTilesLogic.take(discard, tx);
    const meld = await meldsLogic.expose(
      {
        roundId: context.round.id,
        seatIndex,
        meldType,
        isConcealed: false,
        fromSeatIndex: discard.seatIndex,
        tiles: [
          ...picked.map((tile) => ({ tileCode: tile.tileCode, isClaimed: false })),
          { tileCode: discard.tileCode, isClaimed: true },
        ],
      },
      tx,
    );
    await repos.roundsRepo.update(
      context.round.id,
      { currentSeatIndex: seatIndex, phase: RoundPhase.Discard, updatedAt: now },
      tx,
    );
    return this.afterMeld(context, seatIndex, hand.id, meld, now, tx);
  }

  private async ownTurnKong(
    context: SeatContext,
    input: ClaimInput,
    tx: DbExecutor,
  ): Promise<Draft> {
    if (input.kind !== MeldType.Kong) {
      failPlay(SocketError.InvalidClaim);
    }
    const { handsLogic, handTilesLogic, meldsLogic } = this.deps;
    const seatIndex = context.seat.seatIndex;
    const hand = await handsLogic.requireForSeat(context.round.id, seatIndex, tx);
    const picked = handTilesLogic.pick(await handTilesLogic.list(hand.id, tx), input.tileIds);
    if (picked == null) {
      return failPlay(SocketError.InvalidTile);
    }
    const codes = picked.map((tile) => tile.tileCode);
    let meld: SeatMeld;
    if (formsMeld(MeldType.Kong, codes)) {
      await handTilesLogic.remove(picked, tx);
      meld = await meldsLogic.expose(
        {
          roundId: context.round.id,
          seatIndex,
          meldType: MeldType.Kong,
          isConcealed: true,
          fromSeatIndex: null,
          tiles: codes.map((tileCode) => ({ tileCode, isClaimed: false })),
        },
        tx,
      );
    } else {
      const added = picked.length === 1 ? picked[0] : undefined;
      const pong =
        added == null
          ? undefined
          : meldsLogic.findUpgradablePong(
              await meldsLogic.listForSeat(context.round.id, seatIndex, tx),
              added.tileCode,
            );
      if (added == null || pong == null) {
        return failPlay(SocketError.InvalidClaim);
      }
      await handTilesLogic.remove([added], tx);
      meld = await meldsLogic.upgradeToKong(pong, added.tileCode, tx);
    }
    return this.afterMeld(context, seatIndex, hand.id, meld, input.now, tx);
  }

  private async afterMeld(
    context: TableContext,
    seatIndex: number,
    handId: string,
    meld: SeatMeld,
    now: Date,
    tx: DbExecutor,
  ): Promise<Draft> {
    const claimed = claimedEmit(
      seatIndex,
      meld.meld.meldType,
      meld.tiles.map((tile) => tile.tileCode),
    );
    if (meld.meld.meldType !== MeldType.Kong) {
      return {
        emits: [
          claimed,
          selfHandEmit(seatIndex, await this.deps.handTilesLogic.list(handId, tx)),
          turnEmit(seatIndex, RoundPhase.Discard),
        ],
        publicState: true,
      };
    }
    const drawn = await this.drawInto(context, seatIndex, handId, true, tx);
    if (drawn == null) {
      const ended = await this.finishEmptyWall(context, now, tx);
      return { ...ended, emits: [claimed, ...ended.emits] };
    }
    await this.deps.repos.roundsRepo.update(context.round.id, { updatedAt: now }, tx);
    return {
      emits: [
        claimed,
        selfHandEmit(seatIndex, await this.deps.handTilesLogic.list(handId, tx)),
        drewEmit(
          seatIndex,
          drawn.tile,
          await this.deps.wallTilesLogic.remainingCount(context.round.id, tx),
          drawn.flowerCodes,
        ),
        turnEmit(seatIndex, RoundPhase.Discard),
      ],
      publicState: true,
    };
  }

  private async drawFor(
    context: TableContext,
    seatIndex: number,
    now: Date,
    tx: DbExecutor,
  ): Promise<(DrawnTile & { wallCount: number }) | undefined> {
    const hand = await this.deps.handsLogic.requireForSeat(context.round.id, seatIndex, tx);
    const drawn = await this.drawInto(context, seatIndex, hand.id, false, tx);
    if (drawn == null) {
      return undefined;
    }
    await this.deps.repos.roundsRepo.update(
      context.round.id,
      { currentSeatIndex: seatIndex, phase: RoundPhase.Discard, updatedAt: now },
      tx,
    );
    const wallCount = await this.deps.wallTilesLogic.remainingCount(context.round.id, tx);
    return { ...drawn, wallCount };
  }

  private async drawInto(
    context: TableContext,
    seatIndex: number,
    handId: string,
    fromTail: boolean,
    tx: DbExecutor,
  ): Promise<DrawnTile | undefined> {
    const { wallTilesLogic, flowerTilesLogic, handTilesLogic } = this.deps;
    const flowerCodes: string[] = [];
    let tail = fromTail;
    while (true) {
      const wallTile = tail
        ? await wallTilesLogic.takeTail(context.round.id, tx)
        : await wallTilesLogic.takeNext(context.round.id, tx);
      if (wallTile == null) {
        return undefined;
      }
      if (flowerTilesLogic.setsAside(wallTile.tileCode, context.game.bonusTilesEnabled)) {
        await flowerTilesLogic.place(context.round.id, seatIndex, wallTile.tileCode, tx);
        flowerCodes.push(wallTile.tileCode);
        tail = true;
        continue;
      }
      const tile = await handTilesLogic.add(handId, wallTile.tileCode, true, tx);
      return { tile, flowerCodes };
    }
  }

  private async replaceDealtBonusTiles(
    roundId: string,
    seatIndex: number,
    tx: DbExecutor,
  ): Promise<void> {
    const { handsLogic, handTilesLogic, flowerTilesLogic, wallTilesLogic } = this.deps;
    const hand = await handsLogic.requireForSeat(roundId, seatIndex, tx);
    for (const tile of await handTilesLogic.list(hand.id, tx)) {
      if (!flowerTilesLogic.setsAside(tile.tileCode, true)) {
        continue;
      }
      await flowerTilesLogic.place(roundId, seatIndex, tile.tileCode, tx);
      await handTilesLogic.remove([tile], tx);
      while (true) {
        const replacement = await wallTilesLogic.takeTail(roundId, tx);
        if (replacement == null) {
          throw new Error("wall ran out while replacing dealt flowers");
        }
        if (flowerTilesLogic.setsAside(replacement.tileCode, true)) {
          await flowerTilesLogic.place(roundId, seatIndex, replacement.tileCode, tx);
          continue;
        }
        await handTilesLogic.add(hand.id, replacement.tileCode, false, tx);
        break;
      }
    }
  }

  private async scoreWin(
    context: TableContext,
    seatIndex: number,
    winKind: WinKind,
    discard: DiscardTileRow | undefined,
    tx: DbExecutor,
  ): Promise<WinScore | undefined> {
    const { game, round } = context;
    const chart = scoringChartFor(game.ruleset, game.scoringVersion);
    if (chart == null) {
      throw new Error(`no scoring chart for ${game.ruleset} ${game.scoringVersion}`);
    }
    const hand = await this.deps.handsLogic.requireForSeat(round.id, seatIndex, tx);
    const tiles = await this.deps.handTilesLogic.list(hand.id, tx);
    const melds = await this.deps.meldsLogic.listForSeat(round.id, seatIndex, tx);
    const concealed = tiles.map((tile) => tile.tileCode);
    if (discard != null) {
      concealed.push(discard.tileCode);
    }
    const score = evaluateWin(chart, {
      concealedTileCodes: concealed,
      exposedMelds: melds.map((item) => ({
        meldType: item.meld.meldType,
        isConcealed: item.meld.isConcealed,
        tileCodes: item.tiles.map((tile) => tile.tileCode),
      })),
      winKind,
      setsNeeded: game.winMeldCount,
      seatWindIndex: seatDistance(round.dealerSeatIndex, seatIndex),
      prevailingWind: round.prevailingWind,
      isDealer: round.dealerSeatIndex === seatIndex,
      flowerTileCodes: await this.deps.flowerTilesLogic.listForSeat(round.id, seatIndex, tx),
      bonusTilesEnabled: game.bonusTilesEnabled,
      wallEmpty: (await this.deps.wallTilesLogic.remainingCount(round.id, tx)) === 0,
    });
    if (score == null || score.units < Number(game.minScoreUnits)) {
      return undefined;
    }
    return score;
  }

  private async finishWin(
    context: TableContext,
    winnerSeatIndex: number,
    winKind: WinKind,
    discard: DiscardTileRow | undefined,
    score: WinScore,
    now: Date,
    tx: DbExecutor,
  ): Promise<Draft> {
    const { game, round, seats } = context;
    const chart = scoringChartFor(game.ruleset, game.scoringVersion);
    if (chart == null) {
      throw new Error(`no scoring chart for ${game.ruleset} ${game.scoringVersion}`);
    }
    if (discard != null) {
      const hand = await this.deps.handsLogic.requireForSeat(round.id, winnerSeatIndex, tx);
      await this.deps.discardTilesLogic.take(discard, tx);
      await this.deps.handTilesLogic.add(hand.id, discard.tileCode, true, tx);
    }
    const discardFromSeatIndex = discard == null ? null : discard.seatIndex;
    const payments = this.deps.scorePaymentsLogic.plan({
      winKind,
      winnerSeatIndex,
      discardFromSeatIndex,
      amount: payoutAmount(chart, score.units),
      seatIndexes: seats.map((seat) => seat.seatIndex),
    });
    await this.deps.scorePaymentsLogic.record(round.id, payments, tx);
    const scores = await this.deps.roundScoresLogic.record(
      { roundId: round.id, seats, payments, winnerSeatIndex, scoreUnits: score.units },
      tx,
    );
    await this.completeRound(
      context,
      {
        status: RoundStatus.Completed,
        resultType: RoundResultType.Win,
        winKind,
        winnerSeatIndex,
        discardFromSeatIndex,
        updatedAt: now,
      },
      now,
      tx,
    );
    return {
      emits: [roundEnded(RoundResultType.Win, winKind, winnerSeatIndex, scores, payments)],
      publicState: true,
      clearWindow: true,
    };
  }

  private async finishEmptyWall(context: TableContext, now: Date, tx: DbExecutor): Promise<Draft> {
    const scores = await this.deps.roundScoresLogic.record(
      {
        roundId: context.round.id,
        seats: context.seats,
        payments: [],
        winnerSeatIndex: null,
        scoreUnits: null,
      },
      tx,
    );
    await this.completeRound(
      context,
      { status: RoundStatus.Completed, resultType: RoundResultType.Draw, updatedAt: now },
      now,
      tx,
    );
    return {
      emits: [roundEnded(RoundResultType.Draw, null, null, scores, [])],
      publicState: true,
      clearWindow: true,
    };
  }

  private async completeRound(
    context: TableContext,
    roundValues: RoundUpdate,
    now: Date,
    tx: DbExecutor,
  ): Promise<void> {
    await this.deps.repos.roundsRepo.update(context.round.id, roundValues, tx);
    await this.deps.repos.gamesRepo.update(
      context.game.id,
      { status: GameStatus.Completed, completedAt: now, updatedAt: now },
      tx,
    );
  }
}

function otherSeats(seatIndex: number): number[] {
  return [1, 2, 3].map((offset) => (seatIndex + offset) % seatCount);
}

function roundEnded(
  resultType: RoundResultType,
  winKind: WinKind | null,
  winnerSeatIndex: number | null,
  scores: RoundScoreRow[],
  payments: PlannedPayment[],
): PlayEmit {
  return roundEndedEmit({
    resultType,
    winKind,
    winnerSeatIndex,
    scores: scores.map((score) => ({
      seatIndex: score.seatIndex,
      userId: score.userId,
      scoreDelta: Number(score.scoreDelta),
      scoreAfter: Number(score.scoreAfter),
      scoreUnits: score.scoreUnits == null ? null : Number(score.scoreUnits),
      isWinner: score.isWinner,
    })),
    payments,
  });
}
