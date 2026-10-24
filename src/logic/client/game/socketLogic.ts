import { jsonValueSchema } from "../../../model/server/jsonValue";
import {
  actionErrorPayloadSchema,
  claimActionSchema,
  claimedPayloadSchema,
  claimWindowPayloadSchema,
  discardedPayloadSchema,
  discardActionSchema,
  drewPayloadSchema,
  gameAbortedPayloadSchema,
  gameActionSchema,
  joinedPayloadSchema,
  presencePayloadSchema,
  publicStatePayloadSchema,
  roundEndedPayloadSchema,
  selfHandPayloadSchema,
  turnPayloadSchema,
  type ActionErrorPayload,
  type ClaimAction,
  type ClaimedPayload,
  type ClaimWindowPayload,
  type DiscardAction,
  type DiscardedPayload,
  type DrewPayload,
  type GameAbortedPayload,
  type GameAction,
  type JoinedPayload,
  type PresencePayload,
  type PublicStatePayload,
  type RoundEndedPayload,
  type SelfHandPayload,
  type TurnPayload,
} from "../../../model/server/playResult";
import { type JsonValue } from "../../../types/server/jsonValue";
import { SocketEvent } from "../../../types/server/socketEvent";
import { type GameSocketPort } from "../../../types/client/gameSocketPort";

export type ClientSocket = {
  emit(event: string, payload?: object): void;
  on(event: string, listener: (payload: JsonValue) => void): void;
  disconnect(): void;
};

export type SocketFactory = (origin: string, options: { auth: { ticket: string } }) => ClientSocket;

export type SocketEventHandlers = {
  onJoined?(payload: JoinedPayload): void;
  onPublicState?(payload: PublicStatePayload): void;
  onPresence?(payload: PresencePayload): void;
  onGameAborted?(payload: GameAbortedPayload): void;
  onSelfHand?(payload: SelfHandPayload): void;
  onDrew?(payload: DrewPayload): void;
  onDiscarded?(payload: DiscardedPayload): void;
  onClaimWindow?(payload: ClaimWindowPayload): void;
  onClaimed?(payload: ClaimedPayload): void;
  onTurn?(payload: TurnPayload): void;
  onRoundEnded?(payload: RoundEndedPayload): void;
  onActionError?(payload: ActionErrorPayload): void;
};

export class SocketLogic implements GameSocketPort {
  private socket: ClientSocket | undefined;

  constructor(
    readonly origin: string,
    readonly handlers: SocketEventHandlers,
    readonly createSocket: SocketFactory,
  ) {}

  async connect(ticket: string, gameId: string): Promise<void> {
    this.disconnect();
    this.socket = this.createSocket(this.origin, { auth: { ticket } });
    this.bind();
    const parsed = gameActionSchema.safeParse({ gameId });
    if (!parsed.success) {
      return;
    }
    this.socket.emit(SocketEvent.JoinGame, parsed.data);
  }

  disconnect(): void {
    this.socket?.disconnect();
    this.socket = undefined;
  }

  draw(payload: GameAction): void {
    this.emitParsed(SocketEvent.Draw, gameActionSchema, payload);
  }

  discard(payload: DiscardAction): void {
    this.emitParsed(SocketEvent.Discard, discardActionSchema, payload);
  }

  claim(payload: ClaimAction): void {
    this.emitParsed(SocketEvent.Claim, claimActionSchema, payload);
  }

  passClaim(payload: GameAction): void {
    this.emitParsed(SocketEvent.PassClaim, gameActionSchema, payload);
  }

  declareWin(payload: GameAction): void {
    this.emitParsed(SocketEvent.DeclareWin, gameActionSchema, payload);
  }

  private emitParsed<T extends object>(
    event: SocketEvent,
    schema: { safeParse(input: T): { success: true; data: T } | { success: false } },
    payload: T,
  ): void {
    const parsed = schema.safeParse(payload);
    if (!parsed.success) {
      return;
    }
    this.socket?.emit(event, parsed.data);
  }

  private bind(): void {
    const socket = this.socket;
    if (socket == null) {
      return;
    }
    bind(socket, SocketEvent.Joined, joinedPayloadSchema, (payload) =>
      this.handlers.onJoined?.(payload),
    );
    bind(socket, SocketEvent.PublicState, publicStatePayloadSchema, (payload) =>
      this.handlers.onPublicState?.(payload),
    );
    bind(socket, SocketEvent.Presence, presencePayloadSchema, (payload) =>
      this.handlers.onPresence?.(payload),
    );
    bind(socket, SocketEvent.GameAborted, gameAbortedPayloadSchema, (payload) =>
      this.handlers.onGameAborted?.(payload),
    );
    bind(socket, SocketEvent.SelfHand, selfHandPayloadSchema, (payload) =>
      this.handlers.onSelfHand?.(payload),
    );
    bind(socket, SocketEvent.Drew, drewPayloadSchema, (payload) => this.handlers.onDrew?.(payload));
    bind(socket, SocketEvent.Discarded, discardedPayloadSchema, (payload) =>
      this.handlers.onDiscarded?.(payload),
    );
    bind(socket, SocketEvent.ClaimWindow, claimWindowPayloadSchema, (payload) =>
      this.handlers.onClaimWindow?.(payload),
    );
    bind(socket, SocketEvent.Claimed, claimedPayloadSchema, (payload) =>
      this.handlers.onClaimed?.(payload),
    );
    bind(socket, SocketEvent.Turn, turnPayloadSchema, (payload) => this.handlers.onTurn?.(payload));
    bind(socket, SocketEvent.RoundEnded, roundEndedPayloadSchema, (payload) =>
      this.handlers.onRoundEnded?.(payload),
    );
    bind(socket, SocketEvent.ActionError, actionErrorPayloadSchema, (payload) =>
      this.handlers.onActionError?.(payload),
    );
  }
}

function bind<T>(
  socket: ClientSocket,
  event: SocketEvent,
  schema: { safeParse(input: JsonValue): { success: true; data: T } | { success: false } },
  handler: (payload: T) => void,
): void {
  socket.on(event, (payload) => {
    const json = jsonValueSchema.safeParse(payload);
    if (!json.success) {
      return;
    }
    const parsed = schema.safeParse(json.data);
    if (!parsed.success) {
      return;
    }
    handler(parsed.data);
  });
}
