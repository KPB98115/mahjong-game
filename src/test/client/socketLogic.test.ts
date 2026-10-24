import { describe, expect, it } from "vitest";
import { SocketLogic, type ClientSocket } from "../../logic/client/game/socketLogic";
import { type JsonValue } from "../../types/server/jsonValue";
import { SocketEvent } from "../../types/server/socketEvent";
import { SocketError } from "../../types/server/socketError";

class MemorySocket implements ClientSocket {
  emitted: { event: string; payload: object | undefined }[] = [];
  listeners = new Map<string, Array<(payload: JsonValue) => void>>();

  emit(event: string, payload?: object): void {
    this.emitted.push({ event, payload });
  }

  on(event: string, listener: (payload: JsonValue) => void): void {
    const list = this.listeners.get(event) ?? [];
    list.push(listener);
    this.listeners.set(event, list);
  }

  disconnect(): void {}

  trigger(event: string, payload: JsonValue): void {
    for (const listener of this.listeners.get(event) ?? []) {
      listener(payload);
    }
  }
}

describe("SocketLogic", () => {
  it("joins with a parsed gameId after connect", async () => {
    const memory = new MemorySocket();
    const socket = new SocketLogic("http://localhost:3001", {}, () => memory);
    await socket.connect("ticket-1", "11111111-1111-4111-8111-111111111111");
    expect(memory.emitted).toEqual([
      {
        event: SocketEvent.JoinGame,
        payload: { gameId: "11111111-1111-4111-8111-111111111111" },
      },
    ]);
  });

  it("parses publicState and ignores a bad actionError payload", async () => {
    const memory = new MemorySocket();
    const publicStates: object[] = [];
    const errors: object[] = [];
    const socket = new SocketLogic(
      "http://localhost:3001",
      {
        onPublicState(payload) {
          publicStates.push(payload);
        },
        onActionError(payload) {
          errors.push(payload);
        },
      },
      () => memory,
    );
    await socket.connect("ticket-1", "11111111-1111-4111-8111-111111111111");
    memory.trigger(SocketEvent.ActionError, { error: "nope" });
    expect(errors).toEqual([]);
    memory.trigger(SocketEvent.ActionError, { error: SocketError.NotYourTurn });
    expect(errors).toEqual([{ error: SocketError.NotYourTurn }]);
  });

  it("parses discard before emit and skips an invalid payload", async () => {
    const memory = new MemorySocket();
    const socket = new SocketLogic("http://localhost:3001", {}, () => memory);
    await socket.connect("ticket-1", "11111111-1111-4111-8111-111111111111");
    memory.emitted = [];
    socket.discard({
      gameId: "not-a-uuid",
      tileId: "11111111-1111-4111-8111-111111111111",
    });
    expect(memory.emitted).toEqual([]);
    socket.discard({
      gameId: "11111111-1111-4111-8111-111111111111",
      tileId: "22222222-2222-4222-8222-222222222222",
    });
    expect(memory.emitted).toEqual([
      {
        event: SocketEvent.Discard,
        payload: {
          gameId: "11111111-1111-4111-8111-111111111111",
          tileId: "22222222-2222-4222-8222-222222222222",
        },
      },
    ]);
  });
});
