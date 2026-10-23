import { type RoundsLogic } from "@app/logic/server/game/roundsLogic";
import { gameActionSchema } from "@app/model/server/playResult";
import { type JsonValue } from "@app/types/server/jsonValue";
import { RoundPhase } from "@app/types/server/roundPhase";
import { SocketEvent } from "@app/types/server/socketEvent";
import { type ClaimWindowCoordinator } from "../claimWindowCoordinator.js";
import { gameRoom, seatRoom, tableRooms } from "../gameRooms.js";
import { type GameSocket } from "../gameSocket.js";
import { type PlayActions } from "../playActions.js";
import { type PlayEmitter } from "../playEmitter.js";

const windowPhases = new Set<RoundPhase>([RoundPhase.Claim, RoundPhase.RobKong]);

export class JoinGameHandler {
  constructor(
    private roundsLogic: RoundsLogic,
    private actions: PlayActions,
    private emitter: PlayEmitter,
    private coordinator: ClaimWindowCoordinator,
  ) {}

  async handle(socket: GameSocket, payload: JsonValue | undefined): Promise<void> {
    const action = this.actions.read(socket, gameActionSchema, payload);
    if (action == null) {
      return;
    }
    await this.attach(socket, action.userId, action.body.gameId);
  }

  async attach(socket: GameSocket, userId: string, gameId: string): Promise<void> {
    const outcome = await this.roundsLogic.snapshotForSeat({ gameId, userId });
    if (!outcome.ok) {
      this.emitter.actionError(socket, outcome.error);
      return;
    }
    const joined = outcome.result.emits.find((emit) => emit.event === SocketEvent.Joined);
    if (joined == null || joined.event !== SocketEvent.Joined) {
      throw new Error("snapshotForSeat returned no joined event");
    }
    const seatIndex = joined.payload.seatIndex;
    const previous = socket.data.gameId;
    if (previous != null && previous !== gameId) {
      for (const room of tableRooms(previous)) {
        await socket.leave(room);
      }
    }
    await socket.join([gameRoom(gameId), seatRoom(gameId, seatIndex)]);
    socket.data.gameId = gameId;
    socket.data.seatIndex = seatIndex;
    this.emitter.deliver(outcome.result);
    this.rearmClaimWindow(outcome.result);
  }

  private rearmClaimWindow(result: Parameters<PlayEmitter["deliver"]>[0]): void {
    if (this.coordinator.isOpen(result.gameId)) {
      return;
    }
    for (const emit of result.emits) {
      if (
        emit.event === SocketEvent.PublicState &&
        emit.payload.round != null &&
        windowPhases.has(emit.payload.round.phase)
      ) {
        this.coordinator.open(result.gameId, emit.payload.game.claimWindowMs);
      }
    }
  }
}
