import { type RoundsLogic } from "@app/logic/server/game/roundsLogic";
import { claimActionSchema } from "@app/model/server/playResult";
import { type JsonValue } from "@app/types/server/jsonValue";
import { type GameSocket } from "../gameSocket.js";
import { type PlayActions } from "../playActions.js";

export class ClaimHandler {
  constructor(
    private roundsLogic: RoundsLogic,
    private actions: PlayActions,
  ) {}

  async handle(socket: GameSocket, payload: JsonValue | undefined): Promise<void> {
    const action = this.actions.read(socket, claimActionSchema, payload);
    if (action == null) {
      return;
    }
    const { gameId, kind, tileIds } = action.body;
    await this.actions.perform(socket, gameId, () =>
      this.roundsLogic.claim({
        gameId,
        userId: action.userId,
        kind,
        tileIds,
        now: this.actions.clock(),
      }),
    );
  }
}
