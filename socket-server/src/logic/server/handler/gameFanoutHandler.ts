import { type RoundsLogic } from "@app/logic/server/game/roundsLogic";
import { parseGameChannelMessage } from "@app/model/server/gameChannelMessage";
import { type PlayEmit } from "@app/model/server/playResult";
import { GameChannelEvent } from "@app/types/server/gameChannelEvent";
import { SocketEvent } from "@app/types/server/socketEvent";
import { type ClaimWindowCoordinator } from "../claimWindowCoordinator.js";
import { gameRoom, tableRooms } from "../gameRooms.js";
import { type GameServer } from "../gameSocket.js";
import { type PlayEmitter } from "../playEmitter.js";
import { type JoinGameHandler } from "./joinGameHandler.js";

const refreshedEvents = new Set<SocketEvent>([SocketEvent.SelfHand, SocketEvent.PublicState]);

export class GameFanoutHandler {
  constructor(
    private server: GameServer,
    private roundsLogic: RoundsLogic,
    private emitter: PlayEmitter,
    private coordinator: ClaimWindowCoordinator,
    private joinGame: JoinGameHandler,
    private advanceBots: (gameId: string) => void = () => undefined,
  ) {}

  async handle(raw: string): Promise<void> {
    const message = parseGameChannelMessage(raw);
    if (message == null) {
      return;
    }
    if (message.event === GameChannelEvent.GameAborted) {
      this.abort(message.gameId);
    } else if (message.event === GameChannelEvent.GameChanged) {
      await this.refresh(message.gameId);
    } else {
      await this.moveToNextWind(message.gameId, message.nextGameId);
    }
  }

  private abort(gameId: string): void {
    this.coordinator.cancel(gameId);
    this.server.to(gameRoom(gameId)).emit(SocketEvent.GameAborted, { gameId });
    this.server.in(gameRoom(gameId)).socketsLeave(tableRooms(gameId));
  }

  private async refresh(gameId: string): Promise<void> {
    const sockets = await this.server.in(gameRoom(gameId)).fetchSockets();
    const refreshedSeats = new Set<number>();
    let publicStateSent = false;
    for (const socket of sockets) {
      const { userId, seatIndex } = socket.data;
      if (userId == null || seatIndex == null || refreshedSeats.has(seatIndex)) {
        continue;
      }
      refreshedSeats.add(seatIndex);
      const outcome = await this.roundsLogic.snapshotForSeat({ gameId, userId });
      if (!outcome.ok) {
        continue;
      }
      const emits = outcome.result.emits.filter(
        (emit) =>
          refreshedEvents.has(emit.event) &&
          (emit.event !== SocketEvent.PublicState || !publicStateSent),
      );
      publicStateSent ||= emits.some((emit) => emit.event === SocketEvent.PublicState);
      this.deliver(gameId, emits);
    }
    this.advanceBots(gameId);
  }

  private async moveToNextWind(gameId: string, nextGameId: string): Promise<void> {
    this.coordinator.cancel(gameId);
    for (const socket of await this.server.in(gameRoom(gameId)).fetchSockets()) {
      const userId = socket.data.userId;
      if (userId != null) {
        await this.joinGame.attach(socket, userId, nextGameId);
      }
    }
  }

  private deliver(gameId: string, emits: PlayEmit[]): void {
    this.emitter.deliver({ gameId, emits });
  }
}
