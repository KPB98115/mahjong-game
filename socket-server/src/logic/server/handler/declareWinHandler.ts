import { type RoundsLogic } from "@app/logic/server/game/roundsLogic";
import { gameActionSchema } from "@app/model/server/playResult";
import { type JsonValue } from "@app/types/server/jsonValue";
import { type GameSocket } from "../gameSocket.js";
import { type PlayActions } from "../playActions.js";

export class DeclareWinHandler {
  constructor(
    private roundsLogic: RoundsLogic,
    private actions: PlayActions,
  ) {}

  async handle(socket: GameSocket, payload: JsonValue | undefined): Promise<void> {
    const action = this.actions.read(socket, gameActionSchema, payload);
    if (action == null) {
      return;
    }
    const { gameId } = action.body;
    await this.actions.perform(socket, gameId, () =>
      this.roundsLogic.declareWin({ gameId, userId: action.userId, now: this.actions.clock() }),
    );
  }
}
