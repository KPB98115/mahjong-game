import { type PlayEmit } from "@app/model/server/playResult";
import { type SocketError } from "@app/types/server/socketError";
import { type SocketEvent } from "@app/types/server/socketEvent";

export type ActionErrorPayload = { error: SocketError };
export type GameAbortedPayload = { gameId: string };
export type SocketPayload = PlayEmit["payload"] | ActionErrorPayload | GameAbortedPayload;

export type SocketData = {
  userId?: string;
  gameId?: string;
  seatIndex?: number;
};

export type EventSink = {
  emit(event: SocketEvent, payload?: SocketPayload): boolean;
};

export type GameSocket = EventSink & {
  id: string;
  data: SocketData;
  join(room: string | string[]): Promise<void> | void;
  leave(room: string): Promise<void> | void;
};

export type GameServer = {
  to(room: string): EventSink;
  in(room: string): {
    fetchSockets(): Promise<GameSocket[]>;
    socketsLeave(room: string | string[]): void;
  };
};

export type TimerHandle = {
  cancel(): void;
};

export type Scheduler = (callback: () => void, ms: number) => TimerHandle;

export type Clock = () => Date;
