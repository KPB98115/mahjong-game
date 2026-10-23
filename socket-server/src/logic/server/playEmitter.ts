import { type PlayResult } from "@app/model/server/playResult";
import { EmitTarget } from "@app/types/server/emitTarget";
import { SocketEvent } from "@app/types/server/socketEvent";
import { type SocketError } from "@app/types/server/socketError";
import { gameRoom, seatRoom } from "./gameRooms.js";
import { type EventSink, type GameServer } from "./gameSocket.js";

export class PlayEmitter {
  constructor(private server: GameServer) {}

  deliver(result: PlayResult): void {
    for (const emit of result.emits) {
      const room =
        emit.target === EmitTarget.Seat
          ? seatRoom(result.gameId, emit.seatIndex)
          : gameRoom(result.gameId);
      this.server.to(room).emit(emit.event, emit.payload);
    }
  }

  actionError(socket: EventSink, error: SocketError): void {
    socket.emit(SocketEvent.ActionError, { error });
  }
}
