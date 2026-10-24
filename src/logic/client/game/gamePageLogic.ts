import {
  gameSnapshotModelFrom,
  type GameSnapshotModel,
} from "../../../model/client/gameSnapshotModel";
import { type PlayerProfileModel } from "../../../model/client/playerProfileModel";
import {
  emptyRoundResultViewModel,
  type RoundResultViewModel,
} from "../../../model/client/roundResultViewModel";
import { type ScoreboardModel } from "../../../model/client/scoreboardModel";
import {
  emptyWaitingViewModel,
  type WaitingViewModel,
} from "../../../model/client/waitingViewModel";
import { type PublicStatePayload } from "../../../model/server/playResult";
import { type GameSnapshot } from "../../../model/server/gameSnapshot";
import { GamePanel } from "../../../types/client/gamePanel";
import { type GameSocketPort } from "../../../types/client/gameSocketPort";
import { type PageNavigator } from "../../../types/client/pageNavigator";
import { ApiError } from "../../../types/server/api";
import { GameStatus } from "../../../types/server/gameStatus";
import { PrevailingWind } from "../../../types/server/prevailingWind";
import { type AuthLogic } from "../auth/authLogic";
import { type GamesLogic } from "./gamesLogic";
import { PlayLogic } from "./playLogic";

export class GamePageLogic {
  profile: PlayerProfileModel | null = null;
  snapshot: GameSnapshotModel | null = null;
  waiting: WaitingViewModel = emptyWaitingViewModel();
  result: RoundResultViewModel = emptyRoundResultViewModel();
  scoreboard: ScoreboardModel | null = null;
  panel: GamePanel | null = null;
  connectedBySeat = new Map<number, boolean>();
  readonly play: PlayLogic;

  constructor(
    readonly uuid: string,
    readonly auth: AuthLogic,
    readonly games: GamesLogic,
    readonly navigator: PageNavigator,
    readonly socket: GameSocketPort,
  ) {
    this.play = new PlayLogic(socket);
  }

  async bootstrap(): Promise<void> {
    this.waiting.error = undefined;
    const session = await this.auth.ensureSession();
    if (!session.ok) {
      this.navigator.visit("/register");
      return;
    }
    const profile = await this.auth.loadProfile();
    if (!profile.ok) {
      this.navigator.visit("/register");
      return;
    }
    this.profile = profile.data;
    if (profile.data.currentGame != null && profile.data.currentGame.gameId !== this.uuid) {
      this.navigator.visit(`/game/${profile.data.currentGame.gameId}`);
      return;
    }
    const loaded = await this.games.loadSnapshot(this.uuid);
    if (!loaded.ok) {
      this.navigator.visit("/register");
      return;
    }
    this.applySnapshot(loaded.data);
    if (loaded.data.game.status !== GameStatus.Completed) {
      await this.connectSocket();
    }
  }

  async abort(): Promise<void> {
    this.waiting.error = undefined;
    this.waiting.pending = true;
    const result = await this.games.abort(this.uuid);
    this.waiting.pending = false;
    if (!result.ok) {
      this.waiting.error = result.error;
      return;
    }
    this.play.release();
    this.socket.disconnect();
    this.navigator.visit("/register");
  }

  async addBot(): Promise<void> {
    this.waiting.error = undefined;
    this.waiting.pending = true;
    const result = await this.games.addBot(this.uuid, this.waiting.botDifficulty);
    this.waiting.pending = false;
    if (!result.ok) {
      this.waiting.error = result.error;
      return;
    }
    this.applySnapshot(result.data);
  }

  async agreeNextWind(): Promise<void> {
    this.result.error = undefined;
    this.result.pending = true;
    const result = await this.games.agreeNextWind(this.uuid);
    this.result.pending = false;
    if (!result.ok) {
      this.result.error = result.error;
      if (result.error === ApiError.NorthComplete) {
        this.result.nextWindEnabled = false;
      }
      return;
    }
    if (result.data.game.id !== this.uuid) {
      this.socket.disconnect();
      this.navigator.visit(`/game/${result.data.game.id}`);
      return;
    }
    this.applySnapshot(result.data);
  }

