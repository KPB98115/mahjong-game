import { type PlayOutcome } from "@app/model/server/playResult";
import { SocketError } from "@app/types/server/socketError";
import { type JsonValue } from "@app/types/server/jsonValue";
import { type z } from "zod";
import { type ClaimWindowCoordinator } from "./claimWindowCoordinator.js";
import { type GameActionQueue } from "./gameActionQueue.js";
import { type Clock, type GameSocket } from "./gameSocket.js";
import { type PlayEmitter } from "./playEmitter.js";

export type ParsedAction<Schema extends z.ZodType> = {
  userId: string;
  body: z.infer<Schema>;
};

export class PlayActions {
  constructor(
    private queue: GameActionQueue,
    private emitter: PlayEmitter,
    private coordinator: ClaimWindowCoordinator,
    readonly clock: Clock,
    private advanceBots: (gameId: string) => void = () => undefined,
  ) {}

  read<Schema extends z.ZodType>(
    socket: GameSocket,
    schema: Schema,
    payload: JsonValue | undefined,
  ): ParsedAction<Schema> | undefined {
    const userId = socket.data.userId;
    if (userId == null) {
      this.emitter.actionError(socket, SocketError.Unauthorized);
      return undefined;
    }
    const parsed = schema.safeParse(payload);
    if (!parsed.success) {
      this.emitter.actionError(socket, SocketError.InvalidBody);
      return undefined;
    }
    return { userId, body: parsed.data };
  }

  async perform(
    socket: GameSocket | undefined,
    gameId: string,
    action: () => Promise<PlayOutcome>,
  ): Promise<void> {
    const outcome = await this.queue.run(gameId, action);
    if (!outcome.ok) {
      if (socket != null) {
        this.emitter.actionError(socket, outcome.error);
      }
      return;
    }
    this.emitter.deliver(outcome.result);
    this.coordinator.sync(outcome.result);
    this.advanceBots(outcome.result.gameId);
  }
}
