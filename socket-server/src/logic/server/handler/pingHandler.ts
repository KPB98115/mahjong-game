import { SocketEvent } from "@app/types/server/socketEvent";
import { type EventSink } from "../gameSocket.js";

export class PingHandler {
  handle(socket: EventSink): void {
    socket.emit(SocketEvent.Pong);
  }
}