  markCodeCopied(): void {
    this.waiting.copied = true;
  }

  applyPublicState(payload: PublicStatePayload): void {
    const previous = this.snapshot?.self ?? null;
    const self =
      previous == null ? null : { seatIndex: previous.seatIndex, handTiles: this.play.hand };
    this.applySnapshot({ ...payload, self });
  }

  applyPresence(seatIndex: number, connected: boolean): void {
    this.connectedBySeat.set(seatIndex, connected);
    if (this.snapshot != null) {
      this.snapshot = gameSnapshotModelFrom(toWireSnapshot(this.snapshot), this.connectedBySeat);
    }
  }

  onGameAborted(): void {
    this.play.release();
    this.socket.disconnect();
    this.navigator.visit("/register");
  }

  onJoined(gameId: string): void {
    if (gameId !== this.uuid) {
      this.socket.disconnect();
      this.navigator.visit(`/game/${gameId}`);
    }
  }

  applySelfHand(payload: Parameters<PlayLogic["applySelfHand"]>[0]): void {
    this.play.applySelfHand(payload);
  }

  applyDrew(payload: Parameters<PlayLogic["applyDrew"]>[0]): void {
    this.play.applyDrew(payload);
  }

  applyDiscarded(payload: Parameters<PlayLogic["applyDiscarded"]>[0]): void {
    this.play.applyDiscarded(payload);
  }

  applyClaimWindow(payload: Parameters<PlayLogic["applyClaimWindow"]>[0]): void {
    this.play.applyClaimWindow(payload);
  }

  applyClaimed(payload: Parameters<PlayLogic["applyClaimed"]>[0]): void {
    this.play.applyClaimed(payload);
  }

  applyTurn(payload: Parameters<PlayLogic["applyTurn"]>[0]): void {
    this.play.applyTurn(payload);
  }

  applyRoundEnded(payload: Parameters<PlayLogic["applyRoundEnded"]>[0]): void {
    this.play.applyRoundEnded(payload);
    this.panel = GamePanel.Result;
  }

  applyActionError(payload: Parameters<PlayLogic["applyActionError"]>[0]): void {
    this.play.applyActionError(payload);
  }

  draw(): void {
    this.play.draw(this.uuid);
  }

  discard(): void {
    this.play.discard(this.uuid);
  }

  claim(kind: Parameters<PlayLogic["claim"]>[1]): void {
    this.play.claim(this.uuid, kind);
  }

  passClaim(): void {
    this.play.passClaim(this.uuid);
  }

  declareWin(): void {
    this.play.declareWin(this.uuid);
  }

  applySnapshot(snapshot: GameSnapshot): void {
    this.snapshot = gameSnapshotModelFrom(snapshot, this.connectedBySeat);
    this.panel = panelFrom(snapshot.game.status);
    this.scoreboard = snapshot.scores;
    this.result.nextWindEnabled = snapshot.game.prevailingWind !== PrevailingWind.North;
    this.play.applySnapshot(snapshot);
  }

  private async connectSocket(): Promise<void> {
    const ticket = await this.auth.mintSocketTicket();
    if (!ticket.ok) {
      this.waiting.error = ticket.error;
      return;
    }
    await this.socket.connect(ticket.data.ticket, this.uuid);
  }
}

function panelFrom(status: GameStatus): GamePanel | null {
  if (status === GameStatus.Waiting) {
    return GamePanel.Waiting;
  }
  if (status === GameStatus.InProgress) {
    return GamePanel.Play;
  }
  if (status === GameStatus.Completed) {
    return GamePanel.Result;
  }
  return null;
}

function toWireSnapshot(model: GameSnapshotModel): GameSnapshot {
  return {
    game: model.game,
    seats: model.seats.map((seat) => ({
      seatIndex: seat.seatIndex,
      userId: seat.userId,
      displayName: seat.displayName,
      runningScore: seat.runningScore,
      nextWindAgreed: seat.nextWindAgreed,
      botDifficulty: seat.botDifficulty,
    })),
    round: model.round,
    self: model.self,
    publicTiles: model.publicTiles,
    scores: model.scores,
  };
}
