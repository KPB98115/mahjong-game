import { type SocketEvent } from "@app/types/server/socketEvent";
import {
  type GameServer,
  type GameSocket,
  type Scheduler,
  type SocketPayload,
} from "../logic/server/gameSocket.js";

export type ReceivedEvent = {
  event: SocketEvent;
  payload: SocketPayload | undefined;
};

export type RoomEmit = ReceivedEvent & { room: string };

export type FakeSocket = GameSocket & {
  rooms: Set<string>;
  received: ReceivedEvent[];
};

export type FakeSocketServer = {
  server: GameServer;
  sockets: FakeSocket[];
  roomEmits: RoomEmit[];
  connect(userId: string | undefined): FakeSocket;
  disconnect(socket: FakeSocket): void;
};

export function createFakeSocketServer(): FakeSocketServer {
  const sockets: FakeSocket[] = [];
  const roomEmits: RoomEmit[] = [];
  let nextId = 0;

  function inRoom(room: string): FakeSocket[] {
    return sockets.filter((socket) => socket.rooms.has(room));
  }

  const server: GameServer = {
    to(room) {
      return {
        emit(event, payload) {
          roomEmits.push({ room, event, payload });
          for (const socket of inRoom(room)) {
            socket.received.push({ event, payload });
          }
          return true;
        },
      };
    },
    in(room) {
      return {
        async fetchSockets() {
          return inRoom(room);
        },
        socketsLeave(leaving) {
          const names = typeof leaving === "string" ? [leaving] : leaving;
          for (const socket of inRoom(room)) {
            for (const name of names) {
              socket.rooms.delete(name);
            }
          }
        },
      };
    },
  };

  return {
    server,
    sockets,
    roomEmits,
    connect(userId) {
      nextId += 1;
      const socket: FakeSocket = {
        id: `socket-${nextId}`,
        data: { userId },
        rooms: new Set(),
        received: [],
        emit(event, payload) {
          socket.received.push({ event, payload });
          return true;
        },
        join(room) {
          for (const name of typeof room === "string" ? [room] : room) {
            socket.rooms.add(name);
          }
        },
        leave(room) {
          socket.rooms.delete(room);
        },
      };
      sockets.push(socket);
      return socket;
    },
    disconnect(socket) {
      socket.rooms.clear();
      sockets.splice(sockets.indexOf(socket), 1);
    },
  };
}

export type FakeTimer = {
  ms: number;
  cancelled: boolean;
  fire(): void;
};

export type FakeScheduler = {
  scheduler: Scheduler;
  timers: FakeTimer[];
  active(): FakeTimer[];
};

export function createFakeScheduler(): FakeScheduler {
  const timers: FakeTimer[] = [];
  return {
    timers,
    active() {
      return timers.filter((timer) => !timer.cancelled);
    },
    scheduler(callback, ms) {
      const timer: FakeTimer = {
        ms,
        cancelled: false,
        fire() {
          if (!timer.cancelled) {
            timer.cancelled = true;
            callback();
          }
        },
      };
      timers.push(timer);
      return {
        cancel() {
          timer.cancelled = true;
        },
      };
    },
  };
}
