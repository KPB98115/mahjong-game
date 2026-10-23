import { type RoundsLogic } from "@app/logic/server/game/roundsLogic";
import { discardActionSchema } from "@app/model/server/playResult";
import { type JsonValue } from "@app/types/server/jsonValue";
import { type GameSocket } from "../gameSocket.js";
import { type PlayActions } from "../playActions.js";

export class DiscardHandler {
  constructor(
    private roundsLogic: RoundsLogic,
    private actions: PlayActions,
  ) {}

  async handle(socket: GameSocket, payload: JsonValue | undefined): Promise<void> {
    const action = this.actions.read(socket, discardActionSchema, payload);
    if (action == null) {
      return;
    }
    const { gameId, tileId } = action.body;
    await this.actions.perform(socket, gameId, () =>
      this.roundsLogic.discard({
        gameId,
        userId: action.userId,
        tileId,
        now: this.actions.clock(),
      }),
    );
  }
}
