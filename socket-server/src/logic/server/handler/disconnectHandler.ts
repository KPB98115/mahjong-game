import { presenceEmit } from "@app/logic/server/game/playEmits";
import { seatRoom } from "../gameRooms.js";
import { type GameServer, type GameSocket } from "../gameSocket.js";
import { type PlayEmitter } from "../playEmitter.js";

export class DisconnectHandler {
  constructor(
    private server: GameServer,
    private emitter: PlayEmitter,
  ) {}

  async handle(socket: GameSocket): Promise<void> {
    const { gameId, seatIndex } = socket.data;
    if (gameId == null || seatIndex == null) {
      return;
    }
    const remaining = await this.server.in(seatRoom(gameId, seatIndex)).fetchSockets();
    if (remaining.some((item) => item.id !== socket.id)) {
      return;
    }
    this.emitter.deliver({ gameId, emits: [presenceEmit(seatIndex, false)] });
  }
}
